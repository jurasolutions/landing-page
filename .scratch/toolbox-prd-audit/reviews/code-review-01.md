# Code review 01: APP-003 PDF merge and split

Branch `crew/toolbox-prd-audit-01-app-003` (commits `fa318f1`, `d104c94`), reviewed against the fixed point `crew/toolbox-prd-audit` (`4f804cf`) with `git diff 4f804cf...HEAD`. Spec: `jurasolutions/prd/pending/apps/prd-app-003-pdf-merge-and-split-2026-10-24.md`. Ticket: `issues/01-app-003-pdf-merge-and-split.md`. Reviewed 2026-10-25.

## Verdict: approve

Nothing blocks. Every acceptance criterion the code can prove is met, no blocked path was touched, and the security pass found nothing at or above the confidence threshold. There are two *should fix* items that touch what a visitor gets: a merge quietly leaves out any file that has a problem (finding 1), and the thumbnail strip cannot be scrolled with the keyboard in Safari (U1). There are also two reuse items (findings 5 and 6). They can go into ticket 04 or a short follow-up. None of them needs to hold the ticket.

## Evidence I ran

| Command | Result |
|---|---|
| `npm test` (worktree) | 17 files, 225 tests passed (1.08 s) |
| `npm run build` (worktree) | `vite build` ok (1925 modules). The prerender wrote `apps.html`, `privacy.html`, `unsubscribed.html`, `apps/quote-builder.html` and `apps/pdf-merge-and-split.html` |
| Grep of the `dist/assets` chunks | The entry chunk (`index-DHc1pXQl.js`) contains no pdf-lib, fflate or pdf.js. pdf-lib sits in the chunk it shares with the quote builder (`PDFButton-*.js`), fflate in `browser-*.js`, and pdf.js in `pdf-VJcNm7C7.js` plus its worker. The tool's own `pdf-B3vx4G8c.js` imports those chunks lazily |
| `uv run jura-growth check-copy src/apps/pdf-merge-and-split/copy.js` (from `repos/growth`) | 41 of 41 strings pass |
| `uv run jura-growth check-copy src/apps/registry.json` | 6 of 6 strings pass |
| `git diff --name-only 4f804cf...HEAD -- src/design-system dist .dev.vars .env wrangler.toml .github` | empty: no blocked path touched |
| Probe: real encrypted PDFs written by macOS PDFKit (AES-128, `/V 4 /R 4`), one with an open password and one with an owner password only, passed through `readPdf` and `mergePdfs` (scratch script, outside the repo) | Both give `{ ok: false, reason: "encrypted" }`. pdf-lib's error has `constructor.name === "Error"`, which confirms that `instanceof EncryptedPDFError` fails at run time and the message match is what catches it. `mergePdfs([good, encrypted])` rejects with `reason: "encrypted", index: 1` |

### The developer's claims, checked

| Claim | Holds? |
|---|---|
| 225 tests pass | yes |
| The build writes `dist/apps/pdf-merge-and-split.html` | yes |
| check-copy 41/41 | yes |
| PDF and ZIP code live only in lazy chunks | yes (see the chunk grep) |
| Encrypted files are also detected from the error message, because `instanceof` fails | yes, and reproduced with real AES files |
| Kept pages come out in file order | yes (`ranges.js:40`, `ranges.test.js` "keeps each page once") |
| Split names are padded to the widest page number | yes (`names.js:24-28`) |
| "Seven extra strings beyond §5.2" | **understated.** There are 12 extra strings and 3 file-name words (see finding 3). Seven of them are visible sentences, which is probably what was counted |
| FileDrop gained an option to leave out its "or drop" line | yes. `dropNote` defaults to `true`, and neither existing caller passes it (`receipt-reader/index.jsx:179`, `QuoteForm.jsx:271`), so both render exactly as before |

---

## Per-criterion checklist (ticket 01)

