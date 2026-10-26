# Code review final: crew/food-post-maker (APP-004 Product photo studio)

Reviewer: crew reviewer, 2026-10-27. Diff: `git diff origin/main...HEAD` (merge-base 9d6363b,
origin/main 646a1cb; HEAD 6145bef, which is 4ab403e plus a crew-log commit). 26 commits, 62 files;
every changed source, test and doc file was read. Spec, in order of precedence:
`reviews/direction-change.md`, `reviews/conductor-decisions.md` (what the direction change keeps),
the PRD `prd/pending/apps/prd-app-004-product-photo-studio-2026-10-27.md`, and `issues/03-go-live.md`.
Conductor rulings in `crew-log.md` were taken as settled: a claim word in the typed business name
counts as owner-given, and a timed-out picture ends and keeps its price.

## Verdict: approve

There are no blocking findings. The server and the page agree on every field, limit and error code.
The page shows the closed state before anyone presses. The shared refactors leave the receipt
reader and the quote builder behaving as before. No blocked path is touched, and nothing in the
branch would break production on a push to `main`. What is left is two README corrections that
should go in before the push, plus code-tidiness items that can wait.

## Evidence

- `npx vitest run`: 34 files, 546 tests passed. This matches the operating card.
- `npm run build`: exit 0. The prerender wrote `apps/product-photo-studio.html` with the title
  "Product photo studio | Free tool from Jura Solutions". The description, `og:` and `twitter:`
  tags use `copy.subtitle`, as the sibling tools do. The canonical and `og:url` are
  `https://jurasolutions.sg/apps/product-photo-studio`.
- `uv run jura-growth check --file` over the 74 strings in `copy.js` and the new /privacy
  paragraph: pass.
- Blocked paths: `git diff --name-only origin/main...HEAD` shows nothing under
  `src/design-system/`, `dist/`, `.dev.vars`, `.env` or any `inputs/`. No `wrangler.toml` was
  added (`wrangler.local.toml` is unchanged). A grep of the diff for keys, tokens and account ids
  found only env var names and test placeholders.
- The production config is set outside the repo: the `AI` binding was added to Production through
  the Cloudflare API (crew-log 02:45), and `AI_IMAGE_MODEL` is unset, so the default is klein-4b.
  Preview deploys have no `AI` binding, so the studio reports `ready: false` there. That is
  expected, but the README does not say so (S2 below).

## Integration (what the ticket reviews could not see)

- **Contract.** The request fields are `token`, `files` and `refs` (the same count, in the same
  order), and `name` and `instruction` (trimmed, and left out when empty). They match
  `server/product-photo-studio.js:158-165` and `src/apps/product-photo-studio/api.js:21-34`. The
  limits agree on both sides: 4 photos, 80 and 500 characters, refs at most 512 px and under
  300 KB. The 200 shape (`products`, three `posts`, `image` only when drawn, hashtags with `#`)
  is read by `post-state.js:59-73`. A post with no picture shows `noPicture`.
- **Error codes.**
  - 422 `no_product` shows its own message and promises nothing about the try.
  - 429 `cap` or `limit` moves the page to the out-of-tries state (`index.jsx:172-174`).
  - 403, 413, 415, 502 and 503 follow the receipt reader's rule that "not counted" appears only
    when it is true.
- **Closed before pressing.**
  - `closeToolForToday` and `toolClosed` (`server/limit.js:313-327`) write and read the
    `#site` / `#closed:product-photo-studio` row on the UTC day.
  - `/api/apps/limit?tool=product-photo-studio` reports `capReached: true` for this tool only
    (`server/limit-endpoint.js:33`).
  - The page calls `fetchLimit` when it loads, so `isOutOfTries` hides the form and `LimitArea`
    shows the cap message and the talk card before anyone presses.
  - The 23:30 and 00:30 UTC boundary is tested (`tests/product-photo-studio.test.js:175-208`).
- **Shared refactors and the older tools.**
  - `aiReady(env, TOOL)`: `TOOL_NEEDS` has no entry for the receipt reader or the quote builder,
    so they get `?? true` and behave as before.
  - `runAiTry` without `finish` reserves `reserve + 0`, so `held` stays 0 and `releaseHeld` does
    nothing. The log shape is unchanged, because `extra` is `{}`.
  - The billing branch releases `held` before `closeForToday`, which fixes B1 from review 01.
  - `LimitArea` moved to `_shared/` and is used by both tools. The receipt-reader test now
    imports it from `_shared/`.
  - The `storage.js` local helpers keep their names and their behaviour.
  - `photos.js` keeps the receipt reader's decode order. The only change is that the bitmap is
    now closed on failure too, which is an improvement.

