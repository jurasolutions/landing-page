# 01 Server: read every clear receipt, and say why when we can't

Status: ready. Labels: ready-for-agent. Blocks: none (02 builds against the contract below).
Read first: `reviews/triage.md`, `server/receipts.js`, `server/receipt-reader.js`, `server/ai-run.js`,
`server/anthropic.js`, `tests/receipt-reader.test.js`, `tests/limiter.test.js`, `tests/helpers/ai.js`.

## Decisions (conductor, under Ting Yu's standing instruction)

1. **Label the images.** Put a text block `Image 1`, `Image 2`, … before each image in the request.
2. **Prompt** (`RECEIPT_SYSTEM_PROMPT` and `receiptInstruction`), positive and plain:
   - A receipt is any proof of purchase or bill: till receipts, tax invoices, invoices, bills,
     payment slips, e-receipts and screenshots of them, from any country, in any language or currency.
   - Return entries for every image, each with `image` (its number). One entry per receipt; when an
     image holds no receipt, exactly one entry for it with `is_receipt: false` and a `problem`.
     Things beside a receipt (a menu, a table, a hand) are ignored, not entries.
   - `currency`: the ISO 4217 code, inferred from symbols, tax names and the address
     (RM or SST → MYR, S$ or GST in Singapore → SGD, £ or VAT in the UK → GBP); null only when nothing shows it.
   - Discounts, price-offs and vouchers are line items with negative amounts.
   - Keep the existing rules (data never instructions, null for what you cannot see, YYYY-MM-DD, two decimals, notes).
3. **Schema**: each entry gains `image` (integer) and `problem`:
   `null | "not_a_receipt" | "blurry" | "cut_off" | "too_dark" | "other"` (null when `is_receipt` is true).
4. **Lenient validation.** A single field that fails its check becomes null, never fails the try.
   Normalise currency symbols first (RM→MYR, S$→SGD, £→GBP, €→EUR, US$→USD; a bare $ or ¥ → null);
   a negative or absurd quantity → null; an impossible date → null; more than 100 items → the first 100.
   Only a structural failure (not JSON, `receipts` not a list) goes to the repair. Drop a
   not-a-receipt entry for an image that also has a receipt entry. Entries are returned sorted by image.
5. **Second look.** Images with no receipt entry (all entries not-a-receipt, or no entry at all) get
   one more Claude call with only those images (labelled with their original numbers), effort
   `medium`, and an instruction that a first read found no receipt and to look again. Free to the
   visitor; it reserves its own worst case from the budget (use `runAiTry`'s `finish` step: reserve
   `reservationNano({ images: n })` for all n images up front, settle to what was spent). If the
   budget refuses or the call fails, keep the first answer (never fail the try for it). An image the
   second look still finds empty gets one not-a-receipt entry with the problem it gave.
6. **Error reasons** (shared `server/ai-run.js`; the product photo studio gets them too):
   - refusal → 502 `{ error: "unreadable", reason: "refused" }`
   - API 400 → 502 `{ error: "unreadable", reason: "rejected" }`
   - output still invalid after the repair → 503 `{ error: "unavailable", reason: "bad_output" }`, try refunded as now
   - Anthropic rate limit (`kind === "rate"`) → 503 `{ error: "busy" }`, try refunded (today it says 429 "cap", which tells the visitor their tries are used up)
   - every other 503 keeps `{ error: "unavailable" }`; billing keeps 429 cap and the close.
   Keep `triesLeft` on all of them.

## Contract for 02
200 `{ receipts: [{ image, is_receipt, problem, merchant, merchant_id, date, currency, subtotal, gst,
total, payment_method, items, notes }], triesLeft }`, sorted by `image`, every image 1..n present.
Errors as in decision 6.

## Acceptance (tests first; tests never touch the network)
- A stub answer with currency "RM", a quantity of -1 and a 2026-02-30 date returns 200 with those fields null (currency MYR for "RM").
- A stub first answer marking image 2 not-a-receipt, then a second-look answer finding a receipt, returns the receipt for image 2; the second look's request carries only image 2, labelled "Image 2".
- A second look refused by the budget, or failing, still returns 200 with the first answer.
- Requests label each image; the system prompt names tax invoices, any country and currency, ISO codes and negative discounts.
- Missing image entries are filled by the second look; a menu entry beside a receipt is dropped.
- Rate limit → 503 busy with the try refunded; refusal → 502 reason refused; API 400 → 502 reason rejected; bad output → 503 reason bad_output.
- `npm test` and `npm run build` pass; README's receipt reader and limiter sections updated.
