import { describe, expect, it } from "vitest";
import COPY from "./copy.js";
import { readBlocker, readBlockerText } from "./files.js";

const OPEN = { limit: { ready: true, triesLeft: 2, capReached: false }, siteKey: "key", readyCount: 1, preparing: false, sending: false };
const blocked = (changes) => readBlocker({ ...OPEN, ...changes });

describe("why Read receipts is off", () => {
  it("is not off with a ready receipt, a try left and the service up", () => {
    expect(blocked({})).toBeNull();
  });

  it("names the first thing in the way", () => {
    expect(blocked({ limit: null })).toBe("loading");
    expect(blocked({ limit: { ...OPEN.limit, ready: false } })).toBe("unavailable");
    expect(blocked({ siteKey: "" })).toBe("unavailable");
    expect(blocked({ limit: { ...OPEN.limit, triesLeft: 0 } })).toBe("outOfTries");
    expect(blocked({ limit: { ...OPEN.limit, capReached: true } })).toBe("outOfTries");
    expect(blocked({ sending: true })).toBe("sending");
    expect(blocked({ preparing: true })).toBe("preparing");
    expect(blocked({ readyCount: 0 })).toBe("noFiles");
  });

  it("waits for files still being prepared before asking for more", () => {
    expect(blocked({ readyCount: 0, preparing: true })).toBe("preparing");
  });

  it("explains itself under the button only where nothing else on the page already does", () => {
    expect(readBlockerText("noFiles", COPY)).toBe(COPY.readWhy.noFiles);
    expect(readBlockerText("preparing", COPY)).toBe(COPY.readWhy.preparing);
    expect(readBlockerText("loading", COPY)).toBe(COPY.readWhy.loading);
    // The not-ready alert, the out-of-tries notice and the button's own
    // "Reading" label already say why.
    expect(readBlockerText("unavailable", COPY)).toBe("");
    expect(readBlockerText("outOfTries", COPY)).toBe("");
    expect(readBlockerText("sending", COPY)).toBe("");
    expect(readBlockerText(null, COPY)).toBe("");
  });
});
