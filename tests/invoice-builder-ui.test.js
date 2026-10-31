/**
 * The invoice builder's page, form and preview, as first rendered (effects do
 * not run here): labels, descriptions, live regions, tap targets, the GST-off
 * preview, and Remember (PRD §2 criteria 3, 4, 9, 10, 11).
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import InvoiceBuilder from "../src/apps/invoice-builder/index.jsx";
import { InvoiceForm } from "../src/apps/invoice-builder/InvoiceForm.jsx";
import { InvoicePreview } from "../src/apps/invoice-builder/InvoicePreview.jsx";
import COPY from "../src/apps/invoice-builder/copy.js";
import { newInvoice } from "../src/apps/invoice-builder/model.js";
import { invoiceTotalsRows } from "../src/apps/invoice-builder/totals-rows.js";
import { buildInvoicePdf } from "../src/apps/invoice-builder/pdf.js";
import { REMEMBER_KEY } from "../src/apps/invoice-builder/remember.js";
import { blockedStorage, invoiceOf, item, memoryStorage, sampleInvoice } from "../src/apps/invoice-builder/fixtures.js";
import { quoteTotals } from "../src/apps/quote-builder/calc.js";

const h = React.createElement;
const html = (element) => renderToStaticMarkup(element);
const decode = (s) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

const tagWithId = (markup, id) => markup.match(new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? "";
const describedBy = (markup, id) => tagWithId(markup, id).match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
const textOf = (markup, id) => decode(markup.match(new RegExp(`\\bid="${id}"[^>]*>([^<]*)<`))?.[1] ?? "");
const labelFor = (markup, id) => decode(markup.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([^<]*)<`))?.[1] ?? "");
const buttonWith = (markup, label) =>
  markup.match(new RegExp(`<button(?:(?!<button).)*?>(?:(?!</button>).)*${label}</button>`, "s"))?.[0] ?? "";

const app = { slug: "invoice-builder" };

function form(invoice = newInvoice({ today: "2026-10-31" }), props = {}) {
  return html(
    h(InvoiceForm, {
      invoice,
      setInvoice: () => {},
      totals: quoteTotals(invoice),
      copy: COPY,
      remember: false,
      onRemember: () => {},
      rememberBlocked: false,
      onLogo: () => {},
      logoError: "",
      ...props,
    })
  );
}

const page = (storage = memoryStorage()) => {
  vi.stubGlobal("window", { localStorage: storage });
  return html(h(InvoiceBuilder, { app, copy: COPY }));
};

/** Every form control in the markup that a label, wrapping or by `for`, or aria-label does not name. */
function unlabelled(markup) {
  const withoutWrapped = markup.replace(/<label(?:(?!<\/label>).)*<\/label>/gs, (label) =>
    /<(input|select|textarea)\b/.test(label) && !/\bfor="/.test(label) ? "" : label
  );
  const controls = withoutWrapped.match(/<(input|select|textarea)\b[^>]*>/g) ?? [];
  return controls.filter((tag) => {
    if (/aria-label(ledby)?="/.test(tag)) return false;
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    return !(id && markup.includes(`for="${id}"`));
  });
}

describe("the invoice form", () => {
  const markup = form();

  it("has the PRD's section headings", () => {
    const legends = [...markup.matchAll(/<legend[^>]*>([^<]*)</g)].map((m) => m[1]);
    for (const heading of ["Your business", "Your customer", "Invoice details", "Items", "Payment details", "Notes"]) {
      expect(legends).toContain(heading);
    }
  });

  it.each([
    ["ib-business-name", "Business name"],
    ["ib-business-address", "Address"],
    ["ib-business-uen", "UEN (optional)"],
    ["ib-business-phone", "Phone"],
    ["ib-business-email", "Email"],
    ["ib-customer-company", "Company or customer name"],
    ["ib-customer-contact", "Contact name"],
    ["ib-customer-address", "Customer address"],
    ["ib-customer-email", "Customer email"],
    ["ib-number", "Invoice number"],
    ["ib-date", "Invoice date"],
    ["ib-due", "Due date (optional)"],
    ["ib-overall-type", "Overall discount"],
    ["ib-payment", "Payment details"],
    ["ib-notes", "Notes"],
  ])("labels %s as %s", (id, label) => {
    expect(tagWithId(markup, id)).not.toBe("");
    expect(labelFor(markup, id)).toBe(label);
  });

  it("labels each item's fields with the PRD's words", () => {
    const id = newInvoice().items[0].id;
    const invoice = newInvoice({ today: "2026-10-31" });
    const itemMarkup = form(invoice);
    const itemId = invoice.items[0].id;
    expect(id).not.toBe(itemId);
    expect(labelFor(itemMarkup, `qb-item-${itemId}-description`)).toBe("Description");
    expect(labelFor(itemMarkup, `qb-item-${itemId}-quantity`)).toBe("Quantity");
    expect(labelFor(itemMarkup, `qb-item-${itemId}-unit`)).toBe("Unit");
    expect(labelFor(itemMarkup, `qb-item-${itemId}-price`)).toBe("Unit price");
    expect(labelFor(itemMarkup, `qb-item-${itemId}-discount-type`)).toBe("Line discount");
  });

  it("shows the Logo label and the Remember checkbox", () => {
    expect(markup).toContain(">Logo<");
    expect(markup).toContain("Remember my business details on this device");
  });

  it("names every input, select and textarea", () => {
    expect(unlabelled(markup)).toEqual([]);
    expect(unlabelled(form(sampleInvoice(3)))).toEqual([]);
  });

  it("puts the suggested number in the field as real text", () => {
    expect(tagWithId(markup, "ib-number")).toContain('value="INV-20261031-01"');
  });

  it("offers no placeholder business name: never Jura's", () => {
    expect(tagWithId(markup, "ib-business-name")).not.toContain("placeholder");
    expect(markup).not.toMatch(/jura/i);
  });

  it("links the payment helper to the payment details", () => {
    expect(textOf(markup, describedBy(markup, "ib-payment"))).toBe(COPY.payment.helper);
  });

  it("notes a due date before the invoice date, linked to the field (decision D12)", () => {
    const invoice = newInvoice({ today: "2026-10-31" });
    invoice.details.dueDate = "2026-10-01";
    const early = form(invoice);
    expect(textOf(early, describedBy(early, "ib-due"))).toBe("The due date is before the invoice date.");
    invoice.details.dueDate = "2026-11-30";
    expect(form(invoice)).not.toContain("The due date is before");
    expect(describedBy(form(invoice), "ib-due")).toBe("");
  });

  it("says when there are no items, and when a line has no quantity", () => {
    const empty = newInvoice({ today: "2026-10-31" });
    empty.items = [];
    expect(decode(form(empty))).toContain("Add your first item to see the total.");

    const zero = invoiceOf([item("0", "10", "none", "", "Callout")]);
    expect(form(zero)).toContain("Items with no quantity are left off the invoice.");
  });

  it("names the move and remove buttons for their item", () => {
    const markup3 = form(sampleInvoice(3));
    for (const name of ["Move item 2 up", "Move item 2 down", "Remove item 2"]) expect(markup3).toContain(`aria-label="${name}"`);
  });

  it("shows an inline error on a figure the totals can't read", () => {
    const invoice = sampleInvoice(1);
    invoice.items[0].quantity = "two";
    const markup1 = form(invoice);
    const id = `qb-item-${invoice.items[0].id}-quantity`;
    expect(textOf(markup1, describedBy(markup1, id))).toBe(COPY.errors.invalidNumber);
  });

  it("links the blocked-storage hint to the Remember checkbox", () => {
    const blocked = form(undefined, { rememberBlocked: true });
    const checkbox = blocked.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? "";
    const why = checkbox.match(/aria-describedby="([^"]+)"/)?.[1] ?? "";
    expect(textOf(blocked, why)).toBe(COPY.rememberBlocked);
  });

  it("leaves the GST fields to ticket 03: nothing of GST shows with GST off", () => {
    expect(markup).not.toContain("GST registration number");
    expect(markup).not.toContain("GST rate (%)");
  });
});

