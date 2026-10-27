# Code review: ticket 01, one function decides the totals rows

Branch `crew/quote-gst-inclusive-01-totals-rows` (6f61b1a), compared with `crew/quote-gst-inclusive` by `git diff crew/quote-gst-inclusive...crew/quote-gst-inclusive-01-totals-rows`.
Files changed (all read): `totals-rows.js` (new), `totals-rows.test.js` (new), `QuotePreview.jsx`, `pdf.js`.

**Verdict: approve.** No blocking findings. Two nits.

## Evidence

- `npm test` in the branch worktree: 37 files, 639 tests passed (630 existing + 9 new).
- `npm run build`: succeeded, prerender ran for every route.
- No existing test file is in the diff, so no existing assertion was edited or removed.
- No-behaviour-change proof: I exported base and branch into scratch directories and rendered 24 quotes
  (GST on and off, with and without a line discount, with and without a 10% overall discount, rates 0, 7.5 and 9)
  through `QuotePreview` (`renderToStaticMarkup`) and `buildQuotePdf`. Preview markup and PDF ops
  (text, positions, styling) were byte-identical between base and branch (`cmp`).
- `gst.on && discount > 0n` no longer appears in `QuotePreview.jsx` or `pdf.js` (grep). The remaining
  `discount > 0n` hits are the per-line discount column, which is unrelated.

## Spec (ticket 01 acceptance criteria)

| Criterion | Result |
|---|---|
| `npm test` passes, no existing assertion edited | Met (639 pass, diff touches no existing test) |
| New `totals-rows.test.js` covers GST off/on, with and without discount, leading minus | Met (four row cases, plus the `-1.00` assertion in two of them, plus empty `breakdown` and null `note`) |
| Parity test through `QuotePreview` and `buildQuotePdf` | Met, all four GST/discount combinations |
| Conditions gone from `QuotePreview.jsx` and `pdf.js` | Met |
| `npm run build` succeeds | Met |
| Signature `totalsRows(quote, totals, copy) -> { rows, breakdown, note }`; "Total (SGD)" line stays in renderers | Met |

Spec findings: none.

## Standards (`docs/agents/crew.md`, `CLAUDE.md`)

- Pure module, no React or pdf-lib, JSDoc header in the file's house style, copy read from `copy.pdf` (no new strings).
- Tests never touch the network; the new tests stub nothing and need none.
- Commit message is a plain sentence-case imperative.
- Reuse: it reuses `formatCents` and `formatPercent`; it duplicates nothing.

### Nit

1. `src/apps/quote-builder/totals-rows.test.js` (parity block): `expect(pdfTexts).toContain(value)` is weak for the subtotal. In the PDF the one line item also prints `100.00`, so the check would pass even if the Subtotal row were dropped. The label assertion covers it, so no real gap today. A stronger check for ticket 02: assert label and value are adjacent ops.
2. `QuotePreview.jsx`, the `rows.map` uses `key={label}`. Labels are unique today. If ticket 02 adds two rows with the same label, React will warn. Consider the index or a stable id then.

## Security

Pure formatting of already-computed totals. No input parsing, storage, network, auth, secrets, SQL or personal-data handling is added. Values render as React text children (escaped). Nothing to report.

## Blocked paths

No change under `src/design-system/`, `jurasolutions/design-system/`, `inputs/`, `.dev.vars`, `.env` or `dist/`. Clean.

## Housekeeping (not a finding)

`git status` in the worktree shows an untracked `node_modules` (the worktree's dependency link). It is not in the commit.

## Web design review

Not run as a separate pass: the UI change is a loop that renders the same `dt`/`dd` pairs; markup is identical to before (proved above), so no new accessibility surface.
