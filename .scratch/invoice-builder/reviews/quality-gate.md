# Quality gate: APP-005 Invoice builder

Decision: **NO-GO**, as of this gate. Every exit criterion the crew controls holds. Three are not met yet,
and each one can only be closed by Ting Yu at G4, by recording a result or granting a waiver. No further
crew work is needed for a GO. Once the items under "To turn this NO-GO into a GO" are recorded or waived,
the decision is GO.

Branch: `claude/T-0001-invoice-builde` @ `3e4a7dc` (`main` is an ancestor, so the branch is up to date with
local `main`)
Exit criteria: `reviews/test-strategy.md`, "Exit criteria" 1 to 8.
Gate run: 2026-10-31, qa-lead, in this worktree, with no web access.

## Exit criteria

1. **Every row C1 to C14 has a passing automated case or a recorded manual check in a `qa-*.md`. A row
   marked "partly" needs both halves, or its manual half waived at G4.** Not met yet. The automated
   halves are met.
   - C1, C2, C3, C7 and C13 pass in full. The tests are named in `qa-01.md` under "Criteria".
   - C4 and C6 each failed one case in `qa-01.md` (defects 02 and 01). Ticket 05 fixed both
     (7e3ef19, 43200bd). `code-review-05.md` approves it, and says that reverting either fix turns its
     tests red. The defect tests are now plain `it` and pass in my run: only 2 `it.fails` are left in
     the suite, and both belong to defect 03.
   - C5 passes (`required.test.js`, `download.test.js`, the UI summary tests).
   - C8, C9, C10, C11, C12 and C14 pass their automated halves. Their manual halves are not recorded
     yet (M1 to M6 below).
2. **Every case named in R1 to R5 exists and passes.** Not met, on one case.
   - R1 names "a discount over 100% or over the subtotal is clamped and flagged". The amount discount
     over the subtotal, or over its line, is clamped but not flagged. This is defect 03.
     `tests/invoice-builder-qa-defects.test.js` > "flags an overall amount discount over the subtotal"
     and "flags a line amount discount over the line's total" are still `it.fails` (lines 93 and 98).
   - R2, R3 and R4 pass (`qa-01.md` "Risks R1 to R5", plus the ticket 05 fix for R2).
   - R5 passes. `git diff --name-status a087f61 HEAD` lists only added test files, so no existing
     quote-builder test was edited or removed.
3. **`npm test` passes in full with more tests than the baseline, none of the baseline removed or skipped,
   and `npm run build` succeeds.** Met. My run gave 59 files and 1128 passed with 2 expected fails. The
   baseline was 42 files and 763 tests. No `.skip`, `.only`, `.todo` or `xit` appears in any test file,
   and no test file was deleted or modified since `a087f61`. The build exited 0. There is no typecheck
   or lint to run.
4. **The PDF fixtures (5 lines GST on, 5 lines GST off, 40 lines) are generated from the test fixtures,
   with their paths recorded in a `qa-*.md`.** Met. `qa-01.md` "PDFs" records them as
   `.scratch/invoice-builder/qa/uat-invoice-A-gst-on.pdf`, `-gst-off.pdf` and `uat-invoice-P-40-lines.pdf`.
   That folder is git-ignored. The command to regenerate them is under M1 below.
