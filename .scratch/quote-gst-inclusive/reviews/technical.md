# Technical review: quote builder, prices that include GST

Spec: `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md`
Reviewed against branch `crew/quote-gst-inclusive` at b360c46. Baseline: `npm test` gives 36 files, 630 tests, all passing.

Verdict: the design is sound and small. Nothing blocks the build. Four things in the PRD need a
correction or a decision before the ticket is cut (items B1 to B4 below); each has a recommended answer.

## 1. Seams

The ideal number of new seams is one, and the feature needs at most one. Every existing seam is
already pure or renders without a browser, so the feature can be tested entirely at modules that
exist today.

| What is tested | Existing seam (interface) | How |
|---|---|---|
| The maths | `quoteTotals(quote)` in `calc.js`, tested by `calc.test.js` | Inclusive and exclusive cases, edge rates, invariants |
| File save and open | `serialiseQuote` / `parseQuoteFile` in `quoteFile.js`, tested by `quote.test.js` | Round trip, old v1 file, malformed value, v3 refused |
| PDF wording and numbers | `buildQuotePdf(quote, totals, copy)` returns `ops` (text runs), tested by `quote.test.js` | Assert label and value text, as the "GST (9%)" test does |
| Preview wording and numbers | `QuotePreview` is a pure component of `(quote, totals, copy)`. `tests/ui.test.js` already renders `QuoteForm` and `QuoteBuilder` with `renderToStaticMarkup` | New preview test in the same style. No jsdom needed |
| Switch shown only while GST is on, labelled and described | `QuoteForm` through `renderToStaticMarkup` in `tests/ui.test.js` | Same helpers (`tagWithId`, `describedBy`, `textOf`) |
| Remembered settings restore | `QuoteBuilder` (`index.jsx`) rendered with `renderToStaticMarkup` | See below |

Remembered-settings restore is the one reader of `quote.gst` that no current test reaches
(`rememberedStart` in `index.jsx` is not exported). It does not need a prefactor. I proved the
seam in a scratch test outside the repo: `vi.stubGlobal("window", { localStorage: { getItem } })`
holding `jura.quote-builder.business.v1`, then rendering `QuoteBuilder` with `renderToStaticMarkup`,
shows the restored rate and registration number in the first render's markup (passed). The ticket
should use the same technique to assert the restored switch state. Add it to `tests/ui.test.js`.

### The one new seam, recommended: `totalsRows`

Today `QuotePreview.jsx` (lines 131 to 155) and `pdf.js` (lines 297 to 302) each decide which
totals rows exist and what they are called. Both carry the same condition
(`gst.on && discount > 0n` for the before-GST row). The PRD adds a second mode, a conditional
before-GST row, a changed GST label and a statement line, and success criterion 5 requires preview
and PDF to "agree to the cent". Writing that logic twice invites drift.

Recommendation: a prefactor ticket that extracts one pure function, for example
`totalsRows(quote, totals, copy) -> { rows: [{ label, value }], note }`, into its own small module
(`totals-rows.js`) beside `calc.js`. Both renderers loop over its result. It is a deep module: a
small interface hiding the "which rows, in which mode" rules. It is the single new seam. It
replaces testing the row rules twice, once through preview markup and once through PDF ops. The
renderers keep one smoke assertion each, plus one parity test that checks every row label and value
from `totalsRows` appears in both the preview markup and the PDF ops.

Fallback if the prefactor feels heavy for a solo project: skip it, add the logic in both places,
and keep the parity test. The cost is the duplication staying.

### One decision site for "is this quote inclusive"

`quote.gst.inclusive` is stored even when `gst.on` is false (the visitor may switch GST off and
back on and expects the choice kept). So the effective mode is `gst.on && gst.inclusive === true`.
Do not repeat that expression in calc, preview, PDF and `totalsRows`. Have `quoteTotals` return it
as `totals.inclusive` (a boolean) and let every consumer read that. Preview and PDF already receive
`totals`, so the interface does not widen.

## 2. Blast radius

Every reader and writer of `quote.gst`, checked by grep across `src/`, `tests/`, `functions/` and
`server/`:

