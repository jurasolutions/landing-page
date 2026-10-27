# Test strategy: quote builder, prices that include GST

Spec: `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` (section 2 holds the eight acceptance criteria, cited below as AC1 to AC8).
Written by QA on 2026-10-27, at spec review, before any code exists.

## Status of the seams

`reviews/technical.md` does not exist yet, so there is nothing to agree seams against. This strategy uses the seams the repo already has, plus two small ones it proposes (marked **new seam**). If the tech lead names different seams, the levels below hold and only the file names move. Any disagreement becomes a question, not a silent change.

Existing seams, all plain Vitest in the Node environment, no browser and no network:

- `calc.js` `quoteTotals(quote)` (pure money maths). Tests in `src/apps/quote-builder/calc.test.js`.
- `quoteFile.js` `serialiseQuote` and `parseQuoteFile`. Tests in `quote.test.js`.
- `pdf.js` `buildQuotePdf(quote, totals, copy)`, which returns `ops` (every text run with its string). Tests in `quote.test.js`. A second parser (pdf.js) already reads the output.
- `QuotePreview` and `QuoteForm` rendered with `react-dom/server` `renderToStaticMarkup`, the same way `tests/receipt-reader-ui.test.js` and `tests/product-photo-studio-ui.test.js` do it.

Proposed new seams:

- **new seam 1: `readGst(raw)`**, one pure function in `model.js` that turns an untrusted GST object into `{ on, rate, regNo, inclusive }`. Both `quoteFile.js` `readQuote` and `index.jsx` `rememberedStart` call it. Today `rememberedStart` builds the GST object inline (`index.jsx:35-40`) and cannot be tested without a browser, so AC7 has no automated seam unless this function exists. Recommendation to the developer: extract it.
- **new seam 2: a row extractor test helper** (in the test file only, not shipped). It reduces the Preview markup and the PDF `ops` to the same list of `[label, value]` totals rows so the two can be compared directly for AC5.

## Coverage map

Level words: unit, integration (at a named seam), end to end, manual UAT. There is no browser test runner in this repo, so "end to end" here means the whole path from a typed quote to the PDF bytes and back through a saved file, run in Node.

| Criterion | Level | Seam / location | Data needed | Automated? |
|---|---|---|---|---|
| AC1. Choice between exclude and include, exclusive the default, switch shown only while Add GST is on | Unit for the default (`newQuote().gst.inclusive === false`). Integration for the form: `QuoteForm` markup | `model.js`; `QuoteForm` via `renderToStaticMarkup` (switch present with GST on, absent with GST off; helper line present) | Quotes with GST off, GST on exclusive, GST on inclusive | Yes. The wording and look of the switch is also in the UAT script |
| AC2. Inclusive total equals the sum of line amounts after discounts; GST shown as part of it, never added | Unit, table-driven, plus a property check | `quoteTotals` in `calc.test.js` | Tables 1, 2 and 3 below | Yes |
| AC3. Exclusive mode identical to today, to the cent; existing tests unchanged | Unit (golden table) plus the existing suite | `quoteTotals`; whole of `npm test` with no edits to existing assertions | Table 4 (frozen exclusive figures captured from `main` before the change) | Yes. "Existing tests unchanged" is checked mechanically by diff, see exit criteria |
| AC4. GST once, on the discounted total, half up; before GST = total minus GST; before + GST = total exactly | Unit, table-driven edge cases plus property check | `quoteTotals` | Tables 1 to 3 and the property run | Yes |
| AC5. Preview and PDF state how prices are quoted and agree to the cent | Integration across two seams, compared with each other | `QuotePreview` markup and `buildQuotePdf` `ops`, through the row extractor (new seam 2); also read back with pdf.js | The same 6 quotes in both modes: no discount, line discounts, overall percent discount, overall amount discount, 0.00 total, long (40 lines, multi-page) | Yes. Visual layout of the extra rows is in the UAT script |
| AC6. Saved file keeps the choice; old file re-opens as exclusive; unknown or malformed value re-opens as exclusive | Unit (file parse and serialise), plus an end to end round trip | `serialiseQuote` and `parseQuoteFile` | Table 5 below | Yes |
| AC7. "Remember my business details" keeps the choice | Unit on `readGst` (new seam 1); manual UAT for the real `localStorage` round trip | `model.js` `readGst`; browser | Stored objects: full, old (no `inclusive`), `"true"` string, `1`, `null`, a non-object | Unit yes. Real browser storage manual, see the gap list |
| AC8. No new figure published; only number is the typed rate, default 9% | Unit "digit census" on copy, plus manual copy check | `copy.js` walked in a test; `jura-growth check` run by QA | Every string in `copy.js`, GST functions called with a sentinel rate | Census yes. `jura-growth check` is run by hand by QA, since it is a separate repo |

