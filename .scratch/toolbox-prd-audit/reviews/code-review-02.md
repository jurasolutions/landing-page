# Code review 02: the built toolbox against its PRDs

Branch `crew/toolbox-prd-audit`, reviewed against `619e252` (origin/main and the merge-base). Commits `42b2bf8..4d276d1` hold the toolbox. Commit `5ea2019` only adds crew docs. Reviewed 2026-10-25.

## Verdict: changes requested

One finding blocks: **the site-wide AI cap does not hold** (finding 1). Block 3's done-check, "a test site-wide cap of 3 holds", fails when the model refuses or returns bad output, because those failures hand the call back to the cap. Everything else is *should fix* or *nit*.

What is safe today: the AI tools stay off in production until `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`, `VISITOR_SALT` and `DB` are all set (`server/ai-tool.js:12-14`). Finding 1 must be fixed before those variables go on the Production environment. A fix that lands after the push is acceptable only if that order is kept.

## Evidence I ran

| Command | Result |
|---|---|
| `npm test` | 10 files, 178 tests passed (1.97 s) |
| `npm run build` | `vite build` ok (1912 modules). The prerender wrote `apps.html`, `privacy.html`, `unsubscribed.html` and `apps/quote-builder.html` |
| `grep` of the heads in `dist/` | `apps/quote-builder.html` has its own title, description, canonical, `og:*` and `twitter:*`. `unsubscribed.html` carries `noindex` |
| Scratch probe against the real Functions and the in-memory D1, kept outside the repo | **P1:** `AI_SITE_CAP=3` with 10 refusals gave 10 API calls; `app_calls` and `app_tries` both ended at 0. **P2:** the draft receipt-reader API answers 200, and usage accepts the draft slug (204). **P3:** with D1 bound but no migrations, `/api/apps/limit` returns 503 `ready:false`, usage returns 503, and the receipt reader throws "no such table". **P4:** three fresh `jura_vid` values from one IP gave 6 successful reads and 6 API calls |
| `jura-growth check-copy` on `content.js`, both `copy.js` files and `registry.json` (run by both axis reviewers) | 304 of 304 strings pass |
| `git diff --name-only 619e252...HEAD -- src/design-system dist .dev.vars .env wrangler.toml` | empty: no blocked path was touched |

---

## (a) Per-PRD checklist

Statuses are **met**, **partly**, **not met**, or **n/v** (cannot be verified in code: it needs a real device, a real PDF reader or real receipts).

### App factory PRD (`prd-jura-app-factory-2026-10-24.md`)

