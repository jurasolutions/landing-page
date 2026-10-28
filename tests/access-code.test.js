import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppsIndex } from "../src/pages/AppsIndex.jsx";
import { TOOLBOX } from "../src/content.js";
import { submitCode } from "../src/apps/_shared/access-code.js";
import { TryLimitNotice } from "../src/apps/_shared/TryLimitNotice.jsx";
import { fetchLimit } from "../src/apps/_shared/ai-limit.js";
import { DEFAULT_PROMO_HASH } from "../server/promo.js";

afterEach(() => vi.unstubAllGlobals());

const answer = (status) => vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));

describe("the access code control on /apps", () => {
  const html = renderToStaticMarkup(React.createElement(AppsIndex, { registry: [] }));

  it("shows as one quiet button, with no field until it is opened", () => {
    expect(html).toContain(">Access code</button>");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="tb-code-panel"');
    expect(html).not.toContain("tb-code-input");
  });

  it("says nothing about codes anywhere else on the page", () => {
    expect(html.match(/access code/gi)).toHaveLength(1);
    expect(html).not.toMatch(/promo|unlimited|voucher/i);
  });

  it("puts no secret in the page: neither the built-in hash nor anything shaped like the code", () => {
    expect(html).not.toContain(DEFAULT_PROMO_HASH);
    expect(html).not.toMatch(/\b[A-HJ-NP-Z2-9]{16}\b/);
  });

  it("uses plain, calm wording", () => {
    for (const text of Object.values(TOOLBOX.code)) {
      expect(text).not.toMatch(/!|\p{Extended_Pictographic}/u);
    }
  });
});

describe("submitting a code", () => {
  it("posts it as JSON, with cookies, to the promo Function", async () => {
    answer(200);
    expect(await submitCode("ABCD-EFGH")).toBe("accepted");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/apps/promo");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(JSON.parse(init.body)).toEqual({ code: "ABCD-EFGH" });
  });

  it.each([
    [401, "wrong"],
    [429, "tooMany"],
    [400, "unavailable"],
    [503, "unavailable"],
  ])("answers %i with %s", async (status, key) => {
    answer(status);
    expect(await submitCode("x")).toBe(key);
  });

  it("calls a dropped connection unavailable, never a wrong code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await submitCode("x")).toBe("unavailable");
  });
});

describe("what a code holder sees in a tool", () => {
  const notice = (limit) => renderToStaticMarkup(React.createElement(TryLimitNotice, { limit, copy: { triesLeft: (n) => `${n} tries left today`, limitReached: "used", capReached: "cap" } }));

  it("shows Unlimited tries instead of a count", () => {
    expect(notice({ triesLeft: 5, capReached: false, unlimited: true })).toContain("Unlimited tries");
    expect(notice({ triesLeft: 5, capReached: false, unlimited: true })).not.toContain("tries left today");
    expect(notice({ triesLeft: 5, capReached: false })).toContain("5 tries left today");
  });

  it("still tells a code holder when the site's budget is used up", () => {
    expect(notice({ triesLeft: 5, capReached: true, unlimited: true })).toContain("cap");
  });

  it("passes unlimited through from the limit endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ready: true, triesLeft: 5, capReached: false, unlimited: true })));
    expect(await fetchLimit("receipt-reader")).toMatchObject({ ready: true, unlimited: true });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ready: true, triesLeft: 5, capReached: false })));
    expect(await fetchLimit("receipt-reader")).toMatchObject({ unlimited: false });
  });
});