The "how prices are quoted" line in AC5 is tested for both words: inclusive prints "Prices include GST" (final wording comes from `copy.js`, so the test reads the string from `COPY`, not a literal), exclusive prints "GST added at the rate shown". Neither line may appear when GST is off. A quote with GST off must look exactly as it does today.

## Test data

### Table 1: rounding edge cases for the inclusive formula
`gst = round_half_up(A x rate / (100% + rate))`, `before = A - gst`. A is the discounted total in cents. Values below were computed independently with BigInt in a scratch script (not from the code under test), so the developer cannot copy their own bug into the expectations.

| A (total) | Rate | Expected GST | Expected before GST | What it proves |
|---|---|---|---|---|
| 109.00 | 9% | 9.00 | 100.00 | The clean case |
| 1.09 | 9% | 0.09 | 1.00 | Clean at the smallest scale |
| 0.01 | 9% | 0.00 | 0.01 | GST rounds to nothing; before GST takes the whole cent |
| 0.50 | 9% | 0.04 | 0.46 | Rounds down (0.0413) |
| 1.00 | 9% | 0.08 | 0.92 | Rounds down (0.0826) |
| 0.01 | 100% | 0.01 | 0.00 | Exact tie (0.5) rounds up; before GST is zero |
| 0.03 | 100% | 0.02 | 0.01 | Exact tie (1.5) rounds up, not to even |
| 0.03 | 20% | 0.01 | 0.02 | Exact tie (0.5) at a second rate |
| 0.09 | 20% | 0.02 | 0.07 | Exact tie (1.5) at a second rate |
| 0.02 | 50% | 0.01 | 0.01 | Rounds up from 0.667 |
| 0.05 | 8% | 0.00 | 0.05 | Old 8% rate still works; GST rounds to zero |
| 123,456.78 | 9% | 10,193.68 | 113,263.10 | Large amount, thousands separators |
| 10,000,000.00 | 9% | 825,688.07 | 9,174,311.93 | Very large, proves BigInt, no float drift |
| any | 0% | 0.00 | A | A zero rate adds nothing and loses nothing |
| any | blank or "nine" | 0.00, plus the existing `gstRate` "invalid" error | A | A bad rate still errors, exactly as in exclusive mode |
| any | 150% | Rate clamps to 100%, `gstRate` "percent" error | as the 100% row | Over-100 validation unchanged |

Exact ties exist only at some rates (at 9% none exist, because 109 is prime), so the tie rows deliberately use 100% and 20%. Rates with a fractional percent (12.5%, 0.5%) are in the property run.

### Table 2: whole-quote cases (discounts feed the total)
- Items 3 x 19.99 and 2.5 x 80.00, overall discount 10%, GST 9% inclusive. Subtotal 259.97, discount 26.00, after discount 233.97, GST 19.32, before GST 214.65, total 233.97. The same quote exclusive stays at the existing 21.06 and 255.03.
- Line percent discount that rounds at the line (3 x 33.33 less 10%), then an overall amount discount, inclusive. The total must equal subtotal minus discount, with no GST added.
- Overall discount equal to the subtotal: total 0.00, GST 0.00, before GST 0.00.
- Overall discount amount larger than the subtotal (clamped): same.
- A quote with no included lines (blank, or quantity 0): everything 0.00 in both modes.
- Inclusive on with GST later switched off: figures revert to no GST, and the preview drops the line.

### Table 3: the property-style check (new, in `calc.test.js`)
There is no `fast-check` in `package.json`, and the PRD forbids new dependencies for this tool, so the property check is hand-rolled and deterministic: a small seeded generator (for example mulberry32 with a fixed seed written in the test, so a failure reproduces exactly) plus one exhaustive sweep.

