# 05 Fix QA defects 01 and 02

Status: ready-for-agent
Blocked by: none
Branch: crew/invoice-builder-05-qa-fixes

## What to change

Fix two defects from `../reviews/qa-01.md` §Defects.

- **Defect 02 (major).** With GST on, a required field must count as missing when nothing of it would print. `required.js` has to treat a field as blank when its `toPrintable` text (from `quote-builder/winansi.js`) is blank after trimming, for every field on the D4 list. That includes the business name and address, the registration number, the customer name and address, the invoice number and each counted item's description. The entry and its link stay as they are ("Please add: {field}"). Add no new copy; the existing "Some characters can't go into the PDF…" warning already explains why.
- **Defect 01 (minor).** A refused file changes nothing (PRD §2 criterion 6), and that includes the D6 warning. When a bad file is picked after an inclusive quote, the bad-file message shows and the D6 warning stays. A good file or "New invoice" still clears the warning, as before.

## Acceptance criteria

- The `it.fails` tests for defects 01 and 02, in `tests/invoice-builder-files-wiring.test.js` and `tests/invoice-builder-qa-defects.test.js`, become ordinary passing `it` tests. Update the test that pins today's defect-02 behaviour to pin the fixed behaviour.
- Defect 03's `it.fails` tests stay as they are. That is a shared `calc.js` question about the quote builder, outside this PRD, and it goes to Ting Yu as a follow-up.
- `npm test` and `npm run build` pass.
