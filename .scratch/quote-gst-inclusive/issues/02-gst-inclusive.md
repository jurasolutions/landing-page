# 02 Prices include GST

Status: done
Blocked by: 01
Branch: crew/quote-gst-inclusive-02-gst-inclusive

## What to change

Build the PRD (`../../prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md`) following `reviews/technical.md` sections 2, 3, 4, 7 and 8, and `reviews/test-strategy.md`. Red first at the calc seam, then outward.

- `calc.js`: `quoteTotals` returns `totals.inclusive` (`gst.on && gst.inclusive === true`). When inclusive, `gst = divRoundHalfUp(afterDiscount * rate, PCT_SCALE + rate)`, `taxable = afterDiscount - gst`, `total = afterDiscount`. Exclusive is unchanged. Keep the field name `taxable`.
- `model.js`: `newQuote` default `gst: { on: false, rate, regNo, inclusive: false }`. Extract a pure `readGst(raw)` (reads `inclusive` with `=== true`) if it gives `index.jsx` and `quoteFile.js` one reader, as the test strategy recommends.
- `quoteFile.js`: `FILE_VERSION = 2`, `inclusive: g.inclusive === true`. Versions 1 and 2 open, 3 and above are refused.
- `index.jsx`: `rememberedStart` restores `inclusive` (it copies gst field by field, so this is the easy one to miss).
- `QuoteForm.jsx`, `copy.js`: a `Switch` labelled "Prices include GST", inside the `quote.gst.on` block, below the rate and registration row, with `aria-describedby` pointing to the helper text. Copy is in the technical review section 7 and has passed `jura-growth check`.
- `totals-rows.js`, layout per PRD §5 step 4 (functional review S1). Inclusive: `rows` are Subtotal and Discount (only when there is one); the renderer prints the "Total (SGD)" line; then `breakdown` has "Total before GST" and "Includes GST (9%)", printed muted below it. Exclusive: today's order, unchanged. `note` is "Prices include GST" when inclusive, "GST added at the rate shown" when exclusive and GST is on, `null` when GST is off. Preview and PDF print `breakdown` rows and the note muted below the total. `pdf.js` counts the breakdown rows and the note in `totalsHeight`. Copy: replace the technical review's "GST (9%) included" with "Includes GST (9%)".
- Docs: README lines (file table version, GST bullet, Remember bullet); ADRs `docs/adr/0003-...` and `0004-...` from the drafts in `reviews/technical.md` section 5.

## Acceptance criteria

- PRD §2 criteria 1 to 8 hold.
- All `calc.test.js` tests pass unchanged. Three `quote.test.js` assertions change and nothing else is weakened: the default GST shape gains `inclusive: false`, the file version expectation becomes 2, and the round-trip fixture's `gst` gains `inclusive: false`.
- New tests at every seam in the test strategy: calc (109.00 at 9%, with line and overall discounts, rate 0, rate 100 and its tie, rate errors, GST off ignores a stored `inclusive: true`, invariant sweep in both modes), file (round trip, v1 opens exclusive, `"yes"` and `1` open exclusive, v3 refused, serialise writes version 2), restore through `QuoteBuilder` with a stubbed `window.localStorage`, form (switch absent while GST is off, present and described while on), preview and PDF (inclusive rows and note, exclusive note, GST off prints neither), and `applyDraft` keeps `inclusive`.
- Every new string passes `uv run jura-growth check` from `../growth`.
- `npm test` and `npm run build` pass.
