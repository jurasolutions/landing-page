import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Jura mark as PNGs for email (scout PRD §5.6a). Outreach emails link
 * https://jurasolutions.sg/email/jura-mark-96.png from Levi's signature, and
 * emails already sent keep pointing there, so these files must stay at these
 * paths and sizes. Email clients block SVG, which is why they are PNGs.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(name) {
  const bytes = readFileSync(new URL(`../public/email/${name}`, import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    signature: [...bytes.subarray(0, 8)],
    chunk: String.fromCharCode(...bytes.subarray(12, 16)),
    width: view.getUint32(16),
    height: view.getUint32(20),
    colourType: bytes[25],
    size: bytes.byteLength,
  };
}

describe("the email mark", () => {
  it.each([
    ["jura-mark-96.png", 96],
    ["jura-mark-192.png", 192],
  ])("%s is a %ipx square PNG with transparency", (name, side) => {
    const image = png(name);
    expect(image.signature).toEqual(PNG_SIGNATURE);
    expect(image.chunk).toBe("IHDR");
    expect([image.width, image.height]).toEqual([side, side]);
    expect(image.colourType).toBe(6); // RGBA: the white tile's corners are transparent
    expect(image.size).toBeLessThan(20_000); // light enough for every email
  });
});
