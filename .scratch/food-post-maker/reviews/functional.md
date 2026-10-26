# Functional review: APP-004 Food post maker

*Reviewer: functional lead, crew run `food-post-maker`, 2026-10-27.*
*Spec: `jurasolutions/prd/pending/apps/prd-app-004-food-post-maker-2026-10-27.md` (cited as PRD §n, line n).*

Ting Yu signed off and asked for no questions, so every open decision below carries a recommended
answer. The developer should build the recommendation unless the conductor says otherwise. Wording
polish is left out; each finding changes what gets built or what gets tested.

## How an F&B owner actually uses this

The owner is on a phone, usually after service. They have one of these:

1. **Menu only.** A photo of the stall signboard or a printed menu. At hawker stalls and zi char
   places the board often carries prices, a halal certificate, "signature" stars and, sometimes,
   Chinese only.
2. **A rough dish photo.** Shot under a fluorescent tube, steamed up, half out of frame.
3. **Shopfront plus a typed dish.** The sign, the queue (people), and a dish name typed in.
4. **Nothing at all but the dish name.** Not supported by the PRD today (see S1).

They then want the picture in their phone's Photos, because the Instagram app picks from there, and
the caption on the clipboard. They will switch to Instagram between the first and second post. They
will judge the picture on one question: *does this look like what I serve?* A hawker owner shown
their chicken rice on slate with microgreens will not post it.

---

## Blocking

### B1. A Workers AI quota error must close this tool before the next Claude call (PRD §4 "Workers AI plan", line 81–83; §5.1 line 102–105)

The pictures are made *after* Claude has run and been paid for. On the Workers free plan the
quota is about 7 pictures a day, so roughly 3 tries across everyone. After that, every press:
spends Claude money on a try that cannot finish, and costs the visitor a try, because refunds are
bounded to one per visitor per SGT day (README "Refunds are bounded"). The visitor is told "used
up for today" only *after* pressing. The existing `closeForToday` closes every AI tool, which is
wrong here: the receipt reader and quote builder do not use Workers AI.

**Recommended answer.** On the first quota or plan error from Workers AI, record a per-tool
"closed for today" (for example an `app_spend`-style row keyed `#closed:food-post-maker`).
`GET /api/apps/limit?tool=food-post-maker` then answers `capReached: true` for this tool only, the
page shows its used-up notice before the visitor presses anything, and the Function refuses before
`takeTry`. Other AI tools stay open. Separately, the deploy step (§5.3) should state which Workers
plan the account is on; if it is the free plan, the release note says the tool allows about 3 tries
a day site-wide until the Paid plan is turned on.

**Acceptance.**
- Given Workers AI answers a quota error on a try, when the same or another visitor then opens the
  page, then the page shows the used-up notice, the button is disabled, and no request reaches
  Claude.
- Given that state, when a visitor opens the receipt reader, then it reports `capReached: false`
  and works.
- Given that state, when the SGT day rolls over, then the food post maker opens again.

### B2. The picture must follow the dish in the source photo, not the generic version of the dish (PRD §2 lines 33–35 and 44–48)

This is the truthfulness core of the tool. The PRD tells Claude to infer the dish "from its name,
the cuisine and what is visible", and to style it. It does not say what wins when they disagree.
Char kway teow, laksa, mee siam, chicken rice and nasi lemak each have several regional and
stall-specific versions. A generic picture of a dish the owner serves differently is a misleading
picture of their food, and the one-line note (line 51) does not undo that once it is posted.

**Recommended answer.** Add to the system prompt, and to `readPostOutput` where checkable:
- When a source photo shows the dish, the image prompt keeps what is visible: the components, the
  colour of the sauce or broth, the serving vessel type, and the rough portion. Styling may change
  the light, the angle, the surface and the props, never the food.
- The image prompt names no component that is neither visible nor implied by the dish name or the
  menu's description (no added egg, prawns, garnish or sides "to make it pop").
- Portion: one normal serving, never a sharing platter for a single dish.
- The schema gets one short field per post, `basedOn: "photo" | "menu" | "name"`, and the results
  card says which ("Drawn from your photo", "Drawn from the menu", "Drawn from the dish name") so
  the owner knows how much to check. Pictures drawn from a name alone are the ones most likely to
  differ.
