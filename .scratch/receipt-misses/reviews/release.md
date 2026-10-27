# Release: receipt-misses

## PR body

Clear receipts sometimes came back as "We couldn't find a receipt in this image", and clear photos
sometimes failed with a message that blamed the photo. This fixes the causes and makes each failure
say what happened.

**Reading receipts**
- Each photo is labelled in the request and every answer names its photo, so answers can't drift
  between photos and a menu beside a receipt no longer becomes a "not a receipt" entry.
- The prompt says tax invoices, invoices and bills from any country count, asks for the ISO
  currency (RM → MYR, S$ → SGD, £ → GBP) and for discounts as negative lines.
- One field the checker can't use is left empty instead of failing the whole try.
- A photo read as "no receipt" gets one free second look. It is reserved with the try, so it never
  spends money the budget hasn't set aside, and it counts towards AI_SITE_CAP.

**Saying what went wrong**
- A missed photo's card shows the photo and why: not a receipt, too blurry, cut off, too dark.
- Each failure has its own words: declined, image rejected, our fault, busy, no connection.
  A rate limit no longer says the free tries are used up.
- Every failure says outright whether the try was counted, so "This try wasn't counted." is only
  shown when it is true.
- A HEIC photo is accepted where the browser can open it (Safari), and otherwise refused with how to
  export a JPEG.
- The product photo studio and quote builder share the new reasons and have their own words.

Tests: 630 pass (36 files). Build prerenders every route. Reviewed (approve, fixes applied) and
QA'd locally against a stand-in for Claude.

## Rollback
Revert the merge commit on `main` and push, or "Rollback to this deployment" on the previous
production deployment (5c3087d) in the Pages dashboard.

## Live check after the deploy
Ting Yu's network is unlimited, so this costs no tries: read the three test receipts (MY invoice,
SG tax invoice, UK bill) on jurasolutions.sg/apps/receipt-reader. Expect three receipts with MYR,
SGD and GBP, and the Cold Storage discounts as negative lines. Then check the studio and quote
builder pages load and `/api/apps/limit` answers `ready: true`.
