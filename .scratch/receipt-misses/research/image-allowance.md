# Research: the Workers AI image allowance, and what else could draw the studio's pictures

Researcher, 2026-10-27. All sources checked on 2026-10-27 unless marked. Figures marked
**(est.)** are my arithmetic or an inference, not a vendor statement.

Assumptions for every per-try figure: 3 pictures at 1024 x 1280 (1.31 MP), up to 4 reference
images of at most 512 x 512 (each one 512 tile, about 0.26 MP), as in `server/image-gen.js`.
Claude Haiku's share of a try is not included.

---

## 1. Cloudflare Workers AI

### How the free allocation resets (documented)

- "Our free allocation allows anyone to use a total of 10,000 Neurons per day at no charge."
  "All limits reset daily at 00:00 UTC." "If you exceed any one of the above limits, further
  operations will fail with an error."
  https://developers.cloudflare.com/workers-ai/platform/pricing/
- On Workers Free, usage above the allocation is "N/A - Upgrade to Workers Paid". Nothing is
  billed on Free. Same page.
- The documented error for the cap is **3036** "Account limited" (HTTP 429): "You have used up
  your daily free allocation of 10,000 neurons". **4006 is not in the error table.**
  https://developers.cloudflare.com/workers-ai/platform/errors/
  `classifyImageError` still catches 3036, because its message regex matches "daily free
  allocation", so no code change is needed for that.

### How it actually behaves (observed, not documented)

- Open docs issue **cloudflare/cloudflare-docs #34137** (opened 2026-10-09, no Cloudflare reply,
  still open): two Free accounts got 4006 well after 00:00 UTC. Account 1 used 13,034 neurons
  at 23:32-23:36 UTC (the run was **not** stopped at 10,000). It then failed at 00:53, 04:09 and
  every 5 minutes until 23:47. It first succeeded at 23:51 the next day, **about 24 h 15 min
  after its last usage**. The reporter offers two explanations: a rolling 24-hour window, or
  overage carried into the next day. Neither is confirmed.
  https://github.com/cloudflare/cloudflare-docs/issues/34137
- Cloudflare Community threads with the same symptom (4006 after the reset while the dashboard
  shows 0/10k). Titles were seen in search; the pages returned 403 to my fetch, so I have not
  read their bodies:
  - https://community.cloudflare.com/t/workers-ai-4006-after-00-00-utc-reset-dashboard-shows-0-10k-neurons-used/963818
  - https://community.cloudflare.com/t/error-4006-daily-free-allocation-of-10-000-neurons-exceeded-with-0-real-usage-rec/946647
  - https://community.cloudflare.com/t/workers-ai-quota-still-exhausted-after-reset-while-dashboard-shows-0-10k/960125
  - https://community.cloudflare.com/t/workers-ai-returns-daily-quota-exceeded-while-dashboard-shows-remaining-neurons/972492

**What this means for us (est.):** enforcement lags behind usage, so a busy day can run past
10,000 neurons. On 2026-10-26 we ran to about 25,500, about 15,500 over. If the overage carries
over as a debt, it is larger than a whole day's allocation, so the tool could stay blocked
through 2026-10-27 UTC and into 2026-10-28. If it is a rolling window, the tool comes back about
24 h after the last call on 2026-10-26. Either way, **"closed until 00:00 UTC" is not a safe
promise on Free.** The tool should recheck before it reopens, not just trust the clock. On Free,
none of this is billed.

### Workers Paid

- "Minimum charge of $5 USD per month for an account." It covers Workers, Pages Functions, KV,
  Hyperdrive and Durable Objects. https://developers.cloudflare.com/workers/platform/pricing/
- Workers AI on Paid: "you will be charged at $0.011 / 1,000 Neurons for any usage above the
  free allocation of 10,000 Neurons per day." The 10,000 a day stays, and overage is billed
  instead of refused. https://developers.cloudflare.com/workers-ai/platform/pricing/
- I found no native spend cap for Workers AI neurons. AI Gateway has dollar spend limits
  (open beta, updated 2026-09-30) that return a 429 once a budget is reached:
  https://developers.cloudflare.com/ai-gateway/features/spend-limits/ . Our own
  `AI_DAILY_BUDGET_USD` reservation (ADR 0001) already acts as the ceiling.
- **Pages Functions:** "All Pages Functions are billed as Workers" and "All pricing and
  inclusions in this document apply to Pages Functions."
  https://developers.cloudflare.com/workers/platform/pricing/ ,
  https://developers.cloudflare.com/pages/functions/pricing/ . Upgrading the account covers the
  `env.AI` binding the Functions call. No code or config change is needed.
