import { vi } from "vitest";

/**
 * Stands in for the browser's image decoding and canvas, so photo preparation
 * runs under Node. `decodes` says whether this browser can open the file (as
 * Safari can a HEIC): when false, both createImageBitmap and the <img>
 * fallback fail. Undone by `vi.unstubAllGlobals()` and `vi.restoreAllMocks()`
 * in tests/setup.js.
 */
export function stubBrowserImages({ decodes }) {
  const fail = () => Promise.reject(new Error("This browser can't decode the file"));
  const createImageBitmap = vi.fn(() => (decodes ? Promise.resolve({ width: 4032, height: 3024, close: () => {} }) : fail()));
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  vi.stubGlobal("window", { createImageBitmap });
  vi.stubGlobal(
    "Image",
    class {
      decode() {
        return decodes ? Promise.resolve() : fail();
      }
    }
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({ fillRect: () => {}, drawImage: () => {} }),
      toBlob: (done, type) => done(new Blob([new Uint8Array(64)], { type })),
    }),
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:prepared");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { createImageBitmap };
}
