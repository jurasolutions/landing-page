# Jura Solutions — marketing site

The public site for Jura Solutions, built from the Jura Solutions design
system. React + Vite, deployed to Cloudflare Pages on `jurasolutions.sg`.

Built against `jurasolutions/prd/done/prd-jura-website-2026-08-27.md`, with the
toolbox from `jurasolutions/prd/pending/prd-jura-app-factory-2026-10-24.md`
(blocks 1 to 3) and the website pieces of
`jurasolutions/prd/pending/prd-jura-scout-2026-10-24.md` (§5.5 and §5.9).

---

## Run it

```bash
npm install
npm run dev              # http://localhost:5173, the pages only
npm test                 # unit tests (Vitest), no network
npm run build            # production bundle into dist/, plus per-route heads
npm run preview          # serve the built bundle
npm run db:migrate:local # create the local D1 tables (once, and after new migrations)
npm run dev:functions    # build, then serve dist/ with the Functions and local D1
```

`npm run dev` and `npm run preview` serve the pages but **not** the Functions
(the enquiry endpoint, the toolbox APIs, unsubscribe) — Vite does not run
Cloudflare Pages Functions. Submitting the form there shows the form's error
state, which is correct behaviour.

`npm run dev:functions` runs everything with `wrangler pages dev` on
http://localhost:8788. It uses wrangler 4.86.0 through `npx`, the last release
that runs on Node 20, and a local D1 database in `.wrangler/state`.
`wrangler.local.toml` exists only so the local commands can find the
migrations; Cloudflare Pages never reads it (it only looks for
`wrangler.toml`/`wrangler.json`), so it cannot touch the production bindings.
Secrets for local runs go in `.dev.vars` (git-ignored), for example:

```bash
RESEND_API_KEY=re_...            # only if you want the form to send for real
AI_ALLOW_DRAFTS=1                # serve draft AI tools' Functions locally (never on Pages)
```

To check a draft AI tool end to end, run
`VITE_SHOW_DRAFTS=1 npm run dev:functions` (the build then opens the draft's
page) with `AI_ALLOW_DRAFTS=1` in `.dev.vars` (its Functions then answer
instead of 404). See "Environment variables".

## The design system

The design system is authoritative and lives outside this repo, at
`jurasolutions/design-system/`. Because this repo has to build standalone on
Cloudflare Pages, a verbatim copy is vendored into `src/design-system/`.

**`src/design-system/` is read-only.** Do not hand-edit it. Change the design
system at source, then bring the change across:

```bash
npm run sync:ds
```

The script copies `styles.css`, `tokens/`, `assets/` and `components/` and skips
the preview cards and prompt docs. If the design system sits somewhere else, point
at it with `JURA_DS_PATH`.

`src/ds.js` is the single import point for components. It lives outside the synced
folder so the sync can replace that folder wholesale. Everything the page renders
comes from there — no ad-hoc components, no second icon or font set, no raw colour
or spacing values.

Lucide is registered in `src/lib/icons.js`. The design system's `Icon` reads from a
global `window.lucide`, so only the icons listed in that file are bundled. **Adding
an icon to the page means adding it to that list** — `Icon` renders nothing for a
name it cannot find.

## Layout

```
functions/               Cloudflare Pages Functions (each file is a route)
  submit.js              POST /submit → Resend, GET /submit health check
  unsubscribe.js         GET and POST /unsubscribe?t=<token> → D1 suppression
  api/resend-webhook.js  POST bounces and complaints → D1 suppression, GET health check
  api/apps/usage.js      POST /api/apps/usage, anonymous open/complete counts
  api/apps/limit.js      GET /api/apps/limit, AI tries left today
  api/apps/promo.js      POST /api/apps/promo, the access code for unlimited tries
  api/apps/receipt-reader.js  POST, APP-002
  api/apps/quote-builder.js   POST, APP-001a (draft a quote with AI)
  api/apps/product-photo-studio.js  POST, APP-004 (three product pictures and captions)
server/                  code the Functions share; outside functions/ so it is never a route
migrations/              D1 schema, wrangler migrations format
scripts/                 design system sync, per-route <head> prerender
src/
  App.jsx                the router shell: nav, the current page, footer
  content.js             every word on the site pages (tools keep theirs in copy.js)
  ds.js                  design system import point
  pages/                 Home (the nine house sections, unchanged), AppsIndex, AppPage,
                         Privacy, Unsubscribed, NotFound
  apps/                  the toolbox: registry, shared components, one folder per tool
  components/Section.jsx the page band and its node on the spine
  sections/              hero, problem, services, how, proof, trust, faq, contact, footer
  lib/                   icons, enquiry validation, router, per-route meta
  styles/site.css        page composition only — tokens do the rest
  styles/toolbox.css     toolbox pages only, every class prefixed tb-
  design-system/         synced copy, read-only
tests/                   Vitest: Functions against an in-memory D1, plus shell tests
```

### Routes

| Path | Page |
| --- | --- |
| `/` | the marketing page, as before |
| `/apps` | the toolbox index, from the registry, filterable by industry (`/apps?industry=general,retail` opens it filtered) |
| `/apps/<slug>` | one tool, its code loaded only on that page |
| `/privacy` | the privacy notice (linked from the footer, every tool and every outreach email) |
| `/unsubscribed` | where `/unsubscribe` sends people afterwards (`?status=invalid` or `?status=error` for the failure states); `noindex` |

Routing is a small history-API router (`src/lib/router.js`); there is no
routing library. It intercepts clicks on same-origin links to these paths, so
the design system's `Button href` works unchanged. On the home page the
footer's section links stay plain `#section` anchors exactly as before; on
every other page they point to `/#section`.

The top bar (`src/sections/Nav.jsx`) holds only the logo, a **Toolbox**
button and **Book a call**. The toolbox is its one destination, shown as a
secondary button with an icon so it stands out (Ting Yu, 2026-10-26); the home
page's sections are reached by scrolling or from the footer. Both buttons fit
on a 360px phone, so there is no menu sheet.

Cloudflare Pages serves `index.html` for any path that is not a file, because
there is no top-level `404.html`. After `vite build`,
`scripts/prerender-routes.mjs` writes `dist/apps.html`, `dist/privacy.html`,
`dist/unsubscribed.html` and `dist/apps/<slug>.html` for each live tool: the same SPA with that route's
title, description, canonical and Open Graph tags, so a shared link previews as
the tool. They are `.html` files rather than `<route>/index.html` because Pages
serves `apps.html` at `/apps`, whereas `apps/index.html` would answer at
`/apps/` and 308 `/apps` there (checked with `wrangler pages dev`: `/apps` is
200, `/apps/` and `/apps.html` 308 to `/apps`).

### The spine

The one structural device the page adds on top of the design system: a hairline
running down the left of the page from the hero claim to the closing conversation,
with a node at each section. The page reads the way Jura describes its work — one
process, written down, with a beginning and a handover. Below 1024px the rail is
hidden and each node becomes the ordinary eyebrow above its heading, so nothing is
lost on a phone.

## The toolbox

`src/apps/registry.json` is the single list of tools. It is data, not code,
because the Functions and the growth CLI (`repos/growth`) read it too:

```json
{ "slug": "quote-builder", "name": "Quote builder",
  "description": "Professional PDF quotes with your logo, in minutes.",
  "category": "Sales", "industries": ["general", "retail", "logistics"],
  "tier": "ai", "status": "live", "added": "2026-10-24", "prd": "APP-001" }
```

`category` is what the tool does: one of Sales, Finance, Admin, HR,
Marketing, Documents (the app factory uses it). `industries` is who it suits,
one or more of `general`, `fnb`, `retail`, `logistics`,
`professional-services` (`INDUSTRIES` in `src/apps/registry.js`, with their
labels). A tool any business can use is tagged `general`, plus each industry
it fits especially well. `/apps` filters by industry: the visitor can pick
several at once and sees every tool tagged with any of them, and the choice is
kept in the address (`?industry=general,retail`) so a filtered list can be
linked to, from an outreach email say. `tier` is `browser` or `ai`. Only `live` tools are listed on `/apps` or prerendered; a
`draft` tool's page opens on the local dev server only.

**Adding a tool is one folder and one registry entry.** The folder is
`src/apps/<slug>/` with an `index.jsx` (default export: the tool) and a
`copy.js` (default export: its words). `src/apps/loaders.js` finds both by
folder name, so nothing else needs wiring. Every tool page gets the same shell
(`src/apps/_shared/AppShell.jsx`): the one-line promise, the tool, a privacy
note, then a talk-to-us card linking to `/?from=apps/<slug>#contact`. A tool
that shows the card itself (the receipt reader, under its out-of-tries notice)
calls `useOwnTalkCard(true)`, and the shell leaves out its closing card so the
page has it once.

Shared pieces in `src/apps/_shared/`: `AppShell`, `FileDrop`, `ExportButtons`,
`TryLimitNotice`, `LimitArea` (the tries-left notice, or the not-ready alert,
with the out-of-tries talk card), `TalkToUsCard`, `PrivacyNote`, plus
`turnstile.js` and `ai-limit.js` (the AI tools' bot check, tries-left call and
out-of-tries rules), `usage.js` (the fire-and-forget counter), `storage.js`
(localStorage and sessionStorage that never throw), `photos.js` (decode a
photo once and make JPEGs at any long edge), `useBlobUrl.js` (an object URL
that lives exactly as long as its blob), `controls.js`, `focus.js`,
`useToast.js`,
`download.js` and `pdfjs.js` (`openPdfjs`, the one way the tools load pdf.js:
legacy build, worker by URL, no eval, and the loading task destroyed when a
load fails; and `canvasToJpeg`).

### Usage counts

Each tool page counts one anonymous `open`, and each tool counts a `complete`
when the visitor gets the result (a PDF downloaded, receipts read). The browser
sends `POST /api/apps/usage` with `{ slug, event }` by `navigator.sendBeacon`
and never waits for it. The Function checks the slug against the registry and
adds one to `app_usage` for that SGT day. Nothing personal is stored: no IP, no
cookie, no content.

### APP-001 Quote builder (`src/apps/quote-builder/`)

AI tier since APP-001a. The quote itself never leaves the visitor's browser;
the only thing sent is the job described in the "Draft with AI" box, which
goes to `POST /api/apps/quote-builder` and on to Claude. The rest of the tool
works with the AI unavailable.

- **Draft with AI** (`AiDraft.jsx`, `draft.js`; server side `server/quotes.js`
  and `server/quote-drafter.js`). The example request shows as the box's
  light-grey placeholder and is sent when the box is empty. The Function
  checks Turnstile and the request's length (2,000 characters), then runs the
  same try, budget and repair path as the receipt reader (`server/ai-run.js`).
  The draft replaces the items, fills any customer field it names, and puts a
  one-line "Scope:" at the top of the notes. It never invents a price.
- **Placeholders.** The quote number and business name start empty and show
  the next running number (Q-0001, Q-0002 …, or the next after a number the
  visitor typed) and "Jura Solutions" in light grey. `effectiveQuote` in
  `model.js` swaps them in for the preview, PDF, file name and saved file.
  "Remember" keeps the last number used along with the business details.

| File | Does |
| --- | --- |
| `calc.js` | the money maths, pure functions, tested in `calc.test.js` |
| `model.js` | the quote's shape, defaults, quote numbers and dates, the GST default, and `readGst` for the remembered setting |
| `quoteFile.js` | the saved quote file: `{ format: "jura-quote-builder", version: 2, quote }`. Version 1 files still open (as prices exclude GST); version 3 and up are refused |
| `pdf.js` | the A4 PDF, with pdf-lib, loaded only when a PDF is wanted |
| `winansi.js` | which characters the PDF can print |
| `logo.js` | reading the logo, and rasterising SVG for the PDF |
| `totals-rows.js` | which totals rows the quote shows and what they say; the preview and the PDF both draw from it |
| `QuoteForm.jsx`, `QuotePreview.jsx`, `index.jsx` | the page |
| `copy.js` | every word, including the PDF's |

- **Money** is integer cents, quantities are thousandths and percentages are
  hundredths of a percent, multiplied as BigInt. Rounding is half up, once at
  each line total and once at GST (and the overall percentage discount, which
  is an amount of money too). GST is on the subtotal after discounts.
- **GST** is off by default. The rate defaults to 9%, checked on the IRAS site
  on 2026-10-24 (the URL is in a comment beside `DEFAULT_GST_RATE`), and stays
  editable. The document is always titled "Quotation", never a tax invoice.
  Prices exclude GST by default, and GST is added on the amount after discount.
  The "Prices include GST" switch, shown only while GST is on, reads the prices
  as already containing it: the total stays as typed, GST is its share at
  rate ÷ (100% + rate), rounded half up once, and the quote prints the total
  first with "Total before GST" and "Includes GST" below it. While GST is on,
  both documents also say how prices are quoted. The choice is kept while GST
  is off but only takes effect while it is on (ADR 0003, file version in ADR 0004).
- **The PDF uses Helvetica**, which every PDF reader has built in. It keeps the
  visitor's document in neutral type rather than Jura's typefaces and costs
  nothing to download. Helvetica only covers WinAnsi (Latin letters, common
  punctuation, €), so the form lists any character that will not print (for
  example Chinese) and the PDF leaves it out. A font covering Chinese would
  add megabytes, and a Latin TTF would not fix the case that matters.
- **The logo** (PNG, JPG or SVG, under 1 MB) prints inside a 170 × 56 pt box,
  keeping its shape. SVG is drawn on a canvas at four times print size first.
- **Remember** keeps the business details and GST setting (the rate, the
  registration number and whether prices include GST) in localStorage
  only while ticked; unticking deletes them. Every storage call is wrapped, so
  the tool works the same when storage is blocked, with a note that nothing
  will be remembered.
- **pdf-lib** is in its own chunk (about 180 KB gzipped), warmed up when the
  page is idle and never loaded on any other page.

### AI tools: the shared limiter

AI-tier tools call Claude from a Pages Function, so each try costs money. The
rules (app factory PRD §5.4, changed by Ting Yu on 2026-10-25 to 5 tries a
person and a US$5 daily budget), in `server/limit.js`:

- **5 tries per visitor per SGT day** (`AI_TRIES_PER_DAY`), shared across all
  AI tools (`AI_LIMIT_SCOPE=all`): a try in any AI tool counts toward the
  same 5. `AI_LIMIT_SCOPE=per-tool` gives each tool its own count instead.
- **15 tries per IP per SGT day** (`AI_TRIES_PER_IP`) on top of that, counted
  against a salted hash of the IP alone, so a private window or cleared
  cookies do not mean fresh tries. For IPv6 the hash is of the address's /64,
  because a home or office connection usually owns a whole /64 and can pick
  any address in it. Fifteen lets a shared office in three people's worth. Its
  rows live in `app_tries` with `tool` `#ip` (or `#ip:<slug>` per tool), so it
  needed no new table. Reserved keys start with `#`; slugs are `[a-z0-9-]`
  only, so the two never meet.
- **A site-wide budget of US$5 a day** (`AI_DAILY_BUDGET_USD`) on the Claude
  API, for everyone together. Before any request is sent, its worst-case cost
  (`reservationNano` in `server/anthropic.js`: the prompt plus 5,000 tokens an
  image, and the full `max_tokens` of output) is reserved from the day's
  budget in one conditional upsert on `app_spend`. If it would take the day
  past the budget, the request is not sent and every AI tool shows its "used
  up for today" message until midnight SGT. When the answer comes back, the
  reservation is settled to the real cost, priced from the API's `usage` at
  Haiku 5.5's list prices (`PRICE_NANO_USD`: US$0.10 in, US$0.50 out per
  million tokens; thinking is billed as output). An error answer from the API
  is not billed, so its reservation is released; a dropped connection or a
  timeout may have been billed, so it keeps its reservation. Amounts are
  whole nano-dollars (billionths of a dollar). The repair request reserves
  and settles the same way, and the SDK runs with `maxRetries: 0`, so nothing
  is sent that was not reserved. A typical one-receipt read costs a fraction
  of a US cent, so US$5 is well over a thousand reads.
- **Unlimited tries for the owner's network** (`AI_UNLIMITED_NETWORKS`, Ting
  Yu's request on 2026-10-27). A connection from an address in that list
  (commas or spaces between them; an IPv6 address matches its whole /64)
  takes no try and no per-IP count, and its page always shows the full
  count. Its calls still reserve from the daily budget and count towards
  `AI_SITE_CAP`, so the site's spend holds for everyone. Set it as a Pages
  secret: an address is personal data and stays out of the repo.
- **An access code for unlimited tries** (`server/promo.js`, Ting Yu's request
  on 2026-10-28). The `/apps` page ends with a quiet "Access code" button that
  opens a field. A right code sets a `jura_promo` cookie (HttpOnly, 90 days,
  `Path=/api/apps`) holding a keyed hash of the visitor salt and the code's
  hash, and that browser then takes no try and no per-IP count in any AI tool,
  exactly like a network in `AI_UNLIMITED_NETWORKS`: the daily budget and call
  cap still hold. The repo is public, so the source holds only the SHA-256 of
  the code (`DEFAULT_PROMO_HASH`); the code is random, 16 characters from a
  32-character alphabet (80 bits), and is given out by hand. To change it, make
  the hash of a new code (`printf '%s' CODE | shasum -a 256`) and set the Pages
  secret `AI_PROMO_CODE_SHA256`; every browser holding the old one stops being
  unlimited at once. Wrong guesses are counted per connection (10 a day, in
  `app_tries` under `#promo`), and the code is read without regard to case,
  spaces or dashes. `POST /api/apps/promo` answers 200, 400, 401, 413, 429 or
  503, and `GET /api/apps/limit` adds `unlimited: true` for a holder.
- **An optional call cap** (`AI_SITE_CAP`, off by default). When set, it also
  limits the number of AI calls a day; every request sent counts, the repair
  and the receipt reader's second look included, and a counted call is never
  given back.
- **The visitor** is a salted SHA-256 of `CF-Connecting-IP` and a random
  `jura_vid` cookie (HttpOnly, `Path=/api/apps`). Only the hash is stored.
  Cookie-less requests from one IP share one bucket, so refusing the cookie is
  not a way round the limit.
- **Atomic.** Each counter is one upsert that only increments while under the
  limit and reads the count back:
  `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`.
  D1 runs writes one at a time, so a burst of clicks cannot pass the limit
  (tested: 5 at once, exactly 2 get through). D1, not KV, because KV is
  eventually consistent.
- **Order:** Turnstile → size and type → take the try → Claude → validate the
  output (one repair, free to the visitor, skipped if the cap is reached) →
  the tool's `finish` step, if it has one → respond. An API or network
  failure, output that cannot be repaired, or anything unexpected after the
  try is taken gives the visitor's try back (never the site's call). A
  refusal (`stop_reason: "refusal"`) does not, and nor does an API
  `400 invalid_request_error`: both come from what was uploaded. A billing
  error from the API (spend limit reached) closes the AI tools for the rest
  of the day.
