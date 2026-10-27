# Functional review: APP-001b Quote builder, prices that include GST

*Reviewer: functional lead, crew run `quote-gst-inclusive`, 2026-10-27.*
*Spec: `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` (cited as PRD §n, line n).*
*Read: PRD, `CONTEXT.md` ("Quote builder (APP-001)"; this repo has no `GLOSSARY.md`, `CONTEXT.md` is the glossary), `calc.js`, `copy.js`, `model.js`, `quoteFile.js`, `index.jsx`, `QuoteForm.jsx`, `QuotePreview.jsx`, the totals block of `pdf.js`, and `quote.test.js` / `calc.test.js`.*
*UAT script: `.scratch/quote-gst-inclusive/reviews/uat.md`.*

Ting Yu is running this crew fully autonomously and cannot be asked. Every decision below carries a
recommended answer. The conductor can fold the recommendations into the PRD and carry on; none of them
needs the user. Two findings are blocking, because the spec cannot be built and accepted as written.
Both have a one-line fix.

I could not run commands in this session (no shell tool), so every number in this review and in the
UAT script was worked out by hand from `calc.js` (integer cents, `divRoundHalfUp`) and checked twice.
The developer should confirm them by running the calculation, and a mismatch is a bug in this review.

## How a Singapore shop, clinic or tutor actually quotes this way

The owner is GST-registered and prices to the public as one figure: "Teeth scaling, $109". The
customer pays $109. The owner's books split that into $100 of sales and $9 of GST. The quotation
never adds anything. If the document shows "Subtotal 109, GST 9, Total 118", the customer reads it
as a $9 surcharge and the owner has quoted the wrong price. So in inclusive mode the single thing
that must be true is: **the figure the owner typed is the figure the customer is asked to pay.**
Everything else (the GST amount, the amount before GST) is an "of which" breakdown.

The owner then does one or more of these, and each is a user story the spec has to survive:

1. **Quote one price list.** Types prices, switches inclusive on, sees the same total, sends the PDF.
2. **Quote with a discount.** A "10% off the whole job" or "$20 off" goodwill discount. The discount
   comes off the figure the customer sees, and GST is worked out from what is left.
3. **Come back next month.** Opens last month's `.quote.json`, or starts a new quote and expects the
   business details and the GST way of quoting to be as they left them.
4. **Re-open an old quote.** A file saved last week, before this change, is an exclusive quote and
   must still show the same total the customer was already given.
5. **Turn GST off.** A business that is not registered, or a one-off job. The quote carries no GST
   wording at all.

## Blocking

### B1. Success criterion 3 cannot be met as written: three existing tests have to change (PRD §2 line 26-27, §4 line 60-61, §5 line 70)

"Existing tests pass unchanged" collides with two other things the PRD asks for:

- `quote.test.js:47` asserts `newQuote().gst` `toEqual({ on: false, rate: "9", regNo: "" })`. Plan step 2
  adds `inclusive: false` to that object, so this assertion fails.
- `quote.test.js:99` asserts the saved file's `version` is `1`. §4 and plan step 2 bump it to 2.
- `quote.test.js:93-105` ("re-opens to an identical quote") builds a quote whose `gst` is the literal at
  line 40, `{ on: true, rate: "9", regNo: ... }`, with no `inclusive`. After the change the opened quote
  has `inclusive: false`, and `toEqual` does not ignore a `false`, so the round trip fails too.

Every test in `calc.test.js` passes `gst: { on, rate }` with no `inclusive` key. Those will pass
unchanged only if the calculation treats a missing `inclusive` as exclusive.

**Recommended answer.** Reword criterion 3 to: "In exclusive mode every figure is identical to
today's, to the cent. Every test in `calc.test.js` passes unchanged, including GST objects that have
no `inclusive` key. Three assertions in `quote.test.js` (the default GST shape, the file version, and
the round-trip fixture) are updated on purpose, and the PR description lists them." The calculation
should read the flag as `quote.gst.inclusive === true`, the same defensive style as `gst.on === true`.
The quality gate applies this criterion literally, so leaving it as is would fail a correct build.