- The AI note (line 51) appears on each post card, directly above Download, not once for the page.

**Acceptance.**
- Given a dish photo of char kway teow with visible cockles and a dark sauce, when the try
  completes, then that post's image prompt names cockles and a dark soy-coloured sauce, and the
  card says "Drawn from your photo".
- Given a menu-only photo listing "Chicken rice", when the try completes, then the image prompt
  names no ingredient beyond chicken, rice and the usual accompaniments for that dish (cucumber,
  chilli, soup), and the card says "Drawn from the menu".
- Given any result, then each post card shows the AI note above its Download button.

### B3. The brand and claims rules need a checkable list, must cover hashtags, and must say what a failed check does (PRD §2 lines 36–43)

Three gaps:
1. The server check (line 38) only catches ™ ® © and requests for text. Claude will never write
   "a can of Coca-Cola™"; it will write "a can of Coke". That check cannot fail in practice.
2. The caption rule (lines 40–43) does not mention hashtags. `#halal`, `#halalfood`, `#vegan`,
   `#healthy`, `#bestinsg`, `#michelin`, `#milo` and `#starbucks` are exactly the tags a model adds
   to food posts. A halal tag on a stall that is not MUIS-certified is a real harm in Singapore.
3. "Rejects" is undefined. It should be a validation failure, so it goes through the existing
   repair-then-refund path rather than a new one.

