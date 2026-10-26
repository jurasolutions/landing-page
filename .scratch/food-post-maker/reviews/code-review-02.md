# Code review 02: the Product photo studio page (browser)

Branch `crew/food-post-maker-02-browser` (364e3c3, 3e026a6) against its merge-base with
`crew/food-post-maker` (f153738), `git diff crew/food-post-maker...crew/food-post-maker-02-browser`.
17 files, all read. Reviewed 2026-10-27.

## Verdict: approve

There are no blocking findings. The browser matches ticket 01's contract field for field. Nothing
changes under `src/design-system/` or any other blocked path. Tests and the build pass on the
branch and on a trial merge with ticket 01, and the copy passes `jura-growth check`. The
*should fix* items below are small. They can be fixed on this branch before ticket 03 or folded
into it, and none of them needs another review round.

## Evidence

- `npx vitest run` on the branch: 29 files, 431 tests passed.
- `npx vitest run` on a trial merge of 01 and 02 (`trial-merge` 561a013): 33 files, 537 tests passed.
- `npm run build` on the branch: built in 9 s, prerender ok. pdf.js stays in its own lazy chunks
  (`pdf-*.js`). The studio's `photos-*.js` chunk is 1.75 kB.
- `uv run jura-growth check --file` over all 79 strings in `copy.js` plus the new /privacy
  paragraph: `pass`.
- Blocked paths: `git diff --name-only` shows nothing under `design-system/`, `inputs/`,
  `dist/`, `.dev.vars` or `.env`.
- The `tests/shell.test.js` "every tool is General" test is unchanged. The only addition is the
  Cloudflare Workers AI privacy assertion.
- The developer's 320 px screenshot (scratchpad `phone-results.png`) shows no horizontal overflow.
  The frames stack, and the buttons are full width.

## Standards

**Blocking:** none.

**Should fix**

1. **`LimitArea` duplicates an existing component.** `src/apps/product-photo-studio/index.jsx:31-46`
   is a verbatim copy of the exported `LimitArea` in `src/apps/receipt-reader/index.jsx:29-44`,
   which already takes `copy` as a prop. Import it, or move it to `src/apps/_shared/` next to
   `TryLimitNotice` and `TalkToUsCard` (README "The toolbox": shared pieces live in `_shared/`).
   Rule: reuse before you duplicate.
2. **`pictureName` re-implements `safeFilename`.** `compose.js:35-45` re-implements
   `src/apps/_shared/download.js` `safeFilename` (NFKD, strip, slice 60, fallback). Use
   `safeFilename(look.toLowerCase(), "product-photo")`, or give `safeFilename` a lowercase
   option, and keep the existing tests for `<look-slug>-<shape>.jpg`.

**Nit**

3. **README not updated.** README.md:178-184 still calls `storage.js` "localStorage that never
   throws", and the shared-pieces list leaves out `_shared/photos.js`. Fold this into ticket 03's
   README work.
4. **Cross-tool imports.** `post-state.js:7` and `index.jsx:11-12` import `failureMessage`,
   `isOutOfTries`, `showsTalkCard` and `fileMessage` from `../receipt-reader/`. A later prefactor
   could move them to `_shared/`. This is the same family as finding 1.
5. **Thin wrappers left by the refactor.** `prepare.js:16` `photoKind = (file) => imageKind(file)`
   only passes through. `receipt-reader/prepare.js:16-24` `kindOf` still computes `name` and
   `type`, then calls `imageKind`, which computes them again.
6. **Third copy of the add and remove logic.** `addPhotos` and `removePhoto` (`index.jsx:113-142`)
   repeat the receipt reader's `addFiles` and `removeFile`, and `.pps-toast`, `.pps-thumb` and
   `.pps-photo` repeat the `rr-` and `qb-` CSS. This is acceptable for now. A third tool that
   takes photos would justify a shared hook.

Dismissed: the `CONTEXT.md` glossary on this branch still describes the food post maker. This
diff doesn't touch it. The base branch already has the Product photo studio glossary, and the
merge takes that version.

