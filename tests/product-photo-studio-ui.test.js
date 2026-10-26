import { describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { REGISTRY } from "../src/apps/registry.js";
import { registerIcons } from "../src/lib/icons.js";
import { PRIVACY } from "../src/content.js";
import ProductPhotoStudio, { LimitArea } from "../src/apps/product-photo-studio/index.jsx";
import { PostFrame } from "../src/apps/product-photo-studio/PostFrame.jsx";
import { base64ToBlob, cropRect, pictureName, saveMode } from "../src/apps/product-photo-studio/compose.js";
import {
  avatarInitial,
  blockerText,
  chooseCaption,
  editCaption,
  failureMessage,
  makeBlocker,
  resultFromApi,
  shownCaption,
} from "../src/apps/product-photo-studio/post-state.js";
import { FIELD_LIMITS, MAX_PHOTOS, postForm } from "../src/apps/product-photo-studio/api.js";
import { forgetResult, keepResult, keepWords, restoreResult } from "../src/apps/product-photo-studio/session.js";
import copy from "../src/apps/product-photo-studio/copy.js";
import { SIZES, photoKind } from "../src/apps/product-photo-studio/prepare.js";
import { fitLongEdge } from "../src/apps/_shared/photos.js";

describe("the product photo studio's picture shapes (APP-004)", () => {
  it("scales the whole 4:5 picture to 1080 x 1350 for portrait", () => {
    expect(cropRect("portrait", 1024, 1280)).toEqual({ sx: 0, sy: 0, sw: 1024, sh: 1280, width: 1080, height: 1350 });
  });

  it("crops the centre square to 1080 x 1080 for square", () => {
    expect(cropRect("square", 1024, 1280)).toEqual({ sx: 0, sy: 128, sw: 1024, sh: 1024, width: 1080, height: 1080 });
  });

  it("crops the centre of a picture that is not 4:5, never stretching it", () => {
    expect(cropRect("portrait", 1600, 900)).toEqual({ sx: 440, sy: 0, sw: 720, sh: 900, width: 1080, height: 1350 });
    expect(cropRect("square", 1600, 900)).toEqual({ sx: 350, sy: 0, sw: 900, sh: 900, width: 1080, height: 1080 });
  });

  it("names the file after the post's look and the shape", () => {
    expect(pictureName("Clean white studio", "square")).toBe("clean-white-studio-square.jpg");
    expect(pictureName("Bold colour & pop", "portrait")).toBe("bold-colour-pop-portrait.jpg");
    expect(pictureName("Café counter", "portrait")).toBe("cafe-counter-portrait.jpg");
  });

  it("falls back to a plain name when the look has no letters a file name can keep", () => {
    expect(pictureName("白色", "portrait")).toBe("product-photo-portrait.jpg");
    expect(pictureName("", "square")).toBe("product-photo-square.jpg");
  });

  it("turns the answer's base64 picture into a JPEG blob, not a data URL", async () => {
    const blob = base64ToBlob("/9j/AA==");
    expect(blob.type).toBe("image/jpeg");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 0x00]);
  });

  it("offers the share sheet only where the browser can share the file (S3)", () => {
    const file = { name: "a.jpg" };
    expect(saveMode({ canShare: () => true, share: () => {} }, file)).toBe("share");
    expect(saveMode({ canShare: () => false, share: () => {} }, file)).toBe("download");
    expect(saveMode({}, file)).toBe("download");
    expect(saveMode({ canShare: () => { throw new Error("no"); }, share: () => {} }, file)).toBe("download");
    expect(saveMode(undefined, file)).toBe("download");
  });
});

const READY = { ready: true, triesLeft: 3, capReached: false };
const blocker = (over) =>
  makeBlocker({ limit: READY, siteKey: "key", photoCount: 1, preparing: false, sending: false, ...over });

