import { describe, expect, it } from "vitest";
import { checkRefs, checkUploads, jpegSize } from "../server/images.js";
import { fakeHeic, fakeJpeg, fakePng, jpegOf } from "./helpers/ai.js";

const file = (bytes, name = "photo.jpg") => new File([bytes], name, { type: "image/jpeg" });

describe("upload checks", () => {
  it("allows 3 files by default, as the receipt reader always has", async () => {
    expect((await checkUploads([1, 2, 3].map(() => file(fakeJpeg())))).ok).toBe(true);
    expect(await checkUploads([1, 2, 3, 4].map(() => file(fakeJpeg())))).toEqual({ ok: false, status: 400, error: "count" });
  });

  it("takes a different maximum when a tool gives one", async () => {
    expect((await checkUploads([1, 2, 3, 4].map(() => file(fakeJpeg())), { max: 4 })).ok).toBe(true);
    expect((await checkUploads([1, 2, 3, 4, 5].map(() => file(fakeJpeg())), { max: 4 })).error).toBe("count");
  });
});

describe("a JPEG's size, from its SOF marker", () => {
  it("reads width and height after other segments", () => {
    expect(jpegSize(jpegOf(512, 384))).toEqual({ width: 512, height: 384 });
    expect(jpegSize(jpegOf(300, 512))).toEqual({ width: 300, height: 512 });
  });

  it("gives null for anything it cannot read", () => {
    expect(jpegSize(fakeJpeg())).toBe(null);
    expect(jpegSize(fakePng())).toBe(null);
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(null);
  });
});

describe("reference images for the image model", () => {
  const refs = (...list) => list.map((bytes) => file(bytes, "ref.jpg"));

  it("takes JPEGs of at most 512 px a side and under 300 KB, one for each photo", async () => {
    const result = await checkRefs(refs(jpegOf(512, 384), jpegOf(400, 512)), 2);
    expect(result.ok).toBe(true);
    expect(result.refs.map(({ width, height }) => [width, height])).toEqual([[512, 384], [400, 512]]);
    expect(result.refs[0].bytes).toBeInstanceOf(Uint8Array);
  });

  it("refuses a count that does not match the photos", async () => {
    expect(await checkRefs(refs(jpegOf(512, 384)), 2)).toEqual({ ok: false, status: 400, error: "count" });
    expect(await checkRefs([], 1)).toEqual({ ok: false, status: 400, error: "count" });
  });

  it("refuses a reference that is too big, not a JPEG or not a file", async () => {
    expect(await checkRefs(refs(jpegOf(513, 384)), 1)).toEqual({ ok: false, status: 400, error: "bad_request" });
    expect(await checkRefs(refs(jpegOf(512, 384, { size: 300 * 1024 })), 1)).toEqual({ ok: false, status: 413, error: "too_large" });
    expect(await checkRefs(refs(fakePng()), 1)).toEqual({ ok: false, status: 400, error: "bad_request" });
    expect(await checkRefs(refs(fakeHeic()), 1)).toEqual({ ok: false, status: 400, error: "bad_request" });
    expect(await checkRefs(refs(fakeJpeg()), 1)).toEqual({ ok: false, status: 400, error: "bad_request" });
    expect(await checkRefs(["text"], 1)).toEqual({ ok: false, status: 400, error: "bad_request" });
  });
});