### B2. What `inclusive` means while "Add GST" is off is not defined (PRD §2 lines 22-23, §3 line 40, §5 line 68)

The switch is "shown only while Add GST is on" (§3), and calc says "when on" (§5 step 1) without
saying which "on". The state can still hold `inclusive: true` after the visitor turns Add GST off,
because the form patches one key at a time (`gst("on")(false)` leaves the rest alone). Three things can
then go wrong:

- calc treats it as inclusive and returns `total = afterDiscount` with a GST of zero. Harmless, but
  only by accident.
- Preview or PDF prints "Prices include GST" on a quote with no GST on it. That is a false statement
  on a document going to a customer, and from a business that is not GST-registered it could be a
  compliance problem, not only a cosmetic one.
- A saved file or remembered setting keeps `inclusive: true` under `on: false`, and the next time the
  visitor switches GST on, the quote silently comes up inclusive.

**Recommended answer.**
1. Inclusive mode is `gst.on === true && gst.inclusive === true`. Calc, preview, PDF and the statement
   all use that one test (write it once, in `calc.js`, and export it).
2. With Add GST off, the quote is exactly today's GST-off quote: no GST rows, no statement.
3. Turning Add GST off leaves the stored `inclusive` value alone, so turning it back on restores the
   visitor's last choice. The file and remembered setting save whatever the value is.
4. A file with `on: false, inclusive: true` re-opens with GST off and, if the visitor then switches GST
   on, inclusive on. That is the visitor's own last choice and is not a bug.

Add to criterion 5: "The statement of how prices are quoted is printed only while Add GST is on."

## Should fix

### S1. The inclusive totals block, as the plan lays it out, looks like an arithmetic mistake (PRD §5 line 73-74)

Plan step 4 prints "Total before GST" always in inclusive mode, "label the GST row as included", and
keeps the existing order: Subtotal, Discount, Total before GST, GST, Total. With the UAT example
(subtotal 159.80, 10% off) that prints:

```
Subtotal                 159.80
Discount                 -15.98
Total before GST         131.94
Includes GST (9%)         11.88
Total (SGD)              143.82
```

A customer reads down, takes 15.98 off 159.80, expects 143.82, and sees 131.94 instead. The sum
131.94 + 11.88 only works if the reader notices the "Includes" label. This is the document the owner
sends to their customer, so it must not invite the question "is your arithmetic wrong?".

**Recommended answer.** In inclusive mode, finish the arithmetic first and give the split as an "of
which" under the total:

```
Subtotal                 159.80
Discount                 -15.98
Total (SGD)              143.82
  Total before GST       131.94      (muted)
  Includes GST (9%)       11.88      (muted)
Prices include GST                   (muted, the statement)
```

Testable form: "In inclusive mode, reading down, Subtotal minus Discount equals the first bold figure,
and the two breakdown rows appear after it." Exclusive mode keeps today's order, and keeps
"Total before GST" shown only when there is a discount, as today (`QuotePreview.jsx:143`, `pdf.js:300`).
The PDF's `totalsHeight` (`pdf.js:303`) must count the extra rows and the statement line, so the whole
block moves to the next page together and never strands the statement on a page of its own.

### S2. Criteria 2 and 8 cannot be failed as written; criterion 4 uses an overloaded term (PRD §2 lines 24-25, 28-29, 36-37)

- **Criterion 2**, "the quote total equals the sum of the line amounts after discounts": a tester cannot
  tell whether "discounts" includes the whole-quote discount. It must. Rewrite as: "In inclusive mode,
  total equals the sum of the line totals (each after its own discount) minus the whole-quote discount.
  GST is shown as part of that total and is never added to it."
