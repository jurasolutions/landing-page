import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LimitArea } from "../src/apps/_shared/LimitArea.jsx";
import copy from "../src/apps/receipt-reader/copy.js";
import { ReceiptResults } from "../src/apps/receipt-reader/ReceiptResults.jsx";
import { fromApi, releasable } from "../src/apps/receipt-reader/model.js";
import { prepareFile } from "../src/apps/receipt-reader/prepare.js";
import { fileMessage, photoNumbers } from "../src/apps/receipt-reader/files.js";
import { FileList } from "../src/apps/receipt-reader/FileList.jsx";
import { stubBrowserImages } from "./helpers/browser-image.js";

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
  it("is titled by its photo, never by a merchant name the model guessed", () => {
    const out = cards([{ ...miss(2, "not_a_receipt"), merchant: "Qing Palace menu" }]);
    expect(out).toContain(">Photo 2</h3>");
    expect(out).not.toContain("Qing Palace menu");
  });

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

describe("a HEIC photo", () => {
  const heic = () => new File([new Uint8Array(32)], "IMG_0001.HEIC", { type: "image/heic" });
  const HEIC_HELP =
    "This photo is in Apple's HEIC format, which this browser can't open. On a Mac, export it from Photos as a JPEG (File > Export); on an iPhone, choose Most Compatible under Settings > Camera > Formats.";

  it("is accepted, as a JPEG, when the browser can decode it (Safari can)", async () => {
    const { createImageBitmap } = stubBrowserImages({ decodes: true });
    const result = await prepareFile(heic());
    expect(result).toMatchObject({ ok: true, previewUrl: "blob:prepared", fromPdf: false });
    expect(result.blob.type).toBe("image/jpeg");
    expect(createImageBitmap).toHaveBeenCalled();
  });

  it("is refused with how to get a JPEG when the browser can't decode it", async () => {
    stubBrowserImages({ decodes: false });
    expect(await prepareFile(heic())).toEqual({ ok: false, reason: "heic" });
    expect(fileMessage("heic", copy)).toBe(HEIC_HELP);
  });

  it("is told apart from a JPEG the browser can't decode, which is unopenable", async () => {
    stubBrowserImages({ decodes: false });
    const jpeg = new File([new Uint8Array(32)], "receipt.jpg", { type: "image/jpeg" });
    expect(await prepareFile(jpeg)).toEqual({ ok: false, reason: "unopenable" });
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

describe("the photo numbers before and after a read", () => {
  const failed = { id: "f-1", name: "IMG_0001.HEIC", status: "error", reason: "heic" };
  const ok = (n) => ({ id: `f-${n + 1}`, name: `receipt-${n}.jpg`, status: "ready", previewUrl: `blob:photo-${n}` });
  const list = (files) => html(React.createElement(FileList, { files, copy, sending: false, onRemove: () => {} }));
  const row = (out, url) => out.split("<li").find((li) => li.includes(url));

  it("numbers only the files that will be sent, in the order they are sent", () => {
    expect(photoNumbers([failed, ok(1), ok(2)])).toEqual([null, 1, 2]);
    expect(photoNumbers([ok(1), { id: "f-9", status: "preparing" }, failed, ok(2)])).toEqual([1, 2, null, 3]);
  });

  it("labels a file in the list with the number and noun its card will use", () => {
    const files = [failed, ok(1), ok(2)];
    const out = list(files);
    // What was sent is the ready files, in order; the card for image 2 is the third file.
    const sent = files.filter((f) => f.status === "ready").map((f) => f.previewUrl);
    const card = html(React.createElement(ReceiptResults, { receipts: [fromApi(miss(2, "blurry"), sent)], setReceipts: () => {}, copy }));
    expect(card).toContain("Photo 2 is too blurry");
    expect(card).toContain('src="blob:photo-2"');
    expect(row(out, "blob:photo-2")).toContain(">Photo 2<");
    expect(row(out, "blob:photo-2")).toContain('aria-label="Remove photo 2"');
    expect(row(out, "blob:photo-1")).toContain(">Photo 1<");
    expect(out).not.toContain("Photo 3");
    expect(out).not.toMatch(/Receipt \d/);
  });

  it("names a file that can't be sent by its file name, with why", () => {
    const out = list([failed, ok(1)]);
    const first = out.split("<li")[1].replaceAll("&gt;", ">");
    expect(first).toContain(">IMG_0001.HEIC<");
    expect(first).toContain(copy.heic);
    expect(first).toContain('aria-label="Remove IMG_0001.HEIC"');
    expect(first).not.toMatch(/Photo \d/);
  });
});
