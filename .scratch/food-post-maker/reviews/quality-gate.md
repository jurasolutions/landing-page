# Quality gate: APP-004 Product photo studio

*QA lead, 2026-10-27 03:40 SGT (19:40 UTC on 26 October). Strategy: `reviews/test-strategy.md`, written for
the food post maker and applied here to the product photo studio as `reviews/direction-change.md`
directs. The criteria are the studio PRD's §2 C1 to C10, the same set `reviews/qa-01.md` traces.*

```
Decision: GO, with the push held until 08:00 SGT (00:00 UTC). Gate rules 1 to 7 all hold. The hold is about timing only: see "Push timing".
Branch: crew/food-post-maker @ f481078 (tree 10c2b7d)
```

## Exit criteria (gate rules 1 to 7)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Every coverage row has at least one passing automated case, named in a `qa-*.md` | met | `qa-01.md` traces C1 to C10. Every criterion has a passing automated case: C1 "input checks" in `tests/product-photo-studio.test.js`; C2 render tests plus Playwright 2a to 2e; C3 and C7 their server guards ("sends the prompt with the brand-safe suffix…", "the edit prompt check", 18 "claim words" cases), with the model's behaviour left to the live check, as the strategy's "partly" rows allow; C4 `tests/photo-studio.test.js`; C5 compose geometry, plus "downloads on a desktop browser, even one that can share files", which closed the one failure (5f); C6 to C10 as listed in qa-01. All pass in the fresh run below |
| 2 | Every case under R1 to R6 exists and passes | met | Checked by name in the fresh verbose run. **R1 money:** "reserves Claude's worst case and three pictures with the try, so a day that can't cover them refuses before Claude"; "goes ahead when the day covers exactly that, and settles to the real cost"; "answers with the post but no picture when one picture fails…, and settles only what was drawn"; "gives the try back with a 503 when no picture comes through"; the 4B and 9B price table; "reserves the dearer of the model and its fallback"; "uses AI_IMAGE_MODEL". **R2 Workers AI errors:** "reads the free plan's daily allocation error as cap"; "never reads a 4006 inside a request id as the cap"; "draws the three pictures at the same time"; "falls back to klein 4B after three failures on klein 9B"; the timeout keeps its price; in `tests/ai-run.test.js`, "keeps the whole reservation when the step throws… and gives the try back" and "releases the reservation once on an early exit". **R3 abuse:** "checks Turnstile before the try"; "draft tools answer 404 from the AI Function before Turnstile, the counter or the API"; "answers 503 before Turnstile or a try when the AI binding is missing, and /limit says not ready"; shared tries and the IP ceiling in `tests/budget.test.js` and `tests/limiter.test.js`. **R4 and R5:** "the edit prompt check" for ™ ® ©; "keeps the instruction inside the fields as data; a closing tag cannot end them early"; "extra fields are dropped". **R6 privacy:** "logs counts, cost and latency only"; "stores nothing that was uploaded, typed or made". **Regression:** `tests/shell.test.js` is unchanged and passes |
| 3 | `npm test` passes in full and `npm run build` succeeds; there is no typecheck or lint | met | Fresh run: 34 files, 547 tests passed. The baseline has grown from 385 to 547 tests. Build exit 0, with `apps/product-photo-studio.html` prerendered |
| 4 | `jura-growth check` passes on every new or changed string | met | Fresh run: 67 strings taken from `copy.js` → `pass`. `copy.js` and `src/content.js` are unchanged since QA's run of 73 strings and the final review's run of 74 strings plus /privacy, both `pass`. f481078 changes no copy |
| 5 | Zero open critical or major defects; minor ones listed with an owner | met | Issue 04 (major) is resolved in f481078. QA's red test is now in the suite and passes; with the fix taken out it fails (crew-log 05:45). I read the 12-line diff: phones and tablets get the share sheet, and computers, including touch laptops on Chromium, download. Open: 0 critical, 0 major, 0 minor |
| 6 | Every `code-review-*.md` verdict is approve, or its findings are closed | met | **01** asked for changes. B1 is fixed in b030a77 and tested ("leaves the day closed after a billing error"); S2 is fixed in 58ddc7c (the 4006 test above); S3 is fixed in 50c5c2b; S1 was settled by the conductor's ruling, with a test in 38db83e. **02:** approve, and its six should-fix items went in with fa8992c. **Final:** approve at 6145bef, and its three README points went in with 59fc33c. Two commits came after the final review. 59fc33c touches only README.md and `.gitignore`. f481078 is the fix for issue 04, which I read and checked under rule 5 |
| 7 | The `AI` binding is on the production Pages project before the push | met | Checked fresh with `wrangler pages download config landing-page`, run in the scratchpad and deleted afterwards. Production has `[env.production.ai] binding = "AI"` next to `d1_databases DB`. Preview has no `AI`, as the README says. The binding was added through the API (crew-log 02:45). `reviews/infra.md` was never written, so this gate is the record the rule asks for |

## Fresh run

- `npm test` → 34 files, 547 passed (2.2 s)
- `npx vitest run tests/product-photo-studio-ui.test.js` → 49 passed, including the defect 04 cases
- verbose run of `tests/product-photo-studio.test.js`, `photo-studio.test.js`, `image-gen.test.js`, `ai-run.test.js`,
  `limiter.test.js`, `budget.test.js` and `privacy.test.js` → every R1 to R6 case above shows ✓
