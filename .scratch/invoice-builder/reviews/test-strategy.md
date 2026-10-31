# Test strategy: APP-005 Invoice builder

Spec: `.scratch/invoice-builder/spec.md`, the reading copy of approved PRD A-0002. Its §2 criteria are numbered
C1 to C14 here, in the order the PRD lists them. Terms are as in `CONTEXT.md` under "Invoice builder (APP-005)".

## Seams

`reviews/technical.md` does not exist yet, so this strategy uses the PRD §5.3 module split plus two small pure
seams it proposes (marked *proposed*). If the tech lead names different seams, the seam wins and this file is
updated; a disagreement about where a criterion can fail goes to the conductor as a question.

Vitest runs `environment: "node"`: there is no DOM, canvas or browser, and `tests/setup.js` fails any unstubbed
`fetch`. So the levels mean:

- **Unit**: a pure function in `src/apps/invoice-builder/` (or the shared quote-builder module it imports).
- **PDF**: `buildInvoicePdf(invoice, totals, copy, { logo })` in `pdf.js`, returning `{ bytes, ops, pageCount }`
  as `buildQuotePdf` does, so tests read every drawn text op with its page, x, y, size and row. The bytes are
  also reloaded with pdf-lib and parsed by pdf.js (the "second parser" check in `quote.test.js`).
- **Render**: `renderToStaticMarkup` of the tool, the form or the preview, as `tests/ui.test.js` and
  `pdf-merge-and-split/page.test.js` do. `window.localStorage` is stubbed per test with `vi.stubGlobal`.
- **Download step** (*proposed*): `download.js` exporting
  `downloadInvoice(invoice, { build, save, track })`, which runs the required-field check, and only when nothing
  is missing builds the PDF, saves it and calls `track("complete")` once. It returns `{ missing }` or `{ ok }`.
  The quote builder keeps this logic inside `index.jsx`, where nothing tests it; for the invoice it carries C5's
  "creates no file" and C14's "on completion", so it needs a seam a test can reach.
- **Remembered details** (*proposed*): `remember.js` with `loadBusiness()`, `saveBusiness(business)` and
  `forgetBusiness()`, built on `src/apps/_shared/storage.js`, under the key `jura.invoice-builder.business.v1`.
- **Function**: `onRequestPost` of the usage counter against the sql.js D1, as `tests/usage.test.js` does.
- **Manual**: a recorded check by a person, with what was done, on what, and what was seen. The agents cannot
  open a browser or a PDF viewer in their sandbox (`open` is blocked and no headless browser is installed), so
  every manual row is run by Ting Yu at the PRD §5.4 done-check, or by QA where a step needs only a terminal.

## Test data

All in a shared fixture module, `src/apps/invoice-builder/fixtures.js` (not a `.test.js`, so the suite does not
run it on its own).

- **`sampleInvoice(lines, overrides)`**: business "Tan Brothers Aircon Pte Ltd", three-line address, UEN
  201912345K, phone, email; customer "Harbourfront Dental", contact "Dr Lim", one-line address; number
  `INV-20261031-01`, date 2026-10-31, due date 2026-11-30; GST on, rate "9", registration number M90312345A;
  payment details "DBS 012-345678-9, PayNow UEN 201912345K"; notes; items as in `quote.test.js`'s `sampleQuote`.
- **Money table** (C1 to C3). Base items: 3 x 45.50 and 2.5 x 80. Expected figures, worked out with the shared
  `quoteTotals` on 2026-10-31:

  | Case | Subtotal | Discount | Amount before GST | GST | Total |
  |---|---|---|---|---|---|
  | No discount, GST off | 336.50 | 0.00 | 336.50 | 0.00 | 336.50 |
  | No discount, GST 9% (336.50 x 9% = 30.285, half a cent) | 336.50 | 0.00 | 336.50 | 30.29 | 366.79 |
  | Line 1 discount 10% | 322.85 | 0.00 | 322.85 | 29.06 | 351.91 |
  | Line 1 discount 5.00 | 331.50 | 0.00 | 331.50 | 29.84 | 361.34 |
  | Overall discount 2.5% (8.4125) | 336.50 | 8.41 | 328.09 | 29.53 | 357.62 |
  | Overall discount 36.50, GST off | 336.50 | 36.50 | 300.00 | 0.00 | 300.00 |
  | Everything: lines 10% and 5.00, plus 0.10 and 0.20 lines, overall 5%, GST 9% | 318.15 | 15.91 | 302.24 | 27.20 | 329.44 |

