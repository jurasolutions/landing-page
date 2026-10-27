# UAT script: Quote builder, "Prices include GST"

*For a person who is not a developer. About 40 minutes. Written 2026-10-27 by the functional lead, crew
run `quote-gst-inclusive`. Companion to `.scratch/quote-gst-inclusive/reviews/functional.md`.*

Every figure below was worked out by hand from the way the builder rounds (to the nearest cent, half a
cent rounds up, GST worked out once on the whole total). If a figure on screen differs by even one
cent, that is a finding, so write down the scenario number and what you saw.

## Before you start

1. **Where to open it.** Either:
   - the preview link for the pull request on `crew/quote-gst-inclusive` (the conductor fills in the
     link here: `______________________`), or
   - on the machine with the code: in a terminal, `npm run dev`, then open
     `http://localhost:5173/apps/quote-builder`.
2. **Use a clean browser window** (a private or incognito window is ideal, so nothing is remembered from
   earlier).
3. The "Draft with AI" box at the top may show an error when you run the page locally. That is normal;
   ignore it. Do not use it.
4. **What the words mean.** "Preview" is the paper-style quote on the right (on a phone, press the
   "Preview" button). "Download PDF" makes the file you would email to a customer.
5. Keep a pen and the tick boxes below. A scenario passes only if every line in "You should see" is true.

**The quick vocabulary used here**

| On the page | What it means |
|---|---|
| Add GST | The existing switch. GST is only in the quote when it is on. |
| Prices include GST | The new switch. It appears only after "Add GST" is on. |
| Total (SGD) | The amount the customer pays. |
| Total before GST | The total with the GST taken out. |
| Includes GST (9%) | The GST that is already inside the total (inclusive quotes). |
| GST (9%) | The GST that is added on top (exclusive quotes, as today). |

---

## Scenario 1. Nothing changes until you ask (default behaviour)

**Why:** nobody's existing way of quoting should change.

1. Open the page. Scroll to "Discount and GST".
2. In "Item 1": Description `Aircon servicing`, Quantity `2`, Unit price (SGD) `100`.
3. Turn **Add GST** on. Leave everything else.

**You should see**
- [ ] Under the GST rate and registration number there is a switch called **Prices include GST**, and it is **off**.
- [ ] Under the line in the preview: Subtotal **200.00**, GST (9%) **18.00**, Total (SGD) **218.00**.
- [ ] There is no row called "Total before GST" (there is no discount).
- [ ] A short line near the total says **GST added at the rate shown**.
- [ ] Turn **Add GST** off: the GST row and the line "GST added at the rate shown" disappear, and the
      Total (SGD) is **200.00**. The "Prices include GST" switch disappears too.
- [ ] Turn **Add GST** on again. Leave it on for the next scenario.

## Scenario 2. Inclusive: the total stays as typed

**Why:** the owner quoted 200.00; the customer must be asked for 200.00.

Continue from Scenario 1 (item `2 x 100`, Add GST on).

1. Turn **Prices include GST** on.

**You should see**
- [ ] Total (SGD) is **200.00** (it must not be 218.00).
- [ ] **Includes GST (9%)** is **16.51**.
- [ ] **Total before GST** is **183.49**.
- [ ] The line near the total now says **Prices include GST** (and no longer says "GST added at the rate shown").
- [ ] Add 183.49 + 16.51 on your phone: it is exactly 200.00.
- [ ] Turn the switch off, then on again: the figures flip between 218.00 and 200.00 each time.

## Scenario 3. Rounding, cent by cent

**Why:** GST is worked out once, on the whole total, and rounded to the nearest cent.

Keep "Add GST" and "Prices include GST" on. Change the **Quantity to 1** and the **Unit price** in turn
(delete the 100 and type the new price, then click away). Check each row.

| Unit price (SGD) | Total (SGD) | Includes GST (9%) | Total before GST |
|---|---|---|---|
| 109.00 | 109.00 | 9.00 | 100.00 |
| 100.00 | 100.00 | 8.26 | 91.74 |
| 19.99 | 19.99 | 1.65 | 18.34 |
| 1.00 | 1.00 | 0.08 | 0.92 |
| 0.50 | 0.50 | 0.04 | 0.46 |

- [ ] All five rows match.

Now do the "once, not per line" check. Remove the item's price and make **three items** of quantity 1,
unit price `1.00` each (use "Add item" twice).

- [ ] Total (SGD) **3.00**, Includes GST (9%) **0.25**, Total before GST **2.75**. (If you see 0.24 the
      builder has worked out GST for each line and added them up: that is a defect.)

## Scenario 4. Discounts, inclusive and exclusive side by side

**Why:** a discount comes off the price the customer sees; GST is worked out from what is left.

