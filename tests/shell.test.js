import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  REGISTRY,
  validateRegistry,
  liveApps,
  liveCategories,
  liveIndustries,
  appsForIndustries,
  parseIndustries,
  findApp,
} from "../src/apps/registry.js";
import { matchRoute, normalisePath, homeAnchor, isAppPath } from "../src/lib/router.js";
import { enquiryHref } from "../src/apps/_shared/TalkToUsCard.jsx";
import { AppsIndex } from "../src/pages/AppsIndex.jsx";
import { Nav } from "../src/sections/Nav.jsx";
import { AppShell, ToolPage } from "../src/apps/_shared/AppShell.jsx";
import { ROUTE_META, TOOLBOX } from "../src/content.js";
import { withMeta } from "../scripts/prerender-routes.mjs";

const DUMMY = {
  slug: "dummy-tool",
  name: "Dummy tool",
  description: "A test entry that renders a page.",
  category: "Admin",
  industries: ["general"],
  tier: "browser",
  status: "live",
  added: "2026-10-24",
  prd: "APP-999",
};

describe("the registry", () => {
  it("is valid as committed", () => {
    expect(validateRegistry(REGISTRY)).toEqual([]);
  });

  it("catches a bad entry", () => {
    const problems = validateRegistry([
      { ...DUMMY, slug: "Bad Slug", category: "Toys", tier: "cloud", added: "today", prd: "1" },
      DUMMY,
      DUMMY,
    ]);
    expect(problems.join("\n")).toMatch(/bad slug/);
    expect(problems.join("\n")).toMatch(/unknown category/);
    expect(problems.join("\n")).toMatch(/unknown tier/);
    expect(problems.join("\n")).toMatch(/added must be/);
    expect(problems.join("\n")).toMatch(/prd must/);
    expect(problems.join("\n")).toMatch(/duplicate slug/);
  });

  it("needs one or more known industries on every entry, each once", () => {
    const bad = (industries) => validateRegistry([{ ...DUMMY, industries }]).join("\n");
    expect(bad(undefined)).toMatch(/industries must be/);
    expect(bad([])).toMatch(/industries must be/);
    expect(bad(["toys"])).toMatch(/industries must be/);
    expect(bad(["general", "general"])).toMatch(/industries must be/);
    expect(bad(["general", "fnb"])).toBe("");
  });

  it("tags every committed tool General, since any business can use them so far", () => {
    for (const entry of REGISTRY) expect(entry.industries, entry.slug).toContain("general");
  });

  it("lists only live tools, and only the categories they use", () => {
    const list = [DUMMY, { ...DUMMY, slug: "draft-one", status: "draft", category: "HR" }];
    expect(liveApps(list).map((a) => a.slug)).toEqual(["dummy-tool"]);
    expect(liveCategories(list)).toEqual(["Admin"]);
    expect(findApp("draft-one", list).status).toBe("draft");
  });

  it("gives every registered tool a folder with index.jsx and copy.js", () => {
    for (const entry of REGISTRY) {
      expect(fs.existsSync(`src/apps/${entry.slug}/index.jsx`), entry.slug).toBe(true);
      expect(fs.existsSync(`src/apps/${entry.slug}/copy.js`), entry.slug).toBe(true);
    }
  });
});

