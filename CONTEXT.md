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
