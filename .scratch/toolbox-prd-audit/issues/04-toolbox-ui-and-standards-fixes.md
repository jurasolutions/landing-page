# 04 — Accessibility and standards fixes in the toolbox UI

Status: ready-for-agent
Blocked by: none

From `reviews/code-review-02.md`: Standards 12, 13, 15 and UI U1, U2, U3, U4, U6, U7, U9. Read each there for file and line. These bear on the app PRDs' "keyboard usable; every input labelled" and "44 px tap targets" criteria.

Out of scope (leave alone): finding 14 (shared quote document model), 16 (tap minimum belongs in the design system at source; `src/design-system/` is read-only), 17 nits, U5, U8, U10. Don't touch `server/limit.js`, `server/receipt-reader.js`, `server/anthropic.js`, `server/usage.js`, `src/content.js`'s privacy section or `src/apps/receipt-reader/index.jsx`'s out-of-tries branch: ticket 03 changes those in parallel.

## Acceptance criteria

- [ ] 12: the `aria-current` nav rules move from `src/styles/toolbox.css` to `src/styles/site.css`, and the current page shows an underline as well as colour.
- [ ] 13: `functions/submit.js` reuses `FROM_PATTERN`/`readFrom` logic from `src/lib/validate.js` (export a server-safe `cleanFrom` there if needed) and `json` from `server/http.js`; `server/registry.js` reuses `src/apps/registry.js`'s lookup; `server/unsubscribe.js` uses `empty()`. Behaviour unchanged; existing tests still pass.
- [ ] 15: the dead `unsupported` prop and its branch are gone from `QuoteForm.jsx` and its caller.
- [ ] U1: navigating to `/` moves focus sensibly (the hero heading via `usePageHeading`, or the pending flag is cleared) and no stale focus jump happens later.
- [ ] U2: route changes scroll to top instantly (`behavior: "instant"`); back/forward restores sensibly.
- [ ] U3: quote-builder hints and errors are linked to their inputs with `aria-describedby`.
- [ ] U4: the quote builder's Edit/Preview control is two `aria-pressed` buttons at least 44 px tall.
- [ ] U6: alerts in the quote builder and `TryLimitNotice` announce (a live region present before the text changes).
- [ ] U7: disabled "Read receipts" and "Add item" say why (visible hint linked by `aria-describedby`). Any new words go in the tool's `copy.js` and pass `uv run jura-growth check-copy`.
- [ ] U9: the nav "Talk to us" CTA meets a 44 px target without editing the design system (a size prop or a site.css rule using the `--tap-min` token).
- [ ] `npm test` and `npm run build` pass; add tests where the logic is testable in node (router focus flag, `cleanFrom` reuse).
