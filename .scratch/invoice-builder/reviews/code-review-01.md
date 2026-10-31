# Code review 01: share the quote builder's file readers, text wrapping and form fields

- **Ticket:** `issues/01-prefactor.md` (P1, P2, P3 from `technical.md` §2; decision D1)
- **Reviewed:** `git diff c8879d9 e15fabb` (branch `crew/invoice-builder-01-prefactor`, already merged into `claude/T-0001-invoice-builde` at 1461c72, and the quote builder files are the same there)
- **Files read in full:** `quoteFile.js`, `pdf.js` (diff), `pdf-text.js`, `QuoteForm.jsx` (diff and new imports), `form-parts.jsx`, `shared-parts.test.js`
- **Date:** 2026-10-31

## Verdict: approve

There are no blocking findings. The quote builder behaves exactly as before. File reading and refusals, PDF text wrapping and form markup are all unchanged, and the evidence is below. The two nits can wait for a follow-up commit or be dropped.

## Does the quote builder behave exactly as before?

- **File reading and refusals (P1).** The field rules inside `readBusinessFields`, `readCustomer`, `readItems` and `readOverallDiscount` are the old `readQuote` lines unchanged, and `text`, `date`, `oneOf`, `logo` and `BadFile` are the same code, now exported. The order of evaluation has changed: every item is now read before the business section, where before only the array and length check came first. That can't be seen from outside, because `parseQuoteFile` turns every `BadFile`, whatever its reason, into `{ ok: false }` (`quoteFile.js:161-171`). The same number of item ids is made, because the empty-list `emptyItem()` path is unchanged. `readBusiness` now calls `readBusinessFields` directly. The old route through `readQuote({ business: raw, items: [] })` could only throw on the business fields, so it returns and refuses the same things.
- **PDF text wrapping (P2).** The body of `wrapText` in `pdf-text.js` matches the old one in `pdf.js` line for line. `pdf.js` imports it for its own calls (lines 113, 120, 151, 152) and re-exports it, and the test pins that `pdf.js`'s export is the same function. `toPrintable` is still used in `pdf.js`, so its import isn't left dangling.
- **Form markup (P3).** `form-parts.jsx` matches the removed block of `QuoteForm.jsx` except for the added `export` keywords and the file header and imports. No JSX or prop changed. `QuoteForm.jsx` uses none of the imports it dropped (`Input`, `Textarea`, `IconButton`, `TAP_INPUT`, `formatCents`, `normaliseMoneyInput` each appear 0 times), and it still uses every import it kept.

## Standards

- *nit*: `src/apps/quote-builder/quoteFile.js:137`. The comment "The items are checked first, as they always have been." is only half true. Before, only the array and length check ran first, and each item was checked after the business, customer and details sections. Nobody can see the difference (see above), but the comment says something about the history that isn't so. Reword it to something like "Read the items first; every BadFile is the same refusal, so the order only affects which check runs first."
- No reuse findings. The diff removes the duplication the invoice would otherwise have needed and adds no new helpers.
- No blocked paths were touched (`src/design-system/`, `dist/`, `.dev.vars`, `.env` and CI are not in the diff).

## Spec (ticket 01 acceptance criteria)

- "Every existing test passes, and no existing test is edited." Met. The only test file in the diff is the new `shared-parts.test.js`, and `npx vitest run` gives 43 files and 772 tests passed.
- "A small new test imports the exported readers and `wrapText` from their new homes." Met. It also covers `BadFile`, `text`, `date` and the five form parts.
- "`npm run build` passes, and pdf-lib stays out of the entry chunk." Met. The build passes. The entry `assets/index-DmUi8y8q.js` (used by both `index.html` and `apps/quote-builder.html`) has no `PDFDocument` or `pdf-lib`. pdf-lib only appears in the lazy `pdf-*.js` and `PDFButton-*.js` chunks.
- *nit*: `src/apps/quote-builder/shared-parts.test.js:87`. The test name "lives in a module without pdf-lib" claims more than the test checks: it only checks that the two exports are the same function. `pdf-text.js` imports only `./winansi.js` today, so nothing is wrong now. The point of P2 for the invoice chunk, though, is pinned only by reading the code. Either rename the test, or add a check that `pdf-text.js` doesn't depend on pdf-lib.

## Security

No findings. The diff adds no inputs, network calls, storage or secrets. The checks on untrusted files (type and length limits, the logo data-URL pattern and size, the item count limit) are the same code, now exported for the invoice reader to reuse. Exporting them doesn't weaken them, because each reader still throws `BadFile` on bad input, and the new test checks that for a non-image logo, an item list that isn't an array, too many items and a bad discount type.

## UI

`form-parts.jsx` is a verbatim move with no markup changes (see P3 above). No separate Web Interface Guidelines pass was run, because a pass on unchanged markup would review the original quote builder rather than this diff.

## Evidence

- `git diff c8879d9 e15fabb --stat`: 6 files, +418 / -246, all under `src/apps/quote-builder/`
- Moved block of `QuoteForm.jsx` at c8879d9 diffed against `form-parts.jsx` at e15fabb: only the header and imports, the `export` keywords and one trailing blank line differ
- `npx vitest run`: Test Files 43 passed (43), Tests 772 passed (772)
- `npm run build`: built in 4.77s, and every route prerendered
- `grep PDFDocument|pdf-lib dist/assets/*.js`: found only in `pdf-PFyEv0G0.js`, `pdf-VJcNm7C7.js` and `PDFButton-DaYjkAjW.js`, not in the entry `index-DmUi8y8q.js`
