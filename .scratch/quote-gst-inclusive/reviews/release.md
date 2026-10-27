# Release: quote builder, prices that include GST

Prepared by the release manager on 2026-10-28. Branch `crew/quote-gst-inclusive` at the merge commit `ca24c71` (after merging the current `origin/main` `7eb9414`), base `main`. Nothing has been pushed, merged or tagged. The conductor pushes the branch and opens the PR.

Recommendation: open a PR (option 2 below), and merge it only after you have read it.

## PR title

Add a Prices include GST option to the quote builder

## PR body

The same text is in `reviews/pr-body.md`; that file is the one to paste into `gh pr create --body-file`.

````markdown
## Summary

The quote builder can now price the way many Singapore shops, clinics and tutors do: one figure that already includes GST. With "Add GST" on, a new switch, "Prices include GST", sits under the rate. It is off by default, so nobody's quote changes until they choose it.

When the switch is on, the total is the amount after discount. The GST is worked out once, from that total, and shown as the part of it that is tax. It is never added on top.

```text
Prices exclude GST (as today)      Prices include GST (new)
Subtotal            159.80         Subtotal            159.80
Discount            -15.98         Discount            -15.98
GST (9%)             12.94         Total (SGD)         143.82
Total (SGD)         156.76           Total before GST  131.94
GST added at the                     Includes GST (9%)  11.88
rate shown                         Prices include GST
```

How it is put together:

```text
src/apps/quote-builder/
├── calc.js            # quote.gst.inclusive: GST = round half up (amount x rate / (100% + rate)), once
├── totals-rows.js     # new: one function decides which totals rows exist and what they say
├── QuotePreview.jsx   # draws the rows from totals-rows.js
├── pdf.js             # draws the same rows, so preview and PDF cannot drift
├── QuoteForm.jsx      # the switch and one helper line, only while Add GST is on
├── model.js           # default inclusive: false
├── quoteFile.js       # saved file version 1 -> 2
└── index.jsx          # "Remember my business details" keeps the choice
docs/adr/              # 0003 and 0004 record the two decisions
```

Two tickets built it. The first only moved the "which totals rows exist" decision into one place, with no change to what anyone sees (preview and PDF output were byte-identical before and after). The second added the feature on top.

## Things to know before you merge

**The request was ambiguous.** The request was "add a GST field", but GST was already on the quote builder: an Add GST switch, a rate (9% by default) and a registration number. The PRD records this as assumption A. I chose to read it as "make the GST setting more capable", and the smallest useful version of that is the include/exclude switch. The other options were:

- Per-line GST, so a quote can mix standard-rated, zero-rated and exempt lines. Larger, and it changes the line model. Left out, and listed as out of scope in the PRD.
- Another GST field, such as a second rate or a separate tax label. It would duplicate what is already there.
- Doing nothing, because the field exists. This does not help a visitor who prices GST-inclusive.

If assumption A is wrong, this PR is the thing to stop on. Everything else in the PRD's assumptions (default stays exclusive, the switch lives in the existing GST block, a bad stored value reads as exclusive) is cheap to change.

**The sign-off does not cover merging.** The PRD was signed off by a standing instruction to build, push the branch and open a pull request without asking. That instruction does not cover merging, and a merge to `main` is a production deploy. Please review this before you merge it.

**One PRD file lives outside this repo.** `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` is not part of this PR. Once this ships and you accept it, move it to `jurasolutions/prd/done/apps/` with the ship date at the top.

**No figure Jura cannot evidence was added.** The new wording holds no digit at all. The only number that can appear is the GST rate the visitor typed, which defaults to 9%. A test asserts the new strings contain no digit.

## Evidence

- **Before:** a price of 109.00 at 9% is read as before GST, so the builder adds 9.81 and the customer is quoted 118.81. A shop that quotes 109.00 all-in has to divide by 1.09 by hand first.
  **After:** with Prices include GST on, the total stays 109.00, shown as 100.00 before GST plus 9.00 GST.

