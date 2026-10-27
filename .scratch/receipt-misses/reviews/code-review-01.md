# Code review 01: receipt-misses (tickets 01 and 02)

Reviewer, 2026-10-27. Branch `crew/receipt-misses` at 7ea8248, compared with its merge-base with `main`
(5c3087d), with `.scratch/` left out. All 30 changed files were read.

## Verdict: approve

Nothing is blocking. The limiter and budget invariants hold, model output is validated field by field,
and no blocked path was touched. Five should-fix items are listed below. S1 and S2 are worth fixing
before release because a visitor would notice them. The rest are documentation and reuse.

## Evidence (run by the reviewer)

- `npm test` → 35 files, 618 tests passed.
- `npm run build` → built, and every route was prerendered.
- `git diff --name-only main...crew/receipt-misses` → nothing under `src/design-system/`, `dist/`,
  `inputs/`, `.dev.vars` or `.env`.
- `uv run jura-growth check` on all 17 new strings (from `../growth`) → every template passes. "Part of
  the receipt in photo 1…" and "We couldn't read a receipt in photo 2…" fail once a digit is filled in,
  because the numbers rule takes a photo index for a claim. That is a false positive in the checker, not
  a copy problem.
- A scratch vitest probe, run from the scratchpad with nothing written to the repo:
  - A second look that is sent counts towards `app_calls`: 2 calls for 2 requests.
  - A second look that numbers its one image `1` instead of `2` loses the receipt it found (S1).
  - A billing error during the second look returns 200 and does not close the day (N2).
  - The new system prompt and schema come to about 2,700 characters, roughly 700 tokens, which fits
    inside `BASE_INPUT_TOKENS` (3,000).

## Limiter and budget invariants (the areas the brief asked about)

- **Reservation.** The second look's worst case, `reservationNano({ images: n })`, is reserved in the same
  `takeTry` statement as the try (`server/ai-run.js:131-132`). Every exit before the finish step releases
  it through `releaseHeld`, and a billing error releases it before `closeForToday`.
- **Settlement.** The reservation is settled to what the second look spent (`ai-run.js:230`):
  - 0 when no second look was needed, which `tests/receipt-reader.test.js:393` tests;
  - the real cost when it was sent;
  - the whole reservation when the connection drops (`receipt-reader.js:144`, tested at `:400`).
- **AI_SITE_CAP.** The second look calls `countCall()`, which is `takeCall(…, 0)`, before it sends
  anything (`receipt-reader.js:138`). If that is refused, nothing is sent, and the probe confirms the
  count. Nothing goes out unreserved or uncounted.
- **Refunds.** The second look never fails the try, so it can never trigger a refund. A rate limit
  becomes 503 `busy` and gives the try back through the same once-per-day `refundOnce`
  (`tests/limiter.test.js:392`).
- **The other two tools.** The photo studio and quote drafter behave as before apart from the new
  `reason`s. The studio's finish step ignores the new second argument, and `costField` defaults to
  `image_nano_usd`.

## Standards

**Blocking:** none.

**Should fix**

