# 11 — Defect: a second tab erases the remembered business details

Status: ready-for-agent
Blocked by: none
Severity: minor (APP-001 §2 "Business details persist after reload only when Remember is ticked")
Found by: QA 01 (`reviews/qa-01.md`, case Q7-neg)

## Steps

1. Open `/apps/quote-builder` in tab A and in tab B, with nothing remembered yet.
2. In tab A, type a business name and tick "Remember my business details on this device".
3. In tab B (Remember still unticked there), type anything in the business details.
4. Open the quote builder fresh, or reload tab A.

## Expected

Tab A's remembered details are still there. Only unticking Remember should forget them.

## Actual

They are gone. In `src/apps/quote-builder/index.jsx` the storage effect calls
`removeStored(STORE_KEY)` on every change to the business details while `remember` is false,
not only when the visitor unticks it. So any tab that has not ticked Remember deletes what
another tab saved, as soon as you type.

## Evidence

Playwright, two pages in one context: after the steps, reloading B shows an empty business
name with Remember unticked. No unit seam (the effect lives in the component; no DOM in the
suite).

## Fix direction

Remove the stored details only on the change from ticked to unticked (an `onRemember(false)`
handler), not in the effect that runs on every edit.
