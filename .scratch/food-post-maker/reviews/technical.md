# Technical review: APP-004 Food post maker

Reviewer: tech lead, 2026-10-27. Against the PRD at `jurasolutions/prd/pending/apps/prd-app-004-food-post-maker-2026-10-27.md` (§4, §5), at branch `crew/food-post-maker` (9d6363b). The existing suite passes: 28 files, 385 tests.

## Verdict

**Go, with two prefactors first.** The plan fits the codebase: one new Function in the established shape, one new adapter (`env.AI`), and two small, backward-compatible extensions to shared modules. Nothing needs a migration. The blocking items below each have a fix that fits inside the tickets.

## Blocking findings

| # | Finding | Fix |
|---|---|---|
| B1 | `runAiTry` (`server/ai-run.js`) can only reserve and settle one Claude cost, and always answers 200 on success. The tool needs a second cost reserved with the try and settled afterwards, a step that can fail the try, and a 422 `no_food` answer that keeps the try used. | Prefactor P1 below. |
| B2 | Readiness is global. `aiReady(env)` (`server/ai-tool.js`) knows nothing about tools, so with no `AI` binding the tool would take a try and pay for a Claude call before failing, and `/api/apps/limit?tool=food-post-maker` would report `ready: true`. | Prefactor P2 below. |
| B3 | The Workers AI quota. On the free plan, 10,000 neurons a day is about 7 pictures, or 3 tries for the whole site. After that, every try still pays for a Claude call (about US$0.004) and then fails. The visitor's try comes back only once a day, so a second failure costs them a try. | Infra confirms the account's plan before deploy. Whatever the plan, on the first quota error close this tool for the rest of the SGT day: insert an `app_tries` row with `visitor_hash = '#site'` and `tool = '#closed:food-post-maker'` (the `#` keys are already reserved, so no migration is needed). The handler checks it before `runAiTry` and answers `429 cap`, and `/limit?tool=food-post-maker` reports `capReached: true`. Do **not** call `closeForToday`: that would shut the Claude tools over a quota that isn't theirs. |
| B4 | `server/ai-run.js` is not on `main` yet. It arrives with `crew/quote-ai-draft` (APP-001a), and this branch is built on top of it. | Release ships both together, in one push of this branch, and the release notes say so. Never cherry-pick APP-004 onto `main` by itself. |

## Seams

- **S1, existing and the highest: the Pages Function.** Call `onRequestPost(context)` from `functions/api/apps/food-post-maker.js` with `env = { ...ENV, DB: await createD1(), AI: fakeAi([...]) }` and `installNetwork({ anthropic: [...] })`, as `tests/receipt-reader.test.js` does. Test every behaviour in §2 here: the money, the refunds, the 422, partial pictures, readiness and the brand check. The `/limit` endpoint is the same seam, with an injected `registry` as `tests/limiter.test.js` uses.
- **S2, the one new seam: the `env.AI` binding.** `server/image-gen.js` is its adapter. Tests fake the **binding**, not the adapter, so the multipart encoding, the suffix and the parameters are exercised for real.
- **Pure modules**, unit-tested directly: `readPostOutput` (`server/food-posts.js`), `imagePriceNano` and `classifyImageError` (`server/image-gen.js`), and the browser's crop geometry (`src/apps/food-post-maker/compose.js`: `cropRect(shape, w, h)`, kept free of the DOM).
- **Browser:** `renderToStaticMarkup` plus pure state modules, as `tests/receipt-reader-ui.test.js` and `read-state.js` already do. The canvas itself is not unit-tested; QA covers it in the browser.

### Stubbing `env.AI`

`env.AI` is a binding, not `fetch`, so `tests/setup.js` does not catch it. A test that leaves it out gets `ready: false` and a 503, which fails safe: there is no real binding under Node. Add this to `tests/helpers/ai.js`:

```js
/** answers: { image: base64 } | Error, used in call order. */
export function fakeAi(answers = []) {
  const queue = [...answers];
  const calls = [];
  const AI = {
    run: vi.fn(async (model, input) => {
      const answer = queue.shift(); // take it before any await, so the two parallel calls stay in order
      const form = await new Response(input.multipart.body, {
        headers: { "content-type": input.multipart.contentType },
      }).formData();
      calls.push({ model, keys: [...form.keys()], prompt: form.get("prompt"), width: form.get("width"), height: form.get("height") });
      if (!answer) throw new Error("No scripted Workers AI answer left");
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  return { AI, calls };
}
export const aiPicture = () => ({ image: bytesToBase64(fakeJpeg(1024)) });
export const aiFailure = (message) => Object.assign(new Error(message), { name: "AiError" });
```

Assert `calls[i].keys` equals `["prompt", "width", "height"]` (proof that no upload reaches the image model), that `prompt` ends with the brand-safe suffix, and that `width` and `height` are `1024` and `1280`.

## Prefactors (land first, behaviour unchanged, existing 385 tests stay green)

