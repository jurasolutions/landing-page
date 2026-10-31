# Crew log: invoice-builder

APP-005 Invoice builder, built from the PRD approved as A-0002. Discord Dispatch task T-0001,
run unattended: the conductor decides G0, G1 and G3 on the crew's recommendations and logs them
here. G2 is approval A-0002. G4 is Ting Yu's, through the app-release card in #approvals, and is
not run here.

## 2026-10-31 conductor: first attempt blocked

The first run of T-0001 stopped before any work: the Bash sandbox failed to start
(`EACCES ... listen .../srt-mux-*.sock`), so there was no git, npm or test run. Nothing was
written. Ting Yu re-ran the task with `/retry T-0001`, and the shell works on this run.

## 2026-10-31 conductor: G0, G1 and G2

```
status:    done
persona:   conductor
ticket:    -
artifacts: .scratch/invoice-builder/spec.md; CONTEXT.md (Invoice builder terms)
decisions: G0 size M, route M. One new browser-tier tool that reuses the quote builder's calc, quote file reader, logo, WinAnsi and PDF geometry; it fits one session, so L's ticket quiz and phase boundary add nothing
decisions: G0 route M is run without its interview (phase 1) and spec phase (phase 2): the PRD is approved as written, so the reviews read it directly
decisions: G1 requirements ready: the PRD has no open questions, and every term is pinned in CONTEXT.md under "Invoice builder (APP-005)"
decisions: G2 is approval A-0002. The PRD lives outside this repo, so spec.md carries a reading copy, checked byte for byte against the approved SHA-256
decisions: feature branch is claude/T-0001-invoice-builde (stands in for crew/invoice-builder); ticket branches are crew/invoice-builder-NN-<slug>, cut from it and merged back into it here
decisions: the skill scout is off for this run (no web), so no scout cards
decisions: jura-growth check is unavailable; copy is checked by hand against src/design-system/README.md §3
evidence:  awk between the BEGIN/END lines of spec.md | shasum -a 256 -> e97afb61...293fb10de, matches A-0002
evidence:  git status -> clean on claude/T-0001-invoice-builde at 858281e
```

## 2026-10-31 tech-lead (technical review of the spec, appended by the conductor)

```
status:    needs-human
persona:   tech-lead
ticket:    -
artifacts: .scratch/invoice-builder/reviews/technical.md
decisions: import calc, model helpers, parseQuoteFile/readBusiness, logo, winansi, pdf-geometry from quote-builder as they are; no move to _shared
decisions: prefactors P1-P3 (section readers, pdf-text.js, form-parts.jsx), no quote behaviour change
decisions: invoice PDF is its own module; no "Jura Solutions" fallback; invoice file jura-invoice-builder v1; both Open buttons take both files
decisions: three tickets with a fallback split of 02
questions: Q1 inclusive quote file; recommended: open as typed, GST on, warning line
evidence:  npx vitest run (quote-builder, shell, ui, usage) -> 9 files, 210 passed
```

## 2026-10-31 functional-lead (appended by the conductor)

```
status:    done
persona:   functional-lead
ticket:    -
artifacts: .scratch/invoice-builder/reviews/functional.md; reviews/uat.md
decisions: B1 no Jura name fallback; B2 amount before GST always on a tax invoice; B3 suggested number typed as real text; B4 rate and descriptions in the required check; B5 inclusive quote opens with a warning
decisions: half-cent tie 150.50 at 9% -> GST 13.55, total 164.05; UAT 5-line invoice GST on 693.52, off 636.26
questions: five, each with a recommendation; all taken in reviews/decisions.md
evidence:  figures worked by hand twice with calc.js rules (the reviewer had no shell)
```

## 2026-10-31 qa-lead, strategy (appended by the conductor)

```
status:    done
persona:   qa-lead
ticket:    -
artifacts: .scratch/invoice-builder/reviews/test-strategy.md
decisions: C1-C14 mapped to levels and files; seams download.js and remember.js; complete counts on a saved PDF only
decisions: manual rows (viewers, 360 px, keyboard, jura-growth, IRAS build-day check) go to Ting Yu at the §5.4 done-check
questions: Q1 inclusive quote file; recommended: open with GST on top and a notice
evidence:  npx vitest run @a087f61 -> 42 files, 763 tests passed (baseline); npm run build -> ok
```

## 2026-10-31 conductor: review decisions and G3

```
status:    done
persona:   conductor
ticket:    -
artifacts: reviews/decisions.md; issues/01-04; CONTEXT.md (required fields, quote file, suggested number, payment details)
decisions: every open point takes a reviewer's recommendation (decisions.md D1-D19). Where reviews differed: suggested number typed as real text (functional B3 over tech), rate and per-line description added to the required check (functional B4), no question before opening a file (quote builder behaviour)
decisions: Q1 (inclusive quote file) settled as D6: open as typed with GST on and a one-line warning; all three reviews recommended it
decisions: G3 approved on the crew's recommendation: four tickets, 01 prefactor -> 02 invoice PDF (GST off) -> 03 tax invoice and 04 files in parallel. Tech §12's fallback split was taken up front because 02 as a whole is too large for one developer run
decisions: tech-lead ticket review skipped: route M has none, and the tickets follow technical.md §12 directly
decisions: the design system's README is not vendored in this repo (the sync skips docs), so copy is checked by hand against the voice rules quoted in docs/agents/crew.md and README.md
evidence:  git status -> only .scratch/invoice-builder and CONTEXT.md changed
```
