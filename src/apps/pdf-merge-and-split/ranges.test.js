import { describe, expect, it } from "vitest";
import COPY from "./copy.js";
import { parseRanges, rangeMessage } from "./ranges.js";

// Page numbers in, zero-based page indices out (pdf-lib counts from 0).
const pages = (...numbers) => numbers.map((n) => n - 1);

describe("parseRanges", () => {
  it('reads "1-3, 5, 8-10" as those pages', () => {
    expect(parseRanges("1-3, 5, 8-10", 12)).toEqual({ ok: true, pages: pages(1, 2, 3, 5, 8, 9, 10) });
  });

  it("ignores spaces, wherever they are", () => {
    expect(parseRanges("  1 - 3 ,5,  8 -10 ", 12)).toEqual({ ok: true, pages: pages(1, 2, 3, 5, 8, 9, 10) });
    expect(parseRanges("1-3,5,8-10", 12)).toEqual({ ok: true, pages: pages(1, 2, 3, 5, 8, 9, 10) });
  });

  it('rejects page "0"', () => {
    expect(parseRanges("0", 12)).toEqual({ ok: false, error: "zero" });
    expect(parseRanges("0-2", 12)).toEqual({ ok: false, error: "zero" });
    expect(parseRanges("2, 00", 12)).toEqual({ ok: false, error: "zero" });
  });

  it("rejects a run written high to low", () => {
    expect(parseRanges("5-3", 12)).toEqual({ ok: false, error: "reversed" });
    expect(parseRanges("1, 10-8", 12)).toEqual({ ok: false, error: "reversed" });
  });

  it("rejects pages past the end of the file", () => {
    expect(parseRanges("13", 12)).toEqual({ ok: false, error: "outside" });
    expect(parseRanges("10-13", 12)).toEqual({ ok: false, error: "outside" });
    expect(parseRanges("12", 12)).toEqual({ ok: true, pages: pages(12) });
    expect(parseRanges("99999999999999999999", 12)).toEqual({ ok: false, error: "outside" });
  });

  it("asks for pages when nothing is typed", () => {
    expect(parseRanges("", 12)).toEqual({ ok: false, error: "empty" });
    expect(parseRanges(" , ,", 12)).toEqual({ ok: false, error: "empty" });
  });

  it("rejects anything that isn't page numbers, commas and dashes", () => {
    for (const text of ["a", "1-", "-3", "1--3", "1-2-3", "1.5", "2 3", "1;2", "page 1", "-"]) {
      expect(parseRanges(text, 12), text).toEqual({ ok: false, error: "format" });
    }
  });

  it("keeps each page once, in the file's order, and allows a stray comma", () => {
    expect(parseRanges("5, 1-3, 2, 3,", 12)).toEqual({ ok: true, pages: pages(1, 2, 3, 5) });
  });

  it("takes the dashes a phone or word processor types", () => {
    expect(parseRanges("1–3, 5—6", 12)).toEqual({ ok: true, pages: pages(1, 2, 3, 5, 6) });
  });
});

describe("rangeMessage", () => {
  it("tells the visitor how many pages the file has when a page isn't in it (PRD §5.2)", () => {
    expect(rangeMessage("outside", 12, COPY)).toBe("Some of those pages aren't in this file. It has 12 pages.");
    expect(rangeMessage("zero", 12, COPY)).toBe("Some of those pages aren't in this file. It has 12 pages.");
    expect(rangeMessage("outside", 1, COPY)).toBe("Some of those pages aren't in this file. It has 1 page.");
  });

  it("explains a reversed run, a typing slip and an empty box in their own words", () => {
    const messages = ["reversed", "format", "empty"].map((error) => rangeMessage(error, 12, COPY));
    expect(messages).toEqual([COPY.errors.rangeReversed, COPY.errors.rangeFormat, COPY.errors.rangeEmpty]);
    expect(new Set(messages).size).toBe(3);
  });
});