describe("routing", () => {
  it("matches each page", () => {
    expect(matchRoute("/")).toEqual({ name: "home" });
    expect(matchRoute("/apps")).toEqual({ name: "apps" });
    expect(matchRoute("/apps/")).toEqual({ name: "apps" });
    expect(matchRoute("/apps/quote-builder")).toEqual({ name: "app", slug: "quote-builder" });
    expect(matchRoute("/apps/quote-builder/")).toEqual({ name: "app", slug: "quote-builder" });
    expect(matchRoute("/privacy")).toEqual({ name: "privacy" });
    expect(matchRoute("/unsubscribed")).toEqual({ name: "unsubscribed" });
    expect(matchRoute("/apps/Quote")).toEqual({ name: "notfound" });
    expect(matchRoute("/nope")).toEqual({ name: "notfound" });
  });

  it("leaves Function paths to the server", () => {
    expect(isAppPath("/submit")).toBe(false);
    expect(isAppPath("/unsubscribe")).toBe(false);
    expect(isAppPath("/api/apps/usage")).toBe(false);
  });

  it("keeps home anchors as they were on the home page", () => {
    expect(homeAnchor("#services", true)).toBe("#services");
    expect(homeAnchor("#services", false)).toBe("/#services");
    expect(normalisePath("/apps///")).toBe("/apps");
  });

  it("tags the enquiry form with the tool", () => {
    expect(enquiryHref("quote-builder")).toBe("/?from=apps/quote-builder#contact");
  });
});

