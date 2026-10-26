# Code review 01: server (crew/food-post-maker-01-server)

Reviewer: crew reviewer, 2026-10-27. Diff: `git diff crew/food-post-maker...crew/food-post-maker-01-server`
(tip 1feafff, 8 commits plus two merges, 21 files). Spec: `reviews/direction-change.md` (wins),
`reviews/conductor-decisions.md`, `issues/01-server.md`, `reviews/technical.md`, and the PRD
`prd/pending/apps/prd-app-004-product-photo-studio-2026-10-27.md`.

## Verdict: changes-requested

One blocking finding: a regression in the shared money path. It is a one-line fix, and it needs a
test. Everything else is "should fix" or a nit. The rest of the money handling is sound: every exit
before the pictures releases their reservation, a throw inside `finish` keeps it, partial success
and timeouts settle correctly, and `no_product` keeps the try and releases everything. Multipart,
error classes, readiness and the UTC closed marker all match the spec.

## Evidence

- `npx vitest run` on the branch tip: 490 passed, 1 failed. The failure is "gives every registered
  tool a folder with index.jsx and copy.js", which is expected until ticket 02 merges.
- `npm run build`: exit 0. Prerender ran for every live route.
- Repro tests in a throwaway worktree, not committed: B1, S1 and S2 below fail as described. The
  `finish`-throws path behaves as specified: 503, try refunded, picture reservation kept in full.
- Blocked paths: none touched. Nothing under `src/design-system/`, `dist/`, `.dev.vars` or `.env`,
  and no `wrangler.toml`.

## Standards

**Blocking:** none.

**Should fix:**
- Comments still carry the old name and the old error code, against direction-change.md
  "Rename the files and identifiers from food-post(s) to product-photo / photo-studio":
  - `server/ai-run.js:10-12` ("the food post maker's pictures")
  - `server/ai-run.js:22-23` ("the food post maker's 422 no_food"; the code sends `no_product`)
  - `server/limit-endpoint.js:10` ("the food post maker's Workers AI")

**Nits** (smell baseline; judgement calls):
- Duplicated knowledge: `server/product-photo-studio.js:201` reserves `3 * pictureReserveNano(...)`,
  while the count lives in the unexported `POSTS = 3` at `server/photo-studio.js:16`. Export it and
  use it in both places.
- Duplicated code: `checkRefs` repeats `checkUploads`' file guard (`server/images.js`, the two
  `typeof file === "string" || typeof file?.arrayBuffer !== "function"` checks).
- Reuse: `utcDay` (`server/limit.js:312`) sits apart from its twin `sgtDay` (`server/http.js:26`).
  Put it next to `sgtDay` in `http.js`.
- Mysterious name: `extra` (`server/ai-run.js:116`) puts an image-only field inside the generic
  runner. Also, `const finish = drawPosts(...)` is passed as `finish.run`
  (`server/product-photo-studio.js:189, 201`). A name like `drawPictures` would be clearer.
- Primitive obsession: `uploads.images.length` appears four times (`server/product-photo-studio.js:162, 197, 200, 202`).
  The product limits `80` and `200` are bare numbers (`server/photo-studio.js:205`), while every
  other limit in that file is a named constant.
- Speculative generality: the `size` parameter of `imagePriceNano` (`server/image-gen.js:60`) is
  never passed.

## Spec

**Blocking:**
- **B1. An Anthropic billing error on a studio try undoes `closeForToday`.** `server/ai-run.js:149-152`
  calls `closeForToday`, which sets the day's spend to the budget. The `finally` at
  `server/ai-run.js:83-85` then settles `-state.held`, which takes the spend back below the budget.
  Reproduced with a 402 `billing_error` on a studio try: the spend ends at 4,951,956,032 against a
  budget of 5,000,000,000, and `GET /api/apps/limit?tool=receipt-reader` answers
  `capReached: false`.
  - **What it breaks:** the rule at `server/limit.js:285-289`, that a billing error "closes the AI
    tools for the rest of the day by marking the budget spent". It also breaks technical.md P1:
    "With `finish` absent... nothing changes", because the shared invariant now depends on the
    order of release and close.
  - **Effect:** every AI tool reports open again. The next receipt-reader or quote try fits in the
    ~US$0.048 gap, takes a try, and calls an API that will refuse it.
  - **Fix:** in `apiFailure`'s billing branch, release `state.held` and zero it before
    `closeForToday`. Add an S1 test: a studio try plus a 402 leaves the spend at or above the
    budget, and `/limit` reports `capReached: true` for the other tools.

