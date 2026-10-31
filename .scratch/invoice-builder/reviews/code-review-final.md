# Code review, final: APP-005 Invoice builder

Branch `claude/T-0001-invoice-builde` at 8e8938b, against 858281e as the brief names it.

**Point of comparison.** In this worktree, `git merge-base main HEAD` gives 612ed9b, not 858281e,
because the local `main` ref is one merge behind `origin/main` (858281e, PR #9 "Serve the Jura mark
as PNGs for outreach email"). The branch descends from 858281e, so `git merge-base origin/main HEAD`
is 858281e. Against the stale local `main`, the diff also shows `public/email/jura-mark-*.png` and
`tests/email-mark.test.js`. Those files belong to PR #9, not to this feature, and this review leaves
them out. The release step should diff against `origin/main`, or update local `main` first.

Scope: 53 files, +6813 / -246. I read every source, test-adjacent and doc file in full: the 16 files
in `src/apps/invoice-builder/` (source, plus the tests I needed), the quote-builder changes
(`quoteFile.js`, `pdf.js`, `pdf-text.js`, `QuoteForm.jsx`, `form-parts.jsx`), `registry.json`,
`README.md`, `CONTEXT.md` and ADR 0005. I spot-read the test files where they back a criterion.

## Verdict: approve

There are no blocking findings, and no *should fix* findings. The four nits below can wait. Review 04's
three *should fix* items were fixed in b781147:
- `QUOTE_VERSION_KNOWN` now refuses quote files newer than version 2, and has a test.
- ADR 0005 is corrected.
- The README names `MissingSummary.jsx`.

The criteria only a person can check are listed under "Left for the release gate". They are not
findings against the code.

## Blocked paths

None touched. `git diff --name-only 858281e HEAD` has nothing under `src/design-system/`, `inputs/`,
`.github/workflows/`, `.claude/` or `dist/`. It also has no `.mcp.json`, `.env`, `.dev.vars` or
`wrangler.toml`. `package.json` and `package-lock.json` are unchanged, so no dependencies were added.

## Standards

- *nit*: `src/apps/invoice-builder/InvoiceForm.jsx:161-164`. The customer fields have no
  `autoComplete`, so a browser may fill in the visitor's own name and email for their customer. This
  carries over from review 03, and the quote builder's customer fields behave the same way.
- *nit* (reuse): `src/apps/invoice-builder/required.js:21` and `invoiceFile.js:75` each define the
  same `blank` helper. One shared helper would do. It is too small to matter.
- *nit*: `src/apps/invoice-builder/invoiceFile.js:56`. An invoice file with no `gst.rate` opens with
  an empty rate, not `DEFAULT_GST_RATE`. Every file the tool saves includes a rate, so only a
  hand-edited file shows this. Turning GST on then flags the rate as missing, which is safe.
- *nit*: `src/apps/invoice-builder/FileActions.jsx:77`. The one hidden picker is labelled "Open
  invoice file" even when "Open quote file" opens it. This carries over from review 04. The picker
  is `tabIndex={-1}` and visually hidden.
- Not findings:
  - The prefactor is a pure move. Every line removed from `QuoteForm.jsx` reappears in
    `form-parts.jsx` with only `export` added.
  - `readBusiness` is unchanged in behaviour.
  - `wrapText` is re-exported from the quote's `pdf.js`, so its importers still work.
  - The items-table loop in `pdf.js` is copied from the quote's on purpose, as `technical.md` §2
    records and as the header comment of `pdf.js` states.
  - Nothing duplicates calc, the file readers, logo handling, `safeFilename`, `saveBlob`, storage
    or WinAnsi. All are imported.

## Spec (PRD A-0002, decisions D1-D19)

§2 criteria:
1. Totals: met. `totals.test.js` covers no discount, line % and amount, overall discount, and GST on
   and off. All of them go through the quote builder's `quoteTotals`.
2. Half-cent GST rounds up, and the three amounts add up: met. `totals.test.js:64`, and `:85`
   sweeps every amount to 200.00 at four rates.
3. No floating-point artefacts: met (`totals.test.js:110`). All amounts are BigInt cents through
   `formatCents`.
4. "Tax invoice" with GST on, with every IRAS item: met.
   - `pdf.js` prints the title, the supplier's name, address and registration number, the date and
     number, the customer's name and address, the descriptions, the rate in "GST (r%)", and the
     amount before GST, the GST and the amount with GST (`totals-rows.js:51-53`).
   - With GST off the PDF says "Invoice" and shows no registration number, rate or GST line
     (`pdf.js:154`, `totals-rows.js:49`).
5. With GST on, missing fields are listed and no file is made: met.
   - `download.js:34-35` checks before anything is built.
   - `required.js` follows D4's order and links each entry to its input.
   - `required.test.js` has 11 cases.
6. Quote file opens, and a bad file changes nothing: met (`invoiceFile.js:101-144`, D6, D7, D9).
7. Saved invoice re-opens to an identical invoice: met (round trip in `invoiceFile.test.js`).
8. A4, pagination at 40 lines, totals kept together: met in code and tests (`pdf.test.js:232`,
   `:260`). Opening the PDF in Chrome, Safari and Acrobat is a manual check (see below).
9. Remember: met. `remember.js` writes only while ticked and forgets when unticked. With blocked
   storage the tool still works (`remember.test.js:73`).
10. 360 px and 44 px tap targets: tap targets come from `TAP`, and the mobile Edit/Preview switch is
    in place. Viewing at 360 px is a manual check.
11. Keyboard and labels: met at render level (`tests/invoice-builder-ui.test.js`). Contrast comes
    from the design system's tokens.
12. `jura-growth check`: not run (D19). Copy was checked by hand; see Voice.
13. Talk-to-us link: met. `TalkToUsCard` builds `/?from=apps/invoice-builder#contact`, and
    `page.test.js:55` checks it.
14. Usage counter: met. `AppShell` counts the open, and `download.js:39` counts one completion per
    PDF. `page.test.js:59` checks this against the real registry.

§3 scope:
- Every in-scope item is present: business details with logo (PNG, JPG or SVG, 1 MB), customer,
  the suggested `INV-YYYYMMDD-01`, line items with add, remove and reorder, totals in SGD, the GST
  switch defaulting to 9 with the registration number, payment details, notes, opening a quote
  file, the A4 PDF, Save and Open, and "New invoice".
- Nothing out of scope was built: no server storage, no email, no PayNow QR, no inclusive pricing
  (the model has no `inclusive`), no other currencies, and no Jura footer.

§4 constraints:
- Integer cents, half up, from the imported `calc`.
- GST is worked out after discounts.
- The IRAS URLs and the check date sit beside `DEFAULT_GST_RATE` (`model.js:24-35`). D16 records
  the build-day re-check as not done.
- No server calls.
- The design system is used through `ds.js`.
- The PDF carries the visitor's branding only.

§5.2 copy: every string in `copy.js` matches §5.2 word for word. The strings beyond it are D6,
D10, D12 and the UI's working strings.

§5.3 registry entry: matches the PRD exactly. `added` is 2026-10-31 (D17), and the release step
should set it to the deploy date.

## Security

No findings.
- **Untrusted files.**
  - Files over 3 MB are refused before they are read (`invoiceFile.js:157`).
  - `JSON.parse` sits inside `try`.
  - Every field is rebuilt by named readers with type, length and enum checks, and at most 200
    items. Unknown keys are dropped, and nothing spreads a parsed object into state.
  - `gst.on` counts only when it is exactly `true`.
  - Newer invoice and quote versions are refused.
- **Logos.** The data URL is checked against a PNG, JPEG or SVG pattern and the 1 MB limit, both
  on upload and when read back from a file or from storage. Logos are shown only through `<img>`
  and rasterised for the PDF, so an SVG's script never runs. There is no `dangerouslySetInnerHTML`,
  `innerHTML`, `iframe`, `object`, `embed` or `eval` (grep).
- **Network.** There is no `fetch`, XHR, `sendBeacon` or WebSocket in the tool. Its only request is
  `trackUsage`, and `offline.test.js` stubs `fetch` and sees nothing else. The `https://` strings
  are the IRAS URLs in a comment.
- **Storage.** Only the business details, GST setting, payment details and last number are stored
  locally, under `jura.invoice-builder.business.v1`, and they are re-validated on load.
- **Secrets.** None in the diff (grep for key, secret, token and password finds only review prose).
- **File names.** These go through `safeFilename`.

## Brand, IRAS and voice

- **Figures.** Every figure is a product limit (1 MB, 3 MB, 1,000 characters, 200 items) or the
  sourced 9% rate. The tool publishes no client counts, savings or percentages.
- **IRAS and government marks.**
  - Neither the PDF nor `copy.pdf` names IRAS or carries a government name or mark.
  - On the page, IRAS appears only in the §5.2 rate helper: "Set to the current rate on the IRAS
    website. Please check the figures before you send your invoice." This points the visitor to the
    source and claims no compliance.
  - The README says outright that nothing claims the document meets IRAS rules.
- **Jura branding on the visitor's PDF.** There is none: no footer or "Made with" line, and the
  creator and producer are "pdf-lib" (`pdf.js:57-58`). An empty business name prints nothing, and a
  quote's "Jura Solutions" stand-in is never brought in (`invoiceFile.js:86`). `pdf.test.js` pins
  this. The file format id `jura-invoice-builder` is inside the JSON data file only.
- **Voice.** All strings are in sentence case and second person, with no buzzwords, urgency,
  emoji or exclamation marks (grep for `!` and emoji in `copy.js` finds none). "Making your PDF…"
  uses the ellipsis character.

## UI (`crew:web-design-review` on index, InvoiceForm, InvoicePreview, GstFields, MissingSummary, FileActions)

- `InvoiceForm.jsx:161-164`: the customer inputs have no `autoComplete` (the same nit as above).
- Notes, not findings:
  - The guideline's Title Case conflicts with the design system's sentence case, and the design
    system wins.
  - Dates use a fixed month list (`displayDate`) rather than `Intl`. A fixed format suits a
    printed business document and matches the quote builder.
  - There is no `beforeunload` guard, also as in the quote builder.
  - Opening a file without asking first follows D9.
- Passed:
  - Every input has a label.
  - Hints and errors are linked through `aria-describedby`.
  - Live regions exist before they fill.
  - Every `<img>` has `alt`, `width` and `height`.
  - Item numbers use `tabular-nums` (`quote-builder.css:160,179`).
  - User text wraps (`overflow-wrap: anywhere`).
  - Actions are `<button>`s, and the missing-field entries are `<a href="#id">`.
  - `autoFocus` appears only on the dialog's confirm button.

## Left for the release gate (manual, not findings)

- Open the PDF in Chrome, Safari and Acrobat (criterion 8).
- View the page at 360 px wide (criterion 10).
- Run `jura-growth check` on the copy (criterion 12, D19).
- Re-check both IRAS pages on the deploy date (D16).
- Set the registry `added` date to the deploy date (D17).
- Run the §5.4 done-check with Ting Yu.

## Evidence

- `git rev-parse main` gives 612ed9b and `git rev-parse origin/main` gives 858281e.
  `git merge-base 858281e HEAD` gives 858281e.
- `git diff --stat 858281e HEAD`: 53 files, +6813 / -246.
- `npx vitest run`: 56 files, 1087 tests passed.
- `npm run build`: exit 0, and the prerender writes `apps/invoice-builder.html` ("Invoice builder |
  Free tool from Jura Solutions").
- Blocked-path grep over the changed file names finds no matches.
- Diff of the `QuoteForm.jsx` lines against `form-parts.jsx`: the only differences are the five
  `export` keywords.
- I did not run the `code-review` or `security-review` skills, because their recipes spawn
  sub-agents and the brief rules that out. I covered both axes and the security pass by hand, as
  recorded above.
