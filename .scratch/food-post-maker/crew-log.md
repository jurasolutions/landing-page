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

## 2026-10-27T04:00:00+08:00 developer (ticket 01, appended by conductor)

```
status:    done (one known failure, cleared by merging ticket 02)
persona:   developer
ticket:    01 (rebuilt to direction-change.md: product-photo-studio)
artifacts: branch crew/food-post-maker-01-server: P1 1d31795, P2 6d54ad3, e2257c8 image-gen, 4a5bfeb upload/ref checks, 6faa2ee prompt+schema+check, ea0162c registry, 7f14eec handler+closed marker, 1feafff ADRs 0001/0002
decisions: timeout ends that picture and keeps its price; repeated hashtags dropped, fewer than 5 distinct -> repair; claim words in the typed name count as owner-given; edit prompt checked only for TM/R/C and image numbers; closed check before Turnstile; shell.test.js unchanged
questions: -
evidence:  npm test -> 490/491 (only "folder for every registered tool", ticket 02's folder); npm run build -> exit 0; after P1 385/385, after P2 386/386; mutation check on all-pictures-failed -> caught
```

## 2026-10-27T04:10:00+08:00 developer (ticket 02, appended by conductor)

```
status:    done
persona:   developer
ticket:    02 (rebuilt as the Product photo studio)
artifacts: branch crew/food-post-maker-02-browser: 364e3c3 shared photo prep + session storage, 3e026a6 the page as a draft; src/apps/product-photo-studio/*, src/apps/_shared/{photos,storage}.js, registry, icons, content.js, tests/product-photo-studio-ui.test.js
decisions: image path moved to _shared/photos.js (1600 and 512 px from one decode); each frame keeps its own copy of the 3 captions; Start again confirms inline; business name stored with the result
questions: -
evidence:  vitest -> 29 files, 431 passed; build ok, pdf.js lazy only; jura-growth check 76 strings -> pass; Playwright with stubbed API -> 3 frames, both JPG sizes, share, copy, 422/503, reload restore, 360 px ok
```

## 2026-10-27T04:20:00+08:00 reviewer (ticket 01, appended by conductor)

