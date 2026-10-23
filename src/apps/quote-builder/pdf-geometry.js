/**
 * PDF sizes shared by the PDF builder and the logo code. Kept apart from
 * pdf.js so that importing them never pulls pdf-lib into the page.
 */
export const A4 = [595.28, 841.89];
export const LOGO_BOX = { width: 170, height: 56 };

/**
 * Where a logo of width x height prints, in points: as large as fits in the
 * logo box, keeping its shape. A wide logo is limited by the width (up to
 * 170pt, about 6 cm), a square one by the height (56pt, about 2 cm).
 */
export function fitLogo(width, height, box = LOGO_BOX) {
  const scale = Math.min(box.width / width, box.height / height);
  return { width: width * scale, height: height * scale };
}
