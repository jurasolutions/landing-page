# Direction change: APP-004 becomes the Product photo studio (2026-10-27, Ting Yu)

Ting Yu, mid-build: "this should not be just for F&B, it should be a photo editing app... take a
photo of any product and AI will make it look better with good lighting and background
enhancement. then show it in a frame similar to an instagram post with suggested caption already
generated. user can still choose what caption they want if they are not happy with the generated
caption. at the start asides from uploading the image of the product, the user can also write an
instruction/ prompt of how they want the image to turn out to be.. put placeholder prompts to give
the users an idea how they can prompt the AI to generate photos (e.g remove background, add these
products together into one image) they can upload multiple images of products. generate 3
frames/posts per run so they can choose which one they like better."

**This file wins over `conductor-decisions.md`, the tickets, the PRD and the reviews where they
differ.** What it does not mention still stands (P1, P2, the shared limiter and budget, the
per-tool closed marker on the UTC day, the 4B default with retry and 9B/4B fallback, quota error
4006 → `cap`, the claim words rule, the injection rules, sessionStorage, the share sheet).

## Identity

- Slug `product-photo-studio`, name "Product photo studio", description "Better light and
  backgrounds for your product photos, with captions ready to post.", category Marketing,
  industries `["general", "retail", "fnb"]`, tier ai, status draft, added 2026-10-27, prd APP-004.
  It is tagged General again, so `tests/shell.test.js` "every tool is General" stays as it was
  (revert any change to it).
- Rename the files and identifiers from food-post(s) to product-photo / photo-studio:
  `server/photo-studio.js` (prompt, schema, `readStudioOutput`), `server/image-gen.js` (unchanged
  name), `server/product-photo-studio.js` (handler), `functions/api/apps/product-photo-studio.js`,
  `src/apps/product-photo-studio/`, tests to match. `TOOL_NEEDS` and the closed marker key use the
  new slug.

## What the visitor does

1. Adds **1 to 4 product photos** (camera or files; a photo is required: this is photo editing).
2. Optionally writes an **instruction**: how the picture should turn out (up to 500 characters).
   The box shows a rotating placeholder example; under it, 4 to 6 example chips that fill the box
   when tapped:
   - "Remove the background and put it on clean white"
   - "Put these products together in one picture"
   - "Place it on a marble counter in soft morning light"
   - "Bright, colourful background for a weekend sale post"
   - "Lifestyle shot on a wooden table with plants around it"
   - "Dark, moody background with a spotlight on the product"
3. Optionally types the **business name** (80 characters; used in the frame header and captions).
4. Presses one button. One try makes **three posts**.

Fields sent: `token`, `files` (1 to 4, the 1600 px JPEGs for Claude), `refs` (1 to 4, the same
photos at most 512 px on the long edge, JPEG, same order, for the image model), `name`,
`instruction`. Tone, place, dish, mention and emoji fields are dropped (the three captions cover
tone; a claim word is allowed when it appears in `instruction`).

## What the server does

- Checks: `files` and `refs` both 1 to 4, equal counts, real type by first bytes; each ref a JPEG
  whose dimensions (read from its SOF marker) are both <= 512 and under 300 KB; the existing 4 MB
  per file. `checkUploads` takes a `max` (3 stays the receipt reader's).
- Claude (Haiku 5.5, structured output, effort low, max_tokens 4096) sees the photos and the
  instruction, and returns:
  - `products`: up to 8, each `{ name, description }` (what it sees; the owner's screen);
  - `posts`: exactly 3, each `{ look, edit_prompt, caption, hashtags, alt }`, where `look` is a
    2 to 4 word label for the card ("Clean white studio", "Morning counter", "Bold colour"),
    and the three looks differ unless the instruction fixes one look, in which case they are
    three variations of it;
  - `no_product: boolean`, true only when no photo shows any product or object to sell.
- **The photos go to the image model as references** (this reverses ADR 2). Each picture is one
  Workers AI call with `prompt`, `width` 1024, `height` 1280 and `input_image_0`..`input_image_3`
  (the refs, as binary, in order). Claude's `edit_prompt` refers to them as "image 0", "image 1"
  and so on (BFL's convention), says which products appear, keeps every product exactly as it is
  in its photo (shape, colour, label, proportions), and changes only the background, surface,
  props, light and composition. 40 to 90 words of plain prose, no negations.
- **The brand rules change**: the visitor's own product and its own label are kept: it is their
  product. The picture adds no other brand, text or logo; props are plain and unmarked. The
  brand deny-list no longer applies to the image prompt or the caption for names visible on the
  visitor's product or typed by them; Claude names a brand in a caption only when it is printed on
  the product or in the instruction or name field. Drop the hard-coded brand list; keep the
  ™ ® © check on the edit prompt and the claim-word rule (claims allowed only when in
  `instruction`). Positively phrased suffix, appended by the server:
  " Keep each product exactly as it appears in its reference image, with its own shape, colours
  and label. Photorealistic commercial product photography with soft, even, flattering light;
  plain unmarked props and surfaces; nobody in the frame."
- Three pictures in parallel, each with the 4B/9B retry rule. Price per 4B picture: 6 output
  tiles at US$0.000287 plus one input tile per ref at US$0.000059. 9B: its MP price plus US$0.002
  per input-image MP. Reserve three pictures at the dearer of the configured model and its
  fallback, settle what was drawn.
- Response: `200 { products: [{ name, description }], posts: [{ look, caption, hashtags: ["#..."],
  alt, image?: <base64 JPEG> }] (exactly 3), triesLeft }`. At least one picture or the try is
  refunded and the answer is 503. `422 { error: "no_product", triesLeft }`, try kept, nothing drawn.
  Other errors as before.

## What the page shows

- The upload area takes 1 to 4 photos with thumbnails; then the instruction box with its rotating
  placeholder and example chips; then the business name.
- Progress: "Lighting your products and drawing three posts. This can take up to a minute."
- Results: three **post frames that look like a social media post**, without any Instagram name,
  logo or trademark: a header row (a round avatar with the business name's first letter, or a
  plain shop icon, then the business name or "Your business"), the picture (4:5, or square when
  switched), an action row of plain Lucide icons (heart, message-circle, send, bookmark;
  decorative, `aria-hidden`), then the caption with the name in bold and the hashtags.
  Frames sit side by side on desktop and stack on a phone. Each frame has a "Choose this one"
  toggle that highlights it (several may be chosen), its `look` label, Portrait / Square, Save or
  share / Download picture, and Copy caption.
- **Captions**: the three captions are offered on every frame as "Caption 1 / 2 / 3" choices
  (a segmented control or radio group), the frame's own caption selected first, and an "Edit"
  button that opens the chosen caption in a textarea. What the frame shows is what Copy caption
  copies.
- The AI note on every frame, above its save button: "This picture is made by AI from your
  photos. Check your product looks right before you post."
- The browser draws the 1080 x 1350 or 1080 x 1080 JPG from the picture, as before, named
  `<look-slug>-<portrait|square>.jpg`.
- The preparation step makes both sizes from each photo: the 1600 px JPEG at 0.8 for `files` and
  a 512 px long-edge JPEG at 0.85 for `refs`.

## Copy and privacy

Privacy note: "Your photos are sent securely to Anthropic's Claude, which writes the captions and
picture instructions, and to Cloudflare Workers AI, which draws the new pictures from them. Neither
keeps them for us, and we don't store your photos or the results." `/privacy` names both for this
tool. Photos with people in them: "Product photos work best. Leave out photos with people in them."
