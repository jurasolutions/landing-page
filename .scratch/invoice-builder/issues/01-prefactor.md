# 01 Share the quote builder's file readers, text wrapping and form fields

Status: done
Blocked by: none
Branch: crew/invoice-builder-01-prefactor

## What to change

Prefactors P1, P2 and P3 from `../reviews/technical.md` §2. None of them changes how the quote builder behaves.

- **P1.** In `src/apps/quote-builder/quoteFile.js`, split the private `readQuote` into exported section readers (`readBusinessFields`, `readCustomer`, `readItems`, `readOverallDiscount`), and export `BadFile` and the `text` and `date` helpers. `readQuote` composes them.
- **P2.** Move `wrapText` into a new pdf-lib-free `src/apps/quote-builder/pdf-text.js`, and re-export it from `pdf.js`.
- **P3.** Move `TextField`, `NumberField`, `Fieldset`, `ItemEditor` and `errorText` out of `QuoteForm.jsx` into `src/apps/quote-builder/form-parts.jsx`, and import them back. The markup must stay identical.

## Acceptance criteria

- Every existing test passes, and no existing test is edited.
- A small new test imports the exported readers and `wrapText` from their new homes.
- `npm run build` passes, and pdf-lib stays out of the entry chunk.
