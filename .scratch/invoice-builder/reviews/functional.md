# Functional review: APP-005 Invoice builder

Reviewed on 2026-10-31 against the approved PRD A-0002 (reading copy in
`.scratch/invoice-builder/spec.md`), `CONTEXT.md` "Invoice builder (APP-005)", and the
quote builder as built (`src/apps/quote-builder/`). The PRD is signed off and is not edited
here. Where it is unclear, this review gives the recommended reading within it. Nobody could
be asked during this run, so every open point carries the recommended answer and is marked
**Recommended**.

Line references are to `.scratch/invoice-builder/spec.md` (`spec:NN`) and `CONTEXT.md`
(`ctx:NN`).

Two sources were not available. `src/design-system/README.md` is not in this worktree (only
`styles.css` is synced), so copy is checked against the §3 summary on the operating card
(`docs/agents/crew.md` line 31). `jura-growth check` was not run (crew-log, G1).

---

## 1. Findings

### Blocking

These must be settled in the build, or a tester can fail a §2 criterion on the first try.

**B1. An empty business name must never print "Jura Solutions".** (spec:79, spec:82, spec:69, ctx:38)
The quote builder's `effectiveQuote` (`model.js` lines 58 and 136-144) prints
`DEFAULT_BUSINESS_NAME = "Jura Solutions"` whenever the business name is empty. Reused here,
it would put Jura's name on the visitor's own invoice as the supplier, and the required-field
check would never see an empty business name.
**Recommended:** the invoice builder has no business-name placeholder that prints. An empty
business name prints nothing. The required-field check reads the field as typed, not a
substituted value. The input may show an example in light grey, but the example never prints
or counts as filled in.

**B2. "Amount before GST" prints on every tax invoice, not only when there is a discount.** (spec:37, spec:75, ctx:37)
The quote builder's `totals-rows.js` (line 51) shows "Total before GST" only when there is a
discount. IRAS requires the amount excluding GST on every tax invoice.
**Recommended:** with GST on, the totals always read, in order: Subtotal, Discount (only when
a discount applies), Amount before GST, GST (9%), Amount with GST. With GST off: Subtotal,
Discount (only when a discount applies), Total. See §4 below for the full rule.

**B3. The suggested invoice number must not make "Invoice number" impossible to miss.** (spec:38, spec:54, ctx:43)
If the suggestion is a placeholder that prints whenever the field is empty (the quote builder's
pattern), the invoice number can never be missing, so the "covers each field" test for it
cannot fail.
**Recommended:** a new invoice starts with the suggested number typed into the field as real
text. It follows the invoice date (`INV-` and the date as `YYYYMMDD`, then `-01`) until the
visitor edits the field. Once the visitor edits it, the number is theirs. If they clear it, it
stays empty, and with GST on it is listed as missing.

**B4. The required-field check must cover the GST rate and every counted line's description.** (spec:38, spec:58, spec:75, ctx:38)
spec:58 says the check covers "the IRAS list in §4", which includes the GST rate and a
description of the goods or services. The glossary list (ctx:38) leaves out the rate and asks
only for "at least one item" with a description. As built in `calc.js`, a line with a price and
a quantity but no description still counts toward the total (`hasContent`, line 101), so it
would print as a priced line with no description.
**Recommended:** the check covers the list in §3 below. The two additions are "GST rate" (empty,
not a number, 0, or over 100) and "Description for item N" (any line that counts toward the
total but has no description). Update `CONTEXT.md` ctx:38 to match. That is a glossary fix,
not a PRD edit.

**B5. A quote file whose prices include GST must not silently change the bill.** (spec:39, spec:60, spec:67)
Quote files from version 2 on can carry `gst.inclusive: true` (`quoteFile.js` line 129).
GST-inclusive pricing is out of scope here (spec:67). Opening such a file as-is would add GST
on top of prices that already contain it, and the invoice would come out 9% higher than the
quote, with nothing to tell the visitor.
**Recommended:** open the file (it is a valid quote file, so it is not refused), switch GST on,
keep each price exactly as typed and treat it as a price before GST, and show a notice that
stays until the next file is opened or New invoice is used: "This quote's prices included GST.
The invoice adds GST on top of each price, so check the prices before you send it." Do not
convert the prices by dividing out GST. That would mean rounding each line differently from
the quote, and the totals would not match the quote either way.

### Should fix