describe("the /apps index", () => {
  it("shows an empty state when nothing is live", () => {
    const html = renderToStaticMarkup(React.createElement(AppsIndex, { registry: [] }));
    expect(html).toContain(TOOLBOX.emptyHeading);
    expect(html).not.toContain("tb-grid");
  });

  it("lists a live entry as a link to its page", () => {
    const html = renderToStaticMarkup(React.createElement(AppsIndex, { registry: [DUMMY] }));
    expect(html).toContain('href="/apps/dummy-tool"');
    expect(html).toContain("Dummy tool");
    expect(html).not.toContain(TOOLBOX.emptyHeading);
  });

  it("offers industry filters only when there is more than one industry", () => {
    const one = renderToStaticMarkup(React.createElement(AppsIndex, { registry: [DUMMY] }));
    expect(one).not.toContain("aria-pressed");
    const two = renderToStaticMarkup(
      React.createElement(AppsIndex, { registry: [DUMMY, { ...DUMMY, slug: "other", industries: ["retail"] }] })
    );
    // "All" starts selected; each industry is a toggle of its own.
    expect(two).toContain('aria-pressed="true"');
    expect(two.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(two).toContain(">General<");
    expect(two).toContain(">Retail<");
    expect(two).not.toContain(">F&amp;B<");
  });

  it("shows the tools for any industry picked, or all of them when none is", () => {
    const list = [
      { ...DUMMY, slug: "a", industries: ["general"] },
      { ...DUMMY, slug: "b", industries: ["retail"] },
      { ...DUMMY, slug: "c", industries: ["fnb", "logistics"] },
    ];
    const slugs = (picked) => appsForIndustries(list, picked).map((app) => app.slug);
    expect(slugs([])).toEqual(["a", "b", "c"]);
    expect(slugs(["general"])).toEqual(["a"]);
    expect(slugs(["general", "retail"])).toEqual(["a", "b"]);
    expect(slugs(["logistics"])).toEqual(["c"]);
    expect(liveIndustries(list).map((industry) => industry.id)).toEqual(["general", "fnb", "retail", "logistics"]);
  });

  it("reads the industries in an /apps?industry= link, ignoring anything unknown", () => {
    expect(parseIndustries("retail,general")).toEqual(["general", "retail"]);
    expect(parseIndustries(" FNB , toys,retail,retail")).toEqual(["fnb", "retail"]);
    expect(parseIndustries(null)).toEqual([]);
  });
});

describe("a tool page", () => {
  it("renders the shell around a dummy tool: promise, tool, privacy note, talk-to-us card", () => {
    const copy = {
      title: "Dummy tool",
      subtitle: "Does one dummy thing.",
      privacy: "Everything stays in your browser.",
      talk: { heading: "A bigger dummy", body: "We can build the real one.", button: "Tell us more" },
    };
    const html = renderToStaticMarkup(
      React.createElement(AppShell, { app: DUMMY, copy }, React.createElement("p", null, "THE TOOL"))
    );
    const order = ["Does one dummy thing.", "THE TOOL", "Everything stays in your browser.", "A bigger dummy"];
    const positions = order.map((text) => html.indexOf(text));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('href="/?from=apps/dummy-tool#contact"');
    expect(html).toContain("<h1");
  });

  it("leaves out its closing talk-to-us card while the tool shows its own", () => {
    const copy = {
      title: "Dummy tool",
      subtitle: "Does one dummy thing.",
      privacy: "Everything stays in your browser.",
      talk: { heading: "A bigger dummy", body: "We can build the real one.", button: "Tell us more" },
    };
    const page = (closingCard) =>
      renderToStaticMarkup(
        React.createElement(ToolPage, { app: DUMMY, copy, closingCard }, React.createElement("p", null, "THE TOOL"))
      );
    expect(page(true)).toContain("A bigger dummy");
    const without = page(false);
    expect(without).not.toContain("A bigger dummy");
    expect(without).not.toContain('href="/?from=apps/dummy-tool#contact"');
    expect(without).toContain("Everything stays in your browser.");
  });
});

describe("the privacy and unsubscribe pages", () => {
  it("render, and the privacy page covers the toolbox AI tools and the outreach emails", async () => {
    const { Privacy } = await import("../src/pages/Privacy.jsx");
    const { Unsubscribed } = await import("../src/pages/Unsubscribed.jsx");
    const privacy = renderToStaticMarkup(React.createElement(Privacy));
    expect(privacy).toContain("Tools that use AI");
    expect(privacy).toContain("Anthropic");
    expect(privacy).toContain("Emails we send to businesses");
    expect(privacy).toContain('href="mailto:info@jurasolutions.sg"');
    const done = renderToStaticMarkup(React.createElement(Unsubscribed));
    expect(done).toContain("unsubscribed");
  });

  it("are linked from the footer and every tool page's privacy note", async () => {
    const { FOOTER, APP_SHELL } = await import("../src/content.js");
    expect(FOOTER.columns.flatMap((c) => c.links).some((l) => l.href === "/privacy")).toBe(true);
    expect(APP_SHELL.privacyHref).toBe("/privacy");
  });
});

describe("prerendered route heads", () => {
  const index = fs.readFileSync("index.html", "utf8");

  it("swaps every tag for the route's own", () => {
    const html = withMeta(index, {
      path: "/apps/dummy-tool",
      title: 'Dummy & "quoted"',
      description: "A <test> page.",
    });
    expect(html).toContain("<title>Dummy &amp; &quot;quoted&quot;</title>");
    expect(html).toContain('<link rel="canonical" href="https://jurasolutions.sg/apps/dummy-tool" />');
    expect(html).toContain('<meta property="og:url" content="https://jurasolutions.sg/apps/dummy-tool" />');
    expect(html).toContain('<meta name="description" content="A &lt;test&gt; page." />');
    expect(html).toContain('<meta name="twitter:title" content="Dummy &amp; &quot;quoted&quot;" />');
    expect(html).not.toContain("automate the work nobody should be doing");
  });

  it("adds noindex when asked", () => {
    const html = withMeta(index, { path: "/unsubscribed", title: "x", description: "y", noindex: true });
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });
});

describe("the /apps head", () => {
  // Search results and link previews show this description, so it may only
  // name what a live tool does (design system §3: claim only what you can defend).
  it("names no tool that is still a draft", () => {
    const description = ROUTE_META.apps.description.toLowerCase();
    const drafts = REGISTRY.filter((app) => app.status === "draft");
    for (const app of drafts) {
      const subject = app.name.split(" ")[0].toLowerCase();
      expect(description, `${app.slug} is a draft`).not.toContain(subject);
    }
  });
});

describe("the top bar", () => {
  it("has the toolbox as its only destination, beside the call to action", () => {
    const html = renderToStaticMarkup(React.createElement(Nav));
    const links = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    // The logo (twice: lockup and mark), the toolbox, and Book a call.
    expect(links.filter((href) => !href.startsWith("#top") && href !== "/")).toEqual(["/apps", "#contact"]);
    expect(html).toContain(">Toolbox<");
    expect(html).toContain(">Book a call<");
    expect(html).not.toMatch(/How we work|Questions|Open menu/);
  });
});
