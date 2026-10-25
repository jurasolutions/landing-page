# 08 — Defect: moving a quote item to the top or bottom drops focus

Status: ready-for-agent
Blocked by: none
Severity: minor (accessibility, APP-001 §2 "Keyboard usable")
Found by: QA 01 (`reviews/qa-01.md`, case Q9)

## Steps

1. Open `/apps/quote-builder` and add four items (L1 to L4).
2. Focus "Move item 2 up" and press Enter.

## Expected

The item moves to the top and focus stays with it: on its "Move item 1 down" button, as
APP-003 does when a file reaches the end of its list.

## Actual

Order becomes L2, L1, L3, L4 and `document.activeElement` is `<body>`. The button followed the
item (keyed by id), became "Move item 1 up" and is now `disabled`. The same happens with "Move
item 3 down" on the last-but-one item. Moves in the middle keep focus correctly.

## Evidence

Playwright run in `reviews/qa-01.md` (Q9): `mid_down` and `mid_up` keep focus, `to_top` and
`to_bottom` give `BODY`. No unit seam (no DOM in the suite).

## Fix direction

After a move that disables the pressed button, focus the item's other move button, as
`MergePanel.jsx` does.