| Item | Status | Evidence |
|---|---|---|
| §2.1 `/apps` lists every live tool from one registry, filterable by category | met | `src/apps/registry.json`; `src/pages/AppsIndex.jsx:15-19,77-85`; `tests/shell.test.js:103`. The filter appears once two or more categories are live; today only Sales is |
| §2.2 a page per tool, design system, privacy note, talk-to-us card tagged with the tool | met | `src/apps/_shared/AppShell.jsx:28-58`; `TalkToUsCard.jsx:10-12`; `tests/shell.test.js:116` |
| §2.3 one folder plus one registry entry | partly | `src/apps/loaders.js` finds tools by folder. A new icon still means editing `src/lib/icons.js` (finding 9) |
| §2.4 2 tries per SGT day, site cap, Turnstile, nothing stored | partly | `server/limit.js:49-80`, `server/http.js:26`, `server/turnstile.js`. The cap leaks (finding 1), and a fresh cookie resets the count (finding 3) |
| §2.5 APP-001 and APP-002 live | partly, by design | `registry.json:8` live; `registry.json:18` draft (see deviations below) |
| §2.7 all copy passes the brand checker | met | 304 of 304 pass |
| §3 enquiry `from` value | met | `src/sections/Contact.jsx:55-62` → `functions/submit.js:29-30,66-84,106`; `tests/enquiry.test.js:37` |
| §4 design system only; no time or money claims; the visitor's branding on documents | met (one nit) | No savings claims in the copy. PDF Creator metadata is always Jura's (finding 7) |
| §4 `claude-haiku-5-5` and a dedicated key with a spend limit | met | `server/anthropic.js:21`; `jurasolutions/outputs/growth/setup/toolbox-ai.md` §5 |
| §4 D1, not KV; identity only as a salted hash | met | `migrations/0001_toolbox.sql:13-26`; `server/visitor.js:44-52` |
| §5.1 folder layout: registry, `_shared`, one folder per tool, one Function per AI tool | met (deviation kept) | `src/apps/`, `functions/api/apps/`. The limiter lives in `server/` (see deviations) |
| §5.1 six categories | met | `src/apps/registry.js:17` |
| §5.1 `/apps/<slug>` lazy-loaded; SPA fallback | met | `src/App.jsx:12-16`; `loaders.js` uses `import.meta.glob`; there is no top-level `404.html`, so Pages falls back to the SPA |
| §5.1 per-route title and meta, prerendered | met | `scripts/prerender-routes.mjs:37-98`; built heads checked above. Client-side updates come from `src/lib/meta.js:13-41` |
| §5.1 Toolbox link in the main nav and footer | met | `src/content.js:23` (nav) and `:416` (footer); `Nav.jsx:72-80,112-121` with `aria-current`; the footer keeps `/apps` as is (`Footer.jsx:8`) |
| §5.2 promise → tool → privacy note → talk-to-us card linking `?from=apps/<slug>` | met | `AppShell.jsx:40-56`; `TalkToUsCard.jsx:10-12` gives `/?from=apps/<slug>#contact`; the router keeps the query and scrolls to `#contact` (`router.js:64-80`) |
| §5.2 per-tier privacy wording | met | `quote-builder/copy.js` privacy is the PRD line; `receipt-reader/copy.js` names Anthropic and says Jura does not store it |
| §5.3 two tiers; browser tier makes no server calls except the counter | met | The quote builder's only network call is `trackUsage` (`AppShell.jsx:25`, `quote-builder/index.jsx:117`) |
| §5.4 identity is a salted hash of `CF-Connecting-IP` and a random first-party cookie | met as written; does not deliver §2.4 (finding 3) | `server/visitor.js:30-52` |
| §5.4 `app_tries` unique on (day, visitor_hash), incremented and read back in one statement | met (key adds `tool`) | `0001_toolbox.sql:13-19`; `limit.js:52-59`; burst test in `tests/limiter.test.js` (5 at once, 2 pass) |
| §5.4 2 a day across all tools, switchable to per tool | met | `limit.js:22-31` |
| §5.4 site cap of 200 AI calls a day | **not met** | Refunds give calls back, the repair call is not counted, and the SDK may retry once unseen (finding 1) |
| §5.4 order: Turnstile → size and type → counter → API → validate | met | `server/receipt-reader.js:93-161` |
| §5.4 a server-side API failure refunds the try | met, but over-applied | `receipt-reader.js:120-124,141`. Refusals are refunded too, and they come from what the visitor uploads (finding 1) |
| §5.4 input limits: 4 MB and images | met | `server/images.js:6,35-40`; `tests/limiter.test.js:190` |
| §5.4 input limits: text up to 8,000 characters | not met (n/a today) | No text-input AI tool exists yet (finding 8) |
| §5.4 fixed system prompt, no tools, `max_tokens` per tool | met | `receipt-reader.js:45-77` |
| §5.4 fail closed on billing and rate errors | met | `server/anthropic.js:39-55`; `receipt-reader.js:134-140`; `closeForToday` is `limit.js:102-110` |
| §5.4 logging: day, tool, outcome, tokens, latency, no content | met | `server/ai-tool.js:39-41`; `receipt-reader.js:110,122,164-172`; SDK `logLevel: "off"` |
| §5.4 `GET /api/apps/limit` | met | `server/limit-endpoint.js`; `tests/limiter.test.js:21` |
| §5.5 `app_usage` table | met | `0001_toolbox.sql:28-34`; `server/usage.js`; `tests/usage.test.js` |
| §5.5 Cloudflare Web Analytics | not met | It is a dashboard toggle that is not turned on, and setup step 10 calls it "Optional". Meanwhile the privacy notice says it is in use (finding 4) |
| §5.8 block 1 done-check: empty state, dummy entry renders, the email shows `from` | met | `tests/shell.test.js:90,116`; `tests/enquiry.test.js:37` |
| §5.8 block 3: setup guide written first | met | `jurasolutions/outputs/growth/setup/toolbox-ai.md` covers D1, Turnstile, the key with a spend limit, `VISITOR_SALT`, `UNSUBSCRIBE_SECRET` and `RESEND_WEBHOOK_SECRET` |
| §5.8 block 3 done-check: third try refused without an API call | met | `tests/limiter.test.js:43` |
| §5.8 block 3 done-check: a new visitor gets 2 | met | `tests/limiter.test.js:21` |
| §5.8 block 3 done-check: a test site-wide cap of 3 holds | **not met** | It holds for successes (`tests/limiter.test.js:120`), but probe P1 (10 refusals, cap 3) made 10 API calls |
| §5.8 block 3 done-check: a 5 MB upload refused before the counter | met | `tests/limiter.test.js:190` |
| §5.8 block 3 done-check: nothing uploaded is stored | met | `tests/receipt-reader.test.js:125`; the schema has no content columns |

