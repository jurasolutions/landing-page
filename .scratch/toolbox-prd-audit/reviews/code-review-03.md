# Code review 03: the AI limiter, the draft gate and the privacy fixes

Branch `crew/toolbox-prd-audit-03-ai-limiter` at `29c9c2d`, reviewed against `crew/toolbox-prd-audit` (`4f804cf`). Six commits: `d941af4`, `79230dd`, `a11175f`, `931cdd9`, `bf50bb1`, `29c9c2d`. Ticket: `issues/03-ai-limiter-and-privacy-fixes.md`. Reviewed 2026-10-25.

## Verdict: approve

Nothing here blocks. The site-wide cap now holds whatever the model or the API answers. No call is ever given back, the repair is counted before it is sent, and the SDK does not retry. The cap held in every probe I ran. The draft gate holds on all three endpoints.

There are six *should fix* findings. Fix them before the AI variables go on Production, or in a follow-up ticket. None of them lets a paid call through uncounted:

- Two are refund bookkeeping when D1 fails part-way (findings 2 and 3).
- One is an acceptance-criterion wording gap (finding 1).
- Two are ways one visitor gets past their own limit, still inside the site cap (findings 11 and 12).
- One is dead or duplicated helper code (finding 6).

## Evidence I ran

| Command | Result |
|---|---|
| `npm test` (worktree) | 12 files, 203 tests passed (773 ms) |
| `npm run build` (worktree) | `vite build` ok. The prerender wrote `apps.html`, `privacy.html`, `unsubscribed.html` and `apps/quote-builder.html` |
| `uv run jura-growth check-copy` on `content.js`, both `copy.js` files and `registry.json` | 304 of 304 strings pass |
| `jura-growth check` on "...well within 10 business days." | **fail** (numbers rule, on the digits) |
| `jura-growth check` on "...by hand within ten business days." | **pass** |
| `git diff --name-only 4f804cf...HEAD -- src/design-system dist .dev.vars .env wrangler.toml` | empty: no blocked path touched |
| Probe, real Functions plus in-memory D1, kept outside the repo (`scratchpad/probe03/probe03.test.js`) | Results below |

### Probe results (the scenarios from review 02, re-run, plus new ones)

| # | Scenario | Result |
|---|---|---|
| A | `AI_SITE_CAP=3`, all refusals. One cookie sends 10 requests, then 10 fresh IPs send one each | One cookie: `502,502,429×8`. Fresh IPs: `502,429×9`. **3 API calls in total.** `app_calls` = 3. Refusals keep the try used. **Was 10 calls (P1).** |
| A2 | Cap 3, every answer invalid (so each try needs a repair) | `502` (2 calls, try refunded), `503` (1 call, repair skipped at the cap, try refunded), then `429`. **3 API calls.** |
| A3 | Invalid output, then the repair is refused | `502 unreadable`, `triesLeft 1` (try kept used), 2 calls counted |
| B | Three fresh cookies and the cookie-less bucket, all from one IP, 3 tries each | Statuses `200,200,429` ×3, then `429` ×3. **6 successes, 6 API calls.** A fourth fresh cookie's `/limit` shows `triesLeft 0`. **Was unbounded (P4).** |
| C | Draft receipt reader, `AI_ALLOW_DRAFTS` unset | read **404**, `/limit?tool=receipt-reader` **404**, `/limit` with no tool 200, usage for the draft slug **400**, usage for `quote-builder` 204. 0 Turnstile calls, 0 API calls, no rows. `AI_ALLOW_DRAFTS=true` also gives 404 (only `"1"` opens it). **Was 200 and 204 (P2).** |
| D | D1 bound, no tables | read `503 unavailable`, 0 API calls. **Was an unhandled throw (P3).** |
| E | The IP upsert inside `takeTry` throws (transient D1 error) | `503`. The visitor row is left at `*=1`: **a leaked try** (finding 2) |
| E2 | `takeCall` inside `takeTry` throws | `503`. Visitor and IP rows both left at 1: **leaked** (finding 2) |
| F | Second try. The API fails, then the IP give-back inside `refundTry` throws | Visitor row went 2 → 1 → 0, so it was **refunded twice**: the visitor ends a try better off. IP row 2 → 1 (finding 3) |
| G | One cookie, cap 20. Each request gets an API 400, or invalid output twice | 400s: **20 requests in a row**, every one refunded, until the cap closed the site. Invalid output: 10 requests, **20 billed calls**, cap reached (finding 11) |
| H | Five addresses in one IPv6 /64, 2 tries each | **10 successes**, past the per-IP ceiling of 6 (finding 12) |
| I | `ipKey` | `'*'` → `#ip`, `'receipt-reader'` → `#ip:receipt-reader` |

