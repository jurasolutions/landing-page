# 02 — Audit the built toolbox against the PRDs

Status: ready-for-agent
Blocked by: none

## What

The toolbox shell, APP-001, the AI limiter, APP-002, and the scout's website pieces were built on the `toolbox` branch (commits `42b2bf8..4d276d1`) but never pushed. Before they ship, check each against the original intent of its PRD and list every gap, wrong behaviour or missing piece.

PRDs, the parts in this repo:

- `jurasolutions/prd/pending/prd-jura-app-factory-2026-10-24.md` §2 success criteria 1–5 and 7, §5.1–§5.5, §5.8 blocks 1–3 and their done-checks
- `jurasolutions/prd/pending/apps/prd-app-001-quote-builder-2026-10-24.md` §2–§5
- `jurasolutions/prd/pending/apps/prd-app-002-receipt-reader-2026-10-24.md` §2–§5
- `jurasolutions/prd/pending/prd-jura-scout-2026-10-24.md` §5.5 and §5.9

## Acceptance criteria

- [ ] `reviews/code-review-02.md` lists, per PRD, each success criterion and plan item as met, partly met, or not met, with the file and line that shows it.
- [ ] Every deviation that `README.md` already explains as a deliberate choice (for example `max_tokens` 4096, no `temperature`, the receipt reader held at `draft`) is judged on whether the reason holds, not flagged blindly.
- [ ] Each real gap is a numbered finding with a severity and a concrete fix.
