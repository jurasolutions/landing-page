/**
 * The file-open wiring on the invoice builder's page: `useInvoiceFiles` in
 * FileActions.jsx and its use in index.jsx (PRD §2 criterion 6, decisions D6
 * and D10, code-review-04's should-fix "the useInvoiceFiles wiring has no
 * test").
 *
 * Vitest runs without a DOM, so these tests drive the real page component
 * through a small hook runtime: React's hooks are swapped for a few lines of
 * state while `InvoiceBuilder` itself is called, and everything else (the
 * elements it returns, and rendering them to markup) is real React. Effects
 * do not run, which leaves out only timers and focus. The handlers under test
 * are the real ones the page wires up: the picker's onChange, and the
 * "Start a new invoice" button in the New invoice dialog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import InvoiceBuilder from "../src/apps/invoice-builder/index.jsx";
import COPY from "../src/apps/invoice-builder/copy.js";
import { serialiseInvoice, FILE_MAX_BYTES } from "../src/apps/invoice-builder/invoiceFile.js";
import { memoryStorage, sampleInvoice } from "../src/apps/invoice-builder/fixtures.js";
import { serialiseQuote } from "../src/apps/quote-builder/quoteFile.js";
import { newQuote } from "../src/apps/quote-builder/model.js";

const hooks = vi.hoisted(() => ({ active: false, slots: [], index: 0 }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  const React = actual.default ?? actual;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const fake = {
    useState(initial) {
      const i = hooks.index++;
      if (!hooks.slots[i]) {
        const slot = { value: typeof initial === "function" ? initial() : initial };
        slot.set = (next) => {
          slot.value = typeof next === "function" ? next(slot.value) : next;
        };
        hooks.slots[i] = slot;
      }
      return [hooks.slots[i].value, hooks.slots[i].set];
    },
    useRef(initial) {
      const i = hooks.index++;
      if (!hooks.slots[i]) hooks.slots[i] = { current: initial };
      return hooks.slots[i];
    },
    useMemo(make, deps) {
      const i = hooks.index++;
      const slot = hooks.slots[i];
      if (!slot || changed(slot.deps, deps)) hooks.slots[i] = { deps, value: make() };
      return hooks.slots[i].value;
    },
    useCallback(fn, deps) {
      return fake.useMemo(() => fn, deps);
    },
    useEffect() {},
    useLayoutEffect() {},
  };
  const pick = (name) => (...args) => (hooks.active ? fake[name] : React[name])(...args);
  const swapped = Object.fromEntries(Object.keys(fake).map((name) => [name, pick(name)]));
  const merged = { ...React, ...swapped };
  return { ...actual, ...swapped, default: merged };
});

// ---- The page, driven ----

const decode = (s) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

/** Every element in a tree, including those passed as props (the dialog's footer). */
function* walk(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (!node || typeof node !== "object" || !node.props) return;
  yield node;
  for (const value of Object.values(node.props)) {
    if (value && typeof value === "object") yield* walk(value);
  }
}

function mountPage() {
  hooks.slots = [];
  const render = () => {
    hooks.index = 0;
    hooks.active = true;
    try {
      return InvoiceBuilder({ app: { slug: "invoice-builder" }, copy: COPY });
    } finally {
      hooks.active = false;
    }
  };
  let tree = render();
  const find = (test) => [...walk(tree)].find(test);
  const page = {
    rerender: () => {
      tree = render();
    },
    /** The invoice the page holds, as handed to the preview. */
    get invoice() {
      return find((el) => el.props.invoice && el.props.totals && !el.props.setInvoice).props.invoice;
    },
    /** What the page's file message says, as markup. */
    get notice() {
      const notices = [...walk(tree)].filter((el) => "notice" in el.props && el.props.copy === COPY);
      return notices.map((el) => decode(renderToStaticMarkup(el))).join("");
    },
    /** The toast's message, or "". */
    get toast() {
      return find((el) => typeof el.props.message === "string")?.props.message ?? "";
    },
    /** Picks `file` in the hidden picker, as both Open buttons do. */
    async pick(file) {
      const picker = find((el) => el.type === "input" && el.props.type === "file" && String(el.props.accept).includes("json"));
      await picker.props.onChange({ target: { files: [file], value: file.name } });
      page.rerender();
    },
    /** "New invoice", then "Start a new invoice" in the dialog. */
    startNewInvoice() {
      const dialog = find((el) => el.props.title === COPY.newInvoiceDialog.title && "footer" in el.props);
      const confirm = [...walk(dialog.props.footer)].find((el) => el.props.children === COPY.newInvoiceDialog.confirm);
      confirm.props.onClick();
      page.rerender();
    },
  };
  return page;
}