- **Half-cent GST** (C2): 0.50 at 9% (4.5 cents) gives 0.05; 16.50 at 9% (148.5 cents) gives 1.49; 0.05 at 9%
  (0.45 cents) gives 0.00; 0.50 at 7% (3.5 cents) gives 0.04. Plus a sweep: every amount before GST from 0 to
  20,000 cents at rates 9, 8, 7 and 12.5.
- **Float traps** (C3): 0.10 + 0.20; 3 x 0.10; 19.99 x 3; 1.005 typed as a price; 2.675 x 1; quantity 0.333.
- **Quote files** (C6): written by the quote builder's real `serialiseQuote`, never hand-copied, as version 2
  (current) and version 1 (no `inclusive`), plus one with `gst.inclusive: true`. Bad files: the table in
  `quote.test.js` ("refuses %s"), plus an empty file, a PDF's bytes, a 5 MB file and an invoice file given to
  "Open quote file" (the developer pins whether that opens or is refused, and the test says which).
- **Logos**: `solidPng(40, 20)` and `solidPng(1200, 300)` from `tests/helpers/png.js`; a small SVG data URL; a
  PNG of exactly 1 MB and one of 1 MB plus 1 byte; a GIF.
- **Storage stubs**: a working `localStorage` map; one whose `getItem` and `setItem` throw (blocked); one whose
  `setItem` throws only for values over 100 KB (a full quota with a large logo).

## Coverage map

