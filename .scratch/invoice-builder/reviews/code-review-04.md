# Code review 04: save and open invoice files, and start an invoice from a quote file

Branch `crew/invoice-builder-04-files` at 377d813, against its fixed point b5195b6 (the merge-base with
the feature branch). Three commits, seven files: `invoiceFile.js`, `invoiceFile.test.js`,
`FileActions.jsx`, `index.jsx`, `tests/invoice-builder-files-ui.test.js`, ADR 0005 and `README.md`.
Every changed file was read in full.

## Verdict: approve

No blocking findings. Three *should fix* items: one is a false sentence in ADR 0005, one is a test
gap in the file-open wiring, and one is README text that is true only once ticket 03 is merged. Each
can be fixed in a follow-up commit on this branch or when 03 and 04 are merged. None of them changes
what the visitor sees.

## Standards

- *should fix*: `docs/adr/0005-invoice-file-is-its-own-format.md:36-37`. The ADR says that until
  `invoiceFromQuote` is updated, "the invoice builder refuses version 3 quotes, because it reads them
  with `parseQuoteFile`". That is the wrong way round. `parseQuoteFile` accepts versions up to the
  quote builder's own `FILE_VERSION`, so raising the quote builder to version 3 makes the invoice
  builder accept version 3 quotes as well. Reproduced: with `FILE_VERSION = 3` in `quoteFile.js`, a
  version 3 quote gives `openAnyFile(...).ok === true`. What actually catches it is the test
  `invoiceFile.test.js:274` ("refuses a newer quote file"), which fails because version 3 is
  hard-coded there. Either correct the ADR to name that test as the tripwire, or add an explicit
  `QUOTE_VERSIONS_READ = 2` check in `invoiceFile.js`, so the refusal the ADR describes actually
  exists. The check is the safer choice, because a test that someone edits to pass is a weaker guard.
- *should fix*: `FileActions.jsx:48-62` and `index.jsx:171`. The `useInvoiceFiles` wiring has no test.
  Nothing checks that a bad file sets the notice and never calls `onOpen`, that an inclusive quote
  sets the D6 warning, that a good file clears an old notice, or that "New invoice" clears it
  (`files.clear()`). `tests/invoice-builder-files-ui.test.js` renders `FileNotice` on its own, and the
  pure functions are well covered, but the step that decides whether the page changes is not tested
  (test-strategy C6, render level). A small harness that drives `open` with a stub file, or a pure
  `fileOutcome(result)` helper, would cover it without a DOM library.
- *nit*: `FileActions.jsx:77`. The single hidden picker is always labelled "Open invoice file", even
  when "Open quote file" opens it. It has `tabIndex={-1}` and is visually hidden, so few people will
  meet the label. "Open a file" would be accurate for both buttons, but it would add a string that is
  not in §5.2, so leaving it is acceptable.
- *nit*: `FileActions.jsx:52`. `openPickedFile(file, invoice)` uses the invoice as it was when the
  file was picked. Anything typed during the short asynchronous read is lost when a quote opens over
  it. This is negligible in practice and is noted only for completeness.
- Reuse: no duplication found. The readers, limits, `newItemId`, `safeFilename`, `saveBlob` and the
  quote builder's default note are all imported, not copied.
- Blocked paths: none touched. Nothing changed under `src/design-system/`, `dist/`, `.env` or
  `.dev.vars`, and no `wrangler.toml` was added.

## Spec

Checked against PRD §2 criteria 6 and 7, ticket 04 and its comments, decisions D2, D6, D7, D8 and D9,
`technical.md` §3, §4 and §9, and `test-strategy.md` C6 and C7.

- Round trip (C7, criterion 7): passes. `invoiceFile.test.js` round-trips a full invoice with a PNG
  logo, a multi-line description, all discount kinds, rate 8, a due date, payment details and notes.
  The result is deep-equal with ids aside, the totals are equal, and the PDF op text is equal.
- Quote v1 and v2 (D7): passes. The customer, items, overall discount, notes and GST on/rate come from
  the quote. The registration number comes from the quote only when the page's is blank. The number,
  dates and payment details stay. Business fields are filled only when blank, and the logo only when
  the page has none. The quote builder's default note is dropped. Both versions are tested over a
  frozen page invoice, and the totals equal `quoteTotals(quote)`.
- "Jura Solutions" (D2): passes. The quote builder saves `effectiveQuote`, so a quote with a blank name
  carries `DEFAULT_BUSINESS_NAME` (`quote-builder/index.jsx:146`). `fillBusiness` skips it, and a test
  pins that.
- Inclusive quote (D6): passes. Prices stay as typed and GST is on. `pricesIncludedGst` is true only
  when GST was on and inclusive. The invoice has no `inclusive`, `totals.inclusive === false`, and
  total = taxable + GST. The warning text matches D6 word for word, and it clears on the next file or
  "New invoice".