**S1. Opening a file over unsaved work asks first.** (spec:60, spec:62, ctx:41-42)
The quote builder replaces the quote without asking (`index.jsx` lines 149-161).
**Recommended:** a file is read and checked first. A bad file shows the bad-file message and
changes nothing, with no dialog. A good file replaces the page straight away when the page
holds no unsaved work. Otherwise a dialog asks first. "Unsaved work" means the customer,
items, discounts, payment details or notes have changed since the page was last opened from a
file, saved as an invoice file, or started fresh. The visitor can keep editing (nothing
changes) or replace. The copy is in §5.

**S2. What "New invoice" keeps and clears.** (spec:62, spec:92)
**Recommended:** it asks first, as the quote builder does. It keeps the "Your business"
section (including the logo), the GST switch, rate and registration number, and the payment
details, because a business's bank and PayNow details rarely change between invoices. It
clears the customer, items (leaving one blank line), the line and overall discounts, the due
date and the notes. It sets the invoice date to today and suggests a new number. If the last
invoice used today's suggested number, the new one goes up by one (`-01` becomes `-02`, using
`nextNumber` from `model.js`), so two invoices made in one sitting never share a number. The
count goes back to `-01` after a reload, and keeping a number sequence is out of scope
(spec:65).

**S3. What opening a quote file carries across.** (spec:39, ctx:42)
**Recommended:**
- **Carried:** the customer's company, contact, address and email; each item's description,
  quantity, unit, unit price and line discount; the overall discount; the notes; GST on or off;
  and the GST rate.
- **Not carried:** the quote number, quote date, "valid until" date and "Made with" setting.
  The invoice number and date stay as they are on the page.
- **Business details:** the ones on the page are kept. Any business field that is empty on the
  page, the GST registration number included, is filled in from the file. A first-time visitor
  with nothing remembered then still gets their own name and logo. Fields that already have
  something in them are never overwritten.
- **The quote builder's default notes:** if the notes are exactly the quote builder's default
  text (`copy.js` line 138, "...This quote is valid until the date shown above..."), they are
  left out, so the invoice never says it is a quote.

**S4. Numbers the totals cannot read must not print as zero on a tax invoice.** (spec:36, spec:38)
In `calc.js`, a quantity, price or discount that is not a number counts as 0 and shows an
inline error.
**Recommended:** with GST off, keep the quote builder's behaviour (an inline error, and the
value counts as 0). With GST on, also list each such field in the missing-fields list, for
example "Please add: Unit price for item 2", and make no file until it is fixed.

**S5. Due date before the invoice date.** (spec:54)
**Recommended:** show an inline note under the due date, "The due date is before the invoice
date.", and still let the PDF download, because the visitor is responsible for what they issue
(spec:82). A due date equal to the invoice date is fine and shows no note. Changing the invoice
date never moves the due date.

**S6. "Remember" stores the business details only.** (spec:42, spec:119)
**Recommended:** "business details" means the "Your business" section, the GST switch, rate
and registration number, and the payment details. Customers, items, invoice numbers and notes
are never stored. Use a key of its own (`jura.invoice-builder.business.v1`), not the quote
builder's. Unticking deletes what was stored. When storage is blocked, show the quote
builder's blocked-storage note (see §5). Opening an invoice file with Remember ticked replaces
the remembered business details with the file's, because what is on the page is what is
remembered.

**S7. Either open button accepts either file.** (spec:110-111)
The bad-file message names both builders, so one wording serves both buttons.
**Recommended:** "Open invoice file" and "Open quote file" each accept both kinds of file and
treat the file as what it is. A quote file follows S3, and an invoice file replaces everything
on the page. Accept quote file versions 1 and 2 and invoice file version 1. Refuse anything
newer, and any file over 3 MB, with the bad-file message.

### Notes

- **N1. The final totals line.** With GST on, the last line is "Amount with GST" and there is no
  separate "Total" line, so one figure is not printed twice (ctx:40). With GST off, the last line
  is "Total".
- **N2.** The GST registration number is free text with no format check. It only has to be
  filled in. It is kept while GST is off but neither shows nor prints.
- **N3. Characters the PDF cannot print** (Chinese names, for example) are left out, with the
  quote builder's notice. Singapore customers' names may well be in Chinese, so the UAT checks
  the notice appears.