1. **Exhaustive sweep.** Every total from 0 to 30,000 cents against the rates 0, 1, 8, 9, 12.5, 20, 50 and 100 percent. About 240,000 cases, which runs in well under a second.
2. **Seeded random run.** At least 5,000 random quotes: 1 to 6 lines, quantities with up to 3 decimal places, prices up to 7 digits, random line and overall discounts of each type, rates from a pool of fixed rates plus random rates with up to 2 decimal places.

For every case in both runs, assert:

- P1. `taxable + gst === total` (before GST plus GST equals the total, exactly, in integer cents).
- P2. In inclusive mode, `total === subtotal - discount` (nothing is added on top).
- P3. `0 <= gst <= total`.
- P4. GST is within half a cent of the exact value, checked by cross-multiplying in BigInt, not by dividing: `2 x |gst x (10000 + rate) - total x rate| <= (10000 + rate)`. This is an independent oracle for the rounding, so the test does not repeat the implementation's own formula.
- P5. GST never decreases as the total goes up by one cent, at a fixed rate.
- P6. The formatted strings agree: `formatCents(taxable) + formatCents(gst)` parsed back to cents equals the formatted total. This catches display drift, not just arithmetic drift.
- P7 (exclusive, metamorphic). For the same random quote with `inclusive: false`, the result deep-equals the result with the `inclusive` field absent, and `total === taxable + gst` as today.

### Table 4: exclusive golden figures (AC3)
Before the developer changes `calc.js`, QA captures the output of `quoteTotals` on `main` for a fixed set of about 30 quotes (the 7 existing GST cases in `calc.test.js` plus the Table 2 quotes, exclusive) and stores them as literal expected values in the test file. The test then runs against the new code. The values come from the unmodified code, so they cannot have been bent to fit the change. This is the mechanical meaning of "identical to today, to the cent". The existing 630 tests are the second net.

### Table 5: quote file cases (AC6)
Each case parses with `parseQuoteFile`, and the file must still open (`ok: true`) unless stated.

| Input | Expected |
|---|---|
| Round trip of an inclusive quote | Identical quote back, `inclusive === true`, file `version === 2` |
| Round trip of an exclusive quote | Identical, `inclusive === false` |
| Version 1 file (written by hand to match what the old app produced, no `inclusive` key) | Opens, `inclusive === false`, every other field unchanged |
| Version 2 file with `inclusive` missing | Opens, exclusive |
| `inclusive` as `"true"`, `1`, `"yes"`, `null`, `[]`, `{}`, `0`, `"false"` | Opens, exclusive. Only the boolean `true` counts |
| `inclusive: true` while `gst.on` is false | Opens with the choice kept, but GST off means no GST in the totals and the quote prints with no GST rows |
| Version 3, version 0, version 1.5, a string version | Refused, as `version: 99` is refused today |
| Serialised version constant | `FILE_VERSION === 2`, and the existing "re-opens to an identical quote" test updates its `version: 1` expectation (see exit criteria, "existing tests unchanged" carve-out) |

A saved-file malformed value must not make the whole file refuse. Today `oneOf` throws on a bad option and the file is refused. The PRD says "re-opens as exclusive", so `inclusive` must be read like `on` (`=== true`), never like `discountType`. The case above is there to catch exactly that mistake.

## Risk-based depth

Ordered by consequence.

1. **A wrong total on a document the customer pays from (money).** Inclusive maths touches every quote that uses the switch, and the PDF is the thing a customer is told to pay against. Covered by Tables 1 to 3 (edge, whole-quote and property), the cross-check between preview and PDF (AC5), and the exclusive golden table, so a regression in today's behaviour is also caught. End to end path: typed quote, then totals, then preview and PDF, then a saved file, then reopen, then the same figures again (see "End to end path" below). Negative cases: bad and blank and over-100 rates, zero totals, discount larger than subtotal, a quantity of zero.
2. **Silently changing someone's existing quote (data integrity).** An old file or a stored setting that opens as inclusive, or a total that moves by one cent in exclusive mode. Covered by Table 4, Table 5 and the `readGst` cases. This is the reason the default stays exclusive and the read is strict.
3. **A saved file that older copies of the app mis-read.** The PRD bumps the version so an old copy refuses a new file instead of dropping the field and printing a different total. Covered by the version table (accepts 1 and 2, refuses 0 and 3). An actual old copy of the app cannot be run from the test suite, see the gap list.
4. **Preview and PDF disagreeing.** Two renderers each have their own list of rows (`QuotePreview.jsx:143-153` and `pdf.js:299-302`), which makes drift likely. Covered by the row extractor comparison on every quote in Table 2.
5. **Page overflow from the extra rows** (the PDF now prints before GST, GST and a statement line in inclusive mode). Covered by building the PDF with 1, 5, and 40 lines in inclusive mode with a discount, and asserting page count and that the totals block is not split from the grand total (the existing pagination tests give the pattern).
6. **A published figure the business cannot evidence (brand rule).** Covered by AC8's census.