The design system is used correctly. UI comes only through `src/ds.js`, every CSS value is a
token, and the raw pixel values (1-2 px borders, the 48 px thumbnail, the 420 px toast, the
480 px stacked width) match the sibling tools. All 8 new Lucide icons are registered in
`src/lib/icons.js` and tested. No Instagram name, logo or trademark appears (tested at
`tests/product-photo-studio-ui.test.js:382`).

## Spec

Checked against `reviews/direction-change.md` (which wins), `reviews/conductor-decisions.md`
(S3, S4), `issues/02-browser.md`, PRD §2, and ticket 01's `server/product-photo-studio.js`
header.

**Contract with ticket 01: matches.**

- Request: `token`, `files` (1 to 4, 1600 px JPEG 0.8), `refs` (the same number, 512 px JPEG
  0.85, same order), and `name` and `instruction` trimmed and left out when empty
  (`api.js:21-34`, `prepare.js:11`). Field limits match the server's `MAX_NAME_CHARS` (80) and
  `MAX_INSTRUCTION_CHARS` (500). Both sides count UTF-16 length.
- Response: `products[{name, description}]`, `posts[{look, caption, hashtags, alt, image?}]` and
  `triesLeft` are read in `post-state.js:58-72`.
- Errors:
  - 422 `no_product` gets its own message, which never says the try came back (`post-state.js:42`).
  - 429 `limit` and `cap` show the out-of-tries notice.
  - 403, 413, 415 `heic` or `type`, 502 and 503 follow the receipt reader's rule that "This try
    wasn't counted" appears only when it is true.

**Blocking:** none.

**Should fix**

7. **The "Choose this one" toggle changes its own name.** `PostFrame.jsx:136-145` sets
   `aria-pressed` and also switches the label to "Chosen". Spec: "Each frame has a 'Choose this
   one' toggle that highlights it." A screen reader announces "Chosen, toggle button, pressed",
   which reads as two states. Keep the label "Choose this one" and let `aria-pressed`, the icon
   and the highlight carry the state.

**Nit**

8. **The "pictures not kept" message waits for a reload.** S4 says "if the pictures don't fit,
   keep the words and say the pictures were not kept". `keepResult` returns `picturesKept`, but
   `index.jsx:175` ignores it, so the visitor only learns after a reload
   (`index.jsx:402`). Recommended: when `picturesKept` is false, show an info note straight away,
   for example "These pictures won't be kept if this page reloads. Save the ones you want now."
9. **The AI note shows only on frames that have a picture** (`PostFrame.jsx:209`). PRD §2 says
   "Every frame carries the note", and the direction change says "on every frame, above its save
   button". A frame with no picture has no AI picture and no save button, so leaving the note
   off is the better reading. Recorded here and left as it is.
10. **400 `bad_request` or `count` and 404 show "isn't available right now".** This happens via
    `read-state.js:59` and is the same as the receipt reader. The page never sends a bad count,
    so this is acceptable.
11. **Unrequested additions.** The in-place confirmation on Start again (`index.jsx:198-212`) and
    the reduced-motion pause on the rotating placeholder (`index.jsx:53`) were not asked for. Both
    protect the visitor, so keep them.

**Refactor of the receipt reader's prepare step: no change in behaviour.**

- `kindOf` keeps its order (heic, then pdf, then image), and a `.pdf` name still wins over an
  image MIME type.
- `fitLongEdge` keeps its `LONG_EDGE` default, and `whiteCanvas` matches the old `canvasFor`.
- The one difference: `fromImage` now closes the bitmap after encoding, and also on failure. That
  is an improvement.
- The receipt tests pass unchanged.

**Privacy wording**

- The tool note matches the direction change word for word, with the people line after it
  (`copy.js:12`).
- The new /privacy paragraph (`src/content.js:147`) is accurate. Workers AI gets the photos
  "made smaller" (the 512 px refs) with Claude's written instructions. "Cloudflare does not keep
  them for us" claims no more than we can stand behind.
- The "Last updated" date moved to 27 October 2026.
- See finding 12 for one gap.

## Security

There are no findings. All the changes run in the browser.