Statuses are **met**, **partly** or **n/v** (needs a real browser or device).

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Merging portrait A4, landscape A4 and US Letter keeps the order, the page sizes, the rotation and selectable text | met | `pdf.test.js:37-61` checks the media boxes, the 90° page and the text read back with pdf.js. The fixtures are built with pdf-lib in `__fixtures__/fixtures.js`, not downloaded |
| 2 | Reordering by drag and by "Move up" and "Move down"; `order` is pure and tested | met (drag n/v on a device) | `order.js`, `order.test.js`, `pdf.test.js:63-71`; UI at `MergePanel.jsx:204-223` (drag) and `:241-262` (buttons) |
| 3 | `ranges` parses "1-3, 5, 8-10", ignores spaces, and rejects 0, reversed runs and pages past the end with the matching error | met | `ranges.js`; `ranges.test.js` has a case for each |
| 4 | "Split into single pages" gives a ZIP named `<name>-page-01.pdf` | met | `pdf.test.js:115-132`, `names.test.js` |
| 5 | Password-protected, damaged and non-PDF files each get their own message and leave the other files untouched | met (see finding 1 on the merge itself) | `pdf.test.js:134-168`, `files.test.js:44-50`. Each file is checked in its own `try` (`MergePanel.jsx:72-85`), and a failure during the merge marks only that file by index (`:117-122`). Reproduced with real AES files |
| 6 | Over 50 MB or more than 20 files are refused before anything is read | met | `admitFiles` (`files.js:16-21`) runs at `MergePanel.jsx:61`, before `arrayBuffer()` at `:76`. Split checks size at `SplitPanel.jsx:34`, before `:41`. `files.test.js` asserts that `arrayBuffer`, `slice`, `stream` and `text` are never called |
| 7 | No request carries file content; the only call is the usage counter | met (the network tab is n/v) | `offline.test.js` stubs `fetch` and also scans the source for any network API. `trackUsage` sends only `{ slug, event }`. pdf.js is given no font or CMap URL, so it fetches nothing |
| 8 | 360 px and desktop, 44 px targets, keyboard, labels, tokens only | partly | `IconButton size="lg"` is 48 px, tabs get `min-height: var(--tap-min)`, and inputs use `TAP`. The tab pattern has arrow keys, Home and End. Every input is labelled (`page.test.js:37`). Two gaps: the thumbnail scroller is not reachable by keyboard in Safari (U1), and there are raw px sizes in the CSS (finding 7). Real 360 px device check is n/v |
| 9 | All copy is PRD §5.2 wording and passes check-copy | met | Every §5.2 string is verbatim in `copy.js` and wired where §5.1 puts it. "Choose files" reaches the screen through `FILE_DROP.choose` in `src/content.js:108` (finding 2). 41/41 pass |
| 10 | Talk-to-us links to `/?from=apps/pdf-merge-and-split#contact` | met | The shared `AppShell` and `TalkToUsCard`, from the slug; the card copy is the §5.2 copy |
| 11 | Usage: `open` on page open, `complete` on each successful download | met | `AppShell.jsx:22-26`; `MergePanel.jsx:114` and `SplitPanel.jsx:77`, each after `saveBlob` and only on success |
| 12 | Registry `live`, `2026-10-24`, `APP-003`; prerendered page; tests and build pass | met | `registry.json`; `page.test.js:12`; build output above |
| 13 | README "APP-003" section and the tests table | met | `README.md` APP-003 section, the tests rows and the copy-files list |

Ticket notes:
- fflate is added and loaded lazily: met.
- The pdf.js pattern from `prepare.js` (legacy build, `?url` worker, `isEvalSupported: false`) is followed: met, but copied rather than shared (finding 5).
- No Jura footer, watermark or metadata, and the title is kept only for one file: met (`pdf.test.js:73-87, 97-105, 123-132`).
- Object URLs are released: met. Downloads are released by `download.js:12`; thumbnails by `Thumbnails.jsx:39-42` and by `thumbs.js:52`, which makes no URL once the viewer is closed.

The brief's points to watch:
- **Memory.** Thumbnails are drawn one at a time, only as they come into view, and kept as JPEG blobs. The canvas is zeroed after each one. pdf.js documents are destroyed on close (`thumbs.js:61-64`). A load that fails is not cleaned up (finding 4). File bytes leave state on Start again and Remove.
- **The FileDrop change** leaves the other two tools as they were (see the claims table).
- **The extra strings** pass check-copy and fit §3: sentence case, second person, short sentences, no buzzwords, no figures.

### Deviations from the letter of the PRD, judged

| Deviation | Judgement |
|---|---|
| Split refuses one file over 50 MB with its own line, "This file is over 50 MB. Try a smaller one." | **Reason holds.** The §5.2 line says "These files … together", which is wrong for one file |
| Separate messages for an empty box, a bad format and a reversed run; 0 and past-the-end share the §5.2 line | **Reason holds.** The phrase "with the matching error" asks for this, and the §5.2 line stays verbatim where it applies |
| "It has 1 page" for a one-page file | **Reason holds.** It follows §5.2's own "{n} pages" / "1 page" rule |
| Kept pages come out in file order, each page once | **Reason holds.** "Pages to keep" picks pages and does not rearrange them. The README documents it. If Ting Yu wants typed order later, it is one line in `ranges.js:40` |
| `-page-001.pdf` from 100 pages up | **Reason holds.** It keeps the ZIP sorted, and the README documents it |
| pdf-lib and fflate are fetched when the page goes idle, before a file is added | **Reason holds.** These are code chunks only and carry no file content |

---

## Findings

Findings are numbered once across all the sections and ranked within each one. Every finding was checked by reading the line.

