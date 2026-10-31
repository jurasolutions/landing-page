# 02 Invoice to PDF, GST off

Status: done
Blocked by: 01
Branch: crew/invoice-builder-02-invoice-pdf

## What to change

The new tool at `src/apps/invoice-builder/`, working end to end with GST off. Follow `../spec.md` (the PRD), `../reviews/decisions.md`, `../reviews/technical.md` §1, 2, 4, 6, 7, 8, and `../reviews/test-strategy.md` for every test this slice touches.

- Registry entry from PRD §5.3 (`added: "2026-10-31"`, D17).
- `copy.js` with **every** PRD §5.2 string word for word, including the GST, missing-field and file strings that later tickets use, plus D6, D10 and D12's strings and the PDF labels. Hand-check every new string against the voice rules (sentence case, second person, plain, no exclamation marks, no emoji, no buzzwords, never a claim that a document meets IRAS rules), and list the new strings in your report.
- `model.js`: `newInvoice`, the suggested number (D3), and `DEFAULT_GST_RATE` with the comment in D16. `INVOICE_LIMITS`.
- `totals-rows.js` (`invoiceTotalsRows`, D5, all four cases, GST on included, because it's pure).
- `remember.js` (D11) and `download.js` (D14, D15).
- `InvoiceForm.jsx`, `InvoicePreview.jsx`, `index.jsx`: sections and labels per §5.2. Business, customer, invoice details, items (add, remove, reorder by buttons, zero-quantity hint, empty-items line), overall discount, payment details with its helper, notes, logo (1 MB message), Remember, New invoice (D10), due-date note (D12), Edit/Preview switch on mobile, Download PDF, and the usage `complete`. Reuse the P3 form parts and `qb-` layout classes; add `invoice-builder.css` (`ib-` classes, tokens only, `--tap-min` on tap targets) only for what is new.
- `pdf.js`: `buildInvoicePdf`, lazy-loaded, titled "Invoice", with pagination and totals kept together (technical §6), no Jura name or "Made with" line, metadata creator and producer not naming Jura.
- The GST switch may exist but do nothing beyond `invoiceTotalsRows`; ticket 03 owns the tax invoice.

## Acceptance criteria

- PRD §2 criteria 1, 2 and 3 (totals with `quoteTotals` imported from the quote builder, the half-cent tie, no float artefacts), 8 (A4, 40 lines, totals together), 9, 10, 11, 13 and 14 hold for GST off, with the tests the test strategy names: `totals.test.js`, `totals-rows.test.js`, `pdf.test.js` (GST off parts), `remember.test.js`, `download.test.js`, `offline.test.js`, `page.test.js`, `copy.test.js` and `tests/invoice-builder-ui.test.js`.
- With GST off, no op on the PDF matches `/tax invoice|GST/i`, even with a registration number typed.
- `npm test` and `npm run build` pass, and pdf-lib is only in lazy chunks.
