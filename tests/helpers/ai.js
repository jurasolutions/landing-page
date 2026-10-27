/**
 * Stand-ins for Turnstile and the Anthropic API. Nothing here reaches the
 * network: `installNetwork` replaces global fetch for the test, records every
 * call, and answers from the scripts given.
 */
import { vi } from "vitest";

export const ENV = {
  ANTHROPIC_API_KEY: "sk-ant-test-not-real",
  TURNSTILE_SECRET: "1x0000000000000000000000000000000AA", // Cloudflare's always-pass test secret
  VISITOR_SALT: "test-salt",
  // The receipt reader is still a draft tool, which the Functions serve only
  // where this is set (local runs). tests/limiter.test.js "draft tools"
  // covers the gate itself.
  AI_ALLOW_DRAFTS: "1",
  // The limiter tests were written against 2 tries a visitor and 6 an IP, and
  // keep those small numbers so each case stays short. The production
  // defaults (5 and 15) are tested in tests/budget.test.js.
  AI_TRIES_PER_DAY: "2",
  AI_TRIES_PER_IP: "6",
};

export function message(text, { stop = "end_turn", input = 1500, output = 400 } = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: input, output_tokens: output },
  };
}

export const apiError = (status, type, text = "test error") => ({
  status,
  body: { type: "error", error: { type, message: text } },
});

export const RECEIPT = {
  is_receipt: true,
  merchant: "FairPrice Finest",
  merchant_id: "M2-0012345-6",
  date: "2026-10-20",
  currency: "SGD",
  subtotal: 18.35,
  gst: 1.65,
  total: 20,
  payment_method: "NETS",
  items: [
    { description: "Milk 1L", quantity: 2, amount: 6.4 },
    { description: "Bread", quantity: 1, amount: 13.6 },
  ],
  notes: null,
};

/**
 * script.turnstile: true (pass) | false (fail)
 * script.anthropic: list of answers, used in order. Each is a message object
 *   (200), an apiError(), or "network" for a dropped connection.
 */
export function installNetwork(script = {}) {
  const calls = { turnstile: [], anthropic: [] };
  const answers = [...(script.anthropic ?? [])];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
        calls.turnstile.push(init.body);
        const pass = script.turnstile !== false;
        return Response.json(pass ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] });
      }
      if (url.startsWith("https://api.anthropic.com/v1/messages")) {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        calls.anthropic.push({ body, headers: new Headers(init.headers) });
        const answer = answers.shift();
        if (!answer) throw new Error("No scripted Anthropic answer left");
        if (answer === "network") throw new TypeError("fetch failed");
        if (answer.status) {
          return new Response(JSON.stringify(answer.body), {
            status: answer.status,
            headers: { "content-type": "application/json", "x-should-retry": "false" },
          });
        }
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { "content-type": "application/json", "request-id": "req_test" },
        });
      }
      throw new Error(`Unexpected network request in a test: ${url}`);
    })
  );
  return calls;
}

/** The first bytes of a JPEG, padded to `size` bytes. Never decoded server-side. */
export function fakeJpeg(size = 2048, marker = "") {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  const text = new TextEncoder().encode(marker);
  bytes.set(text.subarray(0, Math.max(0, size - 20)), 20);
  return bytes;
}

/**
 * A JPEG header with a real SOF0 marker giving `width` x `height`, after an
 * APP0 segment, padded to `size` bytes. Enough for the server to read its
 * size; never decoded.
 */
export function jpegOf(width, height, { size = 2048, marker = "" } = {}) {
  const bytes = new Uint8Array(Math.max(size, 64));
  const head = [
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
  ];
  bytes.set(head);
  bytes.set(new TextEncoder().encode(marker).subarray(0, Math.max(0, bytes.length - 48)), 48);
  return bytes;
}

export const fakePng = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
export const fakeHeic = () => new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);

export function receiptRequest({ files = [fakeJpeg()], token = "XXXX.DUMMY.TOKEN.XXXX", ip = "203.0.113.10", cookie, headers = {} } = {}) {
  const form = new FormData();
  if (token !== null) form.append("token", token);
  files.forEach((bytes, i) => form.append("files", new Blob([bytes], { type: "image/jpeg" }), `receipt-${i + 1}.jpg`));
  return new Request("https://jurasolutions.sg/api/apps/receipt-reader", {
    method: "POST",
    body: form,
    headers: { "CF-Connecting-IP": ip, ...(cookie ? { Cookie: cookie } : {}), ...headers },
  });
}

export function limitRequest({ ip = "203.0.113.10", cookie, tool = "receipt-reader" } = {}) {
  return new Request(`https://jurasolutions.sg/api/apps/limit${tool ? `?tool=${tool}` : ""}`, {
    headers: { "CF-Connecting-IP": ip, ...(cookie ? { Cookie: cookie } : {}) },
  });
}

/** "jura_vid=..." from a response's Set-Cookie, ready to send back. */
export function cookieFrom(response) {
  const header = response.headers.get("Set-Cookie");
  return header ? header.split(";")[0] : undefined;
}

/**
 * A stand-in for the Workers AI binding (`env.AI`), which is not `fetch`, so
 * tests/setup.js does not catch it. A test that leaves it out gets a tool
 * that is not ready, which fails safe.
 *
 * answers: a list used in call order, or a function ({ model, prompt, n }) =>
 * answer for pictures drawn in parallel. Each answer is { image: base64 }, an
 * Error to throw, or "hang" for a call that never returns.
 * `calls` records what each call sent, read back from its multipart body,
 * with the reference images' bytes in `images`.
 */
export function fakeAi(answers = []) {
  const queue = Array.isArray(answers) ? [...answers] : null;
  const calls = [];
  const AI = {
    run: vi.fn(async (model, input) => {
      const n = calls.length;
      // Taken before any await, so parallel calls stay in order.
      const scripted = queue ? queue.shift() : undefined;
      const record = { model, keys: Object.keys(input ?? {}) };
      calls.push(record);
      const form = await new Response(input.multipart.body, {
        headers: { "content-type": input.multipart.contentType },
      }).formData();
      const fields = [...form.keys()];
      const images = [];
      for (const key of fields.filter((k) => k.startsWith("input_image_"))) {
        images.push(new Uint8Array(await form.get(key).arrayBuffer()));
      }
      Object.assign(record, {
        fields,
        prompt: form.get("prompt"),
        width: form.get("width"),
        height: form.get("height"),
        images,
      });
      const answer = queue ? scripted : answers({ model, prompt: record.prompt, n });
      if (!answer) throw new Error("No scripted Workers AI answer left");
      if (answer === "hang") return new Promise(() => {});
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  return { AI, calls };
}

export const aiPicture = (marker = "PICTURE") => ({ image: Buffer.from(fakeJpeg(256, marker)).toString("base64") });
export const aiFailure = (text = "AiError: AiError: Internal server error (3043)") =>
  Object.assign(new Error(text), { name: "AiError" });
export const aiQuota = () =>
  aiFailure(
    "AiError: AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage. (7d1e4a)"
  );
