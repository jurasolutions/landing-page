# Code review: ticket 02, prices include GST

Branch `crew/quote-gst-inclusive-02-gst-inclusive` (HEAD b55cbfb, five commits) against `crew/quote-gst-inclusive` (ad90bc7), using `git diff crew/quote-gst-inclusive...crew/quote-gst-inclusive-02-gst-inclusive`. 19 files, +1069 -73. Every changed file was read. Reviewed from the worktree `.claude/worktrees/agent-a605a6a718b4e8373/`. No code was edited.

## Verdict: approve

There are no blocking findings. The maths, the file and storage readers, and the preview and PDF agree with the PRD and with the technical review. Exclusive-mode figures are identical to the base branch. The four *should fix* and *nit* items below are optional and none gates the merge into the feature branch.

## Evidence I ran myself

| Check | Result |
|---|---|
| `npm test` in the worktree | 39 files, 735 tests passed (base was 36 files, 630) |
| `npm run build` in the worktree | built; prerender wrote all routes |
| Exclusive regression: base `calc.js` against ticket `calc.js` | 116,784 quotes (rates `0, 1, 7, 8, 9, 12.5, 50, 99.99, 100, 101, "", "abc"`; no, percent and amount overall discounts; line discounts; GST on and off; `inclusive` absent or false). Deep-compared whole `quoteTotals` result with BigInt serialised: 0 differences besides the new `inclusive: false` |
| Inclusive invariants, with my own reference `floor((2*A*r + d) / (2*d))` | 101,541 quotes over 11 rates and 3 discount kinds: `taxable + gst === total`, `total === subtotal - discount`, `0 <= gst <= total`, GST equal to the reference. 0 violations |
| `crew:web-design-review` | done, see UI |
| `security-review` | done, see Security. The skill's embedded diff was of the feature branch (tickets 01 only), so I reviewed the ticket diff by hand instead |
| Blocked paths | none touched (`src/design-system/`, `inputs/`, `.env`, `.dev.vars`, `dist/`, CI). `node_modules` in the worktree is untracked and not in any commit |

Figures I ran (cents shown as dollars), inclusive unless stated:

| Case | taxable (before GST) | GST | total |
|---|---|---|---|
| 109.00 at 9% | 100.00 | 9.00 | 109.00 |
| Exclusive 109.00 at 9% | 109.00 | 9.81 | 118.81 |
| 159.80 less 10% overall, 9% (PRD example) | 131.94 | 11.88 | 143.82 |
| 100 less 10% on a line, plus 59.80, less 5.00 overall | 132.84 | 11.96 | 144.80 |
| Rate 0 | 100.00 | 0.00 | 100.00 |
| Rate 100, total 1.01 (the exact tie) | 0.50 | 0.51 (rounds up) | 1.01 |
| Rate 100, total 100.00 | 50.00 | 50.00 | 100.00 |
| Rate 100, total 0.01 | 0.00 | 0.01 | 0.01 |
| Rate 101 | 50.00 | 50.00 | 100.00, `errors.gstRate = "percent"` (clamped to 100) |
| Rate blank or `abc` | 100.00 | 0.00 | 100.00, `errors.gstRate = "invalid"` |
| GST off, stored `inclusive: true` | 100.00 | 0.00 | 100.00, `totals.inclusive` false |
| GST on, `inclusive` absent, `"yes"` or `1` | exclusive: 9.00 GST, 109.00 total | | |
| 12.5% on 100.00 | 88.89 | 11.11 | 100.00 |
| No items, inclusive | 0.00 | 0.00 | 0.00 |

File and storage readers, run directly: a v1 file with no field opens exclusive; a v2 file with `true` opens inclusive; v2 with `"yes"`, `1`, `null` or `{}` opens exclusive with no error; a file with no `gst` block opens GST off and exclusive; versions 0, 1.5, `"2"` and 3 are refused; `serialiseQuote` writes `version: 2` and a boolean `inclusive`. A hand-edited v1 file saying `true` is honoured, as the technical review (B4) recommends. `readGst` returns `undefined` for missing, `null` and string input, and caps rate at 20 characters and registration number at 120, the same as before.

## Standards

