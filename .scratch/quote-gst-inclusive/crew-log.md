# Crew log: quote-gst-inclusive

A "Prices include GST" switch for the quote builder.

## 2026-10-27 conductor (size M, fully autonomous at Ting Yu's request)

```
status:    done
persona:   conductor
ticket:    -
artifacts: PRD prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md; CONTEXT.md; spec.md
decisions: G0-G4 pre-approved by "use crew, develop and push to branch and create PR to main all automatically, dont ask me for inputs"; this does not cover merging or pushing to main
decisions: "add a gst field" was ambiguous because GST already exists; chose a "Prices include GST" switch over per-line GST (smaller, no change to the line model); recorded as assumption A in the PRD
evidence:  gh auth status -> logged in as jurasolutions; branch crew/quote-gst-inclusive from origin/main
```

## 2026-10-27 tech-lead (technical review of the spec)

```
status:    done
persona:   tech-lead
ticket:    -
artifacts: .scratch/quote-gst-inclusive/reviews/technical.md
decisions: all tests at existing seams; one optional new seam, totalsRows, shared by preview and PDF (prefactor ticket 01 before feature ticket 02)
decisions: totals.inclusive (gst.on && inclusive) is the single decision site for the mode
decisions: inclusive read as === true at any file version; FILE_VERSION 2 accepts 1 and 2, v1 readers refuse v2
decisions: statement line prints in both modes when GST is on, nothing when GST is off
decisions: two ADR drafts (extract GST once from discounted total; bump file version when a field changes a printed total)
questions: amend PRD criterion 3 (three quote.test.js assertions must change); recommended answer: yes, amend
evidence:  npm test -> 36 files, 630 tests passed
evidence:  scratch round-trip sweep over 8 rates x 30000 totals -> 0 invariant or reference mismatches
evidence:  scratch SSR test with stubbed window.localStorage -> remembered GST restored in first render
```

## 2026-10-27 functional-lead (appended by the conductor)

```
status:    done
persona:   functional-lead
ticket:    -
artifacts: reviews/functional.md; reviews/uat.md
decisions: B1 criterion 3 cannot hold literally (three quote.test.js assertions change on purpose): PRD reworded
decisions: B2 inclusive mode means gst.on && inclusive; no GST wording at all when GST is off: PRD assumption D
decisions: S1 inclusive totals show Total first, then Total before GST and Includes GST as muted rows, then the statement: taken, PRD §5 and tickets updated
decisions: S2 "amount after discount" added to CONTEXT.md and used in criteria 2 and 4
evidence:  hand-computed figures only; the developer confirms them by running calc
```

## 2026-10-27 conductor: G2 and G3 passed

Spec signed off and tickets 01 (prefactor) and 02 (feature) approved under Ting Yu's standing instruction. Spec reviews found no needs-human items.
