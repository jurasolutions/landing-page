import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import COPY from "./copy.js";
import { LIMITS } from "./model.js";
import {
  BadFile,
  date,
  readBusinessFields,
  readCustomer,
  readItems,
  readOverallDiscount,
  text,
} from "./quoteFile.js";
import { wrapText } from "./pdf-text.js";
import { wrapText as wrapTextFromPdf } from "./pdf.js";
import { Fieldset, ItemEditor, NumberField, TextField, errorText } from "./form-parts.jsx";

/**
 * The quote builder pieces other tools reuse (the invoice builder first):
 * the file's section readers, the PDF's text wrapping and the form fields.
 * The quote builder's own tests guard its behaviour; these pin the homes.
 */

describe("the quote file's section readers", () => {
  it("read the business fields with the logo checked", () => {
    expect(readBusinessFields({ name: "Tan Brothers", email: "hi@tan.example" })).toEqual({
      name: "Tan Brothers",
      address: "",
      uen: "",
      phone: "",
      email: "hi@tan.example",
      logo: null,
    });
    expect(() => readBusinessFields({ logo: { dataUrl: "data:text/html;base64,AA==", width: 1, height: 1 } })).toThrow(
      BadFile
    );
  });

  it("read the customer and treat a missing section as empty", () => {
    expect(readCustomer({ company: "Harbourfront Dental" })).toEqual({
      company: "Harbourfront Dental",
      contact: "",
      address: "",
      email: "",
    });
    expect(readCustomer(undefined)).toEqual({ company: "", contact: "", address: "", email: "" });
  });

  it("read items with fresh ids, and refuse a list that is not one", () => {
    const [item] = readItems([{ description: "Servicing", quantity: "2", unitPrice: "80" }]);
    expect(item).toMatchObject({
      description: "Servicing",
      quantity: "2",
      unit: "",
      unitPrice: "80",
      discountType: "none",
      discountValue: "",
    });
    expect(typeof item.id).toBe("string");
    expect(readItems([])).toHaveLength(1);
    expect(() => readItems("lots")).toThrow(BadFile);
    expect(() => readItems(Array.from({ length: LIMITS.items + 1 }, () => ({})))).toThrow(BadFile);
    expect(() => readItems([{ discountType: "free" }])).toThrow(BadFile);
  });

  it("read the overall discount", () => {
    expect(readOverallDiscount({ type: "percent", value: "10" })).toEqual({ type: "percent", value: "10" });
    expect(readOverallDiscount(undefined)).toEqual({ type: "none", value: "" });
    expect(() => readOverallDiscount({ type: "half" })).toThrow(BadFile);
  });

  it("share the text and date checks", () => {
    expect(text(undefined, 5)).toBe("");
    expect(() => text(undefined, 5, { required: true })).toThrow(BadFile);
    expect(() => text("too long", 5)).toThrow(BadFile);
    expect(date("2026-10-31")).toBe("2026-10-31");
    expect(() => date("31/10/2026")).toThrow(BadFile);
  });
});

describe("wrapText", () => {
  // Every character is 1pt wide at size 1.
  const font = { widthOfTextAtSize: (value, size) => value.length * size };

  it("lives in a module without pdf-lib, and pdf.js still offers it", () => {
    expect(wrapTextFromPdf).toBe(wrapText);
  });

  it("wraps on spaces, keeps paragraphs and breaks a long word", () => {
    expect(wrapText("one two three", font, 1, 7)).toEqual(["one two", "three"]);
    expect(wrapText("a\nb", font, 1, 10)).toEqual(["a", "b"]);
    expect(wrapText("abcdefghij", font, 1, 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("the form parts", () => {
  const h = React.createElement;
  const html = (element) => renderToStaticMarkup(element);

  it("render a labelled field with its note described", () => {
    const markup = html(h(TextField, { id: "x", label: "Name", hint: "Say it", value: "", onChange() {} }));
    expect(markup).toContain('for="x"');
    expect(markup).toContain('aria-describedby="x-note"');
    expect(html(h(NumberField, { id: "n", label: "Qty", value: "1", onChange() {} }))).toContain('inputMode="decimal"');
  });

  it("render a fieldset, an item and the error text", () => {
    expect(html(h(Fieldset, { legend: "Items" }, "x"))).toContain("<legend");
    const item = { id: "i1", description: "", quantity: "1", unit: "", unitPrice: "", discountType: "none", discountValue: "" };
    const markup = html(
      h(ItemEditor, {
        item,
        index: 0,
        count: 1,
        figures: { errors: {}, total: 0n },
        copy: COPY,
        update() {},
        move() {},
        remove() {},
      })
    );
    expect(markup).toContain('id="qb-item-i1-description"');
    expect(errorText("percent", COPY)).toBe(COPY.errors.percent);
    expect(errorText(undefined, COPY)).toBeUndefined();
  });
});