### Spec

**1. Should fix: a merge quietly leaves out any file that has a problem.**
- **Spec:** §5.1 step 2 ("sees each file's name and page count … then clicks 'Merge and download'") and the PRD's promise of clear problem states. The ticket's "leave the other files untouched" is met, but the visitor is never told that the merged file is short.
- **What happens:** `ready` drops problem files (`MergePanel.jsx:40`). "Merge and download" stays enabled whenever one file is ready (`:304`), the merge uses only `ready` (`:112`), and the success line says "Your file is ready." Say someone puts together a five-document claim pack and one of the files is password protected. They get four documents and a success message. The red line on that row is the only clue.
- **Fix:** while any file has `status === "problem"`, show a warning above the button, for example "Files with a problem are left out. Remove them, or fix them and add them again." Run the new line through check-copy. Add a test that the warning shows when the list holds a problem file.

**2. Nit: `copy.buttons.choose` is never read.**
- `copy.js:49` holds the §5.2 "Choose files", but the button text comes from `FILE_DROP.choose` (`src/content.js:108`, `FileDrop.jsx:83`). The wording matches today, but the tool's copy file is no longer the place where that word is set.
- **Fix:** delete the key, or let `FileDrop` take a `chooseLabel` prop and pass `copy.buttons.choose`.

**3. Nit: the extra strings are more than the report said.**
- Beyond §5.2 there are `tabs.label`, `merge.listLabel`, `merge.moved`, `split.rangePlaceholder`, `split.pagesLabel`, `split.page`, `checking`, `errors.tooLargeOne`, `errors.rangeEmpty`, `errors.rangeFormat`, `errors.rangeReversed` and `errors.failed`, plus the file-name words `merged`, `selected` and `pages`. All of them pass check-copy and §3, so nothing needs to change. Record the full list in the PRD when it moves to `done/`, so the copy review has it.

**4. Nit: a pdf.js load that fails is never cleaned up.**
- **Spec:** §4, "so large files don't hold memory".
- **What happens:** `thumbs.js:30` awaits `getDocument(...).promise`. If that rejects (a `PasswordException`, or a file pdf-lib accepted but pdf.js cannot read), the loading task and its worker are never destroyed. Today this is rare, because pdf-lib refuses encrypted files first.
- **Fix:** keep the `loadingTask`, and call `loadingTask.destroy()` in a `catch` before rethrowing.

### Standards

**5. Should fix (reuse): the pdf.js loader and `toJpeg` are copied from the receipt reader.**
- **Rule:** reuse an existing helper instead of duplicating it (crew reviewer standard). The ticket asked to "reuse that pattern"; a shared module reuses it without a second copy.
- `thumbs.js:12-15` is the same function as `receipt-reader/prepare.js:30-33` (`toJpeg`, JPEG at 0.8). `thumbs.js:24-30` repeats `prepare.js:75-80` (the legacy build and worker `?url` loaded together, `workerSrc`, `getDocument({ isEvalSupported: false })`).
- **Fix:** add `src/apps/_shared/pdfjs.js` exporting `openPdfjs(bytes)` (which also fixes finding 4 in one place) and `canvasToJpeg(canvas, quality)`, and use it from both tools.

**6. Should fix (judgement call, Duplicated Code): one download flow written twice.**
- `MergePanel.jsx:106-128` and `SplitPanel.jsx:68-91` run the same steps: set working, `nextPaint`, `loadPdf`, `saveBlob`, `trackUsage("complete")`, set done, and in the catch either mark a per-file `reason` or set failed.
- **Fix:** add one small `useDownloadAction({ app, onProblem })` hook in the tool folder. Then the counter rule ("complete only after a successful download") lives in one place.

**7. Nits: tokens and naming.**
- **Raw sizes** (README: "no raw colour or spacing values", the same pattern as review 02 finding 17): `pdf-merge-and-split.css:93` (`112px`), `:95` (`560px`), `:110` (`112px`, `190px`), `:149` (`96px`), `:47` (`opacity: 0.5`). `thumbs.js:45` `#ffffff` is defensible as the visitor's paper, but give it a comment saying so.
- **The 44 px workaround again** (same pattern as review 02 finding 16): `pdf-merge-and-split.css:12` uses `!important`, and the `TAP` constant is repeated at `MergePanel.jsx:12` and `SplitPanel.jsx:13`. Fold this into the fix for finding 16 at source.
- **Paired magic numbers:** 112 appears in `thumbs.js:10` and the CSS; 120 appears in `names.js:14` and `MergePanel.jsx:294` (`maxLength`). Export the constants and use them in both places.
- **Mysterious Name:** the tool's `pdf.js` module shares its name with the pdf.js library it sits beside, so `index.jsx:7-10` and the README have to explain which one is meant. `documents.js` would read better. Also, `.pm-grip` holds a file icon in `SplitPanel.jsx:144`, where nothing is dragged.
- **Patching the design system from outside:** `index.jsx:34-51` sets `id`, `aria-controls` and `tabIndex` on the Tabs' buttons through the DOM and adds the arrow keys. This is right for now, since the design system is read-only. Raise the full tab pattern in the design system's `Tabs` at source (the same note as review 02 on Tabs keyboard behaviour), so the next tool does not copy this effect.

