# Quality gate: quote builder, prices that include GST

Written by QA on 2026-10-28 against `reviews/test-strategy.md` (twelve exit criteria), `reviews/qa-01.md`, `reviews/code-review-01.md`, `reviews/code-review-02.md` and the PRD `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` (section 2, criteria 1 to 8). No code was edited.

Decision: GO
Branch: crew/quote-gst-inclusive @ 0a1ab27 (tickets 01 and 02 merged; working tree clean)

The one exit criterion the gate cannot close alone is the user's half of criterion 12 (UAT run or waived). By the strategy's own wording that is decided at G4, after this gate, and is the only item the user may grant. Every other criterion is met on fresh evidence.

## Exit criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Every criterion AC1 to AC8 has a passing case in a `qa-*.md` | Met | `qa-01.md` acceptance table: AC1 5/5, AC2 7/7, AC3 6/6, AC4 12/12, AC5 9/9, AC6 8/8, AC7 6/6, AC8 3/3 (56 of 56). Automated cases behind them: `calc-inclusive.test.js` (AC2 to AC4), `gst-inclusive.test.js` (AC5, AC6, AC7), `totals-rows.test.js` (AC5), `tests/ui.test.js` (AC1, AC7). The browser-only parts (storage round trip, switch click, layout) have recorded UAT passes in `qa-01.md` scenarios 1, 8 and 10. |
| 2 | Full suite passes, no skipped or `.only` or `.todo` added, count at least 630 plus new | Met | My run: 39 files, 735 tests passed (630 base plus 105 new). `git diff main -- '*.test.js'` shows no added `.only`, `.skip`, `.todo` or `xit`. |
| 3 | Existing tests unchanged apart from the PRD-forced edits | Met | Removed lines in test files, from my diff: the default GST shape in `quote.test.js` (gains `inclusive: false`), `version: 1` to `2`, the round-trip fixture, and the `vi` import in `tests/ui.test.js`. The strategy named one permitted edit; the other three were forced by the same change and are explained in `technical.md` B1 and in PRD section 2 criterion 3 ("three `quote.test.js` assertions are updated"). `calc.test.js` is not in the diff. Nothing else edited or deleted. |
| 4 | `npm run build` exits 0 | Met | My run: exit 0, `vite build` in 1.63 s, prerender wrote every route including `apps/quote-builder.html`. Typecheck and lint: none configured (operating card), recorded as "none", not as a pass. |
| 5 | The property run really runs: sweep at least 200,000, random at least 5,000, fixed seed, inside 2 s, plus a changed-seed run by QA | Met | `calc-inclusive.test.js` asserts `cases >= 240000` for the sweep (30,001 totals times 8 rates, plus exclusive) and runs 6,000 seeded random quotes. The whole file runs in 356 ms (38 tests). QA's changed-seed run: seeds 777 and 31337, 300,000 random inclusive quotes each, own cross-multiplication oracle, 0 violations in 600,000 (`qa-01.md`). Code review 02 ran another 101,541 inclusive cases with its own reference: 0 violations. |
| 6 | Table 1 present in full as literal expected values, including every tie row | Met | `calc-inclusive.test.js` "rounding, from independently worked values": 17 literal rows including the ties (1 and 3 cents at 100%, 3 and 9 cents at 20%, 101 cents at 100%), 0.50, 1.00, the 8% row, 123,456.78, 10,000,000.00 and the 0% row. The bad-rate rows (blank, "nine", 150 clamped to 100) are in the "a bad rate" block. |
| 7 | Exclusive golden table captured from `main` and passing | Met | I ran the golden block (30 or more quotes) against an untouched `git archive main` copy of `calc.js`: it passes, so the literal values equal today's output. (The one `inclusive: false` assertion in that block fails against `main` by design, because `main` has no such field; I removed only that line in the scratch copy.) Not a separate golden commit in git history, but the strategy's alternative, "values that equal today's output", is shown directly. Code review 02 also compared old and new `calc.js` over 116,784 exclusive quotes: no difference. |
| 8 | Zero critical and zero major open defects; minor ones owned | Met | No defect tickets exist and `qa-01.md` records none (see Open defects). |
| 9 | Every code-review verdict approve or approve-with-comments, no blocking comment open | Met | `code-review-01.md`: approve, two nits. `code-review-02.md`: approve, no blocking or should-fix findings, three nits plus one checker note. Nits are optional and none is marked blocking. |
| 10 | Voice and numbers: `jura-growth check` clean, digit census passes | Met | I re-ran `uv run jura-growth check` on `Prices include GST` and `GST added at the rate shown`: both `pass`. `qa-01.md` ran all four new strings: `pass`. The rendered `Includes GST (9%)` trips the checker's `[numbers]` rule only on the rate the visitor typed; the source string `Includes GST (%)` passes and the wording test asserts the new strings contain no digit. This is a checker false positive, not a published figure. |
| 11 | No blocked paths, no new dependency, no new `fetch` | Met | `git diff main --stat -- package.json package-lock.json src/design-system` is empty. No added line in `src/apps/quote-builder` contains `fetch`. |
| 12 | UAT run by QA with all steps passing; user has run or waived it at G4 | QA half met; user half pending at G4 | `qa-01.md`: 11 of 11 UAT scenarios pass, driven in real Chromium at 1280 px and 375 px, PDFs rendered to images and viewed. The user's run or waiver is the G4 decision, below. |