- **N4. Discounts larger than the amount** are capped by `calc.js`. An amount off larger than the
  line comes to 0.00, and an overall amount off larger than the subtotal comes to 0.00. A
  percentage over 100 shows "Use a percentage from 0 to 100." No extra rule is needed.
- **N5. A due date is optional.** When it is empty, the PDF prints no due-date line at all, not
  an empty label.
- **N6. The missing-fields heading** ("A few details are still needed for a tax invoice") is
  approved copy. Nothing else on the page or PDF may say that a filled-in invoice meets IRAS
  rules (spec:82).
- **N7. Glossary.** "Payment details" is used across the PRD but is not in `CONTEXT.md`. Add it:
  "the free text the visitor types telling the customer how to pay; kept with the business
  details." The "Total" wording is settled by N1. The mattpocock `domain-modeling` skill is not
  available in this session, so it was not invoked. No term is otherwise overloaded.
- **N8. Usage counter.** "open" counts once per page load. "complete" counts once per PDF actually
  downloaded. A download blocked by missing fields, a failed PDF, or a saved file does not count
  (spec:47).
- **N9. Talk-to-us link.** The shared card builds `/?from=apps/invoice-builder#contact`
  (`src/apps/_shared/TalkToUsCard.jsx` line 11). That satisfies spec:46.
- **N10. Limits.** The quote builder's limits apply: 200 items, 1,000 characters a description,
  4,000 characters of notes, and amounts up to 20 characters. Payment details take the notes
  limit (4,000).

---

## 2. Acceptance criteria, made testable

All amounts are SGD. "GST 9%" means GST on with the default rate. Every figure below was
worked by hand with the rule in spec:80: integer cents, half up at each line total, half up
once on the total GST, and GST on the amount after all discounts.

### AC1. Totals (spec:34)

| ID | Given (lines; overall discount; GST) | Then |
|---|---|---|
| T1 no discount, GST off | "Aircon servicing" 3 × 45.00; "Gas top-up" 1 × 80.00; "Labour" 2.5 × 60.00; no overall discount; GST off | Line totals 135.00, 80.00, 150.00. Subtotal 365.00. Total 365.00. No Discount, Amount before GST or GST row |
| T2 no discount, GST 9% | Same as T1, GST on, 9% | Subtotal 365.00. Amount before GST 365.00. GST (9%) 32.85. Amount with GST 397.85 |
| T3 line % | "Repaint" 3 × 33.33, 15% off; GST 9% | Gross 99.99. Line total 84.99 (84.9915 rounds to 84.99). Amount before GST 84.99. GST 7.65 (7.6491). Amount with GST 92.64 |
| T4 line amount | "Gas top-up" 2 × 150.00, 25.00 off; GST off | Gross 300.00. Line total 275.00. Total 275.00 |
| T4b amount over the line | "Gas top-up" 2 × 150.00, 400.00 off | Line total 0.00 (the discount is capped at 300.00) |
| T5 overall % | T1's lines; overall 5%; GST 9% | Subtotal 365.00. Discount -18.25. Amount before GST 346.75. GST 31.21 (31.2075). Amount with GST 377.96 |
| T6 overall amount | T1's lines; overall 50.00 off; GST 9% | Subtotal 365.00. Discount -50.00. Amount before GST 315.00. GST 28.35. Amount with GST 343.35 |
| T7 overall amount, GST off | T6 with GST off | Subtotal 365.00. Discount -50.00. Total 315.00 |
| T8 rate edited | T1's lines; GST on, rate 8 | GST (8%) 29.20. Amount with GST 394.20 |
| T9 line rounding tie | "Bolts" 0.5 × 0.25; GST off | Line total 0.13 (12.5 cents rounds half up) |

**Unit tests:** one test for each row, through `calc` imported from
`src/apps/quote-builder/calc.js`, plus one that the module is imported, not copied
(spec:80).

### AC2. The half-cent GST tie, and the three amounts adding up (spec:35)

| ID | Given | Then |
|---|---|---|
| H1 half-cent tie | "Call-out fee" 1 × 150.50; GST 9% | 150.50 × 9% = 13.545. GST **13.55** (half up; 13.54 means the code rounded half to even or cut off the digits, and fails). Amount before GST 150.50. Amount with GST **164.05** |
| H2 tie reached through a discount | "Repair" 1 × 200.00; overall 49.50 off; GST 9% | Amount before GST 150.50. GST 13.55. Amount with GST 164.05 |
| H3 GST once, not per line | Three lines, each 1 × 10.50; GST 9% | Subtotal 31.50. GST **2.84** (2.835, once on the total). Amount with GST **34.34**. Rounding each line's GST (0.95 × 3 = 2.85) gives 34.35 and fails |
| H4 the amounts add up | Every row in AC1 and AC2 with GST on | Amount before GST + GST = Amount with GST, to the cent, in the preview, the PDF and the saved file's re-opened totals |

