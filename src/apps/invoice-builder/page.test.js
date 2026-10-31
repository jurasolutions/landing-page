/**
 * The page around the tool: the registry entry (PRD §5.3, decision D17), the
 * shell's words and the talk-to-us card (criterion 13), and the usage Function
 * counting this tool (criterion 14; the page's "complete" call is in
 * download.test.js, and the shell counts "open" for every tool).
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppShell } from "../_shared/AppShell.jsx";
import { REGISTRY, findApp, validateRegistry } from "../registry.js";
import { copyFor, hasTool } from "../loaders.js";
import { cleanFrom } from "../../lib/validate.js";
import { createD1 } from "../../../tests/helpers/d1.js";
import { handleUsage } from "../../../server/usage.js";
import COPY from "./copy.js";

const app = findApp("invoice-builder", REGISTRY);
const decode = (s) => s.replaceAll("&#x27;", "'");

describe("the invoice builder page", () => {
  it("is in the toolbox as the PRD's live Finance tool", () => {
    expect(app).toEqual({
      slug: "invoice-builder",
      name: "Invoice builder",
      description: "Clean PDF invoices with your logo, with or without GST.",
      category: "Finance",
      industries: ["general", "logistics", "professional-services"],
      tier: "browser",
      status: "live",
      added: "2026-10-31",
      prd: "APP-005",
    });
    expect(() => validateRegistry(REGISTRY)).not.toThrow();
  });

  it("has its folder found by the loaders, with this copy", () => {
    expect(hasTool("invoice-builder")).toBe(true);
    expect(copyFor("invoice-builder")).toBe(COPY);
  });

  it("shows the title, promise, privacy note and talk-to-us card in the PRD's words", () => {
    const markup = decode(renderToStaticMarkup(React.createElement(AppShell, { app, copy: COPY }, "TOOL")));
    for (const text of [
      "Invoice builder",
      "Make a clean invoice with your logo and download it as a PDF, with or without GST.",
      "Everything you type stays in your browser. Nothing is sent to us.",
      "Invoices raised from the work you've done",
      "We can connect your invoicing to your quotes, jobs and accounts, so each detail is typed one time.",
      "Tell us how you invoice today",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('href="/?from=apps/invoice-builder#contact"');
    expect(cleanFrom("apps/invoice-builder")).toBe("apps/invoice-builder");
  });

  it("is counted on open and on completion by the usage Function, against the real registry", async () => {
    const DB = await createD1();
    for (const event of ["open", "complete"]) {
      const request = new Request("https://jurasolutions.sg/api/apps/usage", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ slug: "invoice-builder", event }),
      });
      expect((await handleUsage({ request, env: { DB }, registry: REGISTRY })).status).toBe(204);
    }
    expect(DB.rows("app_usage")).toEqual([expect.objectContaining({ app_slug: "invoice-builder", opens: 1, completions: 1 })]);
  });
});