- Data: "Cloudflare does not use Customer Content processed by Workers AI to train AI models"
  and it keeps no inputs or outputs once a request is done.
  https://developers.cloudflare.com/workers-ai/platform/data-usage/ . The klein models are
  "Partner" models under BFL's terms
  (https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/).

### Cost of one studio try (list prices, pricing page above)

| Model | Per picture | Per try (3 pictures) | Tries in 10k free neurons |
|---|---|---|---|
| klein-4b: 6 output tiles x 26.05 + 4 input tiles x 5.37 neurons | 177.8 neurons, US$0.00196 | **533 neurons, US$0.0059** | **18** |
| klein-4b with 1 reference | 161.7 neurons | 485 neurons, US$0.0053 | 20 |
| klein-9b: 1,363.64 first MP + about 0.25 MP x 181.82 + about 1 input MP x 181.82 (est., pro rata) | about 1,591 neurons, about US$0.0175 | **about 4,773 neurons, about US$0.053** | **2** |

Note: the comment in `server/image-gen.js` says 10,000 neurons is "about 75 4B pictures against
about 7 9B ones". With 4 references at 1024 x 1280 it is about **56** 4B pictures and about **6**
9B pictures (est.).

---

## 2. Alternatives that can edit with reference images

All of these take a plain HTTPS `fetch` with a bearer key. None of the image-editing APIs below
has a free tier I could verify.