### AC3. No floating-point artefacts (spec:36)

| ID | Given | Then |
|---|---|---|
| F1 | "Washers" 3 × 0.10; GST off | Line total and total show 0.30, never 0.30000000000000004 |
| F2 | Two lines, 1 × 0.10 and 1 × 0.20; GST 9% | Subtotal 0.30. GST 0.03 (0.027). Amount with GST 0.33 |
| F3 | Unit price typed as 1.005, quantity 1 | The field shows 1.01 when it loses focus. Line total 1.01 (`toFixed` would give 1.00) |
| F4 | Any amount in AC1 or AC2 | Every displayed amount (form, preview, PDF) has exactly two decimal places, with thousands separated by commas (1,035.50) |

### AC4. Title and contents of the document (spec:37)

- **Given** GST is on and every required field is filled in (UAT data set A), **when** the PDF is
  downloaded, **then** it shows "Tax invoice" as the largest heading on page 1. It also shows
  the business name and address, the GST registration number, the invoice date, the invoice
  number, the customer name and address, each item's description, the GST rate ("GST (9%)"),
  the amount before GST, the GST and the amount with GST.
- **Given** the same invoice with GST off, **when** the PDF is downloaded, **then** the heading
  is "Invoice". The words "Tax invoice", "GST", "GST reg. no." and the registration number
  appear nowhere on it, even though a registration number is still stored in the form.
- **Given** either invoice, **then** neither the PDF nor the page claims the document meets IRAS
  rules, and the PDF carries no Jura name, logo or footer line.

### AC5. Required-field check (spec:38)

- **Given** GST is on and one required field from §3 is empty (or holds only spaces), **when**
  the visitor clicks "Download PDF", **then** no file is made. The heading "A few details are
  still needed for a tax invoice" appears, followed by one "Please add: {field}" line per
  missing field, in form order. Each line links to its input, and following the link moves
  focus to that input.
- **Given** that list is showing, **when** the visitor fills in the last missing field and clicks
  "Download PDF" again, **then** the PDF downloads and the list disappears.
- **Given** GST is off and every one of those fields is empty, **when** the visitor clicks
  "Download PDF", **then** a PDF downloads with no list shown.
- **Unit tests:** one per field in §3, each blank on an otherwise complete invoice and expected
  to be the only field listed. Also the all-filled case (nothing listed) and the GST-off case
  (nothing listed).

### AC6. Opening a quote file (spec:39)

- **Given** a quote file saved from the quote builder with UAT data set Q, **when** it is opened
  through "Open quote file" on a page with business details already filled in, **then** the
  customer, the three items with their discounts, the overall discount of 30.00, the notes and
  GST on at 9% are filled in, and the totals read: Subtotal 980.00, Discount -30.00, Amount
  before GST 950.00, GST 85.50, Amount with GST 1,035.50. The business details on the page are
  unchanged, and the invoice number and date are unchanged.
- **Given** a file that is not a quote or invoice file (a text file, a JSON file of another
  shape, a version 3 quote file, or anything over 3 MB), **when** it is opened, **then**
  "That file doesn't look like one saved from our quote or invoice builder." appears, and every
  field, the preview and the totals are exactly as before.
- **Given** a quote file with prices including GST (data set Q-incl), **when** it is opened,
  **then** B5 applies: the totals read as for data set Q (1,035.50), and the notice shows.

### AC7. Invoice file round trip (spec:40)

- **Given** UAT data set A with a logo, a due date, a zero-quantity line, a line discount, an
  overall discount, payment details and notes, **when** it is saved with "Save invoice file",
  "New invoice" is used, and the file is re-opened with "Open invoice file", **then** every
  field matches what was saved, including the zero-quantity line, the GST setting and the logo.
  The preview is the same. A PDF downloaded before and after has the same text on every page.
- **Unit test:** serialise, then parse, gives a deep-equal invoice (ignoring React item ids).

### AC8. The PDF (spec:41)

