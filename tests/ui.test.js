import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Nav } from "../src/sections/Nav.jsx";
import { QuoteForm } from "../src/apps/quote-builder/QuoteForm.jsx";
import QuoteBuilder from "../src/apps/quote-builder/index.jsx";
import quoteCopy from "../src/apps/quote-builder/copy.js";
import { quoteTotals } from "../src/apps/quote-builder/calc.js";
import { LIMITS, emptyItem, newQuote } from "../src/apps/quote-builder/model.js";
import { TryLimitNotice } from "../src/apps/_shared/TryLimitNotice.jsx";
import ReceiptReader from "../src/apps/receipt-reader/index.jsx";
import receiptCopy from "../src/apps/receipt-reader/copy.js";

/**
 * Accessibility checks on rendered markup. Effects do not run here, so these
 * cover what the first render promises: labels, descriptions, live regions
 * and tap targets.
 */
const h = React.createElement;
const html = (element) => renderToStaticMarkup(element);

/** The tag that opens the element with this id. */
const tagWithId = (markup, id) => markup.match(new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? "";
const describedBy = (markup, id) => tagWithId(markup, id).match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
const textOf = (markup, id) => markup.match(new RegExp(`\\bid="${id}"[^>]*>([^<]*)<`))?.[1] ?? "";
const buttonWith = (markup, label) =>
  markup.match(new RegExp(`<button(?:(?!<button).)*?>(?:(?!</button>).)*${label}</button>`, "s"))?.[0] ?? "";

describe("the nav", () => {
  it("gives the talk-to-us action a 44px tap target", () => {
    const markup = html(h(Nav));
    const cta = markup.match(/<a[^>]*href="#contact"[^>]*>/)?.[0] ?? "";
    expect(cta).toContain("min-height:var(--tap-min)");
  });
});

function form(quote = newQuote({ today: "2026-10-25" }), props = {}) {
  return html(
    h(QuoteForm, {
      quote,
      setQuote: () => {},
      totals: quoteTotals(quote),
      copy: quoteCopy,
      remember: false,
      onRemember: () => {},
      rememberBlocked: false,
      onLogo: () => {},
      logoError: "",
      ...props,
    })
  );
}

describe("the quote form", () => {
  it("renders without the old unsupported-characters prop", () => {
    expect(() => form()).not.toThrow();
  });

  it("links a field's hint to its input", () => {
    const markup = form();
    const note = describedBy(markup, "qb-business-uen");
    expect(note).not.toBe("");
    expect(textOf(markup, note)).toBe(quoteCopy.business.uenHint);
  });

  it("links a field's error to its input, so a screen reader hears the reason", () => {
    const quote = newQuote({ today: "2026-10-25" });
    quote.items[0].quantity = "lots";
    const markup = form(quote);
    const id = `qb-item-${quote.items[0].id}-quantity`;
    expect(tagWithId(markup, id)).toContain('aria-invalid="true"');
    expect(textOf(markup, describedBy(markup, id))).toBe(quoteCopy.errors.invalidNumber);
  });

  it("leaves a field with no hint or error undescribed", () => {
    expect(describedBy(form(), "qb-business-name")).toBe("");
  });

  it("says why Add item is off once the quote is full", () => {
    const quote = newQuote({ today: "2026-10-25" });
    quote.items = Array.from({ length: LIMITS.items }, emptyItem);
    const markup = form(quote);
    const button = buttonWith(markup, quoteCopy.buttons.addItem);
    expect(button).toContain('disabled=""');
    const why = button.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(textOf(markup, why)).toBe(quoteCopy.itemsFull(LIMITS.items));
  });

  it("does not describe Add item while there is room", () => {
    const button = buttonWith(form(), quoteCopy.buttons.addItem);
    expect(button).not.toBe("");
    expect(button).not.toContain("aria-describedby");
  });

  it("keeps the logo error's live region in the page before any error", () => {
    expect(form()).toMatch(/<div[^>]*id="qb-logo-status"[^>]*aria-live="polite"[^>]*><\/div>/);
    expect(form(undefined, { logoError: "Too big" })).toMatch(
      /id="qb-logo-status"[^>]*aria-live="polite"[^>]*>.*Too big/s
    );
  });
});

describe("the quote builder", () => {
  const markup = html(h(QuoteBuilder, { app: { slug: "quote-builder" }, copy: quoteCopy }));

  it("switches Edit and Preview with two pressed-state buttons, not tabs", () => {
    expect(markup).not.toContain('role="tab"');
    const edit = buttonWith(markup, quoteCopy.view.edit);
    const preview = buttonWith(markup, quoteCopy.view.preview);
    expect(edit).toContain('aria-pressed="true"');
    expect(preview).toContain('aria-pressed="false"');
    expect(edit).toContain('class="qb-view"');
  });

  it("keeps a live region for the export alerts before any appear", () => {
    expect(markup).toMatch(/<div class="tb-live[^"]*" aria-live="polite"><\/div>/);
  });
});

describe("the receipt reader", () => {
  it("says why Read receipts is off, linked to the button", () => {
    // First render: the day's limit has not loaded yet.
    const markup = html(h(ReceiptReader, { app: { slug: "receipt-reader" }, copy: receiptCopy }));
    const button = buttonWith(markup, receiptCopy.read);
    expect(button).toContain('disabled=""');
    const why = button.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(why.split(" ").map((id) => textOf(markup, id))).toEqual([receiptCopy.readWhy.loading, receiptCopy.oneTry]);
  });
});

describe("the try limit notice", () => {
  const copy = { triesLeft: (n) => `${n} left`, limitReached: "Used up", capReached: "Cap reached" };

  it("is a live region even while the limit is loading", () => {
    expect(html(h(TryLimitNotice, { limit: null, copy }))).toMatch(/^<div[^>]*aria-live="polite"[^>]*><\/div>$/);
  });

  it.each([
    [{ triesLeft: 2, capReached: false }, "2 left"],
    [{ triesLeft: 0, capReached: false }, "Used up"],
    [{ triesLeft: 1, capReached: true }, "Cap reached"],
  ])("puts %j inside the same region", (limit, text) => {
    const markup = html(h(TryLimitNotice, { limit, copy }));
    expect(markup).toMatch(/^<div[^>]*aria-live="polite"/);
    expect(markup).toContain(text);
    expect(markup.match(/aria-live/g)).toHaveLength(1);
  });
});