| Where | Reads or writes | Change needed |
|---|---|---|
| `calc.js` `quoteTotals` (l.108 to 116) | reads `on`, `rate` | New inclusive branch, new `totals.inclusive` |
| `model.js` `newQuote` (l.97) | writes the default `{ on, rate, regNo }` | Add `inclusive: false` |
| `quoteFile.js` `readQuote` (l.114 to 118) | reads `on`, `rate`, `regNo` | Add `inclusive: g.inclusive === true`. Bump `FILE_VERSION` to 2 |
| `quoteFile.js` `parseQuoteFile` (l.133) | version gate `1 <= v <= FILE_VERSION` | Already accepts 1 and 2 once the constant is 2. Version 3 and above stay refused |
| `index.jsx` `rememberedStart` (l.35 to 41) | rebuilds `gst` field by field from storage | **Must add `inclusive: stored.gst.inclusive === true`.** This copy is explicit, so the field is silently dropped if missed. It is the easiest one to forget |
| `index.jsx` Remember effect (l.97, 99, 103) | writes whole `quote.gst` to storage | No change, the new field travels with the object |
| `index.jsx` `startNew` (l.175) | `newQuote({ business, gst: current.gst })` keeps the whole object | No change; the choice carries into the next quote, which matches "Remember" semantics |
| `index.jsx` `allText` (l.51) | reads `regNo` | No change |
| `QuoteForm.jsx` (l.206, 419 to 440) | `gst = patch("gst")` | New `Switch` inside the `quote.gst.on &&` block |
| `QuotePreview.jsx` (l.29, 143 to 155) | reads `on`, `regNo`, `totals.*` | Rows via `totalsRows`, statement line |
| `pdf.js` (l.148, 299 to 302) | reads `on`, `regNo`, `totals.*` | Rows via `totalsRows`, statement line, `totalsHeight` |
| `draft.js` `applyDraft` | spreads `...quote`, so `gst` passes through by reference | No change. `draft.test.js` already asserts `quote.gst` `toBe` the original. Add an `inclusive: true` case to that test |
| `AiDraft.jsx`, `functions/api/apps/quote-builder.js`, `server/quotes.js` | no GST references | No change. No Function change, so no Functions or D1 deploy impact |

Interaction to note, not to change: the AI draft returns `unit_price` figures with no GST
information. In inclusive mode those figures are read as GST-inclusive, because the visitor
reviews and edits drafted prices anyway. The server prompt never invents prices, so no change.

Other files: `copy.js` (new strings), `calc.test.js`, `quote.test.js`, `tests/ui.test.js`,
`CONTEXT.md` (terms already added by the conductor), `README.md` (file table says
`version: 1` at l.226, the GST bullet at l.237 and the Remember bullet at l.248 need a line each).

No schema or data migration. No wide refactor, so no expand-contract sequencing. Browser tier
only, no new dependency, `src/design-system/` untouched (the `Switch` component is already used in
`QuoteForm.jsx`).

Existing consumers of `totals.taxable`: `calc.test.js` (the `money` helper and the no-float sweep),
`QuotePreview.jsx`, `pdf.js`. Keep the field name. It is literally the GST base in both modes
(`afterDiscount` when exclusive, `afterDiscount - gst` when inclusive, which is the
"total before GST" the PRD wants), so no rename is needed.

## 3. Rounding formula

Verified against the repo's own `divRoundHalfUp` and `PCT_SCALE` with a scratch script (not
committed).

```
afterDiscount = subtotal - discount                       // existing, non-negative
d             = PCT_SCALE + rate                          // rate already clamped to 0..10000, so d in 10000..20000, never 0
gst           = divRoundHalfUp(afterDiscount * rate, d)   // BigInt, one rounding
taxable       = afterDiscount - gst
total         = afterDiscount
```

`divRoundHalfUp` requires `n >= 0n` and `d > 0n`. Both always hold: `afterDiscount` is clamped
non-negative by the existing discount logic, and `d >= 10000n`. No new guard is needed.

Checked results (cents):

| Case | gst | before GST | total |
|---|---|---|---|
| 109.00 at 9% | 9.00 | 100.00 | 109.00 |
| 0.01 at 9% | 0.00 | 0.01 | 0.01 |
| 0.00 at any rate | 0.00 | 0.00 | 0.00 |
| 100.00 at 0% | 0.00 | 100.00 | 100.00 |
| 1.01 at 100% | 0.51 | 0.50 | 1.01 (exact tie, rounds up) |
| 0.01 at 100% | 0.01 | 0.00 | 0.01 |
| 100.00 at 100% | 50.00 | 50.00 | 100.00 |

A sweep of 8 rates (0, 1%, 8%, 9%, 12.5%, 50%, 99.99%, 100%) against every total from 0.00 to
299.99 found no violation of `0 <= gst <= afterDiscount` and no difference from the independent
reference `floor((2*A*r + d) / (2*d))`.

Edge cases:

- **Rate 0.** gst 0, before GST equals total. Valid. The label would read "GST (0%) included, 0.00".
- **Rate 100%.** gst is half the total, rounded up on odd cents. The only swept rate with exact
  .5 ties (the sweep found none at the other seven rates, and 9% and 8% cannot tie because 109 and 27
  are odd). Test the tie explicitly at 100%.