- **Criterion 8**, "the only number on the page remains the rate the visitor types": the page already
  prints other figures ("under 1 MB", "2,000 characters", free tries). The rule is about *new* copy.
  Rewrite as: "None of the new strings (the switch, its helper line, the printed labels and the
  statement) contains a digit. The only digit they can show is the rate the visitor typed."
  Testable by looping over the new `copy.js` entries; the rate-bearing label is checked with a
  stand-in rate. This also means the helper line must not use an example ("$109 includes $9 GST"),
  because that is an illustrative figure and would need a caption under the design system's numbers rule.
- **"Discounted total"** (PRD criterion 4; CONTEXT.md "Prices include GST" and "Total before GST") means
  two different things. In exclusive mode the discounted total (subtotal less discount) is *before*
  GST and the grand total is larger; in inclusive mode it *is* the grand total. The CONTEXT.md line
  "Total before GST: the discounted total minus GST" is wrong for exclusive mode. Add one glossary term,
  **Amount after discount** (sum of line totals minus the whole-quote discount), and use it in both modes:
  - exclusive: GST = amount x rate; total = amount + GST; before GST = amount.
  - inclusive: GST = amount x rate / (100% + rate); total = amount; before GST = amount - GST.
  Then criterion 4 reads "GST is worked out once, on the amount after discount, rounded half up to the cent."

### S3. The PRD does not say where the "how prices are quoted" statement goes, or when it is silent (PRD §2 lines 30-32, §5 line 73-74)

Criterion 5 gives the two strings but not the place. The line-items table and currency note
("All amounts in SGD") are hidden when no item is included (`QuotePreview.jsx:90`), while the totals
block always renders. **Recommended answer:** print it directly under the Total row, muted, in both
preview and PDF, only while Add GST is on (see B2). Use the exact strings from criterion 5, without a
trailing full stop, so the tests assert them verbatim: `Prices include GST` and
`GST added at the rate shown`. Give the labels these exact strings:

- Row label in inclusive mode: `Includes GST (9%)` (a new `copy.pdf.gstIncluded(rate)`; the existing
  `gst(rate)` label stays for exclusive).
- `Total before GST` keeps its existing label.

The exclusive statement is a text change on a quote that otherwise stays identical (criterion 3 is about
figures, and this agrees with it), but it adds a line to the PDF. Existing PDF tests are page-count
sensitive: `quote.test.js:164` expects the 40-line sample to be exactly 2 pages. Run it, and if the extra
line tips a page break the fix is in the layout, not the test.

### S4. In inclusive mode the input labels still say "Unit price (SGD)" (PRD §3 line 41; `copy.js:106, 112, 126`)

A visitor who flips the switch on a quote they half-built gets the same total and a changed "before GST"
figure, and nothing on the item cards says that unit prices, amount discounts and the whole-quote amount
discount are now taken as GST-inclusive. **Recommended answer:** the switch's helper line says it, in
one sentence, with no figures: "Switch this on if the prices and discounts you type already contain GST.
Your total stays as typed, and we show how much of it is GST." Relabelling every field is not needed.
Copy for the switch itself: `Prices include GST`. Check it with `jura-growth check` as the constraints
require.

### S5. Remembered settings and "New quote" need an explicit rule for the new key (PRD §2 line 35; `index.jsx:35-41, 170-177`)

- `rememberedStart()` builds the GST object key by key, so a stored value saved before this change
  has no `inclusive`. It must default to `false` (`stored.gst.inclusive === true`), and the storage key
  stays `jura.quote-builder.business.v1`: adding a field is backward compatible and a new key would
  forget everyone's saved details.