| Criterion (PRD §2) | Level | Seam / location | Data | Automated? |
|---|---|---|---|---|
| C1 totals for no discount, line % and amount, overall discount, GST on and off, reusing `calc` | unit | `src/apps/invoice-builder/totals.test.js` on the invoice's totals (the shared `quoteTotals`); `offline.test.js` source scan | money table | yes: one `it.each` over the money table, asserting all five figures and each line total. The source scan asserts the folder imports `../quote-builder/calc.js`, defines no `divRoundHalfUp` or `parseScaled` of its own, and imports nothing from an internal invoice system |
| C2 half a cent of GST rounds up; amount before GST + GST = amount with GST | unit + PDF | `totals.test.js`; `pdf.test.js` | half-cent cases, sweep | yes: the four named cases; the sweep asserts GST = floor((2 x amount x rate + 10000) / 20000), with the rate in hundredths of a percent (9% = 900), and amount before GST + GST = total for every pair. The same check on the *printed* strings: parse the three printed amounts back to cents and add them up, in the rows, the preview and the PDF ops |
| C3 no floating-point artefacts in any displayed amount | unit + render + PDF | `totals.test.js`; `tests/invoice-builder-ui.test.js`; `pdf.test.js`; `offline.test.js` | float traps | yes: every money string in the totals rows, the preview markup and the PDF ops matches `^-?\d{1,3}(,\d{3})*\.\d{2}$`; 0.10 + 0.20 shows 0.30. Source scan: no `parseFloat` or `toFixed` in the folder's non-test files |
| C4 GST on: "Tax invoice" prominent and every IRAS item; GST off: "Invoice", no registration number, rate or GST line | PDF + render | `pdf.test.js`; `InvoicePreview` in `tests/invoice-builder-ui.test.js` | `sampleInvoice(5)` GST on and off, with and without an overall discount | yes. GST on: page 1 carries "Tax invoice" in the largest font on the page, above the line items; it carries the business name, address and "GST reg. no." line, the invoice number, the invoice date (`displayDate`), the customer name and address, each description, the GST rate in the GST label, and the rows "Amount before GST", "GST (9%)" and "Amount with GST", **including with no discount** (the quote builder hides its before-GST row then, so this is the case most likely to slip). GST off, with the registration number field still filled: title "Invoice", and no op matches `/tax invoice/i`, the registration number, `/GST/`, or a rate. Both: no op or metadata says "IRAS", "Inland Revenue", "complies", "approved" or "jurasolutions", and no "Made with" line. The preview shows the same title and rows as the PDF for each case |
| C5 GST on: "Download PDF" lists each missing required field and makes no file | unit + download step + render | `required.test.js`; `download.test.js`; `tests/invoice-builder-ui.test.js` | `sampleInvoice(3)` with one field blanked at a time | yes. `required.test.js` is one `it.each` over the nine required fields in `CONTEXT.md` (business name, business address, GST registration number, invoice number, invoice date, customer name, customer address, an item's description, an item's quantity): blanking each lists exactly that field, as "Please add: {field label}"; whitespace-only counts as missing; a zero quantity counts as missing; all blank lists all nine in form order; GST off lists none. An empty business name is missing and is never filled with the quote builder's "Jura Solutions" placeholder. `download.test.js`: with anything missing, `build`, `save` and `track` are never called and the result is `{ missing }`; with nothing missing, each is called once. Render: the list has the heading "A few details are still needed for a tax invoice", sits in a live region present before it fills, and each entry links (`href="#id"`) to an input that exists with that id |
| C6 a quote file opens with customer, items, discounts, notes and GST setting; a bad file shows the message and changes nothing | unit + render | `invoiceFile.test.js`; `tests/invoice-builder-ui.test.js` | quote files v1 and v2, bad files | yes: opening each good file over a filled-in invoice gives the quote's customer, items (description, quantity, unit, price, line discount), overall discount, notes, GST on, rate and registration number, while the page's business details and logo, invoice number and dates stay as they were; totals equal `quoteTotals` of the quote. Each bad file returns `{ ok: false }` and the invoice passed in is deep-equal to a frozen copy taken before. Render: the error shows exactly "That file doesn't look like one saved from our quote or invoice builder." in a live region. See question Q1 for a quote saved with prices that include GST |
| C7 a saved invoice file re-opens to an identical invoice | unit + PDF | `invoiceFile.test.js` | `sampleInvoice(6)` with a PNG logo, multi-line description, all three discount types, rate "8", due date, payment details, notes, a typed number | yes: serialise then parse is deep-equal (ids aside); totals equal; the PDF ops' texts from the original and the re-opened invoice are equal. The file carries its own format marker and version; refused: other format, a newer version, a too-long field, a non-image logo, a logo over 1 MB |
| C8 the PDF opens in Chrome, Safari and Acrobat, fits A4, paginates cleanly at 40 lines with the totals together | PDF + manual | `pdf.test.js`; manual check | `sampleInvoice(5)`, `sampleInvoice(40)` with a wide logo, two-line descriptions, 28 to 52 lines | partly. Automated: every page is A4 (595.28 x 841.89) in pdf-lib and 595 x 842 in pdf.js; every non-footer op is inside the margins; at 40 lines no row spans two pages, the column headings and "Page n of N" are on every page, rows are numbered 1 to 40 once; for every line count from 28 to 52, GST on and off, with and without a discount, "Amount before GST", "GST", "Amount with GST" and "Total" are on one page. Manual: Ting Yu opens the 5-line GST-on, 5-line GST-off and 40-line PDFs in Chrome, Safari and Adobe Acrobat Reader and records, per viewer and version, that each opens without a warning, prints at A4 without scaling, and shows the logo |
| C9 business details persist after reload only with "Remember" ticked; the tool works with storage blocked | unit + render + manual | `remember.test.js`; `tests/invoice-builder-ui.test.js`; manual check | storage stubs | yes for the logic: save then load returns the business details only (never customer, items, numbers or notes); forget removes the key; with a full quota the details are kept without the logo; with storage blocked every call returns without throwing and save reports false. Render: a remembered business prefills the form and ticks Remember; nothing stored leaves both empty; blocked storage renders the whole tool and links the blocked hint to the Remember checkbox; "New invoice" (`newInvoice({ business })`) keeps the business and clears the rest. Manual: in Chrome, tick, reload, details back; untick, reload, gone; with site data blocked, build and download an invoice |
| C10 works at 360 px and on desktop; 44 px tap targets | render + manual | `tests/invoice-builder-ui.test.js`; manual check | default page | partly. Automated: every `button`, `input[type=checkbox]`, `select` and file control in the rendered tool is a design-system control or carries `min-height: var(--tap-min)`, and the tool's CSS sets `--tap-min` on its own buttons (the quote builder pattern); Edit and Preview are two pressed-state buttons. Manual: Chrome device mode at 360 x 740, plus one real phone: no horizontal scroll, form and preview both reachable, item rows usable, missing-fields list readable; desktop at 1280 wide shows the form left and the preview right |
| C11 keyboard usable; every input labelled; contrast passes the design system's tokens | render + review + manual | `tests/invoice-builder-ui.test.js`; `crew:web-design-review` on the new files; manual check | default page, filled page, page with errors | partly. Automated: every `input`, `select` and `textarea` has a `label for` or `aria-label`, and each PRD §5.2 label appears; hints and errors are linked by `aria-describedby`; reorder and remove are buttons with names that say which item ("Move item 2 up"), not drag only; live regions for the bad file, the logo error and the missing fields exist before they fill. The tool's CSS uses no colour literal (no `#hex`, `rgb(` or `hsl(`), only design-system tokens, so contrast is the tokens' own. Manual: a keyboard-only pass covering add, reorder and remove an item, GST on, Download PDF with fields missing, follow a link to its field, fill it, download |
| C12 all copy passes `jura-growth check` | unit + manual | `copy.test.js`; manual check | `copy.js` | partly. Automated: every §5.2 string is in `copy.js` word for word; no string has "!", an emoji or a figure other than the GST helper's; no string says the document meets IRAS rules. Manual: `jura-growth check` on every new string, run from `repos/growth` by Ting Yu (the crew has no access to it on this run), output pasted into a `qa-*.md` |
| C13 the talk-to-us card links to the enquiry form with `?from=apps/invoice-builder` | render + unit | `page.test.js`; `tests/enquiry.test.js` | the page | yes: the card's heading, body and button are the §5.2 words; its link is `/?from=apps/invoice-builder#contact`; `cleanFrom("apps/invoice-builder")` keeps it |
| C14 usage counter increments on open and on completion | download step + Function + render | `download.test.js`; `tests/usage.test.js`; `page.test.js` | the registry entry | yes: the tool renders inside `AppShell`, which counts "open"; `downloadInvoice` calls `track("complete")` once after a PDF is saved, and never when fields are missing or the build throws; the usage Function counts "open" and "complete" for `invoice-builder` against the real registry. Saving an invoice file is not a completion (the quote builder counts only the PDF) |

