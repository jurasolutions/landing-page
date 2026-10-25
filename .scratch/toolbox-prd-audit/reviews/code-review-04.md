# Code review 04: toolbox UI and standards fixes

Branch `crew/toolbox-prd-audit-04-ui-standards` (fda5f77, 6 commits), reviewed against `4f804cf`, which is its merge-base. Ticket: `issues/04-toolbox-ui-and-standards-fixes.md`, built from findings in `reviews/code-review-02.md`. Reviewed 2026-10-25. All paths below are relative to the repo root.

## Verdict: changes requested

There is one blocking finding. **Acceptance criterion U3 is only partly met** (Spec S1): one quote-builder hint is still not linked to its control. The fix is two attributes. Nothing else blocks. No blocked path was touched, the security pass found nothing, and every other criterion is met.

When the developer goes back in, they should also rebase onto `crew/toolbox-prd-audit` (Spec S2). That branch now holds ticket 03, and this branch conflicts with it in one file.

## Evidence I ran

| Command | Result |
|---|---|
| `npm test` (worktree) | 13 files, 218 tests passed |
| `npm run build` (worktree) | `vite build` ok; the prerender wrote `apps.html`, `privacy.html`, `unsubscribed.html` and `apps/quote-builder.html` |
| `uv run jura-growth check-copy` on both changed `copy.js` files | 130 of 130 strings pass |
| Scratch script: old `functions/submit.js` (from `4f804cf`) and new, side by side, with `fetch` stubbed | Same status and same body for 400 (bad JSON), 400 (invalid), 500 (no key), 502 (refused), 502 (unreachable) and 200. The Resend payload is byte-identical for a good `from`, a bad `from` (`apps/../evil<script>`) and an object `from`. The only difference is that every reply now carries `Cache-Control: no-store`. 405 is still Pages' answer, because both versions export only `onRequestGet` and `onRequestPost` |
| `esbuild --bundle --platform=neutral` on `functions/submit.js` and `server/registry.js` | Both bundle cleanly. The output has no `window`, `document` or React. `src/lib/validate.js` and `src/apps/registry.js` use no browser-only API (`URLSearchParams` exists in Workers) |
| Trial merge into `crew/toolbox-prd-audit` (2706a18) in a scratch worktree, since removed | One conflict, in `src/apps/receipt-reader/index.jsx:92-97`. Once resolved, `vitest` gives 22 files and 290 tests passed, and `npm run build` is ok (the prerender also wrote `apps/pdf-merge-and-split.html`) |

## Per-criterion checklist

| Criterion | Status | Where |
|---|---|---|
| 12: `aria-current` rules move to `site.css`, with an underline as well as colour | met | `src/styles/site.css:204-213`. The rule comes after the hover rules, so it wins at equal specificity. On the home page no link carries `aria-current` (`Nav.jsx:19`), so the home page does not change |
| 13: `submit.js` reuses `cleanFrom` and `json`; `server/registry.js` reuses `findApp`; `unsubscribe.js` uses `empty()`; behaviour unchanged | met, with one header change | Probed (see the evidence table). Unsubscribe replies are identical, because its `HEADERS` already set `no-store`. The `no-store` added to `/submit` replies is harmless and arguably right for a POST reply and a health check |
| 15: dead `unsupported` prop removed | met | `QuoteForm.jsx` and its caller in `index.jsx` |
| U1: home focus is sensible, with no stale focus jump | met | `Hero.jsx:9,19`. The request is now keyed by path (`router.js:100-111`) and replaced on every navigation, so it cannot fire on a later page |
| U2: instant scroll; back and forward restore sensibly | met, one should-fix (Spec S3) | `router.js:126` uses `behavior: "instant"`. Back restores the saved position; forward goes to the top |
| U3: hints and errors linked with `aria-describedby` | **partly met** (Spec S1) | TextField, NumberField and item errors are linked (`QuoteForm.jsx:21-45`). The `rememberBlocked` hint at `QuoteForm.jsx:303` is not |
| U4: Edit/Preview as two `aria-pressed` buttons, at least 44 px | met | `index.jsx:220-233`, `quote-builder.css:29-55` (`min-height: var(--tap-min)`). The global `:focus-visible` in design-system `tokens/base.css:32` gives the buttons a focus ring |
| U6: quote-builder alerts and `TryLimitNotice` announce | met | `TryLimitNotice.jsx:16-22`, `QuoteForm.jsx:292`, `index.jsx:166`. I confirmed that the duplicated `actions` region is announced only once: its hidden copy is `display:none` (`quote-builder.css:56,358-361`) |
| U7: disabled "Read receipts" and "Add item" say why, with copy in `copy.js` | met | `QuoteForm.jsx:349-361`, `receipt-reader/index.jsx:238-255`. `canRead` is logically the same as before. The copy passes check-copy |
| U9: nav CTA is 44 px without editing the design system | met | `Nav.jsx:88`. The design system Button spreads `style` last, so `minHeight` wins (`Button.jsx`). The home nav CTA grows from 34 px to 44 px, as intended |
| Tests and build pass; node-testable logic is tested | met | `tests/router.test.js`, `tests/ui.test.js`, `files.test.js`, `tests/enquiry.test.js` |
| Out-of-scope files untouched | met | No changes to `server/limit.js`, `receipt-reader.js`, `anthropic.js`, `usage.js` or `content.js`. The out-of-tries branch of `receipt-reader/index.jsx` is untouched |
| Blocked paths | clean | `src/design-system/` and `dist/` are not in the diff |

