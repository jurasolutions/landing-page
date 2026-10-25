import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { onRequestPost, onRequestGet } from "../functions/submit.js";
import { FROM_PATTERN, cleanFrom, readFrom } from "../src/lib/validate.js";

const ENQUIRY = {
  name: "Ada Tan",
  email: "ada@example.com",
  phone: "",
  company: "Tan Aircon",
  message: "We retype every quote into an invoice.",
};

function post(body) {
  return new Request("https://jurasolutions.sg/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function captureResend() {
  const sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      expect(url).toBe("https://api.resend.com/emails");
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: "test" }), { status: 200 });
    })
  );
  return sent;
}

const env = { RESEND_API_KEY: "re_test_not_real" };

describe("the enquiry `from` value", () => {
  it("puts 'Came from: apps/<slug>' in the text and html email", async () => {
    const sent = captureResend();
    const response = await onRequestPost({ request: post({ ...ENQUIRY, from: "apps/quote-builder" }), env });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Came from: apps/quote-builder");
    expect(sent[0].html).toContain("Came from: apps/quote-builder");
  });

  it.each([
    "apps/../../etc",
    "apps/Quote-Builder",
    "apps/",
    "https://evil.example/apps/x",
    "apps/quote builder",
    `apps/${"a".repeat(61)}`,
    "<script>",
    42,
    null,
  ])("drops %j without failing the enquiry", async (from) => {
    const sent = captureResend();
    const response = await onRequestPost({ request: post({ ...ENQUIRY, from }), env });
    expect(response.status).toBe(200);
    expect(sent[0].text).not.toContain("Came from");
    expect(sent[0].html).not.toContain("Came from");
  });

  it("keeps the old behaviour when there is no from value", async () => {
    const sent = captureResend();
    const response = await onRequestPost({ request: post(ENQUIRY), env });
    expect(response.status).toBe(200);
    expect(sent[0].subject).toBe("Enquiry from Ada Tan (Tan Aircon)");
    expect(sent[0].reply_to).toBe("ada@example.com");
    expect(sent[0].text).not.toContain("Came from");
  });

  it("still validates the enquiry itself", async () => {
    captureResend();
    const response = await onRequestPost({
      request: post({ ...ENQUIRY, email: "nope", from: "apps/quote-builder" }),
      env,
    });
    expect(response.status).toBe(400);
  });

  it("still answers the GET health check", async () => {
    const response = await onRequestGet({ env });
    expect(await response.json()).toEqual({ endpoint: "enquiry", ok: true, canSend: true });
  });
});

describe("the form's reading of ?from=", () => {
  it("accepts a toolbox slug", () => {
    expect(readFrom("?from=apps/quote-builder")).toBe("apps/quote-builder");
    expect(readFrom("?from=apps%2Freceipt-reader")).toBe("apps/receipt-reader");
  });

  it("ignores anything else", () => {
    expect(readFrom("")).toBe("");
    expect(readFrom("?from=apps/../x")).toBe("");
    expect(readFrom("?from=elsewhere")).toBe("");
    expect(readFrom("?other=apps/quote-builder")).toBe("");
  });

  it("uses the same pattern as the Function", () => {
    expect(FROM_PATTERN.source).toBe("^apps\\/[a-z0-9-]{1,60}$");
  });
});

describe("cleanFrom, shared by the form and the Function", () => {
  it("keeps a toolbox slug", () => {
    expect(cleanFrom("apps/quote-builder")).toBe("apps/quote-builder");
  });

  it.each(["apps/../x", "apps/", "elsewhere", "", 42, null, undefined, { from: "apps/x" }])(
    "turns %j into an empty string",
    (value) => {
      expect(cleanFrom(value)).toBe("");
    }
  );

  it("is what the Function applies: it has no copy of the pattern", () => {
    const source = fs.readFileSync(new URL("../functions/submit.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/apps\\\/\[a-z0-9-\]/);
    expect(source).toMatch(/import \{[^}]*\bcleanFrom\b[^}]*\} from "..\/src\/lib\/validate.js"/);
  });
});