Scope items outside §2 that still get tests, in the same files: the registry entry matches PRD §5.3 (Finance,
browser tier, live, APP-005, the three industries) and passes `validateRegistry`; the suggested number is
`INV-20261031-01` for 2026-10-31, follows the invoice date until the visitor types a number, then keeps theirs;
GST is off in a new invoice and its default rate is "9", with the two IRAS URLs and a build-day date in the code
comment beside it (source scan); logos: PNG, JPG and SVG up to exactly 1 MB open, 1 MB plus 1 byte shows "Please
use a logo under 1 MB.", a GIF is refused; zero-quantity lines are left off with the §5.2 hint; characters the
PDF cannot print are left out instead of failing (the shared `winansi.js`).

## Risk-based depth, riskiest first

1. **R1 Wrong money on a tax document.** C1 to C3 above, plus negative cases: a discount over 100% or over the
   subtotal is clamped and flagged; a blank or non-numeric GST rate is flagged and Download PDF does not make a
   tax invoice with GST 0.00; quantities and prices with commas and "S$" parse as in the quote builder. End to end:
   the 5-line GST-on invoice's printed figures equal the money table's figures for the same items, checked in
   the PDF ops.
2. **R2 A tax invoice missing an IRAS item, or an "Invoice" that looks like a tax invoice.** C4 and C5, both
   directions, with every IRAS item asserted by name. Negative: GST off with a registration number typed in must
   not print it; GST on and the amount before GST row must print with no discount. The "Jura Solutions"
   placeholder must never reach a visitor's PDF.
3. **R3 Data loss from a file.** C6 and C7: a bad file changes nothing; opening a quote never overwrites the
   business details; a file round trip is lossless including the logo. Negative: a crafted file with a script
   data URL, an oversized field, extra keys or a newer version is refused or has the extras dropped.
4. **R4 Privacy.** `offline.test.js`: building the PDF, opening and saving files, and the required check run with
   `fetch` stubbed to throw and never call it; the folder's sources contain no `fetch(`, `XMLHttpRequest`,
   `sendBeacon`, `WebSocket` or `EventSource`, and reach `localStorage` only through `_shared/storage.js`.
   `remember.test.js`: only business details are stored.
