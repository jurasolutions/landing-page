/**
 * Which characters the PDF can print.
 *
 * The PDF uses the standard Helvetica that every PDF reader has built in. It
 * is neutral, so the visitor's document carries their branding and not
 * Jura's typefaces, and it adds nothing to download. Its catch is that it
 * can only draw WinAnsi (Windows-1252) characters: Latin letters with
 * accents, the common punctuation, € and so on, but not Chinese, Tamil,
 * emoji or most symbols. A font that covered those would add megabytes to the
 * tool, so instead the form lists any character that will not print, and the
 * PDF leaves it out. Nothing is changed silently.
 */

// Windows-1252 code points for 0x80-0x9F that are not the same as Latin-1.
const CP1252_EXTRAS = [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
];

const SUPPORTED = new Set(CP1252_EXTRAS);
for (let code = 0x20; code <= 0x7e; code += 1) SUPPORTED.add(code);
for (let code = 0xa0; code <= 0xff; code += 1) SUPPORTED.add(code);

/**
 * Characters that look different but print the same once normalised. NFC
 * only (NFKC would turn "m²" into "m2"), plus full-width ASCII, which CJK
 * input methods produce, and the two common ligatures.
 */
function normalise(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/\t/g, "    ")
    .replace(/[ -   　]/g, " ")
    .replace(/[‐‑‒−]/g, "-")
    .replace(/\r\n?/g, "\n");
}

const printable = (char) => char === "\n" || SUPPORTED.has(char.codePointAt(0));

/** Text ready for the PDF: normalised, with unprintable characters removed. */
export function toPrintable(text) {
  return Array.from(normalise(text)).filter(printable).join("");
}

/** The distinct characters in `texts` that the PDF will leave out. */
export function unprintableIn(texts) {
  const found = new Set();
  for (const value of texts) {
    for (const char of normalise(value)) {
      if (!printable(char) && !/\s/.test(char)) found.add(char);
    }
  }
  return [...found];
}
