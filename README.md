# Jura Solutions — marketing site

The public one-page site for Jura Solutions, built from the Jura Solutions design
system. React + Vite, deployed to Cloudflare Pages on `jurasolutions.sg`.

Built against `jurasolutions/prd/pending/prd-jura-website-2026-08-27.md`.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
```

`npm run dev` and `npm run preview` serve the page but **not** the enquiry
endpoint — Vite does not run Cloudflare Pages Functions. Submitting the form
locally will show the form's error state, which is correct behaviour. To
exercise the real endpoint:

```bash
npm run build
npx wrangler pages dev dist                  # add --binding RESEND_API_KEY=... to send for real
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
functions/submit.js      Cloudflare Pages Function: POST /submit → Resend
scripts/                 design system sync
src/
  App.jsx                the nine house sections, in order
  content.js             every word on the page
  ds.js                  design system import point
  components/Section.jsx the page band and its node on the spine
  sections/              hero, problem, services, how, proof, trust, faq, contact, footer
  lib/                   icon registration, enquiry validation
  styles/site.css        page composition only — tokens do the rest
  design-system/         synced copy, read-only
```

Sections are separate components and copy is separate from markup, so the client
portal (a later PRD) can be added alongside without restructuring.

### The spine

The one structural device the page adds on top of the design system: a hairline
running down the left of the page from the hero claim to the closing conversation,
with a node at each section. The page reads the way Jura describes its work — one
process, written down, with a beginning and a handover. Below 1024px the rail is
hidden and each node becomes the ordinary eyebrow above its heading, so nothing is
lost on a phone.

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