## Spec

**S1. Blocking: U3 is not fully met.** `src/apps/quote-builder/QuoteForm.jsx:302-303`. code-review-02's U3 named four places, `QuoteForm.jsx:20,27,248,288` (old numbering). Old line 288 is the "Remember" hint shown when storage is blocked. It still has no id, and the Checkbox has no `aria-describedby`.
- Spec line: "quote-builder hints and errors are linked to their inputs with `aria-describedby`".
- Fix: add `id="qb-remember-blocked"` to the `<p className="qb-hint">`. Pass `aria-describedby={rememberBlocked ? "qb-remember-blocked" : undefined}` to `Checkbox`, which spreads `rest` onto its `<input>`. Add a `tests/ui.test.js` case that renders the form with `rememberBlocked: true`.

**S2. Should fix: this branch conflicts with ticket 03, now on the integration branch.** `src/apps/receipt-reader/index.jsx:92-97`. Ticket 03 changed `outOfTries` to `isOutOfTries(limit)`, and this branch replaced the `canRead` line next to it.
- Fix: rebase onto `crew/toolbox-prd-audit`. Keep `const outOfTries = isOutOfTries(limit);` and this branch's `blocker`, `canRead` and `whyNot` lines.
- I verified that resolution: 290 tests pass and the build is ok.

**S3. Should fix: forward after back always lands at the top.** `src/lib/router.js:148,176-186`. The scroll position is saved only when the router pushes a new entry. When the visitor presses back, the position of the entry they leave is never written. A later forward finds `state === null`, and `restoreScroll(0)` then overrides the position the browser itself would have restored, because `history.scrollRestoration` is still `auto`.
- Spec line: "back/forward restores sensibly".
- Fix: keep the current entry's `scrollY` up to date, for example with a throttled `replaceState` on `scroll` or `pagehide`. Alternatively, when there is no saved position on a step between pages, skip `restoreScroll` and leave the browser's restore alone.

**S4. Note: U6 sites outside this criterion.** The receipt reader's not-ready alert and the file-status text (code-review-02 U6: `receipt-reader/index.jsx:190,209-217`) are still not live regions. The criterion names only the quote builder and `TryLimitNotice`, so this is a follow-up, not a defect. After ticket 03, `LimitArea` swaps the live `TryLimitNotice` for the not-ready Alert.

**S5. Note: scope.** `readBlocker` and its three "why" hints (`files.js:22-39`) go a little beyond "say why". They are within the spirit of U7 and tested.

## Standards

**T1. Should fix: an ad-hoc component where the design system has one.** `src/apps/quote-builder/index.jsx:220-233`, `quote-builder.css:23-55`.
- Rule: README "no ad-hoc components", and `jurasolutions/CLAUDE.md` "built from the design system's tokens and components".
- What happens: `.qb-views` and `.qb-view` copy the design system Tabs' inline styles one for one (gap, hairline, 2px brand underline, weights, transition). The cause is real: design-system `Tabs.jsx` hard-codes `role="tab"`, the ticket prescribed `aria-pressed` buttons, and `src/design-system/` is read-only.
- Fix: leave it in place for now. Add a toggle or `aria-pressed` mode to Tabs at source (with deferred finding 16), then `npm run sync:ds` and drop the copy.

**T2. Should fix: the same pattern for field notes.** `QuoteForm.jsx:21-45`, `quote-builder.css:96-102` (`.qb-note`).
- What happens: TextField stops passing `hint` and `error` to the design system `Field` and restyles the note itself, because `Field`'s note has no id.
- Fix: at source, give `Field` a note id (for example `${htmlFor}-note`) and have it set `aria-describedby`. Then return to `Field`'s own `hint` and `error`. Track this with T1.

**T3. Should fix: one test reads source text.** `tests/enquiry.test.js:119-123` greps `functions/submit.js` for the import and the pattern. Reformatting the import breaks it, and an inlined copy with different spacing passes it. The behaviour tests in the same file already cover `from`. Fix: delete it, or replace it with a behaviour assertion.

