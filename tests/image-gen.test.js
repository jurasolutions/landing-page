import { describe, expect, it } from "vitest";
import {
  BRAND_SAFE_SUFFIX,
  KLEIN_4B,
  KLEIN_9B,
  classifyImageError,
  drawPicture,
  imagePriceNano,
  pictureReserveNano,
} from "../server/image-gen.js";
import { aiFailure, aiPicture, aiQuota, fakeAi, fakeJpeg } from "./helpers/ai.js";

const ref = (width = 512, height = 384, marker = "REF") => ({ bytes: fakeJpeg(1024, marker), width, height });

describe("picture prices, in nano-dollars", () => {
  it("prices klein 4B by 512 x 512 tile: 6 output tiles at US$0.000287, one input tile a reference at US$0.000059", () => {
    expect(imagePriceNano(KLEIN_4B)).toBe(1_722_000);
    expect(imagePriceNano(KLEIN_4B, [ref(), ref(512, 512)])).toBe(1_840_000);
    expect(imagePriceNano(KLEIN_4B, [ref(513, 100)])).toBe(1_840_000);
  });

  it("prices klein 9B at US$0.015 for the first output megapixel, US$0.002 a further one, and US$0.002 an input megapixel", () => {
    expect(imagePriceNano(KLEIN_9B)).toBe(15_621_440);
    expect(imagePriceNano(KLEIN_9B, [ref(512, 512)])).toBe(16_145_728);
    expect(imagePriceNano(KLEIN_9B, [ref(400, 300), ref(400, 300)])).toBe(16_101_440);
  });

  it("has no price for a model that is not in the table", () => {
    expect(imagePriceNano("@cf/black-forest-labs/flux-2-dev")).toBe(null);
  });

  it("reserves the dearer of the model and its fallback for each picture", () => {
    expect(pictureReserveNano(KLEIN_4B, [ref(512, 512)])).toBe(16_145_728);
    expect(pictureReserveNano(KLEIN_9B, [])).toBe(15_621_440);
  });
});

describe("Workers AI error classes", () => {
  const aiError = (text, extra = {}) => Object.assign(new Error(text), { name: "AiError", ...extra });

  it("reads the free plan's daily allocation error as cap", () => {
    expect(classifyImageError(aiQuota())).toBe("cap");
    expect(classifyImageError(aiError("AiError: something", { code: 4006 }))).toBe("cap");
    expect(classifyImageError(aiError("4006: limit"))).toBe("cap");
  });

  it("reads an internal server error, a timeout or anything else as unavailable", () => {
    expect(classifyImageError(aiError("AiError: AiError: Internal server error (3043)", { code: 3043 }))).toBe("unavailable");
    expect(classifyImageError(new Error("InferenceUpstreamError"))).toBe("unavailable");
    expect(classifyImageError("timeout")).toBe("unavailable");
    expect(classifyImageError(undefined)).toBe("unavailable");
  });

  it("never reads a 4006 inside a request id as the cap", () => {
    expect(classifyImageError(aiError("AiError: AiError: Internal server error (1b4e28ba-2fa1-4006-a716-446655440000)"))).toBe("unavailable");
    expect(classifyImageError(aiError("AiError: Internal server error (3043) request 4006"))).toBe("unavailable");
    expect(classifyImageError(aiError("AiError: AiError: 4006: daily limit"))).toBe("cap");
  });
});