- "New quote" already keeps the GST setting through `newQuote({ business, gst: current.gst })`. Say so
  in the acceptance criteria: the choice survives "New quote", whether or not Remember is ticked.
  (That is today's behaviour for the rest of the GST setting.)
- A knock-on that looks wrong but is today's behaviour: opening a saved quote file replaces `quote.gst`,
  and with Remember ticked the debounce effect (`index.jsx:93-103`) writes it to storage. Opening one
  customer's inclusive quote therefore changes the default for the next new quote. Leave it, and note it
  in the PR. It matches how the GST rate and number already behave.

### S6. README line to update (PRD §5 line 75)

`README.md:226` documents the file as `{ format: "jura-quote-builder", version: 1, quote }`. Plan step 5
says "README line ... if it lists features". It lists the file version, so it must say 2 and note that
version 1 files still open. Not doing so leaves a wrong sentence in the repo.

## Edge cases

Each is either covered by an acceptance criterion in the next section, or ruled out here.

| Edge | Verdict |
|---|---|
| No items, inclusive on | Covered (AC-E1): every figure 0.00, no error, statement still printed. |
| Whole-quote discount larger than the subtotal | Today's calc clamps it to the subtotal. In inclusive mode that gives amount 0.00, GST 0.00. Covered (AC-E2). |
| GST rate blank or not a number | Field error as today (§4 line 59). Calc uses rate 0, so the preview shows inclusive with `Includes GST (0%) 0.00` beside a red field. Download is not blocked today. Ruled out: no change; the error is on screen. |
| GST rate 0 | Inclusive: GST 0.00, before GST = total. Covered (AC-E3). |
| GST rate 100 (the maximum allowed) | The only rate where a half-cent tie is possible. Covered (AC-E3, AC-4c). |
| Rate above 100 | Field error as today; calc clamps to 100. Unchanged, ruled out. |
| Very large amount (99,999.99 x 1000) | Covered (AC-E4). BigInt maths and the formatter handle it. |
| 200 items (the limit) | Calc is a straight sum; GST is worked out once. No new risk. Ruled out of UAT; the existing PDF pagination tests, re-run in inclusive mode (AC-5e). |
| Toggle Add GST off then on | Covered (AC-1c, B2). |
| Switch flipped with figures already typed | Total unchanged, GST and before-GST recalculated live. Covered (AC-2). |
| Out of order: opening a file, then changing the switch | Standard form state; the switch writes `gst.inclusive`. Covered by the file round trip (AC-6). |
| Two browser tabs, Remember ticked | Last write wins, as for all remembered settings today. Ruled out. |
| Storage blocked (private browsing) | `rememberBlocked` message as today. Ruled out. |
| Old app copy opens a version 2 file | The old copy says "That file doesn't look like a quote saved from this tool", which is misleading, but it only affects a visitor with a stale cached copy. Ruled out; see N3. |
| Mixed supplies (zero-rated or exempt lines) | Out of scope in the PRD (§3 lines 47-48). Agreed. A visitor with a mix keeps GST off and adds a note. |
| AI draft ("Draft with AI") | `applyDraft` replaces items only and never touches `gst`. A draft written from "$100 + GST" gives a price of 100, so in inclusive mode the visitor sees 100.00 as the total. The draft banner already says "Check each line before you send it." Ruled out, no change. |
| Permission denied | There is no sign-in or permission. Ruled out. |

## Acceptance criteria, rewritten as Given / When / Then

Unless said otherwise, the quote is new, business and customer left blank, and the rate is the default
9. Amounts are SGD. "Preview" and "PDF" both carry every figure listed.

**AC-1 (criterion 1): the choice exists and defaults to exclusive**
- 1a. Given a new quote, When the visitor opens "Discount and GST", Then there is an "Add GST" switch,
  it is off, and there is no "Prices include GST" switch on the page.
- 1b. Given "Add GST" is on, Then a "Prices include GST" switch appears under the GST rate and
  registration number, it is off, and it has a helper line tied to it with `aria-describedby`.
- 1c. Given "Add GST" on and "Prices include GST" on, When "Add GST" is switched off, Then the inclusive
  switch disappears, the preview has no GST rows and no statement, and the total is the amount after
  discount. When "Add GST" is switched on again, Then "Prices include GST" is still on.
- 1d. Given the keyboard only, When the visitor tabs to "Prices include GST" and presses Space, Then it
  toggles and the preview changes.

**AC-2 (criterion 2): inclusive total is what was typed**
- 2a. Given 1 item, quantity 2, unit price 100.00, GST on and inclusive, no discounts, When the quote
  is shown, Then Subtotal is 200.00, Total (SGD) is 200.00, Total before GST is 183.49 and Includes GST
  (9%) is 16.51.
- 2b. Given the same item with a 10% whole-quote discount, Then Discount is -20.00, Total (SGD) is
  180.00, Total before GST is 165.14 and Includes GST (9%) is 14.86.
- 2c. Given 2a, When "Prices include GST" is switched off, Then Total (SGD) becomes 218.00 and GST (9%)
  is 18.00.

**AC-3 (criterion 3, as reworded in B1): exclusive is unchanged**
- 3a. Given two items, 2 x 59.90 and 1 x 40.00, a 10% whole-quote discount, GST on and exclusive, Then
  Subtotal 159.80, Discount -15.98, Total before GST 143.82, GST (9%) 12.94, Total (SGD) 156.76.
- 3b. Given `gst: { on: true, rate: "9" }` with no `inclusive` key, calc returns the same as 3a.
- 3c. Given `npm test`, Then `calc.test.js` passes with no edit, and the only edited assertions in
  `quote.test.js` are the three named in B1.

**AC-4 (criterion 4): GST once, half up, and the figures add up**
- 4a. Given three items of 1.00 each, GST on and inclusive, Then Total (SGD) 3.00, Includes GST (9%)
  0.25 (not 0.24, which is what working out GST per line would give), Total before GST 2.75.
- 4b. Given one item of 1.00, Then GST 0.08 and before GST 0.92 (8.26 cents, rounded down).
  Given one item of 100.00, Then GST 8.26 and before GST 91.74 (825.69 cents, rounded up).
- 4c. Given rate 100, one item of 0.01, inclusive, Then GST 0.01 and before GST 0.00 (a half cent
  rounds up). Given rate 100 and 1.01, Then GST 0.51 and before GST 0.50.
- 4d. Given every combination of rates 0, 7, 8, 9, 9.5, 12.5 and 100, the price and quantity lists the
  existing "no floating-point artefacts" test already uses, and a whole-quote discount, in both modes,
  Then Total before GST plus GST equals Total exactly, in integer cents.
- 4e. Given an exclusive quote, Then GST is still worked out once on the amount after discount.

**AC-5 (criterion 5): statement and agreement between preview and PDF**
- 5a. Given GST on and inclusive, Then preview and PDF both contain `Prices include GST`.
- 5b. Given GST on and exclusive, Then both contain `GST added at the rate shown`.
- 5c. Given GST off, Then neither contains either string, nor any GST row (B2).
- 5d. Given the quotes in AC-2a and AC-3a, Then every amount in the preview's totals is a character-for-
  character match of the matching text in the PDF's drawn text, and the title still says "Quotation",
  not "Tax invoice".
- 5e. Given a 40-line inclusive quote, Then the totals, the breakdown rows and the statement are all on
  the same (last) page, and no row of the table is split across pages (the existing test, run for
  inclusive).

**AC-6 (criterion 6): the quote file**
- 6a. Given an inclusive quote saved with "Save quote file", Then the JSON has `"version": 2` and
  `gst.inclusive` is `true`; opening it shows the switch on and the same figures.
- 6b. Given a version 1 file whose `gst` has `on: true` and no `inclusive`, Then it opens, GST on,
  exclusive, Total (SGD) the same as it was saved.
- 6c. Given a version 2 file with `"inclusive": "yes"`, or `1`, or `null`, or an object, Then it opens
  exclusive. It is not rejected as "doesn't look like a quote".
- 6d. Given a file with `"version": 3`, Then it is refused as today.
- 6e. Given an exclusive quote saved today, Then the JSON also says `"version": 2` and
  `"inclusive": false`.

**AC-7 (criterion 7): remembered settings**
- 7a. Given Remember ticked, GST on, inclusive on and the page reloaded after a second, Then GST is on,
  inclusive is on and the rate and registration number are as typed.
- 7b. Given Remember ticked, When Remember is unticked and the page reloaded, Then GST is off and
  inclusive is off.
- 7c. Given stored settings from before this change (`gst: { on: true, rate: "9", regNo: "" }`),
  Then the page starts with GST on and inclusive off.
- 7d. Given inclusive on, When "New quote" is confirmed, Then GST and inclusive are still on.

**AC-8 (criterion 8, as reworded in S2): no new figure**
- 8a. Given the new `copy.js` strings, Then none contains a digit except through the typed rate
  argument.
- 8b. Given the helper line and the labels, Then each passes `jura-growth check` (the developer runs it
  from `repos/growth`, `uv run jura-growth check "<text>"`).

**Edge criteria**
- AC-E1. Given no items, GST on and inclusive, Then Subtotal, Total before GST, Includes GST and Total
  all read 0.00, the statement is shown, and nothing is shown in red.
- AC-E2. Given one item of 50.00 and a whole-quote amount discount of 80.00, inclusive, Then Discount is
  -50.00, Total (SGD) 0.00, GST 0.00.
- AC-E3. Given one item of 1.00, inclusive, Then rate 0 gives GST 0.00 and before GST 1.00; rate 100
  gives GST 0.50 and before GST 0.50.
- AC-E4. Given quantity 1000 and unit price 99999.99, inclusive, rate 9, Then Total (SGD) 99,999,990.00,
  Includes GST (9%) 8,256,879.91 and Total before GST 91,743,110.09.

## Language

- `CONTEXT.md` terms **GST on**, **Prices exclude GST**, **Prices include GST** and **Total before
  GST** are used in the PRD without drift. The PRD's "GST field" (§1) is the user's word for the GST
  setting; the PRD handles it correctly as assumption A.
- **Discounted total** is overloaded; see S2. Add **Amount after discount** to `CONTEXT.md` and
  reword the "Total before GST" and "Prices include GST" lines to use it.
- The code field `taxable` means "amount before GST" in exclusive mode and "amount minus GST" in
  inclusive mode. That is consistent, and the label the visitor sees stays "Total before GST". No
  rename needed.
- A quotation says "Quotation", never "Tax invoice". The new strings contain neither "tax" nor "invoice".
  Keep it so (PRD §3 line 49; the original PRD §4 line 67).

## Notes (no change needed, worth knowing)

- **N1. IRAS facts I could not verify here.** I had no web access. Two things I believe but did not
  check, and neither changes what is built: the GST share of a GST-inclusive price is
  rate / (100 + rate), 9/109 at 9%; and working GST out once on the total, rounded to the cent, is an
  accepted method. The PRD's constraint (§4 line 58) already limits the claim to "IRAS-checked 9%".
  The product should not add a line of tax advice; that would be a new claim.
- **N2. A blank GST registration number** with GST on still prints a quote that charges GST with no
  registration number. This is today's behaviour in both modes and is outside this PRD.
- **N3. Version bump.** Writing version 2 for every file, including exclusive ones, means a stale tab
  cannot open even an exclusive quote saved by the new build. The alternative, writing 2 only when
  inclusive, keeps old files readable by old copies but means the version number lies about the
  format. Keep the PRD's choice; it is simpler and the stale-copy window is short.
- **N4. File with an unknown value silently opens exclusive** (criterion 6). On a hand-edited file that
  raises the total by GST without a warning. The PRD chose it on purpose, matching how `gst.on` reads.
  Keep it.
- **N5. Assumption A** (a "GST field" means the inclusive switch) is the thing for Ting Yu to confirm in
  the PR, as the PRD says. Nothing in this review argues against it.

## Verdict

Two blocking findings (B1, B2), both settled by a recommended answer the conductor can apply to the PRD
without asking the user. Six should-fix items. With B1 and B2 applied and S1 to S3 taken, every success
criterion has a Given / When / Then with concrete values, every edge is covered or ruled out, and the
UAT script is in `.scratch/quote-gst-inclusive/reviews/uat.md`.