```text
it("keeps the typed total and splits out the GST", () =>
  quote = one item at 109.00, GST on at 9%, inclusive
  totals = quoteTotals(quote)
  expect(totals.total).toBe(10900n)   // before: 11881n
  expect(totals.gst).toBe(900n)
  expect(totals.taxable + totals.gst).toBe(totals.total)
)
```

- `npm test`: 39 files, 735 tests pass (630 before, 105 new). Run again after merging the latest `main` into this branch.
- `npm run build`: exits 0, every route prerendered.
- Exclusive mode is unchanged to the cent. `calc.test.js` is untouched, and old and new `calc.js` give identical results over 116,784 exclusive quotes.
- Inclusive mode: before GST plus GST always equals the total exactly. A property run of 240,000 or more cases is part of the test suite. QA ran 600,000 more with seeds of their own, with no violations.
- QA drove the real app in Chromium at desktop and phone width, ran the 11 UAT scenarios (all pass), and looked at the PDFs as images. Details are in `.scratch/quote-gst-inclusive/reviews/qa-01.md`.
- Two code reviews approve with no blocking findings. The quality gate says GO.

## Merge Danger

**Door:** two-way.

Nothing is stored on a server, nothing is migrated and no setting changes. Rolling back is a revert, or the Pages dashboard's "Rollback to this deployment", which is instant.

**Blast Radius:** the quote builder only.

- **Saved files move from version 1 to version 2.** Files saved before this change still open and read as "prices exclude GST". Files saved after it carry the new choice. A copy of the old app that someone left open in a browser tab cannot open a version 2 file: it shows "That file doesn't look like a quote saved from this tool." and keeps the quote on screen. A refresh fixes it. The same applies if this change is rolled back after people have saved version 2 files.
- **The remembered business details** now include the choice. The old app ignores it, so a rollback is harmless there.
- **PDF layout.** When a GST split or statement prints, the gap above Notes is 14pt rather than 30pt. For exclusive quotes the layout is effectively unchanged, and page counts match `main` for 3 to 46 lines.
- Not tested: Safari and Firefox (no new browser API is used), a real screen reader, and two browser tabs open at once.
- Not changed, and noticed along the way: a blank or invalid GST rate still lets the PDF download, so an inclusive PDF can say "Includes GST (0%)" beside the red message on the form. Exclusive mode already behaves this way. It is worth a small ticket if you want it, but it is not part of this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019XQAhhdG1KGX41UyVBaT2o
````

## Release notes

For the people who use the quote builder:

- You can now tell the quote builder that your prices already include GST. Switch on "Add GST", then switch on "Prices include GST". The total stays the figure you typed, and the quote shows how much of it is GST.
- Every quote with GST on now says how its prices are quoted: "Prices include GST" or "GST added at the rate shown". With GST off, the quote prints as it does today.
- The choice is saved in the quote file and kept with your business details when you ask the builder to remember them.

There is no changelog in this repo and no tags (operating card), so these notes live here and in the PR.

## What changes for visitors

- A new switch under the GST rate, shown only while Add GST is on. It is off by default, so existing habits and quotes are unchanged.
- With the switch on, the totals read: Subtotal, Discount, **Total (SGD)**, then, in a quieter style, Total before GST, Includes GST (rate), and the statement. Preview and PDF show the same rows.
- With the switch off and GST on, the totals keep their order and gain one line: "GST added at the rate shown".
- With GST off, nothing changes at all.
- Quote files saved after this change are version 2. See the compatibility note.

## Migration and configuration check

None needed.

- Browser tier only. No change under `functions/`, no D1 migration, no new or changed environment variable, secret or Pages setting, no `wrangler.toml`, no feature flag.
- `package.json` and `package-lock.json` are not in the diff, so there is no new dependency and the version stays 1.0.0 by the repo's convention.
- `src/design-system/` and every other blocked path are untouched.
- No new `fetch`. The only network call the page makes is still the existing anonymous usage counter.

## Saved file compatibility, version 1 to version 2

