# 09 — Defect: the "Pages to keep" error is not exposed as invalid

Status: ready-for-agent
Blocked by: none
Severity: minor (accessibility, APP-003 §2)
Found by: QA 01 (`reviews/qa-01.md`, case M3-a11y)

## Steps

1. Split tab, add a 5-page PDF.
2. Type `4-2` in "Pages to keep" and press "Download selected pages".

## Expected

The field is marked `aria-invalid="true"` while the error shows, as the quote builder's fields
are (`QuoteForm.jsx` line 33).

## Actual

The error shows in red, is linked by `aria-describedby="pm-split-range-note"` and focus moves
to the field, but `aria-invalid` is absent. `SplitPanel.jsx` passes the design system's visual
`invalid` prop only.

## Evidence

`$QA/shots/s02-range-error.png`; DOM read: `aria-invalid: null`.

## Fix direction

Add `aria-invalid={Boolean(rangeError) || undefined}` beside `invalid` in `SplitPanel.jsx`.