| Provider / model | Free tier | Paid price | Per try (est.) | Multi-ref | Data | Notes |
|---|---|---|---|---|---|---|
| **Replicate** `black-forest-labs/flux-2-klein-4b` | Not stated on the pricing page | $1 per 1,000 output MP and $1 per 1,000 input MP; p50 about $0.0015 a run (model page JSON) | **about $0.007** | up to 5 (`images`, URIs) | API inputs, outputs and logs "automatically removed after an hour" (https://replicate.com/docs/topics/predictions/data-retention); training not stated | Same model as ours; "Apache 2.0", commercial use allowed (https://replicate.com/black-forest-labs/flux-2-klein-4b) |
| **fal.ai** `fal-ai/flux-2/klein/4b/edit` | None stated (https://fal.ai/pricing) | "$0.01 per megapixel" (https://fal.ai/models/fal-ai/flux-2/klein/4b/edit) | about $0.04-0.06 (input charge not stated) | up to 4 `image_urls` | Payloads kept 30 days by default, or 0 with `X-Fal-Store-IO: 0`; media at least 7 days (https://fal.ai/docs/model-apis/data-retention); training not stated | Marked "Commercial use" |
| **Black Forest Labs API** (klein 4B) | None; prepaid credits by card, 1 credit = $0.01 (https://docs.bfl.ml/account_management/credits_billing.md) | $0.014 first MP; +$0.001 an extra MP per a BFL help article seen in search, rounded up; BFL's own table renders client-side, so I read $0.014/MP from OpenRouter's BFL endpoint listing | about $0.045 | up to 4 (OpenRouter), up to 10 for FLUX.2 editing (BFL docs) | Public privacy policy excludes business-offering content, which falls under customer agreements (https://bfl.ai/legal/privacy-policy); API retention not found | First party for the model |
| **Google Gemini API** image models | **Free tier "Not available"** for every image model (https://ai.google.dev/gemini-api/docs/pricing, updated 2026-10-27) | 3.1 Flash Lite Image about $0.0336 per 1K image; 3.1 Flash Image about $0.067 per 1K; Nano Banana 2.1 about $0.0336 per 1K | $0.10-0.20 | up to 14 (https://ai.google.dev/gemini-api/docs/image-generation) | Paid: not used to improve products; logged "for a limited period" for abuse (https://ai.google.dev/gemini-api/terms) | Different model, so the look differs; every image carries a SynthID watermark; 18+ and business use only; 2.5 Flash Image shut down 2026-10-02 |
| **Together AI** | None: no free trial, $5 minimum (https://docs.together.ai/docs/billing) | FLUX.2 pro $0.03/image, FLUX.2 dev $0.0154, Kontext pro $0.04/MP; **no klein** (https://www.together.ai/pricing) | $0.05-0.09 | per model | not checked | FLUX.2 [dev] weights are "non-commercial" (https://docs.bfl.ml/quick_start/pricing.md); check Together's licence before using dev |
| **Hugging Face Inference Providers** | **Free users: no credits** (buy credits); PRO: $2 a month (https://huggingface.co/docs/inference-providers/pricing) | Provider price passed through, "no markup" | the routed provider's price | the provider's | the routed provider's terms | Only a billing layer over fal, Replicate and others; nothing gained over going direct |
| **Pollinations** `black-forest-labs/flux.2-klein-4b` | `paid_only: false`; legacy keys get 1 pollen per IP per hour (https://github.com/pollinations/pollinations/blob/main/APIDOCS.md) | 0.005 pollen per image, flat (https://gen.pollinations.ai/image/models); about $1 a pollen per a third-party listing | about $0.015 | up to 10 | **Terms and privacy pages render empty without JavaScript, so I could not read them**; it is a reseller, and the upstream provider is not named | See section 3 |
| **OpenAI** gpt-image-1-mini / gpt-image-2 | No free tier listed | Tokens: image out $8 per M (mini), $30 per M (gpt-image-2) (https://developers.openai.com/api/docs/pricing) | not computed (needs OpenAI's calculator) | yes (edits) | not checked | Different model |

Latency: no vendor publishes a per-request latency I could cite. Replicate's p50 price at
$0.001525 a second implies about 1 s of compute (est.), plus queueing. Treat every provider's
latency as unknown until we measure it.

---

## 3. What is not acceptable

- **Extra Cloudflare accounts to get more 10k allocations.** Cloudflare Self-Serve Subscription
  Agreement (updated 2025-09-12) §2.2.1(c) bars use "intended to circumvent Service-specific
  usage limits, quotas, or other restrictions", and §2.2.1(e) bars producing multiple accounts by
  script. §8 allows immediate suspension or termination. https://www.cloudflare.com/terms/
  The account at risk is the one that serves jurasolutions.sg.
- **Extra Google projects or keys to stretch a limit.** Google APIs Terms §2(d): "You agree to,
  and will not attempt to circumvent, such limitations documented with each API."
  https://developers.google.com/terms . The Gemini free tier has no image models anyway.
- **Any unpaid tier that trains on inputs.** Gemini Unpaid Services use content "to provide,
  improve, and develop Google products" with human review, and say "Do not submit sensitive,
  confidential, or personal information" (https://ai.google.dev/gemini-api/terms). Visitors'
  product photos are their content, and this breaks Jura's promise that the client stays in
  control.
- **Unknown free proxies and community endpoints.** Example: the Pollinations catalogue lists a
  community model "Flux 2 Dev (FREE ; CONTRIBUTOR)" published by "My discord server", which
  states "Your prompts and completions are logged and are used to make internal datasets"
  (https://gen.pollinations.ai/image/models). Pollinations' own terms could not be read. Do not
  send customer photos anywhere whose retention we cannot read.
- **Self-hosting or reselling FLUX.2 [dev].** BFL lists it as "Open weights, non-commercial (no
  hosted API)" (https://docs.bfl.ml/quick_start/pricing.md).

---

## 4. Recommendation

**Move the Cloudflare account to Workers Paid and stay on klein-4b.** It costs the least for the
reliability it buys:

- It ends the 4006 lockouts, including the undocumented carry-over seen in #34137, because
  overage is billed instead of refused.
- It keeps one provider and one data processor that does not train or retain.
- It needs no code change; Pages Functions inherit the plan.
- `AI_DAILY_BUDGET_USD` stays as the spend ceiling.

Monthly cost (est.), 30 days, list prices, $5 base included, excluding Claude:

| Tries a day | klein-4b (533 neurons a try) | klein-9b (about 4,773 a try) |
|---|---|---|
| 10 | 5,330 a day, inside the free 10k: **$5.00** | (47,730 - 10,000) x $0.011/1k x 30 = $12.45 + $5: **about $17.45** |
| 50 | (26,650 - 10,000) x $0.011/1k x 30 = $5.49 + $5: **about $10.49** | **about $80.45** |
| 200 | (106,600 - 10,000) x $0.011/1k x 30 = $31.88 + $5: **about $36.88** | **about $316.70** |

Retries (up to 3 tries plus the fallback model per picture) and timed-out pictures add to these
figures.

**A fallback provider is not worth building now.**
- On Workers Paid, 4006 or 3036 should not occur, so the fallback would almost never run.
- It would add a second processor of customer photos, a secret, a second price table, and a
  different request shape (image URIs or uploads, async polling).
- If Ting Yu stays on Free, the only fallback worth considering is **Replicate klein-4b**: the
  same model, so the same look; about $0.007 a try; and inputs deleted after 1 hour. It still
  needs a card, and its training stance is unstated.

Gemini, fal and BFL cost 5 to 30 times more per try than Workers Paid overage.

Small follow-ups, whichever plan is chosen:
1. Treat a cap as "closed until a check succeeds", not "until 00:00 UTC".
2. Correct the "about 75 / about 7 pictures" comment to about 56 / about 6.
3. 3036 is the documented code; it is already caught by the message regex.