## Fresh run

On branch head `0a1ab27`, run by me, not copied from earlier reports:

- `npm test` -> 39 files passed, 735 tests passed, 0 failed, 1.89 s
- `npm run build` -> exit 0, all routes prerendered
- `npx vitest run src/apps/quote-builder/calc-inclusive.test.js` -> 38 passed, 356 ms
- Golden block run against `main`'s unmodified `calc.js` -> passes
- `git diff main -- '*.test.js'` -> no `.only`, `.skip`, `.todo`, `xit` added; removed lines as listed under criterion 3
- `git diff main --stat -- package.json package-lock.json src/design-system` -> empty
- `uv run jura-growth check` on two new strings -> `pass`, `pass`
- Typecheck, lint -> none configured

## The missing whole-branch review (`code-review-final`)

Acceptable. I checked the claim rather than taking it on trust:

- Outside `.scratch/`, the tree at `HEAD` is identical to the ticket 02 tip `b55cbfb` (`git diff b55cbfb 0a1ab27 -- . ':!.scratch'` is empty, and so is the diff from `b55cbfb` to the merge `7e090ef`). The merge added nothing of its own.
- Ticket 02 was branched from `ad90bc7`, the merge of ticket 01, so `code-review-02` was run over a base that already contained ticket 01. It therefore saw ticket 01's code in place and tested the interaction (it ran the parity test and the exclusive regression across both tickets). `code-review-01` covers ticket 01's own diff.
- Between them the two reviews cover every changed line against `main`. A third review would read the same lines a third time.
- The strategy's criterion 9 asks for every `code-review-NN.md` verdict, and both exist. It does not require a final review.

Not a reason for no-go.

## Open defects

0 critical, 0 major, 0 minor. No defect tickets, no failing regression tests.

Observations that are not defects (existing behaviour this feature does not change; for Ting Yu, not blockers):

- A blank or invalid GST rate does not stop the PDF download. In inclusive mode the PDF can print "Includes GST (0%)" beside "Prices include GST". Exclusive mode behaves the same today. Owner: Ting Yu. Recommendation in `qa-01.md`: leave as is, raise a separate small ticket if wanted.
- Notes alone on page 2 at exactly 20 and 21 lines (same page counts as `main`). Cosmetic. Owner: Ting Yu.
- On a phone, the rule under "Subtotal" stops short of the figure column, also with GST off. Existing CSS. Owner: Ting Yu.
- Code review nits (an unnamed `14` layout constant in `pdf.js`, no `tabular-nums` on the totals figures, preview note size differs from the PDF's). Optional, owner: developer or Ting Yu.

Housekeeping, not an exit criterion: the two ticket files under `issues/` still say `Status: ready-for-agent`. The conductor may wish to update them.

## To turn a NO-GO into a GO

Not applicable, the decision is GO. Had it been no-go, the only candidates would have been a failing exit criterion; none fails.

## Waivers the user may grant at G4

- The user's own run of the UAT script (`reviews/uat.md`, 11 scenarios, about ten minutes against `npm run dev`), or an explicit waiver of it. QA has already run it with every scenario passing, so a waiver loses little.
- Not waivable: any other exit criterion. None is outstanding.

## Gaps QA accepts (from the strategy and `qa-01.md`)

No real screen reader run; Safari and Firefox not run (no new browser API used); two-tab storage behaviour not tested in depth (last write wins, unchanged); an old copy of the app opening a version 2 file cannot be run from the suite (the unchanged `version > FILE_VERSION` refusal was read, owner: tech lead); whether one rounding on the discounted total matches the visitor's own accounting is a business-policy assumption in the PRD (owner: Ting Yu).