Rules checked: `CLAUDE.md` (Jura only, design system read-only), `docs/agents/crew.md` (blocked paths, voice, numbers rule, tests never touch the network), `README.md` conventions, and `jurasolutions/CLAUDE.md` (use design-system tokens, no second icon or font set).

- **Blocking:** none.
- **Should fix:** none.
- **Nit**
  1. `pdf.js:328` (`y -= extraLines ? 14 : 30;`). The literal `14` is an unnamed layout constant, and the comment explains the intent but not the number. See the PDF gap judgement below. Optional: name it.
  2. `quote-builder.css` (the `.qb-paper-totals .qb-paper-sub` rule). `dt` elements in `.qb-paper-totals` are already `--neutral-600`, so the rule only changes the `dd`. Harmless. The comment ("quieter than the sums above") is accurate.
  3. `quote-builder.css` (`.qb-paper-note`). The preview note is body size while the PDF prints it at `SIZE.label`. Not wrong, only unequal. Parity is asserted on text, not size, so no test would notice.
- **Reuse:** no duplication found. `readGst` is the single reader for `index.jsx`; `quoteFile.js` keeps its own defensive reader, which has different defaults (rate `""` for a file, `DEFAULT_GST_RATE` for storage), so merging them would change behaviour. The decision site for the mode is `quoteTotals`; no other module re-derives `on && inclusive`.

### The two edits the developer made to earlier assertions

1. **`totals-rows.test.js`, "leaves the breakdown empty and the note null for now".** Fair and necessary. The assertion was written in ticket 01 with "for now" in its name, and ticket 02 explicitly gives `note` a value ("GST added at the rate shown" with GST on, in exclusive mode). It was replaced by stronger assertions: exclusive with GST on has an empty breakdown and the statement; GST off has `breakdown` `[]` and `note` null for every stored choice; GST-off rows are identical whatever the stored choice. Nothing is weakened; the null-with-GST-off case is still pinned. The parity test was also strengthened: it now checks order, label-to-value pairing on the same PDF line, and that the note sits below the total, in four modes.
2. **`pdf.js` gap before Notes, 30pt to 14pt when a statement or split prints.** Justified, with a small caveat. I reproduced it: with the gap left at 30, the existing `quote.test.js` case "is readable by a second, independent PDF parser" fails (the sample quote has GST on, so it now prints a statement, and the terms spill alone onto page 3, leaving "Total (SGD)" off the last page). With 14, an exclusive GST-on quote has the Notes heading at 17 + 14 = 31pt below the total against 30pt before, so exclusive layout is effectively unchanged and the old test stays unedited, which is better than relaxing it. The fix is not a hack: `totalsHeight` still reserves the whole block, and it over-reserves by 16pt when the block is present, which is harmless. In the inclusive case I measured the Notes heading 22pt of baseline below the statement (against 39pt when GST is off), which is tight but clear. No finding beyond nit 1 above.

## Spec

PRD §2 criteria and ticket acceptance criteria.

| Criterion | Result |
|---|---|
| 1. Choice between exclude (default) and include, GST on only | Met. `newQuote` default `inclusive: false`; switch only inside the `quote.gst.on` block. |
| 2. Inclusive total equals the amount after discount | Met (table above). |
| 3. Exclusive identical to the cent; `calc.test.js` unchanged; three `quote.test.js` assertions changed and nothing else | Met. `calc.test.js` is not in the diff. `quote.test.js` has exactly three hunks: default shape, version 2, round-trip fixture `inclusive: false`. My 116,784-quote comparison found no change. |
| 4. GST once, half up, on the amount after discount; before + GST = total | Met. `divRoundHalfUp(afterDiscount * rate, PCT_SCALE + rate)`; tie at 100% rounds up. |
| 5. Statement and parity between preview and PDF; GST off prints as today | Met. `totalsRows` feeds both; the parity test pairs label and value per line. GST-off ops contain no note and no breakdown. |
| 6. File round trip; v1 and malformed open exclusive | Met (run directly). |
| 7. Remember keeps the choice | Met. `rememberedStart` now calls `readGst`; the QuoteBuilder restore test uses a stubbed `window.localStorage`, and `tests/setup.js` unstubs globals after each test. |
| 8. No new figure | Met. A test asserts the new strings hold no digit. |
| Ticket: layout (rows, total line, breakdown, note) | Met. Measured PDF order: Subtotal, Discount, Total (SGD), Total before GST, Includes GST (9%), Prices include GST. |
| Ticket: tests at every seam in the strategy | Met. `calc-inclusive.test.js` (calc, sweeps, exclusive regression), `gst-inclusive.test.js` (file, restore reader, `applyDraft`, PDF page edges, wording), `tests/ui.test.js` (form, restore through `QuoteBuilder`). |
| Ticket: README lines and ADRs 0003 and 0004 | Met. ADR format follows `0001`, with Context, Decision, Consequences, Rejected. |
| Ticket: every new string passes `jura-growth check` | Met with one note, below. |

