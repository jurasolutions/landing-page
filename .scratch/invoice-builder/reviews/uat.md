# UAT script: APP-005 Invoice builder

This is the script Ting Yu runs to accept the invoice builder before it goes live. It follows
the PRD's done-check (§5.4): run the unit tests, open the local dev server, build a 5-line
invoice with GST on and the same invoice with GST off, open a saved quote file, download both
PDFs, and lay the page and the PDFs beside the IRAS list in §4. Nothing is deployed until you
give the go-ahead.

The figures below were worked out by hand. If the tool shows a different figure, that scenario
fails. Recommended behaviours from `reviews/functional.md` are marked "(rec. S1)" and so on,
so you can see which ones you are also accepting.

## Before you start

- Run `npm test` in the repo. Every test should pass. Note the count.
- Run `npm run dev` and open http://localhost:5173/apps/invoice-builder in Chrome.
- Have Safari and Adobe Acrobat Reader to hand for scenario 6.
- Keep the IRAS list (PRD §4) open beside you. A tax invoice must show:
  1. the words "Tax invoice", in a prominent place
  2. the supplier's name, address and GST registration number
  3. the invoice date and an identifying number
  4. the customer's name and address
  5. a description of the goods or services
  6. the GST rate
  7. the amount before GST, the GST amount, and the amount with GST

## Test data

All names and numbers are made up for testing.

**Business (data set B)**
- Business name: Sample Aircon Services Pte. Ltd.
- Address: 10 Example Road, #01-01, Singapore 123456
- UEN: 202600000A
- Phone: 6123 4567
- Email: accounts@example.com
- Logo: any PNG under 1 MB. Also keep a second image over 1 MB to hand.
- GST registration number: M2-0000000-0
- Payment details: Bank transfer to Example Bank 123-456789-0, or PayNow to UEN 202600000A

**Customer (data set C)**
- Company or customer name: Sample Condo MCST 0000
- Contact name: Alex Tan
- Customer address: 1 Sample Avenue, Singapore 654321
- Customer email: office@example.com

**Invoice A: five lines**

| # | Description | Quantity | Unit | Unit price | Line discount | Line total |
|---|---|---|---|---|---|---|
| 1 | Aircon general servicing | 4 | units | 45.00 | none | 180.00 |
| 2 | Chemical overhaul | 1 | unit | 150.00 | 10% | 135.00 |
| 3 | Gas top-up R32 | 2 | units | 80.00 | 20.00 off | 140.00 |
| 4 | Labour | 2.5 | hours | 60.00 | none | 150.00 |
| 5 | Copper piping | 3.5 | m | 18.50 | none | 64.75 |

Overall discount: 5%. Invoice date: today. Due date: 30 days from today. Notes: "Thank you
for your business."

| Totals | GST on (9%) | GST off |
|---|---|---|
| Subtotal | 669.75 | 669.75 |
| Discount | -33.49 | -33.49 |
| Amount before GST | 636.26 | (not shown) |
| GST (9%) | 57.26 | (not shown) |
| Amount with GST | 693.52 | (not shown) |
| Total | (not shown, rec. N1) | 636.26 |

**Quote Q: made in the quote builder at /apps/quote-builder**
- Customer: data set C
- Lines:
  - "Site visit and measurement", 1 visit at 200.00
  - "Planter box 200 x 100 x 70 cm", 2 pcs at 350.00, 10% off (630.00)
  - "Installation", 1 job at 200.00, 50.00 off (150.00)
- Discount on the whole quote: 30.00
- GST on, 9%, prices exclude GST
- Notes: "Delivery within 14 days of confirmation."
- Save it as `quote-Q.quote.json`. Then switch "Prices include GST" on and save a second
  copy as `quote-Q-incl.quote.json`.

Expected invoice totals from either file: Subtotal 980.00, Discount -30.00, Amount before GST
950.00, GST 85.50, Amount with GST 1,035.50.

**Invoice P: forty lines.** Forty lines "Part 1" to "Part 40", each 1 × 10.00, with GST on.
Expected: Subtotal 400.00, Amount before GST 400.00, GST 36.00, Amount with GST 436.00.

**Other files**
- A bad file: any `.txt` file, renamed to `bad.json`

## Scenarios

Mark each scenario pass or fail. A fail needs a note of what you saw.

### 1. The 5-line tax invoice (§5.4)

1. Fill in data set B, switch "Charge GST" on, and fill in data set C and invoice A.
2. Check the totals on the page against the GST on column above.
3. Check the invoice number reads `INV-` followed by today's date as YYYYMMDD and `-01`.
4. Click "Download PDF".

**Pass when:** the PDF downloads; its heading is "Tax invoice"; every one of the seven items
on the IRAS list is visible on it; the totals match the GST on column; and the PDF carries
your logo and name, with nothing of Jura's on it.

### 2. The same invoice with GST off (§5.4)

1. Switch "Charge GST" off. Leave the registration number as typed.
2. Click "Download PDF".

**Pass when:** the heading is "Invoice"; the words "Tax invoice" and "GST", the rate and the
registration number appear nowhere; and the total reads 636.26.

### 3. Missing details on a tax invoice

1. Switch GST back on. Clear the business address and the customer address.
2. Click "Download PDF".

