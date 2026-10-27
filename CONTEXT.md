# Context: the Jura Solutions website and toolbox

The words this repo uses, so code, specs and tickets mean the same thing.

## Toolbox

- **Tool**: one free app under `/apps/<slug>`, listed in `src/apps/registry.json`.
- **Tier**: `browser` (nothing leaves the visitor's browser) or `ai` (a Pages Function calls a model).
- **Try**: one press of an AI tool's main button that reaches the model. Five a visitor a day, shared across AI tools.
- **Budget**: the site's daily spend on AI calls, US$5 by default, reserved before each call and settled to the real cost after.
- **Repair**: one free second call that asks the model to fix output that failed validation.

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