### APP-001 Quote builder

| Item | Status | Evidence |
|---|---|---|
| Totals: no discount, line %, line amount, overall discount, GST on and off, each unit-tested | met | `quote-builder/calc.js:66-157`; `calc.test.js:70-259` |
| Zero-quantity lines ignored, with the hint | met | `calc.js:77,140-143`; `QuoteForm.jsx:324-328` |
| No floating-point artefacts | met | Integer cents and BigInt (`calc.js`); `calc.test.js` float cases |
| PDF opens in Chrome, Safari and Acrobat | n/v | A second-parser round trip in `quote.test.js:224`; real readers still need checking |
| PDF fits A4 and paginates cleanly at 40 lines | met | `quote.test.js:121,137` |
| Wide and square logos print at a sensible size | met | `quote.test.js:191`; a 170 × 56 pt box |
| A saved quote file reopens to an identical quote | met | `quoteFile.js`; `quote.test.js:69,83` |
| Remember: persists only when ticked; works with storage blocked | met | `quote-builder/index.jsx:73-87`; `_shared/storage.js`; `QuoteForm.jsx:287-288` |
| 360 px, 44 px targets | partly / n/v | `--tap-min` is used throughout; the Edit/Preview tabs are about 43 px (UI finding U4); real device not checked |
| Keyboard usable; every input labelled | partly | Labelled, yes. Hints and errors are not linked to their inputs (UI finding U3) |
| Copy passes `jura-growth check` | met | 304 of 304 |
| Talk-to-us card links with `?from=apps/quote-builder` | met | `TalkToUsCard.jsx:10-12` |
| Usage counter on open and on PDF download | met | `AppShell.jsx:22-26`; `quote-builder/index.jsx:117` (the only call sites) |
| §3 business fields, logo PNG/JPG/SVG ≤ 1 MB kept in the browser | met | `QuoteForm.jsx`; `logo.js:55` |
| §3 `Q-YYYYMMDD-01` editable; valid until +30 days | met | `model.js:16,56-61`; `quote.test.js:52,59` |
| §3 lines: multi-line description, add, remove, reorder, line discount | met | `QuoteForm.jsx:104-112,217-231` |
| §3 GST off by default; 9% default with the IRAS URL and date; reg. no. shown and printed only when on; GST on the subtotal after discounts | met | `model.js:8-14`; `QuoteForm.jsx:386-397`; `pdf.js:146`; `calc.js:80-137` |
| §3 "Made with jurasolutions.sg/apps" footer, switchable | met | `pdf.js:341-345`; `QuoteForm.jsx:410` |
| §3 "New quote" keeps the business details | met | `quote-builder/index.jsx:129-148` |
| §4 never labelled a tax invoice | met | The PDF title is "Quotation" |
| §4 half-up rounding at each line total and at GST; pure functions in `calc` | met | `calc.js` |
| §5.1 form left, preview right; stacked with a Preview toggle on mobile | met | `quote-builder.css:316-322`; `index.jsx:214-222` |
| §5.2 every copy line | met, verbatim | `quote-builder/copy.js:13-19,53,88-89,99,114-126` |
| §5.3 registry entry | met | `registry.json:2-11`. Set `added` to the deploy date when it ships |
| §5.3 one lazily loaded PDF library, no server calls | met | pdf-lib in its own chunk (`dist/assets/pdf-*.js`, about 180 KB gzipped) |

### APP-002 Receipt reader