/** A picked file, as the browser's File: a size and an async text(). */
const fileOf = (contents, name = "picked.json", size = new TextEncoder().encode(contents).length) => ({
  name,
  size,
  text: vi.fn(async () => contents),
});

/** A quote saved by the quote builder's own serialiser, as in UAT quote Q. */
function savedQuote({ inclusive = false } = {}) {
  const quote = newQuote({ today: "2026-10-31" });
  quote.customer = { company: "Sample Condo MCST 0000", contact: "Alex Tan", address: "1 Sample Avenue, Singapore 654321", email: "office@example.com" };
  quote.items = [
    { id: "a", description: "Site visit and measurement", quantity: "1", unit: "visit", unitPrice: "200.00", discountType: "none", discountValue: "" },
    { id: "b", description: "Planter box 200 x 100 x 70 cm", quantity: "2", unit: "pcs", unitPrice: "350.00", discountType: "percent", discountValue: "10" },
    { id: "c", description: "Installation", quantity: "1", unit: "job", unitPrice: "200.00", discountType: "amount", discountValue: "50" },
  ];
  quote.overallDiscount = { type: "amount", value: "30" };
  quote.gst = { on: true, rate: "9", regNo: "", inclusive };
  quote.notes = "Delivery within 14 days of confirmation.";
  return serialiseQuote(quote);
}

const BAD_FILES = {
  "a text file": "hello, this is not an invoice",
  "empty": "",
  "JSON of another kind": JSON.stringify({ format: "something-else", version: 1 }),
  "a newer invoice file": JSON.stringify({ format: "jura-invoice-builder", version: 99, invoice: {} }),
  "a quote file with a broken item": JSON.stringify({ format: "jura-quote-builder", version: 2, quote: { items: "nope" } }),
};

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryStorage() });
  vi.stubGlobal("requestAnimationFrame", () => 0);
});

