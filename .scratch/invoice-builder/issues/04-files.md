# 04 Save and open invoice files, and start an invoice from a quote file

Status: ready-for-agent
Blocked by: 02
Branch: crew/invoice-builder-04-files

## What to change

Per `../spec.md`, `../reviews/decisions.md` (D6, D7, D8, D9) and `../reviews/technical.md` §3, §4 and the ADR draft in §9.

- `invoiceFile.js`: `serialiseInvoice`, `parseInvoiceFile`, `invoiceFromQuote` (returns `{ invoice, pricesIncludedGst }`) and `openAnyFile`, built on P1's readers.
- Buttons "Save invoice file", "Open invoice file" and "Open quote file". Both Open buttons accept both kinds of file. A bad file shows the §5.2 message in a live region and changes nothing. A quote saved with prices that include GST shows the D6 warning.
- `docs/adr/0005-invoice-file-is-its-own-format.md`.
- README: an "APP-005 Invoice builder" section in the style of the other tools (files table, money, GST, PDF, Remember, files, the quote modules it depends on), plus rows in the tests table and the copy list in "Brand rules".

## Acceptance criteria

- PRD §2 criteria 6 and 7, with `invoiceFile.test.js`: a round trip deep-equal with ids aside, equal totals and equal PDF text; quote v1 and v2 mapping; the inclusive quote with `totals.inclusive === false`; every refusal leaving the invoice unchanged. The UI test checks the bad-file message.
- `npm test` and `npm run build` pass.

## Comments

- Conductor, after the ticket 02 review: see the `openInvoice` numbering nit in `../reviews/code-review-02.md`, and keep `autocomplete` on the customer fields in mind if you touch them.