- **Rate above 100, blank or non-numeric.** Unchanged: `errors.gstRate` is set and the rate is
  clamped (to 100 or 0). The inclusive branch uses the clamped value, so totals stay finite and the
  form shows the existing error.
- **Round-trip is not an invariant.** An exclusive quote of 100.00 gives 109.00. Feeding 109.00 into
  inclusive mode gives GST 9.00, but for other amounts the two modes' GST can differ by a cent. The
  PRD does not promise equality and the tests must not assert it.
- Update the no-float sweep (`calc.test.js` l.217 to 250) to loop over both modes. Add property
  tests on the invariants `taxable + gst === total` and, in inclusive mode, `total === subtotal - discount`.

## 4. Blocking concerns, with proposed fixes

**B1. "Existing tests pass unchanged" (success criterion 3) cannot hold literally.** Three
assertions in `src/apps/quote-builder/quote.test.js` fail by design once the field and version
land:

1. l.47: `expect(newQuote().gst).toEqual({ on: false, rate: "9", regNo: "" })`. Add `inclusive: false`.
2. l.99: `toMatchObject({ format, version: 1 })`. Becomes `version: 2`.
3. The round-trip test (l.93 to 106): `sampleQuote` sets `quote.gst` without `inclusive`, so the opened
   quote gains `inclusive: false` and `toEqual` fails. Put `inclusive: false` in `sampleQuote`'s `gst`.

Fix: amend criterion 3 to read "every figure in exclusive mode is identical to the cent. All
`calc.test.js` tests pass unchanged. Three `quote.test.js` assertions are updated for the new field
and version." Do not avoid the failures by making `inclusive` optional or conditionally written; an
always-present boolean is the simpler model. The ticket must say which tests change so a reviewer
does not read them as weakened tests.

**B2. Totals rows and the statement line have to be counted in the PDF's page-fit maths.**
`pdf.js` sizes the totals block as `totalRows.length * (LEADING + 3) + 30`. A statement line must
be included in `totalsHeight`, or it can land alone on a new page or fall below `BOTTOM`. The
existing 40-line test (`pageCount` 2, every op between margins) will catch an overflow; keep it
unchanged and add one at a page edge if cheap.

**B3. PRD wording conflict on the statement line.** Success criterion 5 says both modes state how
prices are quoted ("Prices include GST" or "GST added at the rate shown"). Plan step 4 only
mentions inclusive mode. Recommended answer: print the statement in both modes, whenever GST is
on, and nothing when GST is off. A quote with GST off must stay byte-for-byte as today (the quote
has no tax statement to make). The exclusive-mode statement is text only; no figure changes.

**B4. Version bump must be read leniently, written strictly.** Recommended behaviour:

- `serialiseQuote` always writes `version: 2` and `gst.inclusive` as a boolean.
- `parseQuoteFile` accepts 1 and 2 (already true once `FILE_VERSION = 2`, because the gate is
  `version <= FILE_VERSION`). Reject 0, 3, 99, and non-integers as today.
- `inclusive` is read as `g.inclusive === true` regardless of the file's version. A v1 file has no
  such field and opens as exclusive. A hand-edited v1 file with `inclusive: true` is honoured,
  which is harmless and keeps the reader a single code path. `"yes"`, `1`, `null`, `{}` all open as
  exclusive, with no error, matching criterion 6 and the existing `on === true` idiom.
- The old app (v1 reader) refuses a v2 file with "not one of our files" because its gate is
  `version > FILE_VERSION`. That is the PRD's intent (refuse rather than print a different total).
  Pages deploys are atomic, so no visitor sees a mixed state, but a tab left open from before the
  deploy can still write v1 files that omit the field. Those re-open as exclusive, which is
  correct for them.

## 5. Decisions, as ADR drafts

Draft these into `docs/adr/` using the repo's format (see `0001-image-cost-shares-the-ai-budget.md`).
Numbers are the next free ones on this branch. Renumber if another branch merges first.

**ADR 0003. GST-inclusive quotes extract GST once, from the discounted total.**
- Context: a visitor can type prices that already include GST. The tax can be pulled out per line,
  or once on the whole. Per-line extraction rounds up to 200 times and the lines no longer add up
  to the quote total.
- Decision: the total is the sum of the line amounts after all discounts and is never changed.
  GST is `round_half_up(afterDiscount * rate / (100% + rate))`, once, in BigInt hundredths of a
  percent. "Total before GST" is `total - GST`, so before-GST plus GST equals the total exactly.
- Consequences: the quote total matches what the customer was quoted. Per-line GST amounts are not
  shown or computable. Zero-rated or exempt lines (out of scope in the PRD) would need a different
  model. An exclusive total converted to inclusive can differ by a cent in GST.
- Hard to reverse because: customers' printed quotes carry these figures.

