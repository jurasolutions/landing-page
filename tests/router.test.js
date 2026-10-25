import { describe, expect, it } from "vitest";
import {
  claimHeadingFocus,
  createScrollMemory,
  planHistoryStep,
  planNavigation,
  requestHeadingFocus,
} from "../src/lib/router.js";

const at = (pathname, search = "", hash = "") => ({ pathname, search, hash });

describe("a client-side navigation", () => {
  it("moving to another page focuses its heading and jumps to the top", () => {
    expect(planNavigation(at("/apps"), at("/"))).toEqual({ focus: true, scroll: "top" });
    expect(planNavigation(at("/"), at("/apps/quote-builder"))).toEqual({ focus: true, scroll: "top" });
  });

  it("a new query is a new page", () => {
    expect(planNavigation(at("/"), at("/", "?from=apps/quote-builder"))).toEqual({ focus: true, scroll: "top" });
  });

  it("staying on the same page moves nothing, so no focus request is left behind", () => {
    expect(planNavigation(at("/apps"), at("/apps"))).toEqual({ focus: false, scroll: "none" });
    expect(planNavigation(at("/apps/"), at("/apps"))).toEqual({ focus: false, scroll: "none" });
  });

  it("a link to a section scrolls to it and leaves focus alone", () => {
    expect(planNavigation(at("/apps"), at("/", "", "#contact"))).toEqual({ focus: false, scroll: "hash" });
  });
});

describe("the heading focus request", () => {
  it("is claimed once, by the page it was made for", () => {
    requestHeadingFocus("/");
    expect(claimHeadingFocus("/apps")).toBe(false);
    expect(claimHeadingFocus("/")).toBe(true);
    expect(claimHeadingFocus("/")).toBe(false);
  });

  it("ignores a trailing slash", () => {
    requestHeadingFocus("/apps/");
    expect(claimHeadingFocus("/apps")).toBe(true);
  });

  it("is replaced by the next navigation, so a stale one never fires later", () => {
    requestHeadingFocus("/privacy");
    requestHeadingFocus(null);
    expect(claimHeadingFocus("/privacy")).toBe(false);
  });
});

describe("back and forward", () => {
  it("between pages restores the saved scroll position and focuses the heading", () => {
    expect(planHistoryStep(at("/apps/quote-builder"), at("/apps"), { scrollY: 640 })).toEqual({
      focus: true,
      scroll: "restore",
      scrollY: 640,
    });
  });

  it("to an entry with no known position leaves the browser's own restore alone", () => {
    expect(planHistoryStep(at("/apps"), at("/"), null)).toEqual({ focus: true, scroll: "browser" });
    expect(planHistoryStep(at("/apps"), at("/"), { scrollY: -5 })).toEqual({ focus: true, scroll: "browser" });
    expect(planHistoryStep(at("/apps"), at("/"), { scrollY: "640" })).toEqual({ focus: true, scroll: "browser" });
  });

  it("to an entry with a section and no saved position scrolls to the section", () => {
    expect(planHistoryStep(at("/apps"), at("/", "", "#services"), null)).toEqual({ focus: false, scroll: "hash" });
  });

  it("remembers where the visitor was on an entry they left with back, for forward", () => {
    const memory = createScrollMemory();
    // On /apps (entry b), scrolled to 800, then back to / (entry a).
    memory.record("b", 300);
    memory.record("b", 800);
    memory.record("a", 1500);
    // Forward to b: its history state holds nothing, the memory does.
    expect(memory.lookup("b", null)).toBe(800);
    expect(planHistoryStep(at("/"), at("/apps"), { scrollY: memory.lookup("b", null) })).toEqual({
      focus: true,
      scroll: "restore",
      scrollY: 800,
    });
  });

  it("falls back to the position saved in history state, then to nothing", () => {
    const memory = createScrollMemory();
    expect(memory.lookup("c", { scrollY: 300 })).toBe(300);
    expect(memory.lookup("d", null)).toBeNull();
    expect(memory.lookup(null, { scrollY: "x" })).toBeNull();
  });

  it("within one page (a section link on the home page) is left to the browser", () => {
    expect(planHistoryStep(at("/", "", "#services"), at("/"), null)).toBeNull();
    expect(planHistoryStep(at("/"), at("/", "", "#faq"), null)).toBeNull();
  });
});
