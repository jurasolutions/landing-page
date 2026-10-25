/**
 * Page thumbnails for the split view, drawn in the browser with pdf.js. It is
 * fetched only when a PDF is added on the Split tab, through the toolbox's
 * shared loader (_shared/pdfjs.js), as the receipt reader does.
 *
 * Pages are drawn one at a time, only when asked (the page asks as each
 * thumbnail scrolls into view), and each drawing is kept as a small JPEG
 * rather than a live canvas, so a 200-page file stays light.
 */
import { canvasToJpeg, openPdfjs } from "../_shared/pdfjs.js";

const WIDTH_CSS = 112;
const QUALITY = 0.8;

export const isPasswordError = (error) => error?.name === "PasswordException";

/**
 * Opens the file with pdf.js. Rejects with pdf.js's PasswordException for a
 * protected file. Resolves to { draw(pageNumber) -> object URL, close() }.
 */
export async function openThumbnails(buffer) {
  // pdf.js moves the bytes it is given to its worker, so give it a copy.
  const doc = await openPdfjs(new Uint8Array(buffer).slice());

  let queue = Promise.resolve();
  let closed = false;

  const drawNow = async (pageNumber) => {
    if (closed) return null;
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: (WIDTH_CSS * ratio) / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    page.cleanup();
    const blob = await canvasToJpeg(canvas, QUALITY);
    canvas.width = 0;
    canvas.height = 0;
    return closed ? null : URL.createObjectURL(blob);
  };

  return {
    draw(pageNumber) {
      const next = queue.then(() => drawNow(pageNumber));
      queue = next.catch(() => null);
      return next;
    },
    close() {
      closed = true;
      doc.destroy();
    },
  };
}