**Should fix:**
- **S1. Claim words are allowed from the business name.** `server/photo-studio.js:221` builds
  `allowed = [instruction, name]`. That breaks direction-change.md: "keep ... the claim-word rule
  (claims allowed only when in `instruction`)" and "a claim word is allowed when it appears in
  `instruction`".
  - It also contradicts the module's own system prompt, which says "unless the owner wrote it in
    the instruction" (`server/photo-studio.js:47`).
  - Reproduced: name "Halal Corner", no instruction, a caption saying "Halal" gives 200.
  - The developer recorded this as a decision, but no spec source allows it. Either drop `name`
    from `allowed`, or have the conductor amend direction-change.md. The recommendation is to drop
    it, since a shop name is not a claim the owner chose to make in a post.
- **S2. A 3043 error can be read as the daily cap.** `server/image-gen.js:86` matches `\b4006\b`
  anywhere in the message, and that includes the request id in parentheses.
  - Reproduced: `"AiError: AiError: Internal server error (1b4e28ba-2fa1-4006-a716-446655440000)"`
    gives `cap`.
  - This breaks conductor-decisions.md: "code 3043 'Internal server error' as `unavailable`".
  - If Workers AI ids are UUIDs, about 1 in 4,096 internal errors closes the tool until 00:00 UTC.
    The observed quota message does not contain "4006" at all.
  - **Fix:** match the code on `error.code`, or only outside a trailing `(...)`. Keep the message
    regex.
- **S3. No test of `finish.run` throwing, or of a billing error on a tool with `finish`.**
  technical.md P1: "The new paths are tested through S1 in ticket 3." Steps 4 (a throw keeps the
  reservation) and 3 (one release on every early exit) have no test. B1 would have been caught by
  the second.

**Nits:**
- **A timeout ends the picture rather than retrying** (`server/image-gen.js:154`). It is settled at
  the price of the attempted model, not the reservation. technical.md reads "a timed-out picture
  counts as `unavailable` and keeps its reservation", and conductor-decisions.md reads "up to 3
  attempts ... on `unavailable`". The developer's reason (a retry could pay twice and run for
  minutes) is sound. The conductor should ratify it.
- **The text and logo word check on the edit prompt is gone** (technical.md "Brand and text check"
  rule 2). direction-change.md keeps only the ™ ® © check, so this is within spec, but an
  instruction such as "add a sign reading SALE" now relies on the prompt and suffix alone. One way
  back is to restore the check without `label|brand`, since the owner's label is kept.
- **A non-JPEG ref answers `400 bad_request`** (`server/images.js`, `checkRefs`), where "Other
  errors as before" suggests `415 type`.
- **Caption length:** the prompt asks for under 500 characters (`server/photo-studio.js:45`), the
  check allows 600 (`:19`), and the ticket says under 600. Harmless.

## Security

The security pass found no vulnerabilities at confidence 7 or above. It checked these:

- Turnstile is still before the try. The closed check before Turnstile is read-only.
- The finish reservation is atomic with the try and never settles above it.
- Refunds still go through `refundOnce`.
- The new SQL is parameterised. The `#site` and `#closed:<slug>` keys cannot meet a visitor's hash.
- `TOOL_NEEDS[tool]` is reachable only after `isAiTool`.
- `jpegSize` is bounds-checked and always moves forward.
- Size limits come before reading: the Content-Length check comes before `formData()`, and
  `file.size` is checked before `arrayBuffer()` for refs.
- Logs carry counts, cost, reason and latency only, which the privacy test asserts. Nothing is
  stored.

**Should fix:** none.

**Nits:**
- **Refs are not tied to files** (`server/product-photo-studio.js:160-164`). A visitor can send a
  product photo as `files` for Claude to screen, and a different photo, such as a person, as
  `refs` to FLUX. That gets round the `no_product` gate. The suffix ("nobody in the frame") and
  Claude's product-only edit prompt limit what comes out, and tries are rate-limited.
  - Making the server derive the refs itself would need image decoding in the Worker.
  - Recommendation: accept this as a known risk and note it in ADR 0002's consequences.
- **The price of a ref comes from its JPEG SOF header.** A crafted file could be priced below what
  Workers AI bills. The 300 KB cap bounds it, so this is not a vulnerability.
