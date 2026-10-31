# 03 Tax invoice with GST on, and the required-field check

Status: done
Blocked by: 02
Branch: crew/invoice-builder-03-tax-invoice

## What to change

GST on, per `../spec.md`, `../reviews/decisions.md` (D4, D5) and `../reviews/technical.md` §5 and §6.

- The GST switch (off by default) with its helper, the rate field with its helper, and the GST registration number field, shown only while GST is on.
- `required.js`: `missingFields(invoice, totals)` per D4, each entry `{ key, label, target }`.
- "Download PDF" with GST on: when anything is missing, it makes no file. The error summary shows in a live region that exists before it fills, with the §5.2 heading (focusable, and focused) and one "Please add: {field}" link per entry to its input; on a phone the link switches to the Edit view first. The summary updates as fields are filled, and goes when the list is empty or GST is off.
- PDF and preview with GST on: titled "Tax invoice" in the largest type on page 1, with the "GST reg. no." line, "Amount before GST", "GST (r%)" and "Amount with GST" always shown (D5), and every IRAS item in PRD §4.

## Acceptance criteria

- PRD §2 criteria 4 and 5, with `required.test.js` (one case per field), the GST-on parts of `pdf.test.js` (IRAS items, 28 to 52 lines with the totals on one page, GST on and off), and `tests/invoice-builder-ui.test.js` (every `target` is an id in the markup, live region, labels).
- Criteria 1 to 3 hold with GST on, and the printed amount before GST plus GST equals the amount with GST.
- `npm test` and `npm run build` pass.

## Comments

- Conductor, after the ticket 02 review: also fix the "should fix" in `../reviews/code-review-02.md`. The PDF's header and "Bill to" block have to break to a new page (or wrap within the margins) so a long address never runs off the page, with a test using very long business and customer addresses. Take the review's nits that touch your files too (a long number overlapping "Invoice no.", `discountLabel` written twice, `key={line}`).