describe("when the studio's button can be pressed", () => {
  it("needs at least one product photo: this is photo editing", () => {
    expect(blocker({ photoCount: 0 })).toBe("noPhotos");
    expect(blocker({ photoCount: 1 })).toBeNull();
    expect(blocker({ photoCount: 4 })).toBeNull();
  });

  it("names the first thing in the way, in the order the visitor meets them", () => {
    expect(blocker({ limit: null })).toBe("loading");
    expect(blocker({ limit: { ready: false } })).toBe("unavailable");
    expect(blocker({ siteKey: "" })).toBe("unavailable");
    expect(blocker({ limit: { ...READY, triesLeft: 0 } })).toBe("outOfTries");
    expect(blocker({ limit: { ...READY, capReached: true } })).toBe("outOfTries");
    expect(blocker({ sending: true })).toBe("sending");
    expect(blocker({ preparing: true })).toBe("preparing");
  });

  it("explains only the reasons the page doesn't already show", () => {
    expect(blockerText("noPhotos", copy)).toBe(copy.makeWhy.noPhotos);
    expect(blockerText("preparing", copy)).toBe(copy.makeWhy.preparing);
    expect(blockerText("loading", copy)).toBe(copy.makeWhy.loading);
    expect(blockerText("outOfTries", copy)).toBe("");
    expect(blockerText("unavailable", copy)).toBe("");
    expect(blockerText(null, copy)).toBe("");
  });
});

describe("what the studio says when a try brings no posts back", () => {
  const fail = (status, body, triesBefore = 3) => failureMessage({ status, body, triesBefore }, copy);

  it("says no product was found, and never that the try came back (422 keeps the try)", () => {
    const words = fail(422, { error: "no_product", triesLeft: 2 });
    expect(words).toBe(copy.errors.noProduct);
    expect(words).not.toContain(copy.errors.notCounted);
  });

  it("says the try wasn't counted only when the count shows it came back", () => {
    expect(fail(503, { error: "unavailable", triesLeft: 3 })).toBe(`${copy.errors.unavailable} ${copy.errors.notCounted}`);
    expect(fail(503, { error: "unavailable" })).toBe(`${copy.errors.unavailable} ${copy.errors.notCounted}`);
    expect(fail(502, { error: "unreadable", triesLeft: 3 })).toBe(`${copy.errors.unreadable} ${copy.errors.notCounted}`);
    expect(fail(502, { error: "unreadable", triesLeft: 2 })).toBe(copy.errors.unreadable);
    expect(fail(0, {})).toBe(copy.errors.unavailable);
  });

  it("explains a refused request in the visitor's terms", () => {
    expect(fail(403, { error: "bot_check" })).toBe(copy.errors.botCheck);
    expect(fail(413, { error: "too_large" })).toBe(copy.tooBig);
    expect(fail(415, { error: "heic" })).toBe(copy.heic);
    expect(fail(415, { error: "type" })).toBe(copy.badType);
    expect(fail(400, { error: "bad_request" })).toBe(copy.errors.unavailable);
  });
});

describe("what a studio try sends (POST /api/apps/product-photo-studio)", () => {
  const jpeg = (n) => new Blob([new Uint8Array(n)], { type: "image/jpeg" });
  const photo = () => ({ file: jpeg(16), ref: jpeg(4) });

  it("sends the token, each 1600 px photo as `files` and its 512 px copy as `refs`, in the same order", () => {
    const form = postForm({ token: "tok", photos: [photo(), photo()], name: "", instruction: "" });
    expect([...form.keys()]).toEqual(["token", "files", "files", "refs", "refs"]);
    expect(form.get("token")).toBe("tok");
    expect(form.getAll("files").map((f) => [f.name, f.size])).toEqual([["photo-1.jpg", 16], ["photo-2.jpg", 16]]);
    expect(form.getAll("refs").map((f) => [f.name, f.size])).toEqual([["ref-1.jpg", 4], ["ref-2.jpg", 4]]);
  });

  it("sends the business name and instruction trimmed, and leaves out empty ones", () => {
    const form = postForm({ token: "tok", photos: [photo()], name: " Little Fern ", instruction: " Remove the background " });
    expect([...form.keys()]).toEqual(["token", "files", "refs", "name", "instruction"]);
    expect(form.get("name")).toBe("Little Fern");
    expect(form.get("instruction")).toBe("Remove the background");
    expect([...postForm({ token: "t", photos: [photo()], name: "  ", instruction: "" }).keys()]).toEqual([
      "token",
      "files",
      "refs",
    ]);
  });

  it("caps photos and typed fields at the spec's limits in the page", () => {
    expect(MAX_PHOTOS).toBe(4);
    expect(FIELD_LIMITS).toEqual({ name: 80, instruction: 500 });
  });
});

