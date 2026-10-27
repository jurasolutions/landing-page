# 01 Prefactor: one function decides the totals rows

Status: ready-for-agent
Blocked by: none
Branch: crew/quote-gst-inclusive-01-totals-rows

## What to change

Today `src/apps/quote-builder/QuotePreview.jsx` (the `qb-paper-totals` list) and `pdf.js` (the `totalRows` array) each decide which totals rows exist and what they say. Move that decision into one pure module, `src/apps/quote-builder/totals-rows.js`:

`totalsRows(quote, totals, copy) -> { rows: [{ label, value }], breakdown: [{ label, value }], note: string | null }`

`rows` are the rows above the final "Total (SGD)" line, in order: Subtotal, Discount (only when there is one), Total before GST (only when GST is on and there is a discount), GST (only when GST is on). Values are the formatted strings, with the discount shown as `-1.00`. `breakdown` (muted rows printed below the final total line) and `note` are empty and `null` for now. Preview and PDF both loop over `rows` instead of repeating the conditions.

This ticket changes no behaviour. Preview text and PDF text for every quote are exactly what they are today.

## Acceptance criteria

- `npm test` passes with no existing assertion edited or removed (630 tests, plus the new ones).
- A new `totals-rows.test.js` covers: GST off with and without a discount; GST on with and without a discount; the discount row's leading minus.
- A parity test renders one quote through `QuotePreview` (`renderToStaticMarkup`) and `buildQuotePdf`, and checks that every `{ label, value }` from `totalsRows` appears in both.
- `QuotePreview.jsx` and `pdf.js` no longer contain the `gst.on && discount > 0n` conditions.
- `npm run build` succeeds.

## Notes

Follow the seams in `.scratch/quote-gst-inclusive/reviews/technical.md` section 1. The "Total (SGD)" line stays in the renderers, since the PDF styles it separately.
