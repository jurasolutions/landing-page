/**
 * Privacy and the money rule, by reading the folder's own sources (PRD §4,
 * test-strategy.md R4 and C1): the tool makes no request of its own (the
 * shared usage counter is the only one, and it lives in _shared/), reaches
 * storage only through the shared helpers, and does its maths with the quote
 * builder's calc module rather than a copy of it.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { quoteTotals } from "../quote-builder/calc.js";
import COPY from "./copy.js";
import { buildInvoicePdf } from "./pdf.js";
import { downloadInvoice } from "./download.js";
import { loadBusiness, saveBusiness } from "./remember.js";
import { memoryStorage, sampleInvoice } from "./fixtures.js";

const folder = path.dirname(new URL(import.meta.url).pathname);
const sources = fs
  .readdirSync(folder)
  .filter((name) => /\.(js|jsx)$/.test(name) && !name.endsWith(".test.js") && name !== "fixtures.js")
  .map((name) => [name, fs.readFileSync(path.join(folder, name), "utf8")]);

describe("the invoice builder stays in the browser", () => {
  it("builds, downloads and remembers without a single request", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("no requests");
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    const invoice = sampleInvoice(5);
    const totals = quoteTotals(invoice);
    await buildInvoicePdf(invoice, totals, COPY);
    await downloadInvoice(invoice, totals, {
      build: (i, t) => buildInvoicePdf(i, t, COPY),
      save: () => {},
      track: () => {},
    });
    saveBusiness({ business: invoice.business, gst: invoice.gst, payment: invoice.payment });
    loadBusiness();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has no network or storage code of its own", () => {
    expect(sources.length).toBeGreaterThan(6);
    for (const [name, source] of sources) {
      expect(source, name).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage/);
    }
  });
});

describe("the invoice builder's money", () => {
  it("imports the quote builder's calc module and keeps no copy of it", () => {
    const all = sources.map(([, source]) => source).join("\n");
    expect(all).toMatch(/from "\.\.\/quote-builder\/calc\.js"/);
    for (const [name, source] of sources) {
      expect(source, name).not.toMatch(/function\s+(divRoundHalfUp|parseScaled|quoteTotals|lineFigures)\b/);
      expect(source, name).not.toMatch(/parseFloat|toFixed|Math\.round/);
      expect(source, name).not.toMatch(/internal[-_ ]?invoice|invoicing-system/i);
    }
  });

  it("loads pdf-lib only from pdf.js, which the page imports lazily", () => {
    for (const [name, source] of sources) {
      if (name === "pdf.js") continue;
      expect(source, name).not.toMatch(/from "pdf-lib"|import\("pdf-lib"\)/);
      expect(source, name).not.toMatch(/^import[^;]*from "\.\/pdf\.js"/m);
      expect(source, name).not.toMatch(/^import[^;]*from "\.\.\/quote-builder\/pdf\.js"/m);
    }
  });
});