| Case | Result |
|---|---|
| Version 1 file (saved before this change), opened in the new app | Opens, reads as "prices exclude GST", totals unchanged to the cent |
| Version 2 file, opened in the new app | Opens with the choice intact |
| Version 2 file with a malformed `inclusive` value (`"yes"`, `1`, `null`) | Opens as exclusive, no error |
| Version 3 or higher, or a non-integer version | Refused with the existing message, quote on screen unchanged |
| Version 2 file, opened in an older copy of the app (a tab left open since before the deploy, or after a rollback) | Refused: "That file doesn't look like a quote saved from this tool." The old reader accepts only version 1 and does not read the new field. This is deliberate (PRD section 4, ADR 0004): an old copy that opened the file would silently drop the choice and print a different total. A refresh loads the new app |
| Version 1 file written by a stale tab after the deploy | Opens as exclusive, which is the correct total for what that tab showed |

Remembered business details (browser storage) gain an `inclusive` boolean under `gst`. An older copy of the app reads only `on`, `rate` and `regNo`, so it ignores the new key without harm.

Not tested here: an old build opening a version 2 file. The refusal was read in the unchanged `version > FILE_VERSION` check, which `origin/main` still contains.

## Checklist

### Readiness

- ✅ Quality gate says GO. `quality-gate.md` was written at `0a1ab27`. Since then the branch gained only `.scratch/` records and a merge of `origin/main`. `git diff 0a1ab27 HEAD -- . ':!.scratch'` is empty, so the code the gate judged is the code that ships.
- ✅ Every code review approves: `code-review-01.md` (approve, two nits) and `code-review-02.md` (approve, no blocking or should-fix findings). There is no `code-review-final.md`. The gate accepted this and explained why: the two reviews together cover every changed line, and the final tree equals the ticket 02 tip.
- ✅ Branch up to date with its base, after one fix. Local `main` was stale (`69c736f`), and `origin/main` had moved to `7eb9414` (two commits that only add a crew-log entry for the receipt-misses feature). I merged `origin/main` into the feature branch as `ca24c71`. No file overlaps. Now 0 behind, 16 ahead of `origin/main`. Local `main` is untouched.
- ✅ Suite green after the merge: `npm test` -> 39 files, 735 tests passed; `npm run build` -> exit 0.
- ✅ No commit touches a blocked path (`src/design-system/`, `jurasolutions/design-system/`, `inputs/`, `.dev.vars`, `.env`, `dist/`, CI).
- ✅ No secrets. The added lines outside `.scratch/` were searched for secret, token, password and api key: no hits.
- ✅ Working tree clean after the merge.

### Package

- n/a Version bump: the convention is that `package.json` stays 1.0.0.
- n/a `CHANGELOG.md`: the repo has none (operating card). History is the commit log.
- ✅ Release notes: above.
- ✅ PR body: `reviews/pr-body.md`, from the PRD and the reviews, not the diff.

### Runtime

- n/a Migrations: none.
- n/a New configuration or environment variables: none.
- n/a Feature flags: none. The switch is a user control, and its default is off.
- ✅ What to watch after release: there is no server-side signal for this feature. For the first few days after the deploy, watch for visitors reporting that a saved quote "doesn't look like a quote" (stale tabs, expected to clear on refresh) and for any quote whose preview and PDF disagree. The anonymous usage counter does not record the choice.

### Rollback

- ✅ See the rollback plan below.

### Waivers and gaps for you

- Not run by you: the 10-minute UAT script in `reviews/uat.md`. QA ran all 11 scenarios in Chromium (desktop and phone) and every scenario passed, so waiving loses little. The gate names this as the one item only you can grant.
- Nit-level code review items are optional and open: an unnamed `14` layout constant in `pdf.js`, no `tabular-nums` on the totals figures, and a preview note a different size from the PDF's.
- The checker `jura-growth check` flags the rendered `Includes GST (9%)` on the rate the visitor typed. The source strings pass and no digit is in them. This is a false positive, not a published figure.

## Rollback plan

Rolling back is a two-way door. Pick the fastest that fits.