- `npm run build` → exit 0; it prerenders `apps/product-photo-studio.html` "Product photo studio | Free tool from Jura Solutions"
- `uv run jura-growth check --file <copy.js strings>` (from `repos/growth`) → `pass`
- `npx wrangler pages download config landing-page` → production `ai` binding `AI` present; `ls wrangler.toml` in the repo → none
- `git merge-tree --write-tree HEAD origin/main` → 10c2b7d, the same tree as HEAD. The only commit on origin/main
  that the branch lacks (646a1cb, PR #1) changes no files. So merging origin/main deploys exactly the tree tested here

## Open defects

0 critical, 0 major, 0 minor.

The exploratory notes from qa-01 that were not filed stay as notes. None of them blocks:

- **E2:** a reload during the minute-long wait loses the result, and the try is spent. Owner: conductor, for a later ticket.
- **E6:** iOS Safari may refuse the share sheet after the asynchronous compose. If it does, the visitor gets a download to Files. Checked on the live check (step 10c).
- **E3** is in the read-only design system and shows under the dev server only. **E4** and **E5** are low-impact
  and need no change.
- Residual risk from the defect 04 fix: a touch-screen computer whose browser is not Chromium but can share files would
  still get the share sheet. No desktop browser in common use fits that today.

## Push timing: hold until 08:00 SGT (recommended, not a gate rule)

The Workers AI free allowance is used up until 00:00 UTC (08:00 SGT). A push now would put a listed,
public tool live that cannot be checked:

- Live checks 9, 10 and 11 need real pictures, so none of the rollback triggers below could fire for
  about four and a half hours.
- Each visitor try in that window would pay for one Claude call, then hit 4006. The try comes back and the
  studio closes itself until 08:00. That is a safe failure, but the quota path's real error text has
  never been seen in production. It is the one Workers AI path that has only been tested against a stub.

So push at or after 08:00 SGT, and run 8 to 11 straight away. If Ting Yu would rather push now, check 8
alone can run at once. That choice is his at G4.

## Before the push

The branch is one commit behind origin/main (646a1cb, which changes no files), so
`git push origin crew/food-post-maker:main` would be refused as not a fast-forward. Merge origin/main into
the branch first, or merge the branch into an up-to-date `main`. Either way the tree is 10c2b7d.

## Live check (rules 8 to 11), adapted to the product studio

Record the results in `reviews/qa-live.md`. Use desktop Chrome and one phone, an iPhone with Safari if
possible. Before the tries, read `app_spend` for today's SGT date from the remote D1 (`npx wrangler d1 list`
for the name, then `d1 execute <name> --remote --command "SELECT * FROM app_spend"`). Keep
`npx wrangler pages deployment tail` running to catch the `ai-tool` log lines.

**8. Ready.** `GET https://jurasolutions.sg/api/apps/limit?tool=product-photo-studio` answers `ready: true` and
`capReached: false`. The same call for `receipt-reader` and `quote-builder` still answers `ready: true`.
`/apps` lists "Product photo studio", and its page loads with the privacy note.

**9. Three real tries, plus one optional fourth.** This takes 3 or 4 of the 5 daily tries, and about 1,600
neurons (9 pictures) of the roughly 10,000 a day.

- a. One product photo on a plain table, with no instruction.
- b. Two product photos with "Put these products together in one picture".
- c. A product with a printed brand label, plus "Remove the background and put it on clean white"
  and a business name.
- d. Optional: a photo with no product in it, such as a desk. Expect 422, with the try still used.

Each of a to c must return three frames with pictures. The product must look like the photo: shape, colours
and label. The picture must add no text, logo, brand or person, and props must be plain. Each look must
differ, unless the instruction fixes one. Captions must name only brands printed on the product or typed
in, and make no claim the instruction did not give. Note the wall time for each try. An added brand or text
in a picture is a major defect.

**10. Files and captions.**

- a. On desktop Chrome, "Download picture" saves `<look>-portrait.jpg` at exactly 1080 x 1350 and
  `<look>-square.jpg` at 1080 x 1080 (`sips -g pixelWidth -g pixelHeight`). There must be no share sheet;
  this re-checks defect 04 on the live site.
- b. Choose Caption 2, edit it, press Copy caption and paste: you get exactly the edited text and its hashtags.
- c. On the phone, "Save or share" opens the share sheet and "Save Image" puts the picture in Photos. A
  download to Files instead is E6: record it as minor.

**11. Money.** The rise in today's `app_spend.nano_usd` must equal the sum of `cost_nano_usd` plus
`image_nano_usd` on the tries' log lines. Each drawn 4B picture should cost 1,722,000 plus 59,000 nano-dollars
per reference photo, which is US$0.00178 for one reference. The two figures must agree within a cent. Also
record the real neurons per picture, which the README estimates at about 180.

**Rollback triggers.** Roll back with Pages "Rollback to this deployment" on 646a1cb's production
deployment, which is instant, or revert the merge on `main` and push. Do it on any of these:

- Rule 8 fails: `ready: false`, the page does not load, or `receipt-reader` or `quote-builder` stops being ready.
- Rule 9: any of a to c answers 5xx twice running, a 1102 (CPU limit) appears, an added brand, text or
  logo shows in a picture, or a caption makes a claim nobody typed.
- Rule 10: a file has the wrong size, a desktop gets no download, or Copy caption copies the wrong text.
- Rule 11: D1 records less than the logged cost by more than a cent, which means the budget guard
  undercounts. If D1 records more than the logged cost, file a minor defect and keep the release.

## To turn this into a NO-GO

Nothing is open. The gate would flip only if the merge with origin/main produced a tree other than 10c2b7d.

## Waivers the user may grant at G4

- The push timing above: push before 08:00 SGT and accept a live check that waits.
- `reviews/uat.md` is still written for the food post maker. UAT is not a gate rule, and the live check
  covers its intent. The conductor should rewrite it for the studio before Ting Yu runs it, using qa-01's
  "Not tested here" list.
