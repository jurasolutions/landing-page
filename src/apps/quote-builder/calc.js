/**
 * Quote money maths. Pure functions, no floats.
 *
 * - Money is integer cents. Inputs arrive as the strings the visitor typed and
 *   are parsed digit by digit, never through parseFloat.
 * - Quantity is the one fractional value (2.5 hours), scaled to thousandths.
 * - Percentages (line discounts, the overall discount, the GST rate) are
 *   scaled to hundredths of a percent, so 9% is 900 and 12.5% is 1250.
 * - Rounding is half up, once at each line total and once at GST, the same
 *   approach as Jura's own invoice system. The overall percentage discount is
 *   a money amount too, so it is rounded half up to the cent as well.
 * - Products are taken in BigInt so no intermediate value can lose precision.
 *
 * Written to be reused by the invoice builder when it comes.
 */

export const QTY_SCALE = 1000n; // thousandths
export const PCT_SCALE = 10000n; // hundredths of a percent; 100% = 10000

/** floor(n / d + 1/2) for non-negative BigInts: round half up. */
export function divRoundHalfUp(n, d) {
  if (n < 0n || d <= 0n) throw new RangeError("divRoundHalfUp expects n >= 0 and d > 0");
  return (2n * n + d) / (2n * d);
}

/**
 * Parses a non-negative decimal string to an integer scaled by 10^places,
 * rounding half up past the last place. Commas, spaces and a leading "$" or
 * "S$" are tolerated. Returns { value: BigInt } or { value: 0n, empty: true }
 * for a blank field, or { error: "invalid" } for anything else.
 */
export function parseScaled(input, places) {
  const text = String(input ?? "")
    .trim()
    .replace(/^S?\$\s*/i, "")
    .replace(/[,\s]/g, "");
  if (text === "") return { value: 0n, empty: true };
  const match = text.match(/^(\d*)(?:\.(\d*))?$/);
  if (!match || (match[1] === "" && (match[2] ?? "") === "")) return { error: "invalid" };

  const whole = match[1] || "0";
  const frac = match[2] ?? "";
  const kept = frac.slice(0, places).padEnd(places, "0");
  let value = BigInt(whole + kept);
  const next = frac.charAt(places);
  if (next && Number(next) >= 5) value += 1n;
  return { value };
}

export const parseCents = (input) => parseScaled(input, 2);
export const parseQuantity = (input) => parseScaled(input, 3);
export const parsePercent = (input) => parseScaled(input, 2);

/** Cents from a typed amount, or 0 for blank or invalid. */
const centsOf = (input) => parseCents(input).value ?? 0n;

const clamp = (value, max) => (value > max ? max : value);

/**
 * One line's figures.
 * item: { quantity, unitPrice, discountType: "none" | "percent" | "amount", discountValue }
 * Returns BigInt cents: gross (before the line discount), discount, total;
 * plus `included` (false when the quantity is zero or blank, or the line is
 * still empty) and `errors`.
 */
export function lineFigures(item) {
  const errors = {};
  const qty = parseQuantity(item.quantity);
  const price = parseCents(item.unitPrice);
  if (qty.error) errors.quantity = "invalid";
  if (price.error) errors.unitPrice = "invalid";

  const qtyMilli = qty.value ?? 0n;
  const priceCents = price.value ?? 0n;
  // A line counts once it has a quantity and something to quote: a
  // description or a price. The blank line a new quote starts with does not.
  const included = qtyMilli > 0n && hasContent(item);
  const raw = qtyMilli * priceCents; // cents x 1000

  const gross = divRoundHalfUp(raw, QTY_SCALE);
  let total = gross;

  if (item.discountType === "percent") {
    const pct = parsePercent(item.discountValue);
    if (pct.error) errors.discountValue = "invalid";
    else if (pct.value > PCT_SCALE) errors.discountValue = "percent";
    const rate = clamp(pct.value ?? 0n, PCT_SCALE);
    total = divRoundHalfUp(raw * (PCT_SCALE - rate), QTY_SCALE * PCT_SCALE);
  } else if (item.discountType === "amount") {
    const off = parseCents(item.discountValue);
    if (off.error) errors.discountValue = "invalid";
    total = gross - clamp(off.value ?? 0n, gross);
  }

  if (!included) return { included, gross: 0n, discount: 0n, total: 0n, errors };
  return { included, gross, discount: gross - total, total, errors };
}

/** True when a line has something in it besides the quantity. */
export function hasContent(item) {
  return Boolean(String(item.description ?? "").trim() || String(item.unitPrice ?? "").trim());
}

/**
 * The whole quote.
 * quote: { items, overallDiscount: { type, value }, gst: { on, rate } }
 * Returns BigInt cents and the per-line figures, plus `ignored` (lines left
 * off because their quantity is zero or blank) and `errors`.
 */
export function quoteTotals(quote) {
  const errors = {};
  const lines = quote.items.map((item) => lineFigures(item));
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0n);

  let discount = 0n;
  const overall = quote.overallDiscount ?? { type: "none" };
  if (overall.type === "percent") {
    const pct = parsePercent(overall.value);
    if (pct.error) errors.overallDiscount = "invalid";
    else if (pct.value > PCT_SCALE) errors.overallDiscount = "percent";
    discount = divRoundHalfUp(subtotal * clamp(pct.value ?? 0n, PCT_SCALE), PCT_SCALE);
  } else if (overall.type === "amount") {
    const off = parseCents(overall.value);
    if (off.error) errors.overallDiscount = "invalid";
    discount = clamp(off.value ?? 0n, subtotal);
  }

  const taxable = subtotal - discount;

  let gst = 0n;
  let gstRate = 0n;
  if (quote.gst?.on) {
    const rate = parsePercent(quote.gst.rate);
    if (rate.error || rate.empty) errors.gstRate = "invalid";
    else if (rate.value > PCT_SCALE) errors.gstRate = "percent";
    gstRate = clamp(rate.value ?? 0n, PCT_SCALE);
    gst = divRoundHalfUp(taxable * gstRate, PCT_SCALE);
  }

  const ignored = quote.items
    .map((item, index) => ({ item, index, line: lines[index] }))
    .filter(({ item, line }) => !line.included && hasContent(item))
    .map(({ index }) => index);

  return {
    lines,
    subtotal,
    discount,
    taxable,
    gstRate,
    gst,
    total: taxable + gst,
    ignored,
    includedCount: lines.filter((line) => line.included).length,
    errors,
  };
}

// ---- Formatting: integers to strings, never through floating point ----

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 123456n -> "1,234.56" */
export function formatCents(cents) {
  const value = BigInt(cents);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = groupThousands((abs / 100n).toString());
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** 2500n -> "2.5", 1000n -> "1", 125n -> "0.125" */
export function formatQuantity(milli) {
  const value = BigInt(milli);
  const whole = groupThousands((value / QTY_SCALE).toString());
  const frac = (value % QTY_SCALE).toString().padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** 900n -> "9", 1250n -> "12.5" */
export function formatPercent(hundredths) {
  const value = BigInt(hundredths);
  const whole = (value / 100n).toString();
  const frac = (value % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** The value a money field shows after it loses focus: "12.5" -> "12.50". */
export function normaliseMoneyInput(input) {
  const parsed = parseCents(input);
  if (parsed.error || parsed.empty) return String(input ?? "");
  return formatCents(parsed.value).replace(/,/g, "");
}
