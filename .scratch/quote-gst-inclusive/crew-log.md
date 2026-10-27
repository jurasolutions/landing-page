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