const ANSWER = {
  products: [
    { name: "Candle", description: "A white soy candle in a glass jar" },
    { name: "Gift box", description: "A kraft paper box" },
  ],
  posts: [
    {
      look: "Clean white studio",
      caption: "Simple, calm and ready to gift.",
      hashtags: ["#candles", "#giftideas", "#homedecor", "#handmade", "#sgshop"],
      alt: "A white candle on a clean white background",
      image: "AAEC",
    },
    {
      look: "Morning counter",
      caption: "Slow mornings start here.",
      hashtags: ["#candles", "#morning", "#cosyhome", "#handmade", "#sgsmallbusiness"],
      alt: "The candle on a marble counter in soft light",
    },
    {
      look: "Bold colour",
      caption: "A little colour for the weekend.",
      hashtags: ["#weekend", "#candles", "#colour", "#giftshop", "#sgshop"],
      alt: "The candle on a bright orange background",
      image: "AAED",
    },
  ],
  triesLeft: 2,
};

const CAPTIONS = [
  "Simple, calm and ready to gift.\n\n#candles #giftideas #homedecor #handmade #sgshop",
  "Slow mornings start here.\n\n#candles #morning #cosyhome #handmade #sgsmallbusiness",
  "A little colour for the weekend.\n\n#weekend #candles #colour #giftshop #sgshop",
];

describe("the three posts a try brings back", () => {
  it("keeps the products found", () => {
    expect(resultFromApi(ANSWER).products).toEqual(ANSWER.products);
  });

  it("offers all three captions, hashtags after one blank line, on every frame, its own chosen first", () => {
    const { posts } = resultFromApi(ANSWER);
    expect(posts.map((p) => p.captions)).toEqual([CAPTIONS, CAPTIONS, CAPTIONS]);
    expect(posts.map(shownCaption)).toEqual(CAPTIONS);
  });

  it("keeps each frame's look, alt text and picture, starts it unchosen, and leaves out a picture that wasn't drawn", () => {
    const [first, second] = resultFromApi(ANSWER).posts;
    expect(first).toMatchObject({ look: "Clean white studio", alt: ANSWER.posts[0].alt, image: "AAEC", picked: false });
    expect(second.look).toBe("Morning counter");
    expect(second.image).toBeUndefined();
  });

  it("shows, and so copies, the caption the visitor chose and edited on that frame only", () => {
    const [first] = resultFromApi(ANSWER).posts;
    const chosen = chooseCaption(first, 2);
    expect(shownCaption(chosen)).toBe(CAPTIONS[2]);
    const edited = editCaption(chosen, "My own words");
    expect(shownCaption(edited)).toBe("My own words");
    expect(shownCaption(chooseCaption(edited, 0))).toBe(CAPTIONS[0]);
    expect(shownCaption(chooseCaption(edited, 2))).toBe("My own words");
    expect(first.captions).toEqual(CAPTIONS);
  });

  it("puts the business name's first letter in the frame's avatar, or nothing for the shop icon", () => {
    expect(avatarInitial("little Fern Café")).toBe("L");
    expect(avatarInitial("  Ébène")).toBe("É");
    expect(avatarInitial("")).toBe("");
    expect(avatarInitial("   ")).toBe("");
  });
});

/** sessionStorage that refuses any single value longer than `room` characters. */
function fakeSession(room = Infinity) {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      if (String(value).length > room) throw new DOMException("full", "QuotaExceededError");
      items.set(key, String(value));
    },
    removeItem: (key) => items.delete(key),
  };
}

