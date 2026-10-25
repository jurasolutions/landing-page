# Code review final: everything that ships to production in one push

Branch `crew/toolbox-prd-audit` at `cffc021`, reviewed against `619e252` (`main` = `origin/main` = production, and the merge-base). That is 45 commits and 154 files. It covers the toolbox shell, APP-001, the AI limiter, APP-002 (held at `draft`), the scout's website pieces, APP-003, and tickets 03, 04 and 05. Spec: `.scratch/toolbox-prd-audit/spec.md` and `issues/01`–`05`. Reviewed 2026-10-25.

## Verdict: approve

Nothing blocks.

- Every blocking finding from earlier rounds is resolved: review 02's finding 1 (the site cap) and review 04's S1 (the Remember hint).
- Ticket 05 had not been reviewed before. It meets all of its acceptance criteria on both axes.
- The security pass found nothing at confidence 7 or above.
- No blocked path was touched.
- Production safety holds for the state Ting Yu will actually be in right after the push: no AI variables, no D1 binding and no migrations (see "Production safety" below).

Two new *should fix* findings are small (N1, N2). Neither needs to hold the push. Earlier items that are still open are listed with their status.

## Evidence I ran

| Command | Result |
|---|---|
| `npm test` | 23 files, 319 tests passed (1.15 s) |
| `uv run jura-growth check-copy ../landing-page/src/content.js ../landing-page/src/apps/*/copy.js ../landing-page/src/apps/registry.json` (from `repos/growth` at `bc86a15`, which includes the tightened numbers rule from `c28a81c`) | **352 of 352 strings pass** |
| `jura-growth check` on the shipped reply-unsubscribe sentence (`src/content.js:172`) | pass. The active form "…and we'll add the address by hand, well within ten business days." **fails** `[numbers]`, so the passive wording is required by the checker, not chosen for style |
| `git diff --name-only 619e252...HEAD -- src/design-system dist .dev.vars .env wrangler.toml .github` | empty. No blocked path was touched. There is no `wrangler.toml` |
| `wrangler@4.86.0 pages functions build`, on a `git archive HEAD` copy in the scratchpad, **without `nodejs_compat`** | "Compiled Worker successfully". One Worker of 1.19 MB holds every Function, the Anthropic SDK included |
| `wrangler pages dev` on that scratch copy, with a copy of the current `dist/`, **no D1 binding and no env vars**, on port 8799 (the repo's `dist/` and `.wrangler/` were not touched) | Every Function and route answered as tabled below. The Worker loads, so the SDK does not throw at import time, which would have taken `/submit` down with it |
| `npm run build` | **not run**, per the brief (QA is using `dist/`). The route checks used the `dist/` QA built at 17:16 from `cffc021`, which has `apps.html`, `apps/quote-builder.html`, `apps/pdf-merge-and-split.html`, `privacy.html` and `unsubscribed.html` |
| Standards and Spec sub-agents (ticket 05 focus, whole diff for regressions), each running the six touched test files | 97 of 97 pass. No blocking findings |
| Security sub-agent (`security-review`, whole diff, ticket 05 focus) | No finding at confidence 7 or above |

---

## Production safety: jurasolutions.sg right after this push

The assumed state: Pages builds `main` with Node 20 (already the documented setting; production's README says the same). `RESEND_API_KEY` is already set, because the form works today. **Not set:** `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`, `VITE_TURNSTILE_SITE_KEY`, `VISITOR_SALT`, `UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET`, `AI_*`, the D1 binding `DB`, and the remote migrations.

### Functions (probed in workerd with no bindings and no variables)

| Request | Answer | Judgement |
|---|---|---|
| `GET /submit` | 200 `{"endpoint":"enquiry","ok":true,"canSend":false}` locally; `canSend:true` in production, where the key is set | Unchanged apart from `Cache-Control: no-store` (review 04 proved the Resend payload byte-identical) |
| `POST /submit` (valid, with `from: apps/quote-builder`) | 500 "not configured" locally, because there is no key; in production it sends as today, plus a "Came from" line when `from` is a toolbox slug | **Enquiry form unchanged** for visitors from the home page: `Contact.jsx` sends `from` only when `?from=` is present |
| `POST /submit` with a body that is not JSON / `PUT /submit` | 400 / 405 | Unchanged |
| `GET /api/apps/limit` | 200 `ready:false`, **no cookie issued** | Safe |
| `GET /api/apps/limit?tool=receipt-reader` | 404 `not_found` | Draft gate holds |
| `GET /api/apps/limit?tool=quote-builder` or `?tool=nope` | 400 `unknown_tool` | Fine |
| `POST /api/apps/receipt-reader` | 404 `not_found`, before Turnstile, D1 or Anthropic | **No paid call is possible in production, whatever env vars are later set, until the registry says `live`** |
| `POST /api/apps/usage` (live slug) | 503 `not_configured`; the browser swallows it (`_shared/usage.js`) | Harmless: one failed beacon per tool open and download, with nothing shown to the visitor |
| `POST /api/apps/usage` (draft slug) | 400 | Fine |
| `GET /api/resend-webhook` | 200 `canVerify:false, canStore:false` | Fine |
| `POST /api/resend-webhook` | 503, so Resend (not yet configured to call it) would retry | Fine |
| `GET /unsubscribe?t=…` | 303 to `/unsubscribed?status=error`, logged `not_configured`, nothing written | Fine. No outreach email links here yet |
| `POST /unsubscribe?t=…` | 503 | Fine |
| `GET /api/apps/receipt-reader`, `GET /api/nothing` | 200 HTML (the SPA fallback) | Same behaviour as an undeployed `/submit` today. The README already documents "HTML back means not a Function" |

**Once the D1 binding is set but the migrations have not been run** (from reviews 02 and 03 and the code): `limit` gives 503 `ready:false`, `usage` gives 503 `store_failed`, unsubscribe redirects to `?status=error`, and the webhook gives 503 `store_failed` so Svix retries. The receipt reader stays at 404 (draft). Nothing throws unhandled.

### Static routes and prerendered heads (probed)

| Path | Status | `<title>` / canonical |
|---|---|---|
| `/` | 200 | Home title, canonical `/`. **Unchanged head** (`index.html` is not in the diff) |
| `/?from=apps/quote-builder` | 200 | Home head. The form reads `from` at send time |
| `/apps` | 200 | "Free business tools \| Jura Solutions", canonical `/apps` (see N1 on its description) |
| `/apps/quote-builder` | 200 | Its own title and canonical |
| `/apps/pdf-merge-and-split` | 200 | Its own title and canonical |
| `/privacy` | 200 | Its own title and canonical |
| `/unsubscribed`, `/unsubscribed?status=error` | 200 | Its own title, `noindex` |
| `/apps/` and `/apps/quote-builder/` | 308 to the path without the slash | Pages' pretty URLs, fine |
| `/apps.html`, `/index.html` | 308 to `/apps`, `/` | Fine |
| `/apps/receipt-reader` (draft) | 200, home head; the client renders NotFound and sets "Page not found", `noindex` | Draft is not reachable in production (`AppPage.jsx:57`, `VITE_SHOW_DRAFTS` unset) |
| `/apps/nope`, `/nonexistent` | 200, home head; the client renders NotFound with `noindex` (`content.js:63-67`, `meta.js:24-34`) | **Not a regression.** Production today serves `index.html` (the home page) for every unknown path, also 200. The site is better than before: a "Page not found" page with `noindex` instead of the home page. A real 404 status would need a top-level `404.html`, which would break the SPA fallback. Leave it |

### Home page

- **Code.** The home page ships the same sections as before. Every toolbox page is `React.lazy` (`App.jsx:12-16`).
- **Visible changes.**
  - A "Toolbox" nav link (`content.js:23`).
  - The nav CTA grows from 34 px to 44 px (`Nav.jsx:88`).
  - Two copy lines changed, `4d276d1` ("end to end" is a §3 buzzword).
  - A footer Toolbox/Privacy link.
  - The hero `h1` takes focus only after a client-side navigation to `/`, never on first load.
- **Cookies.** No new requests and no cookies on `/`.

**Conclusion:** pushing now is safe. The AI path stays closed by two independent locks: the `draft` status and `aiReady`. Every Function fails closed with JSON, and the enquiry form is unchanged.

---

## Earlier findings: where each one stands

**Resolved** items were checked at the line, and by probe where the table says so. **Deferred** means the conductor recorded that decision in `crew-log.md` (2026-10-25T02:00) or in ticket 04's out-of-scope list. **Still open** means no ticket took it and nothing deferred it.

### Review 02 (audit)

| # | Rank | Status | Where |
|---|---|---|---|
| 1 site cap leaks | blocking | **resolved** (ticket 03; review 03 probes A/A2; tests "the site-wide cap") | `server/limit.js:154-165`; `anthropic.js` `maxRetries: 0` |
| 2 draft API live | should fix | **resolved** (probed above: 404) | `server/drafts.js`, `limit-endpoint.js:21`, `receipt-reader.js` |
| 3 fresh cookie resets tries | should fix | **resolved** (per-IP ceiling; IPv6 /64 in ticket 05) | `limit.js:112-147`, `visitor.js:45-71` |
| 4 Web Analytics line | should fix | **resolved** (line removed; README "Not done yet") | `content.js` privacy section |
| 5 talk-to-us under out-of-tries | should fix | **resolved** (and shown once, ticket 05) | `receipt-reader/index.jsx:29-43,121` |
| 6 privacy wording | should fix | **resolved** ("well within ten business days", passive, passes the checker) | `content.js:172` |
| 7 PDF Creator metadata | nit | **resolved** | `quote-builder/pdf.js:79-81` |
| 8 8,000-char text limit | nit | deferred (no text tool yet) | — |
| 9 icon touches a third file | nit | deferred | `src/lib/icons.js` |
| 10 throw with no tables | nit | **resolved** (503, try refunded) | `receipt-reader.js` guard |
| 11 usage accepts drafts | nit | **resolved** (probed: 400) | `server/usage.js:45` |
| 12 nav rules in toolbox.css | should fix | **resolved** (ticket 04) | `site.css:204-213` |
| 13 reuse (from, json, registry, empty) | should fix | **resolved** (ticket 04) | `functions/submit.js:18-19` |
| 14 duplicated quote document model | should fix | deferred (crew-log 02:00) | `QuotePreview.jsx`, `quote-builder/pdf.js` |
| 15 dead `unsupported` prop | should fix | **resolved** | — |
| 16 44 px workaround copied around | should fix | deferred (design system at source) | — |
| 17 nits | nit | deferred | — |
| U1–U4, U6, U7, U9 | should fix | **resolved** (ticket 04, review 04) | — |
| U5, U8, U10 | should fix / nit | deferred | — |
| Security hardening: Turnstile `hostname`/`action` not checked | below threshold | **still open** (hardening only; matters only once an AI tool is live) | `server/turnstile.js` |

### Review 01 (APP-003)

| # | Rank | Status | Where |
|---|---|---|---|
| 1 merge quietly leaves out problem files | should fix | **resolved** (ticket 05) | `MergePanel.jsx:21-28,314`; `copy.js:32` |
| 2 `copy.buttons.choose` unused | nit | **resolved** | `FileDrop.jsx` `chooseLabel`, `MergePanel.jsx:182` |
| 3 extra strings beyond §5.2 | nit | **still open**, by design: record the list in the APP-003 PRD when it moves to `done/` | `pdf-merge-and-split/copy.js` |
| 4 failed pdf.js load not destroyed | nit | **resolved** | `_shared/pdfjs.js`; `pdfjs.test.js` |
| 5 pdf.js loader and `toJpeg` copied | should fix | **resolved** | `_shared/pdfjs.js` |
| 6 one download flow written twice | should fix (judgement) | **still open.** Ticket 05 did not list it and nothing deferred it. Behaviour is right today; the duplication is the risk | `MergePanel.jsx:118-135`, `SplitPanel.jsx:68-91` |
| 7 raw px, `TAP` repeated, `pdf.js` name, Tabs patch | nits | deferred with finding 16 (design system at source) | — |
| U1 thumbnails not keyboard-scrollable in Safari | should fix | **resolved** | `Thumbnails.jsx:74`, CSS `:102-108` |
| U2 nits | nit | still open (observer root, IME Enter, multi-drop on Split, no undo) | — |

### Review 03 (limiter)

| # | Rank | Status |
|---|---|---|
| 1 timeframe dropped | should fix | **resolved** |
| 2 partial throw leaks a try | should fix | **resolved** (`limit.js:117-133`; `failingOn` tests) |
| 3, 4, 9 refund twice; `triesLeft + 1`; refund in two places | should fix / nit | **resolved** (`refundOnce`, `receipt-reader.js:148-151`) |
| 5 `/limit` without `tool` not draft-gated | nit | accepted, still open (spends nothing) |
| 6, 7 `isKnownSlug`; hand-built log; stale comment | should fix / nit | **resolved** |
| 8 `triesLeft` minimum twice; IP row built three times | nit | **still open** (`limit.js:66,146`; `:63,115,198`) |
| 10 `AI_ALLOW_DRAFTS` also gates usage | nit | accepted (README explains it) |
| 11 refunds unbounded | should fix | **resolved** (one per visitor per day; API 400 keeps the try). See N2 |
| 12 IPv6 per address | should fix | **resolved** for the IP ceiling. See nit N5 for the visitor hash |
| U1 card shown twice | nit | **resolved** (`useOwnTalkCard`) |
| U2 out-of-tries rule lives in one tool | nit | deferred to the second AI tool |

### Review 04 (UI and standards)

| # | Rank | Status |
|---|---|---|
| S1 Remember hint unlinked | blocking | **resolved** (`0cdc027`) |
| S2 conflict with ticket 03 | should fix | **resolved** (merged; `read-state.js`) |
| S3 forward after back lands at top | should fix | **resolved** (`7eccc33`, scroll memory by entry key) |
| S4 receipt reader's not-ready alert and file status not live regions | note | **still open**, low priority: the receipt reader is a draft and not served in production |
| T1, T2 ad-hoc view switch and field notes | should fix | deferred to the design system at source (with finding 16) |
| T3 a test greps `functions/submit.js` source | should fix | **still open**: `tests/enquiry.test.js:119-123` |
| T4 `findEntry = findApp` Middle Man | nit | **still open**: `server/registry.js:9` |
| T5 `readBlocker` restates out-of-tries | nit | **resolved** (`read-state.js`) |
| T6 Repeated Switches in the router | nit | **resolved** (`router.js:192` `apply`) |
| T7 README tests table | nit | **resolved** |
| T8 raw `2px`/`3px`, hairline | nit | still open |

---

## New findings

Ranked within each axis. Each one was checked at the line.

### Spec

**N1. Should fix: the `/apps` description promises receipts, which production does not offer.**
- **Rule:** design system §3 and `jurasolutions/CLAUDE.md`: "we claim only what we can defend". The prerendered head is what search results and link previews show.
- **Where:** `src/content.js:49`, "Free tools for quotes, receipts and other everyday paperwork." The receipt reader is `draft` (`registry.json:18`), so `/apps` lists only the quote builder and PDF merge and split. Someone who follows a shared `/apps` link looking for a receipt tool finds none.
- **Fix:** name what is live, for example "Free tools for quotes, PDFs and other everyday paperwork." Then run `check-copy`, and put "receipts" back when APP-002 goes live. The privacy paragraph on AI tools (`content.js:153-157`) is conditional ("Tools marked Uses AI…"), so it can stay.

**N2. Should fix: refunds are bounded per IP as well, which goes beyond the recorded decision.**
- **Spec:** ticket 05's decision says "a visitor gets at most one refunded failure per SGT day".
- **Where:** the code also caps refunds per IP at `ceil(triesPerIp / triesPerDay)`, which is 3 by default (`server/limit.js:175,193`). The cap is defensible: without it, fresh cookies would bring fresh refunds. It is tested, and the README describes it.
- **Fix:** record it as a decision, one line in ticket 05 or `crew-log.md`, so the rule Ting Yu reads matches the rule the code applies. No code change. (Spec sub-agent finding 1.)

**N3. Nit: the left-out warning is tested on its own, not in place.** `page.test.js:40` renders `LeftOutNote` directly. Nothing checks that `MergePanel` shows it above "Merge and download". The same gap applies to the `useOwnTalkCard` wiring from the receipt reader through `AppShell`, which is tested only as `ToolPage closingCard={false}` and `showsTalkCard`.

**N4. Nit: per-tool scope means one refund per tool per day.** Under `AI_LIMIT_SCOPE=per-tool`, the refund key is `#refund:<slug>` (`limit.js:172`). That is consistent with how tries are scoped, and the decision's wording simply doesn't cover it. Note it when N2 is recorded.

### Standards

**N5. Nit: IPv6 identity is inconsistent.** `hashIp` cuts IPv6 to the /64 (`server/visitor.js:70`), but `identifyVisitor` still hashes the full address (`:82`, `:86`). A cookie-less IPv6 visitor who rotates addresses inside the /64 gets a fresh visitor bucket. The per-IP ceiling still bounds them, so this costs nothing, but the file header's "cookie-less requests from one IP share one bucket" is not quite true. Fix: use `networkOf(clientIp(request))` in both.

**N6. Nit: the README overclaims.** `README.md:268` says a part-way D1 error "costs no one a try". `giveBackAll` swallows a failed give-back by design (`limit.js:95-103`), so a try can be lost. Say "almost never costs a try", or "fails closed".

**N7. Nit (Duplicated Code):** `ipKey` and `refundKey` (`limit.js:52`, `:172`) are the same `"*" ? "#x" : "#x:"+key` switch. One `reservedKey(prefix, key)` would cover both. Also, the inner `Math.max(1, triesPerDay)` in `refundsPerIp` (`:175`) cannot be reached, because `takeTry` returns early at `triesPerDay <= 0`.

**N8. Nit: the log level changed.** The catch-all now logs unexpected failures through `logCall`, which uses `console.log` (`ai-tool.js:47`), where it used `console.error` before. Review 03 asked for this, for one log shape. But a Workers log filter on error level would no longer see these failures. Note it in README "Logs", or let `logCall` use `console.error` when `ok` is false.

**N9. Nit: the classification of 400s.** `classifyApiError` treats every `400 invalid_request_error` as the visitor's input (`server/anthropic.js:58`). A malformed request caused by a bug on Jura's side would then use up visitors' tries without refunding them. This follows the decision; it is a cost worth knowing about.

### Security

The `security-review` pass found **no vulnerability at confidence 7 or above**. It checked the following:

- **SQL.** Every statement in `server/limit.js` is bound (`prepare().bind()`). The reserved keys `#ip` and `#refund` cannot collide with a slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, `src/apps/registry.js:21`).
- **Logging.** `refundOnce` and the catch-all log no IP, email or content.
- **Visitor identity.** `networkOf` only feeds a salted SHA-256. The cookie is shape-checked, and the issued value is a `randomUUID`, so a `Set-Cookie` header cannot be injected.
- **Registry.** Removing `isKnownSlug` is safe, because `findApp` compares strictly.
- **pdf.js.** `_shared/pdfjs.js` keeps `isEvalSupported: false` on pdfjs-dist ≥ 4.10.38.
- **Enquiry email.** The `submit.js` HTML email escapes every field, and `from` is pattern-limited.

Money and access: no paid call is reachable in production while APP-002 is `draft` (probed). Turnstile `hostname`/`action` checking remains open as hardening (review 02).

### UI (Web Interface Guidelines, ticket 05's UI files)

```text
## src/apps/pdf-merge-and-split/MergePanel.jsx
src/apps/pdf-merge-and-split/MergePanel.jsx:22-28 - LeftOutNote mounts the Alert with its text already present; some screen readers will not announce it (same pattern as review 02 U6). Nit: the message sits right above the button it explains, so it is read in order anyway
src/apps/pdf-merge-and-split/MergePanel.jsx:25 - ✓ error states its fix ("Remove them, or fix them and add them again")

## src/apps/pdf-merge-and-split/Thumbnails.jsx
src/apps/pdf-merge-and-split/Thumbnails.jsx:74 - ✓ tabIndex=0 on a labelled scroller

## src/apps/pdf-merge-and-split/pdf-merge-and-split.css
src/apps/pdf-merge-and-split/pdf-merge-and-split.css:102 - ✓ :focus-visible with --border-focus token

## src/apps/_shared/AppShell.jsx
src/apps/_shared/AppShell.jsx:18-25 - closing card hidden in an effect: out of tries, it renders for one frame and then disappears (layout shift). Nit; draft tool only

## src/apps/_shared/FileDrop.jsx
✓ pass (chooseLabel falls back to the shared wording)

## src/apps/receipt-reader/index.jsx
✓ pass (card once; draft, not served in production)
```

---

## What to do with the open items

None of them holds the push. In order of value:

1. N1 is a one-line copy change before or soon after the push.
2. N2 is one line in the log.
3. T3 and review 01's finding 6 can go in the next toolbox ticket.
4. The rest are nits, or deferred to the design system at source.

## Questions for Ting Yu

None that block. Ting Yu asked not to be consulted, so the conductor can settle these two:

- **N1:** change the `/apps` description to name only live tools. Recommended: yes.
- **N2:** keep the per-IP refund ceiling and record it. Recommended: keep it.