### The brief's specific checks

- **Can `app_calls` ever be decremented?** No. Its only writes are the conditional `+1` upsert in `takeCall` (`server/limit.js:121-133`) and `closeForToday` (`:150-157`), which only raises it, using `MAX`. `refundTry` (`:139-142`) touches `app_tries` only. `grep app_calls server functions src` finds nothing else.
- **Is every Anthropic request counted before it is sent?** Yes:
  - The first call is counted by `takeTry` → `takeCall` before `messages.create` (`server/receipt-reader.js:138`, then `:180`).
  - The repair is counted by `takeCall` at `:193`, before the create at `:196`, and is skipped at the cap.
  - `server/receipt-reader.js` is the only place that calls `messages.create`.
- **Is `maxRetries` 0?** Yes, at `server/anthropic.js:29`. No per-request override is passed. The test "never retries a failed call behind the counter's back" proves it with a network failure.
- **Can `#ip` rows collide with a real slug?** No:
  - Slugs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (`src/apps/registry.js:21`).
  - The `tool` key only ever comes from a registry-checked slug or `'*'`, so no visitor row can start with `#`.
  - The hashes differ as well: `salt|ip|<IP>` against `salt|<IP>|<cookie>`.
- **Can a refund path refund a try twice?** In normal flow, no. `fail` marks the try refunded, and the catch only refunds when that mark is missing. But if `refundTry` throws after its first give-back, the catch runs it again, and the visitor's count is decremented twice (probe F, finding 3).
- **Do the per-IP and per-visitor takes stay consistent when one succeeds and the other fails?** When a limit refuses, yes:
  - If the IP ceiling refuses, the visitor's try is given back (`limit.js:99-104`).
  - If the cap refuses, both are given back (`:106-111`).
  - When a statement *throws* part-way, no. The counts already taken stay taken, because `state.taken` is still null (probes E and E2, finding 2). This fails closed: the visitor loses a try, and no money is spent.
- **Is the privacy wording true of the code?**
  - "Two scrambled codes, one made from your connection's IP address and a random cookie and one from the IP address alone": true (`server/visitor.js:44-46,53-63`).
  - The Web Analytics line is gone.
  - The address wording matches scout §5.2 point 5.
  - The reply-unsubscribe line is true, but it no longer states the timeframe the AC asked for (finding 1).

---

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| F1: `app_calls` never decremented; every request sent takes a call, repair included; repair skipped at the cap with the try refunded and `unavailable`; `maxRetries: 0`; refund on API, network and invalid output, not on refusal; tests for cap 3 with five refusals and for the repair counting | **met** | `limit.js:121-142`; `receipt-reader.js:154-205`; `anthropic.js:29`; tests in `tests/limiter.test.js` "the site-wide cap" (five refusals → ≤ 3 calls; repair counts; repair skipped at cap 1 → 503 with try refunded). Probes A, A2, A3 |
| F2: receipt-reader Function and `/api/apps/limit` answer 404 for a non-live tool unless `AI_ALLOW_DRAFTS=1`; README beside `VITE_SHOW_DRAFTS`; `.dev.vars` note for `dev:functions`; tests | **met** | `server/drafts.js`; `receipt-reader.js:87`; `limit-endpoint.js:21`; README `:40-47`, `:362-368`; `tests/limiter.test.js` "draft tools". Probe C |
| F3: `AI_TRIES_PER_IP` (default 6), salted IP-only hash, in the same `takeTry`, same day and refund rules; test that three cookies stop at 6; README env table and limiter section | **met** (with finding 12) | `limit.js:34,47,91-114`; `visitor.js:44-46`; README `:221-225`, `:355`; `tests/limiter.test.js` "the per-IP ceiling". Probe B |
| F4: Web Analytics sentence removed; README "Not done yet" item | **met** | `content.js:163`; README `:534-539`; `tests/privacy.test.js` |
| F5: out of tries, the shared `TalkToUsCard` sits under the notice | **met** (UI nit U1) | `src/apps/receipt-reader/index.jsx:27-43`; `tests/receipt-reader-ui.test.js` |
| F6: reply-unsubscribe line says "by hand, well within 10 business days"; "personal addresses" reworded to scout §5.2 | **partly** | The address wording is met (`content.js:170`). "By hand" is met, but the timeframe was dropped (`content.js:172`, finding 1) |
| F7: PDF Creator/Producer name Jura only with "Made with" on; asserted | **met** | `src/apps/quote-builder/pdf.js:79-81`; `quote.test.js` "names Jura in the file's Creator and Producer only when…" |
| F10: any unexpected throw after the try refunds it and answers 503; test with D1 bound but no tables | **met for the case named**, partly in general | `receipt-reader.js:113-131`; probe D. A throw *inside* `takeTry` leaks (finding 2) |
| F11: usage counts only `live` slugs (or the local override) | **met** | `server/usage.js:43-47`; `tests/usage.test.js`. It answers 400, not 404, matching the unknown-slug answer. Accepted |
| Copy passes `check-copy`; `npm test` and `npm run build` pass | **met** | 304/304; 203 passed; build ok |
| App factory §5.4 "Site-wide cap: 200 AI calls per day" and block 3 "a test site-wide cap of 3 holds" | **met** | Probes A and A2; `tests/limiter.test.js` "holds at a test cap of 3…" |

