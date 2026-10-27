# 03 Defect: "This try wasn't counted" on a first visit when the try was counted

Status: resolved (conductor, 2026-10-27: the Function now says `counted`; the pages trust it). Labels: bug. Severity: low. Found by QA (reviews/qa-01.md, case 4-X1).
Pre-existing: the same logic is on `main`; this feature's ticket 02 makes it an acceptance line
("Keep 'This try wasn't counted.' ... when the try came back"), so it now fails a criterion.

## What happens
The page decides whether a try came back by comparing the `triesLeft` in the error answer with the
count it showed before the try. On a first visit, the count shown comes from `GET /api/apps/limit`
sent without a cookie, so it is the IP's cookie-less bucket (`server/visitor.js identifyVisitor`:
`|no-cookie`). That same response issues a cookie, so the read itself is counted in the new
cookie's bucket. When the IP's cookie-less bucket has been used today (a browser that refuses
cookies on the same network, or this visitor before the cookie was set), the two numbers come from
different buckets and the page promises a try came back when it did not.

## Steps
1. Local run as in reviews/qa-01.md (stand-in for the Messages API, `AI_TRIES_PER_DAY=5`).
2. With no cookie, send one read that succeeds (uses a try in the IP's cookie-less bucket).
3. Clear cookies and open `/apps/receipt-reader`: it shows "4 free tries left today".
4. Add a photo; the stand-in answers with `stop_reason: "refusal"`. Press Read receipts.

## Expected
"These images couldn't be read. If they're receipts, try one clear photo of each." The try was used
(502 refused keeps it), so nothing about it coming back.

## Actual
"These images couldn't be read. If they're receipts, try one clear photo of each. This try wasn't
counted." The same for an API 400 (reason rejected). The counter also never drops on that visit
(4 before, 4 after), and a refunded failure moves it up (4 to 5).

## Evidence
- Screenshots (git-ignored): `.scratch/receipt-misses/qa/shots/4a-refusal.png` from the first run,
  where the counter read 4 before a fresh visitor's first try.
- Failing test (red): `.scratch/receipt-misses/qa/tests/not-counted-first-visit.test.js`, run with
  `npx vitest run --config .scratch/receipt-misses/qa/vitest.qa.config.js`:
  `expected '... This try wasn't counted.' not to contain 'This try wasn't counted.'`
  Move it to `tests/` when this is picked up.

## Suggested fix (for the developer to decide)
Either have the Function say it outright (for example `counted: false` on an answer that gave the
try back) so the page stops inferring it, or have `GET /api/apps/limit` without a cookie report the
bucket of the cookie it is issuing. The first also covers a second tab that spent a try meanwhile.