1. Click "New quote" and confirm ("Start a new quote"). Add GST and Prices include GST stay on.
2. Item 1: Description `Dental chair service`, Quantity `2`, Unit price `59.90`.
3. Add item. Item 2: Description `Call-out fee`, Quantity `1`, Unit price `40.00`.
4. In "Discount on the whole quote", choose **Percentage off**, type `10`.

**You should see (inclusive)**
- [ ] Subtotal **159.80**; Discount **-15.98**.
- [ ] Total (SGD) **143.82**.
- [ ] Includes GST (9%) **11.88**.
- [ ] Total before GST **131.94**.
- [ ] Reading down the totals, 159.80 minus 15.98 gives the bold Total (SGD) 143.82 before any GST wording
      appears (if the figure 131.94 sits between the discount and the total instead, note it as a
      finding: it looks like an arithmetic error to a customer).

Now turn **Prices include GST** off.

**You should see (exclusive)**
- [ ] Subtotal **159.80**; Discount **-15.98**; Total before GST **143.82**; GST (9%) **12.94**;
      Total (SGD) **156.76**.

Turn it back on, then try a line discount: in Item 1 set Discount to **Percentage off** `10`, and in Item 2
to **Amount off** `5`; clear the whole-quote discount (choose "No discount").

- [ ] Item 1 line total **107.82**, Item 2 line total **35.00**, Subtotal **142.82**. (Inclusive: Total (SGD)
      **142.82**, Includes GST (9%) **11.79**, Total before GST **131.03**.)

## Scenario 5. The PDF says the same as the preview

**Why:** the customer only ever sees the PDF.

1. Use the quote from Scenario 2: New quote, Add GST on, Prices include GST on, one item `Aircon
   servicing`, Quantity `2`, Unit price `100`. Fill in Business name `Tan Brothers` and Customer company
   `Harbourfront Dental`.
2. Press **Download PDF** and open the file.

**You should see in the PDF**
- [ ] The heading says **Quotation** (not "Tax invoice").
- [ ] Total (SGD) **200.00**, Includes GST (9%) **16.51**, Total before GST **183.49**: the same as the preview.
- [ ] The words **Prices include GST** appear once, near the totals.
- [ ] Nothing is cut off, overlapping, or alone on a second page.

3. Turn **Prices include GST** off and download again.
- [ ] The PDF says **GST added at the rate shown**, GST (9%) **18.00**, Total (SGD) **218.00**.

4. Turn **Add GST** off and download again.
- [ ] The PDF has **no** GST row and says neither "Prices include GST" nor "GST added at the rate shown". Total (SGD) **200.00**.

## Scenario 6. Save a quote and open it again

**Why:** a quote saved on Monday must be the same on Friday.

1. Set up the inclusive quote from Scenario 2 (Add GST on, Prices include GST on). Number it `Q-0100`.
2. Press **Save quote file**. A file called `Q-0100.quote.json` is saved.
3. Press **New quote**, confirm. Turn **Prices include GST** off. Check the form is a fresh one.
4. Press **Open quote file** and choose `Q-0100.quote.json`.

**You should see**
- [ ] A "Quote opened" message.
- [ ] **Add GST** on and **Prices include GST** on again.
- [ ] Total (SGD) **200.00**, Includes GST **16.51**, Total before GST **183.49**.

## Scenario 7. A quote saved before this change

**Why:** old quotes must open as they were: GST on top.

1. In a plain text editor (Notepad, TextEdit in plain-text mode), create a file called
   `old-quote.quote.json` containing exactly this, and save it:

```json
{
  "format": "jura-quote-builder",
  "version": 1,
  "savedAt": "2026-10-20T09:00:00.000Z",
  "quote": {
    "business": { "name": "Tan Brothers" },
    "customer": { "company": "Harbourfront Dental" },
    "details": { "number": "Q-0042", "date": "2026-10-20", "validUntil": "2026-11-19" },
    "items": [{ "description": "Aircon servicing", "quantity": "2", "unitPrice": "100.00" }],
    "gst": { "on": true, "rate": "9", "regNo": "M90312345A" },
    "notes": "Prices are in Singapore dollars."
  }
}
```

2. Press **Open quote file** and choose it.

**You should see**
- [ ] It opens ("Quote opened").
- [ ] **Add GST** on, **Prices include GST** off.
- [ ] Subtotal **200.00**, GST (9%) **18.00**, Total (SGD) **218.00**.

3. Now edit the same file in the text editor: change `"version": 1` to `"version": 2` and change the
   `"gst"` line to `"gst": { "on": true, "rate": "9", "regNo": "M90312345A", "inclusive": "yes" },`.
   Save and open it.
- [ ] It opens, with **Prices include GST** off and Total (SGD) **218.00**. (A word where there should be
      a yes/no is treated as "no", and the file is not refused.)