---

## Findings

Ranked within each axis. Every finding has been checked against the line. Those marked "reproduced" were also run.

### Spec

**1. Should fix: the reply-unsubscribe line no longer gives a timeframe.** AC F6: "the reply-unsubscribe line says it is handled by hand, well within 10 business days".
- **Where:** `src/content.js:172` now says "we'll add the address by hand as soon as we read your reply". The reason given in `tests/privacy.test.js:22` is that "10 business days" fails the checker.
- **Why the reason does not hold:** only the digits fail. "within ten business days" passes `jura-growth check` (run above). The timeframe is the Spam Control Act's, so it is a commitment Jura can evidence, not a marketing figure. "As soon as we read your reply" has no upper bound.
- **Fix:** "You can also reply “unsubscribe”, and we'll add the address by hand, well within ten business days." Update the comment and the regex in `tests/privacy.test.js:20-25`.

**2. Should fix: a throw part-way through `takeTry` leaks the counts it already took.** Reproduced (probes E and E2). AC F10: "any unexpected throw after the try is taken refunds the try".
- **Where:** `server/limit.js:96-111` takes the visitor row, then the IP row, then the site call. If a later statement throws, `takeTry` never returns, so `state.taken` (`server/receipt-reader.js:138-139`) stays null and the catch at `:118-127` refunds nothing. The visitor loses a try (both rows, if `takeCall` throws). No money is spent.
- **Fix:** inside `takeTry`, wrap the IP take and `takeCall` in `try`/`catch`. Give back what was taken, then rethrow. Add a test with a D1 stub that throws on the second `INSERT INTO app_tries`.

**3. Should fix: a partly failed refund is retried, so the visitor's try can be refunded twice.** Reproduced (probe F).
- **Where:** `fail` sets `state.refunded = true` only *after* `await refundTry(...)` (`server/receipt-reader.js:155-156`). If `refundTry`'s second give-back (the IP row, `limit.js:141`) throws, the catch sees `refunded === false` and calls `refundTry` again (`:120-123`). That decrements the visitor row a second time. In the probe it went from 2 to 0 after a single failed try.
- **Bound:** the IP ceiling and the site cap still hold, so this is a free extra try, not an uncounted call.
- **Fix:** set `state.refunded = true` *before* awaiting `refundTry` in `fail`, so a refund is attempted at most once. Add a test with a D1 stub that throws on the second `count - 1` update.

**4. Nit: the catch path reports `triesLeft + 1` even when its own refund threw** (`server/receipt-reader.js:129`). The page then shows one more try than the visitor has. Fix: only add 1 when the refund succeeded.

**5. Nit: `/api/apps/limit` with no `tool` parameter is not draft-gated** (`server/limit-endpoint.js:20-21`). It spends nothing and reports only the shared count. Accept, or leave as is.

### Standards

There are no hard violations. Copy lives in `content.js`/`copy.js`, the design system is reached only through `ds.js`, tests stub the network, there is no `wrangler.toml`, and no blocked path is touched.

**6. Should fix (reuse): dead and duplicated helpers.**
- `isKnownSlug` (`server/registry.js:8`) has no caller left (`grep` finds none outside its own file). `usage.js` moved to `findEntry` + `isServed`. Delete it.
- `server/receipt-reader.js:128` builds `console.error(JSON.stringify({ at: "ai-tool", ... }))` by hand. `logCall` (`server/ai-tool.js:46`) already exists, and README "Logs" promises one JSON line per call in one shape. Use `logCall({ day, tool, ok: false, reason: "error", ... })`.

**7. Nit (stale comment):** `server/limit.js:18` says "Both counters live in D1". There are now three: visitor, IP and site.