- **Given** data set A, **when** the PDF is opened in Chrome, Safari and Acrobat Reader,
  **then** it opens without warnings, the page size is A4 (210 × 297 mm), and nothing is cut
  off at any edge.
- **Given** data set P (40 lines), **then** the item table breaks between rows, never inside
  one. Each page repeats the column headings and shows "Page n of N". The rows from Subtotal
  to Amount with GST all sit on one page.
- **Given** a line with a 1,000-character description, **then** it wraps inside its row and
  never overlaps the next row.

### AC9. Remember and blocked storage (spec:42)

- **Given** Remember is ticked and the business details are filled in, **when** the page is
  reloaded, **then** the details from S6 are back, and the customer, items and notes are empty.
- **Given** Remember is unticked, **when** the page is reloaded, **then** every field is empty.
- **Given** Remember was ticked and is then unticked, **when** the page is reloaded, **then**
  nothing is remembered.
- **Given** site storage is blocked in the browser, **when** the page loads, **then** the tool
  works end to end, including the PDF and saving the file. Ticking Remember shows the
  blocked-storage note, and nothing errors.

### AC10 to AC14. The shared toolbox criteria (spec:43-47)

- **AC10:** at 360 px wide nothing scrolls sideways. "Preview" switches to the preview and
  "Edit" switches back. Every button, switch and link is at least 44 × 44 px.
- **AC11:** every control can be reached with Tab in visual order and used with Enter or
  Space. Every input has a visible label. Focus is always visible. Text contrast uses the
  design system's tokens only.
- **AC12:** every string in `copy.js` passes `jura-growth check`. Until that can run, check each
  string by hand against §3: sentence case, second person, no exclamation marks, and no claim
  of IRAS compliance.
- **AC13:** the talk-to-us card's button goes to `/?from=apps/invoice-builder#contact`.
- **AC14:** loading the page sends one `open`. Each successful PDF download sends one
  `complete`. A blocked or failed download, and saving a file, send nothing.

---

## 3. Recommended required-field list (with GST on only)

