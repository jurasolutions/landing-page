import { describe, expect, it, vi } from "vitest";
import * as fixtures from "../pdf-merge-and-split/__fixtures__/fixtures.js";

// Records every loading task pdf.js hands out, so a test can see whether a
// failed load was cleaned up.
const tasks = vi.hoisted(() => []);
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    getDocument: (options) => {
      const task = real.getDocument({ ...options, disableFontFace: true });
      tasks.push(task);
      return task;
    },
  };
});

// In the browser the worker is a URL on this site. Under Node, pdf.js
// imports the worker module itself, so point it at the file.
vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", async () => {
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const file = createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  return { default: pathToFileURL(file).href };
});

const { canvasToJpeg, openPdfjs } = await import("./pdfjs.js");

describe("openPdfjs", () => {
  it("opens a PDF with pdf.js", async () => {
    const doc = await openPdfjs(await fixtures.tenPages());
    expect(doc.numPages).toBe(10);
    await doc.destroy();
  });

  it("destroys the loading task when the load fails, then rethrows", async () => {
    tasks.length = 0;
    await expect(openPdfjs(fixtures.notAPdf())).rejects.toThrow();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].destroyed).toBe(true);
  });
});

describe("canvasToJpeg", () => {
  it("encodes the canvas as a JPEG at the quality asked for", async () => {
    const blob = new Blob(["jpeg"]);
    const canvas = { toBlob: vi.fn((done) => done(blob)) };
    expect(await canvasToJpeg(canvas, 0.8)).toBe(blob);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
  });

  it("rejects when the browser cannot encode it", async () => {
    const canvas = { toBlob: (done) => done(null) };
    await expect(canvasToJpeg(canvas, 0.8)).rejects.toThrow("encode");
  });
});
