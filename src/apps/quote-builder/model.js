/**
 * The quote as the form holds it. Every money and quantity field is the
 * string the visitor typed; calc.js turns them into integers when it needs
 * them, so a saved file re-opens to exactly what was on screen.
 */
import COPY from "./copy.js";

/** GST standard rate default.
 * Checked on the IRAS website on 2026-10-24:
 * https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/basics-of-gst/current-gst-rates
 * "The current GST rate in Singapore is 9%." (9% since 1 January 2024; 8% in 2023.)
 * The field stays editable so a visitor is never stuck with a stale default.
 */
export const DEFAULT_GST_RATE = "9";

export const VALID_DAYS = 30;

export const LIMITS = {
  short: 120,
  email: 200,
  address: 400,
  description: 1000,
  number: 40,
  unit: 30,
  amount: 20,
  notes: 4000,
  items: 200,
};

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** "2026-10-24" -> "24 Oct 2026". Empty or malformed dates print as empty. */
export function displayDate(iso, months = COPY.pdf.months) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return "";
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

/**
 * Q-YYYYMMDD-01, or the next number up if the previous quote was made on
 * the same day with the same pattern.
 */
export function suggestNumber(iso, previous = "") {
  const stamp = iso.replace(/-/g, "");
  const match = new RegExp(`^Q-${stamp}-(\\d{2,})$`).exec(previous);
  const next = match ? Number(match[1]) + 1 : 1;
  return `Q-${stamp}-${String(next).padStart(2, "0")}`;
}

let counter = 0;
export function newItemId() {
  counter += 1;
  return `item-${Date.now().toString(36)}-${counter}`;
}

export function emptyItem() {
  return {
    id: newItemId(),
    description: "",
    quantity: "1",
    unit: "",
    unitPrice: "",
    discountType: "none",
    discountValue: "",
  };
}

export function emptyBusiness() {
  return { name: "", address: "", uen: "", phone: "", email: "", logo: null };
}

export function newQuote({ business = emptyBusiness(), gst, previousNumber = "", today = isoDate() } = {}) {
  return {
    business,
    customer: { company: "", contact: "", address: "", email: "" },
    details: {
      number: suggestNumber(today, previousNumber),
      date: today,
      validUntil: addDays(today, VALID_DAYS),
    },
    items: [emptyItem()],
    overallDiscount: { type: "none", value: "" },
    gst: gst ?? { on: false, rate: DEFAULT_GST_RATE, regNo: "" },
    notes: COPY.defaultNotes,
    madeWith: true,
  };
}