## Standards

**Blocking:** none.

**Should fix**

- **S1. The README's shared-pieces list is out of date.** At `README.md:180-186` it still calls
  `storage.js` "localStorage that never throws". It also leaves out `LimitArea.jsx`, `photos.js`,
  `useBlobUrl.js` and `controls.js`. The rule this breaks is the README's own convention ("Shared
  pieces in `src/apps/_shared/`"). Code review 02 (nit 3) handed this to ticket 03, and it is
  still open.

**Nits** (smell baseline; judgement calls)

- Middle Man, two import paths: `src/apps/receipt-reader/read-state.js:6-9` re-exports
  `isOutOfTries` and `showsTalkCard` from `_shared/ai-limit.js`. The receipt reader imports them
  from read-state, the studio from `_shared`. Point the receipt reader at `_shared` and drop the
  re-export.
- Duplicated code, still open from review 01: `checkRefs` repeats `checkUploads`' file guard and
  its size checks (`server/images.js:33-38` and `:97-102`).
- Duplicated helper, still open from review 01: `utcDay` (`server/limit.js:312`) sits apart from
  its twin `sgtDay` (`server/http.js:26`).
- Cross-tool imports, still open from review 02 (nit 4):
  - `product-photo-studio/post-state.js:8` imports `failureMessage` from
    `../receipt-reader/read-state.js`.
  - `index.jsx:12` imports `fileMessage` from `../receipt-reader/files.js`.

  Both belong in `_shared/`.
- Middle Man: these wrappers only pass through:
  - `receipt-reader/prepare.js:26` (`fitLongEdge` wraps `fitEdge`).
  - `product-photo-studio/prepare.js:10-13` (`imageKind` re-exported as `photoKind`).
- Divergent Change: `TOOL_NEEDS` (`server/ai-tool.js:17-20`) imports `image-gen.js` into the
  shared module, so the receipt reader's and the quote builder's Functions bundle the image
  code. Passing `needs` in from each handler would keep tool knowledge in the tool.
- Mysterious Name and Primitive Obsession, still open from review 01:
  - `extra` (`server/ai-run.js:128`).
  - `const finish = drawPosts(...)`, which is passed as `finish.run`
    (`server/product-photo-studio.js:190`).
  - `uploads.images.length` repeated (`:161-203`).
  - Bare `80` and `200` in `server/photo-studio.js` `validateStudio`, although
    `MAX_NAME_CHARS` exists.
- Speculative Generality: no caller passes `imagePriceNano`'s `size` parameter
  (`server/image-gen.js:60`).

## Spec

**Blocking:** none.

**Should fix**

- **S2. The README does not describe the endpoint or Preview behaviour.** Ticket 03 asks for
  "README sections (endpoint, `AI` binding, …)".
  - The APP-004 section (`README.md:421-475`) names `files` and `refs`. It does not give the
    whole contract: `token`, `name` and `instruction`, the 80 and 500 character limits, or the
    200, 422, 429 and 503 answer shapes. The route appears only in the file tree at `:86`.
  - `README.md:672-675` says the `AI` binding is on Production only. The health-check row
    (`:694`) does not say that a Preview deploy will therefore report the studio as
    `ready: false`. Someone testing a preview URL will read that as a fault.
- **S3. "Keeps the try" reads as the opposite of what happens.** `README.md:470` says
  "`no_product` is 422 and keeps the try". The code uses up the visitor's try and gives nothing
  back: the finish step returns ok with status 422 and no refund (`server/ai-run.js:205-220`), and
  `post-state.js:36-41` says "the try was used". The direction change's "try kept" means the site
  keeps it. In a README read by the next developer, write "uses the try (no refund)".

**Nits**

- `README.md:435` says the two sizes are made "in `src/apps/_shared/photos.js`". The sizes and
  qualities are set in `src/apps/product-photo-studio/prepare.js:15`; `photos.js` only decodes
  and draws.