**T4. Nit: Middle Man.** `server/registry.js:13`, `export const findEntry = findApp`. The alias has one caller (`server/ai-tool.js`). Fix: import `findApp` there and drop the alias.

**T5. Nit: Duplicated Code.** `receipt-reader/files.js:25` restates `limit.capReached || limit.triesLeft <= 0`, which `index.jsx:94` (and ticket 03's `isOutOfTries`) also own. `readBlocker` is also not an upload rule, which is what `files.js`'s header says the file holds. Fix: after the rebase, have `readBlocker` call one exported `isOutOfTries`, and consider a `read-state.js`.

**T6. Nit: Repeated Switches.** `router.js:148-166` and `176-186` each bump `restoring`, request focus, notify and branch on `plan.scroll`. One `apply(plan, to)` would gather these steps.

**T7. Nit: tests map.** The README Tests table (around line 376) does not list `tests/router.test.js`, `tests/ui.test.js` or `src/apps/receipt-reader/files.test.js`.

**T8. Nit: raw values.** `site.css:211-212` sets `2px` and `3px` for the underline, and `quote-builder.css:26` writes `1px solid var(--border-subtle)` where `--border-hairline` exists. Neither is a colour or spacing value, so README line 61 does not strictly apply.

What is good: the move of the `aria-current` rules fixes an earlier breach of the `tb-` prefix rule, and `.tb-live` follows the prefix. All new words are in `copy.js`.

## Security

No findings. I checked the ticket's diff, not the whole integration branch.
- `cleanFrom` keeps the same pattern, and a bad `from` is still dropped silently. A probe with `apps/../evil<script>` and with an object sent the same email as before, with no "Came from" line.
- `escapeHtml` is unchanged.
- The unsubscribe replies keep `no-referrer`, `noindex` and `no-store`, and the redirect `Location` is built the same way.
- The router's saved state holds only a number, and the router validates it before use (`planHistoryStep`).
- `interceptLinks` is unchanged.
- No new `innerHTML`, `dangerouslySetInnerHTML` or `eval`.
- No secrets in the diff.

## UI (Web Interface Guidelines, against the design system)

There are no blocking UI findings. The checks against the brief:
- Hash links: `#contact` on the home page is still left to the browser. `/#contact` from a toolbox page plans `scroll: "hash"` and requests no focus.
- `?from` on the home page: `Contact.jsx:57` still reads `window.location.search` at submit time.
- Home page: the only changes are the 44 px CTA and focus on the hero `h1`, which happens only after a client-side navigation to `/`. On a first load nothing moves.

```text
## src/apps/quote-builder/QuoteForm.jsx
src/apps/quote-builder/QuoteForm.jsx:303 - hint not linked to Checkbox (Spec S1)
src/apps/quote-builder/QuoteForm.jsx:292 - nested live regions: DS Alert is role="status" inside aria-live="polite"; some readers announce twice. Nit; consider aria-live on the wrapper only, or the Alert alone kept mounted

## src/apps/quote-builder/index.jsx
src/apps/quote-builder/index.jsx:166 - same nested role="status" inside aria-live (nit)
src/apps/quote-builder/index.jsx:221 - ✓ role="group" + aria-label, aria-pressed, native buttons

## src/apps/quote-builder/quote-builder.css
src/apps/quote-builder/quote-builder.css:29 - ✓ 44px, hover state, explicit transition list, reduced-motion variant; focus ring from DS base.css :focus-visible
src/apps/quote-builder/quote-builder.css:29 - nit: no white-space: nowrap (Tabs had it); labels are short

## src/apps/_shared/TryLimitNotice.jsx
src/apps/_shared/TryLimitNotice.jsx:18 - nested role="status" Alert inside the live wrapper for limitReached/capReached (nit, as above)

## src/apps/receipt-reader/index.jsx
src/apps/receipt-reader/index.jsx:241 - ✓ describedby lists the reason first, then the one-try note
src/apps/receipt-reader/index.jsx:249 - "why" hint appears without a live region; OK, since it is read with the button

## src/lib/router.js
src/lib/router.js:120 - behavior "instant" overrides html{scroll-behavior:smooth}; ✓
src/lib/router.js:176 - forward after back forces top (Spec S3)

## src/sections/Hero.jsx
✓ pass (h1 gets tabindex=-1 only after a client-side navigation to /)

## src/sections/Nav.jsx
✓ pass (44px CTA via token)

## src/styles/site.css
✓ pass (current page underlined as well as coloured)

## src/styles/toolbox.css
src/styles/toolbox.css:18 - ✓ .tb-live:empty is out of flow; stacks use flex gap, so no stray gap
```