5. **The entry chunk check is recorded as passing.** Met, in `qa-01.md` and again in my run (see "Fresh
   run").
6. **Zero open critical or major defects. Minor ones are listed with an owner.** Met. Open: 0 critical,
   0 major, 2 minor (see "Open defects").
7. **Every `code-review-*.md` verdict is approve, or each of its findings is closed with a commit.** Met.
   01, 02, 03, 04, 05 and final all say "Verdict: approve". code-review-02's should-fix was closed in
   ticket 03. code-review-04's should-fixes were closed by b781147 and QA's wiring test (09c6acf). The
   final review read 858281e. The later changes (QA's tests and ticket 05) are covered by
   code-review-05.
8. **The manual checks are recorded by Ting Yu, or each one he skips is listed as waived at G4.** Not met
   yet. Nothing is recorded so far, and these checks can only happen at G4.

## Fresh run

| Command | Result |
|---|---|
| `git rev-parse HEAD` | `3e4a7dc011a8817c02ea068e6a7e9434283c1434`; the working tree is clean |
| `npx vitest run` (twice, Node v22.23.4) | Both runs: 59 files passed, 1128 tests passed, 2 expected fail (defect 03). Defect 04's flake did not recur |
| `npm run build` | exit 0. The prerender writes `apps/invoice-builder.html` ("Invoice builder \| Free tool from Jura Solutions") |
| Entry chunk check: `dist/index.html` loads `assets/index-B3QoUH2R.js`; `grep -c pdf-lib` and `grep -c %PDF-` on it | 0 and 0. Those strings appear only in the lazy chunks `PDFButton-D3VRU163.js`, `pdf-D-Gcgukn.js` and `pdf-CyHRqinh.js`. Pass |
| `git diff --name-status a087f61 HEAD -- '*.test.js'` | 17 files added (A); none modified or deleted |
| `grep -rnE '(it\|test\|describe)\.(skip\|only\|todo)\|xit\('` over `src` and `tests` | no matches |
| `grep -rn it.fails` | 2 tests, both defect 03 (`tests/invoice-builder-qa-defects.test.js:93`, `:98`) |
| `git merge-base --is-ancestor main HEAD` | true |
| Typecheck, lint | none configured (operating card) |

Note: the operating card was verified on Node 20. This run used Node 22, and the result matches the
developer's and reviewer's runs (1128 passed, 2 expected fail).

## Open defects

0 critical, 0 major, 2 minor.

| # | Severity | What | Owner | Blocks? |
|---|---|---|---|---|
| 03 | minor | An amount discount larger than its subtotal or its line is clamped to zero with no error, and the file still downloads. This is the shared `calc.js`, so the live quote builder behaves the same way. | Ting Yu, as a follow-up outside PRD A-0002 (conductor triage in `crew-log.md`) | Not under exit criterion 6. It does fail exit criterion 2 (R1), so it needs a waiver or a fix |
| 04 | minor | A one-off flake in `src/apps/quote-builder/gst-inclusive.test.js`, a test that comes from `main` and is not touched by this feature. It did not recur in 2 runs here. | Developer, at the next change to the quote builder | No |

Closed: 01 (minor) and 02 (major), both fixed in ticket 05 and approved in `code-review-05.md`.

## To turn this NO-GO into a GO

All three items are Ting Yu's, at G4:

1. **Exit criterion 2 (defect 03).** Either waive the R1 case "an amount discount over the subtotal is
   flagged" and accept defect 03 as a follow-up to the shared `calc.js`, or have it fixed. *Recommended:*
   waive it. The behaviour matches the live quote builder, the PRD does not ask for it, and a fix would
   change the quote builder, which is outside A-0002.
2. **Exit criteria 1 and 8.** Record a result or a waiver for each of these manual checks. The full steps
   are in `qa-01.md`, "Not testable here".
   - **M1, PDF viewers (C8).** First regenerate the PDFs with
     `QA_PDF_DIR=.scratch/invoice-builder/qa npx vitest run tests/invoice-builder-uat.test.js`. Then open
     the GST-on, GST-off and 40-line PDFs, plus one downloaded with a PNG logo, in Chrome, Safari and
     Adobe Acrobat Reader. Check that each opens without a warning, prints at A4 actual size with no
     clipping, keeps the totals together on page 2 of the 40-line file, and shows the logo.
   - **M2, Remember and reload, and blocked storage (C9).**
   - **M3, 360 px in device mode, one real phone, and desktop at 1280 px (C10).**
   - **M4, a keyboard-only pass (C11).**
   - **M5, `jura-growth check` on every string in `src/apps/invoice-builder/copy.js` (C12),** run from
     `repos/growth`.
   - **M6, usage counter (C14).** Check for one `open` and one `complete` row in the local D1.
   - **M7, IRAS pages re-checked on deploy day.** Confirm the GST rate is still 9% and the tax-invoice list
     is unchanged. Record the date in the comment beside `DEFAULT_GST_RATE` in
     `src/apps/invoice-builder/model.js:35`.
   - **M8, the PRD §5.4 done-check** against the IRAS list.
3. **The registry `added` date.** It is not a numbered exit criterion, but it is a release step:
   `src/apps/registry.json:74` says `"added": "2026-10-31"`. Set it to the deploy date before the push.

## Waivers the user may grant at G4

- The R1 case for defect 03 (exit criterion 2).
- Any of the manual checks M1 to M8 (exit criteria 1 and 8). Each skipped check is listed by name as
  waived.

No release step was run at this gate. G4 and the push to `main` are Ting Yu's.