describe("drawing a picture through the AI binding", () => {
  const FAST = { backoffMs: [0, 0], timeoutMs: { [KLEIN_4B]: 50, [KLEIN_9B]: 50 } };
  const draw = (env, refs = [ref()], prompt = "Image 0 on white.") => drawPicture(env, { prompt, refs }, { timing: FAST });

  it("sends the prompt with the brand-safe suffix, the size and each reference in order, as multipart", async () => {
    const { AI, calls } = fakeAi([aiPicture("ONE")]);
    const refs = [ref(512, 384, "FIRST"), ref(300, 512, "SECOND")];
    const result = await draw({ AI }, refs, "Image 0 and image 1 together on a marble counter.");
    expect(result).toEqual({ ok: true, image: aiPicture("ONE").image, model: KLEIN_4B, costNano: 1_840_000 });
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe(KLEIN_4B);
    expect(calls[0].keys).toEqual(["multipart"]);
    expect(calls[0].fields).toEqual(["prompt", "width", "height", "input_image_0", "input_image_1"]);
    expect(calls[0].prompt).toBe(`Image 0 and image 1 together on a marble counter.${BRAND_SAFE_SUFFIX}`);
    expect([calls[0].width, calls[0].height]).toEqual(["1024", "1280"]);
    expect(calls[0].images.map((bytes) => new TextDecoder().decode(bytes.subarray(20, 26)))).toEqual(["FIRST\0", "SECOND"]);
  });

  it("states the brand-safe suffix positively, since the model has no negative prompt", () => {
    expect(BRAND_SAFE_SUFFIX).toBe(
      " Keep each product exactly as it appears in its reference image, with its own shape, colours and label. Photorealistic commercial product photography with soft, even, flattering light; plain unmarked props and surfaces; nobody in the frame."
    );
  });

  it("uses AI_IMAGE_MODEL when it names a priced model", async () => {
    const { AI, calls } = fakeAi([aiPicture()]);
    const result = await draw({ AI, AI_IMAGE_MODEL: KLEIN_9B }, [ref(400, 300)]);
    expect(calls[0].model).toBe(KLEIN_9B);
    expect(result.costNano).toBe(15_861_440);
  });

  it("tries the configured model 3 times, then the other klein model once", async () => {
    const { AI, calls } = fakeAi([aiFailure(), aiFailure(), aiFailure(), aiPicture()]);
    const result = await draw({ AI, AI_IMAGE_MODEL: KLEIN_9B });
    expect(calls.map((c) => c.model)).toEqual([KLEIN_9B, KLEIN_9B, KLEIN_9B, KLEIN_4B]);
    expect(result).toMatchObject({ ok: true, model: KLEIN_4B, costNano: 1_781_000 });
  });

  it("treats an answer with no picture in it like an error, and tries again", async () => {
    const { AI, calls } = fakeAi([{ image: "" }, {}, aiPicture()]);
    expect(await draw({ AI })).toMatchObject({ ok: true });
    expect(calls).toHaveLength(3);
  });

  it("gives up after four failed attempts; error answers cost nothing", async () => {
    const { AI, calls } = fakeAi([aiFailure(), aiFailure(), aiFailure(), aiFailure()]);
    expect(await draw({ AI })).toEqual({ ok: false, kind: "unavailable", costNano: 0 });
    expect(calls).toHaveLength(4);
  });

  it("never retries on the daily allocation error", async () => {
    const { AI, calls } = fakeAi([aiQuota(), aiPicture()]);
    expect(await draw({ AI })).toEqual({ ok: false, kind: "cap", costNano: 0 });
    expect(calls).toHaveLength(1);
  });

  it("stops on a timeout and keeps that attempt's price, since it may have been billed", async () => {
    const { AI, calls } = fakeAi(["hang", aiPicture()]);
    expect(await draw({ AI })).toEqual({ ok: false, kind: "unavailable", costNano: 1_781_000 });
    expect(calls).toHaveLength(1);
  });

  it("waits about 300 ms, then 900 ms, between attempts on the configured model by default", async () => {
    const waits = [];
    const { AI } = fakeAi([aiFailure(), aiFailure(), aiFailure(), aiPicture()]);
    await drawPicture({ AI }, { prompt: "Image 0.", refs: [ref()] }, { timing: { timeoutMs: FAST.timeoutMs }, sleep: async (ms) => waits.push(ms) });
    expect(waits).toEqual([300, 900]);
  });
});
