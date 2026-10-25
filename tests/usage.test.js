import { describe, expect, it } from "vitest";
import { createD1 } from "./helpers/d1.js";
import { handleUsage } from "../server/usage.js";
import { onRequestPost } from "../functions/api/apps/usage.js";

const REGISTRY = [
  {
    slug: "dummy-tool",
    name: "Dummy tool",
    description: "A test entry.",
    category: "Admin",
    tier: "browser",
    status: "live",
    added: "2026-10-24",
    prd: "APP-999",
  },
  {
    slug: "draft-tool",
    name: "Draft tool",
    description: "A test entry not yet live.",
    category: "Admin",
    tier: "ai",
    status: "draft",
    added: "2026-10-24",
    prd: "APP-998",
  },
];

const request = (body, headers = {}) =>
  new Request("https://jurasolutions.sg/api/apps/usage", {
    method: "POST",
    headers: { "Content-Type": "text/plain", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// 2026-10-24 01:00 in Singapore is still 2026-10-23 in UTC.
const NOW = Date.parse("2026-10-23T17:00:00Z");

describe("POST /api/apps/usage", () => {
  it("counts opens and completions per SGT day", async () => {
    const DB = await createD1();
    const env = { DB };
    for (const event of ["open", "open", "complete"]) {
      const response = await handleUsage({ request: request({ slug: "dummy-tool", event }), env, registry: REGISTRY, now: NOW });
      expect(response.status).toBe(204);
    }
    expect(DB.rows("app_usage")).toEqual([
      { day: "2026-10-24", app_slug: "dummy-tool", opens: 2, completions: 1 },
    ]);
  });

  it("refuses a slug that is not in the registry", async () => {
    const DB = await createD1();
    const response = await handleUsage({ request: request({ slug: "nope", event: "open" }), env: { DB }, registry: REGISTRY });
    expect(response.status).toBe(400);
    expect(DB.rows("app_usage")).toEqual([]);
  });

  it("refuses a draft tool, unless AI_ALLOW_DRAFTS=1 (local runs only)", async () => {
    const DB = await createD1();
    const draft = { slug: "draft-tool", event: "open" };
    expect((await handleUsage({ request: request(draft), env: { DB }, registry: REGISTRY })).status).toBe(400);
    expect(DB.rows("app_usage")).toEqual([]);
    const local = await handleUsage({ request: request(draft), env: { DB, AI_ALLOW_DRAFTS: "1" }, registry: REGISTRY });
    expect(local.status).toBe(204);
  });

  it("refuses an unknown event", async () => {
    const DB = await createD1();
    for (const event of ["download", "toString", "__proto__", undefined]) {
      const response = await handleUsage({ request: request({ slug: "dummy-tool", event }), env: { DB }, registry: REGISTRY });
      expect(response.status).toBe(400);
    }
    expect(DB.rows("app_usage")).toEqual([]);
  });

  it("refuses a body that is not JSON, or is too big", async () => {
    const DB = await createD1();
    expect((await handleUsage({ request: request("not json"), env: { DB }, registry: REGISTRY })).status).toBe(400);
    const big = JSON.stringify({ slug: "dummy-tool", event: "open", pad: "x".repeat(2000) });
    expect((await handleUsage({ request: request(big), env: { DB }, registry: REGISTRY })).status).toBe(413);
  });

  it("answers 503 when D1 is not bound", async () => {
    const response = await handleUsage({ request: request({ slug: "dummy-tool", event: "open" }), env: {}, registry: REGISTRY });
    expect(response.status).toBe(503);
  });

  it("stores no personal data", async () => {
    const DB = await createD1();
    await handleUsage({
      request: request({ slug: "dummy-tool", event: "open", email: "a@b.co" }, { "CF-Connecting-IP": "203.0.113.9" }),
      env: { DB },
      registry: REGISTRY,
    });
    const stored = JSON.stringify(DB.rows("app_usage"));
    expect(stored).not.toContain("203.0.113.9");
    expect(stored).not.toContain("a@b.co");
    expect(Object.keys(DB.rows("app_usage")[0])).toEqual(["day", "app_slug", "opens", "completions"]);
  });

  it("is wired to the Pages route, which validates against the real registry", async () => {
    const DB = await createD1();
    const response = await onRequestPost({ request: request({ slug: "not-a-real-tool", event: "open" }), env: { DB } });
    expect(response.status).toBe(400);
  });
});