**ADR 0004. The saved quote file's version goes up when a new field changes the printed total.**
- Context: older copies of the app drop fields they do not know and would print a different total
  from the same file. The reader accepts every version from 1 up to its own.
- Decision: `FILE_VERSION` rises to 2 with `gst.inclusive`. New readers accept 1 and 2. Old readers
  refuse 2. A field that cannot change a printed figure (a purely cosmetic one) does not need a bump.
- Consequences: a deliberate hard failure in stale tabs and cached copies, in return for never
  printing a wrong total silently. Files cannot be downgraded.
- Hard to reverse because: saved files exist on visitors' machines.

No design question needs a prototype. Nothing here is a `needs-human` question.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A reader of `quote.gst` is missed, so the choice is lost on restore | The `rememberedStart` copy is called out above and gets a restore test through `QuoteBuilder` |
| Preview and PDF drift apart | `totalsRows` single source, plus a parity test |
| A wrong money figure in a customer-facing document | Pure BigInt maths, invariant sweep over many rates and amounts, tie case at 100% |
| Stale tab or cached older app opens or writes files | Version refusal on read (B4); old files re-open as exclusive |
| Inclusive switch left on while GST is later turned off prints "includes GST" | `totals.inclusive` is `on && inclusive`, so nothing prints when GST is off. Test it |
| Column headings ("Unit price", "Amount") are silent about GST in inclusive mode | Recommended answer: leave headings alone. The statement line sits under the totals and the form helper explains it. Revisit only if visitors ask. Adding heading text risks column width changes in the PDF |
| Copy breaks the brand rules | Strings below passed `jura-growth check` |
| Publishing a figure Jura cannot evidence | None added; the only number remains the visitor's rate, defaulting to the IRAS-checked 9% |

Performance, security and concurrency: no impact. The change is a few BigInt operations and one
boolean read from untrusted file or storage input, parsed with `=== true`. No server call, no
secret, no migration.

## 7. Copy, recommended

All five passed `uv run jura-growth check` from `repos/growth` on 2026-10-27. Put them in `copy.js`
(`totals` and `pdf` sections).

- Switch label: `Prices include GST`
- Helper line: `Switch this on if the prices you type already include GST. The total stays as you typed it, and the quote shows how much of it is GST.`
- PDF and preview GST row, inclusive only: `GST (9%) included` (exclusive keeps `GST (9%)`)
- Statement, inclusive: `Prices include GST`
- Statement, exclusive (GST on): `GST added at the rate shown`

The helper gets its own `id` and the switch an `aria-describedby`, as the existing GST switch does.
The switch sits inside the `quote.gst.on &&` block, below the rate and registration row.

## 8. Build order and tickets

Two tickets, each fits one context window. The PRD's single tracer bullet is also acceptable if
the prefactor is dropped.

1. **Prefactor: one totals-rows function** (no behaviour change, ticket `01-totals-rows`). Extract
   `totalsRows` and make preview and PDF loop over it. Gate: all 630 tests pass with no assertion
   edited, and the exclusive-mode preview and PDF text are unchanged. Add the parity test. Blocks 02.
2. **Feature: Prices include GST** (`02-gst-inclusive`, blocked by 01). Vertical slice: `calc.js`
   branch and `totals.inclusive`; `model.js` default; `quoteFile.js` version 2 and reader;
   `index.jsx` restore; `QuoteForm.jsx` switch; `copy.js`; row and statement in `totalsRows`;
   `totalsHeight`; the three `quote.test.js` edits from B1; new tests at every seam in section 1;
   README lines; the two ADRs. Red first at the calc seam, then outward.

Suggested test list for ticket 02: calc (inclusive 109.00 at 9%, with line and overall discounts,
rate 0, rate 100 and its tie, rate error clamping, GST off ignores a stored `inclusive: true`,
invariants sweep in both modes); file (round trip with `inclusive: true`, v1 file opens exclusive,
`"yes"` and `1` open exclusive, version 3 refused, `serialise` writes version 2); restore (stored
`inclusive: true` restored; absent or malformed restores as exclusive); form (switch absent while
GST is off, present and described while on); preview and PDF (inclusive rows, statement, exclusive
statement, GST off prints neither); `applyDraft` keeps `inclusive`.

Final verification for the build: `npm test`, then `npm run build` (the prerender step also runs).
There is no typecheck or lint command on the operating card.

## 9. Specialist guidance

No public API, Postgres or Next.js surface is touched. `crew:api-and-interface-design` applies only
in spirit: the saved-file format is the one durable external interface here, and section 4 B4 and
ADR 0004 cover it. The React change is one conditional `Switch` and needs no performance work
(`totals` is already memoised in `index.jsx`).