| Item | Status | Evidence |
|---|---|---|
| Real supermarket, F&B and taxi receipts read correctly (Ting Yu's own) | n/v, by design | `src/apps/receipt-reader/__fixtures__/README.md`; waiting on open question 1 |
| A non-receipt image gives "not a receipt" | met in code | `is_receipt:false` is handled in `ReceiptResults.jsx:59-62`; no real image tested |
| Exactly 2 tries per SGT day; the third refused without an API call | partly | `tests/limiter.test.js:43`. A fresh cookie resets the count (finding 3) |
| A server-side API failure refunds the try | met, but over-applied | `receipt-reader.js:120-124` (finding 1) |
| Over 4 MB refused before the counter or the API | met | `images.js:35-37`; `tests/limiter.test.js:190` |
| Injection text on a receipt does not change the output format | met | The structured-output schema plus field validation (`server/receipts.js`); injection fixture in `tests/receipt-reader.test.js` (simulated, not a real image) |
| CSV and XLSX open in Excel and Google Sheets | met in code / n/v | `exports.js`: BOM, quoting, formula prefix; `receipts.test.js:76,102` |
| No receipt content in any log | met | `ai-tool.js:39-41`; `tests/receipt-reader.test.js` checks the logs |
| 360 px with the camera option; 44 px targets | partly / n/v | `FileDrop.jsx:82-121` has `capture`; no device check |
| Keyboard usable; every input labelled | partly | UI findings U3, U6 |
| Copy passes `jura-growth check` | met | 304 of 304 |
| Talk-to-us with `?from=apps/receipt-reader` | met | the shell |
| Usage counter on open and on a successful read | met | `receipt-reader/index.jsx:117` |
| §3 up to 3 files; JPG, PNG, WEBP, or a PDF's first page via pdf.js; the HEIC message | met | `files.js`; `prepare.js:74-106`; `images.js:17-19,39` |
| §3 resize to a 1600 px long edge at quality 0.8 | met | `prepare.js:9-11` |
| §3 one try is one request | met | `api.js:20-25` |
| §3 every extracted field | met | `server/receipts.js:12-75` |
| §3 editable table, add-up check, Category suggestions | met (cards, not a grid) | `ReceiptResults.jsx:65-69,142-146`; `model.js:51-62` |
| §3 CSV, XLSX and copy as TSV in the browser | met | `exports.js`; `receipt-reader/index.jsx:136-162` |
| §3 states: unreadable, not a receipt, limit, cap, unavailable | met | `receipt-reader/index.jsx:121-132,169-175` |
| §4 privacy-notice paragraph on toolbox AI tools | met | `src/content.js:153-158` (matches the code: no storage, the `jura_vid` cookie, Turnstile) |
| §5.1 step 1: "2 free tries left today" on open | met | `receipt-reader/index.jsx:32-38`; `TryLimitNotice.jsx:31-37` |
| §5.1 step 3: Turnstile runs invisibly | met | `turnstile.js:46-57` (`execution: "execute"`, `appearance: "interaction-only"`) |
| §5.1 step 7: after the second try, the upload area gives way to the message **and the talk-to-us card** | partly | The message replaces the upload area (`index.jsx:169-177`), but no card appears there (finding 5) |
| §5.2 copy | met, verbatim | `receipt-reader/copy.js:8-27,37,62-63,84-86` |
| §5.3 function order and refund | met (refund over-applied) | `receipt-reader.js:79-174` |
| §5.3 model, base64 images, no tools | met | `receipt-reader.js:45-66` |
| §5.3 `max_tokens` 2000, temperature 0 | deviation, reason holds | see below |
| §5.3 fixed system prompt, verbatim | met | `server/receipts.js` `RECEIPT_SYSTEM_PROMPT`; `tests/receipt-reader.test.js:14` |
| §5.3 output schema validated server-side, one free repair | met | `server/receipts.js`; `receipt-reader.js:146-161` |
| §5.3 logging: day, outcome, receipt count, tokens, latency | met | `receipt-reader.js:164-172` |
| §5.3 registry entry | met, apart from status | `registry.json:12-21`, `draft` on purpose |

### Scout PRD, website pieces (§5.5, §5.9)

| Item | Status | Evidence |
|---|---|---|
| `/unsubscribe?t=<token>`: a Pages Function, one click, no login, plain confirmation | met | `functions/unsubscribe.js`; `server/unsubscribe.js:50-66`; `src/pages/Unsubscribed.jsx` |
| HMAC token with no address in the URL | met | `server/unsubscribe.js:22-39` (SHA-256 hash plus an HMAC, constant-time verify); fixed vector in `tests/unsubscribe.test.js` |
| Resend webhook for bounced and complained, signature-verified, writes D1 suppression | met | `server/resend-webhook.js:41-106`; `tests/resend-webhook.test.js` |
| D1 `suppression(email_hash, email, reason, created_at)` | met (adds `source` and `resend_email_id`, which is fine) | `0001_toolbox.sql:40-47` |
| Privacy notice: what the scout collects, why, how to opt out | met, with accuracy issues | `content.js:166-174` (finding 6) |
| Privacy notice linked from the footer | met | `content.js:417` |
| Privacy notice linked from every email | not this repo | the growth CLI |
| Block 2 (site side): a test unsubscribe is suppressed; a simulated bounce suppresses | met | `tests/unsubscribe.test.js:51`; `tests/resend-webhook.test.js:92` |

### Deviations documented in the README, judged

| Deviation | Judgement |
|---|---|
| `max_tokens` 4096, not 2000 | **Reason holds.** Haiku 5.5 thinks by default, and thinking counts toward `max_tokens`; `effort: "low"` keeps it small. Cost is still bounded by the cap once finding 1 is fixed |
| No `temperature` | **Reason holds.** API version 2026-10-21 rejects sampling parameters. Structured outputs (`output_config.format`) pin the shape, which is what "temperature 0" was for |
| Receipt reader held at `draft` | **Reason holds.** APP-002 criterion 1 and open question 1 need Ting Yu's own receipts. But the draft gate covers only the UI; the API is live (finding 2) |
| Limiter in `server/`, not `functions/api/apps/_limit` | **Reason holds.** Pages routes any `functions/` file with a handler; an underscore does not protect it |
| Registry as JSON | **Reason holds.** The Functions and the growth CLI read it too |
| Helvetica/WinAnsi in the PDF | **Reason holds.** It is the visitor's neutral document with no font download. The form warns about characters that will not print |
| Per-tool scope by config | Not a deviation; §5.4 asks for it |

---

## (b) Findings

Numbered once across the three axes and ranked within each. Every finding was checked by reading the line, and the ones marked "reproduced" were also run.

### Spec

**1. Blocking: the site-wide AI cap does not hold.** Reproduced (probe P1).
- **Spec:** app factory §5.4, "Site-wide cap: 200 AI calls per day", and block 3, "a test site-wide cap of 3 holds".
- **What happens:**
  - `refundTry` (`server/limit.js:92-95`) decrements `app_calls` after a call was already made.
  - `fail()` (`server/receipt-reader.js:120-124`) runs on refusals (`:144`) and invalid output (`:161`), both of which can come from what the visitor uploads.
  - The repair call (`:153`) is never counted.
  - `maxRetries: 1` (`server/anthropic.js:27`) can add a second, unseen call.
- **Result:** with a cap of 3, ten refusals made ten API calls and left both counters at 0. Cost is then bounded only by the Anthropic Console spend limit.
- **Fix:**
  - Never decrement `app_calls`. Count every call actually sent, including the repair; take the repair's call with the same conditional upsert, and skip the repair if the cap is reached.
  - Set `maxRetries: 0`.
  - Refund only the visitor's try, and only for API or network failures and invalid output, not for `stop_reason: "refusal"`.
  - Add a test: cap 3, five refusals, at most 3 API calls.

**2. Should fix: the draft receipt reader's API is live in production.** Reproduced (P2).
- **Spec:** the draft status (README: "a `draft` tool's page opens on the local dev server only") and app factory §2.5 ("live" is a decision).
- **What happens:** `handleReceiptRead` (`server/receipt-reader.js:79-81`) and `handleLimit` (`server/limit-endpoint.js:18`) never check `status`. Once Ting Yu sets the AI variables on Production, anyone with a Turnstile token for the site key can use a tool that is not yet signed off.
- **Fix:** refuse with 404 when the registry entry is not `live`, unless a non-production flag is set. Reuse `VITE_SHOW_DRAFTS`'s intent with a server-side `AI_ALLOW_DRAFTS=1` that is set only in `.dev.vars`. Apply the same check in `isAiTool`.

**3. Should fix: a fresh cookie resets the visitor's tries.** Reproduced (P4).
- **Spec:** app factory §2.4 and APP-002 §2, "exactly 2 tries per visitor per SGT day".
- **What happens:** the identity in `server/visitor.js:44-52` follows §5.4 to the letter (IP + cookie), so clearing cookies or opening a private window gives 2 more. Three cookies from one IP gave 6 reads.
- **Fix:** also take from a salted IP-only counter with a configurable ceiling (`AI_TRIES_PER_IP`) in the same `takeTry`. This is Ting Yu's call, because offices share IPs (see questions).

**4. Should fix: the privacy notice says Web Analytics is in use, but it is not on.**
- **Spec:** app factory §5.5 ("plus Cloudflare Web Analytics (cookieless)").
- **What happens:** `src/content.js:163` states it, but `toolbox-ai.md` step 10 marks it "Optional" and nothing in the repo turns it on. The notice's own header (`content.js:121-125`) says "Every statement here must stay true of the code".
- **Fix:** make step 10 a required step in the setup guide (the PRD wants it), or drop the sentence until it is switched on.

**5. Should fix: the out-of-tries state has no talk-to-us card beside it.**
- **Spec:** APP-002 §5.1 step 7, "the upload area gives way to the come-back-tomorrow message and the talk-to-us card".
- **What happens:** `receipt-reader/index.jsx:169-177` shows only the `TryLimitNotice` alert. The card is still at the bottom of the page, below any results.
- **Fix:** when `outOfTries`, render `<TalkToUsCard slug={app.slug} {...copy.talk} />` under the notice.

**6. Should fix: two privacy-notice lines about outreach promise more than the system does.**
- **Spec:** scout §5.5 makes reply detection optional (open question 3). Without it, reply-unsubscribes are handled by hand.
- **What happens:**
  - `content.js:172` says a reply "unsubscribe" puts the address on the list "straight away". `content.js:186,190` (the unsubscribe page) say "by hand".
  - Nit: `content.js:170` "we do not … write to personal addresses" sits uneasily with §5.2, which allows a named person's address when the business publishes it for enquiries.
- **Fix:** "Reply 'unsubscribe' and we'll add the address by hand, well within 10 business days." Say "private addresses" or "home addresses" instead of "personal".

**7. Nit: the PDF Creator field is always Jura's.**
- **Spec:** app factory §4 ("the visitor's branding … not Jura's") and APP-001 §3 (the line is switchable).
- **What happens:** `src/apps/quote-builder/pdf.js:79` sets "Made with jurasolutions.sg/apps" even when the visitor turns the line off.
- **Fix:** set it only when `quote.madeWith` is on, and assert that in `quote.test.js`.

**8. Nit: the 8,000-character text limit is not built.**
- **Spec:** §5.4 input limits.
- **What happens:** no text-input AI tool exists yet, so this is not a defect today.
- **Fix:** add a shared `checkText(value, 8000)` in `server/` alongside `checkUploads` when the first text tool is built, and note it in the README.

**9. Nit: a new tool icon touches a third file.**
- **Spec:** §2.3 ("one folder and one registry entry; nothing else changes").
- **What happens:** tool icons (`scan-text`, `file-spreadsheet`, …) are registered in `src/lib/icons.js`.
- **Fix:** document it in the README as an accepted exception, or let each tool folder export the icons it registers.

**10. Nit: the receipt reader throws when D1 is bound without migrations.** Reproduced (P3).
- **What happens:** `takeTry` (`server/receipt-reader.js:107-108`) and `refundTry` inside `fail` are not in `try/catch`, so a missing table is an unhandled 500. It is not unsafe: `/api/apps/limit` reports `ready:false` in the same state, so the button stays disabled. Usage and unsubscribe already fail gracefully.
- **Fix:** wrap steps 3 to 6 so any unexpected throw refunds the try (where one was taken) and returns `{ error: "unavailable" }` with 503.

**11. Nit: the usage counter accepts draft slugs and any caller.**
- **What happens:** `server/usage.js:42` uses `isKnownSlug` with no status check and no throttle, so the counts the scout uses to pick a tool can be inflated with curl.
- **Fix:** count only `live` slugs. If the counts start to matter, cap opens per salted IP per day.

**On the brief's specific questions:**
- **No D1 binding:** usage returns 503 and the client swallows it (`_shared/usage.js:10-25`). `limit` returns `ready:false` and the page shows `errors.notReady` (`receipt-reader/index.jsx:169-172`).
- **Missing variables:** `/api/apps/*` returns 503 `unavailable` or `ready:false`. `/unsubscribe` returns 303 to `?status=error` with no write (`server/unsubscribe.js:52-55`). The webhook returns 503 so Resend retries. No secret value is echoed anywhere.
- **Nav and footer Toolbox link:** met, see the checklist.
- **`from` end to end:** met. Card href → router keeps the query → `readFrom` at send time → `cleanFrom` → `Came from:` in both text and HTML, escaped. One nit: the server accepts any `apps/<slug>` that matches the pattern, not only registry slugs. Harmless, but `isKnownSlug` would tighten it.
- **Prerendered meta:** met.
- **Privacy paragraphs:** present, with findings 4 and 6.
- **Limiter order and refund paths:** the order is right; the refunds are finding 1.

### Standards

**12. Should fix: `src/styles/toolbox.css:16-17` styles Nav classes.**
- **Rule:** README, "toolbox.css … every class prefixed tb-". It also contradicts the file's own "nothing here reaches the home page".
- **What happens:** the rules target `.navlink[aria-current]` and `.nav-sheet-link[aria-current]`.
- **Fix:** move them to `site.css`. Add an underline as well as the colour: the UI pass found the current page is shown by colour alone.

**13. Should fix, reuse: new code repeats helpers that already exist.**
- `functions/submit.js:29-30` (`CAME_FROM`, `cleanFrom`) restates `src/lib/validate.js:68-72` (`FROM_PATTERN`, `readFrom`). `server/` already imports from `src/`, so import it.
- `submit.js:32` `json` duplicates `server/http.js:10`.
- `server/registry.js:12` `findEntry` duplicates `src/apps/registry.js:61` `findApp`.
- `server/unsubscribe.js:70,72,76,79` build `new Response(null, …)` by hand where `server/http.js:21` `empty()` exists.

**14. Should fix: duplicated document model (Duplicated Code smell, a judgement call).**
- `QuotePreview.jsx:14-32,134-157` and `pdf.js:61-65,143-149,197-201,294-299` each build the rows, discount labels, business lines and totals.
- **Fix:** extract one pure `quoteDocument(quote, totals, copy)` and render both from it, so the preview and the PDF cannot drift.

**15. Should fix: dead prop (Speculative Generality).**
- `QuoteForm.jsx:185,417-421` render an "unsupported characters" alert that never shows: the only caller passes `unsupported={[]}` (`quote-builder/index.jsx:237`).
- **Fix:** delete the prop and its branch.

**16. Should fix: the tap-target workaround is copied around (Duplicated Code and Shotgun Surgery).**
- `TAP_INPUT` and a local `TextField` appear in both `QuoteForm.jsx:8-33` and `ReceiptResults.jsx:7-24`.
- The 44 px workaround is patched in five places, including `toolbox.css:300-308` with `!important`.
- **Fix:** move the shared field to `_shared/`. Raise the 44 px minimum in the design system at source, then `npm run sync:ds`.

**17. Nits:**
- Raw `2px` gaps and a magic `72px` nav height (`quote-builder.css:16,152,187,195`). The rule is README "no raw … spacing values".
- `.qb-toast` and `.rr-toast` are the same rule (`quote-builder.css:305-312`, `receipt-reader.css:123-130`).
- The tool meta is built twice (`AppPage.jsx:62-72`, `prerender-routes.mjs:68-77,89`).
- `EXPORTS.copied` is never read (`content.js:117`).
- "up to 3" is hard-coded in `receipt-reader/copy.js:25,38` against `MAX_FILES_CLIENT`.
- `positiveInt` accepts 0 (`server/limit.js:17`).
- `logo.js:70` `base64ToBytes(dataUrl)` shadows `server/crypto.js` with a different signature.
- `fetchLimit` and `turnstile.js` are generic AI plumbing kept in the tool folder; they belong in `_shared/`.

### Security

The security-review pass found **no vulnerability at confidence 7 or higher**. It checked:
- **Server:** every D1 query is bound (the interpolated `STRONGER` fragment is a constant), the unsubscribe HMAC is verified in constant time with a strict token shape, and the redirects go only to fixed paths. Svix is checked over the raw body with a 5-minute window.
- **Inputs and cookies:** Turnstile fails closed, the Set-Cookie value comes from `crypto.randomUUID`, and uploads are sniffed by magic bytes. Model output is checked field by field and rendered as React text.
- **Email and health checks:** the enquiry HTML is escaped, including `from`. The health checks expose only booleans.
- **Client:** there is no `dangerouslySetInnerHTML`. SVG logos load only as `<img>` or a canvas. The quote file is parsed field by field. CSV and TSV prefix formula characters and XLSX cells are strings. pdf.js runs with `isEvalSupported: false` at a fixed version.

The money-touching issues are cost controls, not exploits, and are listed above as findings 1, 2 and 3. Below the threshold, as hardening:
- Turnstile `hostname` and `action` are not checked (`server/turnstile.js:22-23`).
- Unsubscribe links never expire, by design under RFC 8058.

No blocked path was touched, no secret is committed, and there is no `wrangler.toml`.

### UI (Web Interface Guidelines, against the design system)

There are no blocking UI findings. I re-checked U1 and U5 at the source lines.

- **U1. Should fix.** `src/lib/router.js:71` sets `focusPending` on navigation to `/`, but Home never calls `usePageHeading` (it is called only from `Privacy`, `Unsubscribed`, `AppsIndex`, `NotFound` and `AppShell`). Focus stays on the clicked link, and the stale flag moves focus on a later page. Fix: call `usePageHeading` on the hero `h1`, or clear the flag when the target is home.
- **U2. Should fix.** `router.js:78`: `scrollTo(0,0)` animates because of `html{scroll-behavior:smooth}` (`site.css:438`). Use `{ top: 0, behavior: "instant" }`. Also, `popstate` (`router.js:22-25`) does not manage scroll or focus for lazily loaded routes.
- **U3. Should fix.** `QuoteForm.jsx:20,27,248,288`: hints and errors are not linked with `aria-describedby`, so a screen reader hears "invalid" without the reason.
- **U4. Should fix.** `quote-builder/index.jsx:214-222`: the Edit/Preview control uses `role=tab` with no `tabpanel`, no `aria-controls` and no arrow keys. Use two `aria-pressed` buttons, and add a `min-height` at `quote-builder.css:21` (the tabs are about 43 px).
- **U5. Should fix.** `quote-builder.css:276-279`: `display:block` on `table`, `tr` and `td`, plus `thead{display:none}`, drops the table semantics on mobile. Add explicit roles or keep the table display.
- **U6. Should fix.** Several alerts mount with their text already present, so screen readers may not announce them: `quote-builder/index.jsx:163,168`, `QuoteForm.jsx:279`, `receipt-reader/index.jsx:190`, and `TryLimitNotice.jsx:15-37`, which swaps its live `<p>` for an Alert. File status changes (`receipt-reader/index.jsx:209-217`) are not in a live region either. Fix: keep one always-present live wrapper per area.
- **U7. Should fix.** Disabled controls do not say why: "Read receipts" (`receipt-reader/index.jsx:238`) and "Add item" at 200 items (`QuoteForm.jsx:334`).
- **U8. Should fix.** Destructive actions have no confirm or undo: opening a quote file replaces the current quote (`quote-builder/index.jsx:139`); removing an item or a receipt is immediate (`QuoteForm.jsx:227-231`, `ReceiptResults.jsx:138`), and focus falls to `<body>`. Neither tool has a `beforeunload` guard while it holds work, and a receipt result cost a daily try.
- **U9. Should fix.** `Nav.jsx:85`: the nav CTA is `Button size="sm"`, about 34 px tall, under the 44 px target. The line is changed in this diff, though the issue predates it.
- **U10. Nits:**
  - Customer fields lack `autoComplete="off"`, and IDs need `spellCheck={false}` (`QuoteForm.jsx:248,251,293-296,395`; `ReceiptResults.jsx:72,74`).
  - `AppsIndex.jsx:90` puts `aria-live` on the whole grid.
  - Loading strings lack `…` (`quote-builder/copy.js:122`, `receipt-reader/copy.js:28`, `content.js:93`).
  - Straight apostrophes in the copy.
  - `autoFocus` sits on the destructive "Start a new quote" (`quote-builder/index.jsx:260`).
  - Toasts ignore `safe-area-inset-bottom`.
  - The logo `<img>` has no dimensions (`QuoteForm.jsx:259`).
- **Notes (the design system wins; not findings):** sentence case and the "we" voice override the guideline's title case. The `Dialog` focus trap, the `Tabs` keyboard behaviour and the `Card` hover under reduced motion all live in the read-only design system. Fix them at source.

## Questions for Ting Yu

1. **Should a per-IP ceiling sit on top of the IP + cookie identity (finding 3)?** Recommended: yes. Add `AI_TRIES_PER_IP=6` a day, so a shared office gets 3 people's worth while one person clearing cookies stops at 6.
2. **Is Cloudflare Web Analytics on, or should the privacy line go (finding 4)?** Recommended: turn it on (§5.5 asks for it) and make setup step 10 required.
