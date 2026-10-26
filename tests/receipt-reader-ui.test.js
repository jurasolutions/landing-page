import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LimitArea } from "../src/apps/_shared/LimitArea.jsx";
import copy from "../src/apps/receipt-reader/copy.js";

const render = (limit) =>
  renderToStaticMarkup(React.createElement(LimitArea, { limit, slug: "receipt-reader", copy })).replaceAll("&#x27;", "'");
const CARD = 'href="/?from=apps/receipt-reader#contact"';

describe("the receipt reader's try notice", () => {
  it("puts the talk-to-us card right under the notice when the visitor is out of tries (APP-002 §5.1 step 7)", () => {
    const html = render({ ready: true, triesLeft: 0, capReached: false });
    expect(html).toContain(copy.limitReached);
    expect(html).toContain(CARD);
    expect(html.indexOf(copy.limitReached)).toBeLessThan(html.indexOf(CARD));
  });

  it("does the same when the site's daily cap is reached", () => {
    const html = render({ ready: true, triesLeft: 2, capReached: true });
    expect(html).toContain(copy.capReached);
    expect(html).toContain(CARD);
  });

  it("shows no card while the visitor still has tries, or before the count arrives", () => {
    expect(render({ ready: true, triesLeft: 1, capReached: false })).not.toContain(CARD);
    expect(render(null)).not.toContain(CARD);
  });
});
