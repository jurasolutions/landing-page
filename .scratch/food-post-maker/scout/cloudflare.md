# Risk card: cloudflare

| | |
|---|---|
| **Verdict** | don't recommend |
| **Risk** | High (scanner floor: High) |
| **Source** | cloudflare/skills @ b052c32bab7dd493513260228a36c88294f343f1 (the SHA pinned by Anthropic's official catalog `claude-plugins-official`; plugin 1.0.0). Upstream HEAD is 86505e44f87d801aa1864a3c4109e9a8ae5c409f |
| **Maintainer** | Cloudflare (CODEOWNERS are Cloudflare staff; repo created 2025-12-10, 244 commits, 3.2k stars, Semgrep CI). Listed in Anthropic's official catalog. Provenance is excellent. |
| **Licence** | Apache-2.0; vendorable: yes |
| **Kind** | plugin: 14 skills, 1 remote MCP server (`https://mcp.cloudflare.com/mcp`, HTTP), no hooks, no agents, no LSP |
| **Always-on cost** | ~1,033 tokens (from `claude plugin details`), plus MCP tool schemas resolved at runtime |
| **Vetted** | 2026-10-27, by crew:skill-scout |

## What it does

It adds Cloudflare platform guidance: a product-selection skill (`cloudflare`) with 60-odd reference folders, plus skills for Workers best practices, Wrangler, Durable Objects, Agents SDK, sandboxes, Turnstile setup and others. It also connects Claude Code to Cloudflare's remote MCP server, which, once authorised, acts on the user's Cloudflare account through the API.

## Gain for this task

None beyond what the developer gets by reading the Cloudflare docs directly. The parts that would matter here are thin:

- `references/workers-ai/*.md` (5 files, 82 lines) are tables of links to developers.cloudflare.com. They have nothing on FLUX.2 klein, the multipart `FormData` request, image responses or neuron cost. The skill says to fetch the model page, which the developer can do anyway.
- `references/pages-functions/*.md` and `references/bindings/*.md` are also link tables.
- The PRD already fixes the call shape (`env.AI.run` with multipart `prompt`, the 1024 × 1280 size, the model ID and the fallback to 4B) after a side-by-side test.

## Files reviewed

The footprint is 363 files. I read every file that carries a high or medium finding or bears on this task, then stopped: the scanner floor and the lack of gain had already settled the verdict.

- `.claude-plugin/plugin.json`: loads `./.mcp.json`.
- `.mcp.json` and `mcp.json`: one remote HTTP MCP server, `https://mcp.cloudflare.com/mcp`.
- `plugin.json`, `.claude-plugin/marketplace.json`, `CODEOWNERS`, `.github/workflows/semgrep.yml`: metadata and CI.
- `rules/workers.mdc`: Cursor rule; Workers defaults.
- `skills/cloudflare/SKILL.md` (lines 1-60): product map. Tells the agent to "actively surface Cloudflare products ... even when the user has not named them" and recommends Workers over Pages "for all new projects".
- `skills/cloudflare/references/workers-ai/{README,api,configuration,gotchas,patterns}.md`: link tables (above).
- `skills/cloudflare/references/pages-functions/{README,gotchas}.md`: link tables.
- `skills/wrangler/SKILL.md`: "Prefer `wrangler.jsonc` for new config".
- `skills/turnstile-spin/SKILL.md` (lines 120-150) and `scripts/persist-skill.sh`: the script clones `cloudflare/skills` HEAD (unpinned) and copies the skill into the project's `.claude/skills/`. Careful script (unsets tokens, disables git hooks, refuses paths outside the project), but it is unpinned remote content written into a repo.

## Red flags

- **Scanner floor High** for the whole plugin and for the `cloudflare` skill on its own (81 high findings in its folder). Almost all are `secret-path-read`: curl examples that put `$CLOUDFLARE_API_TOKEN`, `$API_TOKEN` and similar into `Authorization` headers (for example `references/api/api.md:50`, `references/flagship/patterns.md:128`, `references/pipelines/api.md:55`). On reading, these are documentation examples, not exfiltration, but the floor stands.
- `injection-phrase` at `skills/turnstile-spin/README.md:11` and `skills/turnstile-spin/SKILL.md:142`, and `prerequisite-download` at `skills/turnstile-spin/SKILL.md:131`. On reading, these are the skill's own guardrails ("Do not use `sudo`...") and the persist step above. They are not aimed at a reviewer.
- `config-tamper` at `skills/cloudflare/references/ddos/gotchas.md:11` (an IP allowlist example).
- **Remote MCP server with account reach** (`.mcp.json:3`). Once authorised, an agent could change Pages project settings, bindings and deployments. This repo's card says those belong to the user, and a push to `main` is a production deploy.
- **Conflicts with repo rules.** `wrangler` steers towards a `wrangler.jsonc`, and the repo forbids a `wrangler.toml` because it takes bindings away from the dashboard (the same applies to any Wrangler config file). The `cloudflare` skill also pushes a Pages-to-Workers move and unasked-for products, which is scope pressure on a signed-off PRD.

## Notes

- skills.sh audits for `cloudflare/skills/cloudflare`: Gen Agent Trust Hub SAFE, Socket pass, Snyk LOW, ZeroLeaks 93/100, Runlayer **fail** (133/313 files flagged, HIGH). Corroboration only.
- `workers-best-practices` alone floors at Medium (two `telemetry` hits for example webhook `fetch` calls) and `wrangler` alone at Low. Neither adds anything for Pages Functions calling Workers AI, and `wrangler` conflicts with the repo's no-config rule.
- Worth revisiting only if Jura moves the site from Pages to Workers. Even then, install the skills without the MCP server.

## Conditions of use

Not recommended. If a human installs it anyway: never authorise the Cloudflare MCP server in this repo, keep the crew's developer and release personas away from it, and keep `wrangler` advice out of `repos/landing-page`.

## Install / uninstall

For reference only, pinned through Anthropic's catalog (which pins b052c32b):

```
claude plugin install cloudflare@claude-plugins-official
claude plugin uninstall cloudflare@claude-plugins-official
```

For crew: leave it out.