describe("opening a file on the page (useInvoiceFiles wiring)", () => {
  it("starts with no file message", () => {
    expect(mountPage().notice).toBe("");
  });

  it("opens a saved invoice file into the page, with no message and the 'opened' toast", async () => {
    const page = mountPage();
    await page.pick(fileOf(serialiseInvoice(sampleInvoice(5))));
    expect(page.invoice.customer.company).toBe("Harbourfront Dental");
    expect(page.invoice.items).toHaveLength(5);
    expect(page.notice).toBe("");
    expect(page.toast).toBe(COPY.opened);
  });

  it.each(Object.entries(BAD_FILES))("never replaces the invoice for a bad file: %s", async (_, contents) => {
    const page = mountPage();
    await page.pick(fileOf(serialiseInvoice(sampleInvoice(3))));
    const before = page.invoice;
    const snapshot = structuredClone(before);
    await page.pick(fileOf(contents));
    expect(page.invoice).toBe(before);
    expect(page.invoice).toEqual(snapshot);
    expect(page.notice).toContain(COPY.badFile);
    expect(page.notice).toContain("That file doesn't look like one saved from our quote or invoice builder.");
  });

  it("refuses a file over 3 MB without reading it, and changes nothing", async () => {
    const page = mountPage();
    const before = page.invoice;
    const big = fileOf("{}", "big.json", FILE_MAX_BYTES + 1);
    await page.pick(big);
    expect(big.text).not.toHaveBeenCalled();
    expect(page.invoice).toBe(before);
    expect(page.notice).toContain(COPY.badFile);
  });

  it("opens a quote file over the page's business details, keeping them (D7)", async () => {
    const page = mountPage();
    await page.pick(fileOf(serialiseInvoice(sampleInvoice(2))));
    const { business, details, payment } = page.invoice;
    await page.pick(fileOf(savedQuote(), "quote-Q.quote.json"));
    expect(page.invoice.customer.company).toBe("Sample Condo MCST 0000");
    expect(page.invoice.items.map((i) => i.description)).toEqual(["Site visit and measurement", "Planter box 200 x 100 x 70 cm", "Installation"]);
    expect(page.invoice.overallDiscount).toEqual({ type: "amount", value: "30" });
    expect(page.invoice.notes).toBe("Delivery within 14 days of confirmation.");
    expect(page.invoice.gst).toEqual({ on: true, rate: "9", regNo: "M90312345A" });
    expect(page.invoice.business).toEqual(business);
    expect(page.invoice.details).toEqual(details);
    expect(page.invoice.payment).toBe(payment);
    expect(page.notice).toBe("");
    expect(page.toast).toBe(COPY.quoteOpened);
  });

  it("shows the D6 warning for a quote whose prices include GST", async () => {
    const page = mountPage();
    await page.pick(fileOf(savedQuote({ inclusive: true }), "quote-Q-incl.quote.json"));
    expect(page.invoice.customer.company).toBe("Sample Condo MCST 0000");
    expect(page.invoice.gst.on).toBe(true);
    expect(page.invoice.gst).not.toHaveProperty("inclusive");
    expect(page.notice).toContain(
      "This quote's prices include GST. Your invoice adds GST on top, so change each unit price to the amount before GST."
    );
    expect(page.notice).not.toContain(COPY.badFile);
  });

  it("clears the bad-file message when a good file opens next", async () => {
    const page = mountPage();
    await page.pick(fileOf("not json"));
    expect(page.notice).toContain(COPY.badFile);
    await page.pick(fileOf(serialiseInvoice(sampleInvoice(1))));
    expect(page.notice).toBe("");
  });

  it("clears the D6 warning when an ordinary file opens next", async () => {
    const page = mountPage();
    await page.pick(fileOf(savedQuote({ inclusive: true })));
    expect(page.notice).toContain(COPY.quoteIncludedGst);
    await page.pick(fileOf(savedQuote({ inclusive: false })));
    expect(page.notice).toBe("");
  });

  it("clears the D6 warning on New invoice, keeping the business and clearing the customer (D10)", async () => {
    const page = mountPage();
    await page.pick(fileOf(serialiseInvoice(sampleInvoice(1))));
    await page.pick(fileOf(savedQuote({ inclusive: true })));
    expect(page.notice).toContain(COPY.quoteIncludedGst);
    const business = page.invoice.business;
    page.startNewInvoice();
    expect(page.notice).toBe("");
    expect(page.invoice.business).toEqual(business);
    expect(page.invoice.customer.company).toBe("");
  });

  it("clears the bad-file message on New invoice", async () => {
    const page = mountPage();
    await page.pick(fileOf("not json"));
    expect(page.notice).toContain(COPY.badFile);
    page.startNewInvoice();
    expect(page.notice).toBe("");
  });

  // Defect 01 (reviews/qa-01.md). A bad file "changes nothing" (PRD §2
  // criterion 6), but today it removes the D6 warning while the GST-inclusive
  // prices it warns about are still on the invoice. `it.fails` keeps the
  // suite green while the defect is open; when it is fixed this test starts
  // failing, and `it.fails` becomes `it`.
  it.fails("DEFECT 01: keeps the D6 warning when a bad file is picked after an inclusive quote", async () => {
    const page = mountPage();
    await page.pick(fileOf(savedQuote({ inclusive: true })));
    const before = page.invoice;
    await page.pick(fileOf("not json"));
    expect(page.invoice).toBe(before);
    expect(page.notice).toContain(COPY.badFile);
    expect(page.notice).toContain(COPY.quoteIncludedGst);
  });
});
