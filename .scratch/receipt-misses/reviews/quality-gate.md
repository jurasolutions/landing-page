# Quality gate: receipt-misses (conductor, 2026-10-27)

**Verdict: GO**, with the live check after release as the last step (the Pages preview has no AI
secrets, so the real model can only be exercised in production; rollback is instant).

| Exit criterion | Evidence |
| --- | --- |
| Tickets 01 and 02 acceptance | developer reports (597 / 580 passing), QA qa-01: ticket 01 14/15 in the browser + 1 unit-only, ticket 02 27/29 + 1 unit-only + 1 defect |
| Code review | code-review-01: approve; S1–S5 fixed (371739d), S6 fixed in the PRD |
| Defects | 03 resolved (5012443), its QA regression test now in `tests/not-counted.test.js` and green; QA's exploratory notes on reasons, card title and the quote builder's offline words fixed in the same commit |
| Suite | `npm test` → 36 files, 630 passed |
| Build | `npm run build` → built, every route prerendered |
| Copy | `jura-growth check` → every new string passes (digits in a filled-in photo number trip the numbers rule falsely; the templates pass) |
| Limiter and budget | reviewer: second look reserved with the try, counted towards AI_SITE_CAP, settled to real cost; nothing sent unreserved |

Untested in a browser, covered by unit tests only: the budget refusing the second look (cannot
happen once its money is reserved with the try), and Safari decoding a HEIC.

Open, not blocking: a missed card at 360 px wraps its sentence into a narrow column (no sideways
scroll); the receipt reader PRD still reads "PENDING SIGN-OFF" although the tool is live.
