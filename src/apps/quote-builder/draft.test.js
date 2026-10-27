import { describe, expect, it } from "vitest";
import COPY from "./copy.js";
import { quoteTotals } from "./calc.js";
import { newQuote } from "./model.js";
import { applyDraft, draftFailure } from "./draft.js";

const DRAFT = {
  summary: "Setting up a planter area with faux plants.",
  customer: { company: null, contact: null, address: null, email: null },
  items: [
    { description: "Site visit and measurement", quantity: null, unit: null, unit_price: 200 },
    { description: "Design concept and 3D render", quantity: 1, unit: null, unit_price: 200 },
    { description: "Planter box (200 x 100 x 70)", quantity: 1, unit: "pcs", unit_price: 350 },
    { description: "Custom fabrication, including lining, tray and other equipment", quantity: 1, unit: null, unit_price: 300 },
    { description: "Faux plants (non-custom)", quantity: 1, unit: null, unit_price: 700 },
    { description: "Installation", quantity: 1, unit: null, unit_price: null },
  ],
};

describe("applying a draft", () => {
  it("replaces the items, with a blank price where the draft has none", () => {
    const quote = applyDraft(newQuote({ today: "2026-10-26" }), DRAFT, COPY);
    expect(quote.items).toHaveLength(6);
    expect(quote.items[0]).toMatchObject({ description: "Site visit and measurement", quantity: "1", unit: "", unitPrice: "200" });
    expect(quote.items[2]).toMatchObject({ unit: "pcs", unitPrice: "350" });
    expect(quote.items[5].unitPrice).toBe("");
    expect(new Set(quote.items.map((i) => i.id)).size).toBe(6);
    expect(quoteTotals(quote).subtotal).toBe(175000n);
  });

  it("shows cents as two places", () => {
    const quote = applyDraft(newQuote(), { ...DRAFT, items: [{ description: "Bolt", quantity: 2.5, unit: "kg", unit_price: 99.5 }] }, COPY);
    expect(quote.items[0]).toMatchObject({ quantity: "2.5", unitPrice: "99.50" });
  });

  it("fills only the customer fields the draft names", () => {
    const start = newQuote();
    start.customer = { company: "", contact: "Dr Lim", address: "", email: "lim@example.com" };
    const quote = applyDraft(start, { ...DRAFT, customer: { company: "Harbourfront Dental", contact: null, address: null, email: null } }, COPY);
    expect(quote.customer).toEqual({ company: "Harbourfront Dental", contact: "Dr Lim", address: "", email: "lim@example.com" });
  });

  it("puts the scope above the notes, and a second draft replaces it", () => {
    const first = applyDraft(newQuote(), DRAFT, COPY);
    expect(first.notes).toBe(`Scope: ${DRAFT.summary}\n\n${COPY.defaultNotes}`);
    const second = applyDraft(first, { ...DRAFT, summary: "Something else." }, COPY);
    expect(second.notes).toBe(`Scope: Something else.\n\n${COPY.defaultNotes}`);
    const none = applyDraft(second, { ...DRAFT, summary: null }, COPY);
    expect(none.notes).toBe(COPY.defaultNotes);
  });

  it("leaves the business, number, dates and GST alone", () => {
    const start = newQuote({ today: "2026-10-26" });
    start.details.number = "Q-0042";
    start.gst.on = true;
    const quote = applyDraft(start, DRAFT, COPY);
    expect(quote.business).toBe(start.business);
    expect(quote.details).toBe(start.details);
    expect(quote.gst).toBe(start.gst);
  });
});

describe("what a failed draft says", () => {
  const E = COPY.ai.errors;
  it("names the bot check and a too-long request", () => {
    expect(draftFailure({ status: 403, triesBefore: 3 }, COPY)).toBe(E.botCheck);
    expect(draftFailure({ status: 413, triesBefore: 3 }, COPY)).toBe(E.tooLong);
  });

  it("says the try wasn't counted only when it came back", () => {
    expect(draftFailure({ status: 502, body: { triesLeft: 3 }, triesBefore: 3 }, COPY)).toBe(`${E.unreadable} ${E.notCounted}`);
    expect(draftFailure({ status: 502, body: { triesLeft: 2 }, triesBefore: 3 }, COPY)).toBe(E.unreadable);
    expect(draftFailure({ status: 503, body: {}, triesBefore: 3 }, COPY)).toBe(`${E.unavailable} ${E.notCounted}`);
    expect(draftFailure({ status: 0, body: {}, triesBefore: 3 }, COPY)).toBe(E.unavailable);
  });

  it("keeps its own words for output it could not use, and says when drafting is busy", () => {
    const badOutput = { status: 503, body: { error: "unavailable", reason: "bad_output", triesLeft: 3 }, triesBefore: 3 };
    expect(draftFailure(badOutput, COPY)).toBe(`${E.unreadable} ${E.notCounted}`);
    const busy = { status: 503, body: { error: "busy", triesLeft: 3 }, triesBefore: 3 };
    expect(draftFailure(busy, COPY)).toBe(`${E.busy} ${E.notCounted}`);
  });
});
