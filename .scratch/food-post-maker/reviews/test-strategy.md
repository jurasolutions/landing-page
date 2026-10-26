# Test strategy: APP-004 Food post maker

Spec: `jurasolutions/prd/pending/apps/prd-app-004-food-post-maker-2026-10-27.md` (§2 criteria C1 to C11, in order).
Seams: no `reviews/technical.md` exists yet, so this uses the PRD §5.1 module split. **Unit** means a pure
function (`server/food-posts.js`, `server/image-gen.js`, browser `model.js`/`compose.js`). **Function** means
`onRequestPost({ request, env })` from `functions/api/apps/food-post-maker.js` against the sql.js D1
(`tests/helpers/d1.js`), Anthropic and Turnstile scripted through `installNetwork`, and `env.AI` a stub object.
**Browser** means `renderToStaticMarkup` in node, as `tests/ui.test.js` does (vitest runs `environment: "node"`:
no DOM, no canvas). **Live** means a recorded check on jurasolutions.sg after the deploy. If the tech lead names
other seams, the seam wins and this file is updated; a disagreement goes to the conductor as a question.

## Test data

- **Claude outputs** (`message(...)` from `tests/helpers/ai.js`), new fixtures in `tests/helpers/food.js`:
  `GOOD` (3 dishes, 2 posts, 7 hashtags each, two different hero dishes); `ONE_DISH` (2 treatments of one dish);
  `BRANDED` (an image prompt with `™`, one with `®`, one with `©`); `TEXT_ASKING` (prompts asking for
  "a chalkboard reading 'Laksa'", "the shop's logo on the cup", "lettering", "a label"); `CLEAN_LOOKALIKES`
  (prompts with "textured stoneware" and "in context", which must pass; the developer decides whether
  "an unlabelled jar" passes and pins that decision in a test);
  `NO_FOOD` (the schema's no-food signal); `BAD_SHAPE` (prose, a third post, 4 or 11 hashtags, 13 dishes,
  extra keys); `REFUSAL` (`stop: "refusal"`).
- **`env.AI` stub** `{ run: vi.fn() }`, scripted per call: success (a small valid JPEG as base64, in the
  shape Workers AI returns for FLUX.2); transient error (a thrown `Error("InferenceUpstreamError")`, and a
  timeout); quota error (thrown with the daily free allocation / neuron limit text and code); plan error
  (model not available on the plan); one success plus one failure; both failures. The stub records every call
  so tests can read the model, prompt, width and height it received.
- **Uploads**: `fakeJpeg`, `fakePng`, a WEBP header, `fakeHeic` (refused), a 4 MB + 1 byte file, 4 files.
- **Fields**: name 80/81 chars, dish 120/121, mention 400/401; a dish named by the visitor; a mention with
  "10% off Tuesdays" and "halal"; text fields carrying "ignore previous instructions".

## Coverage map

| Criterion | Level | Seam / location | Data | Automated? |
|---|---|---|---|---|
| C1 upload 1 to 3 photos, optional fields | Function + browser | handler input checks; tool page render | uploads, field limits | yes: 0 and 4 photos, HEIC, 4 MB+1, each field over its limit answer 400 before Turnstile and the counter; page renders FileDrop with camera on, all five fields labelled |
| C1 camera capture on a phone | live | production, one phone | a real photo | manual, recorded |
| C2 one try returns dishes (max 12) and two posts with picture, caption, 5-10 hashtags, alt | unit + Function | `readPostOutput`; handler 200 body | `GOOD`, `BAD_SHAPE` | yes: table-driven validator cases; 200 body keys exactly `dishes, posts, triesLeft`, each post `dish, caption, hashtags, alt, image`; bad shape repaired once free, twice bad gives 502 and the try back |
| C3 generated, never copied; no upload reaches the image model | Function | `env.AI.run` call record; `fetch` stub | `GOOD` | yes: `run` gets only the model, prompt, width 1024, height 1280; no upload bytes in its arguments; no fetch beyond Anthropic and Turnstile (setup.js fails any other) |
| C4 works from a menu alone, a poor photo, a shopfront plus a typed dish | Function + live | instruction sent to Claude; production | dish field, `ONE_DISH`; real photos | partly: the typed dish reaches Claude as data and an inferred-dish output passes through. Real inference is live only |
| C4 nothing food-related | Function | handler | `NO_FOOD` | yes: 422 `{ error: "no_food", triesLeft }`, try used, `env.AI.run` never called, no picture cost reserved after settle |
| C5 no brands in pictures, enforced three ways | unit + Function | system prompt text; `readPostOutput` brand/text check; `image-gen.js` suffix | `BRANDED`, `TEXT_ASKING`, `CLEAN_LOOKALIKES` | yes: prompt contains the rule; every branded or text-asking prompt rejected, every lookalike passes (table-driven); rejection takes the free repair, second rejection 502 and refund; every `run` prompt ends with the exact brand-safe suffix, for both posts |
| C6 captions: no third-party brands, no unsupplied claims | unit + live | system prompt text; production | mention fixtures | partly: prompt states the rule and that "Anything to mention" is the only source of prices, offers and claims; mention reaches Claude as data. Model compliance is live only |
| C7 curated: stylist role, hero dish, two different posts | unit + Function + live | system prompt; instruction; validator | `GOOD`, `ONE_DISH`, named dish | partly: prompt carries the stylist brief; a named dish reaches Claude; exactly two posts enforced. Picture quality is live only |
| C8 download 1080x1350 or 1080x1080 JPG, copy caption, caption editable first | unit + browser + live | pure compose geometry and filename; results render | 1024x1280 source | yes: draw rects for portrait (scale to cover) and square (centre crop) are table-tested, filename slug from dish, copied text is the edited caption plus hashtags; render shows labelled textarea, shape switch, both buttons, `complete` count once. Real canvas output: live |
| C9 AI note on results | browser + copy | results render, `copy.js` | `GOOD` | yes: note present on every result view |
| C10 shared limits, image cost in the same budget | Function | `runAiTry` with `finish`; `server/limit.js`; `/api/apps/limit` | `env.AI` scripts | yes: see risk list R1 to R3 |
| C11 copy check; privacy note and `/privacy` say what goes where | browser + manual | `tests/privacy.test.js`, `copy.js` | page markup | yes for wording (Claude reads photos; Workers AI gets only a text description; nothing stored); `jura-growth check` run on every new string, output recorded in `qa-*.md` |

