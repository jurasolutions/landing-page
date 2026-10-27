import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LimitArea } from "../src/apps/_shared/LimitArea.jsx";
import copy from "../src/apps/receipt-reader/copy.js";
import { ReceiptResults } from "../src/apps/receipt-reader/ReceiptResults.jsx";
import { fromApi, releasable } from "../src/apps/receipt-reader/model.js";

const render = (limit) =>
  renderToStaticMarkup(React.createElement(LimitArea, { limit, slug: "receipt-reader", copy })).replaceAll("&#x27;", "'");
const CARD = 'href="/?from=apps/receipt-reader#contact"';

describe("the receipt reader's try notice", () => {
  it("puts the talk-to-us card right under the notice when the visitor is out of tries (APP-002 §5.1 step 7)", () => {
    const html = render({ ready: true, triesLeft: 0, capReached: false });
    expect(html).toContain(copy.limitReached);
    expect(html).toContain(CARD);
    expect(html.indexOf(copy.limitReached)).toBeLessThan(html.indexOf(CARD));
  });

  it("does the same when the site's daily cap is reached", () => {
    const html = render({ ready: true, triesLeft: 2, capReached: true });
    expect(html).toContain(copy.capReached);
    expect(html).toContain(CARD);
  });

  it("shows no card while the visitor still has tries, or before the count arrives", () => {
    expect(render({ ready: true, triesLeft: 1, capReached: false })).not.toContain(CARD);
    expect(render(null)).not.toContain(CARD);
  });
});

const html = (element) => renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"');
const PREVIEWS = ["blob:photo-1", "blob:photo-2", "blob:photo-3"];
const BLANK = { merchant: null, merchant_id: null, date: null, currency: null, subtotal: null, gst: null, total: null, payment_method: null, items: [], notes: null };
const miss = (image, problem) => ({ ...BLANK, image, is_receipt: false, problem });
const READ = { ...BLANK, image: 1, is_receipt: true, problem: null, merchant: "Cold Storage", currency: "SGD", total: 56.75 };
const cards = (answers) =>
  html(React.createElement(ReceiptResults, { receipts: answers.map((a) => fromApi(a, PREVIEWS)), setReceipts: () => {}, copy }));

describe("a photo that came back without a receipt", () => {
  it.each([
    ["not_a_receipt", 2, "Photo 2 doesn't look like a receipt or invoice."],
    ["blurry", 1, "Photo 1 is too blurry to read. Hold the receipt flat and keep the camera steady."],
    ["cut_off", 3, "Part of the receipt in photo 3 is cut off. Fit the whole receipt in the frame."],
    ["too_dark", 2, "Photo 2 is too dark to read. Try again in better light."],
    ["other", 1, "We couldn't read a receipt in photo 1. Try a closer, straighter photo."],
    [null, 3, "We couldn't read a receipt in photo 3. Try a closer, straighter photo."],
    ["something_new", 2, "We couldn't read a receipt in photo 2. Try a closer, straighter photo."],
  ])("says why (%s) for the photo's number in the batch, and shows that photo", (problem, n, sentence) => {
    const out = cards([miss(n, problem)]);
    expect(out).toContain(sentence);
    expect(out).toContain(`src="${PREVIEWS[n - 1]}"`);
    for (const other of PREVIEWS.filter((_, i) => i !== n - 1)) expect(out).not.toContain(other);
  });

  it("keeps the image number and the problem from the answer", () => {
    expect(fromApi(miss(2, "blurry"), PREVIEWS)).toMatchObject({ image: 2, problem: "blurry", isReceipt: false, previewUrl: "blob:photo-2" });
  });

  it("holds on to no photo for a receipt that was read", () => {
    expect(fromApi(READ, PREVIEWS)).toMatchObject({ image: 1, problem: null, previewUrl: "" });
    const out = cards([READ]);
    expect(out).not.toContain("blob:photo-1");
    expect(out).toContain("Cold Storage");
  });

  it("falls back to the plain sentence, with no photo, when the answer has no image number", () => {
    const out = cards([miss(undefined, "blurry")]);
    expect(out).toContain(copy.notReceipt);
    expect(out).not.toContain("blob:");
  });
});

describe("the photos the page keeps after a read", () => {
  it("keeps a photo a not-a-receipt card still shows, and lets the others go", () => {
    const kept = [fromApi(READ, PREVIEWS), fromApi(miss(2, "cut_off"), PREVIEWS)];
    expect(releasable(PREVIEWS, kept)).toEqual(["blob:photo-1", "blob:photo-3"]);
  });

  it("lets a removed card's photo go once no card shows it", () => {
    const [gone, stays] = [fromApi(miss(2, "too_dark"), PREVIEWS), fromApi(miss(3, "blurry"), PREVIEWS)];
    expect(releasable([gone.previewUrl], [stays])).toEqual(["blob:photo-2"]);
    expect(releasable([gone.previewUrl], [stays, gone])).toEqual([]);
    expect(releasable(["", undefined], [])).toEqual([]);
  });
});
