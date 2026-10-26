# 1. The picture cost shares the AI budget, reserved with the try

Date: 2026-10-27
Status: accepted
Context: APP-004 Product photo studio (`.scratch/food-post-maker/reviews/technical.md`)

## Context

Until APP-004, every AI tool made Claude calls only. The site's US$5 daily budget
(`AI_DAILY_BUDGET_USD`) reserved each call's worst case before it was sent and settled it to the
real cost from the API's token counts. The product photo studio adds a second, non-Claude cost
after Claude has answered: three pictures from Cloudflare Workers AI. Workers AI reports no usage
on a call, so there are no token counts to settle against.

## Decision

One budget covers all AI spend. `runAiTry` (`server/ai-run.js`) takes an optional `finish` step
whose worst case is reserved with the try, in the same atomic statement as Claude's reservation.
The step runs once Claude's output has validated and settles to what it really cost. Each
picture is reserved at the dearer of the configured klein model and its fallback, and settled at
the list price of the model that drew it, for its size and its reference images
(`server/image-gen.js`, prices dated 2026-10-27). A picture that was not drawn is released. A
timed-out picture keeps its price, since it may have been drawn. The pictures do not count
towards `AI_SITE_CAP`, because the try's one call already did.

## Consequences

- A try never pays for Claude and then finds no money left for its pictures.
- The budget errs high: the reservation is the dearer model's list price, and Cloudflare bills in
  neurons rather than in the list price. The price table needs updating when Cloudflare's prices
  change.
- Tools without a `finish` step behave exactly as before.

## Rejected

- A separate image budget: two ceilings to tune and explain, for one daily spend.
- Reserving the pictures after Claude answers: when the budget runs out between the two, the
  Claude call is wasted and the visitor loses a try for nothing.
