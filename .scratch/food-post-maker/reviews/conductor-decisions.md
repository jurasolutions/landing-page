# Conductor decisions on the spec reviews (2026-10-27)

Ting Yu asked for no questions, so the conductor settled every recommendation. These win over the
PRD and the reviews where they differ. Tickets 01 and 02 build to them.

## From the technical review
- P1 (`runAiTry` finish + status), P2 (per-tool readiness), B3 closed marker (`app_tries`,
  `visitor_hash '#site'`, `tool '#closed:food-post-maker'`), B4 ship with APP-001a: **accepted**.
- Retry: replaced by issue 01's rule (3 attempts on klein-9b, then one on klein-4b), because 9B
  failed ~40% of calls on 2026-10-27.

## From the functional review
- **B1** per-tool close before `takeTry`, `/limit` reports it: accepted (same as tech B3).
- **B2** faithfulness: accepted. A source photo of the dish wins: keep components, sauce or broth
  colour, vessel type and portion; styling changes only light, angle, surface and props. Add no
  component that is neither visible nor implied. One normal serving. Each post gets
  `basedOn: "photo" | "menu" | "name"`, and each card says "Drawn from your photo" / "Drawn from
  your menu" / "Drawn from the dish name", with the AI note on every card above its save button:
  "This picture is made by AI. Check it looks like what you serve before you post."
- **B3** deny-list: accepted with changes. Whole-word, case-insensitive, over the image prompt,
  caption, hashtags, alt text and the post's `dish`:
  brands: milo, coke, coca-cola, pepsi, 100plus, ribena, yakult, tiger, heineken, carlsberg,
  guinness, nescafe, nescafé, starbucks, mcdonald's, mcdonalds, kfc, maggi, nutella, oreo, biscoff,
  kit kat, kitkat, red bull, sprite, fanta, ovaltine, horlicks;
  claims: halal, vegetarian, vegan, healthy, michelin, award, award-winning, organic, sugar-free,
  promo, discount, `$` followed by a digit, `S$`, `%`.
  **"best" is not on the list** (it would trip "best enjoyed hot"); the system prompt forbids
  superlative claims instead. A claim word is allowed when it appears in the visitor's `mention`.
  A hit is a validation problem: repair once, then refund as invalid output. The `dishes` list
  (the owner's screen) may keep the menu's own names.
- **S1** text-only try: accepted. 0 to 3 photos; a try needs at least one photo or a non-empty
  `dish`. Reserve without image tokens when there are none.
- **S2** place type: accepted. Field `place`: `guess` (default) | `hawker` | `cafe` |
  `restaurant` | `bar` | `home`. Labels: Let us guess, Hawker or kopitiam stall, Café or bakery,
  Restaurant, Bar, Home-based business. When set it overrides Claude's guess; hawker means
  hawker-style vessels and surfaces, never slate, linen, wooden boards or fine-dining plating.
- **S3** share sheet: accepted. Where `navigator.canShare({ files: [jpg] })` is true the button
  reads "Save or share" and opens the share sheet; otherwise "Download picture".
- **S4** keep the last result for the session: accepted. `sessionStorage` through
  `_shared/storage.js`; if the pictures don't fit, keep the words and say the pictures were not
  kept. "Start again" clears it.
- **S5** retry a missing picture: covered by issue 01's retry and fallback.
- **S6** local names: accepted. Dish list keeps the menu's name as written (e.g. 肉脞面) with the
  common local or English name in the description; captions use the name a Singapore customer
  would search for ("bak chor mee"), never explained in brackets.
- **S7** hashtags: accepted. Dish, cuisine and kind of place; at most two location tags and only
  when the photos or fields show Singapore; no claim or brand; no repeats.
- **S8** business name only when typed: accepted.
- **S9** `no_food` copy: "We couldn't find any food in these photos. Add a photo of your menu or
  a dish, or type a dish name." Accepted.
- **N1** composition: the stylist rules ask for the dish centred with clear space above and below,
  so the square crop keeps it whole. **N2** hands: already in the suffix. **N3** privacy note adds
  "Photos of your menu and food work best. Leave out photos with customers in them."
  **N4** "signature" only when the menu or fields say it. **N5** dish order: the visitor's dish,
  then items the menu marks as signature, then menu order; at most 12. **N6** no promised time,
  likes, reach or sales anywhere on the page.

## After the scout and a quota hit (2026-10-27, later)

- **The account is on the Workers free plan.** Testing used up the day's 10,000 neurons. The real
  quota error is `AiError: AiError: you have used up your daily free allocation of 10,000 neurons,
  please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage. (<id>)`
  with code **4006**. Classify `4006` or /daily free allocation|neurons|upgrade to Cloudflare's
  Workers Paid/i as `cap`; code 3043 "Internal server error" as `unavailable`.
- **Default model is now `@cf/black-forest-labs/flux-2-klein-4b`** (about 130 neurons and
  US$0.0017 a 1024 x 1280 picture, so ~75 pictures a day on the free plan; 9B is ~1,420 neurons,
  ~7 a day). `AI_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-9b` switches to 9B once the
  account is on Workers Paid. Retry rule per picture: up to 3 attempts on the configured model
  (backoff ~300 ms then ~900 ms) on `unavailable`, then one attempt on the other klein model.
  Timeouts: 60 s for a 4B attempt, 30 s for a 9B attempt. Never retry on `cap`.
- **4B price**: US$0.000287 per 512 x 512 output tile, tiles counted as
  ceil(w/512) x ceil(h/512): 1024 x 1280 = 6 tiles = 1,722,000 nano-dollars. 9B: 15,621,440.
  Reserve the larger of the configured model's price and its fallback's per picture (9B's), settle
  what was drawn.
- **Closed marker uses the UTC day**, because Workers AI's free allocation resets at 00:00 UTC
  (08:00 SGT). Store it under `day` = the UTC date and check it the same way; `/limit` reports it.
- **Prompting (BFL guidance via the scout card `scout/flux-image-best-practices.md`):** FLUX has no
  negative prompts. Claude writes 40 to 80 words of plain prose per image prompt: the dish first,
  then the vessel and setting, then light and angle; no negations, no quoted words. The brand-safe
  suffix is phrased positively:
  " Photorealistic editorial food photography. Plain, unmarked, unbranded tableware and glassware;
  clean blank surfaces and a softly blurred background; the food is the only subject, with nobody
  in the frame."
  The skill itself is not installed: its value is this prompting advice, now captured here.
