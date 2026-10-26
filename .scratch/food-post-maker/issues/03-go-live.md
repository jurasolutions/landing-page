# 03 Go live: binding, live status, README, deploy, live check

Status: conductor
Blocked by: 01, 02

- Add the `AI` Workers AI binding to the Pages project's production config via the Cloudflare API.
- Registry `status: "live"`; README sections (endpoint, `AI` binding, `AI_IMAGE_MODEL`, the closed
  marker, the fallback, local dev with `--ai`), operating card test count.
- Final review, QA, quality gate, then merge to `main` and push (Ting Yu's G4 choice, given up front).
- Live check on jurasolutions.sg: menu photo, dish photo, shopfront + typed dish. Record results
  and any real Workers AI error text. Roll back on a broken tool.
