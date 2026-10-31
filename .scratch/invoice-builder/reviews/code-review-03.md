# Code review 03: tax invoice with GST on, and the required-field check

- **Ticket:** `issues/03-tax-invoice.md`, including its Comments (the should-fix and nits handed over from `code-review-02.md`). Measured against PRD A-0002 in `spec.md` (§2 criteria 4 and 5, §4 IRAS list and "never says the document meets IRAS rules"), decisions D4, D5 and D13, `technical.md` §5 and §6, and `test-strategy.md` C4, C5 and C8.
- **Reviewed:** `git diff b5195b6 16746eb` (branch `crew/invoice-builder-03-tax-invoice`). The merge-base with the feature branch is b5195b6.
- **Files read in full:** every changed file: `required.js`, `MissingSummary.jsx`, `GstFields.jsx`, `index.jsx`, `InvoiceForm.jsx` (one line), `InvoicePreview.jsx`, `pdf.js`, `totals-rows.js`, and the tests (`required.test.js`, `pdf.test.js`, `totals-rows.test.js`, `tests/invoice-builder-ui.test.js`). Also read for context: `download.js`, `copy.js`, `quote-builder/calc.js` (`hasContent`, the GST rate errors), `quote-builder/form-parts.jsx` (item ids), `_shared/focus.js`, and the design system's `Alert`, `Switch` and `Button`.
- **Date:** 2026-10-31

## Verdict: approve

There are no blocking findings and no should-fix findings. The tax invoice is titled "Tax invoice" in the largest type on page 1 and prints every item on the PRD §4 IRAS list, including "Amount before GST" with no discount. GST off still prints no GST text. `missingFields` matches D4 field by field, in form order, and a download with anything missing makes no file. Every link targets a real input id. The live region exists before it fills, and focus moves to the visible heading. The ticket 02 should-fix is closed: long addresses now carry on to new pages. The nits below can be taken or dropped. Merging ticket 04 alongside gives one small textual conflict in `index.jsx`, described under "Clash with ticket 04".

## Standards

- *nit*: `src/apps/invoice-builder/MissingSummary.jsx:30-48`. The design system's `Alert` wraps `children` in a `<span>`, so this puts an `<h2>` and a `<ul>` inside a `<span>`. That breaks HTML's content model: block elements may not sit inside phrasing content. Browsers and screen readers tolerate it, and the design system is read-only, so either accept it or render the heading and list beside the `Alert`, not inside it. (`Alert` also carries `role="status"` inside the `aria-live` region. That is the pattern the page already uses for its other messages, so it is not new here.)
- *nit*: `src/apps/invoice-builder/index.jsx:96` and `:157`. `missingFields` is called without `copy`, so its labels come from the module's own `import COPY` rather than the `copy` prop the rest of the page uses. Today they are the same object (`AppShell` passes the tool's `copy.js`), so nothing breaks. Passing `copy` through, as in `(shown, figures) => missingFields(shown, figures, copy)`, would keep one source of words.
- *nit*: `src/apps/invoice-builder/index.jsx:9-14`. The header comment still lists the GstFields, `missingFields` and `messages` seams as "for the tickets that build on this one". Ticket 03 has now filled them, so only the ticket 04 line is still a seam.
- *nit*: `src/apps/invoice-builder/index.jsx:150` with `:96`. A second "Download PDF" press while the list shows sets `pdfState` to "working", which empties `missing` and unmounts the summary, then remounts it. The list flickers, and the live region reads it out again. Focus does land on the heading again (`missingAsked`), so this is cosmetic. Keeping the last list while working would avoid it.
- Ticket 02 hand-overs, all closed:
  - The should-fix (header and "Bill to" run off the page) is closed by `flow()` at `pdf.js:101-104`, plus the label-with-first-line check at `pdf.js:176-179`. The new test is `pdf.test.js` "carries very long business and customer addresses onto new pages", for GST on and off.
  - The long number overlapping "Invoice no." is closed: the value wraps within the space beside its label (`pdf.js:122-127`), tested.
  - `discountLabel` written twice is closed: one `discountCell` in `totals-rows.js:30-34`, used by both `pdf.js:242` and the preview.
  - `key={line}` is closed: `InvoicePreview.jsx:58` and `:82` use the index.
- Blocked paths: none touched. The diff is confined to `src/apps/invoice-builder/` and `tests/invoice-builder-ui.test.js`. Nothing under `src/design-system/`, `dist/`, `.dev.vars`, `.env` or CI.
- Reuse: none to flag. `GstFields` uses the P3 `TextField`, `NumberField` and `errorText` and the design system's `Switch`. `required.js` reads `calc.js`'s own `included` and `errors.gstRate` rather than re-deriving them. The repo has no existing error-summary component (`grep -rl ErrorSummary src` finds none), so `MissingSummary` duplicates nothing. Its inline styles use tokens only, with no colour literals.

