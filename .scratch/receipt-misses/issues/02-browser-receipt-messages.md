# 02 Browser: say what went wrong, per photo and per try

Status: ready. Labels: ready-for-agent. Builds against the contract in `01-server-receipt-reading.md`
(stub it in tests; do not wait for 01).
Read first: `reviews/triage.md`, `src/apps/receipt-reader/` (index.jsx, copy.js, read-state.js,
model.js, ReceiptResults.jsx, files.js, prepare.js, api.js), `src/apps/_shared/photos.js`,
`src/apps/product-photo-studio/` (its error copy), `tests/receipt-reader-ui.test.js`,
`tests/product-photo-studio-ui.test.js`. Voice: design-system README §3 (sentence case, second
person, no exclamation marks, no emoji); run `uv run jura-growth check "<text>"` from `../growth`
on every new string.

## Decisions
1. **Per photo.** `fromApi` keeps `image` and `problem`. A not-a-receipt card shows the photo it came
   from (keep that file's preview URL alive until the card is removed; revoke on remove/unmount) and
   says why:
   - not_a_receipt: "Photo {n} doesn't look like a receipt or invoice."
   - blurry: "Photo {n} is too blurry to read. Hold the receipt flat and keep the camera steady."
   - cut_off: "Part of the receipt in photo {n} is cut off. Fit the whole receipt in the frame."
   - too_dark: "Photo {n} is too dark to read. Try again in better light."
   - other or null: "We couldn't read a receipt in photo {n}. Try a closer, straighter photo."
   `{n}` is the photo's number in the batch it was sent with.
2. **Per try** (`failureMessage`), by `error` then `reason`:
   - 502 refused: "These images couldn't be read. If they're receipts, try one clear photo of each."
   - 502 rejected: "One of these images couldn't be processed. Take the photo again, or save it as a JPG."
   - 503 bad_output: "Something went wrong on our side while reading. Please try again."
   - 503 busy: "The receipt reader is busy right now. Please try again in a minute."
   - status 0: "We couldn't reach the receipt reader. Check your connection and try again."
   - other 503: keep "isn't available right now".
   Keep "This try wasn't counted." after any of these when the try came back.
3. **HEIC.** Before refusing a HEIC file, try decoding it with the browser (`decodeImage`): Safari
   can. Only if that fails, refuse with: "This photo is in Apple's HEIC format, which this browser
   can't open. On a Mac, export it from Photos as a JPEG (File > Export); on an iPhone, choose
   Most Compatible under Settings > Camera > Formats." No new library (libheif is LGPL; not here).
4. **Product photo studio**: its page handles 503 `busy` and the 502 reasons with its own words in
   the same pattern (its `copy.js`), so a rate limit no longer reads as "used up for today".
5. Copy lives in each tool's `copy.js`; tests cover every message mapping and the per-photo card.

## Acceptance
- UI tests: each problem shows its sentence with the right photo number and thumbnail; each error/reason maps to its sentence; status 0 → the connection message; a HEIC the browser decodes is accepted.
- `npm test`, `npm run build` pass; new strings pass `jura-growth check`.
