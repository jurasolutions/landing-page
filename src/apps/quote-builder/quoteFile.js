/**
 * The saved quote file: plain JSON with a format marker and a version, so the
 * tool can tell its own files apart from anything else a visitor picks, and a
 * later version can still read today's files.
 *
 *   { "format": "jura-quote-builder", "version": 2, "savedAt": "...", "quote": { ... } }
 *
 * Opening a file never trusts it: every field is checked for type and length,
 * unknown fields are dropped, and a logo must be a PNG, JPG or SVG data URL
 * within the size limit.
 */
import { LIMITS, emptyItem, newItemId } from "./model.js";

export const FILE_FORMAT = "jura-quote-builder";
// Version 2 added gst.inclusive. A file of either version opens; an older copy
// of the app refuses a version 2 file instead of dropping the choice and
// printing a different total from the same file.
export const FILE_VERSION = 2;
export const LOGO_MAX_BYTES = 1024 * 1024;

const LOGO_URL = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DISCOUNT_TYPES = ["none", "percent", "amount"];

export function serialiseQuote(quote, now = new Date()) {
  return JSON.stringify(
    { format: FILE_FORMAT, version: FILE_VERSION, savedAt: now.toISOString(), quote: stripIds(quote) },
    null,
    2
  );
}

/** Item ids are only for React; files do not need them. */
function stripIds(quote) {
  return { ...quote, items: quote.items.map(({ id, ...rest }) => rest) };
}

class BadFile extends Error {}

function text(value, max, { required = false } = {}) {
  if (value == null) {
    if (required) throw new BadFile("missing");
    return "";
  }
  if (typeof value !== "string" || value.length > max) throw new BadFile("text");
  return value;
}

function oneOf(value, options, fallback) {
  if (value == null) return fallback;
  if (!options.includes(value)) throw new BadFile("option");
  return value;
}

function date(value) {
  const v = text(value, 10);
  if (v && !DATE.test(v)) throw new BadFile("date");
  return v;
}

/** Bytes a base64 payload decodes to. */
export function base64Bytes(dataUrl) {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

function logo(value) {
  if (value == null) return null;
  if (typeof value !== "object") throw new BadFile("logo");
  const dataUrl = text(value.dataUrl, 1.4 * LOGO_MAX_BYTES + 64, { required: true });
  if (!LOGO_URL.test(dataUrl) || base64Bytes(dataUrl) > LOGO_MAX_BYTES) throw new BadFile("logo");
  const width = Number(value.width);
  const height = Number(value.height);
  if (!(width > 0 && width < 20000 && height > 0 && height < 20000)) throw new BadFile("logo");
  return { dataUrl, width, height };
}

function readQuote(raw) {
  if (!raw || typeof raw !== "object") throw new BadFile("quote");
  const b = raw.business ?? {};
  const c = raw.customer ?? {};
  const d = raw.details ?? {};
  const g = raw.gst ?? {};
  const o = raw.overallDiscount ?? {};
  if (!Array.isArray(raw.items) || raw.items.length > LIMITS.items) throw new BadFile("items");

  return {
    business: {
      name: text(b.name, LIMITS.short),
      address: text(b.address, LIMITS.address),
      uen: text(b.uen, LIMITS.short),
      phone: text(b.phone, LIMITS.short),
      email: text(b.email, LIMITS.email),
      logo: logo(b.logo),
    },
    customer: {
      company: text(c.company, LIMITS.short),
      contact: text(c.contact, LIMITS.short),
      address: text(c.address, LIMITS.address),
      email: text(c.email, LIMITS.email),
    },
    details: {
      number: text(d.number, LIMITS.number),
      date: date(d.date),
      validUntil: date(d.validUntil),
    },
    items: (raw.items.length ? raw.items : [emptyItem()]).map((item) => {
      if (!item || typeof item !== "object") throw new BadFile("item");
      return {
        id: newItemId(),
        description: text(item.description, LIMITS.description),
        quantity: text(item.quantity, LIMITS.amount),
        unit: text(item.unit, LIMITS.unit),
        unitPrice: text(item.unitPrice, LIMITS.amount),
        discountType: oneOf(item.discountType, DISCOUNT_TYPES, "none"),
        discountValue: text(item.discountValue, LIMITS.amount),
      };
    }),
    overallDiscount: {
      type: oneOf(o.type, DISCOUNT_TYPES, "none"),
      value: text(o.value, LIMITS.amount),
    },
    gst: {
      on: g.on === true,
      rate: text(g.rate, LIMITS.amount),
      regNo: text(g.regNo, LIMITS.short),
      // Only the boolean true counts, like `on`, so a damaged value opens as exclusive.
      inclusive: g.inclusive === true,
    },
    notes: text(raw.notes, LIMITS.notes),
    madeWith: raw.madeWith !== false,
  };
}

/** Returns { ok: true, quote } or { ok: false } for anything that is not one of our files. */
export function parseQuoteFile(contents) {
  try {
    const data = JSON.parse(contents);
    if (!data || data.format !== FILE_FORMAT) return { ok: false };
    if (!Number.isInteger(data.version) || data.version < 1 || data.version > FILE_VERSION) return { ok: false };
    return { ok: true, quote: readQuote(data.quote) };
  } catch {
    return { ok: false };
  }
}

/** The business details alone, for "Remember my business details". */
export function readBusiness(raw) {
  try {
    return readQuote({ business: raw, items: [] }).business;
  } catch {
    return null;
  }
}