1. **Pages dashboard (fastest, no rebuild).** In Cloudflare Pages for `landing-page`, open the previous production deployment and choose "Rollback to this deployment". Nothing else needs to be undone. Afterwards, `main` still contains the feature, so the next push redeploys it. Follow with a revert (option 2) if you want it gone for good.
2. **Revert on `main`.** If the PR is merged with a merge commit: `git revert -m 1 <merge-commit-sha>`, push to `main`. If squashed: `git revert <squash-sha>`. If rebased: revert the range of code commits, newest first:
   `6f61b1a` (totals rows), `f771fef` (work out GST once), `6a7806e` (save, open and remember), `cfc4f6f` (the switch), `74bd311` (preview and PDF), `b55cbfb` (ADRs and README). Use `git revert --no-commit b55cbfb 74bd311 cfc4f6f 6a7806e f771fef 6f61b1a` (the non-merge commits only, newest first), then commit. That takes out the feature and leaves the `.scratch/` records.
3. **A revert on `main` is itself a push to `main`**, which is a production deploy. Raise it as a PR, or run the push yourself.

What a rollback does not undo:

- **Version 2 quote files already saved by visitors.** They sit on visitors' own disks. After a rollback the old app refuses them with "That file doesn't look like a quote saved from this tool." We cannot reach them. If this matters, the fix is to ship a reader that accepts version 2 (and ignores the field) before or instead of a full rollback.
- **Remembered business details with `inclusive: true`.** They stay in visitors' browsers and the old app ignores the key. Harmless.
- **PDFs and quote files already sent to customers.** They are documents, not data we hold. Those that state "Prices include GST" remain correct as printed.
- No server data, D1 rows, secrets or migrations are involved, so there is nothing to restore.

## Options for G4

The ship path here is a push to `main`, which Cloudflare Pages deploys to jurasolutions.sg. `gh` is not logged in on this Mac (2026-10-24), though `git push` works through the keychain.

1. **Merge locally into `main`.** Merges the branch into `main` on this Mac. Nothing ships until someone pushes `main`, and that push is the production deploy. Not recommended: it skips the PR review that the sign-off requires and puts an unreviewed merge on your local `main`.
2. **Open a PR (recommended).** The conductor pushes `crew/quote-gst-inclusive` and opens a PR into `main` with the title and body above. Cloudflare builds a preview deployment of the branch, so you can try the switch on a real URL. You then read it, optionally run the UAT, and merge when satisfied. Merging is the deploy. This matches your standing instruction (build, push the branch, open the PR) and stops short of what it does not cover.
3. **Keep the branch.** Leaves `crew/quote-gst-inclusive` as it is and ships nothing. Choose this if you want to rethink assumption A first.
4. **Discard.** Deletes the branch and its commits. It is not offered as a recommendation and runs only if you ask for it and type `discard` to confirm. The PRD in `jurasolutions/prd/pending/apps/` stays where it is.

## Needs your decision

1. **Is assumption A right?** The request "add a GST field" was read as the include/exclude switch. Recommended: yes, merge on that basis. Say so if you meant something else (per-line GST, for example, is a separate PRD).
2. **Merge, or hold?** Recommended: open the PR (option 2), try the preview deployment, then merge it yourself. Merging is not covered by the standing sign-off.
3. **Run the UAT yourself, or waive it?** Recommended: waive it. QA passed all 11 scenarios in a real browser and looked at the PDFs.
4. **Blank or invalid GST rate and the PDF.** Should the PDF download stop, or carry a warning? Recommended: leave as is. It matches exclusive mode and the PRD, and it can be its own small ticket.
5. **After shipping: move the PRD.** `jurasolutions/prd/pending/apps/prd-app-001b-quote-builder-gst-inclusive-2026-10-27.md` is outside this repo. It should go to `jurasolutions/prd/done/apps/` with the ship date at the top once the PR is merged and you accept it. The conductor or you can do this; it is not part of the PR.
6. **Stale local `main`.** Local `main` is two commits behind `origin/main`. Recommended: run `git pull` on `main` before any local merge.
