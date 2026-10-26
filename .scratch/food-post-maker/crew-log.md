# Crew log: food-post-maker

APP-004 Food post maker: menu or dish photos in, two AI-generated Instagram pictures with captions out.

## 2026-10-27T02:40:00+08:00 conductor (intake, size M)

```
status:    done
persona:   conductor
ticket:    -
artifacts: PRD jurasolutions/prd/pending/apps/prd-app-004-food-post-maker-2026-10-27.md; CONTEXT.md; .scratch/food-post-maker/spec.md
decisions: G0-G4 opened by Ting Yu's request ("do not ask me further questions make your own decisions and push / publish the app on the website directly"); "use crew" sent mid-turn
           size M; route M with spec reviews, tickets, developer, reviewer, QA, gate, release
           branch crew/food-post-maker from crew/quote-ai-draft (APP-001a, signed off with push, not yet on main): it carries the shared server/ai-run.js; both ship together
           images: Workers AI flux-2-klein-9b, 1024x1280, after a side-by-side test (9B best realism, ~3 s; 4B fine but ~10-26 s; schnell weakest)
           the visitor's photo never goes to the image model: Claude writes a text description instead (no logo carry-over)
           Claude: Haiku 5.5 as the other AI tools; image cost folded into the US$5 budget
questions: -
evidence:  wrangler whoami -> logged in, pages+ai write; Pages production has DB binding and the AI env vars, no AI binding; preview has no env vars
           Workers AI REST test -> klein-9b 3.4 s, klein-4b 10.5 s, schnell 2.4 s; images reviewed by eye
           klein-9b reliability -> 500 code 3043 on ~40% of calls (3/6 parallel, 2/6 sequential), each < 1 s; klein-4b 8/8 ok at 12-26 s
```

## 2026-10-27T02:55:00+08:00 qa-lead (restored by conductor; the functional lead's write replaced the log)

```
status:    done
persona:   qa-lead
ticket:    -
artifacts: .scratch/food-post-maker/reviews/test-strategy.md
decisions: seams from PRD 5.1: unit on pure modules; Function tests with sql.js D1, installNetwork, env.AI stubbed; UI via renderToStaticMarkup; live check after deploy
           model judgement and real canvas/clipboard checked only at the live check
           risks R1 picture cost vs budget, R2 Workers AI error classes
           fnb-only registry entry breaks shell.test "every tool General": change on purpose
           exit criteria: gate rules 1-7 before push; live rules 8-11 after deploy, 8-10 failing means rollback
questions: -
evidence:  npx vitest run -> 28 files, 385 tests passed
```

## 2026-10-27T02:58:00+08:00 tech-lead (restored by conductor)

```
status:    done
persona:   tech-lead
ticket:    -
artifacts: .scratch/food-post-maker/reviews/technical.md
decisions: go after prefactors P1 (runAiTry finish + status) and P2 (aiReady(env, tool), TOOL_NEEDS)
           S2 env.AI faked by fakeAi() in tests/helpers/ai.js
           B3 Workers AI quota closes only this tool for the SGT day ('#site', '#closed:food-post-maker'); not closeForToday
           B4 ships with crew/quote-ai-draft in one push
questions: -
evidence:  npm test -> 28 files, 385 tests passed; git show main:server/ai-run.js -> absent
```

## 2026-10-27T00:00:00+08:00 functional-lead

```
status:    done
persona:   functional-lead
ticket:    -
artifacts: .scratch/food-post-maker/reviews/functional.md, .scratch/food-post-maker/reviews/uat.md
decisions: B1 Workers AI quota closes this tool only, before takeTry, because Claude spend and bounded refunds otherwise burn on every press after ~3 tries/day on the free plan
           B2 picture keeps what the source photo shows (components, sauce, vessel, portion); styling changes light/angle/props only; per-post basedOn label; AI note on each card
           B3 brand/claim deny-list over image prompt, caption, hashtags, alt text, file name; a hit is a validation problem (repair, then refund); claim words allowed only when typed
           S1-S9 recommended answers recorded in functional.md (text-only try, place-kind field, iOS share sheet, sessionStorage result, one picture retry, Chinese menus, local hashtags, no name from signboard, no_food wording)
questions: -
evidence:  read PRD, CONTEXT.md, crew.md, README toolbox/limiter/APP-002, design-system README §3, server/ai-run.js, server/ai-tool.js -> closeForToday is site-wide, so B1 needs a per-tool close
```

