# 5. The invoice file is its own format, version 1

Date: 2026-10-31
Status: accepted
Context: APP-005 Invoice builder (`.scratch/invoice-builder/reviews/technical.md` §4 and §9, decision D8)

## Context

"Save invoice file" writes JSON that visitors keep on their own machines, so its shape is hard
to change later. The quote file (`jura-quote-builder`, version 2, ADR 0004) is close but not the
same. An invoice has a due date and payment details. It has no validity date, no "Made with" line
and no prices-include-GST mode, and its title depends on GST.

## Decision

The invoice file is `{ format: "jura-invoice-builder", version: 1, savedAt, invoice }`, written
and read by `src/apps/invoice-builder/invoiceFile.js`.

- The reader accepts versions 1 up to its own and refuses anything newer, or anything that is
  not a whole number, following ADR 0004: the version rises when a new field can change a
  printed figure.
- Every field is checked with the quote file's exported section readers (`readBusinessFields`,
  `readCustomer`, `readItems`, `readOverallDiscount`, `text`, `date`), under the same limits.
  Payment details have their own limit of 1,000 characters. Unknown fields are dropped, and
  `gst.on` counts only when it is exactly `true`.
- Files over 3 MB are refused before they are read.
- Both "Open invoice file" and "Open quote file" accept both kinds of file. A quote file starts
  an invoice from the quote, and anything else shows the bad-file message and changes nothing.

## Consequences

- The quote builder cannot open an invoice file, and that is right: it would drop the due date
  and payment details without saying so.
- A change to the quote's field readers changes the invoice's too. The invoice's round-trip and
  refusal tests in `invoiceFile.test.js` catch it.
- A quote file version 3 must update `invoiceFromQuote`. Until it does, the invoice builder
  refuses quote files newer than `QUOTE_VERSION_KNOWN` (2) itself, and a test fails the moment
  the quote builder's `FILE_VERSION` moves past it.

## Rejected

- Reusing the quote file format with a `kind` field. Every quote change would become an invoice
  change, and an older quote builder would open an invoice as a quote.

Hard to reverse because saved files exist on visitors' machines.