- Bad file (criterion 6, §5.2): passes. Every refusal returns `{ ok: false }` against a deep-frozen
  invoice. `onOpen` is not called, so nothing changes. The message is the exact §5.2 string, shown in
  the `aria-live` region (the wiring itself is untested; see Standards).
- Size and version: passes. A picked file over 3 MB is refused before `text()` is called (tested).
  Version 0, version 2, a version given as a string, and a newer quote are all refused.
- Ticket comment (the `openInvoice` numbering nit from review 02): resolved. An opened invoice's number
  becomes `previousNumber`, so a new date does not renumber it (tested). A quote leaves the page's
  number logic as it was. `autoComplete` on the customer fields was not touched, which is correct
  because this ticket did not edit those fields.
- *should fix* (README accuracy): `README.md:608`, `:636-638` and `:787` describe ticket 03's
  `required.js`, `required.test.js` and the "no file until every required field is filled" behaviour.
  None of these exists on this branch, and `MissingSummary.jsx` (from ticket 03) is missing from the
  file table at `:613`. The text is right only after 03 is merged. Add `MissingSummary.jsx` to the
  page row when the two branches are merged. If 04 lands first, hold the README text back until 03
  lands. Everything else in the README section matches the code and decisions D6 to D9. The numbers
  rule holds: the only figures are product limits (1 MB, 3 MB, 1,000 characters) and the IRAS rate
  (9%), which is sourced in `model.js`.
- ADR 0005: present and consistent with `technical.md` §9 and D8, apart from the false sentence noted
  under Standards.

### Clash with ticket 03

`git merge-tree` reports one textual conflict, in `index.jsx:206`: the "messages" comment line, which
both tickets edited. Resolve it by keeping `<MissingSummary .../>` followed by `{files.notice}` and
dropping the comment. With the conflict resolved that way, a trial merge passes 56 test files and 1085
tests, and the build passes. There are no semantic conflicts: `openInvoice` resets `pdfState` to
"idle", which also clears 03's "missing" state when a file opens. An inclusive quote turns GST on, so
03's required check applies to it as intended.

## Security

No findings.

- Untrusted JSON: `JSON.parse` inside a try block. Every field is rebuilt by named readers (type and
  length checks, enums, an item cap of 200), and unknown keys are dropped. Nothing spreads or merges a
  parsed object into state. Probe: a file with `"__proto__"` keys at the invoice and business levels
  opens with no pollution (`({}).polluted === undefined`, plain prototype).
- Logos: the data URL must match `data:image/(png|jpeg|svg+xml);base64,...` within 1 MB. An SVG that
  contains `<script>` and `onload` is accepted (probe), as it is in the quote builder. It is rendered
  only through `<img src>` (`InvoiceForm.jsx:115`, `InvoicePreview.jsx:55`) and rasterised through an
  `Image` for the PDF (`logo.js:79`). Neither path runs script. There is no `dangerouslySetInnerHTML`,
  `innerHTML`, `<object>`, `<embed>` or `<iframe>`.
- Size: files over 3 MB are refused before they are read, which bounds the cost of parsing.
- Privacy: no network calls (the test stubs `fetch` and sees none). The saved file name goes through
  `safeFilename`. No secrets, auth, SQL or money handling beyond the client-side maths.

## UI (Web Interface Guidelines, `crew:web-design-review` on `FileActions.jsx` and `index.jsx`)

- Note: opening a file over work without asking, against "Destructive actions need confirmation", is
  decision D9 (it matches the quote builder), so this is not a finding.
- Note: the bad-file message names no next step. It is the PRD's §5.2 wording, so this is not a
  finding.
- *nit*: `FileActions.jsx:77`, the picker label (see Standards).
- Passed: real `<button>`s through `ExportButtons`. The file messages are in the existing
  `aria-live="polite"` region, which is present before it fills (tested). Decorative icons come from
  the design system's `Icon`. The toast is in its own live region. No new copy beyond §5.2 and D6.

## Evidence

- `git diff --stat b5195b6 377d813`: 7 files, +744 / -6.
- `npm test` at 377d813 (temporary worktree, since removed): 55 files, 1031 tests passed.
- `npm run build` at 377d813: exit 0, and the prerender writes `apps/invoice-builder.html`.
- Probe with quote `FILE_VERSION = 3`: `openAnyFile(v3 quote).ok === true`, and
  `invoiceFile.test.js` "refuses a newer quote file" fails (1 failed, 46 passed).
- Probe with `__proto__` keys: opens, no pollution. Probe with an SVG containing script: accepted, and
  rendered only through `<img>` or canvas.
- Trial merge with `crew/invoice-builder-03-tax-invoice` (conflict resolved as above): 56 files,
  1085 tests passed, build exit 0.
- Not run: the `code-review` and `security-review` skills, because this brief does not allow spawning
  agents and their recipes do. Both axes and the security pass were done by hand, as recorded above.
