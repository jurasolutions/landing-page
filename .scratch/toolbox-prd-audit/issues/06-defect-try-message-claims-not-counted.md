# 06 — Defect: the receipt reader says "This try wasn't counted" when it was

Status: ready-for-agent
Blocked by: none
Severity: major (APP-002 is a draft; fix before it goes live)
Found by: QA 01 (`reviews/qa-01.md`, case R4-msg)

## Steps

1. Run the draft locally against a stand-in API (see "How it was run" in `reviews/qa-01.md`).
2. Make the stand-in answer with `stop_reason: "refusal"` (or a 400 `invalid_request_error`).
3. Add a receipt and press "Read receipts".

## Expected

The page tells the visitor the truth about the try. Here the try was used: the counter
drops from 2 to 1.

## Actual

"We couldn't read these images. Clearer, flatter photos usually work. This try wasn't
counted." while the counter shows "1 free try left today".

The same happens with "The receipt reader isn't available right now. Please try again later.
This try wasn't counted." on a second refundable failure the same SGT day. Ticket 05 bounded
refunds to one per visitor per day, so that try stays used.

## Cause

`src/apps/receipt-reader/index.jsx` (`read`) picks the message from the status alone: 502
gives `copy.errors.unreadable`, anything else gives `copy.errors.unavailable`, and both copy
strings promise the try came back. Since ticket 05, the Function answers 502 both for a
refunded failure (invalid output) and for a kept try (refusal, API 400), and 503 both before
and after the day's one refund. Its `triesLeft` says which.

## Evidence

- `$QA/shots/r05-refusal-says-not-counted.png`; the response was `502 {"error":"unreadable","triesLeft":1}`
- Failing test: `tests/try-message.test.js` on `crew/toolbox-prd-audit-qa-01` (3 red, 2 green controls)

## Fix direction

Compare `body.triesLeft` with the tries before the request, or have the Function say
`refunded: true`, and only then add "This try wasn't counted." The words for a kept try go
in `copy.js` and must pass `jura-growth check-copy`. Do not weaken the test to match the copy.
