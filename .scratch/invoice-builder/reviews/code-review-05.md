# Code review 05: fix QA defects 01 and 02

Branch `crew/invoice-builder-05-qa-fixes` at 7e3ef19, compared with its fixed point 58ba9b9 (the feature branch head it was cut from). Two commits, five files: `CONTEXT.md`, `src/apps/invoice-builder/FileActions.jsx`, `src/apps/invoice-builder/required.js`, `tests/invoice-builder-files-wiring.test.js` and `tests/invoice-builder-qa-defects.test.js`. Every changed file was read in full at 7e3ef19.

## Verdict: approve

No blocking findings. Both defects are fixed as the ticket asks, the tests were turned from `it.fails` to `it` (and strengthened, not weakened), defect 03 is untouched, nothing under `src/apps/quote-builder/` or any blocked path changed, and no copy was added. One nit about the live region and one about tests are below. Neither needs fixing before the gate.

## Evidence

| Command (in a throwaway worktree at 7e3ef19) | Result |
|---|---|
| `npx vitest run` | 59 files, 1128 passed, 2 expected fail (defect 03's two `it.fails`), exit 0. QA run 01 had 1119 passed and 8 expected fail: 6 `it.fails` became `it` and 3 tests were added (the mixed-text case, `gstRegNo` and `number`) |
| `npm run build` | exit 0, prerender ran |
| `required.js` put back to 58ba9b9, `qa-defects` test run | 8 failed: the new Chinese-only test and all 7 per-field cases. The tests catch the defect |
| `FileActions.jsx` put back to 58ba9b9, `files-wiring` test run | 1 failed: "DEFECT 01: keeps the D6 warning…". The test catches the defect |
| `git diff --stat 58ba9b9 7e3ef19 -- src/apps/quote-builder src/design-system` | empty |

## Standards

- **nit**: `src/apps/invoice-builder/FileActions.jsx:54-61`. The old code cleared the notice before reading the file, so picking a second bad file took the message away and put it back, and the `aria-live` region in `index.jsx:217` read it out again. Now `badFile` is already `true`, so the DOM doesn't change and a screen reader hears nothing about the second refused file. The same happens with two inclusive quotes in a row, but there the "Quote opened" toast still speaks. This is a small accessibility regression and the ticket doesn't cover it. Suggested fix: add a pick counter as the `key` on the bad-file `FileNotice`. This was found by reading the code; the hook test harness reads text, not announcements, so it couldn't be reproduced there.
- No reuse findings. `blank` reuses the PDF's own `toPrintable` (`required.js:19,27`), so "missing" means exactly what `pdf.js` drops (`pdf.js:85` prints `toPrintable(value)`). It doesn't add a second character filter. Importing from `../quote-builder/` follows an existing pattern (`model.js:22`, `invoiceFile.js:12-23`, `pdf.js:26`).
- The comments are accurate and point to QA defect 02 and PRD §2 criterion 6.

## Spec (ticket 05, qa-01 §Defects, decisions D4 and D6)

- **Defect 02: a field counts as missing only when nothing of it would print.** Met. `blank = !toPrintable(String(value ?? "")).trim()` (`required.js:27`). A field with mixed text passes: "still passes a field with some printable text" (`invoice-builder-qa-defects.test.js:50-54`) uses "陈氏贸易 Tan Trading" and "新加坡 Singapore 123456". Spaces only, and text that is only line breaks after filtering, still count as blank because of `trim`.
- **Every D4 text field is covered.** Met. Business name, business address, GST registration number, customer name, customer address, invoice number and each counted item's description all go through `blank` (`required.js:45-50,62`). The "Items" link target does too (`required.js:58`). The invoice date (ISO check) and the GST rate (from `calc.js`) aren't free text, so they are rightly left alone. The per-field table now includes `gstRegNo` and `number` (`invoice-builder-qa-defects.test.js:61-62`), so all seven text fields are tested.
- **Entry and link unchanged, no new copy.** Met. `copy.js` is untouched, and the new test asserts the existing `{ key, label, target }` entries (`invoice-builder-qa-defects.test.js:32-35`).
- **Defect 01: a refused file leaves the D6 warning.** Met. The single `notice` became two flags. A bad file sets only `badFile` (`FileActions.jsx:55-58`), so `inclusive` survives. A good file resets both (`:60-61`). "New invoice" calls `files.clear()` (`index.jsx:197`), which resets both (`FileActions.jsx:90-93`). The existing wiring tests still pass: a good file clears the bad-file message, an ordinary file clears D6, and New invoice clears each one (`invoice-builder-files-wiring.test.js:229-261`).
- **Tests turned, not weakened.** Met. The wiring test kept its assertions and only lost `.fails` (`:269`). The test that pinned defect 02 as it stood now pins the fix: entries listed, `missing` returned, and `build` never called (`:28-48`). The `it.fails.each` table became `it.each` and gained two rows.
- **Defect 03 untouched.** Met. The diff ends before the defect 03 block, and its two `it.fails` still report as expected fails.
- **`CONTEXT.md`** now says what "missing" means (line 38), as D4 asks the glossary to follow.
- **nit (tests)**: no wiring test covers the full path in one go: inclusive quote, then a bad file, then a good ordinary file, ending with both messages gone. Each step is covered on its own and the code clearly handles the chain, so this is optional.

## Security

No findings. The change is pure client-side logic with no network, storage, auth, secrets or SQL. `toPrintable` only filters characters, so nothing new reaches the PDF. The file reader (`openPickedFile`) is unchanged, so the bad-file refusal path is the same as before.

## Blocked paths

None touched (`src/design-system/`, `dist/`, `.dev.vars`, `.env`). `src/apps/quote-builder/` is unchanged.
