/**
 * pdf.js for the toolbox's browser tools, loaded the one way they all use:
 * the legacy build (for older Safari), the worker fetched by URL from this
 * site, and no eval. It is imported only when a tool first needs it, so no
 * page pays for it up front.
 *
 * pdf.js moves the bytes it is given to its worker. Pass bytes you no longer
 * need, or a copy.
 */

/**
 * Opens `bytes` (a Uint8Array) with pdf.js and resolves to the document;
 * call `destroy()` on it when done. If the load fails (a password, a damaged
 * file), the loading task and its worker are destroyed before the error is
 * rethrown, so nothing is left holding memory.
 */
export async function openPdfjs(bytes) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

/** Encodes a canvas as a JPEG blob at `quality` (0 to 1). */
export function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", quality)
  );
}
