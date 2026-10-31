/**
 * PRD §2 criterion 12, the part a test can check: every PRD §5.2 string is in
 * copy.js word for word, and no string breaks the voice rules a machine can
 * see. `jura-growth check` itself is run by hand (decision D19).
 */
import { describe, expect, it } from "vitest";
import COPY from "./copy.js";

/** Every string in the copy, functions called with sample arguments. */
function allStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") allStrings(value.length === 2 ? value(1, 2) : value(true), out), allStrings(value(false), out);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

const strings = allStrings(COPY);

describe("the invoice builder's copy", () => {
  it.each([
    ["title", COPY.title, "Invoice builder"],
    ["subtitle", COPY.subtitle, "Make a clean invoice with your logo and download it as a PDF, with or without GST."],
    ["privacy note", COPY.privacy, "Everything you type stays in your browser. Nothing is sent to us."],
    ["remember", COPY.remember, "Remember my business details on this device"],
    ["section: business", COPY.sections.business, "Your business"],
    ["section: customer", COPY.sections.customer, "Your customer"],
    ["section: details", COPY.sections.details, "Invoice details"],
    ["section: items", COPY.sections.items, "Items"],
    ["section: payment", COPY.sections.payment, "Payment details"],
    ["section: notes", COPY.sections.notes, "Notes"],
    ["Business name", COPY.business.name, "Business name"],
    ["Address", COPY.business.address, "Address"],
    ["UEN (optional)", COPY.business.uen, "UEN (optional)"],
    ["Phone", COPY.business.phone, "Phone"],
    ["Email", COPY.business.email, "Email"],
    ["Logo", COPY.business.logo, "Logo"],
    ["Company or customer name", COPY.customer.company, "Company or customer name"],
    ["Contact name", COPY.customer.contact, "Contact name"],
    ["Customer address", COPY.customer.address, "Customer address"],
    ["Customer email", COPY.customer.email, "Customer email"],
    ["Invoice number", COPY.details.number, "Invoice number"],
    ["Invoice date", COPY.details.date, "Invoice date"],
    ["Due date (optional)", COPY.details.dueDate, "Due date (optional)"],
    ["Description", COPY.items.description, "Description"],
    ["Quantity", COPY.items.quantity, "Quantity"],
    ["Unit", COPY.items.unit, "Unit"],
    ["Unit price", COPY.items.unitPrice, "Unit price"],
    ["Line discount", COPY.items.discountType, "Line discount"],
    ["Overall discount", COPY.discount.type, "Overall discount"],
    ["Charge GST", COPY.gst.switch, "Charge GST"],
    ["GST rate (%)", COPY.gst.rate, "GST rate (%)"],
    ["GST registration number", COPY.gst.regNo, "GST registration number"],
    ["Subtotal", COPY.totals.subtotal, "Subtotal"],
    ["Discount", COPY.totals.discount, "Discount"],
    ["Amount before GST", COPY.totals.taxable, "Amount before GST"],
    ["GST", COPY.totals.gst, "GST"],
    ["Amount with GST", COPY.totals.withGst, "Amount with GST"],
    ["Total", COPY.totals.total, "Total"],
    ["empty items", COPY.emptyItems, "Add your first item to see the total."],
    ["zero quantity", COPY.zeroQuantity, "Items with no quantity are left off the invoice."],
    ["GST helper", COPY.gst.helper, "Only switch this on if your business is GST-registered. Your invoice will then be titled Tax invoice."],
    ["GST rate helper", COPY.gst.rateHelper, "Set to the current rate on the IRAS website. Please check the figures before you send your invoice."],
    ["payment helper", COPY.payment.helper, "Tell your customer how to pay you, such as your bank account or PayNow details."],
    ["missing heading", COPY.missing.heading, "A few details are still needed for a tax invoice"],
    ["missing field", COPY.missing.field("Invoice date"), "Please add: Invoice date"],
    ["Add item", COPY.buttons.addItem, "Add item"],
    ["Download PDF", COPY.buttons.downloadPdf, "Download PDF"],
    ["Save invoice file", COPY.buttons.saveFile, "Save invoice file"],
    ["Open invoice file", COPY.buttons.openFile, "Open invoice file"],
    ["Open quote file", COPY.buttons.openQuote, "Open quote file"],
    ["New invoice", COPY.buttons.newInvoice, "New invoice"],
    ["bad file", COPY.badFile, "That file doesn't look like one saved from our quote or invoice builder."],
    ["logo too big", COPY.logoTooBig, "Please use a logo under 1 MB."],
    ["talk heading", COPY.talk.heading, "Invoices raised from the work you've done"],
    ["talk body", COPY.talk.body, "We can connect your invoicing to your quotes, jobs and accounts, so each detail is typed one time."],
    ["talk button", COPY.talk.button, "Tell us how you invoice today"],
  ])("has the PRD's %s word for word", (_, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it.each([
    ["D6 quote with GST in its prices", COPY.quoteIncludedGst, "This quote's prices include GST. Your invoice adds GST on top, so change each unit price to the amount before GST."],
    ["D10 dialog title", COPY.newInvoiceDialog.title, "Start a new invoice"],
    ["D10 dialog body", COPY.newInvoiceDialog.body, "Your business details stay. The customer, items and notes are cleared."],
    ["D10 cancel", COPY.newInvoiceDialog.cancel, "Keep editing"],
    ["D10 confirm", COPY.newInvoiceDialog.confirm, "Start a new invoice"],
    ["D12 due date note", COPY.details.dueBeforeDate, "The due date is before the invoice date."],
    ["D4 no items", COPY.missing.field(COPY.missing.items), "Please add: Items"],
    ["D4 item description", COPY.missing.field(COPY.missing.itemDescription(2)), "Please add: Description for item 2"],
  ])("has decision %s as agreed", (_, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("titles the PDF Tax invoice only with GST on", () => {
    expect(COPY.pdf.title(true)).toBe("Tax invoice");
    expect(COPY.pdf.title(false)).toBe("Invoice");
  });

  it("has no exclamation marks, emoji or Jura name", () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/!/);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s, s).not.toMatch(/jura/i);
    }
  });

  it("never says the document meets IRAS rules", () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/compl(y|ies|iant|iance)|meets|approved|valid tax invoice|inland revenue/i);
    }
  });

  it("is in sentence case: no word after the first is capitalised unless it is a name", () => {
    const names = /^(GST|PDF|UEN|IRAS|PayNow|SGD|Tax|MB|PNG|JPG|SVG|I|Page|Item|INV|Edit|Preview|Invoice)$/;
    for (const s of strings) {
      for (const sentence of s.split(/[.:] /)) {
        const words = sentence.replace(/[.,:;()?]/g, "").split(/\s+/).slice(1);
        for (const word of words) {
          if (/^[A-Z][a-z]/.test(word)) expect(word, s).toMatch(names);
        }
      }
    }
  });
});
