# Receipt reader fixtures

Ting Yu's own receipt photos live in this folder **on his machine only**. They show
names, phone numbers, addresses and card digits, so `.gitignore` keeps every image here
out of git. Only `expected.json` is committed: what each photo should read as
(merchant, date, currency, total), with nothing personal in it.

They were run through the live tool on 2026-10-26, three photos a try, and all nine
matched `expected.json`. The set covers a Singapore supermarket, Singapore F&B (one
with handwriting on it, one half hidden behind a cup), a Malaysian receipt in ringgit,
two London receipts in pounds, and a page that is not a receipt.

To check again after changing the prompt, the schema or the model: open
`/apps/receipt-reader`, add the photos three at a time, and compare the results with
`expected.json`. That calls the real Anthropic API, so it uses tries and a little of the
day's budget. The automated tests cover the same paths with scripted model answers,
including the injection case, in `tests/receipt-reader.test.js` and
`tests/limiter.test.js`.