### P1. `runAiTry` gains an optional `finish` and a status

```js
runAiTry({ ...today, finish /* optional */ })
finish = {
  reserve,                               // nano-dollars: the pictures' worst case
  run: async (result) => FinishOutcome,  // runs after `read` succeeds
}
FinishOutcome =
  | { ok: true,  spent, body, log, status? }   // status defaults to 200
  | { ok: false, spent, reason, kind: "cap" | "unavailable" }
```

The mechanics, all inside `server/ai-run.js`:

1. `takeTry` reserves `reserve + finish.reserve` in one atomic statement. The tool's daily call count goes up by one, as now; the pictures do not count towards `AI_SITE_CAP`, which is off by default. Document that.
2. `state.held = finish.reserve`. Claude's `add(message, reserve)` is unchanged and settles only Claude's share.
3. **Release in one place.** The `runAiTry` wrapper releases `state.held` after `withTry` returns or throws. That covers every early exit (refusal, API failure, invalid output, the repair skipped for budget) without touching each branch.
4. Just before calling `finish.run`, copy `held` to a local and set `state.held = 0`. If `run` throws, the reservation stays spent: pictures may have been made, so fail closed, as a dropped Claude connection already does. When `run` returns, settle `spent - held`.
5. `ok: false` goes to `fail(reason, kind === "cap" ? 429 : 503, kind)`, which refunds the try. No `closeForToday`.
6. `ok: true` replies `{ ...body, triesLeft }` with `status ?? 200`, and logs `ok: status < 400`.
7. Add `image_nano_usd` to the log line. Never the prompt.

With `finish` absent, `held` is 0 and nothing changes. That is the test for P1: the existing suites, unchanged. The new paths are tested through S1 in ticket 3.

### P2. Per-tool readiness

```js
const TOOL_NEEDS = { "food-post-maker": (env) => typeof env.AI?.run === "function" };
export function aiReady(env, tool) {
  return Boolean(env.DB && env.ANTHROPIC_API_KEY && env.TURNSTILE_SECRET && env.VISITOR_SALT) && (TOOL_NEEDS[tool]?.(env) ?? true);
}
```

Keep it server-side: `registry.json` ships in the browser bundle. Three call sites change: the two handlers pass `TOOL` (no behaviour change), and `limit-endpoint.js` passes `tool` (null keeps the health check as it is). Test it at S1 with an injected registry entry: `?tool=food-post-maker` reports `ready: false` while `?tool=receipt-reader` reports `ready: true` on the same env.

## How the handler uses them (ticket 3)

- **`no_food`:** `readPostOutput` returns `{ ok: true, noFood: true }`. `finish.run` returns `{ ok: true, spent: 0, status: 422, body: { error: "no_food" } }` without drawing anything, and the wrapper releases nothing because `spent: 0` settles the full `held` back.
- **Pictures:** use `Promise.allSettled` over two `drawPicture(env, prompt)` calls. Each returns `{ ok: true, image, costNano }` or `{ ok: false, kind, billed }`. Then `spent` is the sum of `costNano` over successes, plus the reservation of any picture that timed out. At least one success gives 200; a post with no picture leaves out `image`. When both fail, the worse kind wins (`cap` over `unavailable`), and `cap` also writes the B3 closed marker.
- **Price:** Workers AI returns no usage, so "real cost" means the list price for the size: `imagePriceNano(w, h) = 15_000_000 + ceil(max(0, w*h/1e6 - 1) * 2_000_000)`, which is 15,621,440 for 1024 x 1280. Reserve exactly that per picture: the reservation and the settlement are equal, and only failures change the total. Key the price by model, `{ "flux-2-klein-9b": ..., "flux-2-klein-4b": ... }`. An `AI_IMAGE_MODEL` that isn't in the table makes `TOOL_NEEDS` false, so an unpriced model is never called.
- **Retry and timeout:** retry a picture once on `unavailable` (one 3043 has been seen; an error answer is not billed). Wrap each `env.AI.run` in a 30 s race; a timed-out picture counts as `unavailable` and keeps its reservation.
- **Error classification:** the binding throws plain `Error`s, and their codes are not settled. Match `String(error.message)` against `/neuron|allocation|quota|limit|429|3036|4006/i` → `cap`, and treat everything else as `unavailable`. During the deploy smoke test, infra records the real message of a quota error and pins the regex to it.
- **Claude reservation:** `reservationNano({ images: n, inputTokens: name + dish + mention lengths })`, with `MAX_OUTPUT_TOKENS` 4096. With 3 photos that is about US$0.004 a try, about US$0.035 with the pictures included. That matches PRD §4.

## Brand and text check (should fix)

Telling Claude "no text, no logos" invites it to write those words into the image prompt, and a naive check then rejects the prompt and sends it for repair. Two rules:

1. The system prompt tells Claude to describe only what **is** in the picture, never what is absent. The negations belong only to the server's suffix.
2. `readPostOutput` rejects `™ ® ©` and positive requests, using whole words: `text|lettering|letters|words|logo|label|signage|sign|brand(ed)?|watermark|typography|menu board|written|caption`. Add fixtures for false positives: "signature dish", "designed", "a resigned" (no match), and "a sign reading OPEN" (a match). Run the check before the suffix is appended.

## Blast radius

| Area | Files | Change |
|---|---|---|
| Shared server | `server/ai-run.js`, `server/ai-tool.js`, `server/limit-endpoint.js`, `server/receipt-reader.js`, `server/quote-drafter.js` | P1, P2. Narrow and additive; no wide refactor. |
| Shared limiter | `server/limit.js` | Closed-marker helpers, `closeToolForToday` and `toolClosed`, plus `remaining` reporting them for a given tool. |
| New server | `server/food-posts.js`, `server/image-gen.js`, `server/food-post-maker.js`, `functions/api/apps/food-post-maker.js` | New. |
| Reuse | `server/images.js` (`checkUploads`), `src/apps/receipt-reader/prepare.js` (resize) | Reuse as they are. If the PDF branch of `prepare.js` drags pdf.js into the new tool's chunk, move `fitLongEdge` and the image path to `src/apps/_shared/` (a small prefactor inside ticket 4). |
| Browser | `src/apps/food-post-maker/*` (index, copy, api, state, compose, css), `src/apps/registry.json`, `src/lib/icons.js` if a new icon is needed | New. `loaders.js` and `prerender-routes.mjs` pick it up with no edit. |
| Copy and privacy | `src/content.js` (privacy: Cloudflare Workers AI gets only Claude's text description), `README.md` (endpoint, `AI` binding, `AI_IMAGE_MODEL`, the closed marker, local dev) | Edit. Add `Workers AI` to the assertion in `tests/shell.test.js`. |
| Tests | `tests/helpers/ai.js` (`fakeAi`, a `foodRequest` builder), `tests/food-post-maker.test.js`, `tests/food-post-maker-ui.test.js` | New. |
| Data | D1: new `app_tries` key `#closed:<slug>` and more `app_spend` per try | No schema change. |
| Platform | Pages production binding `AI` (Workers AI), optional `AI_IMAGE_MODEL` | Infra via the Cloudflare API. No `wrangler.toml`. |

## Risks

| Risk | Mitigation |
|---|---|
| Free-plan neuron quota (B3) | Infra checks the plan; the closed marker stops the spend on Claude calls that can't succeed. |
| Cost drift: billing is in neurons, the price is a list rate | One price table with a date, in `image-gen.js`; the budget errs high because the reservation equals the list price. |
| A picture with a brand or text in it | The photo never reaches the model, the suffix, the check, and the "check before posting" note. QA eyeballs a sample of real runs. |
| Prompt injection from text in a photo | The photos are data; the output is schema-bound and re-validated; the image model sees only checked text plus the suffix. Add an injection fixture like the receipt reader's. |
| Latency: Claude with 3 photos (about 10 s), then pictures (about 3 s, 6 s with a retry) | The progress message, and the pictures drawn in parallel. Well inside the Pages request limits. |
| Response size: two base64 JPEGs, about 0.3 to 0.6 MB | Acceptable. The browser decodes to a `Blob` and an object URL, never a huge data-URL `<img>`. |
| Local dev has no `AI` binding | The tool correctly reports unavailable under `dev:functions`. Document an opt-in `--ai AI` flag (it uses real, billed Workers AI), and don't make it the default. |
| Logs | Log counts, `image_nano_usd`, kinds and latency only. Never prompts, captions or dish names. |

## ADR drafts (for `docs/adr/`, written by the developer with ticket 3)

1. **The image cost shares the Claude budget, reserved up front with the try.** One US$5 daily ceiling for all AI spend, not a second budget. The pictures' worst case is reserved atomically with the try, so a try never pays for Claude and then finds no money for its pictures. Workers AI reports no usage, so a picture is settled at the list price for its size. *Rejected:* a separate image budget (two ceilings to tune), and reserving after Claude (wasted Claude spend when the budget runs out).
2. **The visitor's photo never reaches the image model.** Claude turns the photos into a text description; the model draws from text alone. This rules out carrying a logo over from the photo, at the price of pictures that resemble the real dish less. Reversing it means new privacy wording and a new brand-safety approach.

## Suggested ticket order

1. P1 `runAiTry` finish and status (prefactor; the existing suites prove it).
2. P2 per-tool readiness, with the `/limit` test at S1.
3. Server tracer: `image-gen.js`, `food-posts.js`, the handler, the route, the closed marker, `fakeAi`, and the registry entry as `draft`. All paths tested at S1.
4. The browser tool as a draft: upload, fields, results, compose, download and copy.
5. Go live: registry `live`, privacy and README, the `AI` binding (infra), and a smoke test that records the real quota error message.

Tickets 1 and 2 are independent of each other. Ticket 3 is blocked by both, ticket 4 by 3, and ticket 5 by 4.
