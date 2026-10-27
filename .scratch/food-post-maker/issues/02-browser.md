# 02 Browser: the food post maker page

Status: ready-for-agent
Blocked by: - (builds to the response contract in 01; runs in parallel)
Branch: crew/food-post-maker-02-browser

## What to build

**Read `reviews/conductor-decisions.md` first. It settles the spec reviews and wins over this ticket, the PRD and the reviews where they differ** (functional B1-B3, S1-S9, N1-N6; the model, retry, prices, suffix and closed-marker changes).

`src/apps/food-post-maker/` per the PRD §2 and §5.2
(`jurasolutions/prd/pending/apps/prd-app-004-food-post-maker-2026-10-27.md`), following the receipt
reader's structure (`src/apps/receipt-reader/`: index, copy, api, read-state, prepare, css) and the
shared pieces in `src/apps/_shared/`. Design system only (`src/ds.js`, tokens, `tb-`/tool-prefixed
classes; register any new Lucide icon in `src/lib/icons.js`). Read the design system's `SKILL.md`,
`README.md` §3 and each component's `.prompt.md` before use (`jurasolutions/design-system/`).

- Registry: add this entry to `src/apps/registry.json` exactly (ticket 01 adds the same one):
  `{ "slug": "food-post-maker", "name": "Food post maker", "description": "Menu or dish photos to ready-to-post pictures and captions.", "category": "Marketing", "industries": ["fnb"], "tier": "ai", "status": "draft", "added": "2026-10-27", "prd": "APP-004" }`
  If `tests/shell.test.js` fails on "every tool is General", leave that test to ticket 01 and say so.
- Upload: shared `FileDrop` with the camera button; up to 3 photos; reuse the receipt reader's
  image resize (1600 px long edge, JPEG 0.8). If importing `receipt-reader/prepare.js` pulls pdf.js
  into this chunk, move the image-only path to `src/apps/_shared/` instead. No PDFs here.
- Fields: Business name (optional, 80), Dish to feature (optional, 120), Anything to mention
  (optional, 400, e.g. "new this week, open till 10pm"), Tone (Warm and friendly / Fun and
  playful / Simple and classy → `warm` | `playful` | `classy`), "Add a few emoji" checkbox (off).
- Tries-left notice, Turnstile, one-try note, readiness alert, talk card behaviour as the
  receipt reader (`useOwnTalkCard`).
- POST multipart to `/api/apps/food-post-maker`: `token`, `files`, `name`, `dish`, `mention`,
  `tone`, `emoji` ("1" when ticked). Contract:
  `200 { dishes: [{ name, description }], posts: [{ dish, caption, hashtags: ["#..."], alt, image?: <base64 JPEG> }], triesLeft }`;
  `422 { error: "no_food", triesLeft }`; `429 { error: "limit" | "cap", triesLeft }`;
  `502 unreadable`, `503 unavailable` (with `triesLeft` when a try was taken; "This try wasn't
  counted" only when it came back, as `read-state.js` does); `400`, `403`, `413`, `415`.
- Progress: while waiting (10 to 40 s), a live message "Reading your photos and drawing your
  posts. This can take up to a minute."
- Results: "What we found on your menu" as a short list of dishes; then two post cards: the
  picture (decode base64 to a Blob and object URL, never a giant data URL; revoke on replace),
  a Portrait / Square switch, the caption in an editable textarea with the hashtags appended
  (one blank line between), "Download picture" and "Copy caption". A post without `image` shows
  "We couldn't draw this picture. The caption is still yours to use." A note above the cards:
  "These pictures are made by AI from your photos and menu. Check they look like what you serve
  before you post."
- Compose: `compose.js` with a pure `cropRect(shape, w, h)` (portrait 4:5 → whole image scaled to
  1080 x 1350; square → centre crop to 1080 x 1080), and a canvas draw with
  `imageSmoothingQuality = "high"`, saved as JPEG 0.92 named `<dish-slug>-<portrait|square>.jpg`.
- Usage: `open` via the shell as usual; `complete` on the first download or copy.
- Privacy note (tool copy): photos go securely to Anthropic's Claude to read them; only a text
  description goes to Cloudflare Workers AI to draw the pictures; nothing is stored. Update
  `/privacy` (`src/content.js` PRIVACY) to name Cloudflare Workers AI for this tool, and the
  privacy test (`tests/privacy.test.js` / `tests/shell.test.js` assertions) to match.
- Copy in `copy.js`, Jura voice (design-system README §3). Run every new string through
  `uv run jura-growth check "<text>"` from `/Users/tingy/OneDrive/Desktop/projects/jurasolutions/repos/growth`.

## Acceptance criteria

- [ ] Page renders under `VITE_SHOW_DRAFTS=1 npm run dev` at `/apps/food-post-maker`, works at 360 px.
- [ ] UI tests (`tests/food-post-maker-ui.test.js`, `renderToStaticMarkup` + pure state modules)
      cover blockers, failure messages, the request fields, and `cropRect`.
- [ ] With the API stubbed in the browser (a fetch override or a fixture), two cards render,
      both shapes download at the right pixel sizes, copy works, a post without image shows the note.
- [ ] `npm test`, `npm run build` pass; copy passes `jura-growth check`.