- **S3. `server/anthropic.js:38`: a stale contract comment.** It still says `"rate"` means "show the
  used-up message (fail closed)". It now answers 503 `busy` and gives the try back (`ai-run.js:185-186`).
  `ai-run.js:51-52` also still says the finish reserve "does not count towards AI_SITE_CAP". That is true
  of the reservation, but the paragraph after it now adds a counted call; make the two agree.
  Rule: the README and the header comments are the contract ("The header comment … is the full
  contract", README).
- **S4. `README.md:386`: "Up to 3 files per try. The product photo studio does the same."** The studio
  takes 4 (`product-photo-studio/copy.js` "up to 4 photos"). "The same" was meant for the HEIC handling.
  In the README tests table:
  - `tests/receipt-reader-ui.test.js` has no row, although it now covers the per-photo cards, HEIC and
    `releasable`;
  - the `read-state.test.js` row (`README.md:688`) does not mention the failure wording it now tests.
- **S5. Reuse: two copies of the HEIC fallback.** `src/apps/receipt-reader/prepare.js:62` and
  `src/apps/product-photo-studio/prepare.js:35` hold the same "try to decode, then answer heic or
  unopenable" logic with the same comment. Both tools already share `src/apps/_shared/photos.js`
  (`decodeImage`), so the helper belongs there.

**Nits** (the smell findings are judgement calls)

- `server/ai-run.js:164,171` `fail(reason, status, error, why)`: `reason` is the log field and `why`
  becomes the response's `reason`. Names such as `logReason`/`pageReason` would make that clear.
- `src/apps/receipt-reader/read-state.js:65` `failureWords` works for any tool, but it lives in the
  receipt reader and the studio imports it across apps (`post-state.js:8`). `_shared/` is its home.
- `server/receipts.js`: the receipt field list appears in the schema, `entry()` and `blank()`, plus a
  copy in the tests. Adding a field means editing all of them.
- `server/receipt-reader.js:139-153`: an inner try/catch rethrows only for the outer catch to swallow.
  It is correct but hard to follow.
- `src/apps/receipt-reader/model.js:56`: `emptyLine =()` is missing a space.
- `src/apps/receipt-reader/ReceiptResults.jsx:146-149`: `remove` revokes using the `receipts` from the
  last render while the state update uses the newest list. In practice this is harmless, because cards
  only change through user events.

## Spec

**Blocking:** none.

**Should fix**

- **S1. `server/receipts.js:275` (`combineReadings`), with `server/receipt-reader.js:131`: a second look
  that renumbers its image throws away the receipt it found.** Ticket 01, decision 5, says to label the
  images "with their original numbers", which the code does. But when one image is looked at again
  (say image 2) and the model answers `image: 1`, the entry is dropped. Image 2 then keeps its first
  not-a-receipt answer, and the call is still paid for. The probe reproduced this:
  `[[1,true,"FairPrice Finest"],[2,false,null]]`. The test at `tests/receipt-reader.test.js:358` fixes
  the drop in place for the multi-image case. Fix: when exactly one image was looked at, give that image
  every entry the second look returns. Add a test for it.
- **S2. `src/apps/receipt-reader/index.jsx:215` and `:129`: the photo numbering does not match what the
  visitor saw.** The file list labels every file "Receipt {index+1}" (`copy.js:38`), counting files that
  failed to prepare. The card says "Photo {n}", where `{n}` counts only the files that were sent
  (`ready`). With files [failed, ok, ok], the visitor sees "Receipt 2" and "Receipt 3" before sending,
  then "Photo 1" and "Photo 2" on the cards, with a different noun as well. Ticket 02, decision 1, asks
  for "`{n}` is the photo's number in the batch it was sent with", and the code does exactly that.
  The thumbnail helps, but the two numbers still disagree. Choose one of these:
  - number the file list over the files that are ready;
  - drop failed files before sending;
  - pass each file's displayed number into `fromApi`.

  Also use one noun for both. No test covers how `index.jsx` wires the previews.
- **S6. The PRD amendment leaves out the HEIC change.**
  `jurasolutions/prd/pending/apps/prd-app-002-receipt-reader-2026-10-24.md:53,95` still says
  `HEIC shows "Please share the photo as a JPG."`, and line 65 lists "HEIC conversion" as out of scope.
  The branch decodes HEIC in the browser where it can and changes that copy. The PRD sits outside this
  repo, so the conductor should add one line to the amendment note.

**Nits and notes**

- **N1. Ticket 01's acceptance line "A second look refused by the budget … still returns 200" cannot
  happen.** Decision 5 reserves the second look up front, so a budget shortfall refuses the whole try
  with 429 `cap` before any call (`tests/budget.test.js:104`), even when no second look would be needed.
  The cost is that the last one or two try-reservations of each day go unused (about US$0.004 each at
  1 image). This follows decision 5, so I accept it. It is recorded here so the spec can be squared.
- **N2. `server/receipt-reader.js:153`:** a billing error during the second look is swallowed and the
  day is not closed. The next try's first call gets the same billing error and closes the day, so the
  system still fails closed, one call late.
- **N3. `server/receipts.js:216`:** `slice(0, MAX_RECEIPTS)` runs after the sort, so receipts cut from
  later images send those images to a second look. This can only happen with at least 10 entries for
  earlier images. It is not harmful.
- **N4. The quote builder (`src/apps/quote-builder/draft.js:66-69`)** still says "Drafting isn't
  available right now" when the connection fails (status 0). It maps `refused`, `rejected` and
  `bad_output` all to "We couldn't draft a quote from that…". No sentences were specified for it, and
  commit 8c8b2a0 chose these words on purpose. Each sentence is still accurate for a text-only draft,
  apart from status 0, which would read better with a connection message.
- **N5. Scope creep, all harmless:**
  - the comment change in `server/image-gen.js:19` (56 pictures, 18 tries);
  - the extra currency symbols in `server/receipts.js` (A$, HK$, ₹, ฿, Rp and others);
  - the quote builder copy, which was not ticketed but follows from the shared server change.
- **N6.** The second look's tokens are logged only as `second_look_nano_usd`. They are not in
  `input_tokens`/`output_tokens`/`cost_nano_usd`, so anyone adding up `cost_nano_usd` from the logs will
  undercount. The README documents the field.

## Security

The security pass found nothing. What was checked:

- **SQL.** Model output never reaches SQL. The D1 statements bind only day, hashes, keys, counts and
  nano amounts.
- **Logs.** They carry counts, fixed reason codes and costs, and no receipt content.
- **Response `reason`.** It is always one of the fixed values `refused`, `rejected` or `bad_output`.
  Internal reasons (`api_<status>`, `invalid_output`) go only to the log.
- **Prompt injection.**
  - Receipt text stays data: the labels and the second-look instruction are server text built only from
    server-computed numbers.
  - `image` must be an integer from 1 to n, or the entry is dropped (it becomes 1 for a single image).
  - `problem` must come from the enum, or it becomes null, and it is forced to null for a receipt.
  - Strings have control characters removed and are length-capped. Amounts must be finite and below
    1e9.
  - Currency goes through a fixed map, then `^[A-Z]{3}$`.
  - Injected text can at most trigger the second look, which is already reserved and counted.
- **Browser.** `<img src>` takes only the page's own `blob:` URLs, chosen by a validated index. All
  model text is rendered as React text, with no `dangerouslySetInnerHTML`.

## Object URLs (the brief's browser item)

- **After a read.** `index.jsx:129-136` keeps the previews that not-a-receipt cards still show and
  revokes the rest.
- **Removing a card.** `ReceiptResults.jsx:146-149` revokes the card's URL only when no other card shows
  it (`releasable`). The revoke runs in the event handler, not in the state updater, so StrictMode cannot
  run it twice.
- **Unmount.** `index.jsx:64-70` revokes both the file previews and the card previews.

No leak was found, and no URL is revoked while it is still on screen. Previews held by cards are
released only on removal or unmount, which is what ticket 02 asks for.

## Errors to sentences (the brief's mapping item)

| Server answer | Receipt reader | Photo studio (shares `failureMessage`) | Quote builder |
| --- | --- | --- | --- |
| 502 refused | refused sentence | refused sentence | unreadable (N4) |
| 502 rejected | rejected sentence | rejected sentence | unreadable (N4) |
| 503 busy | busy sentence | busy sentence | busy sentence |
| 503 bad_output | badOutput sentence | badOutput sentence | unreadable, "not counted" (N4) |
| 503 other | unavailable | unavailable | unavailable |
| 429 limit or cap | out-of-tries notice | out-of-tries notice | out-of-tries notice (unchanged) |
| status 0 | offline sentence | offline sentence | unavailable (N4) |
| 422 no_product | n/a | noProduct | n/a |

"This try wasn't counted." is added only when `triesLeft` shows the try came back
(`read-state.js:58-62`). Each row is tested in `read-state.test.js`, `product-photo-studio-ui.test.js`
and `draft.test.js`.

## UI (Web Interface Guidelines, changed lines)

### src/apps/receipt-reader/ReceiptResults.jsx

- `:65`: `<img alt="" width height>`. This passes: it is decorative and the sentence beside it names the
  photo.
- `:65`: the image could take `loading="lazy"` because it sits below the fold. It is a local `blob:`, so
  this is negligible (nit).
- `:66`: `Alert` sets `role="status"` on every miss card. That is how the design-system component works,
  and it is not new.

### src/apps/receipt-reader/receipt-reader.css

✓ pass. It uses tokens (`--space-3`, `--radius-sm`, `--border-subtle`), and `.rr-miss-why` has
`min-width: 0`.

### src/apps/receipt-reader/index.jsx

✓ pass on the changed lines. Numbering is S2.

### src/apps/receipt-reader/copy.js, src/apps/product-photo-studio/copy.js, src/apps/quote-builder/copy.js

✓ pass. Every error gives the visitor a next step.

Notes where the guidelines and the design system disagree (the design system wins):

- The guidelines want Title Case for headings and buttons; the design system uses sentence case.
- The guidelines prefer curly quotes; the repo's copy uses straight apostrophes throughout.
- The guidelines say to avoid the first person; the design system's voice uses "we".
