# Triage (conductor, 2026-10-27)

## What Ting Yu saw
- Clear receipts came back as "We couldn't find a receipt in this image." (photos: a Malaysian hotel
  INVOICE in RM with SST, a Singapore Cold Storage "Tax Invoice" in SGD, a UK room-service bill in GBP).
- Other uploads fail with the generic "We couldn't read these images. Clearer, flatter photos usually
  work." although the photo is clear.

## Repro
- Live site, the same three photos, two runs from Ting Yu's network: both read all three
  (MYR 1,560.00 with the currency left blank, SGD 56.75 flagged "items don't add up", GBP 24.88).
  So the miss is intermittent, in the model's answer, not in the files. Photo preparation did not
  change in behaviour in today's release (diff 646a1cb..b79b838: code moved to `_shared/photos.js`).

## Causes found in the code
1. The prompt only says "if an image is not a receipt" — a tax invoice, bill or hotel invoice can be
   taken literally as "not a receipt". It never says any country or currency is fine.
2. Entries are not tied to images: "one entry per receipt, in the order the images are given". A
   photo with a menu beside the receipt can produce an extra not-a-receipt entry; nothing checks the
   count; images are not labelled in the request.
3. A not-a-receipt answer is final: no second look, no reason given.
4. Validation is all-or-nothing (`server/receipts.js validateReceipts`): one field the checker
   dislikes — currency "RM" or "S$", a negative quantity on a "Price Off" line, an impossible date,
   more than 100 items — fails the whole try; the text-only repair cannot see the images; the page
   then blames the photo (502 "We couldn't read these images").
5. One message covers several causes: a refusal, an image the API rejects (400) and bad output all
   show "couldn't read these images"; an Anthropic rate limit answers 429 "cap", so the page says
   today's free tries are used up; a network failure shows "isn't available right now".
6. Discounts ("Price Off 13.10-") are not described in the prompt, hence the false "don't add up".
7. HEIC is refused even where the browser can decode it (Safari).

## Route
bug: tickets 01 (server) and 02 (browser) in parallel against the contract in 01, then review,
QA on the live preview, release. The researcher runs the image-allowance spike alongside.