describe("the last result, kept for the session (S4)", () => {
  it("comes back after a reload, pictures and all", () => {
    vi.stubGlobal("window", { sessionStorage: fakeSession() });
    const result = resultFromApi(ANSWER);
    expect(keepResult(result)).toEqual({ picturesKept: true });
    expect(restoreResult()).toEqual(result);
  });

  it("keeps the words when the pictures don't fit, and marks only the pictures that were lost", () => {
    vi.stubGlobal("window", { sessionStorage: fakeSession(2000) });
    const big = resultFromApi({ ...ANSWER, posts: ANSWER.posts.map((p) => (p.image ? { ...p, image: "A".repeat(5000) } : p)) });
    expect(keepResult(big)).toEqual({ picturesKept: false });
    const back = restoreResult();
    expect(back.posts.map(shownCaption)).toEqual(CAPTIONS);
    expect(back.posts[0].image).toBeUndefined();
    expect(back.posts[0].lost).toBe(true);
    expect(back.posts[1].lost).toBeUndefined();
    expect(back.posts[2].lost).toBe(true);
  });

  it("keeps the visitor's caption choices, edits and chosen frames without losing the pictures", () => {
    vi.stubGlobal("window", { sessionStorage: fakeSession() });
    const result = resultFromApi(ANSWER);
    keepResult(result);
    const first = { ...editCaption(chooseCaption(result.posts[0], 1), "Mine now"), picked: true };
    keepWords({ ...result, posts: [first, ...result.posts.slice(1)] });
    const back = restoreResult();
    expect(back.posts[0]).toMatchObject({ choice: 1, picked: true, image: "AAEC" });
    expect(shownCaption(back.posts[0])).toBe("Mine now");
  });

  it("is gone after Start again", () => {
    vi.stubGlobal("window", { sessionStorage: fakeSession() });
    keepResult(resultFromApi(ANSWER));
    forgetResult();
    expect(restoreResult()).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(keepResult(resultFromApi(ANSWER))).toEqual({ picturesKept: false });
    expect(restoreResult()).toBeNull();
    expect(() => forgetResult()).not.toThrow();
  });
});

describe("getting a photo ready to send", () => {
  it("takes JPG, PNG and WEBP photos, asks for a JPG instead of HEIC, and refuses a PDF or anything else", () => {
    expect(photoKind({ name: "a.jpg", type: "image/jpeg" })).toBe("image");
    expect(photoKind({ name: "a.webp", type: "" })).toBe("image");
    expect(photoKind({ name: "IMG_1.HEIC", type: "" })).toBe("heic");
    expect(photoKind({ name: "menu.pdf", type: "application/pdf" })).toBe(null);
    expect(photoKind({ name: "a.gif", type: "image/gif" })).toBe(null);
  });

  it("makes two sizes: a 1600 px JPEG for Claude and a 512 px JPEG for the image model", () => {
    expect(SIZES).toEqual({ file: { edge: 1600, quality: 0.8 }, ref: { edge: 512, quality: 0.85 } });
    expect(fitLongEdge(4032, 3024, SIZES.ref.edge)).toEqual({ width: 512, height: 384 });
    expect(fitLongEdge(3024, 4032, SIZES.ref.edge)).toEqual({ width: 384, height: 512 });
    expect(fitLongEdge(400, 300, SIZES.ref.edge)).toEqual({ width: 400, height: 300 });
  });
});

const html = (element) => renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"');
const APP = { slug: "product-photo-studio", name: "Product photo studio", category: "Marketing", tier: "ai" };
const CARD = 'href="/?from=apps/product-photo-studio#contact"';

