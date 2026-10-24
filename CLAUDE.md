# CLAUDE.md — repos/landing-page

The Jura Solutions website, jurasolutions.sg: the marketing page and the toolbox at `/apps`.
`README.md` covers layout, commands, tests, the toolbox conventions and deployment.

## Standing rules

- **Jura only.** Never read `taskwise-*` or ZenexFlow folders. No Notion, no Zapier.
- **`src/design-system/` is read-only.** It is a synced copy; change the design system at source
  and run `npm run sync:ds`.
- **The numbers rule.** Never publish a figure Jura can't evidence.
- **A push to `main` is a production deploy.**

## Agent skills

Crew operating card: docs/agents/crew.md

### Issue tracker

Local markdown under `.scratch/<feature>/`; PRDs stay in `jurasolutions/prd/pending/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label equal to its name. See `docs/agents/triage-labels.md`.