- **Blocking:** none.
- **Should fix:** none.
- **Nit**
  1. Ticket line "Every new string passes `uv run jura-growth check`". The helper, the switch label, "Prices include GST" and "GST added at the rate shown" pass. Checked as a rendered example, `Includes GST (9%)` fails with `[numbers] "9%" in a results claim with no source`. The existing label `GST (9%)` and the technical review's `GST (9%) included` fail the same way, and `Includes GST` and `Includes GST (%)` pass. The source string is a template with the visitor's rate and has no digit of its own, which the new wording test enforces. This is a checker false positive on the rate, not a published figure. No change needed; the conductor may want to note it so the strict reading of the criterion is not later held against the ticket.

## Security

The untrusted inputs this change touches are the opened `.json` file (`quoteFile.js`) and the stored setting in `localStorage` (`readGst`). Both feed one new boolean and no new sink.

- `inclusive` is read as `=== true` in both readers. Strings, numbers, `null`, objects and arrays all become `false`. Verified by running the readers.
- The remembered `rate` and `regNo` are still type-checked and length-capped (20 and 120) exactly as before. A 20-digit rate parses through the existing BigInt percent parser and is clamped to 100 with the existing error.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `fetch`, new storage key or server call was added. Everything printed is either static copy or the rate re-formatted from a clamped BigInt, so a hostile file cannot inject text into the preview or the PDF. The PDF new strings are ASCII, inside WinAnsi.
- Version gate: v3 and above refused, so an older file format cannot be coerced into a different total silently. Stale tabs that write v1 files re-open as exclusive, which is the correct total for them.
- No secret, auth or SQL surface. Money correctness was verified as above.

Findings: none (blocking, should fix or nit).

## UI (`crew:web-design-review` on `QuoteForm.jsx`, `QuotePreview.jsx`, `quote-builder.css`)

The design system and its conventions win over the guideline's Title Case rule: labels here are sentence case, per `design-system/README.md` §3, so `Prices include GST` is correct. Every rule section was checked against the three files.

- **Blocking:** none.
- **Should fix:** none.
- **Nit**
  - `QuotePreview.jsx` totals block: `key={index}` is fine here (the lists are static per render and never reordered).
  - `QuotePreview.jsx` / `quote-builder.css` `.qb-paper-totals`: the figures do not set `font-variant-numeric: tabular-nums` (it is used elsewhere in the file, lines 160 and 179). The totals block had no tabular numerals before this change, so this is not new, but with the muted rows now stacked beneath the total, right-aligned figures of unequal digit widths are more visible. Optional.
- Passes: the switch is a labelled `Switch` with `aria-describedby` pointing to a real `id` on the helper paragraph; it sits below the rate and registration row, inside the GST block, and is absent while GST is off (no focusable ghost control). Focus and hover come from the design-system `Switch`; no `outline: none`, no `transition: all` and no new animation were added. The new CSS uses design tokens only (`--space-2`, `--neutral-600`), with no ad-hoc colours or fonts. The note is real text under a `dl`, not a pseudo-element or an image, so it is readable by assistive technology. The mobile rule stretches the block and keeps the figure column. Copy is sentence case with no exclamation marks.

## Not done, and why

- Rendering the PDF to an image: `pdftoppm` is not installed here, so the layout was judged from text-run coordinates (y positions printed above) rather than by eye. A quick look at an inclusive PDF with a discount before release is worth the thirty seconds.