```
status:    done
persona:   reviewer
ticket:    01
artifacts: reviews/code-review-01.md
decisions: changes-requested; B1 billing error: finally releases the held picture reservation after closeForToday; S1 claim words from name; S2 /\b4006\b/ matches inside a request id; S3 tests for finish throwing and billing-with-finish, stale comments
questions: -
evidence:  vitest -> 490/491 (expected ticket-02 folder test); build ok; repros for B1, S2, S1 confirmed
```
Conductor: fix round sent for B1, S2, S3; S1 kept as the developer built it (a claim in the owner's typed business name is owner-given).

## 2026-10-27T03:20:00+08:00 reviewer (ticket 02)

```
status:    done
persona:   reviewer
ticket:    02
artifacts: .scratch/food-post-maker/reviews/code-review-02.md
decisions: verdict approve: no blocking findings; contract matches 01 field for field; no blocked path touched
           should fix (6): focus lost on Keep/Clear (index.jsx:390,393); preview URL leak for photos removed while preparing (index.jsx:124-142, prepare.js:37); "Choose this one" label flips with aria-pressed (PostFrame.jsx:136-145); /privacy omits the tab-kept result (content.js:147); LimitArea copies receipt-reader's (index.jsx:31-46); pictureName re-implements safeFilename (compose.js:35-45)
           receipt-reader prepare refactor: behaviour unchanged; CONTEXT.md drift dismissed (base branch has the new glossary)
questions: -
evidence:  vitest (02) -> 29 files, 431 passed; vitest (01+02 trial merge) -> 537 passed
           npm run build -> ok, pdf.js lazy only
           jura-growth check --file (79 strings + privacy paragraph) -> pass
           security pass -> no findings; grep for unsafe sinks -> none
```

## 2026-10-27T04:40:00+08:00 developer fix round 01 + merge (appended by conductor)

```
status:    done
persona:   developer, then conductor
ticket:    01
artifacts: b030a77 B1 releaseHeld before closeForToday, 50c5c2b S3 tests, 58ddc7c S2 4006 only from code or leading code, 38db83e S1 comment+test, 662c60b nits; merged into crew/food-post-maker
decisions: conductor ratified the timeout rule (a timed-out picture ends and keeps its price); conductor read the B1 and S2 diffs instead of a second full review
questions: -
evidence:  developer: npm test 497/498 (ticket-02 folder test), build ok; B1 test red->green, removing the fix fails 2 tests
```

## 2026-10-27T05:00:00+08:00 conductor (ticket 02 fixes merged, ticket 03 go-live commit)

```
status:    done
persona:   conductor
ticket:    02, 03
artifacts: ticket 02 fix round e8808e4, fa8992c (all six should-fix items and nit 8) merged; 4ab403e registry live, README APP-004 section, limiter "second cost", env var AI_IMAGE_MODEL, AI binding, health check row, tests table, operating card test count
decisions: draft-404 test now injects a draft registry, as limiter.test.js does
questions: -
evidence:  npx vitest run -> 34 files, 546 passed; npm run build -> prerenders apps/product-photo-studio.html
```

## 2026-10-27T05:20:00+08:00 reviewer (final, appended by conductor)

```
status:    done
persona:   reviewer
ticket:    final
artifacts: reviews/code-review-final.md
decisions: approve; no blocking findings; contract, error codes and the pre-press closed state agree; receipt reader and quote builder unchanged in behaviour; no blocked path, no wrangler.toml, no secrets
           should fix (README only) S1 shared pieces list, S2 endpoint contract and Preview ready:false, S3 no_product wording: fixed by the conductor
           watch item: on the Workers free plan a 1102 at the live check would mean CPU
questions: -
evidence:  vitest 34 files 546 passed; build ok, prerendered head ok; jura-growth check pass; security pass 0 findings
```

## 2026-10-27T03:45:00+08:00 qa

```
status:    done
persona:   qa
ticket:    - (whole feature, PRD §2)
artifacts: reviews/qa-01.md; issues/04-defect-desktop-share-sheet.md; qa/regressions/{save-mode.test.js,vitest.config.js}; qa/*.png + dl-*.jpg (desktop 1280, phone 360)
decisions: browser cases on Vite dev with Playwright route stubs (fake Turnstile, /limit, POST answers with canvas-made 1024x1280 JPEGs); red test kept out of npm test until the fix; dev-only Choose-this-one border quirk not filed (prod build correct)
questions: defect 04 (desktop gets share sheet, no download): fix before the push? Recommend yes: share only on touch devices, a one-condition change in saveMode
evidence:  npm test -> 34 files, 546 passed; npm run build -> ok; jura-growth check (73 strings) -> pass
           C1 12/0, C2 5/0, C3 guard 1/0 (live only), C4 5/0, C5 6/1, C6 2/0, C7 guards 1/0 (live only), C8 1/0, C9 10/0, C10 3/0, other 6/0
           downloads 1080x1350 / 1080x1080 (sips); local no-AI -> ready:false, POST 503, other tools ready
           red test -> expected "download", received "share"
```

## 2026-10-27T05:45:00+08:00 conductor (defect 04 fixed)

```
status:    done
persona:   conductor (size-S fix in the main session)
ticket:    04
artifacts: src/apps/product-photo-studio/compose.js saveMode; tests/product-photo-studio-ui.test.js; .gitignore (.scratch/*/qa/); qa screenshots untracked
decisions: share sheet only on a handheld: userAgentData.mobile where Chromium gives it, else maxTouchPoints > 0; desktops and touch laptops download
           QA's red test moved into the suite; the separate regression config removed
           QA screenshots stay local (committed by accident in 59fc33c, now untracked)
questions: -
evidence:  without the fix -> "downloads on a desktop browser" fails; with it -> 49/49; npx vitest run -> 547 passed; build ok
```

## 2026-10-27T03:42:00+08:00 qa-lead (quality gate)

```
status:    done
persona:   qa-lead
ticket:    - (gate for 03)
artifacts: reviews/quality-gate.md
decisions: GO: gate rules 1-7 met on fresh evidence; strategy's F&B rows applied to studio C1-C10
           recommend holding the push to 08:00 SGT: live checks 9-11 and their rollback triggers need pictures
           rule 7 verified fresh (no infra.md exists); the gate is the record
           branch is 1 behind origin/main (646a1cb, no file changes): merge first; merged tree = tested tree
questions: push now or after 08:00 SGT? Recommend after 08:00, then run live checks 8-11 at once
evidence:  npm test -> 34 files, 547 passed
           npm run build -> exit 0, prerenders apps/product-photo-studio.html
           jura-growth check (67 copy.js strings) -> pass
           wrangler pages download config -> production ai binding AI present
           git merge-tree HEAD origin/main -> 10c2b7d = HEAD tree
           defects open -> 0 critical, 0 major, 0 minor (04 resolved, regression test green)
```

## 2026-10-27T05:55:00+08:00 conductor (G4: release)

```
status:    done
persona:   conductor (release)
ticket:    03
artifacts: reviews/quality-gate.md (GO); merge of origin/main; push to main
decisions: G4 = merge to main and push, Ting Yu's standing instruction ("push / publish the app on the website directly")
           pushed before 08:00 SGT rather than holding, as asked; a try before the Workers AI reset spends one Claude call, refunds the try and closes the tool until 00:00 UTC (tested path)
           tried to pre-set the closed marker in production D1; the permission check refused it, so it was not done
           release notes: APP-004 Product photo studio live at /apps/product-photo-studio; shared runAiTry finish step and per-tool readiness; the AI binding on Production; README; ADRs 0001-0002
           rollback: git revert -m 1 <merge> on main and push, or "Rollback to this deployment" on the previous production deployment in Pages
questions: -
evidence:  qa-lead gate -> GO, rules 1-7 met; npm test 547 passed; build ok
```

## 2026-10-27T06:00:00+08:00 conductor (push to main refused)

```
status:    blocked
persona:   conductor
ticket:    03
artifacts: origin/crew/food-post-maker pushed (a9ed8c8); reviews/release.md (PR body, rollback, live check)
decisions: the push to main was refused by the permission check, as with APP-001a; not worked around. The branch is on GitHub for Ting Yu to merge as PR #1 was
questions: Ting Yu: merge crew/food-post-maker into main (open the PR from reviews/release.md), then the live check runs after 08:00 SGT
evidence:  git push origin crew/food-post-maker -> new branch; git push origin crew/food-post-maker:main -> denied by the permission check
```

## 2026-10-27T00:45Z conductor (after release)

status:    done
persona:   conductor
ticket:    -
artifacts: PR #2 merged by Ting Yu (b79b838); PR #3 owner-network-unlimited (server/visitor.js, server/ai-tool.js, server/limit.js, tests/limiter.test.js, README.md); PRD amended
decisions: AI_UNLIMITED_NETWORKS (Pages secret) lifts the try and per-IP counts for Ting Yu's network; budget, call cap and Workers AI allowance still apply
questions: Workers Paid for the studio? recommended yes if it should be dependable; the free allowance is ~18 tries a day for the whole site
evidence:  vitest -> 550 passed; build -> prerenders product-photo-studio; /api/apps/limit?tool=product-photo-studio -> ready true, capReached true; receipt-reader -> capReached false
evidence:  Workers AI 00:40Z -> 4006 still; analytics -> 2026-10-26 used ~25,500 neurons (18:00Z hour), 3 calls refused since 00:00Z; free allowance did not come back at 00:00 UTC after the overage. Studio closed until 00:00 UTC 2026-10-28; live picture check moves to then
blocked:   wrangler pages secret put denied (Secret-Store Writes); Ting Yu sets it
