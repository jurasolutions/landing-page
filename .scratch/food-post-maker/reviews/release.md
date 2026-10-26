# Release: APP-004 Product photo studio

PR: https://github.com/jurasolutions/landing-page/pull/new/crew/food-post-maker (base `main`)

## PR body

Adds the product photo studio to the toolbox at `/apps/product-photo-studio` (APP-004,
`jurasolutions/prd/pending/apps/prd-app-004-product-photo-studio-2026-10-27.md`).

A visitor adds 1 to 4 product photos and, if they like, an instruction ("Remove the background
and put it on clean white"). One try gives three posts in frames styled like a social media
post, each with a picture drawn by Cloudflare Workers AI (FLUX.2 klein) from their own photos,
a caption they can swap or edit, and hashtags. Pictures save at 1080 x 1350 or 1080 x 1080.

- Shared AI plumbing: `runAiTry` takes an optional `finish` step, a second cost reserved with
  the try and settled after; readiness is per tool. The receipt reader and quote builder behave
  as before.
- The US$5 daily budget now covers the pictures too (ADR 0001). The product photos go to the
  image model as references (ADR 0002).
- A Workers AI quota error closes only this tool until 00:00 UTC (08:00 SGT).
- Needs the `AI` binding on Production, already added on 2026-10-27. No new secret.

Checks: 547 tests pass, build ok, ticket reviews and the final review approve, QA passes
(one defect found and fixed), quality gate GO.

Rollback: revert the merge commit on `main` and push, or "Rollback to this deployment" on the
previous production deployment in Cloudflare Pages.

## Live check after the deploy (from reviews/quality-gate.md)

After 08:00 SGT, when the Workers AI allowance has reset: `GET /api/apps/limit?tool=product-photo-studio`
answers `ready: true`; one try each with a product photo alone, two products with "Put these
products together in one picture", and a photo with "Remove the background and put it on clean
white"; check the three frames, the downloads and the copy; the receipt reader still reads.