4. Edit once more: change `"inclusive": "yes"` to `"inclusive": true`. Save and open it.
- [ ] **Prices include GST** is on and Total (SGD) is **200.00**.

5. Edit once more: change `"version": 2` to `"version": 3`. Save and open it.
- [ ] A red message: "That file doesn't look like a quote saved from this tool." The quote on screen is unchanged.

## Scenario 8. "Remember my business details"

**Why:** the owner should not have to choose again each visit.

1. Click **New quote**. Fill in Business name `Tan Brothers`. Tick **Remember my business details on this device**.
2. Turn **Add GST** on, **Prices include GST** on, set GST rate `9`, registration number `M90312345A`.
3. Wait two seconds, then reload the page (browser refresh).

**You should see**
- [ ] Business name `Tan Brothers`, Add GST **on**, Prices include GST **on**, rate `9`, registration number `M90312345A`.
- [ ] A new quote's Total (SGD) equals what you type (try an item `1 x 50.00`: Total (SGD) **50.00**,
      Includes GST (9%) **4.13**, Total before GST **45.87**).

4. Press **New quote** and confirm.
- [ ] Add GST and Prices include GST are still on.

5. Untick **Remember my business details on this device**, wait two seconds and reload.
- [ ] Everything is back to the start: Add GST **off**, no business name.

## Scenario 9. Edges that should not break

Start from a new quote with Add GST and Prices include GST on.

1. **No items.** Remove the only item (the bin button) and look at the preview.
   - [ ] Totals read **0.00**, GST included **0.00**, no red messages, and the statement "Prices include GST" is still shown.
2. **Discount bigger than the quote.** Add an item `1 x 50.00`. In "Discount on the whole quote", choose **Amount off** and type `80`.
   - [ ] Discount shows **-50.00**, Total (SGD) **0.00**, GST **0.00**. Nothing negative anywhere.
3. **Rate 0.** Remove the discount. Set GST rate `0`.
   - [ ] Includes GST (0%) **0.00**, Total before GST **50.00**, Total (SGD) **50.00**.
4. **Rate 100** (the highest allowed). Set GST rate `100`.
   - [ ] Includes GST (100%) **25.00**, Total before GST **25.00**, Total (SGD) **50.00**.
5. **Blank rate.** Clear the GST rate box.
   - [ ] A red message under it ("Use a number, like 120 or 120.50."), the page keeps working. Set it back to `9`.
6. **Large amount.** Set the item to Quantity `1000`, Unit price `99999.99`, rate `9`.
   - [ ] Total (SGD) **99,999,990.00**, Includes GST (9%) **8,256,879.91**, Total before GST **91,743,110.09**,
         and the numbers fit on screen.

## Scenario 10. Keyboard and phone

1. With the keyboard only (no mouse): press Tab until the focus ring is on **Prices include GST**, then press Space.
   - [ ] The switch turns on and off, the preview changes, and you can always see where the focus is.
   - [ ] A screen reader (or the label on hover) reads "Prices include GST" followed by its helper sentence.
2. Make the window phone-narrow (about 375 pixels wide), or open the page on your phone.
   - [ ] The switch and its helper sentence sit under the GST rate, nothing is cut off, and the switch is easy to tap.
   - [ ] Press **Preview**: the statement and the totals are readable without sideways scrolling.

## Scenario 11. The words

Read the new wording out loud: the switch label, its helper sentence, the totals labels and the statement.

- [ ] It sounds like a person talking, sentence case, no exclamation marks, no jargon.
- [ ] No sentence promises or quotes a number (no example prices, no "save X", no percentages other than the rate you typed).
- [ ] Nowhere does the quote call itself a tax invoice.

---

## What to send back

For each scenario: **Pass**, **Fail** or **Not sure**. For any Fail, write the scenario number, the step,
what you expected and what you saw (a screenshot helps).

| Scenario | Result | Notes |
|---|---|---|
| 1 Default unchanged | | |
| 2 Inclusive total as typed | | |
| 3 Rounding | | |
| 4 Discounts | | |
| 5 PDF matches preview | | |
| 6 Save and open | | |
| 7 Old file and bad values | | |
| 8 Remember | | |
| 9 Edges | | |
| 10 Keyboard and phone | | |
| 11 The words | | |

**Accept the work when** scenarios 1 to 9 all pass. Scenarios 10 and 11 should pass; a failure there is
fixed before release but does not change what the quote says.

## Not covered by hand (the automated tests cover these)

- A 40-line quote that runs to a second PDF page (typing 40 items by hand is impractical).
- Remembered details saved by the old version of the page (needs the browser's developer tools).
- Every combination of rate, price, quantity and discount adding up to the cent.