## 2026-10-26T18:34:49Z skill-scout

```
status:    done
persona:   skill-scout
ticket:    -
artifacts: .scratch/food-post-maker/scout/flux-image-best-practices.md
           .scratch/food-post-maker/scout/cloudflare.md
decisions: flux-image-best-practices (black-forest-labs/skills@8907d51) -> recommend with conditions, Low: FLUX's own maker; klein prose, no-negative-prompt rules shape the Haiku system prompt; skill folder only, never the plugin (bundles bfl-api, floor High)
           cloudflare (cloudflare/skills@b052c32) -> don't recommend, High: floor High; Workers AI/Pages refs are link tables only; remote MCP reaches the account; wrangler config conflicts with repo rule
           captions, canvas composition -> nothing worth it: only low-signal packs and "superpowers" look-alikes; claude-api, frontend-design, vercel-react, design system cover it
questions: -
evidence:  scan.mjs flux-image-best-practices/ -> 15 files, floor Low, 0 high/0 medium
           scan.mjs black-forest-labs/skills (whole) -> floor High (bfl-api, build)
           scan.mjs cloudflare/skills/cloudflare -> 289 files, floor High (81 high)
           claude plugin details cloudflare -> 14 skills, 1 MCP, ~1,033 always-on tok
           skills.sh audit BFL skill -> Trust Hub SAFE, Socket pass, Snyk LOW
```

## 2026-10-27T02:40:00+08:00 conductor (spec reviews settled, G2 and G3)

```
status:    done
persona:   conductor
ticket:    -
artifacts: .scratch/food-post-maker/reviews/conductor-decisions.md; issues/01-server.md, 02-browser.md, 03-go-live.md
decisions: G2 and G3 opened by Ting Yu's standing instruction; every review recommendation settled in conductor-decisions.md
           functional B1-B3, S1-S9 accepted (B3 without "best"); tech P1, P2, B3, B4 accepted
           default image model flux-2-klein-4b (account is on the Workers free plan: ~75 pictures a day vs ~7 for 9B); 9B by AI_IMAGE_MODEL after an upgrade
           positive-phrased brand-safe suffix per BFL prompting guidance (scout card); skill not installed
           tickets 01 server and 02 browser run in parallel to one response contract; 03 go-live is the conductor's
questions: -
evidence:  Workers AI -> 4006 "used up your daily free allocation of 10,000 neurons" after testing; resets 00:00 UTC (08:00 SGT)
```

## 2026-10-27T02:45:00+08:00 conductor (infra: AI binding)

```
status:    done
persona:   conductor (infra step of ticket 03)
ticket:    03
artifacts: Cloudflare Pages project landing-page, production deployment config
decisions: added ai_bindings {"AI": {}} to production via PATCH /accounts/:id/pages/projects/landing-page with the logged-in wrangler OAuth token; no secret touched; takes effect on the next deploy
questions: -
evidence:  PATCH -> success; production now ai_bindings AI, d1 DB, the same 11 env var names as before
```

## 2026-10-27T03:00:00+08:00 conductor (direction change)

```
status:    done
persona:   conductor
ticket:    01, 02
artifacts: reviews/direction-change.md; PRD renamed to prd-app-004-product-photo-studio-2026-10-27.md and rewritten; CONTEXT.md; spec.md
decisions: Ting Yu changed APP-004 to a general product photo studio: 1-4 product photos + instruction with example prompts, 3 posts per try in social-post frames, caption choice and edit
           photos now go to the image model as references (reverses the "photo never reaches the image model" decision); own product branding kept, nothing added
           slug product-photo-studio, industries general/retail/fnb; feature folder keeps its name for history
           both running developers redirected by message, P1/P2 commits kept
           APP-001a reached main via PR #1 (646a1cb), so tech B4 is resolved
questions: -
evidence:  git log origin/main -> 646a1cb Merge pull request #1 from jurasolutions/crew/quote-ai-draft
```