## Risk-based depth (riskiest first)

1. **R1 Money: picture cost.** Unit: price of 1024x1280 on klein 9B and 4B in nano-dollars (table). Function:
   the reservation at take-try covers Claude's worst case plus two pictures; both made settles both at real
   price; one made settles one and releases the other, answers 200 with the failed post lacking `image`; both
   failed answers 503, refunds the try and releases both; a request that would pass US$5 is refused before
   Claude or `env.AI` is called; `AI_IMAGE_MODEL=…-4b` is honoured and priced.
2. **R2 Workers AI errors.** Quota and plan errors classify as `cap`: "used up for today" answer, try given
   back, no picture cost kept. Transient and timeout classify as `unavailable`. Two pictures start in
   parallel (both `run` calls made before either resolves). A throw in `finish` refunds once, never twice.
3. **R3 Abuse and limits.** Turnstile checked before the counter; draft gate 404 before anything; tries shared
   with the receipt reader and quote builder; per-IP ceiling; `/api/apps/limit?tool=food-post-maker` is
   `ready: false` without `env.AI` and the POST answers 503 without taking a try.
4. **R4 Brand leakage** (C5) and **R5 prompt injection**: text fields and photo text saying "ignore previous
   instructions" stay inside the data block (closing-tag escape as in `quote-drafter.test.js`); extra keys dropped.
5. **R6 Privacy.** The one log line holds no dish, caption, prompt or field content; D1 holds only counts.
6. **Regression.** `tests/shell.test.js` "tags every committed tool General" will fail for an fnb-only entry;
   change it deliberately (and say why in the commit), never delete it. The full existing suite stays green.

## Non-functional

- Accessibility (WCAG AA): each picture's `alt` is the post's alt text; the caption textarea and fields are
  labelled; the progress message sits in a live region present before it fills; buttons have 44 px targets.
  Checked by render tests plus `crew:web-design-review` on the new files.
- Browser matrix at the live check: desktop Chrome and one phone (iOS Safari or Android Chrome).
- Performance: one try's wall time is recorded at the live check, not gated.
- Rollback: the Pages dashboard rollback or a revert on `main` (operating card); unchanged by this tool.

## Not tested, and why

- **Real Claude and Workers AI calls before the deploy.** Preview deployments carry no secrets and no `AI`
  binding, and tests never touch the network, so the real models are exercisable only on production after the
  push to `main`. Covered by the live check below; risk accepted by Ting Yu in the PRD §7 sign-off.
- **Model judgement** (picture realism, styling, hero choice, caption brand and claim compliance, inference
  from a poor photo): non-deterministic; checked by eye on a small live sample, not proven.
- **Canvas pixels and the clipboard** in automated tests: node has no canvas or clipboard; the geometry is
  unit-tested and the real files are measured at the live check.
- **The real price and neuron count** per picture: taken from Cloudflare's pricing page (PRD §4); the live
  check compares the D1 spend row with the expected figure once.

## Exit criteria

Gate (before the push to `main`):

1. Every row in the coverage map has at least one passing automated case, named in a `reviews/qa-*.md`.
2. Every case listed under R1 to R6 exists and passes.
3. `npm test` passes in full on `crew/food-post-maker` (baseline 2026-10-27: 28 files, 385 tests) and
   `npm run build` succeeds; there is no typecheck or lint to run.
4. `jura-growth check` passes on every new or changed string, output recorded.
5. Zero open critical or major defects; minor ones listed with an owner.
6. Every `reviews/code-review-*.md` verdict is approve, or its findings are closed.
7. `reviews/infra.md` records that the `AI` binding is on the production Pages project before the push.

Live check (after the deploy, recorded in `reviews/qa-live.md`; a failure of 8 to 10 means roll back):

8. `GET /api/apps/limit?tool=food-post-maker` answers `ready: true`.
9. Three real tries succeed: a menu photo alone; a blurry dish photo; a shopfront plus a typed dish name.
   Each returns two pictures with no text, logo, packaging or people, and captions with no brand names or
   unsupplied claims. Any visible brand or text in a picture is a major defect.
10. Both shapes download as JPGs measuring exactly 1080x1350 and 1080x1080; Copy caption pastes the edited text.
11. The day's D1 spend row matches the settled Claude cost plus US$0.0156 a picture made, within a cent.
