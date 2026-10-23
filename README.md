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
```

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
  api/apps/usage.js      POST /api/apps/usage, anonymous open/complete counts
server/                  code the Functions share; outside functions/ so it is never a route
migrations/              D1 schema, wrangler migrations format
scripts/                 design system sync, per-route <head> prerender
src/
  App.jsx                the router shell: nav, the current page, footer
  content.js             every word on the site pages (tools keep theirs in copy.js)
  ds.js                  design system import point
  pages/                 Home (the nine house sections, unchanged), AppsIndex, AppPage, NotFound
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
| `/apps` | the toolbox index, from the registry, filterable by category |
| `/apps/<slug>` | one tool, its code loaded only on that page |

Routing is a small history-API router (`src/lib/router.js`); there is no
routing library. It intercepts clicks on same-origin links to these paths, so
the design system's `Button href` works unchanged. On the home page the nav and
footer links stay plain `#section` anchors exactly as before; on every other
page they point to `/#section`.

Cloudflare Pages serves `index.html` for any path that is not a file, because
there is no top-level `404.html`. After `vite build`,
`scripts/prerender-routes.mjs` writes `dist/apps.html` and
`dist/apps/<slug>.html` for each live tool: the same SPA with that route's
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
  "category": "Sales", "tier": "browser", "status": "live",
  "added": "2026-10-24", "prd": "APP-001" }
```

`category` is one of Sales, Finance, Admin, HR, Marketing, Documents. `tier`
is `browser` or `ai`. Only `live` tools are listed on `/apps` or prerendered; a
`draft` tool's page opens on the local dev server only.

**Adding a tool is one folder and one registry entry.** The folder is
`src/apps/<slug>/` with an `index.jsx` (default export: the tool) and a
`copy.js` (default export: its words). `src/apps/loaders.js` finds both by
folder name, so nothing else needs wiring. Every tool page gets the same shell
(`src/apps/_shared/AppShell.jsx`): the one-line promise, the tool, a privacy
note, then a talk-to-us card linking to `/?from=apps/<slug>#contact`.

Shared pieces in `src/apps/_shared/`: `AppShell`, `FileDrop`, `ExportButtons`,
`TryLimitNotice`, `TalkToUsCard`, `PrivacyNote`, plus `usage.js` (the
fire-and-forget counter), `storage.js` (localStorage that never throws) and
`download.js`.

### Usage counts

Each tool page counts one anonymous `open`, and each tool counts a `complete`
when the visitor gets the result (a PDF downloaded, receipts read). The browser
sends `POST /api/apps/usage` with `{ slug, event }` by `navigator.sendBeacon`
and never waits for it. The Function checks the slug against the registry and
adds one to `app_usage` for that SGT day. Nothing personal is stored: no IP, no
cookie, no content.

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

`functions/` is picked up automatically and served at `/submit`.

Set one environment variable on the Pages project, for both Production and
Preview:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | the Resend API key |

It must never be committed. Without it the endpoint returns a clean 500 and the
form shows its error state.

**Setting the variable is not enough on its own.** Pages binds environment
variables to a deployment when that deployment is built, so a secret added after
the fact is invisible to everything already running. The form keeps reporting a
failed send until a new deployment is created — push a commit, or use Retry
deployment on the latest build. `GET /submit` reports `canSend: false` while the
running deployment cannot see the key, which is the quickest way to tell this
apart from a bad key.

Check the variable is set for **Production** as well as Preview. They are
separate environments and the custom domain serves Production.

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

Copy lives in one file, `src/content.js`, so it can be read end to end against
those rules.

## Not done yet

- **Open Graph image.** The page has OG and Twitter tags but no `og:image`. That
  needs a real 1200×630 asset, and Jura has no photography yet. Add the file to
  `public/` and the tag to `index.html` when one exists.
- **Spam handling.** The endpoint has no rate limit or honeypot. Cloudflare Turnstile
  is the natural fit if the inbox starts collecting noise.
- **Privacy and terms pages.** Not linked, because they do not exist.
