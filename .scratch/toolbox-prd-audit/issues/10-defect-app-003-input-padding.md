# 10 — Defect: APP-003's text inputs have 2 px left padding

Status: ready-for-agent
Blocked by: none
Severity: minor (visual; APP-003 §2 "design-system tokens only")
Found by: QA 01 (`reviews/qa-01.md`, case M9)

## Steps

1. Open `/apps/pdf-merge-and-split`, add a PDF, look at "Name for the new file".
2. Split tab, add a PDF, look at "Pages to keep".

## Expected

Text and placeholder start `var(--space-3)` (12 px) in from the border, like the quote
builder's inputs.

## Actual

Computed padding is `0 12px 0 2px`: the text sits against the left border. The design
system's `Input` sets the `padding` shorthand and then `paddingLeft: undefined` when it has no
icon, which clears the left side. The quote builder works around it (`QuoteForm.jsx` lines
9 to 11, `TAP_INPUT`); `MergePanel.jsx` and `SplitPanel.jsx` pass `{ minHeight }` only.

## Evidence

`$QA/shots/m05-name-input-padding.png`, `$QA/shots/n02-pdf-merge-360.png`.

## Fix direction

Here: the same `paddingLeft: "var(--space-3)"` in APP-003's input style. At source (the user's
call, since `design-system/` is read-only): fix `Input.jsx` so it leaves `paddingLeft` alone
without an icon. The home page's enquiry form has the same 2 px padding; it predates the
toolbox and is on production today.
