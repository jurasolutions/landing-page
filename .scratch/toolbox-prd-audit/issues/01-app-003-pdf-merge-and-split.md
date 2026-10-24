# 01 — Build APP-003 PDF merge and split

Status: ready-for-agent
Blocked by: none

## What

Build the tool described in `jurasolutions/prd/pending/apps/prd-app-003-pdf-merge-and-split-2026-10-24.md`, end to end, as the third tool in the toolbox. It follows the toolbox conventions in `README.md` ("The toolbox"): one folder `src/apps/pdf-merge-and-split/` with `index.jsx` and `copy.js`, plus one entry in `src/apps/registry.json`. Nothing else should need wiring.

## Acceptance criteria

Every checkbox in the PRD's §2, made concrete:

- [ ] Merging three fixture PDFs (portrait A4, landscape A4, US Letter) gives one PDF with every page in the chosen order, original page sizes and rotation kept, and text still selectable. Unit-tested against fixtures in `src/apps/pdf-merge-and-split/__fixtures__/` (generate them with pdf-lib in a script or at test time; no files from the internet).
- [ ] Reordering by drag and by "Move up" / "Move down" changes the merged order. `order` is a pure module with unit tests.
- [ ] `ranges` parses "1-3, 5, 8-10", ignores spaces, and rejects "0", reversed ranges and pages past the end with the matching error. Unit tests for each case.
- [ ] "Split into single pages" gives a ZIP with one PDF per page, named `<original name>-page-01.pdf` and so on. Unit-tested.
- [ ] A password-protected PDF, a damaged PDF and a non-PDF each show their own message and leave the other files in the list untouched. Unit-tested at the `pdf` module level.
- [ ] Files over the size limit (50 MB total) and more than 20 files are refused before they are read.
- [ ] No request carries file content. The only network call is the existing anonymous usage counter.
- [ ] 360 px wide and desktop; 44 px tap targets; keyboard usable; every input labelled; design-system tokens only.
- [ ] All copy is the PRD §5.2 wording and passes `uv run jura-growth check-copy <path to copy.js>` (run from `../growth`).
- [ ] Talk-to-us card links to `/?from=apps/pdf-merge-and-split#contact` (the shared `AppShell` does this from the slug).
- [ ] Usage counter: `open` on page open (the shell does it), `complete` on each successful merge or split download.
- [ ] Registry entry `status: "live"`, `added: "2026-10-24"`, `prd: "APP-003"`; the prerender writes `dist/apps/pdf-merge-and-split.html`; `npm test` and `npm run build` pass.
- [ ] README gains an "APP-003 PDF merge and split" section in the style of the APP-001 one, and the tests table lists the new test files.

## Notes

- `pdf-lib` and `pdfjs-dist` are already dependencies; add `fflate` for the ZIP. Lazy-load all three in this tool's chunk.
- The receipt reader loads pdf.js in `src/apps/receipt-reader/prepare.js`; reuse that pattern (legacy build, `?url` worker, `isEvalSupported: false`).
- Merged and split files carry no Jura footer, watermark or metadata. Keep the source title only when one file is involved.
- Release object URLs after download (`src/apps/_shared/download.js` already does).
