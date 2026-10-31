/**
 * The required-field check for a tax invoice (PRD §2 criterion 5, decision D4,
 * technical.md §5, test-strategy.md C5): one case per field, in form order,
 * each linked to its input. Checked only while GST is on.
 */
import { describe, expect, it } from "vitest";

import { quoteTotals } from "../quote-builder/calc.js";
import COPY from "./copy.js";
import { sampleInvoice } from "./fixtures.js";
import { missingFields } from "./required.js";

const check = (invoice) => missingFields(invoice, quoteTotals(invoice));
const blank = (path, value = "") => (invoice) => {
  const [section, key] = path.split(".");
  invoice[section][key] = value;
};

describe("missingFields (decision D4)", () => {
  it("lists nothing for a complete tax invoice", () => {
    expect(check(sampleInvoice(3))).toEqual([]);
  });

  it("lists nothing with GST off, however empty the invoice", () => {
    const invoice = sampleInvoice(3);
    invoice.gst = { on: false, rate: "", regNo: "" };
    invoice.business.name = "";
    invoice.customer.address = "";
    invoice.items = [];
    expect(check(invoice)).toEqual([]);
  });

  it.each([
    ["businessName", "Business name", "ib-business-name", blank("business.name")],
    ["businessAddress", "Address", "ib-business-address", blank("business.address")],
    ["gstRegNo", "GST registration number", "ib-gst-reg", blank("gst.regNo")],
    ["customerName", "Company or customer name", "ib-customer-company", blank("customer.company")],
    ["customerAddress", "Customer address", "ib-customer-address", blank("customer.address")],
    ["number", "Invoice number", "ib-number", blank("details.number")],
    ["date", "Invoice date", "ib-date", blank("details.date")],
    ["gstRate", "GST rate (%)", "ib-gst-rate", blank("gst.rate")],
  ])("lists %s, and only it, when it is blank", (key, label, target, empty) => {
    const invoice = sampleInvoice(3);
    empty(invoice);
    expect(check(invoice)).toEqual([{ key, label, target }]);
  });

  it.each([
    ["business.name"],
    ["business.address"],
    ["gst.regNo"],
    ["customer.company"],
    ["customer.address"],
    ["details.number"],
  ])("counts whitespace-only %s as missing", (path) => {
    const invoice = sampleInvoice(3);
    blank(path, "  \n\t ")(invoice);
    expect(check(invoice)).toHaveLength(1);
  });

  it("never fills an empty business name with Jura's: it is missing", () => {
    const invoice = sampleInvoice(2);
    invoice.business.name = "";
    expect(check(invoice).map((entry) => entry.key)).toEqual(["businessName"]);
  });

  it.each([["31/10/2026"], ["2026-10"], ["soon"]])("lists an invoice date that is not a date (%s)", (date) => {
    const invoice = sampleInvoice(2);
    invoice.details.date = date;
    expect(check(invoice).map((entry) => entry.key)).toEqual(["date"]);
  });

  it.each([["abc"], ["101"], ["  "]])("lists a GST rate that is not a rate from 0 to 100 (%s)", (rate) => {
    const invoice = sampleInvoice(2);
    invoice.gst.rate = rate;
    expect(check(invoice)).toEqual([{ key: "gstRate", label: "GST rate (%)", target: "ib-gst-rate" }]);
  });

  it("accepts a GST rate of 0 and of 8.5", () => {
    for (const rate of ["0", "8.5"]) {
      const invoice = sampleInvoice(2);
      invoice.gst.rate = rate;
      expect(check(invoice), rate).toEqual([]);
    }
  });

  it("lists Items, linked to Add item, when there are no items", () => {
    const invoice = sampleInvoice(2);
    invoice.items = [];
    expect(check(invoice)).toEqual([{ key: "items", label: "Items", target: "ib-add-item" }]);
  });

  it("lists Items, linked to the first description, when the only line is still blank", () => {
    const invoice = sampleInvoice(1);
    invoice.items[0] = { ...invoice.items[0], description: "", unitPrice: "" };
    expect(check(invoice)).toEqual([{ key: "items", label: "Items", target: "qb-item-item-0-description" }]);
  });

  it("lists Items, linked to the first quantity, when no line has a quantity above zero", () => {
    const invoice = sampleInvoice(2);
    invoice.items.forEach((line) => {
      line.quantity = "0";
    });
    expect(check(invoice)).toEqual([{ key: "items", label: "Items", target: "qb-item-item-0-quantity" }]);
  });

  it("lists each counted line with no description, by its number in the form", () => {
    const invoice = sampleInvoice(4);
    invoice.items[1].description = "";
    invoice.items[3].description = "   ";
    // Item 3 has no quantity, so it is left off the invoice and not listed.
    invoice.items[2].quantity = "";
    invoice.items[2].description = "";
    expect(check(invoice)).toEqual([
      { key: "item-item-1-description", label: "Description for item 2", target: "qb-item-item-1-description" },
      { key: "item-item-3-description", label: "Description for item 4", target: "qb-item-item-3-description" },
    ]);
  });

  it("lists everything, in the order of the form, when everything is blank", () => {
    const invoice = sampleInvoice(1);
    invoice.business = { ...invoice.business, name: "", address: "" };
    invoice.customer = { company: "", contact: "", address: "", email: "" };
    invoice.details = { number: "", date: "", dueDate: "" };
    invoice.gst = { on: true, rate: "", regNo: "" };
    invoice.items = [];
    expect(check(invoice).map((entry) => entry.label)).toEqual([
      "Business name",
      "Address",
      "GST registration number",
      "Company or customer name",
      "Customer address",
      "Invoice number",
      "Invoice date",
      "GST rate (%)",
      "Items",
    ]);
  });

  it("uses the PRD's labels, so each entry reads as Please add: {field}", () => {
    const invoice = sampleInvoice(1);
    invoice.business.name = "";
    const [entry] = check(invoice);
    expect(COPY.missing.field(entry.label)).toBe("Please add: Business name");
  });
});
