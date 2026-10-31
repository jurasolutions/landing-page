# Technical review: APP-005 Invoice builder

Spec: `.scratch/invoice-builder/spec.md` (reading copy of PRD A-0002, approved). Terms: `CONTEXT.md`,
"Invoice builder (APP-005)".
Reviewed on branch `claude/T-0001-invoice-builde` at a087f61. Baseline:
`npx vitest run --cache=false src/apps/quote-builder tests/shell.test.js tests/ui.test.js tests/usage.test.js`
gives 9 files, 210 tests, all passing.

Verdict: the design is sound. The quote builder was written to be reused ("Written to be reused by
the invoice builder when it comes", `calc.js`), and almost everything the invoice needs is a pure
module that can be imported as it is. Three small prefactors in `src/apps/quote-builder/` make the
reuse clean, each with no change in behaviour. One case the PRD does not cover (a quote saved with
prices that include GST) needs a decision; it comes back as a question with a recommended answer.
A second point (an empty business name printing "Jura Solutions") is a real defect if the quote
builder's helper is reused as is, and the fix is below.

## 1. Seams and module shape

The ideal number of new seams is one. This feature adds one module family under a folder that
already has a seam for each kind of test, so every behaviour in the PRD can be tested without a
browser, the same way the quote builder is.

| What is tested | Seam (interface) | Test file | How |
|---|---|---|---|
| Money maths | `quoteTotals(invoice)` from `quote-builder/calc.js`, already covered by `calc.test.js` | `invoice-builder/invoice.test.js` | Invoice-shaped inputs for each PRD case: no discount, line %, line amount, overall, GST on and off, the half-cent GST, `taxable + gst === total` |
| Which totals rows show | `invoiceTotalsRows(invoice, totals, copy)` (new, pure) | `invoice-builder/totals-rows.test.js` | Table of GST on/off by discount/no discount, the same pattern as `quote-builder/totals-rows.test.js` |
| Required fields | `missingFields(invoice, totals)` (new, pure) in `required.js` | `invoice-builder/required.test.js` | `it.each` over the field list: blank one field of a complete tax invoice, expect exactly that field |
| Invoice file round trip, quote file mapping | `serialiseInvoice` / `parseInvoiceFile` / `invoiceFromQuote` in `invoiceFile.js` | `invoice-builder/invoice.test.js` | Round trip to an identical invoice; real `serialiseQuote` output in, invoice out; bad files refused |
| The PDF | `buildInvoicePdf(invoice, totals, copy, { logo })` returning `{ bytes, ops, pageCount }`, the same contract as `buildQuotePdf` | `invoice-builder/pdf.test.js` | Assert on `ops` (text, page, position), load with pdf-lib and pdf.js, as `quote.test.js` does |
| Form labels, links from the missing-field list | `InvoiceForm`, `InvoiceBuilder` through `renderToStaticMarkup` | `tests/ui.test.js` (new `describe` blocks) | `tagWithId`, `describedBy` helpers already there |
| Registry, folder, route head | `validateRegistry`, folder check, `withMeta` | `tests/shell.test.js` (no change needed) | The existing "every registered tool has a folder" test covers the new entry |

### Module shape for `src/apps/invoice-builder/`

Every module is deep where it can be: a small interface over the rules, and the page modules are
thin callers.

| File | Interface | Notes |
|---|---|---|
| `copy.js` | default export: every word, including the PDF's | Loaded eagerly by `loaders.js`, so keep it to strings and tiny functions. PRD §5.2 words verbatim; the PDF labels below are new copy and need the voice check |
| `model.js` | `newInvoice({ business, gst, today })`, `effectiveInvoice(invoice, suggested)`, `suggestNumber(date, previous)`, `DEFAULT_GST_RATE`, `INVOICE_LIMITS` | Re-exports `DEFAULT_GST_RATE` from the quote model, with the build-day IRAS comment and URLs (PRD §4 asks for the check to be recorded beside the default) |
| `totals-rows.js` | `invoiceTotalsRows(invoice, totals, copy) -> { rows, final }` | Pure. Unlike the quote's, it returns the final line too, so the preview and the PDF cannot disagree about "Total" versus "Amount with GST" |
| `required.js` | `missingFields(invoice, totals) -> [{ key, label, target }]` | Pure. `target` is the id of the input to focus |
| `invoiceFile.js` | `serialiseInvoice`, `parseInvoiceFile`, `invoiceFromQuote`, `openAnyFile(contents)` | Validation is built from the quote file's exported field readers (prefactor P1) |
| `pdf.js` | `buildInvoicePdf(invoice, totals, copy, { logo })` | Lazy-loaded with pdf-lib. Its own layout, using `wrapText` (prefactor P2), `fitLogo`, `A4`, `toPrintable` |
| `InvoiceForm.jsx`, `InvoicePreview.jsx`, `index.jsx` | the page | Form parts from prefactor P3 |
| `invoice-builder.css` | `ib-` classes for what is new only | Layout reuses the quote builder's `qb-` classes (see decision D9) |

## 2. Question 1: what to import from the quote builder, and the prefactors

Import directly, unchanged:

| From | What | Why |
|---|---|---|
| `quote-builder/calc.js` | `quoteTotals`, `formatCents`, `formatPercent`, `formatQuantity`, `parseCents`, `parseQuantity`, `parsePercent`, `normaliseMoneyInput` | PRD §4: import `calc`, never copy it. `quoteTotals` with `gst.inclusive` absent is exactly the exclusive invoice maths: half up at each line, once on GST, on the amount after discount |
| `quote-builder/model.js` | `LIMITS`, `DEFAULT_GST_RATE`, `isoDate`, `displayDate`, `emptyItem`, `emptyBusiness`, `newItemId`, `nextNumber`, `readGst` | Pass the invoice copy's `months` to `displayDate`. `readGst` is used for the remembered setting; the invoice drops its `inclusive` |
| `quote-builder/quoteFile.js` | `parseQuoteFile`, `readBusiness`, `LOGO_MAX_BYTES`, plus the readers exported by P1 | |
| `quote-builder/logo.js` | `readLogo`, `logoForPdf`, `rasteriseLogo` | pdf-lib free, safe to import from `index.jsx` |
| `quote-builder/winansi.js` | `toPrintable`, `unprintableIn` | The same "will not print" warning as the quote |
| `quote-builder/pdf-geometry.js` | `A4`, `fitLogo` | pdf-lib free |
| `_shared/` | `storage.js`, `download.js` (`saveBlob`, `safeFilename`), `usage.js`, `ExportButtons.jsx`, `focus.js`, `useToast.js`, `controls.js` | As every tool does |

Do not import: `effectiveQuote` and `DEFAULT_BUSINESS_NAME` (see D4), `totals-rows.js` (its rows
are the quote's, with the "GST added at the rate shown" statement and the before-GST row only with
a discount), `pdf.js` (pulls the whole quote PDF into the invoice's chunk), `QuoteForm`'s default
layout, `draft.js` and `AiDraft.jsx` (the invoice is browser tier: no AI, no server calls).

Prefactors, one ticket (01), each with no change in behaviour, proved by the existing quote tests
passing untouched:

- **P1. Export the quote file's field readers.** `readQuote` in `quoteFile.js` is private, and so
  are `text`, `date`, `oneOf` and `logo`. Split `readQuote` into exported section readers
  (`readBusinessFields(raw)`, `readCustomer(raw)`, `readItems(raw)`, `readOverallDiscount(raw)`)
  plus the `BadFile` error and the `text` and `date` helpers, and have `readQuote` compose them.
  The invoice file then validates with the same rules and limits (logo data URL, sizes, lengths)
  without copying them. Guarded by "re-opens to an identical quote" and the seven "refuses" cases
  in `quote.test.js`.
- **P2. Move `wrapText` to a pdf-lib-free module** `quote-builder/pdf-text.js`, re-exported from
  `pdf.js` so nothing that imports it today changes. The invoice PDF uses it without bundling the
  quote's PDF builder into its own chunk.
- **P3. Export the form parts.** Move `TextField`, `NumberField`, `Fieldset`, `ItemEditor` and
  `errorText` out of `QuoteForm.jsx` into `quote-builder/form-parts.jsx`, imported back by
  `QuoteForm.jsx`. The markup is identical, which `tests/ui.test.js` (labels, `aria-describedby`,
  tap targets) proves. `ItemEditor` reads `copy.items.*` and `copy.errors.*`; the invoice copy
  supplies the same keys. Without P3 the invoice would copy about 170 lines of labelled,
  accessible field code, which is where accessibility fixes would then drift.

Not a prefactor, on purpose: the items table and pagination inside `buildQuotePdf`. A shared
"document PDF" writer would be the deeper module, but the quote PDF has quote-only branches (the
inclusive split and statement, "Made with", "Valid until") and is live. Extracting it now widens the
blast radius into a shipped tool for a small gain. The invoice PDF copies the table loop (about
110 lines) and ports the quote's pagination tests, so both are pinned. Record this as an
architecture-survey candidate once the PDF layout has settled in both tools.

## 3. Question 2: quote file to invoice

`invoiceFromQuote(quote, current)` is pure and lives in `invoiceFile.js`. It takes the result of
`parseQuoteFile` (so the invoice accepts exactly the quote versions the quote builder accepts,
today 1 and 2) and the invoice on screen.

| Invoice field | Taken from | Rule |
|---|---|---|
| `business` | the page | Kept (glossary: "The business details on the page are kept") |
| `customer` | quote | All four fields |
| `items` | quote | Description, quantity, unit, unit price, discount type and value; fresh ids |
| `overallDiscount` | quote | As saved |
| `notes` | quote | As saved, except the quote builder's own default ("This quote is valid until the date shown above…"), which is dropped to the invoice default (empty) so an invoice never says "this quote" |
| `gst.on`, `gst.rate` | quote | As saved |
| `gst.regNo` | the page, or the quote | The page's number when it has one, otherwise the quote's (the quote builder keeps it with GST) |
| `details.number`, `details.date`, `details.dueDate` | the page | Not taken: an invoice's number and date are its own. The number stays the suggestion |
| `payment` | the page | The quote has none |
| `madeWith`, `validUntil`, `gst.inclusive` | dropped | The invoice has no "Made with" line (PRD out of scope) and no inclusive mode |

**A version 2 quote with prices that include GST.** GST-inclusive pricing is out of scope for
invoices (PRD §3), and the PRD does not say what happens when such a quote is opened. The options:

1. Refuse the file. Safe, but the file is ours and the visitor loses the customer and items, and
   the bad-file message would be untrue.
2. Convert each unit price to its before-GST amount. The invoice's total would differ from the
   quote's by rounding cents, and it prints figures the visitor never typed.
3. Open it with GST on and prices as typed, silently. The invoice charges GST twice. Never this.
4. **Recommended:** open it with prices as typed and GST on, and show a warning that stays in the
   page's live region until the next file is opened or a new invoice is started: "This quote's
   prices include GST. Your invoice adds GST on top, so change each unit price to the amount
   before GST." The visitor stays in control, the preview shows the higher total at once, and no
   figure is invented. `invoiceFromQuote` returns `{ invoice, pricesIncludedGst: true }` so the
   page can show it, and a unit test pins it. This adds one line of copy that is not in PRD §5.2,
   so it is listed as question Q1.

Whatever the answer, the invoice model never carries `inclusive`, so `quoteTotals` always works out
GST on top. A test passes a mapped inclusive quote to `quoteTotals` and asserts
`totals.inclusive === false`.

## 4. Question 3: invoice model, file format and round trip

```js
{
  business: { name, address, uen, phone, email, logo },     // as the quote
  customer: { company, contact, address, email },          // as the quote
  details:  { number, date, dueDate },                     // dueDate optional, "" when blank
  items:    [{ id, description, quantity, unit, unitPrice, discountType, discountValue }],
  overallDiscount: { type, value },
  gst:      { on, rate, regNo },                           // no inclusive
  payment:  "",                                            // free text
  notes:    "",
}
```

Every value is the string the visitor typed, as in the quote model, so a file re-opens to exactly
what was on screen. `INVOICE_LIMITS` spreads the quote's `LIMITS` and adds `payment: 1000`.

The invoice file (ADR draft 0005 below):

```json
{ "format": "jura-invoice-builder", "version": 1, "savedAt": "...", "invoice": { ... } }
```

- Written by "Save invoice file" as `<number>.invoice.json` (`safeFilename(number, "invoice")`), from
  the effective invoice so the suggested number is saved.
- Read by `parseInvoiceFile`: format must match, version an integer from 1 to `FILE_VERSION`, every
  field checked with P1's readers, unknown fields dropped, `gst.on` only when exactly `true`.
- Files over 3 MB are refused before parsing, as the quote does.
- **Both "Open" buttons accept both kinds.** `openAnyFile(contents)` tries the invoice format, then
  the quote format, and returns `{ ok, kind, invoice, pricesIncludedGst }`. A quote file picked
  through "Open invoice file" still starts an invoice from the quote, and anything else shows the
  PRD's message "That file doesn't look like one saved from our quote or invoice builder." and
  changes nothing.
- **Round trip identity test:** a complete invoice with a logo, every discount kind, GST on, a due
  date, payment and notes: `parseInvoiceFile(serialiseInvoice(x))` equals `x` with item ids
  removed, its totals are equal, and the two PDFs' `ops` text is equal.

## 5. Question 4: required fields and how errors link to inputs

Checked only while GST is on, against the effective invoice (what prints), in this order, which is
the order of the form:

| Key | PRD §5.2 label in "Please add: {field}" | Input id it links to | Missing when |
|---|---|---|---|
| `businessName` | Business name | `ib-business-name` | blank after trim |
| `businessAddress` | Address | `ib-business-address` | blank |
| `gstRegNo` | GST registration number | `ib-gst-reg` | blank |
| `customerName` | Company or customer name | `ib-customer-company` | blank |
| `customerAddress` | Customer address | `ib-customer-address` | blank |
| `number` | Invoice number | `ib-number` | blank after the suggestion is applied (only when the date is also blank) |
| `date` | Invoice date | `ib-date` | blank or not `YYYY-MM-DD` |
| `items` | Description | the first item's description, `qb-item-<id>-description`, or "Add item" when there are none | no included line has a description |

This matches the IRAS list in PRD §4 and the glossary's "Required fields". The GST rate and the
three amounts are always printed by the PDF once GST is on, so they are not fields to fill in.

Recommended extension within the IRAS wording ("a description of the goods or services"): an
included line that has a price and a quantity but no description is also listed, linked to that
line's description, because it would print as a charge with no description. It uses the same
"Please add: Description" wording.

How the errors link: "Download PDF" with GST on calls `missingFields`. When the list is not empty,
no file is made, and an error summary appears in the actions' live region: the PRD heading "A few
details are still needed for a tax invoice", then one link per field, `<a href="#ib-business-name">`.
Focus moves to the heading (made focusable with `tabIndex={-1}`) so a screen reader hears it.
Following a link switches a phone to the Edit view first, then focuses the input. The summary
updates as fields are filled and goes away when the list is empty or GST is switched off. The
`ui.test.js` check: render `InvoiceForm` with GST on, and assert every `target` from `missingFields`
on an empty invoice is an id present in the markup, so a renamed input cannot break a link quietly.

## 6. Question 5: the PDF

- **Title:** `copy.pdf.title(gstOn)`: "Tax invoice" with GST on, "Invoice" with GST off, drawn where
  the quote draws "Quotation" (20 pt bold, top right, first page). Also the PDF's metadata title.
  Never anything else (glossary).
- **IRAS rows, GST on:** business name, address and "GST reg. no." under the logo; "Invoice no.",
  "Date" and, when set, "Due date" on the right; "Bill to" with the customer's name, contact and
  address; the items table with descriptions; then totals with "Amount before GST", "GST (9%)" and
  "Amount with GST". **GST off:** no registration number, no rate, no GST row (PRD §2).
- After the totals: "Payment details" (when filled), then "Notes" (when filled), both wrapped.
- No "Made with" line and no Jura name in the metadata: creator and producer are "pdf-lib" (PRD
  out of scope: "A Jura footer line on the PDF"). Page numbers stay.
- **Pagination:** the quote's rules, kept: rows move to the next page whole, column headings repeat,
  only a row taller than a page splits. The totals block, including the final line, is measured
  first and moves to a new page whole if it does not fit. Payment details and notes follow and may
  flow.
- **Tests, in `invoice-builder/pdf.test.js`, ported from `quote.test.js`:** a 5-line tax invoice on
  one A4 page whose `ops` contain "Tax invoice", "GST (9%)", the registration number and the three
  amounts; the same invoice with GST off has "Invoice", and no op matches `/GST|tax invoice/i` or the
  registration number; 40 lines paginate (page count, every op inside the margins, headings on each
  page, no row on two pages, rows numbered 1 to 40); for 30 to 47 two-line rows, every op tagged
  `kind: "total"` is on one page; a very long description does not run off the bottom; no op
  contains "jura" and the metadata does not name Jura; pdf.js reads the 40-line file and finds
  "Tax invoice" on page 1 and "Amount with GST" on the last page.

## 7. Question 6: totals rows

`invoiceTotalsRows` decides every row, and the preview and the PDF only loop over it.

| Case | Rows, in order | Final line (bold) |
|---|---|---|
| GST off, no discount | (none) | Total |
| GST off, discount | Subtotal, Discount | Total |
| GST on, no discount | Amount before GST, GST (9%) | Amount with GST |
| GST on, discount | Subtotal, Discount, Amount before GST, GST (9%) | Amount with GST |

Subtotal and Discount show only with a discount, because without one the subtotal is the same
figure as the line below it. With GST on, "Amount before GST" always shows, because IRAS asks for
the amount excluding GST whether or not there is a discount (the quote shows it only with a
discount, which is why the quote's module is not reused). The rate prints with `formatPercent`, so
8.5% shows as "GST (8.5%)". "All amounts in SGD" stays above the items table. Tests: the four cases
above, plus a test that the preview and the PDF show the same rows, the quote's
"the preview and the PDF agree" pattern.

## 8. Question 7: number, storage, usage counter, chunk

- **Suggested number:** `suggestNumber(date, previous)` returns `INV-YYYYMMDD-01` from the invoice
  date, or `nextNumber(previous)` when `previous` is a number of the same date (`-01` becomes `-02`
  after "New invoice"). Blank or malformed date: empty. The form shows it as the number field's
  placeholder, and `effectiveInvoice` uses it while the field is empty, as the quote does. It
  follows the invoice date as the date changes.
- **Storage:** `jura.invoice-builder.business.v1` in localStorage, written only while "Remember" is
  ticked and removed when it is unticked, through `_shared/storage.js`, so blocked storage changes
  nothing but the note. It holds `{ business, gst: { on, rate, regNo }, lastNumber }`, read back
  with `readBusiness`, `readGst` (its `inclusive` dropped) and a length-checked `lastNumber`. A large
  logo that fills the quota falls back to the words, as the quote does. The invoice does not read
  the quote builder's key: "Remember" was agreed per tool.
- **Usage counter:** `open` is already counted by `AppShell`. The tool calls
  `trackUsage(app.slug, "complete")` once per PDF downloaded, and not for a saved file or a blocked
  download. The usage Function counts only `live` registry entries in production (`server/drafts.js`).
- **Lazy pdf-lib:** `const loadPdf = () => import("./pdf.js")`, warmed on idle, as the quote does.
  Nothing `index.jsx` imports statically may import pdf-lib (P2 keeps `wrapText` out of the quote's
  `pdf.js`). Check: after `npm run build`, pdf-lib appears only in the lazy chunks, never in
  `index-*.js` or the invoice's own tool chunk.
- **Registry:** the PRD's entry with `status: "live"` and `added` set to the build date, then
  corrected by the release persona to the deploy date at G4. A push to `main` is the deploy, so
  `live` on the feature branch exposes nothing.

## 9. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Import from `quote-builder/` directly; do not move modules to `_shared/` | One consumer more does not justify a wide move; the README's "one folder" rule holds |
| D2 | Three behaviour-neutral prefactors P1 to P3, in ticket 01 | Avoids copying validation and accessible field code; guarded by existing tests |
| D3 | The invoice PDF is its own module and copies the table loop | Keeps the live quote PDF untouched; pinned by ported tests; survey candidate later |
| D4 | No "Jura Solutions" fallback for an empty business name | The quote prints `DEFAULT_BUSINESS_NAME` when the name is blank. On an invoice that would put Jura's name as the supplier on the visitor's tax invoice. The invoice leaves the name blank (required with GST on) and the field has no Jura placeholder |
| D5 | Invoice file `jura-invoice-builder` version 1, own reader | ADR draft below |
| D6 | Both Open buttons accept both file kinds | Forgiving, and the PRD's bad-file message already names both |
| D7 | An inclusive quote opens with a warning, prices as typed | See Q1 |
| D8 | Remember keeps the GST registration (on, rate, number) with the business | A registered business is always registered. If the PRD's "business details only" is read strictly, drop `on` and `rate` and keep the number |
| D9 | Reuse `quote-builder.css` (`qb-` layout classes) and add `invoice-builder.css` for new parts only | The form parts from P3 carry `qb-` classes; a second copy of 419 lines of CSS would drift |

### ADR draft 0005: the invoice file is its own format, version 1

To be written to `docs/adr/0005-invoice-file-is-its-own-format.md` by ticket 03.

- **Context.** "Save invoice file" writes JSON that visitors keep on their machines, so its shape is
  hard to reverse. The quote file (`jura-quote-builder`, version 2, ADR 0004) is close but not the
  same: an invoice has a due date and payment details, has no validity date, "Made with" or
  inclusive mode, and its title depends on GST.
- **Decision.** `{ format: "jura-invoice-builder", version: 1, savedAt, invoice }`. The reader
  accepts versions 1 to its own and refuses anything newer, following ADR 0004: the version rises
  when a new field can change a printed figure. Field validation is shared with the quote file
  through the readers exported in prefactor P1.
- **Consequences.** The quote builder cannot open an invoice file, and that is right. A change to
  the quote's field readers changes the invoice's too, which the invoice's round-trip and refusal
  tests catch.
- **Rejected.** Reusing the quote file format with a `kind` field: it would make every quote change
  an invoice change, and an older quote builder would open an invoice as a quote.

## 10. Blast radius

| Area | Change |
|---|---|
| `src/apps/invoice-builder/` | New folder (all modules above, tests) |
| `src/apps/quote-builder/quoteFile.js` | P1: section readers exported, `readQuote` composes them |
| `src/apps/quote-builder/pdf-text.js`, `pdf.js` | P2: `wrapText` moved, re-exported |
| `src/apps/quote-builder/form-parts.jsx`, `QuoteForm.jsx` | P3: field parts moved, imported back |
| `src/apps/registry.json` | One entry |
| `tests/ui.test.js` | New blocks for the invoice form and page |
| `README.md` | "APP-005 Invoice builder" section; note on the quote modules the invoice depends on |
| `docs/adr/0005-…` | New ADR |
| `src/content.js` | Optional: the `/apps` meta description names quotes and PDFs; adding invoices is copy and needs the voice check |
| Not touched | `functions/`, `server/`, D1 schema and migrations, `src/design-system/`, `loaders.js`, `AppShell` |

No wide refactor: each prefactor touches one file and its new neighbour, so no expand–contract
sequencing is needed.

## 11. Risks

| Risk | Mitigation |
|---|---|
| A later quote change (calc, file readers, form parts) changes the invoice by accident | The invoice's own tests import the real quote modules; the README lists the dependency; a quote file version 3 must update `invoiceFromQuote`, pinned by the inclusive-quote test |
| A tax invoice missing an IRAS item, or "Tax invoice" printed with GST off | `missingFields` per-field tests; PDF tests for both titles and for no GST text with GST off |
| Claiming compliance, or a government mark | Copy never says the document meets IRAS rules; the copy and PDF labels go through the voice check by hand (`jura-growth check` is unavailable on this run) |
| Double GST from an inclusive quote | Q1 warning, and the model has no `inclusive` field |
| pdf-lib leaking into the main bundle | P2, and a build-output check by QA |
| Storage blocked or full | `_shared/storage.js` never throws; the logo-free fallback write |
| Rounding drift between preview and PDF | Both read `quoteTotals` and `invoiceTotalsRows` |
| A 200-line invoice is slow | The quote already builds the same sizes in the browser; no new risk |

## 12. Slicing: three tickets

| # | Ticket | Blocked by | Done when |
|---|---|---|---|
| 01 | **Prefactor: share the quote builder's file readers, text wrapping and form fields.** P1 to P3, no behaviour change | none | `npm test` passes with the quote tests unchanged; `npm run build` passes |
| 02 | **Invoice and tax invoice to PDF.** Registry entry, copy, model, suggested number, `invoiceTotalsRows`, `missingFields` with the linked error summary, form, preview, PDF with both titles and pagination, Remember, New invoice, usage `complete`, lazy chunk | 01 (P2, P3) | Totals, rows, required-field, PDF and ui tests above pass; a 5-line invoice downloads with GST on and off under `npm run dev` |
| 03 | **Save and open invoice files, and start one from a quote file.** `invoiceFile.js`, both Open buttons, quote mapping with the inclusive warning, bad-file message, round trip, ADR 0005, README section | 01 (P1), 02 (model and page) | Round-trip, mapping, inclusive and refusal tests pass; a saved quote file opens with customer, items, discounts, notes and GST filled in |

Each is a vertical slice that ends in something a visitor can use. Ticket 02 is the largest. If it
does not fit one context window, split it at the GST line: 02a "Invoice to PDF" (GST off: title
"Invoice", totals, form, preview, pagination, registry) and 02b "Tax invoice" (GST on: title,
IRAS rows, registration number, `missingFields` and the error summary), 02b blocked by 02a, and 03
blocked by 02a only.

## 13. Questions

- **Q1 (needs-human).** What happens when a quote saved with "Prices include GST" is opened?
  Recommended: open it with the prices as typed and GST on, and show "This quote's prices include
  GST. Your invoice adds GST on top, so change each unit price to the amount before GST." until the
  next file is opened or a new invoice is started. It adds one line of copy beyond PRD §5.2.
