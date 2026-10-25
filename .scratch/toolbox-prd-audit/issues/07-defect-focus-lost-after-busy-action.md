# 07 — Defect: keyboard focus falls to the page after a busy action

Status: ready-for-agent
Blocked by: none
Severity: minor (accessibility: "Keyboard usable", APP-001 and APP-003 §2)
Found by: QA 01 (`reviews/qa-01.md`, cases Q9 and M9)

## Steps

1. Open `/apps/pdf-merge-and-split`, add two PDFs.
2. Tab to "Merge and download" and press Enter.
3. Check `document.activeElement`.

The same happens with "Download selected pages", Enter inside "Pages to keep", and "Split into
single pages" in the Split tab, and with "Download PDF" in the quote builder.

## Expected

Focus stays somewhere sensible: on the button, or on the "Your file is ready" confirmation
or its "Start again" button.

## Actual

`document.activeElement` is `<body>` once the download starts. The control is `disabled` while
working (`disabled={working}` in `MergePanel.jsx` and `SplitPanel.jsx`; the quote builder's PDF
button likewise), and a focused element that becomes disabled loses focus. Chromium's next Tab
happens to continue from the panel, but screen readers lose their place, and other browsers
may restart from the top of the page.

## Evidence

Playwright: focus the button, press Enter, wait for the download, read `activeElement`.
Result: `BODY` for all five controls. The `focusout` event fired with `relatedTarget = null`
when the button turned to "Putting your file together…".

No unit test: the suite renders markup in node with no DOM, so focus cannot be tested there.

## Fix direction

Use `aria-disabled` with a guard in the handler instead of `disabled` while working, or move
focus to the confirmation (the `Outcome` region, `tabIndex={-1}`) when the work finishes.
