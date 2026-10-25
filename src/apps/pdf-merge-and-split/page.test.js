import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PdfMergeAndSplit from "./index.jsx";
import COPY from "./copy.js";
import { REGISTRY, findApp } from "../registry.js";

const app = findApp("pdf-merge-and-split", REGISTRY);

describe("the PDF merge and split page", () => {
  it("is in the toolbox as a live Documents tool from APP-003", () => {
    expect(app).toMatchObject({
      name: "PDF merge and split",
      description: "Join PDFs or pull out pages, right in your browser.",
      category: "Documents",
      tier: "browser",
      status: "live",
      added: "2026-10-24",
      prd: "APP-003",
    });
  });

  it("opens on the Merge tab with an empty drop area", () => {
    const html = renderToStaticMarkup(React.createElement(PdfMergeAndSplit, { app, copy: COPY }));
    expect(html).toMatch(/role="tab" aria-selected="true"[^>]*>Merge</);
    expect(html).toMatch(/role="tab" aria-selected="false"[^>]*>Split</);
    expect(html).toContain("Drop your PDFs here, or choose files");
    expect(html).toContain("Add up to 20 files, under 50 MB in total. Drag to change the order.");
    expect(html).toContain("Add a PDF to get started.");
    expect(html).toContain(">Choose files<");
    // The Split panel is there but hidden until its tab is chosen.
    expect(html).toMatch(/role="tabpanel"[^>]*aria-label="Split"[^>]*hidden/);
    expect(html).toContain("Drop a PDF here, or choose a file");
  });

  it("labels the file picker inputs", () => {
    const html = renderToStaticMarkup(React.createElement(PdfMergeAndSplit, { app, copy: COPY }));
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).toMatch(/aria-label(ledby)?="/);
  });
});