describe("the studio page before a try", () => {
  const page = html(React.createElement(ProductPhotoStudio, { app: APP, copy }));

  it("takes up to 4 photos from files or the camera, never a PDF", () => {
    expect(page).toContain(copy.uploadLabel);
    expect(page).toContain('capture="environment"');
    expect(page).toContain('accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"');
    expect(page).not.toContain("application/pdf");
  });

  it("has a labelled instruction box of 500 characters with a first example as its placeholder, and the example chips", () => {
    expect(page).toMatch(/<label[^>]*for="pps-instruction"[^>]*>How the pictures should look<\/label>/);
    expect(page).toMatch(/<textarea[^>]*id="pps-instruction"[^>]*maxLength="500"/);
    expect(page).toContain(`placeholder="${copy.examples[0]}"`);
    for (const example of copy.examples) expect(page).toContain(`>${example}<`);
  });

  it("has a labelled business name of 80 characters and no F&B fields", () => {
    expect(page).toMatch(/<label[^>]*for="pps-name"[^>]*>Business name<\/label>/);
    expect(page).toMatch(/<input[^>]*id="pps-name"[^>]*maxLength="80"/);
    for (const gone of ["Tone", "Kind of place", "Dish to feature", "Anything to mention", "emoji"]) expect(page).not.toContain(gone);
  });

  it("holds the button until the tries are known, says one try makes three posts, and has a live region ready", () => {
    expect(page).toMatch(/<button[^>]*disabled=""[^>]*>.*Make my posts/);
    expect(page).toContain(copy.oneTry);
    expect(page).toContain(copy.makeWhy.loading);
    expect(page).toContain('aria-live="polite"');
  });
});

describe("the studio's try notice", () => {
  const limitArea = (limit) => html(React.createElement(LimitArea, { limit, slug: APP.slug, copy }));

  it("puts the talk-to-us card right under the notice when the visitor is out of tries", () => {
    const out = limitArea({ ready: true, triesLeft: 0, capReached: false });
    expect(out).toContain(copy.limitReached);
    expect(out.indexOf(copy.limitReached)).toBeLessThan(out.indexOf(CARD));
    expect(limitArea({ ready: true, triesLeft: 2, capReached: true })).toContain(copy.capReached);
  });

  it("says the tool isn't ready when the Functions or the AI binding aren't there", () => {
    const out = limitArea({ ready: false });
    expect(out).toContain(copy.errors.notReady);
    expect(out).not.toContain(CARD);
  });
});

describe("a post frame", () => {
  const posts = resultFromApi(ANSWER).posts;
  const frame = (post, over = {}) =>
    html(
      React.createElement(PostFrame, {
        post,
        index: 0,
        name: "little Fern",
        copy,
        onChange: () => {},
        onUsed: () => {},
        onToast: () => {},
        ...over,
      })
    );

  it("looks like a social post: avatar initial and name, the picture, plain decorative actions, the caption after the name in bold", () => {
    const out = frame(posts[0]);
    expect(out).toMatch(/class="pps-avatar"[^>]*>L</);
    expect(out).toContain(">little Fern<");
    expect(out).toMatch(/class="pps-post-actions" aria-hidden="true"/);
    expect(out).toMatch(/<strong>little Fern<\/strong> Simple, calm and ready to gift\./);
    expect(out).not.toMatch(/instagram/i);
  });

  it("falls back to a shop icon and 'Your business' when no name was typed", () => {
    const out = frame(posts[0], { name: "" });
    expect(out).toContain(">Your business<");
    expect(out).not.toMatch(/class="pps-avatar"[^>]*>[A-Z]</);
  });

  it("carries its look, a 'Choose this one' toggle, the shape, the three caption choices with its own chosen, and Edit", () => {
    const out = frame(posts[2], { index: 2 });
    expect(out).toContain(">Bold colour<");
    expect(out).toMatch(/aria-pressed="false"[^>]*>.*Choose this one/);
    expect(out).toContain(">Portrait<");
    expect(out).toContain(">Square<");
    for (const n of [1, 2, 3]) expect(out).toContain(`>Caption ${n}<`);
    // The frame's own caption (the third) is the one chosen.
    const radios = out.match(/<input type="radio" name="pps-caption-2"[^>]*>/g);
    expect(radios).toHaveLength(3);
    expect(radios.filter((r) => r.includes('checked=""'))).toEqual([expect.stringContaining('value="2"')]);
    expect(out).toContain(">Edit caption<");
  });

  it("offers no shape choice for a frame without a picture, but keeps its caption choices", () => {
    const out = frame(posts[1], { index: 1 });
    expect(out).not.toContain(">Square<");
    expect(out).toContain(">Caption 3<");
    expect(out).toContain(">Edit caption<");
  });

  it("shows a chosen frame as chosen", () => {
    expect(frame({ ...posts[0], picked: true })).toMatch(/aria-pressed="true"[^>]*>.*Chosen/);
    expect(frame({ ...posts[0], picked: true })).toContain("pps-frame--picked");
  });

  it("puts the AI note above the save button, and offers Download picture and Copy caption", () => {
    const out = frame(posts[0]);
    expect(out).toContain(copy.results.aiNote);
    expect(out.indexOf(copy.results.aiNote)).toBeLessThan(out.indexOf(copy.results.download));
    expect(out).toContain(copy.results.copy);
  });

  it("says when a picture couldn't be drawn, or wasn't kept, and offers no save button then", () => {
    const missing = frame(posts[1], { index: 1 });
    expect(missing).toContain(copy.results.noPicture);
    expect(missing).not.toContain(copy.results.download);
    expect(missing).toContain(copy.results.copy);
    expect(frame({ ...posts[0], image: undefined, lost: true })).toContain(copy.results.pictureLost);
  });
});

