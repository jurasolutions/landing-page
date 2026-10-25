# Crew log: toolbox-prd-audit

## 2026-10-24T22:50+08:00 conductor

```
status:    done
persona:   conductor (intake)
ticket:    -
artifacts: docs/agents/crew.md, CLAUDE.md, .scratch/toolbox-prd-audit/{spec.md,issues/01,issues/02}
decisions: size M; spec = the pending PRDs (spec.md points at them), so interview and spec phases are skipped
           G0, G2, G4 pre-answered by Ting Yu: "check, development, test and push altogether, no need to come back to me"
           ship path = fast-forward main to crew/toolbox-prd-audit and push (Pages production build)
           ticket 01 (APP-003 build) and 02 (audit of the built toolbox) run in parallel
questions: -
evidence:  npm test -> 178 passed; npm run build -> ok; jura-growth check-copy (3 copy files) -> 300 of 300 pass
           origin/main = 619e252; toolbox 5 commits ahead, fast-forwardable
```

## 2026-10-25T01:55+08:00 reviewer (ticket 02, appended by conductor)

```
status:    done
persona:   reviewer
ticket:    02
artifacts: .scratch/toolbox-prd-audit/reviews/code-review-02.md
decisions: changes-requested on finding 1 (site cap leaks through refunds; block 3 done-check fails)
           README deviations (max_tokens 4096, no temperature, draft hold, limiter in server/) hold
questions: per-IP ceiling? rec AI_TRIES_PER_IP=6; Web Analytics on or drop privacy line? rec turn on
evidence:  npm test -> 178 passed; npm run build -> ok; probe cap 3 -> 10 calls; check-copy -> 304/304
```

## 2026-10-25T02:00+08:00 conductor

```
status:    done
persona:   conductor
ticket:    03, 04
artifacts: issues/03-ai-limiter-and-privacy-fixes.md, issues/04-toolbox-ui-and-standards-fixes.md
decisions: Ting Yu asked not to be consulted, so the reviewer's recommendations stand:
           AI_TRIES_PER_IP=6; Web Analytics is not on, so the privacy line goes until it is (README to-do)
           deferred: 14, 16 (design system at source), 17, U5, U8, U10
questions: -
evidence:  -
```

## 2026-10-25T16:50+08:00 developer, reviewer (tickets 01, 03; appended by conductor)

```
status:    done
persona:   developer (01, 03), reviewer (01, 03)
ticket:    01, 03
artifacts: merged crew/toolbox-prd-audit-01-app-003 (d104c94), crew/toolbox-prd-audit-03-ai-limiter (29c9c2d)
           reviews/code-review-01.md (approve), reviews/code-review-03.md (approve)
decisions: 01: APP-003 live; encrypted detection also by error message; split names pad to widest page number
           03: per-IP via app_tries tool '#ip', no migration; AI_ALLOW_DRAFTS gates draft APIs; app_calls never decremented; maxRetries 0
           should-fix items from both reviews go to ticket 05 after ticket 04 merges
           setup guide (outputs/growth/setup/toolbox-ai.md) gains AI_TRIES_PER_IP, AI_ALLOW_DRAFTS, Web Analytics step
questions: -
evidence:  merged branch: npm test -> 19 files, 250 passed; npm run build -> ok, 5 routes prerendered
           review 03 probes: cap 3 -> 3 API calls (was 10); 3 cookies 1 IP -> 6 then 429; draft API -> 404
```