### End to end path (one, scripted in a single test)
Build a quote with 5 lines, line and overall discounts, 9% inclusive, then: compute totals, build the PDF, render the preview, serialise to a file, parse the file, recompute totals, rebuild the PDF. Assert the two PDFs have the same totals rows and the preview rows equal the PDF rows. This is the path a real visitor takes (type, download, save, come back later).

## Non-functional

- **Accessibility (WCAG AA).** The new switch is a design-system `Switch` with a label and an `aria-describedby` helper, as the existing Add GST switch is. Automated: the markup test asserts a label, the helper id, and that the helper line is wired to the switch. Contrast, focus ring and tap target are inherited from the design system and the existing `TAP` constant, so they are checked by eye in the UAT script on the real page, not re-tested in code. There is no axe tooling in the repo.
- **Performance.** The property sweep must stay under about 2 seconds so the suite stays fast (630 tests currently pass in about 2 seconds). If it does not, the sweep range is cut, not the assertions. No browser performance budget is implied by the spec.
- **Security.** No new input surface other than a boolean in a file. Covered by Table 5 (strict read, unknown fields dropped, the file never executes anything). No server call and no network, which `tests/setup.js` already enforces by failing on a stray `fetch`.
- **Browser and device matrix.** Not widened. The tool is browser-side JavaScript with no new API. UAT is run once on a desktop browser and once at phone width (the preview restacks on a phone, which is where a longer label could wrap badly).
- **Migration and rollback.** File version 1 files are still read (Table 5). Rollback is a revert of the merge commit. After a rollback a version 2 file saved by someone is refused by the older app rather than mis-read, which is the intended failure. No data migration.

## Not tested, and why

Each of these is accepted by QA unless another owner is named; the user is told at G4.

| Gap | Reason | Who accepts the risk |
|---|---|---|
| Real browser `localStorage` write and read for "Remember my business details" | There is no browser test runner or jsdom in the repo, and adding one is a new dependency the PRD rules out. The pure `readGst` carries the logic, and the glue (`writeStored` with `quote.gst`) is unchanged and already passes the whole `gst` object. Covered by one manual UAT step | QA, with the UAT step as the check |
| The React component state and event handling (clicking the switch flips `inclusive`) | Same reason: no DOM. Static markup proves the switch renders in the right states; the `patch("gst")("inclusive")` handler is identical to the existing `on` and `regNo` handlers. Covered by the UAT step | QA |
| Pixel layout of the PDF and preview (spacing, wrapping of the longer "included" label, the statement line) | No visual regression tooling. The tests assert content, order and page count, not looks | QA, via UAT on a real PDF opened in a viewer |
| An old copy of the app opening a version 2 file | Cannot run old code in the suite. The version arithmetic is tested, and the claim "old app refuses" follows from the unchanged `data.version > FILE_VERSION` check in the old code, which QA read | Tech lead |
| Per-line GST, zero-rated and exempt lines, other taxes, currencies, tax invoice format | Out of scope in PRD section 3. The visitor still switches GST off for a mixed quote. Not tested because there is nothing to test, but a test pins that a quotation still never prints "tax invoice" | Ting Yu (PRD scope) |
| Correctness of the 9% rate against IRAS | Already evidenced and tested by the existing default-rate test (IRAS check dated 2026-10-24). Nothing in this change touches it | Ting Yu |
| Whether GST-inclusive pricing matches the visitor's own accounting (for example whether a business should round per line instead) | A business-policy question, not testable. The PRD fixes it as one rounding on the discounted total. Surfaced in UAT notes so Ting Yu can see it | Ting Yu (PRD assumption A) |
| `jura-growth check` on the new strings from inside the test suite | It lives in `repos/growth` and needs `uv`. QA runs it by hand at the gate and records the output | QA |

