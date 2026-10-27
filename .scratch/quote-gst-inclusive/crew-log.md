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

## 2026-10-27 developer, ticket 01 (appended by the conductor)

```
status:    done
persona:   developer
ticket:    01
artifacts: totals-rows.js, totals-rows.test.js, QuotePreview.jsx, pdf.js (commit 6f61b1a on crew/quote-gst-inclusive-01-totals-rows)
decisions: totalsRows returns { rows, breakdown: [], note: null }; the Total (SGD) line stays in the renderers
evidence:  npm test -> 37 files, 639 passed (630 existing, 9 new, none edited); npm run build -> ok
```

## 2026-10-27 reviewer, ticket 01 (appended by the conductor)

```
status:    done
persona:   reviewer
ticket:    01
artifacts: reviews/code-review-01.md
decisions: approved, no blocking or should-fix findings; two nits carried into ticket 02
evidence:  24 quotes through preview markup and PDF ops, base vs branch -> identical
```

## 2026-10-27 developer, ticket 02 (appended by the conductor)

```
status:    done
persona:   developer
ticket:    02
artifacts: calc.js, model.js (readGst), quoteFile.js (v2), index.jsx, QuoteForm.jsx, copy.js, totals-rows.js, QuotePreview.jsx, pdf.js, quote-builder.css; calc-inclusive.test.js, gst-inclusive.test.js; ADRs 0003 and 0004; README; CONTEXT.md
decisions: PDF gap before Notes is 14pt (was 30) when the split or statement prints, so the existing 40-line PDF test still holds; one ticket-01 assertion edited because the note is now real; both code-review-01 nits done
decisions: "Includes GST (x%)" accepted: jura-growth rejects any literal "9%" including the existing "GST (9%)", and the 9 is the visitor's typed rate
evidence:  npm test -> 39 files, 735 passed; npm run build -> ok; calc.test.js unedited; quote.test.js diff is the 3 named lines
```

## 2026-10-27 reviewer, ticket 02 (appended by the conductor)

```
status:    done
persona:   reviewer
ticket:    02
artifacts: reviews/code-review-02.md
decisions: approved, no blocking or should-fix findings; nit: the 14pt gap is an unnamed constant
evidence:  116,784 exclusive quotes base vs ticket -> identical apart from inclusive:false; 101,541 inclusive quotes vs independent reference -> 0 invariant violations; readers run directly
evidence:  PDF not viewed as an image (pdftoppm missing); QA to check visually
```

## 2026-10-28T00:50:00+08:00 qa
status:    done
persona:   qa
ticket:    -
artifacts: .scratch/quote-gst-inclusive/reviews/qa-01.md
decisions: no defect tickets and no new tests, because nothing failed; PDFs rendered with pdf.js in the browser since pdftoppm is missing
questions: Should a blank or invalid GST rate block the PDF? Recommend leave as is (matches exclusive mode); separate ticket if wanted
evidence:  npm test -> 39 files, 735 passed; npm run build -> exit 0; UAT 11 of 11 pass; AC1-AC8 56 of 56 cases pass; 600,000 random inclusive quotes with new seeds -> 0 violations

## 2026-10-27 conductor: closed

G4 carried out as Ting Yu's standing instruction: branch pushed, PR #7 opened against main. Not merged. Local worktrees from this run removed.
