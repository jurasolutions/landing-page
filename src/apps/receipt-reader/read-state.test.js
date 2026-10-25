import { describe, expect, it } from "vitest";
import COPY from "./copy.js";
import { failureMessage, isOutOfTries, readBlocker, readBlockerText, showsTalkCard } from "./read-state.js";

const OPEN = { limit: { ready: true, triesLeft: 2, capReached: false }, siteKey: "key", readyCount: 1, preparing: false, sending: false };
const blocked = (changes) => readBlocker({ ...OPEN, ...changes });

describe("out of tries", () => {
  it("is true when the visitor's tries or the site's cap are used up", () => {
    expect(isOutOfTries({ triesLeft: 0, capReached: false })).toBe(true);
    expect(isOutOfTries({ triesLeft: 2, capReached: true })).toBe(true);
  });

  it("is false with a try left, or while the limit is loading", () => {
    expect(isOutOfTries({ triesLeft: 1, capReached: false })).toBe(false);
    expect(isOutOfTries(null)).toBe(false);
  });
});

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

describe("the tool's own talk-to-us card", () => {
  it("shows under the notice when the visitor or the site is out of tries", () => {
    expect(showsTalkCard({ ready: true, triesLeft: 0, capReached: false }, "key")).toBe(true);
    expect(showsTalkCard({ ready: true, triesLeft: 2, capReached: true }, "key")).toBe(true);
  });

  it("does not show while tries are left, before the count arrives, or when the tools are not ready", () => {
    expect(showsTalkCard({ ready: true, triesLeft: 1, capReached: false }, "key")).toBe(false);
    expect(showsTalkCard(null, "key")).toBe(false);
    expect(showsTalkCard({ ready: false, triesLeft: 0, capReached: false }, "key")).toBe(false);
    expect(showsTalkCard({ ready: true, triesLeft: 0, capReached: false }, "")).toBe(false);
  });
});

describe("what a failed read says", () => {
  const said = (status, body) => failureMessage({ status, body, triesBefore: 2 }, COPY);

  it("says the try wasn't counted only when the count did not drop", () => {
    expect(said(502, { error: "unreadable", triesLeft: 2 })).toBe(
      "We couldn't read these images. Clearer, flatter photos usually work. This try wasn't counted."
    );
    expect(said(502, { error: "unreadable", triesLeft: 1 })).toBe("We couldn't read these images. Clearer, flatter photos usually work.");
    expect(said(503, { error: "unavailable", triesLeft: 1 })).toBe("The receipt reader isn't available right now. Please try again later.");
  });

  it("says it wasn't counted for a 503 that came before any try was taken", () => {
    expect(said(503, { error: "unavailable" })).toBe(
      "The receipt reader isn't available right now. Please try again later. This try wasn't counted."
    );
  });

  it("promises nothing when the network failed and the outcome is unknown", () => {
    expect(said(0, {})).toBe("The receipt reader isn't available right now. Please try again later.");
  });

  it("explains a rejected upload or bot check without mentioning the try", () => {
    expect(said(403, { error: "bot_check" })).toBe(COPY.errors.botCheck);
    expect(said(413, { error: "too_large" })).toBe(COPY.tooBig);
    expect(said(415, { error: "heic" })).toBe(COPY.heic);
    expect(said(415, { error: "type" })).toBe(COPY.badType);
  });
});
