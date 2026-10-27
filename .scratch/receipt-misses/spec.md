# Receipt misses and the image allowance

Ting Yu, 2026-10-27: clear receipt photos (Malaysian, Singapore and UK receipts from the macOS Photos
library) come back from the receipt reader as "We couldn't find a receipt in this image", and other
uploads fail with a generic error. Fix the cause, and make every error say what actually went wrong.
Also: find free or cheaper ways round the Cloudflare Workers AI free image allowance for the product
photo studio.

PRDs: `jurasolutions/prd/pending/apps/prd-app-002-receipt-reader-*.md` (or `prd/done/apps/`), and
`prd-app-004-product-photo-studio-2026-10-27.md`. This is a defect fix within APP-002's signed-off
scope, plus research for APP-004.