- The README test table (`:605-606`) leaves out `tests/images.test.js` (`checkRefs`, `jpegSize`).
- The closed state reuses the site-wide `capReached` copy (`copy.js:22-23`): "The free tries are
  used up for today. Come back tomorrow". Between 00:00 and 08:00 SGT the studio reopens later
  the same day, and the other AI tools are still open. Consider a studio-only line, for example
  "The photo studio is closed until 8am. The other free tools are still open." This needs a
  `closed` flag from `/limit`, because `capReached` alone can't tell the two cases apart.
- When a quota error hits only some of the pictures, the try answers 200 and closes the tool, but
  the page's `limit` keeps `capReached: false` until the next press answers 429. This is harmless.
- `PostFrame.jsx:198` shows the AI note only on frames with a picture, and `copy.js:82` says "Edit
  caption" where the spec says "Edit". Both were accepted in review 02 and are recorded here only.

## Security

The security pass found no vulnerability at confidence 8 or above.

What it checked:

- **SQL.** The new SQL is parameterised (`server/limit.js:313-327`), and `tool` is checked with
  `isAiTool` before `toolClosed` runs.
- **Turnstile and the try.** Every path into `runAiTry` passes Turnstile. The input checks and
  the closed check come first, and they take no try and no budget.
- **Money.**
  - Claude's reservation and the pictures' worst case are taken in one `takeTry`.
  - `spent` never exceeds `held`, because each picture settles at most one billed attempt, and
    the reservation is the dearer of the two models.
  - `releaseHeld` zeroes the held amount before it awaits, so it cannot release twice.
  - A throw in `finish` keeps the reservation spent, so it fails closed.
- **Uploads.** Content-Length and `file.size` are checked before anything is read. `jpegSize`
  always moves forward and checks its bounds.
- **Logs and responses.** Logs carry counts, costs, reasons and latency only. Clients get fixed
  error codes.
- **Browser.** Model text renders only as React text. The base64 picture becomes a Blob behind
  an object URL.

Below the reporting bar, recorded for the record:

- A visitor can send garbage refs with valid SOF headers. Every picture then fails as
  `unavailable` and the try comes back, while the Claude call stays spent. `refundTry` allows one
  refund per visitor per SGT day, so this costs at most one Claude call a visitor a day.
  Confidence 3.
- The 9B price of a ref is read from the visitor's SOF header. It is capped at 512 px, so the
  worst underestimate is about US$0.002 a picture. Confidence 2.

## UI (crew:web-design-review)

The scope was the studio's `index.jsx`, `PostFrame.jsx` and CSS, `_shared/LimitArea.jsx`, and
`receipt-reader/index.jsx`, after the review 02 fix round. The design system wins where the
guidelines disagree with it: sentence-case buttons, straight apostrophes, "we" for Jura.

The fixes from review 02 are confirmed:

- Focus goes back to Start again, or to the instruction box or the upload area.
- `useBlobUrl` owns each object URL, which closes the leak.
- "Choose this one" keeps its label, with `aria-pressed` carrying the state.
- The chips are no longer marked as toggles.
- `aria-controls` points only at an editor that exists.
- "Saving the picture…" shows while saving.
- Frames are keyed per try.

Notes, not findings:

- `product-photo-studio.css:8, 123` set `outline: none` on `.pps-upload` and the results heading.
  Both are `tabIndex={-1}` targets that only receive focus from code. Nothing focuses them by
  keyboard, and the sibling tools do the same.
- `product-photo-studio.css` (`.pps-toast`): the fixed toast ignores
  `env(safe-area-inset-bottom)`. The siblings do the same, as recorded in review 02.

`receipt-reader/index.jsx` and `_shared/LimitArea.jsx` both pass.

## Production on push to `main`

- **Push.** Nothing in the branch blocks the push.
- **Config.** No `wrangler.toml`, no secret and no migration is needed, because the closed
  marker reuses `app_tries` with reserved keys.
- **Registry.** The entry matches the direction change's Identity section field for field, with
  `status: "live"`.
- **Rollback.** Revert on `main`, or roll back the deployment in Pages.
- **Watch item for the live check (not a finding).** The account is on the Workers free plan. A
  studio try base64-encodes up to 4 photos for Claude and parses three base64 pictures back,
  which is more CPU work than the receipt reader does. If the live check shows error 1102
  (exceeded resources), that is the cause.