## UAT script (manual, short, for G4)
Run once by QA before the gate and offered to the user, who may waive it at G4. It takes about ten minutes against `npm run dev`.

1. Open the quote builder. GST is off. Switch Add GST on. Confirm the new "Prices include GST" switch appears and is off. Switch Add GST off again and confirm it disappears.
2. Add two lines (3 x 19.99, 2.5 x 80.00), an overall 10% discount, GST 9%, inclusive on. Confirm total 233.97, GST 19.32, before GST 214.65, and the line "Prices include GST" in the preview.
3. Download the PDF and open it in a normal viewer. Confirm the same figures and the same statement line. Switch to exclusive and confirm 21.06 GST and 255.03 total and the line "GST added at the rate shown".
4. Save the quote, reload the page, open the file, and confirm the switch is back on and the figures match. Open a quote file saved before the change (keep a copy from `main`) and confirm it opens exclusive.
5. Tick "Remember my business details", switch inclusive on, reload, and confirm the choice is still on. Press New quote and confirm the choice carries over with the GST setting, as the rate and registration number do today.
6. At phone width (about 375 px) confirm the switch, the helper line and the totals rows do not wrap awkwardly or need a sideways scroll.
7. Read every new sentence aloud against the brand voice (sentence case, second person, no buzzwords, no exclamation marks), and run `uv run jura-growth check "<text>"` from `repos/growth` on each new string.

## Exit criteria for the quality gate

The gate applies these mechanically. Each is a yes or a no.

1. **Every criterion has a passing case.** AC1 to AC8 each map to at least one passing automated test named in a `reviews/qa-*.md`, or (AC7 browser storage, the switch click, layout) one recorded UAT step with a pass.
2. **Full suite passes on the release branch**, run fresh by QA: `npm test` exits 0 with no skipped, `.only` or `.todo` tests added by this change. The count is at least 630 plus the new tests.
3. **Existing tests are unchanged except where the PRD forces a change.** `git diff main -- '*.test.js'` shows only added lines, apart from one permitted edit: the file version expectation in "re-opens to an identical quote" (`version: 1` becoming `version: 2`). Any other edited or deleted assertion is a failed criterion until the tech lead explains it in `reviews/technical.md`.
4. **Build passes**: `npm run build` exits 0 (this runs `vite build` and the prerender step). No typecheck or lint exists in this repo (operating card), so the gate records "none configured" rather than a pass.
5. **The property run really runs.** Table 3's sweep covers at least 200,000 cases and the random run at least 5,000, with a fixed seed, and finishes inside the 2-second budget. QA also runs it once with the seed changed to look for a failure the fixed seed misses, and records the result (not committed).
6. **Table 1 is present in full** in `calc.test.js`, including every tie row, as literal expected values, not computed by the code under test.
7. **The exclusive golden table (Table 4) was captured from `main` before the change** (git history shows the golden commit, or the test file shows values that equal today's output) and passes.
8. **Open defects**: zero critical, zero major. Minor defects are listed in the gate with an owner. A wrong total, or a total that differs between preview and PDF, is always critical.
9. **Code review**: every `reviews/code-review-NN.md` verdict is approved or approved-with-comments, and no comment marked blocking is open.
10. **Voice and numbers**: `jura-growth check` run on every new string with no flagged words, and the digit census test passes. The only digits in new copy come from the rate the visitor types.
11. **No scope creep into blocked paths**: `git diff main --stat` shows no change under `src/design-system/`, no new dependency in `package.json` or the lockfile, and no new `fetch` in the quote builder.
12. **UAT**: the script above was run by QA with all steps passing, and the user has either run it or waived it at G4. A waiver is the only item the user may grant. Every other criterion above is not waivable.

## Questions

No blocking questions. Two points for the developer and tech lead, with recommendations:

1. **A version 1 file that happens to contain `inclusive: true`** (hand-edited). Recommendation: read `inclusive` with `=== true` whatever the file version, as the PRD plan says, and note it in the test name. It is harmless and the simplest code.
2. **Where the strict read lives.** Recommendation: extract `readGst` (new seam 1) so the file reader and the remembered-settings reader cannot disagree, which also lets AC7 be tested.