- **Every failure says why** (`server/ai-run.js`, shared by every AI tool;
  `error` is a code and `reason` says why, and the page owns the words):

  | Answer | When | The try |
  | --- | --- | --- |
  | 502 `{ error: "unreadable", reason: "refused" }` | the model declined what was sent | used |
  | 502 `{ error: "unreadable", reason: "rejected" }` | the API could not process what was sent (a 400) | used |
  | 503 `{ error: "busy" }` | Anthropic's rate limit: busy for a moment, not out of tries | given back |
  | 503 `{ error: "unavailable", reason: "bad_output" }` | the output was still wrong after the repair | given back |
  | 503 `{ error: "unavailable" }` | any other failure on our side, the network included | given back |
  | 429 `{ error: "cap" }` | the budget is spent, or the API reported a billing problem (which closes the day) | given back |

  Each carries `triesLeft` once a try was taken, and `counted`: true when
  the try was used, false when it came back (a second failure the same day
  keeps it used, so the table's "given back" is the first one). The pages
  trust `counted` rather than comparing counts, which can come from two
  different buckets on a first visit. Until 2026-10-27 a rate
  limit answered 429 `cap`, which told the visitor their tries were used up,
  and bad output answered 502 `unreadable`, which blamed their photo.
- **Refunds are bounded.** A visitor gets at most one try back per SGT day,
  and an IP at most as many as its ceiling has visitors (15 ÷ 5 = 3 by
  default), so fresh cookies bring no fresh refunds. A second failure keeps
  the try used, and one visitor cannot spend the site's budget on failures.
  Money spent is never refunded to the budget.
  Refunds are recorded in `app_tries` under `tool` `#refund` (or
  `#refund:<slug>` per tool), before the try is given back. A refund is
  attempted at most once per request, and the answer's `triesLeft` counts it
  only when it succeeded.
- **A D1 error part-way** through taking a try gives back whatever was
  already taken and answers 503, so a transient error costs no one a try.
- **Logs** are one JSON line per call: day, tool, ok, reason, receipt count,
  tokens, cost in nano-dollars (`cost_nano_usd`), latency. A tool with a
  `finish` step adds what that step cost (`image_nano_usd` for the photo
  studio, `second_look_nano_usd` for the receipt reader, which also logs how
  many images it looked at again as `second_look`). Never content. The SDK's
  own logging is off.

`GET /api/apps/limit?tool=<slug>` answers `{ triesLeft, triesPerDay,
capReached, ready }` and issues the cookie. `capReached` is true once the
day's budget is spent (or the call cap, if set, is reached). `ready: false` means the
deployment is missing `DB`, `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET` or
`VISITOR_SALT`, which makes it a useful health check too. With `?tool=<slug>`
it also checks that tool's own needs (`TOOL_NEEDS` in `server/ai-tool.js`):
the product photo studio is not ready without the `AI` binding and a priced
`AI_IMAGE_MODEL`, and reports `capReached` while it is closed for the day
after a Workers AI quota error.

**A second cost.** A tool can pass `runAiTry` a `finish` step: a second cost
(the photo studio's pictures, the receipt reader's second look), reserved in
the same statement as the try, run after Claude's output validates, and
settled to what it really cost. Every early exit releases it, once, and a
billing error releases it before `closeForToday`, so the close stays the last
word on the day's spend. The budget therefore covers Claude and Workers AI
together (`docs/adr/0001-image-cost-shares-the-ai-budget.md`). A step that
sends Claude another request calls the `countCall()` it is handed first: that
counts the request towards `AI_SITE_CAP` (the money is already reserved) and
says not to send it when the cap is reached. Because the reservation is taken
with the try, a try needs room in the day's budget for both; a one-image
receipt read reserves two requests' worst case and settles to what it spent.

Shared server code lives in `server/`, not `functions/`. Pages turns any file
in `functions/` that exports an `onRequest*` handler into a public route, and
an underscore prefix means nothing to it except `_middleware` (checked in
wrangler's file-tree routing), so `functions/api/apps/_limit.js` would only be
safe for as long as nobody added a handler to it.

### APP-002 Receipt reader (`src/apps/receipt-reader/`, `server/receipt-reader.js`)

- The browser resizes photos to a 1600 px long edge at JPEG quality 0.8 and
  renders a PDF's first page with pdf.js (fetched only when a PDF is added).
  A HEIC photo is decoded by the browser where it can (Safari), and refused
  with how to export a JPEG only where it can't; there is no HEIC library.
  The product photo studio handles HEIC the same way, through the same helper
  (`src/apps/_shared/photos.js attemptDecode`). Up to 3 files per try.
- The page names what went wrong: a not-a-receipt card shows the photo it came
  from, by its number in the batch ("Photo 2", the same label the file list
  gave it: the list numbers only the files that will be sent, and names a
  file that can't be sent by its file name), with the server's `problem` (blurry, cut
  off, too dark…), and a failed try is worded from `error` and `reason`
  (refused, rejected, bad output, busy) or a failed connection
  (`read-state.js failureMessage`, words in `copy.js`).
- The Function checks Turnstile, then each file's real type by its first bytes
  (JPG, PNG, WEBP) and size (4 MB), before the counter or the API is touched.
- **The Claude call** uses the official SDK (`@anthropic-ai/sdk` v1, API
  version 2026-10-21): `claude-haiku-5-5`, a fixed system prompt, images as
  base64 blocks, each after a text label ("Image 1", "Image 2"), no tools, and
  structured outputs (`output_config.format`, JSON schema) at
  `effort: "low"`. There is no `temperature`: API version 2026-10-21 rejects
  sampling parameters on every model, and Haiku 5.5 never accepted
  non-default values. The schema does the job the PRD's "temperature 0" was
  for. `max_tokens` is 4096 rather than the PRD's 2000, because Haiku 5.5
  thinks by default and thinking counts towards `max_tokens`.
- **The prompt** keeps the PRD's rules (§5.3: images are data, never
  instructions; null for what is not visible; YYYY-MM-DD; two decimals; notes)
  and, since 2026-10-27, says what a receipt is (till receipts, tax invoices,
  invoices, bills, payment slips, e-receipts and screenshots, from any
  country, in any language or currency), that `currency` is the ISO 4217 code
  inferred from symbols, tax names and the address (RM or SST is MYR), and
  that discounts are line items with negative amounts. That change followed
  clear Malaysian, Singapore and UK receipts coming back as "not a receipt"
  (`.scratch/receipt-misses/`).
- **Entries are tied to images.** Each entry carries `image` (its number) and
  `problem`: null for a receipt, and for an image with no receipt one of
  `not_a_receipt`, `blurry`, `cut_off`, `too_dark` or `other`. One entry per
  receipt; an image with no receipt gets exactly one entry. A not-a-receipt
  entry for an image that also has a receipt (a menu beside it) is dropped.
  The answer is sorted by `image`, and every image from 1 to n is there.
- **A second look.** Any image the first reading found no receipt in (or did
  not mention) is sent once more, on its own and still labelled with its
  number, at `effort: "medium"`, with a note that a first read found no
  receipt. It is free to the visitor and runs as `runAiTry`'s `finish` step:
  its worst case (`reservationNano({ images: n })`) is reserved with the try
  and settled to what it cost. If `AI_SITE_CAP` refuses it, or it fails,
  refuses or returns output that does not validate, the first reading
  stands; it never fails the try. An image the second look still finds empty
  keeps the reason it gave. When the second look is shown one image, every
  entry it returns belongs to that image, whatever number the model wrote;
  shown several, an entry for an image it was not shown is dropped.
- **Validation is per field** (`server/receipts.js`). A field that fails its
  check becomes null rather than failing the try: currency symbols become
  codes first (RM → MYR, S$ → SGD, £ → GBP, € → EUR, US$ → USD; a bare `$`
  or `¥` names several currencies and becomes null), a negative or absurd
  quantity becomes null, an impossible date becomes null, and items past 100
  are dropped. Only output with the wrong structure (not JSON, or `receipts`
  not a list) goes to the one repair call (text only, no images), which does
  not cost the visitor a try.
- **Answers:** 200 `{ receipts, triesLeft }`; the failures are the shared ones
  in "AI tools: the shared limiter" above.
- Results are an editable list with each receipt's line items, an add-up
  check, and a Category field with suggestions. CSV (UTF-8 with BOM), Excel
  (two sheets, via `write-excel-file`, loaded on click) and copy as
  tab-separated text all happen in the browser. Text from a receipt that
  would start a spreadsheet formula is prefixed with an apostrophe.
- Live since 2026-10-26, after Ting Yu's own receipts were read on the live
  tool: nine photos (Singapore supermarket and F&B, one with handwriting, one
  half hidden, Malaysian ringgit, two London receipts, and a page that is not
  a receipt) all came back right, and the CSV and Excel exports checked out.
  The expected values are in `src/apps/receipt-reader/__fixtures__/expected.json`;
  the photos themselves are personal and stay out of git.

### APP-003 PDF merge and split (`src/apps/pdf-merge-and-split/`)

Browser tier: the PDFs never leave the visitor's browser. The only requests
are the anonymous open and download counts.

| File | Does |
| --- | --- |
| `ranges.js` | the "Pages to keep" parser and its messages, pure, tested in `ranges.test.js` |
| `order.js` | Move up, Move down and drag-to-place, pure, tested in `order.test.js` |
| `files.js` | the 20-file and 50 MB limits, checked from sizes before anything is read |
| `names.js` | the names of the files handed back |
| `pdf.js` | read, merge, keep pages and split, with pdf-lib, zipped with fflate |
| `thumbs.js`, `Thumbnails.jsx` | page thumbnails for Split, drawn with pdf.js (through `_shared/pdfjs.js`) as they scroll into view; the list takes focus so the keyboard can scroll it |
| `MergePanel.jsx`, `SplitPanel.jsx`, `Outcome.jsx`, `index.jsx` | the page: two tabs, both kept mounted |
| `copy.js` | every word |
| `__fixtures__/` | test PDFs: `fixtures.js` builds them, `make-fixtures.mjs` writes them out for trying by hand |

- **Nothing of Jura's goes into the files.** New documents are created
  without pdf-lib's producer, creator or dates. The source title is kept
  only when one file is involved (a merge of one file, kept pages, split
  pages); a merge of several has no title.
- **Pages copy as they are**, with their size, rotation, fonts and text, so
  text stays selectable. Kept pages come out in the file's own order, once
  each: "Pages to keep" picks pages, it does not rearrange them.
- **Problems are per file.** A file is checked as it is added: no `%PDF-`
  in its first 1024 bytes is "not a PDF", a pdf-lib encryption error is
  "password protected", any other failure (or no pages) is "damaged". The
  file keeps its place with its message and is left out of the merge; the
  rest of the list is untouched. While any file has a problem, a warning
  above "Merge and download" says it will be left out. Encrypted files are never opened with
  `ignoreEncryption`. pdf-lib's errors are ES5 classes, so `instanceof
  EncryptedPDFError` is false at run time; the check also reads the
  message, and `pdf.test.js` holds both libraries to the same answer on a
  hand-built `/Encrypt` fixture.
- **Limits are checked from `File.size`** before a byte is read. A batch
  that would pass 20 files or 50 MB in total is refused whole.
- **Split ZIPs** name each page `<original name>-page-01.pdf`, padded to
  the widest page number (`-page-001.pdf` for a file of 100 pages or
  more), stored without recompression because PDFs are already compressed.
- **Thumbnails** start as placeholders of the right shape. A page is drawn
  only when it nears the screen, one at a time, and kept as a small JPEG,
  so a 200-page file opens as quickly as a short one.
- **Loading.** `pdf.js` (with pdf-lib and fflate) is fetched when the page
  is idle or the first file is added; pdf.js the library only for Split.
  None of it reaches any other page.

### APP-004 Product photo studio (`src/apps/product-photo-studio/`, `server/product-photo-studio.js`)

The visitor adds 1 to 4 product photos and, if they like, an instruction
("Remove the background and put it on clean white"; the box rotates example
prompts and offers them as chips) and their business name. One try gives
three posts, each in a frame styled like a social media post (no Instagram
name or marks): a header with the business name, the picture, an action row,
the caption. Each frame can switch between the three captions or edit one,
save the picture as 1080 x 1350 or a 1080 x 1080 square (through the share
sheet where the browser offers it), and copy its caption. The last result
stays in the tab's `sessionStorage`, so a reload after switching apps keeps it.

- **The browser** decodes each photo once and makes two JPEGs: 1600 px at
  0.8 for Claude (`files`) and 512 px at 0.85 for the image model (`refs`),
  in `src/apps/_shared/photos.js`.
- **Claude** (Haiku 5.5, structured output, `server/photo-studio.js`) reads the
  photos and fields as data and returns the products it sees, three posts
  (`look`, `edit_prompt`, `caption`, `hashtags`, `alt`) and `no_product`.
  The system prompt is a product photographer's brief: keep each product
  exactly as it is, change only background, surface, props, light and framing,
  positive phrasing only (FLUX has no negative prompt), and three looks that
  differ unless the instruction fixes one. Captions make no claim (price,
  offer, halal, vegan, health, award) the owner did not type, and name a brand
  only when it is on the product or typed. The server checks the output again:
  ™ ® © and image numbers that do not exist in an edit prompt, claim words
  the owner did not give, 5 to 10 distinct hashtags. A failure is repaired
  once, then refunded.
- **The pictures** are Cloudflare Workers AI FLUX.2 [klein] through the `AI`
  binding (`server/image-gen.js`): the edit prompt plus a fixed brand-safe
  suffix, 1024 x 1280, and the refs as `input_image_0` to `input_image_3`.
  The photos do reach the image model, on purpose
  (`docs/adr/0002-product-photos-go-to-the-image-model.md`). The three are
  drawn in parallel. Each gets up to 3 attempts on `AI_IMAGE_MODEL` (default
  `@cf/black-forest-labs/flux-2-klein-4b`), then one on the other klein model;
  9B answered a fast HTTP 500 (code 3043) on about 40% of calls when tested on
  2026-10-27. A timed-out picture ends there and keeps its price.
- **Plan and quota.** The account is on the Workers free plan: 10,000 neurons
  a day, reset at 00:00 UTC (08:00 SGT). A 4B picture with references is
  about 180 neurons, so the site manages about 18 tries a day; 9B is about
  1,450 a picture. A quota error (code 4006, "used up your daily free
  allocation") closes this tool only, until 00:00 UTC: a row in `app_tries`
  under `#site` / `#closed:product-photo-studio` for the UTC day, checked
  before Turnstile and the try. The other AI tools stay open. Moving to
  Workers Paid lifts the quota; then set `AI_IMAGE_MODEL` to
  `@cf/black-forest-labs/flux-2-klein-9b` for better, faster pictures.
- **Money.** A try reserves Claude's worst case plus three pictures at the
  dearer of the model and its fallback, and settles each picture drawn at its
  list price (`PRICES` in `image-gen.js`: about US$0.002 a 4B picture, US$0.016
  a 9B one, checked 2026-10-27). At least one picture or the try is refunded
  and the answer is 503. `no_product` is 422 and the try stays used (no picture is drawn, and the pictures' reservation is released).
- **The endpoint.** `POST /api/apps/product-photo-studio`, multipart: `token`,
  1 to 4 `files` (JPG, PNG or WEBP, 4 MB each), the same number of `refs`
  (JPEG, at most 512 px and 300 KB), optional `name` (80) and `instruction`
  (500). Answers `200 { products, posts: [{ look, caption, hashtags, alt,
  image? }] x 3, triesLeft }`, `422 no_product`, `429 limit | cap`,
  `400 bad_request | count`, `403 bot_check`, `413 too_large`,
  `415 heic | type`, `502 unreadable` (reason `refused` or `rejected`),
  `503 busy`, and `503 unavailable` (reason `bad_output` when the output was
  still wrong after the repair). The header comment
  of `server/product-photo-studio.js` is the full contract.
- **Preview deploys** carry no `AI` binding (it is set on Production only), so
  the studio reports itself unavailable there; that is expected.
- **Local runs** have no `AI` binding, so the tool reports itself unavailable
  under `npm run dev:functions`. Adding `--ai AI` to the `wrangler pages dev`
  command uses the real, billed Workers AI.
- **The browser's pure pieces**: `compose.js` (crop geometry and file names),
  `post-state.js` (blockers and messages), `session.js` (the kept result).

### APP-005 Invoice builder (`src/apps/invoice-builder/`)

Browser tier: the invoice never leaves the visitor's browser. The only
requests are the anonymous open and completion counts. It is built from the
quote builder's parts, so it looks and adds up the same way, and it prints
the visitor's name only, never Jura's.

| File | Does |
| --- | --- |
| `model.js` | the invoice's shape, `newInvoice` and "New invoice", the suggested number `INV-YYYYMMDD-01`, the GST default and `INVOICE_LIMITS` |
| `totals-rows.js` | which totals rows show and the final line ("Total", or "Amount with GST" with GST on); the preview and the PDF both draw from it |
| `required.js` | `missingFields`: what a tax invoice still needs, in form order, each linked to its input |
| `download.js` | the "Download PDF" step: no file while a field is missing or a figure shows an error, otherwise build, save and count one completion |
| `invoiceFile.js` | the saved invoice file, `{ format: "jura-invoice-builder", version: 1, invoice }` (ADR 0005), and `invoiceFromQuote` for starting from a quote file |
| `remember.js` | "Remember", through `_shared/storage.js` |
| `pdf.js` | the A4 PDF, with pdf-lib, loaded only when a PDF is wanted |
| `InvoiceForm.jsx`, `GstFields.jsx`, `InvoicePreview.jsx`, `FileActions.jsx`, `index.jsx` | the page |
| `copy.js` | every word, including the PDF's |
| `fixtures.js` | test invoices and storage stubs, used only by the tests |

- **It depends on the quote builder.** It imports `calc.js` (the money),
  `model.js` (limits, dates, item ids, `readGst`), `quoteFile.js` (the field
  readers and `parseQuoteFile`), `logo.js`, `winansi.js`, `pdf-geometry.js`,
  `pdf-text.js` (`wrapText`), `form-parts.jsx`, `quote-builder.css`, and
  `copy.js` for the quote's default note, which is left behind when a quote
  file is opened. A change to any of those changes the invoice too, so run the
  invoice's tests with the quote's. It never imports the quote's `pdf.js`,
  `totals-rows.js` or `effectiveQuote`, and the "Jura Solutions" placeholder
  is used only to keep it out of an invoice opened from a quote saved without
  a business name.
- **Money** is the quote builder's: integer cents, rounded half up once at
  each line total and once at GST, on the amount after discounts. The invoice
  has no prices-include-GST mode, so GST is always added on top.
- **GST** is off by default; the rate defaults to 9% (the IRAS URLs and the
  date checked are beside `DEFAULT_GST_RATE` in `model.js`) and stays
  editable. With GST off the document is titled "Invoice" and shows no
  registration number, rate or GST line. With GST on it is titled "Tax
  invoice", the form asks for the GST registration number and rate, and the
  totals end with "Amount before GST", "GST (9%)" and "Amount with GST".
  "Download PDF" then makes no file until every required field is filled,
  and lists each missing one as a link to its input. Nothing on the page or
  the PDF says the document meets IRAS rules.
- **The number** starts as `INV-YYYYMMDD-01` from the invoice date, typed into
  the field as real text. It follows the date until the visitor edits it;
  "New invoice" on the same day suggests `-02`. A number opened from a file is
  the visitor's and does not follow the date.
- **The PDF** uses Helvetica like the quote's, with the same pagination: rows
  move to the next page whole, headings repeat, and the totals stay together.
  It has no "Made with" line, and its metadata does not name Jura.
- **Remember** (`jura.invoice-builder.business.v1`) keeps the business
  details with the logo, the GST setting, the payment details and the last
  number, only while ticked. Never the customer, items, dates or notes.
- **Files.** "Save invoice file" writes `<number>.invoice.json`. "Open invoice
  file" and "Open quote file" share one picker and accept both kinds of file.
  A quote file brings in the customer, items, discounts, notes and GST
  setting; the page keeps its number, dates and payment details, and only
  its empty business fields (and a missing logo) are filled from the quote.
  A quote saved with prices that include GST opens with the prices as typed
  and a warning to change them to the amount before GST. Anything else,
  including a file over 3 MB or a newer version, shows the bad-file message
  and changes nothing.

## Unsubscribe and bounces (scout PRD §5.5, §5.9)

The growth CLI (`repos/growth`) sends the outreach emails; this site holds the
pieces that must answer on jurasolutions.sg. Both sides keep to one contract.

**The unsubscribe token**

```
email_hash = lowercase hex SHA-256 of email.trim().toLowerCase()
sig        = base64url, no padding, of HMAC-SHA256(key = UNSUBSCRIBE_SECRET as UTF-8,
                                                    message = email_hash as UTF-8)
token      = email_hash + "." + sig
link       = https://jurasolutions.sg/unsubscribe?t=<token>
```

Test vector: secret `test-unsubscribe-secret-not-real`, email
`  Ada.Tan@Example.COM ` →
`276a4cb89c2b449b7444fa94ad0b36ab8b07c8172f1605dd809ba1fd7e1bb4c1.lm_oAchTzYpC45_b6R-ExhHfUM-kMyDxnIHIisNbKpo`.

- `GET /unsubscribe?t=` (the link in the email) checks the signature in
  constant time, adds `suppression(reason='unsubscribe',
  source='unsubscribe-link', email=NULL)`, and 303s to `/unsubscribed`. A
  bad token goes to `/unsubscribed?status=invalid` and writes nothing; a
  missing secret or D1 goes to `?status=error`. Unsubscribing twice adds a
  second row.
- `POST /unsubscribe?t=` is RFC 8058 one-click (the email carries
  `List-Unsubscribe: <https://jurasolutions.sg/unsubscribe?t=...>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`): same write with
  `source='unsubscribe-post'`, 200 with no body, or 400 for a bad token.
- Because the GET unsubscribes on the first request, a mail security scanner
  that opens every link would unsubscribe the address. That is what the
  contract asks for (one click, no confirmation step), and it errs on the
  side of not emailing someone.

**The Resend webhook**, `POST /api/resend-webhook`: Svix-signed (`svix-id`,
`svix-timestamp`, `svix-signature`; content `${id}.${timestamp}.${body}`,
HMAC-SHA256 with the base64 part of `RESEND_WEBHOOK_SECRET` after `whsec_`;
any `v1,` entry may match; timestamps over 5 minutes off are refused).
`email.bounced` and `email.complained` add each address in `data.to`, with
`resend_email_id = data.email_id`; other events get a 200 and are ignored. A
bad signature is a 401; a missing secret or D1 is a 503 so Resend retries.
Event names and payload fields were checked against Resend's docs on
2026-10-24.

**One row per event, never changed.** `suppression` is an append-only log
(`migrations/0003_suppression_append_only.sql`). Every unsubscribe, bounce and
complaint inserts a new row with its own `id`, even for an address already in
the table, and triggers refuse any UPDATE, DELETE or replacing insert. The
growth CLI's outreach sync reads the rows after the last `id` it processed and
acts on each one, so a complaint is always seen (the scout's auto-pause
depends on it) even after an earlier unsubscribe. Any row for a hash means the
address is suppressed; with several, the strongest reason wins (complaint,
then bounce, then unsubscribe and manual). The table shape is the "D1
contract" in `repos/growth/docs/scout.md`; change both sides together.

## Environment variables

Set on the Pages project for **Production and Preview**, then redeploy (see
"Deploying" below for why the redeploy matters). The full click-by-click
setup is in `jurasolutions/outputs/growth/setup/toolbox-ai.md`.

| Name | Kind | Used by | Default |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | secret | `/submit` | none: the form cannot send |
| `ANTHROPIC_API_KEY` | secret | AI tools | none: AI tools unavailable |
| `TURNSTILE_SECRET` | secret | AI tools | none: AI tools unavailable |
| `VITE_TURNSTILE_SITE_KEY` | plain, **build time** | the AI tool pages | none in production; the dev server uses Cloudflare's test key |
| `VISITOR_SALT` | secret | AI tools | none: AI tools unavailable |
| `AI_TRIES_PER_DAY` | plain | AI tools | `5` |
| `AI_TRIES_PER_IP` | plain | AI tools | `15` |
| `AI_DAILY_BUDGET_USD` | plain | AI tools | `5` (US dollars a day, all visitors together) |
| `AI_SITE_CAP` | plain | AI tools | unset: no call cap, only the budget |
| `AI_LIMIT_SCOPE` | plain | AI tools | `all` (or `per-tool`) |
| `AI_UNLIMITED_NETWORKS` | secret | AI tools | unset: every network is counted |
| `AI_PROMO_CODE_SHA256` | secret | AI tools (the access code) | unset: the built-in code's hash |
| `AI_IMAGE_MODEL` | plain | product photo studio | `@cf/black-forest-labs/flux-2-klein-4b` (or `-9b` on Workers Paid) |
| `UNSUBSCRIBE_SECRET` | secret | `/unsubscribe` (same value as the growth CLI) | none: links do not verify |
| `RESEND_WEBHOOK_SECRET` | secret | `/api/resend-webhook` | none: webhooks refused |

Local testing only, **never set on Pages**: `ANTHROPIC_BASE_URL` and
`TURNSTILE_VERIFY_URL` (point the Functions at stand-ins),
`VITE_SHOW_DRAFTS=1` (a production build that still opens draft tools), and
`AI_ALLOW_DRAFTS=1`, its server-side partner. Without it the Functions treat a
`draft` tool as absent: its AI endpoint and `/api/apps/limit?tool=<slug>`
answer 404 before Turnstile, the counter or the API, and `/api/apps/usage`
does not count it (`server/drafts.js`). That keeps a tool that is not signed
off from spending money in production even once the AI variables are set.

For local runs, Cloudflare's Turnstile test keys: site key
`1x00000000000000000000BB` (invisible, always passes) or
`2x00000000000000000000BB` (always fails); secret
`1x0000000000000000000000000000000AA` (always passes) or
`2x0000000000000000000000000000000AA` (always fails).

## D1

One database, bound as `DB`. The schema is `migrations/0001_toolbox.sql`,
`migrations/0002_spend.sql` and `migrations/0003_suppression_append_only.sql`
(wrangler's migrations format, applied in number
order); every `day` is the SGT date:

| Table | Holds |
| --- | --- |
| `app_tries(day, visitor_hash, tool, count)` | AI tries per visitor; `tool` is `*` when shared |
| `app_calls(day, count)` | AI calls per day (and the optional call cap) |
| `app_spend(day, nano_usd)` | what the AI tools spent on the Claude API that day, for the budget |
| `app_usage(day, app_slug, opens, completions)` | anonymous counts |
| `suppression(id, email_hash, email, reason, source, resend_email_id, created_at)` | addresses never to email, one append-only row per event |

Locally, `npm run db:migrate:local` creates the tables in `.wrangler/state`,
and `npm run dev:functions` serves the built site with that database. To look
inside: `npx wrangler@4.86.0 d1 execute jura-toolbox-local --local -c wrangler.local.toml --persist-to .wrangler/state --command "SELECT * FROM app_usage"`.

## Tests

`npm test` runs Vitest. Nothing in the suite touches the network: every
`fetch` is stubbed, and an unstubbed request fails the test. The Functions are
called directly (`onRequestPost({ request, env })`) against an in-memory D1
built on sql.js with the real migrations.

| File | Covers |
| --- | --- |
| `src/apps/quote-builder/calc.test.js` | every money case in APP-001, rounding, float artefacts |
| `src/apps/quote-builder/quote.test.js` | quote file round trip, PDF pagination and logos, WinAnsi, running numbers and placeholders |
| `src/apps/quote-builder/draft.test.js` | applying an AI draft to the quote, and what a failed draft says |
| `src/apps/receipt-reader/receipts.test.js` | the add-up check, CSV/XLSX/TSV exports, resize rules |
| `src/apps/receipt-reader/read-state.test.js` | out of tries, why Read receipts is off, when the tool shows its own talk-to-us card, and the sentence for each failed read (refused, rejected, bad output, busy, offline, and when the try wasn't counted) |
| `src/apps/_shared/pdfjs.test.js` | opening a PDF with the shared pdf.js loader, cleaning up a failed load, JPEG encoding |
| `src/apps/invoice-builder/totals.test.js`, `totals-rows.test.js`, `required.test.js` | every money case in APP-005 with the quote's `calc`, the totals rows with GST on and off, and each required field of a tax invoice |
| `src/apps/invoice-builder/pdf.test.js` | the invoice and tax invoice PDFs: titles, every printed item, pagination at 40 lines, totals kept together, no Jura name |
| `src/apps/invoice-builder/invoiceFile.test.js` | invoice file round trip (same invoice, totals and PDF text), quote files version 1 and 2, the quote with prices that include GST, every refused file leaving the invoice unchanged |
| `src/apps/invoice-builder/model.test.js`, `download.test.js`, `remember.test.js`, `copy.test.js`, `offline.test.js`, `page.test.js` | the suggested number, "New invoice", the download step and its count, Remember, the PRD's words, no requests or copied maths, the registry entry and talk-to-us card |
| `tests/invoice-builder-ui.test.js`, `tests/invoice-builder-files-ui.test.js` | the invoice page: labels, linked hints, live regions, tap targets, the GST-off preview, Remember, the file buttons and the bad-file message |
| `src/apps/pdf-merge-and-split/ranges.test.js`, `order.test.js` | the page range parser and its messages; reordering by buttons and drag |
| `src/apps/pdf-merge-and-split/pdf.test.js` | merging the three fixture page sizes, kept pages, split ZIPs, metadata, password, damaged and non-PDF files |
| `src/apps/pdf-merge-and-split/files.test.js`, `names.test.js` | the 20-file and 50 MB limits before reading, per-file messages, output names |
| `src/apps/pdf-merge-and-split/offline.test.js`, `page.test.js` | no requests from the tool's code; the registry entry, the page as it opens, the left-out warning and the focusable thumbnails |
| `tests/limiter.test.js` | the try limit, the per-IP ceiling (IPv6 by /64), site cap, bounded refunds, D1 errors part-way, upload checks, Turnstile |
| `tests/budget.test.js` | the defaults (5 a visitor, 15 an IP, US$5 a day), pricing from `usage`, reserving and settling, the budget stopping everyone, unbilled errors, the next day |
| `tests/receipt-reader.test.js` | the Claude request and its image labels, the prompt, the injection fixture, per-field validation, entries tied to images, the second look, logs, storage |
| `tests/quote-drafter.test.js` | the quote draft request, input checks, repair, refunds, shared tries, logs, validation |
| `tests/product-photo-studio.test.js`, `tests/photo-studio.test.js`, `tests/image-gen.test.js`, `tests/ai-run.test.js` | the studio's Function (pictures, money, partial and failed pictures, the quota close), its output check, the Workers AI adapter, the shared `finish` step |
| `tests/receipt-reader-ui.test.js` | the receipt reader page: the try notice and talk-to-us card, the not-a-receipt cards and their photos, photo numbers in the file list, HEIC, and which photo previews are released |
| `tests/product-photo-studio-ui.test.js` | the studio page: blockers, messages, request fields, crops, kept results |
| `tests/unsubscribe.test.js` | the token contract (with a fixed vector), GET and one-click POST |
| `tests/resend-webhook.test.js` | Svix verification, bounces, complaints, precedence, retries |
| `tests/usage.test.js`, `tests/enquiry.test.js`, `tests/shell.test.js` | counter, `from` value, registry, routes, pages, prerendered heads |
| `tests/router.test.js` | focus and scroll on navigation, back and forward |
| `tests/ui.test.js` | rendered markup: hints and errors linked to inputs, live regions, the view switch, tap targets |

## The enquiry form

Fields: name, work email, contact number, company, and what they would like to
automate. Name, work email and the description are required; contact number and
company are optional, because asking for a phone number before a first
conversation is friction that is not needed.

Validation runs in the browser (`src/lib/validate.js`) and again in the Function.
Failures show inline field errors plus a summary, and focus moves to the first
field that needs attention. A failed send keeps everything the visitor typed.

`functions/submit.js` posts to Resend and answers:

| Status | Means |
| --- | --- |
| 200 | sent |
| 400 | the enquiry did not validate |
| 405 | any method other than POST or GET |
| 500 | `RESEND_API_KEY` is not set on the Pages project |
| 502 | Resend refused or was unreachable |

Mail goes to `info@jurasolutions.sg` from `no_reply@jurasolutions.sg`, with
`reply_to` set to the enquirer.

**Where the enquiry came from.** Toolbox pages link to the form as
`/?from=apps/<slug>#contact`. The form reads `from` when it sends and passes it
on; the Function accepts it only if it matches `^apps/[a-z0-9-]{1,60}$` and
adds a line `Came from: apps/<slug>` to the text and HTML email. Anything else
is dropped silently and the enquiry still sends, so an odd link never costs an
enquiry.

### Checking the endpoint is live

`GET /submit` is a health check:

```bash
curl https://jurasolutions.sg/submit
```

JSON back (`{"endpoint":"enquiry","ok":true,"canSend":true}`) means the Function
is deployed, and `canSend` says whether `RESEND_API_KEY` is visible to that
deployment. **HTML back means the Function is not deployed at all** — an absent
`/submit` falls through to the static handler, which serves `index.html` on GET
and rejects POST with 405. That is worth knowing, because a missing Function and
a broken one otherwise look identical from the browser.

## Deploying to Cloudflare Pages

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or later |

`functions/` is picked up automatically; Pages generates `_routes.json` so
only the Function paths (`/submit`, `/unsubscribe`, `/api/*`) invoke a
Function and everything else is served as static files.

The Functions need the D1 binding `DB`, the Workers AI binding `AI` (Production
only; added through the Cloudflare API on 2026-10-27, used by the product photo
studio) and the variables in "Environment
variables" above, on **Production and Preview**. None of them is ever
committed. The full setup, click by click, is in
`jurasolutions/outputs/growth/setup/toolbox-ai.md`.

There is deliberately no `wrangler.toml`. With one that has
`pages_build_output_dir`, Pages would take bindings from the file instead of
the dashboard; `wrangler.local.toml` is for local commands only.

**Setting a variable is not enough on its own.** Pages binds environment
variables to a deployment when that deployment is built, so a secret added after
the fact is invisible to everything already running. The form keeps reporting a
failed send until a new deployment is created — push a commit, or use Retry
deployment on the latest build. The health checks tell this apart from a bad
key:

| Check | Means |
| --- | --- |
| `GET /submit` → `canSend: false` | `RESEND_API_KEY` not visible to this deployment |
| `GET /api/apps/limit` → `ready: false` | `DB`, `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET` or `VISITOR_SALT` missing |
| `GET /api/apps/limit?tool=product-photo-studio` → `ready: false` | the `AI` binding is missing, or `AI_IMAGE_MODEL` is not a priced model |
| `GET /api/resend-webhook` → `canVerify` / `canStore: false` | `RESEND_WEBHOOK_SECRET` / `DB` missing |
| HTML instead of JSON from any of them | the Functions are not deployed at all |

Check each variable is set for **Production** as well as Preview. They are
separate environments and the custom domain serves Production.

`VITE_TURNSTILE_SITE_KEY` is read at **build** time, so it must be set before
the build that should use it.

### Before the form can deliver

- `jurasolutions.sg` DNS pointed at Cloudflare Pages
- `jurasolutions.sg` verified in Resend so `no_reply@jurasolutions.sg` can send
- `RESEND_API_KEY` set in the Pages environment

## Brand rules this codebase has to keep

Both come from `design-system/README.md` §3 and apply to every change:

1. **Never publish a figure the business cannot evidence.** No client counts, no
   hours saved, no ROI percentages, no logos. Defensible ranges and ceilings only.
   `EffortMeter` stays at `80%+`; the `LiveDashboard` caption says the numbers are
   illustrative.
2. **Warm and plain-spoken.** Sentence case, second person, short declaratives. No
   buzzwords, no manufactured urgency, no emoji, no exclamation marks.

Copy lives in content files so it can be read end to end against those rules
(and run through `jura-growth check` once it exists):

- `src/content.js`: the home page, nav, footer, toolbox index, tool page shell,
  shared components, privacy page, unsubscribe page, not-found page
- `src/apps/quote-builder/copy.js`: the quote builder, including its PDF
- `src/apps/receipt-reader/copy.js`: the receipt reader, including its exports
- `src/apps/pdf-merge-and-split/copy.js`: PDF merge and split
- `src/apps/invoice-builder/copy.js`: the invoice builder, including its PDF

The Functions return codes, never wording; the pages own every word.

## Not done yet

- **Open Graph image.** The page has OG and Twitter tags but no `og:image`. That
  needs a real 1200×630 asset, and Jura has no photography yet. Add the file to
  `public/` and the tag to `index.html` when one exists.
- **Spam handling on the enquiry form.** `/submit` has no rate limit or honeypot.
  Turnstile is now set up for the AI tools and could be added to the form if the
  inbox starts collecting noise.
- **Terms page.** There is a privacy notice but no terms page.
