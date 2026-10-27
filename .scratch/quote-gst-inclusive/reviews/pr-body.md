## Summary

The quote builder can now price the way many Singapore shops, clinics and tutors do: one figure that already includes GST. With "Add GST" on, a new switch, "Prices include GST", sits under the rate. It is off by default, so nobody's quote changes until they choose it.

When the switch is on, the total is the amount after discount. The GST is worked out once, from that total, and shown as the part of it that is tax. It is never added on top.

```text
Prices exclude GST (as today)      Prices include GST (new)
Subtotal            159.80         Subtotal            159.80
Discount            -15.98         Discount            -15.98
GST (9%)             12.94         Total (SGD)         143.82
Total (SGD)         156.76           Total before GST  131.94
GST added at the                     Includes GST (9%)  11.88
rate shown                         Prices include GST
```

How it is put together:

```text
src/apps/quote-builder/
├── calc.js            # quote.gst.inclusive: GST = round half up (amount x rate / (100% + rate)), once
├── totals-rows.js     # new: one function decides which totals rows exist and what they say
├── QuotePreview.jsx   # draws the rows from totals-rows.js
├── pdf.js             # draws the same rows, so preview and PDF cannot drift
├── QuoteForm.jsx      # the switch and one helper line, only while Add GST is on
├── model.js           # default inclusive: false
├── quoteFile.js       # saved file version 1 -> 2
└── index.jsx          # "Remember my business details" keeps the choice
docs/adr/              # 0003 and 0004 record the two decisions
```

Two tickets built it. The first only moved the "which totals rows exist" decision into one place, with no change to what anyone sees (preview and PDF output were byte-identical before and after). The second added the feature on top.

## Things to know before you merge

**The request was ambiguous.** The request was "add a GST field", but GST was already on the quote builder: an Add GST switch, a rate (9% by default) and a registration number. The PRD records this as assumption A. I chose to read it as "make the GST setting more capable", and the smallest useful version of that is the include/exclude switch. The other options were:

- Per-line GST, so a quote can mix standard-rated, zero-rated and exempt lines. Larger, and it changes the line model. Left out, and listed as out of scope in the PRD.
- Another GST field, such as a second rate or a separate tax label. It would duplicate what is already there.
- Doing nothing, because the field exists. This does not help a visitor who prices GST-inclusive.

If assumption A is wrong, this PR is the thing to stop on. Everything else in the PRD's assumptions (default stays exclusive, the switch lives in the existing GST block, a bad stored value reads as exclusive) is cheap to change.

**The sign-off does not cover merging.** The PRD was signed off by a standing instruction to build, push the branch and open a pull request without asking. That instruction does not cover merging, and a merge to `main` is a production deploy. Please review this before you merge it.

**One PRD file lives outside this repo.** `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` is not part of this PR. Once this ships and you accept it, move it to `jurasolutions/prd/done/apps/` with the ship date at the top.

**No figure Jura cannot evidence was added.** The new wording holds no digit at all. The only number that can appear is the GST rate the visitor typed, which defaults to 9%. A test asserts the new strings contain no digit.

## Evidence

- **Before:** a price of 109.00 at 9% is read as before GST, so the builder adds 9.81 and the customer is quoted 118.81. A shop that quotes 109.00 all-in has to divide by 1.09 by hand first.
  **After:** with Prices include GST on, the total stays 109.00, shown as 100.00 before GST plus 9.00 GST.

```text
it("keeps the typed total and splits out the GST", () =>
  quote = one item at 109.00, GST on at 9%, inclusive
  totals = quoteTotals(quote)
  expect(totals.total).toBe(10900n)   // before: 11881n
  expect(totals.gst).toBe(900n)
  expect(totals.taxable + totals.gst).toBe(totals.total)
)
```

- `npm test`: 39 files, 735 tests pass (630 before, 105 new). Run again after merging the latest `main` into this branch.
- `npm run build`: exits 0, every route prerendered.
- Exclusive mode is unchanged to the cent. `calc.test.js` is untouched, and old and new `calc.js` give identical results over 116,784 exclusive quotes.
- Inclusive mode: before GST plus GST always equals the total exactly. A property run of 240,000 or more cases is part of the test suite. QA ran 600,000 more with seeds of their own, with no violations.
- QA drove the real app in Chromium at desktop and phone width, ran the 11 UAT scenarios (all pass), and looked at the PDFs as images. Details are in `.scratch/quote-gst-inclusive/reviews/qa-01.md`.
- Two code reviews approve with no blocking findings. The quality gate says GO.

## Merge Danger

**Door:** two-way.

Nothing is stored on a server, nothing is migrated and no setting changes. Rolling back is a revert, or the Pages dashboard's "Rollback to this deployment", which is instant.

**Blast Radius:** the quote builder only.

- **Saved files move from version 1 to version 2.** Files saved before this change still open and read as "prices exclude GST". Files saved after it carry the new choice. A copy of the old app that someone left open in a browser tab cannot open a version 2 file: it shows "That file doesn't look like a quote saved from this tool." and keeps the quote on screen. A refresh fixes it. The same applies if this change is rolled back after people have saved version 2 files.
- **The remembered business details** now include the choice. The old app ignores it, so a rollback is harmless there.
- **PDF layout.** When a GST split or statement prints, the gap above Notes is 14pt rather than 30pt. For exclusive quotes the layout is effectively unchanged, and page counts match `main` for 3 to 46 lines.
- Not tested: Safari and Firefox (no new browser API is used), a real screen reader, and two browser tabs open at once.
- Not changed, and noticed along the way: a blank or invalid GST rate still lets the PDF download, so an inclusive PDF can say "Includes GST (0%)" beside the red message on the form. Exclusive mode already behaves this way. It is worth a small ticket if you want it, but it is not part of this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019XQAhhdG1KGX41UyVBaT2o
