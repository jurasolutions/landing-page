# 05 — Follow-ups from reviews 01 and 03

Status: ready-for-agent
Blocked by: 04 (merged into `crew/toolbox-prd-audit` first; it touches `receipt-reader/index.jsx` and `server/registry.js`)

The should-fix items from `reviews/code-review-01.md` and `reviews/code-review-03.md`. Read each finding there for file and line.

## Decision taken (conductor; Ting Yu asked not to be consulted)

Review 03 asked whether to bound refunds per visitor. Yes, as recommended: an API `400 invalid_request_error` keeps the try used (it comes from what was uploaded, like a refusal), and a visitor gets at most one refunded failure per SGT day (an `app_tries` row with a reserved key such as `#refund`, which cannot collide with a slug). This narrows ticket 03's "refunded for API/network failures".

## Acceptance criteria

APP-003 (review 01):
- [ ] 1: while the merge list holds a problem file, a warning shows above "Merge and download": "Files with a problem are left out. Remove them, or fix them and add them again." (or wording that passes check-copy and §3). Test that it shows.
- [ ] U1: the thumbnail `<ol>` is focusable (`tabIndex={0}`) with a `:focus-visible` outline from the design system's focus token.
- [ ] 4 + 5: a shared `src/apps/_shared/pdfjs.js` exports `openPdfjs(bytes)` (destroys the loading task when the load fails) and `canvasToJpeg(canvas, quality)`; the receipt reader and APP-003 both use it.
- [ ] 2: `copy.buttons.choose` is either used (FileDrop `chooseLabel` prop) or deleted.

AI limiter (review 03):
- [ ] 1: the reply-unsubscribe line reads "…we'll add the address by hand, well within ten business days." `tests/privacy.test.js` updated.
- [ ] 2: `takeTry` gives back whatever it took if a later statement throws, then rethrows. Test with a D1 stub that throws on the second insert.
- [ ] 3 + 4 + 9: one `refundOnce()` shared by `fail` and the catch; a refund is attempted at most once; `triesLeft + 1` only when the refund succeeded. Test with a D1 stub that throws during refund.
- [ ] 11: refunds bounded as in the decision above. Tests: 400s from the API keep the try; a second refundable failure the same day keeps the try.
- [ ] 12: for IPv6, the per-IP hash uses the /64 prefix. Test with two addresses in one /64.
- [ ] 6 + 7: delete `isKnownSlug` if it has no caller; the catch path logs through `logCall`; fix the stale comment.
- [ ] U1 (review 03): out of tries, the page shows the talk-to-us card once (the one under the notice); the shell skips its closing card in that state.

General:
- [ ] README updated where behaviour changed (limiter section, env table if anything new). `npm test`, `npm run build` and `uv run jura-growth check-copy` on every changed copy file pass.
