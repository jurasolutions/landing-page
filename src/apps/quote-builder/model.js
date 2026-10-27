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
  // The Draft with AI request; server/quotes.js holds the Function to it too.
  aiPrompt: 2000,
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
 * Shown in light grey in the business name field, and used on the quote while
 * the field is empty, so the example quote reads as a real one.
 */
export const DEFAULT_BUSINESS_NAME = "Jura Solutions";

/**
 * The running quote number after `previous`: the last run of digits goes up
 * by one and keeps its width (Q-0007 -> Q-0008, INV-2026-099 -> INV-2026-100).
 * A number with no digits, or none at all, starts the run at Q-0001.
 */
export function nextNumber(previous = "") {
  const match = /^(.*?)(\d+)(\D*)$/.exec(String(previous).trim());
  if (!match) return "Q-0001";
  const [, before, digits, after] = match;
  return `${before}${String(Number(digits) + 1).padStart(digits.length, "0")}${after}`;
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

/**
 * The GST setting read back from storage, which anyone can edit, so every part
 * is checked. Returns undefined when there is no setting, so `newQuote` falls
 * back to its own default. `inclusive` counts only when it is exactly `true`
 * (the same rule as `on`), so a damaged or older setting reads as exclusive.
 */
export function readGst(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    on: raw.on === true,
    rate: typeof raw.rate === "string" ? raw.rate.slice(0, LIMITS.amount) : DEFAULT_GST_RATE,
    regNo: typeof raw.regNo === "string" ? raw.regNo.slice(0, LIMITS.short) : "",
    inclusive: raw.inclusive === true,
  };
}

/**
 * The quote number starts empty: the form shows the next running number as
 * its placeholder, and effectiveQuote uses it while the field stays empty.
 */
export function newQuote({ business = emptyBusiness(), gst, today = isoDate() } = {}) {
  return {
    business,
    customer: { company: "", contact: "", address: "", email: "" },
    details: {
      number: "",
      date: today,
      validUntil: addDays(today, VALID_DAYS),
    },
    items: [emptyItem()],
    overallDiscount: { type: "none", value: "" },
    gst: gst ?? { on: false, rate: DEFAULT_GST_RATE, regNo: "", inclusive: false },
    notes: COPY.defaultNotes,
    madeWith: true,
  };
}

/**
 * The quote as it prints: an empty business name or quote number takes the
 * value the form shows in light grey. Preview, PDF, file name and saved file
 * all use this, so what the visitor sees is what they get.
 */
export function effectiveQuote(quote, suggestedNumber) {
  const name = quote.business.name.trim() ? quote.business.name : DEFAULT_BUSINESS_NAME;
  const number = quote.details.number.trim() ? quote.details.number : suggestedNumber;
  return {
    ...quote,
    business: { ...quote.business, name },
    details: { ...quote.details, number },
  };
}
