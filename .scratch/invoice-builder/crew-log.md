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