- Model output (look, caption, hashtags, alt, product names) is rendered only as React text.
  Nothing uses `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `window.open` (grep of the diff:
  no hits).
- The only `fetch` goes to the fixed same-origin path `/api/apps/product-photo-studio`.
- The base64 picture becomes a Blob of type `image/jpeg` behind an object URL.
- Download names keep only `[a-z0-9-]`.
- sessionStorage holds the business name, captions and pictures, in this tab only. None of that
  is a secret.

**Should fix (privacy, not security)**

12. **/privacy doesn't mention the result kept in the tab.** `src/content.js:147` doesn't say
    that the studio keeps the last result (pictures, captions, business name) in the browser
    tab's storage until the tab closes or the visitor presses Start again. The page already
    discloses device storage for the quote builder's remember option (`src/content.js:140`), so
    the studio should say the same. Suggested sentence: "The Product photo studio keeps your last
    posts in this browser tab so a reload doesn't lose them. They stay on your device and are
    gone when you close the tab or press Start again."

## UI (crew:web-design-review)

The design system wins where it disagrees with the guidelines. Sentence case on buttons, straight
apostrophes in copy, "we" for Jura, and a disabled primary button with a described reason are all
house conventions, so they are not findings.

**Should fix**

13. **Focus is lost when the confirmation closes.**
    - `index.jsx:393`: "Keep my posts" unmounts itself when it closes the confirmation, so focus
      drops to `<body>`. Return focus to the Start again button.
    - `index.jsx:390`: "Clear my posts" removes the whole results section, so focus is lost there
      too. Move it to the upload area, for example `#pps-files` or the instruction box.
14. **Object URL leak in photo preparation.** Every photo still preparing when it is removed, when
    Start again runs, or when the page unmounts leaks one object URL:
    - `prepare.js:37` creates `previewUrl` after `decodeImage` and `drawJpeg` resolve.
    - By then `removePhoto` (`index.jsx:137-142`) has dropped the entry, so the `setPhotos` map at
      `index.jsx:124-131` finds no match and the URL is never revoked.
    - The same happens after `clearPhotos` and on unmount.

    Fix: revoke `made.previewUrl` when no entry matches, or create the URL only when the entry is
    still present. The leak is small, about 100 KB per photo, but it is exactly the lifecycle
    this ticket set out to get right.

**Nit**

- `index.jsx:300` sets `aria-pressed` on the example chips, but pressing a chip again doesn't
  unpress it. They are fill actions, not toggles, so drop `aria-pressed` and keep `Tag selected`
  as the visual cue.
- `index.jsx:425` keys frames by index, so a frame's `shape` and `editing` state carry over to the
  next try's posts. Key by a per-result id, or reset the state when a new result arrives.
- `PostFrame.jsx:188` sets `aria-controls` to an id that exists only while the editor is open.
- `PostFrame.jsx:62-74`: `navigator.share` runs after `await composeJpeg(...)`. iOS Safari can
  refuse that once the tap's activation has run out. The fallback to `saveBlob` covers it, but
  it should be checked on a real iPhone in QA. Separately, `onUsed()` also fires when the visitor
  cancels the share sheet (`AbortError`).
- `PostFrame.jsx:213-221`: the save button disables while composing but shows no progress label.
  Consider "Saving…".
- `session.js:39-50`: `restoreResult` doesn't check each post's shape. A malformed or
  older-format value in `product-photo-studio:result` makes `shownCaption` throw on
  `post.captions[...]` and breaks the page. Drop the kept result when `captions` isn't an array.
- `copy.js:27`: "Getting your photo ready" is a loading state without "…". The receipt reader
  does the same.
- `product-photo-studio.css:287-294`: the fixed toast ignores `env(safe-area-inset-bottom)`. The
  sibling tools do the same.

Pass:

- labels on every control, with fieldset and legend for Portrait/Square and Caption 1/2/3
- the action icons are `aria-hidden`
- the avatar is `aria-hidden` and the name is shown as text
- `<img>` has `alt`, `width` and `height`
- live regions for progress, errors and the toast
- focus moves to the results heading after a try
- `:focus-visible` on the chips, and a focus ring on the radio labels through `toolbox.css:78`
- reduced motion respected through the motion tokens and the placeholder pause
- long captions wrap (`pre-line`, `overflow-wrap`)
- `autocomplete="organization"` on the business name
- `text-wrap: balance` on the results heading
