import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Nav } from "../src/sections/Nav.jsx";

/**
 * Accessibility checks on rendered markup. Effects do not run here, so these
 * cover what the first render promises: labels, descriptions, live regions
 * and tap targets.
 */
const html = (element) => renderToStaticMarkup(element);

describe("the nav", () => {
  it("gives the talk-to-us action a 44px tap target", () => {
    const markup = html(React.createElement(Nav));
    const cta = markup.match(/<a[^>]*href="#contact"[^>]*>/)?.[0] ?? "";
    expect(cta).toContain("min-height:var(--tap-min)");
  });
});