**Pass when:** no file downloads; the page shows "A few details are still needed for a tax
invoice" with "Please add: Business address" and "Please add: Customer address"; and
clicking each one puts the cursor in that field.

3. Fill both fields back in and click "Download PDF".

**Pass when:** the PDF downloads and the list has gone.

4. Repeat with one field empty at a time: business name, GST registration number, GST rate,
   invoice number (rec. B3), invoice date, company or customer name. Then repeat with every
   item's quantity set to 0.

**Pass when:** each time, only that field is listed. When every quantity is 0, the list reads
"An item with a description and a quantity".

5. Switch GST off with every field still empty.

**Pass when:** the PDF downloads with no list.

### 4. Starting from a saved quote (§5.4)

1. On the invoice page, with data set B filled in, click "Open quote file" and pick
   `quote-Q.quote.json`. If the page asks whether to replace your work, choose "Replace it"
   (rec. S1).

**Pass when:**
- the customer, the three lines with their discounts, the 30.00 discount and the notes are
  filled in;
- GST is on at 9%;
- the totals match quote Q's expected totals;
- your business details and invoice number are unchanged;
- the notes say nothing about the quote being valid until a date (rec. S3).

2. Download the PDF.

**Pass when:** it reads "Tax invoice" and shows Amount with GST 1,035.50.

3. Open `quote-Q-incl.quote.json`.

**Pass when:** the totals are the same as in step 1, and a notice says the quote's prices
included GST and asks you to check them (rec. B5).

4. Open `bad.json`.

**Pass when:** "That file doesn't look like one saved from our quote or invoice builder."
appears, and nothing on the page changes.

### 5. The GST figures to the cent

1. Use "New invoice", confirm, and add one line "Call-out fee", 1 × 150.50, with GST on at 9%.

**Pass when:** GST shows 13.55, and Amount with GST shows 164.05 (13.54 is a fail).

2. Replace that line with three lines, each "Filter" 1 × 10.50.

**Pass when:** GST shows 2.84 and Amount with GST shows 34.34 (2.85 is a fail).

3. Replace those with one line "Washers", 3 × 0.10.

**Pass when:** the line total shows 0.30, with no long decimals anywhere.

### 6. Save, re-open, and the PDF in three readers

1. Rebuild invoice A with GST on. Add a sixth line "Spare filter" with quantity 0, and check
   the hint "Items with no quantity are left off the invoice." shows.
2. Click "Save invoice file".
3. Click "New invoice" and confirm. Check that the customer, items and notes are cleared, and
   that your business details, payment details and GST setting stay (rec. S2).
4. Click "Open invoice file" and pick the saved file.

**Pass when:** everything is back exactly as it was, including the zero-quantity line (which
is still left off the preview), the due date, the logo and the totals.

5. Download the PDF. Open it in Chrome, Safari and Acrobat Reader.

**Pass when:** it opens in all three without warnings, is A4, and nothing is cut off.

6. Build invoice P (40 lines) and download it.

**Pass when:** rows never split across a page; every page shows its column headings and
"Page n of N"; and the totals from Subtotal to Amount with GST sit together on one page.
The figures are 400.00, 36.00 and 436.00.

### 7. Other edge cases

1. Set the due date to the day before the invoice date.

   **Pass when:** "The due date is before the invoice date." shows, and the PDF still
   downloads (rec. S5).

2. Try the logo over 1 MB.

   **Pass when:** "Please use a logo under 1 MB." shows, and the old logo stays.

3. Type a customer name in Chinese characters.

   **Pass when:** a notice lists the characters that will be left out of the PDF.

4. Set the business name to empty and download with GST off.

   **Pass when:** no business name prints, and "Jura Solutions" appears nowhere (rec. B1).

### 8. Remember, and blocked storage

1. Tick "Remember my business details on this device" and reload.

   **Pass when:** the business details, payment details and GST setting are back, and the
   customer and items are empty.

2. Untick it and reload.

   **Pass when:** everything is empty.

3. In Chrome settings, block site data for localhost, reload, and run scenario 1 again.

   **Pass when:** it works; ticking Remember shows the note that details will not be
   remembered.

### 9. Phone, keyboard and the rest of the page

1. In Chrome's device toolbar at 360 px wide, run scenario 1.

   **Pass when:** nothing scrolls sideways; "Preview" and "Edit" switch views; and the buttons
   are easy to tap.

2. Run scenario 1 with only the keyboard.

   **Pass when:** every control can be reached and used, and you can always see where the
   focus is.

3. Read every word on the page and the PDFs.

   **Pass when:** everything is in sentence case and speaks to "you"; there are no exclamation
   marks; and nothing says the invoice meets IRAS rules.

4. Click the talk-to-us button.

   **Pass when:** it opens the enquiry form, and the address bar shows
   `?from=apps/invoice-builder`.

5. With `npm run dev:functions`, open the page and download one PDF. Then check the local
   `app_usage` table.

   **Pass when:** it shows one `open` and one `complete` for `invoice-builder`.

## Sign-off

| | |
|---|---|
| Unit tests (count passed) | |
| Scenarios passed | / 9 |
| Failures and notes | |
| Accepted by | Ting Yu |
| Date | |

Deploy only after this sign-off and the release approval in #approvals.
