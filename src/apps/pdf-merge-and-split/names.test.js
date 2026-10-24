import { describe, expect, it } from "vitest";
import { baseName, pageFileName, pdfFileName } from "./names.js";

describe("baseName", () => {
  it("is the visitor's file name without .pdf", () => {
    expect(baseName("Claim pack.pdf")).toBe("Claim pack");
    expect(baseName("REPORT.PDF")).toBe("REPORT");
    expect(baseName("季度报告.pdf")).toBe("季度报告");
    expect(baseName("scan")).toBe("scan");
  });

  it("drops characters a file name can't hold, and falls back when nothing is left", () => {
    expect(baseName("a/b\\c:d*e?.pdf")).toBe("a-b-c-d-e");
    expect(baseName(".pdf", "document")).toBe("document");
    expect(baseName("  ", "document")).toBe("document");
  });
});

describe("pageFileName", () => {
  it("is <original name>-page-01.pdf and so on (PRD §2)", () => {
    expect(pageFileName("Claim pack", 0, 3)).toBe("Claim pack-page-01.pdf");
    expect(pageFileName("Claim pack", 2, 3)).toBe("Claim pack-page-03.pdf");
  });

  it("pads to the longest page number so a long file still sorts in order", () => {
    expect(pageFileName("Big", 0, 120)).toBe("Big-page-001.pdf");
    expect(pageFileName("Big", 119, 120)).toBe("Big-page-120.pdf");
  });
});

describe("pdfFileName", () => {
  it("uses the name the visitor typed, adding .pdf once", () => {
    expect(pdfFileName("March claim pack", "merged")).toBe("March claim pack.pdf");
    expect(pdfFileName("March claim pack.pdf", "merged")).toBe("March claim pack.pdf");
  });

  it("falls back when nothing usable is typed", () => {
    expect(pdfFileName("", "merged")).toBe("merged.pdf");
    expect(pdfFileName(" / ", "merged")).toBe("merged.pdf");
  });
});
