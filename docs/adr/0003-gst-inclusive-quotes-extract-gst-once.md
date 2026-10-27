# 3. GST-inclusive quotes extract GST once, from the discounted total

Date: 2026-10-27
Status: accepted
Context: APP-001b Quote builder, prices that include GST (`.scratch/quote-gst-inclusive/reviews/technical.md`)

## Context

A visitor can now type prices that already include GST. The tax can be pulled out line by line,
or once on the whole quote. Pulling it out per line rounds up to 200 times (one per item), and
the lines then no longer add up to the figure the customer was quoted.

## Decision

The total is the sum of the line amounts after every discount, and it is never changed. GST is
`round_half_up(amountAfterDiscount × rate ÷ (100% + rate))`, worked out once, in BigInt hundredths
of a percent (`quoteTotals` in `calc.js`). "Total before GST" is the total minus GST, so before
GST plus GST equals the total to the cent. Both documents print the total first and the split
below it, so the sum reads down without a figure that looks out of place (`totals-rows.js`).

`quoteTotals` returns `inclusive`, true only while GST is on and `gst.inclusive` is exactly `true`.
Every reader uses that one value, so a stored choice never changes a quote while GST is off.
`taxable` keeps its name: it is the amount GST is worked out on when prices exclude GST, and the
amount before GST when they include it.

## Consequences

- The total matches what the customer was quoted, whatever the number of lines.
- Per-line GST amounts are not shown and cannot be worked out from the quote. Zero-rated or exempt
  lines (out of scope for this change) would need a different model, not a tweak to this one.
- The same typed prices give a total that differs between the two modes by design, and GST can
  differ by a cent when a total from one mode is typed into the other. The tests do not assert
  that the two modes round-trip.
- Prices from an AI draft are read as GST-inclusive while the switch is on. The visitor reviews
  and edits them anyway, and the server never invents a price.

## Rejected

- Extracting GST per line: more rounding, and the lines would not add up to the total.
- Keeping today's row order and labelling the GST row "included": the printed sum would read
  Subtotal, Discount, a smaller figure, GST, then the larger total, and look like a mistake.
- A second GST control on the form: the existing GST block already holds the rate and the
  registration number, and the choice only means something while GST is on.

Hard to reverse because customers' printed quotes carry these figures.
