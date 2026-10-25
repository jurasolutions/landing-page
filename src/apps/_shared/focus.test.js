import { describe, expect, it } from "vitest";
import { focusAction, returnFocus } from "./focus.js";

/** Just enough of a document and its buttons to see where focus goes, in node. */
function page() {
  const doc = { body: { tag: "body" } };
  doc.activeElement = doc.body;
  const button = (name, { disabled = false, connected = true } = {}) => ({
    name,
    disabled,
    isConnected: connected,
    focus() {
      doc.activeElement = this;
    },
  });
  return { doc, button };
}

describe("returning focus after a busy action", () => {
  it("puts focus back on the control that started it once focus has fallen to the page", () => {
    const { doc, button } = page();
    const merge = button("Merge and download");
    expect(returnFocus(merge, doc)).toBe(true);
    expect(doc.activeElement).toBe(merge);
  });

  it("also when nothing at all has focus", () => {
    const { doc, button } = page();
    doc.activeElement = null;
    const merge = button("Merge and download");
    expect(returnFocus(merge, doc)).toBe(true);
    expect(doc.activeElement).toBe(merge);
  });

  it("leaves focus alone when the visitor has moved on to something else", () => {
    const { doc, button } = page();
    const elsewhere = button("Start again");
    doc.activeElement = elsewhere;
    expect(returnFocus(button("Merge and download"), doc)).toBe(false);
    expect(doc.activeElement).toBe(elsewhere);
  });

  it("does nothing for a control that is gone or still disabled", () => {
    const { doc, button } = page();
    expect(returnFocus(button("Remove", { connected: false }), doc)).toBe(false);
    expect(returnFocus(button("Download PDF", { disabled: true }), doc)).toBe(false);
    expect(returnFocus(null, doc)).toBe(false);
    expect(doc.activeElement).toBe(doc.body);
  });
});

describe("keeping focus with an item after it moves", () => {
  function row(disabled) {
    const { doc, button } = page();
    const buttons = {
      up: button("Move up", { disabled: disabled === "up" }),
      down: button("Move down", { disabled: disabled === "down" }),
      remove: button("Remove"),
    };
    const element = {
      querySelector(selector) {
        const action = /data-action="(\w+)"/.exec(selector)?.[1];
        if (action) return buttons[action] ?? null;
        if (selector === "button:not([disabled])") return Object.values(buttons).find((b) => !b.disabled) ?? null;
        return null;
      },
    };
    return { doc, buttons, element };
  }

  it("stays on the pressed button when the item can move further", () => {
    const { doc, buttons, element } = row(null);
    expect(focusAction(element, "up")).toBe(true);
    expect(doc.activeElement).toBe(buttons.up);
  });

  it("moves to the other move button when the item reached the top", () => {
    const { doc, buttons, element } = row("up");
    expect(focusAction(element, "up")).toBe(true);
    expect(doc.activeElement).toBe(buttons.down);
  });

  it("moves to the other move button when the item reached the bottom", () => {
    const { doc, buttons, element } = row("down");
    expect(focusAction(element, "down")).toBe(true);
    expect(doc.activeElement).toBe(buttons.up);
  });

  it("reports when there is no row to focus in", () => {
    expect(focusAction(null, "up")).toBe(false);
  });
});