5. **R5 Quote-builder regressions.** The invoice reuses `calc.js`, `quoteFile.js`, `logo.js`, `winansi.js` and
   `pdf-geometry.js`. Any change to those files must leave every existing quote-builder test passing unchanged;
   a test edited to make it pass is a major defect unless the commit says why.

## Non-functional

- **Accessibility, WCAG AA:** C10 and C11 rows above, plus `crew:web-design-review` over every new `.jsx` and
  `.css` file, with its findings recorded in a `code-review-*.md`.
- **Browsers and devices:** desktop Chrome and Safari, one phone (iOS Safari or Android Chrome) at the done-check;
  PDF viewers Chrome, Safari and Adobe Acrobat Reader.
- **Bundle:** pdf-lib loads only in the tool's chunk. QA checks after `npm run build` that the entry chunk (the
  script named in `dist/index.html`) contains neither `pdf-lib` nor `%PDF-`, and records the result. On `a087f61` the
  entry is clean and those strings appear only in `pdf-*.js` and `PDFButton-*.js`.
- **Rollback:** unchanged from the operating card (revert on `main`, or the Pages dashboard rollback).

## Not tested, and why

- **The PDF in real viewers and the page in real browsers, in automated tests.** Node has no browser or viewer,
  and the sandbox blocks opening apps. Covered by the C8 to C11 manual rows, run by Ting Yu at the PRD §5.4
  done-check; he accepts the risk by running or waiving them at G4.
- **Measured colour contrast.** No tool here renders pixels. Contrast is inherited from design-system tokens,
  which the CSS scan enforces; the risk of a token pair failing AA sits with the design system, not this tool.
- **`jura-growth check` by the crew.** It lives in `repos/growth`, which this run cannot reach (conductor log,
  2026-10-31). The copy test is a proxy only; Ting Yu runs the real check or waives it at G4.
- **Whether the tax invoice satisfies IRAS.** The tool never claims it does (PRD §4). Tests assert the IRAS list
  items are printed; judging compliance is the visitor's, as the PRD says.
- **Today's IRAS rate and wording.** No web access on this run. The default "9" was checked on 2026-10-24 for the
  quote builder; PRD §4 asks for a build-day check, which Ting Yu confirms at the done-check or the developer
  records with the date it was actually done.

## Exit criteria

The gate passes when every line below holds. Each is checkable without judgement.

1. Every row C1 to C14 has at least one passing automated case or recorded manual check, named (file and test
   title, or manual step and result) in a `reviews/qa-*.md`. Rows marked "partly" need both halves, or the
   manual half waived by Ting Yu at G4.
2. Every case named in R1 to R5 exists and passes.
3. `npm test` passes in full on `claude/T-0001-invoice-builde`, with more tests than the baseline and none of the
   baseline's removed or skipped (baseline 2026-10-31 at `a087f61`: 42 files, 763 tests, all passing).
   `npm run build` succeeds. There is no typecheck or lint to run.
4. The PDF fixtures (5 lines GST on, 5 lines GST off, 40 lines) are generated from the test fixtures and their
   paths recorded in a `qa-*.md`, ready for the C8 manual check.
5. The entry chunk check in "Non-functional" is recorded as passing.
6. Zero open defects of severity critical or major; minor ones listed with an owner. Any wrong figure, missing
   IRAS item on a tax invoice, "Tax invoice" or a GST line on an invoice with GST off, Jura's name on a visitor's
   PDF, or a network call from the tool is at least major.
7. Every `reviews/code-review-*.md` verdict is approve, or each of its findings is closed with a commit.
8. The manual checks (C8 viewers, C9 reload, C10 360 px and phone, C11 keyboard, C12 `jura-growth check`, the
   build-day IRAS check) are recorded by Ting Yu, or each one he skips is listed as waived at G4.

## Questions

- **Q1. A quote saved with "prices include GST".** The quote builder can save `gst.inclusive: true`; the invoice
  builder leaves GST-inclusive pricing out of scope (PRD §3). Opening such a quote as it stands would add GST on
  top of prices that already include it, so the invoice total would be higher than the quote's. *Recommended:*
  open the quote with GST added on top, as the invoice always works, and show a one-line notice that the quote's
  prices included GST and should be checked (new copy, to be approved with the build). Whatever the answer, a
  test pins that the invoice's totals are never `inclusive`, and a second test pins the chosen behaviour.