**8. Nit (Duplicated Code / Data Clumps, judgement call):**
- The `triesLeft` minimum is written twice (`server/limit.js:61` and `:113`).
- The IP row `{ day, hash: ipHash, key: ipKey(key) }` is built three times (`:58`, `:94`, `:141`). A small `rowsFor(ctx)` returning `{ visitor, ip }` would remove both.
- `isServedAiTool` (`server/ai-tool.js:22-24`) calls `findEntry` twice.

**9. Nit (Duplicated Code, judgement call):** the catch block (`server/receipt-reader.js:118-130`) repeats `fail`'s refund and its `triesLeft + 1`, kept in step through a mutable `state` object. That works, but refunds now live in two places, and findings 3 and 4 come from the gap between them. One `refundOnce()` closure, shared by `fail` and the catch, would close the gap.

**10. Nit (Mysterious Name):** `AI_ALLOW_DRAFTS` also gates usage counting for browser-tier drafts (`server/usage.js:45`). The README explains it, so a rename is optional.

### Security

The security pass found **no vulnerability at confidence 8 or above**:
- Every D1 statement is bound, and `ipKey` values are bound parameters.
- The draft gate runs first, cannot be overridden by the caller (`registry` is not on the Pages context), and opens only for `"1"`.
- Nothing PII-bearing is logged: no IP and no hash.
- There is no `dangerouslySetInnerHTML`.

The sub-agent also said "nothing leaks or double-spends". My probes E, E2 and F contradict that under partial D1 failures (findings 2 and 3). Neither lets an uncounted call through.

The cost-control findings below are not exploits. Money stays bounded by `AI_SITE_CAP`.

**11. Should fix: refunded failures have no per-visitor bound, so one visitor can use up the whole day's cap.** Reproduced (probe G).
- **What happens:** every `invalid_output` and every API 4xx/5xx refunds the try (`server/receipt-reader.js:173`, `:204`). One cookie can therefore keep trying past its 2 tries and its IP's 6.
  - Garbage that Anthropic rejects with a 400 gave 20 requests in a row. 400s are not billed.
  - Output that fails validation twice gave 20 billed calls from 10 requests.
  - Both stop only at the site cap, which closes the toolbox for everyone else until midnight SGT.
- **Mitigation already there:** Turnstile is needed per request, which raises the cost.
- **Fix (recommended):**
  - Treat an API `400 invalid_request_error` like a refusal, because it comes from what was uploaded: keep the try used.
  - Refund at most one failure per visitor per day. Record it as an `app_tries` row with tool `#refund`, or similar.
- This changes AC F1's "refunded for API/network failures", so it is a question for Ting Yu (below).

**12. Should fix: the per-IP ceiling counts each IPv6 address separately.** Reproduced (probe H).
- **What happens:** `hashIp` (`server/visitor.js:44-46`) hashes the full address. A home or office IPv6 connection usually owns a whole /64, so changing the last bits gives fresh tries. Five addresses in one /64 gave 10 successes against a ceiling of 6.
- **Fix:** for IPv6, hash the /64 prefix in `hashIp`, and in the visitor hash as well if you want the same there. Add a test with two addresses in one /64.

**Hardening, below threshold:** `/api/apps/limit` answers 400 for an unknown slug and 404 for a draft one, which reveals the draft slugs. `registry.json` ships in the client bundle anyway, so this needs no action.

### UI (Web Interface Guidelines, `src/apps/receipt-reader/index.jsx`)

**U1. Nit: out of tries, the page shows the talk-to-us card twice.**
- **Where:** one card under the notice (`index.jsx:40`), and the shell's own card (`src/apps/_shared/AppShell.jsx:56`).
- **What it costs:** two identical `h2` headings and two identical links, so a screen-reader heading list repeats itself.
- **Fix:** let the shell skip its card when the tool reports that the visitor is out of tries, or accept the duplicate. APP-002 §5.1 step 7 asks for the card under the notice and does not ask to remove the closing one.

**U2. Nit:** the out-of-tries rule (`isOutOfTries` plus the card) lives in this one tool, not in `_shared/TryLimitNotice.jsx`, so the next AI tool will have to copy it. Move it when the second AI tool is built.

There are no other guideline issues in the changed lines: the card is a real link, the alert comes from the design system, and nothing interactive was added.

---

## Questions for Ting Yu

1. **Should a visitor's refunds be bounded (finding 11)?** Recommended: yes, both parts:
   - An API 400 "could not process" keeps the try used, the same as a refusal.
   - Refund at most one failure per visitor per day.
   One visitor then cannot close the toolbox for everyone. Money is already bounded by the cap either way.
