# Crew log: receipt-misses

## 2026-10-27T01:00Z conductor (intake)

status:    done
persona:   conductor
ticket:    -
artifacts: .scratch/receipt-misses/spec.md
decisions: route = bug (triage, repro, fix, review, release) for the receipt reader, plus a research spike (Workers AI allowance) run in parallel; G0 taken from Ting Yu's standing "no questions, make decisions, publish"
questions: -
evidence:  the three photos read by eye: all clear receipts (MYR SST, SGD GST, GBP VAT); server/receipts.js prompt has no country rule

## 2026-10-27T01:20Z conductor (triage)

status:    done
persona:   conductor
ticket:    01, 02
artifacts: reviews/triage.md, issues/01-server-receipt-reading.md, issues/02-browser-receipt-messages.md
decisions: label images, broaden "receipt", tie entries to images, lenient per-field validation, a free second look, error reasons; rate limit no longer reads as "used up"; HEIC native decode only (no LGPL lib)
questions: -
evidence:  live repro x2 with Ting Yu's 3 photos -> all read (intermittent miss); diff 646a1cb..b79b838 -> preparation unchanged in behaviour

## 2026-10-27T01:45Z researcher (image allowance)

status:    done
persona:   researcher
ticket:    -
artifacts: research/image-allowance.md
decisions: recommend Workers Paid ($5/mo minimum) on klein-4b; no fallback provider while on Paid; Replicate klein-4b is the only fallback worth building if the account stays on Free
questions: Workers Paid: Ting Yu's call (billing)
evidence:  docs say reset at 00:00 UTC, but cloudflare-docs #34137 shows overage blocking for ~24h after the last call (matches our 4006 at 00:40Z); no verifiable free image-editing tier elsewhere; multiple accounts or keys break Cloudflare's and Google's terms

## 2026-10-27T02:10Z developer (ticket 02)

status:    done
persona:   developer
ticket:    02
artifacts: branch crew/receipt-misses-02 (86ff346): receipt-reader read-state, copy, model, ReceiptResults, index, css, prepare; studio copy and prepare; UI tests; tests/helpers/browser-image.js; README
decisions: studio gets its own refused/rejected/bad_output/busy/offline words and HEIC decode; fromApi maps image n to the n-th preview; an answer without an image number falls back to the old sentence
questions: -
evidence:  npm test -> 35 files, 580 passed; npm run build -> built; jura-growth check -> 16 strings pass (photo numbers kept as {n})

## 2026-10-27T02:30Z developer (ticket 01)

status:    done
persona:   developer
ticket:    01
artifacts: branch crew/receipt-misses-01 (6a97c02): server/receipts.js, server/receipt-reader.js, server/ai-run.js, header comments in product-photo-studio.js and quote-drafter.js, tests, README
decisions: second look as the finish step (reserved with the try, counts toward AI_SITE_CAP); a failing field becomes null; an entry with a bad is_receipt or image number is dropped and its image gets the second look; unmentioned image → problem "other"
questions: quote builder now shows "unavailable" for bad output → fixed by the conductor (8c8b2a0)
evidence:  npm test -> 597 passed; npm run build -> built

## 2026-10-27T02:40Z conductor (merge)

status:    done
persona:   conductor
ticket:    01, 02
artifacts: crew/receipt-misses with both tickets merged; 8c8b2a0 quote builder words + image-gen comment
decisions: quote builder maps reason bad_output to its own "couldn't draft" words and 503 busy to a busy sentence
questions: -
evidence:  vitest -> 618 passed; build -> built in 1.67s; jura-growth check -> pass

## 2026-10-27T15:30Z reviewer

status:    done
persona:   reviewer
ticket:    01, 02
artifacts: .scratch/receipt-misses/reviews/code-review-01.md
decisions: approve: no blocking findings; limiter/budget invariants hold (second look reserved with the try, counted to AI_SITE_CAP, settled); validation and object URLs sound
questions: lone-image renumber (S1) and photo numbering (S2): fix before release? recommend yes, both small
evidence:  npm test -> 618 passed; npm run build -> built; scratch probe -> calls=2 on second look, renumbered lone image drops the receipt; jura-growth check -> 17 templates pass

## 2026-10-27T03:30Z developer (review fixes)

status:    done
persona:   developer
ticket:    code-review-01 S1–S5
artifacts: branch crew/receipt-misses-03 (371739d): readSecondLook (one image → every entry), photoNumbers + FileList.jsx ("Photo n" in list and cards), stale comment, README, attemptDecode in _shared/photos.js
decisions: S6 PRD line added by the conductor
questions: -
evidence:  npm test -> 625 passed; npm run build -> built; S1 tests red first then green

## 2026-10-27T04:10Z qa-engineer (local run, appended by the conductor)

status:    done
persona:   qa-engineer
ticket:    01, 02
artifacts: reviews/qa-01.md, issues/03-defect-not-counted-on-first-visit.md, qa/ (stand-in, red test; shots git-ignored)
decisions: env passed as wrangler --binding values, no .dev.vars written; studio mapping checked with browser stubs
questions: photo number vs upload list → already fixed by review S2 ("Photo n" numbered by files sent, in list and cards)
evidence:  ticket 01: 14 pass, 1 unit-test only; ticket 02: 27 pass, 1 fail (issue 03), 1 unit-test only; jura-growth check: 16 strings pass

## 2026-10-27T04:30Z conductor (merge S1–S5, fix defect 03 and QA findings)

status:    done
persona:   conductor
ticket:    03
artifacts: server/ai-run.js (`counted` on every failure after a try), receipt-reader read-state, quote-builder draft + copy (offline words), server/receipts.js combineReadings, ReceiptResults card title, tests/not-counted.test.js (QA's red test, now green), 28 exact-body assertions given `counted`
decisions: pages trust `counted` over comparing counts; a second look with no specific reason keeps the first reading's; a missed photo's card is titled "Photo n", never a guessed merchant; quote builder names a lost connection
questions: -
evidence:  vitest -> 630 passed (36 files); build -> built in 1.69s; jura-growth check -> pass

## 2026-10-27T04:45Z conductor (quality gate and release notes)

status:    done
persona:   conductor
ticket:    -
artifacts: reviews/quality-gate.md (GO), reviews/release.md, README `counted` note, crew card test count
decisions: live check in production after the merge (preview has no AI secrets); G4 = PR, Ting Yu merges (merge to main is blocked for the agent)
questions: -
evidence:  vitest -> 630 passed; build -> built