## Spec

- **"Tax invoice" prominent, with every IRAS item (criterion 4, §4, D5): met.**
  - The title, `copy.pdf.title(true)`, is drawn at 20 pt on page 1 (`pdf.js:111`). A probe confirms it is the largest size on page 1 in all 12 combinations of GST on and off, 1, 5 and 40 lines, and with and without a logo.
  - The supplier's name, address and "GST reg. no." line are printed (`pdf.js:143-161`). So are the invoice number and date (`:113-117`), "Bill to" with the customer's name and address, and each description.
  - The totals come from `invoiceTotalsRows`: "Amount before GST", "GST (r%)" and **Amount with GST** as the final line, with no discount and with one.
  - `pdf.test.js` "the tax invoice PDF (GST on)" pins each item by name. It covers the no-discount case, "before GST plus GST equals with GST", the 8.5% rate, and pdf.js reading "Tax invoice" on page 1 and "Amount with GST" on the last page. The UI test pins the preview to the same title and rows.
- **GST off prints no GST text: met.** The registration number prints only with `gstOn` (`pdf.js:154`). A probe with GST off and a registration number typed finds no op matching `/gst|tax|M9031/i` (its one `%` hit is a line-discount cell, "10%"). The preview test checks the same with and without a discount.
- **The required list matches D4 field by field (criterion 5): met.** `required.js:41-60` lists the fields in form order:
  1. Business name (`ib-business-name`)
  2. Address (`ib-business-address`)
  3. GST registration number (`ib-gst-reg`)
  4. Company or customer name (`ib-customer-company`)
  5. Customer address (`ib-customer-address`)
  6. Invoice number (`ib-number`)
  7. Invoice date (`ib-date`, blank or not `YYYY-MM-DD`)
  8. GST rate (%) (`ib-gst-rate`, through `calc.js`'s `errors.gstRate`, which covers empty, not a number and above 100)
  9. Items: "Please add: Items" when nothing is counted, then "Description for item N" for each counted line with no description

  The form's own order (`InvoiceForm.jsx:100-200`) matches. Whitespace-only counts as missing (`blank` trims), and GST off returns `[]`. "Counted" is `totals.lines[i].included`, which is exactly `calc.js` `hasContent` plus a quantity above zero. N is the line's position in the form, which matches the form's "Item N" headings that the link leads to. `required.test.js` has one case per field, whitespace cases, bad dates and rates, the three "Items" targets, the per-line description, all-blank in order, and the PRD labels. A probe with a blank registration number, a blank description on line 2 and an extra zero-quantity line lists exactly those two fields and ignores the uncounted line. `CONTEXT.md` "Required fields" already matches.
- **No file while anything is missing: met.** `download.js` returns `{ missing }` before it builds, saves or tracks. `index.jsx:159-163` sets the state and returns. `download.test.js` (ticket 02) pins that nothing is called.
- **Each link targets a real input id: met.** `invoice-builder-ui.test.js:238` renders the form with GST on and checks every `target` for three cases: an empty invoice (all 9 entries), no items (`ib-add-item`, the id added at `InvoiceForm.jsx:200`, which `Button` passes through `...rest`), and blank descriptions. The quantity target (`qb-item-<id>-quantity`) is not in that loop, but `form-parts.jsx:130` renders that id.
- **Live region and focus: met.**
  - `MissingSummary` renders inside the `tb-live` `aria-live="polite"` div, which is on the page and empty at load (tested), and renders nothing when the list is empty.
  - The heading has the §5.2 words, `tabIndex={-1}` and `data-missing-heading`.
  - `index.jsx:101-105` focuses the copy of the heading that has client rects, because `actions` renders twice. That effect runs after `useFocusReturn`'s effect (declared earlier), so the heading wins over the re-enabled button.
  - A link calls `setView("edit")` and then focuses its input in the next frame, so a phone leaves Preview first. Without script, `href="#id"` still jumps to the input.
  - The list follows the form while it is shown (`useMemo` on `invoice`) and goes when it is empty or GST is switched off (`index.jsx:97-99`).
- **A long address no longer runs off the page: met.** Probe: a business name of 120 characters, business and customer addresses of 200 lines (400 characters each), a 120-character company and contact, a 40-character number, a due date, and a wide logo. Across all 12 combinations, no non-footer op is below 64, no op is outside the margins, no two ops overlap, and the title stays on page 1.
- **Totals kept together for 28 to 52 lines: met.** `pdf.test.js:260` sweeps 28 to 52 two-line rows for GST on and off, with and without a discount. The probe's 40-line cases with very long addresses also keep every `kind: "total"` op on one page.
- **No claim of IRAS compliance: met.** The diff adds no new copy (`copy.js` is unchanged since ticket 02). `grep -i "iras|compl|meets|approved"` over the changed non-test files finds only `copy.js`'s own rule comment. The only shown string that names IRAS is the PRD's rate helper ("Set to the current rate on the IRAS website…"), which is §5.2 word for word and makes no claim.
- **Voice of any string shown: met.** The strings this ticket puts on screen for the first time are all §5.2 or D4 words reviewed in `code-review-02.md`: "Charge GST", the GST helper, "GST rate (%)", the rate helper, "GST registration number", the missing-fields heading, "Please add: {field}", "Items", "Description for item N", and the PDF's "Tax invoice", "GST reg. no.", "Amount before GST", "GST (r%)" and "Amount with GST". They are in sentence case, with no exclamation mark, emoji, buzzword or unevidenced figure. `jura-growth check` stays with Ting Yu (D19).
- **D13 with GST on:** a bad rate is listed as missing (linked to the rate) before the figures check runs, and it also shows its inline error (`GstFields.jsx:53`). `errors.gstRate` is only set while GST is on (`calc.js:140-143`), so a bad rate hidden by switching GST off cannot block a download with an error the visitor can't see.

## Clash with ticket 04

A trial merge of `crew/invoice-builder-04-files` (377d813) into 16746eb, done in a scratch worktree and then aborted, conflicts in one place: `src/apps/invoice-builder/index.jsx` at the `messages` comment inside `actions`.
- Ticket 03 replaced the comment with `<MissingSummary … />` and a shorter comment.
- Ticket 04 kept the old comment and added `{files.notice}` under it.

The fix is to keep both lines and drop the comment. With that resolution the merged suite passes: 56 files, 1085 tests. There is no semantic clash:
- Ticket 04's `openInvoice` still sets `pdfState` to "idle", which clears the summary when a file opens.
- `startNew` also calls `files.clear()`.
- The two tickets' state and effects don't overlap.

## Security

No findings. There are no new network calls, no `dangerouslySetInnerHTML` and no new storage. The summary's `href` is `#` plus an id built from `item.id`, so it can never be a `javascript:` URL, and React escapes the attribute. `getElementById` is only a lookup. No secrets, auth, SQL or personal data leave the browser.

## UI (Web Interface Guidelines, `crew:web-design-review` on `MissingSummary.jsx`, `GstFields.jsx`, `index.jsx`, `InvoicePreview.jsx`, `InvoiceForm.jsx`)

- Note: the guidelines' "Title Case for headings/buttons" rule contradicts the design system's sentence case. The design system wins, so this is not a finding.
- *nit*: `MissingSummary.jsx:30`. This is the `<span>` content-model issue already listed under Standards.
- Passed:
  - The `Switch` wraps its input in its `<label>`, so the label and the control share one hit target, with the helper linked by `aria-describedby`.
  - Each missing-field link is an `<a href>` (navigation) and carries `TAP` (`min-height: var(--tap-min)`, tested).
  - Async messages go through a live region that exists before it fills.
  - Focus moves to the error summary on submit, and from each link on to its field.
  - The registration number has `spellCheck={false}`.
  - Heading order holds: the page `h1`, then the summary's `h2`, alongside the talk-to-us `h2`.
  - The heading lookup reads layout in an effect, not in render.
  - No colour literals, `transition: all` or `outline: none` appear in the diff.

## Evidence

- `git diff --stat b5195b6 16746eb`: 12 files, +725 −65, all under `src/apps/invoice-builder/` and `tests/`.
- `npx vitest run` at 16746eb (scratch worktree): Test Files 54 passed (54), Tests 1035 passed (1035).
- `npm run build` at 16746eb: exit 0. The chunk holding `MissingSummary` (`index-n8BT1sTx.js`) has 0 `PDFDocument`, so pdf-lib stays lazy.
- A scratch probe test (deleted afterwards) ran 12 combinations of very long addresses, name, company and number: 0 ops below 64, 0 outside the margins, 0 overlaps, totals on one page, and "Tax invoice" at 20 pt as the largest size on page 1. With GST off, no GST, tax or registration-number text. `missingFields` on a mixed case returned exactly the registration number and "Description for item 2".
- Trial merge with ticket 04: one conflict in `index.jsx`. Resolved by keeping both lines, the full suite gave 56 files and 1085 tests passed. One run had a `_shared/pdfjs.test.js` timeout under load, which passed on rerun (4/4) and on a second full run. The merge was then aborted.
- The Standards and Spec axes and the security pass were run by hand in this thread, because the brief rules out background agents and the installed `code-review` skill starts reviewer subagents.