describe("the invoice preview with GST off", () => {
  const preview = (invoice) => decode(html(h(InvoicePreview, { invoice, totals: quoteTotals(invoice), copy: COPY })));

  it("is titled Invoice and never says GST, even with a registration number typed", () => {
    for (const overall of [{ type: "none", value: "" }, { type: "percent", value: "5" }]) {
      const invoice = sampleInvoice(5, { overallDiscount: overall });
      invoice.gst.on = false;
      const markup = preview(invoice);
      expect(markup).toContain(">Invoice<");
      expect(markup).not.toMatch(/tax invoice|GST/i);
      expect(markup).not.toContain("M90312345A");
    }
  });

  it("shows the same title and totals rows as the PDF", async () => {
    for (const overall of [{ type: "none", value: "" }, { type: "amount", value: "36.50" }]) {
      const invoice = invoiceOf([item("3", "45.50"), item("2.5", "80")], { overall });
      invoice.business.name = "Tan Brothers";
      const totals = quoteTotals(invoice);
      const markup = preview(invoice);
      const { ops } = await buildInvoicePdf(invoice, totals, COPY);
      const pdfTotals = ops.filter((o) => o.kind === "total").map((o) => o.text);
      const { rows, final } = invoiceTotalsRows(invoice, totals, COPY);
      const expected = [...rows, final].flatMap(({ label, value }) => [label, value]);
      expect(pdfTotals).toEqual(expected);
      const dl = markup.match(/<dl class="qb-paper-totals">(.*?)<\/dl>/s)?.[1] ?? "";
      expect([...dl.matchAll(/<d[td][^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(expected);
      expect(markup).toContain(`>${ops.find((o) => o.kind === "title").text}<`);
    }
  });

  it("shows every amount with two decimals, 0.10 and 0.20 as 0.30", () => {
    const invoice = invoiceOf([item("1", "0.10"), item("1", "0.20")]);
    const markup = preview(invoice);
    expect(markup).toContain(">0.30<");
    expect(markup).not.toMatch(/0\.30000/);
  });

  it("shows the payment details and the due date, and leaves out what is empty", () => {
    const invoice = sampleInvoice(2);
    invoice.gst.on = false;
    const full = preview(invoice);
    for (const text of ["Payment details", "DBS 012-345678-9, PayNow UEN 201912345K", "Due date", "30 Nov 2026", "Bill to"]) {
      expect(full).toContain(text);
    }
    invoice.payment = "";
    invoice.details.dueDate = "";
    const bare = preview(invoice);
    expect(bare).not.toContain("Payment details");
    expect(bare).not.toContain("Due date");
  });
});

describe("the invoice builder page", () => {
  it("switches Edit and Preview with two pressed-state buttons", () => {
    const markup = page();
    expect(markup).not.toContain('role="tab"');
    expect(buttonWith(markup, COPY.view.edit)).toContain('aria-pressed="true"');
    expect(buttonWith(markup, COPY.view.preview)).toContain('aria-pressed="false"');
  });

  it("keeps a live region for the export messages before any appear", () => {
    expect(page()).toMatch(/<div class="tb-live[^"]*" aria-live="polite"><\/div>/);
  });

  it("offers Download PDF and New invoice", () => {
    const markup = page();
    expect(buttonWith(markup, "Download PDF")).not.toBe("");
    expect(buttonWith(markup, "New invoice")).not.toBe("");
  });

  it("brings back remembered details and ticks Remember", () => {
    const storage = memoryStorage();
    storage.setItem(
      REMEMBER_KEY,
      JSON.stringify({
        business: { name: "Tan Brothers", address: "10 Ubi Crescent" },
        gst: { on: false, rate: "9", regNo: "M90312345A" },
        payment: "PayNow UEN 201912345K",
        lastNumber: "",
      })
    );
    const markup = page(storage);
    expect(tagWithId(markup, "ib-business-name")).toContain('value="Tan Brothers"');
    expect(markup).toContain("PayNow UEN 201912345K");
    expect(markup.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]).toContain('checked=""');
  });

  it("starts empty and unticked when nothing is remembered", () => {
    const markup = page();
    expect(tagWithId(markup, "ib-business-name")).toContain('value=""');
    expect(markup.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]).not.toContain('checked=""');
  });

  it("renders the whole tool when storage is blocked", () => {
    const markup = page(blockedStorage());
    expect(buttonWith(markup, "Download PDF")).not.toBe("");
    expect(tagWithId(markup, "ib-business-name")).not.toBe("");
  });

  it("uses design-system buttons or the tap-target size for every button", () => {
    const markup = page();
    const css = fs.readFileSync(new URL("../src/apps/quote-builder/quote-builder.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.qb-view\s*\{[^}]*min-height:\s*var\(--tap-min\)/);
    for (const button of markup.match(/<button[^>]*>/g) ?? []) {
      const ownStyled = /class="qb-view"/.test(button);
      const sized = /min-height|height:\s*(4[4-9]|5\d)px|var\(--(tap-min|control-h-lg)\)/.test(button);
      expect(ownStyled || sized, button).toBe(true);
    }
    for (const select of markup.match(/<select[^>]*>/g) ?? []) expect(select).toContain("min-height:var(--tap-min)");
  });

  it("styles itself with the quote builder's layout and tokens only, with no colour literals", () => {
    const folder = new URL("../src/apps/invoice-builder/", import.meta.url);
    const index = fs.readFileSync(new URL("index.jsx", folder), "utf8");
    expect(index).toContain('import "../quote-builder/quote-builder.css";');
    const own = fs.readdirSync(folder).filter((name) => name.endsWith(".css"));
    for (const name of [...own.map((n) => new URL(n, folder)), new URL("../src/apps/quote-builder/quote-builder.css", import.meta.url)]) {
      expect(fs.readFileSync(name, "utf8"), String(name)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
    for (const name of ["InvoiceForm.jsx", "InvoicePreview.jsx", "index.jsx"]) {
      expect(fs.readFileSync(new URL(name, folder), "utf8"), name).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
  });
});