describe("the studio in the toolbox", () => {
  it("is in the registry as the spec writes it, as a draft until go-live", () => {
    expect(REGISTRY.find((entry) => entry.slug === "product-photo-studio")).toEqual({
      slug: "product-photo-studio",
      name: "Product photo studio",
      description: "Better light and backgrounds for your product photos, with captions ready to post.",
      category: "Marketing",
      industries: ["general", "retail", "fnb"],
      tier: "ai",
      status: "draft",
      added: "2026-10-27",
      prd: "APP-004",
    });
  });

  it("registers every icon the page draws, since Icon draws nothing for a name it can't find", () => {
    const registered = new Set();
    vi.stubGlobal("window", {});
    registerIcons();
    for (const key of Object.keys(window.lucide.icons)) registered.add(key);
    const pascal = (s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    const sources = ["index.jsx", "PostFrame.jsx"].map((f) =>
      readFileSync(new URL(`../src/apps/product-photo-studio/${f}`, import.meta.url), "utf8")
    );
    // Every quoted name inside an `<Icon name=…` attribute, including both sides of a ternary.
    const names = new Set(
      sources.flatMap((s) =>
        [...s.matchAll(/<Icon name=(\{[^}]*\}|"[^"]*")/g)].flatMap((m) =>
          m[1].startsWith('"') ? [m[1].slice(1, -1)] : [...m[1].matchAll(/[?:]\s*"([a-z0-9-]+)"/g)].map((q) => q[1])
        )
      )
    );
    for (const name of ["heart", "message-circle", "send", "bookmark", "store", "pencil", "share-2", "download"])
      expect(names, name).toContain(name);
    for (const name of names) expect(registered, name).toContain(pascal(name));
  });

  it("names Cloudflare Workers AI on /privacy as drawing the studio's pictures from the photos", () => {
    const ai = PRIVACY.sections.find((s) => s.heading === "Tools that use AI").paragraphs.join(" ");
    expect(ai).toMatch(/Product photo studio/);
    expect(ai).toMatch(/Cloudflare Workers AI/);
    expect(ai).toMatch(/photos/);
  });
});

describe("the studio's words that the spec fixes", () => {
  it("puts the AI note, the progress message and the privacy note as written", () => {
    expect(copy.results.aiNote).toBe(
      "This picture is made by AI from your photos. Check your product looks right before you post."
    );
    expect(copy.progress).toBe("Lighting your products and drawing three posts. This can take up to a minute.");
    expect(copy.privacy).toContain(
      "Your photos are sent securely to Anthropic's Claude, which writes the captions and picture instructions, and to Cloudflare Workers AI, which draws the new pictures from them. Neither keeps them for us, and we don't store your photos or the results."
    );
    expect(copy.privacy).toContain("Product photos work best. Leave out photos with people in them.");
  });

  it("offers between 4 and 6 example instructions, each within the box's limit", () => {
    expect(copy.examples.length).toBeGreaterThanOrEqual(4);
    expect(copy.examples.length).toBeLessThanOrEqual(6);
    expect(copy.examples).toContain("Remove the background and put it on clean white");
    for (const example of copy.examples) expect(example.length).toBeLessThanOrEqual(FIELD_LIMITS.instruction);
  });
});
