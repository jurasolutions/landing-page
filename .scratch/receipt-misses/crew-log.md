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
