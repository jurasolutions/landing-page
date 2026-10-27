# 04 Defect: on a laptop, "Save or share" opens the share sheet and never downloads the picture

Status: resolved
Severity: major (PRD §2 criterion 5 fails for desktop visitors on Chrome, Edge and Safari)
Found by: QA-01 (`reviews/qa-01.md`, case C5-6), 2026-10-27, on `crew/food-post-maker` at 4ab403e (59fc33c changes only the README)
Failing test: `.scratch/food-post-maker/qa/regressions/save-mode.test.js`
(run with `npx vitest run --config .scratch/food-post-maker/qa/regressions/vitest.config.js`; kept out of `npm test` until the fix)

## What happens

The save button picks its mode with `saveMode(navigator, file)` in
`src/apps/product-photo-studio/compose.js`: "share" whenever `navigator.canShare({ files: [jpg] })`
is true, otherwise "download". Desktop Chrome and Edge (Windows, macOS, ChromeOS) and Safari on
macOS all answer true. So on a laptop the button reads "Save or share" and opens the operating
system's share sheet. Windows' share sheet has no "save to this PC" choice, and macOS offers only
AirDrop, Mail, Messages, Notes, Photos and similar. A visitor who closes the sheet gets nothing:
`PostFrame.jsx` returns on `AbortError` without falling back to a download.

The functional review's S3 asked for the share sheet so that an iPhone can put the picture in
Photos. It did not intend to take the download away from desktops. The conductor accepted S3 in
the `canShare` form, which reaches further than S3 meant.

## Steps

1. `npm run dev` and open http://localhost:5173/apps/product-photo-studio in desktop Chrome at
   1280 px. (QA ran it in Playwright's Chromium with `/api/apps/limit`, Turnstile and the studio's
   POST stubbed. The stubs are described in `reviews/qa-01.md`.)
2. Add a product photo and press "Make my posts". Wait for the three frames.
3. Look at a frame's save button, then press it.

## Expected

On a desktop browser the button reads "Download picture", and pressing it saves
`<look>-portrait.jpg` (1080 x 1350) or `<look>-square.jpg` (1080 x 1080) to the downloads folder.
Phones keep "Save or share" and the share sheet (S3).

## Actual

The button reads "Save or share". Pressing it calls `navigator.share({ files: [clean-white-studio-portrait.jpg] })`.
No download happens. QA's capture: `shareCalls: [["clean-white-studio-portrait.jpg","image/jpeg",37126]]`,
then `no download: page.waitForEvent: Timeout 8000ms exceeded`. With `canShare` forced to false,
the same button downloads files that measure exactly 1080 x 1350 and 1080 x 1080, so composing the
JPG works. Only the choice of path is wrong.

## Evidence

- `.scratch/food-post-maker/qa/04-desktop-results.png`: the "Save or share" label on a 1280 px desktop.
- `.scratch/food-post-maker/qa/dl-morning-counter-portrait.jpg` and `dl-morning-counter-square.jpg`:
  the download path, measured with `sips` at 1080 x 1350 and 1080 x 1080.
- Red test output: `downloads on a desktop browser, even one that can share files`:
  expected "download", received "share". The guard case for phones passes.

## Suggested fix (for the developer to decide)

Offer the share sheet only on touch devices, for example `nav.maxTouchPoints > 0` (or
`matchMedia("(pointer: coarse)")`) alongside `canShare`. Then move the two cases from the red
test into `tests/product-photo-studio-ui.test.js` next to the S3 test. If the closed sheet should
still save something, fall back to `saveBlob` on `AbortError` as well. That second change is
separate and optional.
