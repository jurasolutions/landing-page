import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { extractPages, mergePdfs, readPdf, splitPages } from "./pdf.js";
import * as fixtures from "./__fixtures__/fixtures.js";

const folder = path.dirname(new URL(import.meta.url).pathname);

describe("files stay in the browser", () => {
  it("reads, merges, keeps pages and splits without a single request", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("no requests");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const a = await fixtures.portraitA4();
    const b = await fixtures.usLetter();
    await readPdf(a);
    await mergePdfs([{ bytes: a }, { bytes: b }]);
    await extractPages(b, [1]);
    await splitPages(a, "a");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has no network code of its own: the only call is the shared usage counter", () => {
    const sources = fs
      .readdirSync(folder)
      .filter((name) => /\.(js|jsx)$/.test(name) && !name.endsWith(".test.js"))
      .map((name) => [name, fs.readFileSync(path.join(folder, name), "utf8")]);
    expect(sources.length).toBeGreaterThan(3);
    for (const [name, source] of sources) {
      expect(source, name).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage/);
    }
  });
});
