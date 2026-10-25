import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PdfMergeAndSplit from "./index.jsx";
import { LeftOutNote } from "./MergePanel.jsx";
import { Thumbnails } from "./Thumbnails.jsx";
import fs from "node:fs";
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

  it("warns above Merge and download that files with a problem are left out", () => {
    const files = [
      { id: "a", name: "a.pdf", status: "ready" },
      { id: "b", name: "b.pdf", status: "problem", reason: "encrypted" },
    ];
    const html = renderToStaticMarkup(React.createElement(LeftOutNote, { files, copy: COPY })).replaceAll("&#x27;", "'");
    expect(html).toContain("Files with a problem are left out. Remove them, or fix them and add them again.");
  });

  it("does not warn while every file is ready or still being checked", () => {
    const files = [
      { id: "a", name: "a.pdf", status: "ready" },
      { id: "b", name: "b.pdf", status: "checking" },
    ];
    expect(renderToStaticMarkup(React.createElement(LeftOutNote, { files, copy: COPY }))).toBe("");
  });

  it("lets the keyboard reach and scroll the page thumbnails, with the design system's focus outline", () => {
    const pages = [{ width: 595, height: 842 }, { width: 842, height: 595 }];
    const html = renderToStaticMarkup(React.createElement(Thumbnails, { buffer: null, pages, copy: COPY }));
    expect(html).toMatch(/<ol[^>]*tabindex="0"[^>]*aria-label="Pages in this file"|<ol[^>]*aria-label="Pages in this file"[^>]*tabindex="0"/);
    const css = fs.readFileSync(new URL("./pdf-merge-and-split.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.pm-thumbs:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--border-focus\)/);
  });

  it("labels the file picker inputs", () => {
    const html = renderToStaticMarkup(React.createElement(PdfMergeAndSplit, { app, copy: COPY }));
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).toMatch(/aria-label(ledby)?="/);
  });
});
