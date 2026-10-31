# Spec: APP-005 Invoice builder

The spec is the PRD `jurasolutions/prd/pending/apps/prd-app-005-invoice-builder-2026-10-31.md`,
approved by Ting Yu in #approvals as approval A-0002 (gate G2). That folder is outside this
repo, so the approved text is reproduced below as handed over in Discord Dispatch task T-0001,
for the crew to read. This is a reading copy, not the PRD: the PRD file itself is not created,
moved or edited here. Where the PRD's §7 says "do not start building", approval A-0002 is the
sign-off it asks for.

Terms are in `CONTEXT.md` under "Invoice builder (APP-005)".

The approved text runs from the line after "BEGIN" to the line before "END" (SHA-256
e97afb6121243b3fe90b2f53f4ebb78cb779199f6be6b8aac33c443293fb10de, checked when this file was
written).

----- BEGIN APPROVED PRD A-0002 -----
# PRD — APP-005 Invoice builder

*Domain: `jurasolutions/` | Created: 2026-10-31 | Author: app factory (for Ting Yu)*
*Status: **PENDING SIGN-OFF** | Tier: browser | Category: Finance*
*Follows: `prd/pending/prd-jura-app-factory-2026-10-24.md` (toolbox shell, limiter, conventions).*
*To build: approve its app-build request in #approvals (prd/pending/apps/prd-app-005-invoice-builder-2026-10-31.md)*

---

## 1. Problem

- **One line (also the page subtitle):** Make a clean invoice with your logo and download it as a PDF, with or without GST.
- **Who has this problem:** owners and admin staff at small businesses who bill customers from a Word or Excel file, retype the details from the quote, and check by hand that a GST invoice has everything it needs.
- **Why it helps Jura:** suits field service and maintenance, renovation and interior design, events, logistics, wholesale and small professional firms. The custom version Jura would build raises the invoice from a finished job or an accepted quote, numbers it, sends it, and matches the payment back in the client's accounting software.

## 2. Success criteria

- [ ] Totals are correct for: no discount; line discount by %; line discount by amount; overall discount; GST on and off. Unit tests cover each, reusing the quote builder's `calc` module.
- [ ] A GST amount that lands on exactly half a cent rounds up, and the invoice's GST, amount before GST and amount with GST always add up. Unit tests cover this.
- [ ] No floating-point artefacts (such as 0.30000000000000004) in any displayed amount.
- [ ] With GST on, the PDF states "Tax invoice" prominently and shows every item in the IRAS list in §4. With GST off, the PDF states "Invoice" and shows no GST registration number, rate or GST line.
- [ ] With GST on, "Download PDF" lists each missing required field and creates no file until they are filled in. Unit tests cover each field.
- [ ] A file saved from the quote builder opens here with the customer, items, discounts, notes and GST setting filled in, and a bad file shows the error message and changes nothing.
- [ ] A saved invoice file re-opens to an identical invoice.
- [ ] The PDF opens in Chrome, Safari and Acrobat, fits A4, and paginates cleanly at 40 lines, with the totals kept together.
- [ ] Business details persist after reload only when "Remember" is ticked, and the tool works when browser storage is blocked.
- [ ] Works at 360 px wide and on desktop; 44 px tap targets
- [ ] Keyboard usable; every input labelled; contrast passes the design system's tokens
- [ ] All copy passes `jura-growth check`
- [ ] Talk-to-us card links to the enquiry form with `?from=apps/invoice-builder`
- [ ] Usage counter increments on open and on completion

## 3. Scope

### In scope
- Business details: name, address, UEN (optional), phone, email, logo (PNG, JPG or SVG up to 1 MB, kept in the browser).
- Customer: company, contact name, address, email.
- Invoice number suggested as `INV-YYYYMMDD-01` and editable; invoice date; due date (optional).
- Line items: description (multi-line), quantity, unit (free text), unit price, optional line discount (amount or %); add, remove, reorder.
- Subtotal, optional overall discount, optional GST, total, in SGD to 2 decimal places.
- GST toggle (off by default). One rate per invoice, defaulting to the IRAS rate in §4 and editable. A GST registration number field appears and prints when GST is on.
- Required-field check when GST is on, covering the IRAS list in §4.
- Payment details as free text the visitor types (bank, account, PayNow UEN or mobile), and notes.
- Open a file saved from the quote builder to start an invoice from that quote.
- A4 PDF made in the browser with the visitor's logo and name.
- Save the invoice as a file and open it again later; "New invoice" keeps business details.

### Out of scope
- Storing invoices or a number sequence on Jura's servers, accounts, sending email, reminders or payment tracking.
- A PayNow QR on the PDF. The format has its own backlog row and its own official source to confirm.
- Simplified tax invoices, GST-inclusive pricing, mixed rates on one invoice, zero-rated or exempt lines, rounding the bill to 5 cents, credit notes, deposits and part payments.
- Other currencies, recurring invoices, connections to accounting software, tax advice.
- A Jura footer line on the PDF.

## 4. Constraints

