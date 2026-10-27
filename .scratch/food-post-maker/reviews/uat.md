# UAT script: APP-004 Food post maker

*For Ting Yu, or an F&B owner he trusts, on the live tool after the push to `main`. About 20
minutes. Pass means every "Expect" holds. The question behind every step: would you post this?*

## Before you start

- **Device:** an iPhone with Safari for steps 1 to 10, and a laptop for steps 11 and 12.
- **Tries:** the script uses 7 (steps 2, 4, 5, 6, 7, 8 and 11). Five is the daily allowance per
  person, so run steps 7 and 8 as a second person or on a second day, or ask the developer for a
  preview deployment with `AI_TRIES_PER_DAY=20` and the `AI` binding.
- **Photos to collect** (keep them out of git; they may show real shops):
  - **A.** A hawker stall signboard with at least 4 dishes and prices.
  - **B.** A blurry, badly lit phone photo of a plate of char kway teow (or any dish with clearly
    visible parts, such as cockles or a fried egg).
  - **C.** A shopfront photo of any food shop, ideally with its sign and a few people in view.
  - **D.** Two café photos: a latte and a croissant.
  - **E.** A menu that lists a Milo dinosaur or a Coke, shows prices, and shows a halal
    certificate.
  - **F.** A photo with no food in it, such as a receipt or a desk.

## Steps

| # | Do | Data | Expect |
|---|---|---|---|
| 1 | Open `jurasolutions.sg/apps`, filter by Food and beverage, open Food post maker. | none | The tool is listed. The page shows tries left and a privacy note that says photos go to Anthropic and only a text description goes to Cloudflare, and nothing is kept. |
| 2 | Add the signboard photo only. Leave every field empty. Press the main button. | A | A progress message, then a dish list read from the board, then two posts featuring two different dishes. The setting looks like a hawker stall, not a café. No price in either caption. |
| 3 | Look closely at both pictures from step 2. | A | No writing, logo, label, branded cup or can, watermark, person or hand. The dish is whole in the frame. Each card says the picture is made by AI and should be checked. |
| 4 | Start again. Add the blurry dish photo only. Press the button. | B | Post 1 is the same dish, with the parts you can see in your photo (for example the cockles), not a generic version. The card says it was drawn from your photo. |
| 5 | Start again. Add the shopfront photo, type "Nasi lemak with fried chicken wing" as the dish, leave the business name empty. Press the button. | C | Post 1 is nasi lemak with a chicken wing. The shop's name and sign appear nowhere, in the picture or the caption. No people in the picture. |
| 6 | Start again. Add both café photos. Business name "Little Fern Café", tone "simple and classy", emoji on. Press the button. | D | A café setting. One post is the latte, the other the croissant. The captions use "Little Fern Café" and a few emoji. |
| 7 | Start again. Add the menu with the brand, prices and halal certificate. Leave "Anything to mention" empty. Press the button. | E | The dish list may say "Milo dinosaur". No caption, hashtag or file name says Milo, Coke, halal, a price or "best". The drink is described plainly, such as "iced chocolate malt drink". |
| 8 | Start again. Same menu, and type "Halal-certified. 1-for-1 kopi until 31 Dec" in "Anything to mention". Press the button. | E | A caption may say halal-certified and the 1-for-1 offer until 31 Dec, in those terms, and adds no other offer, price or claim. |
| 9 | On a post from step 6, edit the caption, press Copy caption, paste it into Notes. | step 6 result | The pasted text is your edited caption followed by its 5 to 10 hashtags. |
| 10 | Choose square and save the picture, then portrait and save again. Open Instagram, start a new post. | step 6 result | Both pictures are in Photos (1080 × 1080 and 1080 × 1350), named after the dish, and Instagram can pick them. The square crop keeps the whole dish. |
| 11 | On the laptop, add the no-food photo only and press the button. | F | A plain message that no food was found, telling you to add a menu or dish photo or type a dish. Tries left drops by one. |
| 12 | Keep pressing until you have no tries left, then open the receipt reader. | any | The food post maker shows its used-up notice. The receipt reader shows the same tries left (0), because tries are shared. |

## Sign-off

For each of steps 2, 4, 5 and 6, write "would post" or "would not post" beside each picture, with
one line on why. The tool is accepted when no step fails and at least 6 of the 8 pictures are
"would post". A "would not post" because the food looks different from what the shop serves is a
failure of step 4's rule, and goes back to the developer even if the count is met.
