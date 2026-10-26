# 2. The visitor's product photos go to the image model as references

Date: 2026-10-27
Status: accepted
Context: APP-004 Product photo studio (`.scratch/food-post-maker/reviews/direction-change.md`)

## Context

The first brief, a food post maker, kept the visitor's photos away from the image model. Claude
turned them into a text description and the model drew from text alone. That ruled out carrying a
logo from the photo into the picture, at the price of pictures that looked less like the real
dish. The technical review drafted that as this ADR.

Mid-build, Ting Yu changed the brief to a product photo studio for any business: the owner's own
product, with better light and a better background. A product redrawn from a text description is
a different product, so the earlier decision no longer fits.

## Decision

Each picture is one Workers AI FLUX.2 [klein] call with Claude's edit prompt, the size, and the
visitor's photos as reference images (`input_image_0` to `input_image_3`). The browser sends a
copy of each photo at most 512 px on the long edge for this, and the server checks it is a JPEG of
that size before the try (`server/images.js` `checkRefs`). Claude's edit prompt names the products
by their image number and keeps each one exactly as it is, changing only the background, surface,
props, light and composition. The server appends a positively phrased brand-safe suffix that says
the same, plus plain unmarked props and nobody in the frame (`server/image-gen.js`).

## Consequences

- The picture shows the visitor's real product, label included. The label is theirs to show, so
  the hard-coded brand list is gone. The server still rejects a brand mark (™ ® ©) in an edit
  prompt, and any claim word the visitor did not type (`server/photo-studio.js`).
- Two services now see the photos: Anthropic and Cloudflare Workers AI. The privacy note and
  `/privacy` say so, and neither stores them for Jura.
- Each reference adds to the picture's price (an input tile on 4B, input megapixels on 9B), and
  the reservation counts them.
- The model may still change a product slightly. Every frame carries the note: "This picture is
  made by AI from your photos. Check your product looks right before you post."

## Rejected

- Text-only generation (the earlier decision): it cannot show the visitor's actual product.
- Sending the full 1600 px photos: more input cost and a bigger request, for references the model
  works from at a smaller size anyway.
