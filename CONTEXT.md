# Context: the Jura Solutions website and toolbox

The words this repo uses, so code, specs and tickets mean the same thing.

## Toolbox

- **Tool**: one free app under `/apps/<slug>`, listed in `src/apps/registry.json`.
- **Tier**: `browser` (nothing leaves the visitor's browser) or `ai` (a Pages Function calls a model).
- **Try**: one press of an AI tool's main button that reaches the model. Five a visitor a day, shared across AI tools.
- **Budget**: the site's daily spend on AI calls, US$5 by default, reserved before each call and settled to the real cost after.
- **Repair**: one free second call that asks the model to fix output that failed validation.

## Quote builder (APP-001)

- **GST on**: the quote charges GST at the rate the visitor types (9% by default). GST is off until the visitor switches it on.
- **Amount after discount**: the line totals added up, minus the whole-quote discount. GST is worked out on it in both modes.
- **Prices exclude GST**: the default. The visitor types prices before GST and the builder adds GST on top of the discounted subtotal.
- **Prices include GST**: the visitor types prices that already contain GST. The builder works out how much of the discounted total is GST and shows it, but the total does not change.
- **Total before GST**: the amount after discount when prices exclude GST, and the amount after discount minus the GST in it when prices include GST. In both modes, before GST plus GST equals the total to the cent.
- **Access code**: a random 16-character code Ting Yu hands to chosen people. Typed into the quiet "Access code" button at the foot of `/apps`, it makes that browser's AI tries unlimited for 90 days. The daily budget still applies.

## Product photo studio (APP-004)

- **Product photo**: a photo the visitor uploads of something they sell. Read by Claude and, as a reference of at most 512 px, passed to the image model.
- **Instruction**: what the visitor writes about how the picture should turn out ("remove the background").
- **Post**: one picture with its look, caption, hashtags and alt text. A try returns three.
- **Look**: the two-to-four word name of a post's styling ("Clean white studio").
- **Edit prompt**: Claude's text telling the image model how to restyle the reference images. Never shown to the visitor.
- **Brand-safe suffix**: the fixed text the server appends to every edit prompt: keep the product as it is, plain unmarked props, nobody in frame.
- **Frame**: the results card styled like a social media post (header, picture, action row, caption), with no Instagram branding.
- **Closed for today**: a per-tool marker set by a Workers AI quota error, cleared at the UTC day's turn when the free allowance resets.
- **Picture**: the AI-generated image, 1024 x 1280 from the model, composed in the browser to 1080 x 1350 (portrait) or 1080 x 1080 (square).

## Invoice builder (APP-005)

- **Invoice**: the document the visitor issues to bill a customer. Titled "Invoice" while GST is off and "Tax invoice" while GST is on, never anything else.
- **Tax invoice**: an invoice with GST on. It prints the GST registration number, the GST rate, the amount before GST, the GST and the amount with GST.
- **Required fields**: what a tax invoice must carry before "Download PDF" makes a file: business name, business address, GST registration number, customer name, customer address, invoice number, invoice date, a GST rate from 0 to 100, at least one counted item, and a description on every counted item. Checked only while GST is on. A field counts as missing when nothing of it would print: empty, spaces only, or only characters the PDF can't print. A counted item has a quantity above zero; items with no quantity are left off the invoice.
- **Amount before GST**: the invoice's amount after discount (line totals added up, minus the overall discount). GST is worked out on it once, rounded half up to the cent.
- **Amount with GST**: amount before GST plus GST, to the cent. It is also the invoice's total while GST is on.
- **Invoice file**: the JSON file "Save invoice file" writes and "Open invoice file" reads. It holds everything on the invoice, including the logo, and re-opens to an identical invoice.
- **Quote file**: a file saved from the quote builder. "Open quote file" starts an invoice from it: customer, items, discounts, notes and GST setting. The business details on the page are kept, and only empty ones are filled from the quote. A quote saved with prices that include GST opens with GST added on top and a warning to change the prices.
- **Suggested number**: `INV-YYYYMMDD-01` from the invoice date, typed into the invoice number field and following the date until the visitor edits it. "New invoice" on the same date suggests `-02`.
- **Payment details**: free text telling the customer how to pay (bank, account, PayNow UEN or mobile). Printed after the totals. Never a QR code.