### Security

The security pass found **no vulnerability at confidence 8 or higher**. It checked:
- **Data leaving the browser:** the only request is `trackUsage` with `{ slug, event }`. There is no other `fetch`, beacon, XHR or WebSocket, and no error reporting. `console.error` stays local. pdf.js gets no font or CMap URL.
- **XSS:** file names, announcements and errors render as React text. There is no `innerHTML` or `dangerouslySetInnerHTML`. The PDF title is copied into the output and never rendered. Thumbnails are `blob:` JPEGs in `<img>`.
- **pdf.js:** the legacy build with `isEvalSupported: false` and a same-origin worker. Pages are drawn to a canvas only, with no annotation, text or XFA layer, so PDF links and scripts never run. 4.10.38 is past the CVE-2024-4367 fix.
- **ZIP and download names:** `names.js:7-15` replaces `/ \ :`, control characters and the other characters Windows refuses, and trims leading dots, so ZIP entries cannot traverse paths. The extension is always forced.
- **Encryption:** pdf-lib is never given `ignoreEncryption`. A password prompt from pdf.js also refuses the file (`SplitPanel.jsx:63-66`).
- **Secrets, blocked paths and dependencies:** no secrets, no `wrangler.toml`, no CI change. `fflate@0.8.3` is locked with an integrity hash.

These are below the threshold, as hardening only:
- `names.js:7` lets bidi override characters (U+202E) through in the visitor's own file name. This is cosmetic, because the extension is forced.
- `MergePanel.jsx:206` puts the file name into the drag data as `text/plain`, so a visitor who deliberately drags a row into another app hands it the name.

### UI (Web Interface Guidelines, against the design system)

**U1. Should fix: the thumbnail strip cannot be scrolled with the keyboard in Safari.**
- `Thumbnails.jsx:72` and `pdf-merge-and-split.css:95-96`: the `<ol>` scrolls (`max-height`, `overflow-y: auto`) but holds nothing focusable. Chrome makes such scrollers focusable; Safari does not. PRD §2: "Keyboard usable."
- **Fix:** add `tabIndex={0}` to the `<ol>` (it already has an `aria-label`) and give it a `:focus-visible` outline with the design system's focus token.

**U2. Nits:**
- `Thumbnails.jsx:57-66`: the observer's root is the viewport, so `rootMargin: "300px 0px"` gives no look-ahead inside the 560 px scroller. Pages are drawn only once they are visible in it. Pass `root: list`.
- `SplitPanel.jsx:187-189`: Enter runs "Download selected pages" even while an IME is composing. Check `!event.nativeEvent.isComposing`.
- `SplitPanel.jsx:31`: dropping several files on Split quietly takes the first one.
- `MergePanel.jsx:304`: "Merge and download" is disabled while files are being checked, with no reason given (the same pattern as review 02 U7). Finding 1's warning can cover the problem-file case.
- `MergePanel.jsx:263-273` and `SplitPanel.jsx:154-163`: Remove acts at once with no undo, and there is no `beforeunload` guard while files are held (the same pattern as review 02 U8).
- `copy.js`: straight apostrophes, and "50 MB" without a non-breaking space (the same pattern as review 02 U10).
- `SplitPanel.jsx:179`: the placeholder "1-3, 5" is an example pattern without a trailing `…`. Leave it; an ellipsis would read as part of the range.
- **Notes (the design system wins; not findings):** sentence case and the "we" voice override the guideline's title case. The tab state is not kept in the URL; for a two-tab tool that holds files in memory, that is fine. "This file isn't a PDF." and the damaged-file line come verbatim from §5.2, although the guideline would add a next step.

Checked and clean:
- Icon buttons carry `aria-label` through `IconButton label` and are described by the file name.
- Decorative icons are `aria-hidden`.
- Live regions are always in the page (`pm-live`, `Outcome`, the status on each row).
- The range error focuses the field and is announced through `aria-describedby`.
- `min-width: 0` is set on the file text, and long names wrap.
- Thumbnail `<img>` sits in an `aspect-ratio` frame sized from the page, so there is no layout shift.
- `content-visibility: auto` is set on the thumbnails.
- Transitions list their properties, and `site.css:432` handles reduced motion.

## Questions for Ting Yu

None that block. Finding 1 adds one sentence of copy; the recommended wording is above.
