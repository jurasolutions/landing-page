# 03 — Make the AI cap hold, gate draft tools, and correct the privacy notice

Status: ready-for-agent
Blocked by: none

From `reviews/code-review-02.md` findings 1, 2, 3, 4, 5, 6, 7, 10, 11. Read each finding there for file and line.

## Decisions taken (conductor, using the reviewer's recommendations; Ting Yu asked not to be consulted)

- Finding 3: add a per-IP ceiling, `AI_TRIES_PER_IP`, default 6 a day, salted IP-only hash, taken in the same `takeTry` alongside the IP+cookie count. Same SGT day, same refund rules.
- Finding 4: Web Analytics is not switched on, so remove the sentence claiming it from the privacy notice now. README "Not done yet" gains an item: turn on Cloudflare Web Analytics (app factory §5.5), then add the line back.

## Acceptance criteria

- [ ] Finding 1: `app_calls` is never decremented. Every request actually sent to Anthropic takes a call from the site cap with the conditional upsert, the repair call included; the repair is skipped (and the visitor's try refunded, answer `unavailable`) when the cap is reached. `maxRetries: 0` on the SDK client. The visitor's try is refunded for API/network failures and invalid output, but not for `stop_reason: "refusal"`. New test: `AI_SITE_CAP=3`, five refusals in a row → at most 3 API calls; and a test that the repair counts against the cap.
- [ ] Finding 2: the receipt-reader Function and `/api/apps/limit` answer 404 for a tool whose registry status is not `live`, unless `AI_ALLOW_DRAFTS=1` is set (document it beside `VITE_SHOW_DRAFTS` in the README as local-only, never set on Pages). `npm run dev:functions` docs mention putting it in `.dev.vars`. Tests for both.
- [ ] Finding 3: `AI_TRIES_PER_IP` (default 6) as above, with tests: three cookies from one IP stop at 6 calls; README env table and limiter section updated.
- [ ] Finding 4: privacy notice sentence about Cloudflare Web Analytics removed; README "Not done yet" item added.
- [ ] Finding 5: when the visitor is out of tries (or the daily cap is reached), the receipt reader shows the shared `TalkToUsCard` right under the notice.
- [ ] Finding 6: the reply-unsubscribe line says it is handled by hand, well within 10 business days; "personal addresses" becomes wording that matches scout §5.2 (role addresses, or a named person's only where the business publishes it for enquiries).
- [ ] Finding 7: the quote PDF's Creator/Producer metadata names Jura only when the "Made with" line is on; asserted in `quote.test.js`.
- [ ] Finding 10: in the receipt-reader Function, any unexpected throw after the try is taken refunds the try and answers 503 `unavailable`; test with D1 bound but no tables.
- [ ] Finding 11: `/api/apps/usage` counts only `live` slugs (with the same `AI_ALLOW_DRAFTS`-style local override, or simply live-only).
- [ ] All copy changes pass `uv run jura-growth check-copy` (run from `repos/growth`). `npm test` and `npm run build` pass.