| # | Listed as | Missing when |
|---|---|---|
| 1 | Business name | empty, or only spaces |
| 2 | Business address | empty, or only spaces (the form label is "Address"; the list says "Business address" so it is not confused with the customer's) |
| 3 | GST registration number | empty, or only spaces |
| 4 | GST rate | empty, not a number, 0, or over 100 |
| 5 | Invoice number | empty, or only spaces (see B3) |
| 6 | Invoice date | empty |
| 7 | Company or customer name | empty, or only spaces (a contact name alone does not count) |
| 8 | Customer address | empty, or only spaces |
| 9 | An item with a description and a quantity | no line has both a description and a quantity above 0 |
| 10 | Description for item N | a line counts toward the total (quantity above 0 and a price) but has no description |
| 11 | Quantity / Unit price / Line discount for item N, Overall discount | the value is not a number the totals can read (S4) |

The check does not cover the UEN, phone, email, logo, contact name, customer email, due date,
unit, payment details or notes. A unit price of 0.00 is allowed, for an item given free.

---

## 4. Edge cases

| Edge | Recommended behaviour | Status |
|---|---|---|
| Zero-quantity line | Left off the preview and PDF, and out of the totals. It stays in the form and in the invoice file. The hint "Items with no quantity are left off the invoice." shows under it. The blank line a new invoice starts with gets no hint | Covered (calc `included`) |
| Every line has zero quantity | Totals 0.00. With GST on, "An item with a description and a quantity" is listed | Covered |
| No items at all, GST off | The PDF downloads with an empty item table and 0.00 totals | Covered |
| Negative quantity or price | Not a number the totals accept (`-` is rejected): inline error, and S4 applies | Covered |
| Quote file, prices include GST | B5 | Covered |
| Quote file, version 1 | Opens with prices excluding GST | Covered |
| Quote file, version 3 or later, or over 3 MB | Bad-file message, nothing changes | Covered |
| Quote file with no items | Opens with one blank line | Covered |
| Quote file with the default quote notes | Notes left empty (S3) | Covered |
| Due date before the invoice date | Inline note, and the download still works (S5) | Covered |
| Invoice date empty | GST on: listed. GST off: prints no date. The suggested number uses today's date | Covered |
| New invoice | S2 | Covered |
| Opening a file over unsaved work | S1 | Covered |
| File picker cancelled | Nothing changes | Covered |
| Two tabs with Remember on | The last write wins. Unticking in one tab deletes the stored details for both | Out of scope: accepted as is |
| Download clicked twice quickly | The button is disabled while the PDF is made, so one file is made | Covered |
| 200 items (the maximum) | "Add item" is replaced by "You can add up to 200 items to one invoice." | Covered |
| 40 lines, and a 1,000-character description | AC8 | Covered |
| Very large amounts | A line total of 9,999,999.99 fits its column on the PDF. Larger figures are out of scope for a small-business invoice | Partly: tested at 9,999,999.99 |
| Characters the PDF cannot print | The quote builder's notice lists them, and the PDF leaves them out (N3) | Covered |
| Logo over 1 MB, or not PNG, JPG or SVG | "Please use a logo under 1 MB." / the "image could not be read" message, and the logo is unchanged | Covered |
| Storage blocked | AC9 | Covered |
| Remembered quote builder details | Not read. The invoice builder has its own storage key | Out of scope |
| GST toggled off after a registration number is typed | Kept, but neither shown nor printed (N2) | Covered |
| The rate changes after build day | The field is editable, and the rate helper tells the visitor to check | Covered |
| Late or part payments, deposits, credit notes, rounding to 5 cents | Out of scope (spec:65, spec:67) | Out of scope |
| A second invoice in the same session | The number goes up by one (S2). Across reloads, the visitor numbers their own invoices | Partly: S2 |

---

## 5. Copy the build needs that §5.2 doesn't give

Kept to the minimum. Strings marked "reuse" are the quote builder's (`copy.js`) with "quote"
changed to "invoice" where it appears. All are sentence case, second person, with no
exclamation marks and no claim of IRAS compliance.

**Form**
- Line and overall discount options (reuse): "No discount", "Percentage off", "Amount off";
  value labels "Discount (%)", "Discount (SGD)"
- Item heading and controls (reuse): "Item {n}", "Move item {n} up", "Move item {n} down",
  "Remove item {n}", "Line total"; unit placeholder "hours, pcs, m²"
- Payment details field label: "Payment details". Notes field label: "Notes"
- Logo (reuse): "Add your logo", "PNG, JPG or SVG, under 1 MB. It stays in your browser.",
  "Remove logo", "Your logo", "That image could not be read. Try a PNG or JPG."
- Blocked storage (reuse): "This browser is not letting the page store anything, so your
  details will not be remembered."
- Limit: "You can add up to 200 items to one invoice."
- Number errors (reuse): "Use a number, like 120 or 120.50.", "Use a percentage from 0 to 100."
- Characters that won't print (reuse): "Some characters can't go into the PDF, so they will be
  left out: {chars}"
- PDF state (reuse): "Making your PDF", "The PDF could not be made. Try again, or refresh the page."
- Toasts: "Invoice opened", "Quote opened"
- Due date note: "The due date is before the invoice date."
- Quote prices included GST: "This quote's prices included GST. The invoice adds GST on top of
  each price, so check the prices before you send it."
- Missing-field names: "Business name", "Business address", "GST registration number",
  "GST rate", "Invoice number", "Invoice date", "Company or customer name", "Customer address",
  "An item with a description and a quantity", "Description for item {n}",
  "Quantity for item {n}", "Unit price for item {n}", "Line discount for item {n}",
  "Overall discount"
- New invoice dialog: title "Start a new invoice"; body "Your business and payment details
  stay. The customer, items and notes are cleared."; buttons "Keep editing", "Start a new invoice"
- Opening over unsaved work: title "Replace this invoice?"; body for a quote file "The
  customer, items and notes on the page will be replaced. Your business details stay."; body
  for an invoice file "Everything on the page will be replaced by the saved invoice."; buttons
  "Keep editing", "Replace it"
- View switch (reuse): "Invoice builder view", "Edit", "Preview"; preview region "Invoice preview"

**PDF**
- Titles: "Tax invoice" (GST on), "Invoice" (GST off)
- "Invoice no.", "Invoice date", "Due date", "Bill to", "UEN", "GST reg. no.", "Tel", "Email"
- Columns (reuse): "#", "Description", "Qty", "Unit", "Unit price", "Discount", "Amount"
- "All amounts in SGD"
- Totals: the §5.2 labels, with "GST ({rate}%)" for the GST line
- "Payment details", "Notes", "Page {n} of {of}"
- No "Made with" line (spec:69)
