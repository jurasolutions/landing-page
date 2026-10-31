/**
 * The invoice builder's file buttons and file messages, as rendered (PRD §2
 * criterion 6, decisions D6 and D8). The reading itself is tested in
 * src/apps/invoice-builder/invoiceFile.test.js.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import InvoiceBuilder from "../src/apps/invoice-builder/index.jsx";
import { FileNotice } from "../src/apps/invoice-builder/FileActions.jsx";
import COPY from "../src/apps/invoice-builder/copy.js";
import { memoryStorage } from "../src/apps/invoice-builder/fixtures.js";

const h = React.createElement;
const html = (element) => renderToStaticMarkup(element);
const decode = (s) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
const buttonWith = (markup, label) =>
  markup.match(new RegExp(`<button(?:(?!<button).)*?>(?:(?!</button>).)*${label}</button>`, "s"))?.[0] ?? "";

const page = () => {
  vi.stubGlobal("window", { localStorage: memoryStorage() });
  return html(h(InvoiceBuilder, { app: { slug: "invoice-builder" }, copy: COPY }));
};

describe("the invoice builder's file buttons", () => {
  it("offers Save invoice file, Open invoice file and Open quote file in the PRD's words", () => {
    const markup = page();
    for (const label of ["Save invoice file", "Open invoice file", "Open quote file"]) {
      expect(buttonWith(markup, label), label).not.toBe("");
    }
  });

  it("has one named file picker for both Open buttons, taking JSON files", () => {
    // The other file input is the logo's.
    const pickers = (page().match(/<input[^>]*type="file"[^>]*>/g) ?? []).filter((tag) => tag.includes("json"));
    expect(pickers).toHaveLength(1);
    expect(pickers[0]).toContain('accept=".json,application/json"');
    expect(pickers[0]).toContain(`aria-label="${COPY.buttons.openFile}"`);
    expect(pickers[0]).toContain('tabindex="-1"');
  });

  it("keeps the export live region empty until a file message comes", () => {
    expect(page()).toMatch(/<div class="tb-live[^"]*" aria-live="polite"><\/div>/);
  });
});

describe("the file messages", () => {
  const notice = (kind) => decode(html(h(FileNotice, { notice: kind, copy: COPY })));

  it("shows the PRD's bad-file message, word for word", () => {
    const markup = notice("bad");
    expect(markup).toContain("That file doesn't look like one saved from our quote or invoice builder.");
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain(COPY.quoteIncludedGst);
  });

  it("warns when a quote's prices included GST (decision D6)", () => {
    const markup = notice("inclusive");
    expect(markup).toContain(
      "This quote's prices include GST. Your invoice adds GST on top, so change each unit price to the amount before GST."
    );
    expect(markup).not.toContain(COPY.badFile);
  });

  it("shows nothing when there is nothing to say", () => {
    expect(notice(null)).toBe("");
  });
});
