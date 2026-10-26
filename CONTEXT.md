# Context: the Jura Solutions website and toolbox

The words this repo uses, so code, specs and tickets mean the same thing.

## Toolbox

- **Tool**: one free app under `/apps/<slug>`, listed in `src/apps/registry.json`.
- **Tier**: `browser` (nothing leaves the visitor's browser) or `ai` (a Pages Function calls a model).
- **Try**: one press of an AI tool's main button that reaches the model. Five a visitor a day, shared across AI tools.
- **Budget**: the site's daily spend on AI calls, US$5 by default, reserved before each call and settled to the real cost after.
- **Repair**: one free second call that asks the model to fix output that failed validation.

## Food post maker (APP-004)

- **Source photo**: a photo the visitor uploads: a menu, a dish, or anything from the shop. Read by Claude, never passed to the image model.
- **Dish**: a menu item the tool found in the source photos or the visitor's fields.
- **Post**: one generated picture with its caption, hashtags and alt text. A try returns two.
- **Hero dish**: the dish a post features, chosen by Claude unless the visitor names one.
- **Image prompt**: Claude's text description of the picture to draw. The only input the image model gets.
- **Brand-safe suffix**: the fixed text the server appends to every image prompt, ruling out text, logos, packaging and people.
- **Picture**: the AI-generated image, 1024 x 1280 from the model, composed in the browser to 1080 x 1350 (portrait) or 1080 x 1080 (square).
