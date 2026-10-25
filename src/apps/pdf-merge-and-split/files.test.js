import { describe, expect, it, vi } from "vitest";
import COPY from "./copy.js";
import { MAX_FILES, MAX_TOTAL_BYTES, admitFiles, problemMessage } from "./files.js";

const MB = 1024 * 1024;

/** A stand-in for a File whose bytes must never be read by the limit check. */
function file(size) {
  return { name: "x.pdf", size, arrayBuffer: vi.fn(), slice: vi.fn(), stream: vi.fn(), text: vi.fn() };
}
const untouched = (list) => list.every((f) => [f.arrayBuffer, f.slice, f.stream, f.text].every((m) => !m.mock.calls.length));

describe("admitFiles", () => {
  it("is the PRD's limits: 20 files, 50 MB in total", () => {
    expect(MAX_FILES).toBe(20);
    expect(MAX_TOTAL_BYTES).toBe(50 * MB);
  });

  it("takes files up to the limits, counting the ones already added", () => {
    const current = Array.from({ length: 18 }, () => ({ size: 2 * MB }));
    const incoming = [file(5 * MB), file(9 * MB)];
    expect(admitFiles(current, incoming)).toEqual({ ok: true });
    expect(untouched(incoming)).toBe(true);
  });

  it("refuses a batch that would make more than 20 files, before reading any of it", () => {
    const current = Array.from({ length: 19 }, () => ({ size: MB }));
    const incoming = [file(MB), file(MB)];
    expect(admitFiles(current, incoming)).toEqual({ ok: false, reason: "tooMany" });
    expect(admitFiles([], Array.from({ length: 21 }, () => file(1)))).toEqual({ ok: false, reason: "tooMany" });
    expect(untouched(incoming)).toBe(true);
  });

  it("refuses a batch that would go over 50 MB together, before reading any of it", () => {
    const current = [{ size: 30 * MB }];
    const incoming = [file(10 * MB), file(10 * MB + 1)];
    expect(admitFiles(current, incoming)).toEqual({ ok: false, reason: "tooLarge" });
    expect(admitFiles([], [file(50 * MB + 1)])).toEqual({ ok: false, reason: "tooLarge" });
    expect(untouched(incoming)).toBe(true);
  });
});

describe("problemMessage", () => {
  it("gives a password-protected PDF, a damaged PDF and a non-PDF their own PRD message", () => {
    expect(problemMessage("encrypted", COPY)).toBe(
      "This PDF is password protected. Remove the password in your PDF reader, then add it again."
    );
    expect(problemMessage("damaged", COPY)).toBe("We couldn't read this PDF. It may be damaged.");
    expect(problemMessage("notPdf", COPY)).toBe("This file isn't a PDF.");
  });
});
