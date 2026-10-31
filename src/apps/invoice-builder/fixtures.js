/**
 * Test data for the invoice builder (test-strategy.md, "Test data"). Not a
 * .test.js file, so the suite only runs it through the tests that import it.
 */
import { newInvoice } from "./model.js";

/** A one-line description, or every seventh a long one that wraps. */
const description = (i) =>
  i % 7 === 3
    ? "Chemical overhaul of a ceiling cassette unit, including coil cleaning and drain flush"
    : `Aircon servicing, unit ${i + 1}`;

/**
 * A complete invoice with `lines` items, GST on at 9% and a registration
 * number. `overrides` are merged over the top level.
 */
export function sampleInvoice(lines = 5, overrides = {}) {
  const invoice = newInvoice({ today: "2026-10-31" });
  invoice.business = {
    name: "Tan Brothers Aircon Pte Ltd",
    address: "10 Ubi Crescent\n#05-12 Ubi Techpark\nSingapore 408564",
    uen: "201912345K",
    phone: "+65 6123 4567",
    email: "hello@tanbrothers.example",
    logo: null,
  };
  invoice.customer = {
    company: "Harbourfront Dental",
    contact: "Dr Lim",
    address: "1 Maritime Square, Singapore 099253",
    email: "admin@harbourfront.example",
  };
  invoice.details = { number: "INV-20261031-01", date: "2026-10-31", dueDate: "2026-11-30" };
  invoice.items = Array.from({ length: lines }, (_, i) => ({
    id: `item-${i}`,
    description: description(i),
    quantity: String((i % 3) + 1),
    unit: i % 2 ? "units" : "",
    unitPrice: "45.50",
    discountType: i === 1 ? "percent" : i === 2 ? "amount" : "none",
    discountValue: i === 1 ? "10" : i === 2 ? "5" : "",
  }));
  invoice.gst = { on: true, rate: "9", regNo: "M90312345A" };
  invoice.payment = "DBS 012-345678-9, PayNow UEN 201912345K";
  invoice.notes = "Thank you for your business.";
  return Object.assign(invoice, overrides);
}

/** An item with the given figures, for the money tables. */
export function item(quantity, unitPrice, discountType = "none", discountValue = "", text = "Work") {
  return { id: `item-${quantity}-${unitPrice}-${discountValue}`, description: text, quantity, unit: "", unitPrice, discountType, discountValue };
}

/** An invoice of just these items, with GST and an overall discount as given. */
export function invoiceOf(items, { gst = false, rate = "9", overall = { type: "none", value: "" }, regNo = "" } = {}) {
  const invoice = newInvoice({ today: "2026-10-31" });
  invoice.items = items;
  invoice.overallDiscount = overall;
  invoice.gst = { on: gst, rate, regNo };
  return invoice;
}

/** A working localStorage, kept in a Map. */
export function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/** Storage the browser blocks: every call throws. */
export function blockedStorage() {
  const fail = () => {
    throw new Error("SecurityError");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

/** Storage that is nearly full: values over `limit` characters are refused. */
export function fullStorage(limit = 100 * 1024) {
  const storage = memoryStorage();
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (String(value).length > limit) throw new Error("QuotaExceededError");
    setItem(key, value);
  };
  return storage;
}
