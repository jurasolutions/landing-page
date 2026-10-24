# Crew operating card

_Read by every crew persona before acting. Repo rules outrank crew defaults. Last verified: 2026-10-24._

## Commands

| Purpose | Command | Verified |
|---|---|---|
| Install dependencies | `npm install` | verified 2026-10-24 (Node 20.20.2; `node_modules/` present, lockfile committed) |
| Test, all | `npm test` | verified 2026-10-24: 10 files, 178 tests passed in 1.1s. `vitest.config.js` includes only `src/**/*.test.js` and `tests/**/*.test.js`, so `.claude/worktrees/` is never swept up |
| Test, one file | `npx vitest run tests/usage.test.js` | verified 2026-10-24 |
| Typecheck | none | unverified: plain JS and JSX, no TypeScript or JSDoc checking configured |
| Lint | none | unverified: no linter configured |
| Build | `npm run build` | verified 2026-10-24: `vite build`, then `scripts/prerender-routes.mjs` writes the per-route heads into `dist/` |
| Run the app | `npm run dev` (pages only, http://localhost:5173) or `npm run dev:functions` (build, then pages + Functions + local D1 on http://localhost:8788; run `npm run db:migrate:local` once first) | verified 2026-10-24 |

Vite's dev server does not run Pages Functions. A form or AI tool that shows its error state under
`npm run dev` is behaving correctly; use `npm run dev:functions` to exercise the Functions.

## Branches

- **Base branch for crew work:** `main` (the unpushed `toolbox` branch carries the toolbox work as of 2026-10-24)
- **Protected (crew never pushes or merges into these):** `main`. A push to `main` is a production deploy.
- **Ship path:** push to `main` on `github.com/jurasolutions/landing-page`. Cloudflare Pages builds `main` and serves it on jurasolutions.sg. Other branches get preview deployments only. `gh` is not logged in on this Mac (2026-10-24); `git push` works through the macOS keychain.

## Rules that gate the crew

- **PRD rule:** required. "PRD before build — explicit sign-off required before any code is written. PRD prompts must include: "Do not start building. This PRD requires explicit sign-off."" and "New PRDs are written to `prd/pending/` as `prd-{project-name}-YYYY-MM-DD.md`." (`jurasolutions/CLAUDE.md`). Sign-off is recorded in the PRD's Sign-off section. App PRDs live in `jurasolutions/prd/pending/apps/`; Ting Yu's "approved, build <path>" is the sign-off for one app. When a build ships and is accepted, the PRD moves to `prd/done/` (or `prd/done/apps/`) with the ship date at the top.
- **Blocked paths (read-only):** `src/design-system/` (a verbatim synced copy: "**`src/design-system/` is read-only.** Do not hand-edit it." — `README.md`; change it with `npm run sync:ds`), `jurasolutions/design-system/`, `jurasolutions/inputs/`, `.dev.vars`, `.env`, and the generated `dist/`.
- **Design system:** `jurasolutions/design-system/`, vendored here as `src/design-system/` and imported only through `src/ds.js`. Read its `SKILL.md`, then `README.md`, then a component's `.prompt.md` before using it. It governs tokens, components, icons (register any new Lucide icon in `src/lib/icons.js`) and voice (§3). "Anything carrying the Jura name is built from the design system's tokens and components, never ad-hoc styles or a second icon/font set." (`jurasolutions/CLAUDE.md`)
- **Voice for human-facing text:** commits in plain sentence-case imperatives, matching the history (for example "Build APP-001 Quote builder"). Page copy follows `design-system/README.md` §3: sentence case, second person, short declaratives, no buzzwords, no emoji, no exclamation marks, and the numbers rule. Copy lives in `src/content.js` and each tool's `copy.js`; every word should pass `jura-growth check` (run from `repos/growth` with `uv run jura-growth check "<text>"`).
- **Other repo rules:**
  - "Never publish a figure the business cannot evidence. No client counts, no hours saved, no ROI percentages, no logos." (`README.md`, from design-system §3)
  - Jura only: no Notion, no Zapier, never read `taskwise-*` or ZenexFlow folders (`jurasolutions/CLAUDE.md`).
  - Tests never touch the network: every `fetch` is stubbed (`tests/setup.js`). Never call Anthropic, Resend or Turnstile for real.
  - Secrets and Pages settings (env vars, the D1 binding, remote D1 migrations) are the user's. Never commit a secret, and never add a `wrangler.toml` (it would take bindings away from the dashboard; see `README.md`).
  - Browser-tier tools make no server calls except the anonymous usage counter.

## Release

- **Versioning:** `version` in `package.json` (1.0.0). No release tags.
- **Changelog:** none. History is the commit log.
- **Deploy target and how:** Cloudflare Pages, git integration on `main`: build `npm run build`, output `dist`. Functions in `functions/` deploy with it. Env vars bind at build time, so a changed variable needs a fresh deploy.
- **Rollback:** revert the commit on `main` and push, or use "Rollback to this deployment" on an earlier production deployment in the Pages dashboard (instant, no rebuild).

## Tracker

Issues and feature folders: see `docs/agents/issue-tracker.md`. Domain glossary: `CONTEXT.md`. ADRs: `docs/adr/`.
