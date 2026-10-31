/**
 * PRD §2 criterion 9, the logic: "Remember" keeps the business's own details
 * on this device and nothing about the customer, and the tool keeps working
 * when storage is blocked or full (decision D11).
 */
import { describe, expect, it, vi } from "vitest";

import { REMEMBER_KEY, forgetBusiness, loadBusiness, saveBusiness } from "./remember.js";
import { blockedStorage, fullStorage, memoryStorage, sampleInvoice } from "./fixtures.js";

const LOGO = { dataUrl: `data:image/png;base64,${"A".repeat(200 * 1024)}`, width: 40, height: 20 };

const useStorage = (storage) => {
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
};

const remembered = (invoice, lastNumber = "INV-20261031-01") => ({
  business: invoice.business,
  gst: invoice.gst,
  payment: invoice.payment,
  lastNumber,
});

describe("remembered business details", () => {
  it("uses its own key", () => {
    expect(REMEMBER_KEY).toBe("jura.invoice-builder.business.v1");
  });

  it("keeps the business, GST setting, payment details and last number, and nothing else", () => {
    const storage = useStorage(memoryStorage());
    const invoice = sampleInvoice(3);
    expect(saveBusiness(remembered(invoice))).toBe(true);

    const stored = JSON.parse(storage.map.get(REMEMBER_KEY));
    expect(Object.keys(stored).sort()).toEqual(["business", "gst", "lastNumber", "payment"]);
    const text = storage.map.get(REMEMBER_KEY);
    for (const kept of ["Harbourfront", "Dr Lim", "Aircon servicing", "Thank you", "2026-11-30"]) {
      expect(text).not.toContain(kept);
    }

    expect(loadBusiness()).toEqual({
      business: invoice.business,
      gst: { on: true, rate: "9", regNo: "M90312345A" },
      payment: invoice.payment,
      lastNumber: "INV-20261031-01",
    });
  });

  it("returns nothing when nothing is stored", () => {
    useStorage(memoryStorage());
    expect(loadBusiness()).toBe(null);
  });

  it("forgets on request", () => {
    const storage = useStorage(memoryStorage());
    saveBusiness(remembered(sampleInvoice(1)));
    forgetBusiness();
    expect(storage.map.has(REMEMBER_KEY)).toBe(false);
    expect(loadBusiness()).toBe(null);
  });

  it("keeps the words without the logo when the logo fills the storage", () => {
    useStorage(fullStorage(100 * 1024));
    const invoice = sampleInvoice(1);
    invoice.business.logo = LOGO;
    expect(saveBusiness(remembered(invoice))).toBe(true);
    const loaded = loadBusiness();
    expect(loaded.business).toEqual({ ...invoice.business, logo: null });
    expect(loaded.payment).toBe(invoice.payment);
  });

  it("never throws when storage is blocked, and says it could not save", () => {
    useStorage(blockedStorage());
    expect(saveBusiness(remembered(sampleInvoice(1)))).toBe(false);
    expect(loadBusiness()).toBe(null);
    expect(() => forgetBusiness()).not.toThrow();
  });

  it("checks what it reads back: junk is ignored, and anything long is cut to the limits", () => {
    const storage = useStorage(memoryStorage());
    storage.setItem(REMEMBER_KEY, JSON.stringify({ business: { name: 42 } }));
    expect(loadBusiness()).toBe(null);

    storage.setItem(
      REMEMBER_KEY,
      JSON.stringify({
        business: { name: "Tan" },
        gst: { on: "yes", rate: 9, regNo: "M1", inclusive: true },
        payment: "x".repeat(5000),
        lastNumber: 7,
      })
    );
    const loaded = loadBusiness();
    expect(loaded.business.name).toBe("Tan");
    expect(loaded.gst).toEqual({ on: false, rate: "9", regNo: "M1" });
    expect(loaded.payment).toHaveLength(1000);
    expect(loaded.lastNumber).toBe("");
  });

  it("does not read the quote builder's remembered details", () => {
    const storage = useStorage(memoryStorage());
    storage.setItem("jura.quote-builder.business.v1", JSON.stringify({ business: { name: "Tan" } }));
    expect(loadBusiness()).toBe(null);
  });
});