- **Official sources:** checked 2026-10-31.
  - GST rate: "The current GST rate in Singapore is 9%." https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/current-gst-rates
  - Tax invoice contents and rounding: https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/invoicing-price-display-and-record-keeping/invoicing-customers. The page requires the words "Tax invoice" in a prominent place; the supplier's name, address and GST registration number; the invoice date and identifying number; the customer's name and address; a description of the goods or services; the GST rate; and the amounts excluding GST, the GST amount and the amount including GST. It allows the total GST to be rounded to the nearest cent, applied consistently.
  - Confirm both pages again on build day and record the URLs and date in a code comment beside the default rate.
- **Privacy:** everything the visitor enters, including the logo, stays in your browser. Only the anonymous open and download counters are recorded.
- **Tier rules:** browser tools make no server calls. AI tools use the shared limiter, Turnstile, `claude-haiku-5-5`, and store nothing uploaded.
- Design system only; the visitor's branding on anything they export, not Jura's.
- **Money maths:** integer cents throughout, rounding half up at each line total and once on the total GST. Import `calc` from `src/apps/quote-builder/`; don't copy it or import from the internal invoice system.
- GST is worked out on the subtotal after discounts.
- The tool produces the visitor's own business document. It carries no government name, crest or mark, and it never says the document meets IRAS rules. The visitor stays responsible for what they issue.
- With GST off the document is titled "Invoice" and never "Tax invoice".

## 5. Proposed plan

### 5.1 User flow
1. Visitor opens `/apps/invoice-builder`: form on the left, live preview on the right (stacked on mobile with a "Preview" toggle).
2. Enters business details once, optionally remembered on this device, or opens a saved quote file to fill in the customer and items.
3. Adds the customer, items, payment details and notes, and switches GST on if the business is registered.
4. Clicks "Download PDF". With GST on, any missing required field is listed and linked to its input.
5. Downloads the PDF, saves the invoice file, or starts a new invoice.
6. Below the tool, the talk-to-us card.

### 5.2 Copy
- Title: "Invoice builder"
- Subtitle: "Make a clean invoice with your logo and download it as a PDF, with or without GST."
- Privacy note: "Everything you type stays in your browser. Nothing is sent to us."
- Remember toggle: "Remember my business details on this device"
- Section headings: "Your business", "Your customer", "Invoice details", "Items", "Payment details", "Notes"
- Labels: "Business name", "Address", "UEN (optional)", "Phone", "Email", "Logo", "Company or customer name", "Contact name", "Customer address", "Customer email", "Invoice number", "Invoice date", "Due date (optional)", "Description", "Quantity", "Unit", "Unit price", "Line discount", "Overall discount", "Charge GST", "GST rate (%)", "GST registration number"
- Totals: "Subtotal", "Discount", "Amount before GST", "GST", "Amount with GST", "Total"
- Empty items: "Add your first item to see the total."
- Zero quantity hint: "Items with no quantity are left off the invoice."
- GST helper: "Only switch this on if your business is GST-registered. Your invoice will then be titled Tax invoice."
- GST rate helper: "Set to the current rate on the IRAS website. Please check the figures before you send your invoice."
- Payment helper: "Tell your customer how to pay you, such as your bank account or PayNow details."
- Missing fields heading: "A few details are still needed for a tax invoice"
- Missing field: "Please add: {field}"
- Buttons: "Add item", "Download PDF", "Save invoice file", "Open invoice file", "Open quote file", "New invoice"
- Bad file: "That file doesn't look like one saved from our quote or invoice builder."
- Logo too big: "Please use a logo under 1 MB."
- Talk-to-us card: heading "Invoices raised from the work you've done"; body "We can connect your invoicing to your quotes, jobs and accounts, so each detail is typed one time."; button "Tell us how you invoice today"

### 5.3 Technical
- **Folder:** `src/apps/invoice-builder/` (`InvoiceForm`, `InvoicePreview`, `required`, `pdf`, `invoiceFile`, tests). Shares `calc` and the quote file reader with `src/apps/quote-builder/`.
- **Registry entry:** `{ slug: "invoice-builder", name: "Invoice builder", description: "Clean PDF invoices with your logo, with or without GST.", category: "Finance", industries: ["general", "logistics", "professional-services"], tier: "browser", status: "live", added: "<deploy date>", prd: "APP-005" }`
- **Dependencies:** the PDF library the quote builder already uses, lazy-loaded in this tool's chunk. No new dependencies and no server calls beyond the shared usage counter.
- **State:** React state; `localStorage` for business details only, wrapped in try/catch.

### 5.4 Done-check
Run the unit tests, open the local dev server, build a 5-line invoice with GST on and the same invoice with GST off, open a saved quote file, download both PDFs, and show Ting Yu the page and the PDFs beside the IRAS list in §4. Deploy only after his go-ahead.

## 6. Open questions

None.

## 7. Sign-off

**Do not start building. This PRD requires explicit sign-off before any code is written.**

To proceed: approve its app-build request in #approvals. Approving hands this PRD to a builder,
who builds it on its own branch from `main` with a preview. Going live is a second approval, of
the exact commit. Once released, this file moves to `prd/done/apps/` with the ship date and both
approvals recorded.

Signed off by: ________________  Date: ____________
----- END APPROVED PRD A-0002 -----