**Recommended answer.**
- A small deny-list in `server/food-posts.js`, matched case-insensitively on whole words in the
  image prompt, the caption, the hashtags and the alt text: common drink and food brands seen in
  Singapore F&B (Milo, Coke, Coca-Cola, Pepsi, 100Plus, Ribena, Yakult, Tiger, Heineken, Carlsberg,
  Guinness, Nescafé, Starbucks, McDonald's, KFC, Maggi, Nutella, Oreo, Lotus Biscoff, Kit Kat) plus
  claim words (halal, vegetarian, vegan, healthy, best, award, Michelin, organic, sugar-free,
  promo, discount, `$`, `S$`, `%`). A claim word is allowed when it appears in what the visitor
  typed in "Anything to mention", and the business name is allowed in the caption when typed.
- A hit is a validation problem: one repair, then the try is refunded as unreadable output, the
  same as any other invalid output.
- The dish *list* (results, line 27) may show the menu's own name ("Milo dinosaur"), because it is
  the owner's screen, not the post. The post's `dish`, caption, hashtags, alt text and file name
  use the generic name.

**Acceptance.**
- Given a menu photo listing "Milo dinosaur S$3.50" and a visible halal certificate, and an empty
  "Anything to mention", when the try completes, then no caption, hashtag, alt text or file name
  contains "Milo", "halal", "S$" or "3.50", and the dish list may still show "Milo dinosaur".
- Given "Anything to mention" = "Halal-certified. 1-for-1 kopi until 31 Dec", when the try
  completes, then a caption may say halal and 1-for-1 kopi until 31 Dec, and says no other price,
  offer or claim.
- Given a model output whose image prompt says "a glass of Coke", when `readPostOutput` runs, then
  it returns a problem, and a second bad answer gives a 502 `unreadable` with the try refunded.

---

## Should fix

### S1. Allow a try with no photo when a dish is typed (PRD §2 line 22, §1 line 15)

The problem statement promises "whatever the owner has". An owner with no usable photo at all
types a dish name, and the PRD then requires a photo anyway, so they upload anything just to get
past the form. **Recommended:** a try needs at least one photo *or* a non-empty "A dish to
feature". Text-only tries are cheaper (no image tokens to reserve). The `no_food` rule (line 113)
then reads: given a non-empty dish field, the answer is never `no_food` unless the field itself is
not food (for example "asdf"), which Claude judges.

### S2. Add an optional "What kind of place" field (PRD §2 lines 44–48)

The hawker, café, restaurant or bar choice drives the whole look, and a menu-only or dish-only
photo often does not show it. A wrong guess costs one of five tries and gives the "slate and
microgreens" picture a hawker owner rejects. **Recommended:** a select with "Let us guess"
(default), "Hawker or kopitiam stall", "Café or bakery", "Restaurant", "Bar", "Home-based
business". When chosen it overrides Claude's guess.
**Acceptance:** given "Hawker or kopitiam stall", then both image prompts name a hawker-style
vessel and surface (for example a melamine or enamel plate, a plastic or stone bowl, a marble or
laminate kopitiam table) and none of slate, linen, wooden board or fine-dining plating.

### S3. The owner must be able to get the picture into Photos on an iPhone (PRD §2 line 49, §5.2 line 124–125)

An `<a download>` on iOS Safari saves to Files, and the Instagram app picks from Photos.
**Recommended:** where `navigator.canShare({ files })` is true, the button reads "Save or share"
and opens the share sheet with the composed JPG (which offers Save Image and Instagram); elsewhere
it downloads. The picture on the card is the composed one in the chosen shape, so a long-press
also saves the right image.
**Acceptance:** given an iPhone with Safari, when the owner taps "Save or share" then "Save Image",
then a 1080 × 1350 (or 1080 × 1080) JPG is in Photos.

### S4. Keep the last result in the browser for the session (PRD §3 line 65–66)

The owner copies caption 1, switches to Instagram, comes back for post 2, and mobile Safari has
reloaded the tab: the try is spent and the posts are gone. **Recommended:** hold the last result in
`sessionStorage` through `storage.js` (browser only, so "storing anything on Jura's side" still
holds), restored on load, cleared by a "Start again" button. If the pictures do not fit the quota,
keep the captions and say the pictures need the try to be run again.

### S5. One missing picture: retry once on the server before answering (PRD §5.1 lines 111–113)

A try that returns one post without a picture costs the owner one of five tries for half a
result. **Recommended:** on a non-quota failure of one picture, retry that picture once, inside the
same request, if the budget covers a third picture. Only then return the post without `image`, and
the card says "This picture did not come through. The caption is ready to use." Quota errors are
not retried (B1).

### S6. Chinese-only and local-language menus (PRD §3 line 64–65)

English-only captions are in scope, but the *source* is often Chinese or Malay. **Recommended:**
the dish list shows the name as written on the menu, with the common English or local romanised
name in the description; the caption uses the name a Singapore customer would search for ("bak
chor mee", not "minced pork noodles"). Local dish names are never "explained" in brackets.
**Acceptance:** given a Chinese-only menu showing 肉脞面, then the dish list shows 肉脞面 and the
caption says "bak chor mee".

### S7. Hashtags: local where the place is evidently local, never invented (PRD §2 line 29)

**Recommended:** 5 to 10 hashtags made of the dish, the cuisine and the kind of place; at most two
location tags (such as `#sgfood`, `#sghawker`) and only when the menu, the fields or the shopfront
show Singapore (S$ prices, a Singapore address, local dish names). No tag carries a claim or brand
(B3). No tag repeats.

### S8. Do not read the business name off the shopfront (PRD §2 line 23, line 40)

A misread sign in a caption is worse than no name. **Recommended:** the caption uses the business
name only when typed; otherwise "we" and "our".

### S9. `no_food` needs words that tell the owner what to do next (PRD §5.1 lines 113–114)

The try is used (consistent with refusals), so the message must make the second try count:
"We could not find any food in these photos. Add a photo of your menu or a dish, or type a dish
name." **Acceptance:** given one photo of a receipt and empty fields, then the page shows that
message and tries left falls by one.

---

## Notes

- **N1. Square crop.** A centre crop of 1080 × 1350 to 1080 × 1080 removes 135 px top and bottom.
  "Room to crop" (line 47) is testable only if the image prompt asks for the dish centred with
  clear space above and below; add that to the brand-safe suffix or the stylist rules.
- **N2. Hands.** "No people" (line 37) should say "no people, hands or faces" in the suffix; food
  models often draw a hand with chopsticks.
- **N3. Faces in shopfront photos.** Queue photos send customers' faces to Anthropic. The privacy
  note can say "Photos of your menu and food work best; avoid photos with customers in them."
- **N4. "Signature" and "bestseller".** Menus mark these with stars. Picking the hero from them is
  fine; writing "our signature" in a caption is a claim the menu made, not the visitor. Treat as
  allowed only when the menu or fields say it.
- **N5. Which 12 dishes.** A 60-item menu returns 12 (line 27). Say which: the visitor's named
  dish first, then marked signature items, then menu order.
- **N6. Page copy and the numbers rule.** §1's "done in a minute" is internal. The tool page must
  not promise a time, likes, reach or sales.
- **N7. Domain language.** The PRD's "photos", "pictures", "fixed suffix" and "posts" match
  `CONTEXT.md` (source photo, picture, brand-safe suffix, post). No term is overloaded. Add
  `basedOn` (B2) and the per-tool close (B1) to `CONTEXT.md` when built.
- **N8. Out of scope, confirmed.** Posting or scheduling, reels, non-English captions, using the
  source photo as an image reference, text overlays and server-side storage are ruled out by §3.

---

## Edge cases

| Case | Covered by |
| --- | --- |
| Empty: no photo, no dish | Form blocks submit; with S1, a typed dish alone is enough |
| Empty: photo with no food | `no_food` 422, try used (S9) |
| Maximum: 3 photos of 4 MB, 400-char mention, 60-item menu | PRD §4 line 84–86; N5 for dish order |
| HEIC from an iPhone | Receipt reader's "share as a JPG" message, reused |
| Concurrent: double press, two tabs | Shared atomic limiter (README "Atomic") |
| Out of order: fields edited after results | Results stay until the next try; with S4, "Start again" clears |
| Permission denied: camera | FileDrop falls back to file picking |
| Quota reached mid-day | B1 |
| One or both pictures fail | S5; both fail is refunded, 503 (PRD line 112) |
| Data from before the change | Existing AI tools: shared tries count unchanged; `ready` for them must not depend on `env.AI` (PRD §5.1 line 107–108) |
| Brand or claim in source | B3 |
| Venue unclear | S2 |

## Acceptance criteria, testable form (PRD §2)

1. **Input.** Given the page on a phone, when the owner adds 1 to 3 JPG, PNG or WEBP photos (camera
   or files), then the main button enables; a 4th photo, a HEIC or a 5 MB file is refused with a
   message before any request. (With S1: a typed dish alone also enables it.)
2. **Output shape.** Given a menu photo listing at least 2 dishes, when the try completes, then the
   page lists 1 to 12 dishes and shows exactly two post cards, each with a 4:5 picture, a caption,
   5 to 10 distinct hashtags and alt text.
3. **Generated, never copied.** Given any try, then the Workers AI request body holds only
   `prompt`, `width`, `height`, and `prompt` ends with the brand-safe suffix (unit test on
   `image-gen.js`).
4. **Poor inputs.** Given each of: a menu only; a blurry, badly lit dish photo; a shopfront plus
   "Nasi lemak" typed; then the try returns two posts (not `no_food`), and the hero matches B2.
5. **No brands in pictures.** Given the UAT pictures, then none shows legible text, a logo, a
   label, packaging, a branded cup, can or bottle, a watermark, a person or a hand.
6. **No brands or claims in words.** B3's acceptance.
7. **Curation.** Given a dish typed in "A dish to feature", then post 1 features it. Given two or
   more dishes found and none typed, then the two posts feature two different dishes. Given one
   dish, then the two image prompts differ in angle or setting. Given a place kind (S2 or Claude's
   guess), then the props follow S2's rule.
8. **Download and copy.** Given a result, when the owner edits caption 1 and presses Copy caption,
   then the clipboard holds the edited caption followed by its hashtags. When they choose square
   and save, then the file is a 1080 × 1080 JPG named after the dish's generic name; portrait gives
   1080 × 1350.
9. **AI note.** Given a result, then each post card shows "These pictures are made by AI. Check
   they look like what you serve before posting." above its save button (B2).
10. **Limits.** Given a visitor with 1 try left, when they complete a try, then every AI tool shows
    0 tries left. Given both pictures fail, then the answer is 503 and tries left is unchanged.
    Given a try, then the day's budget is reserved Claude's worst case plus two pictures and
    settled to the real cost (unit test on the `finish` step). B1 covers the quota.
11. **Copy and privacy.** Given the tool's `copy.js` and the `/privacy` change, then
    `jura-growth check` passes on every string, and the privacy text names Anthropic (photos and
    text) and Cloudflare Workers AI (a text description only) and says nothing is kept.
