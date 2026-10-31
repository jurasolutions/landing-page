/**
 * Text layout for the PDFs, without pdf-lib. `font` is anything with
 * widthOfTextAtSize, so another tool can wrap its text without pulling the
 * quote's PDF builder, and pdf-lib with it, into its own chunk.
 */
import { toPrintable } from "./winansi.js";

/** Splits text into lines no wider than maxWidth, breaking long words if it must. */
export function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of toPrintable(text).split("\n")) {
    const words = paragraph.split(/ +/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single word wider than the column is broken by character.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}
