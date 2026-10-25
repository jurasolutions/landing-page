import { describe, expect, it } from "vitest";
import { PRIVACY } from "../src/content.js";

/**
 * The privacy notice must stay true of the code and of how the scout works.
 * These pin the statements that once said more than the system does.
 */
const text = PRIVACY.sections.flatMap((s) => s.paragraphs).join("\n");

describe("the privacy notice", () => {
  it("says visits are counted with Cloudflare Web Analytics, without cookies", () => {
    // Switched on in the Pages project (Metrics → Web Analytics) on 2026-10-25.
    // If it is ever switched off, take this sentence out of the notice.
    expect(text).toMatch(/Cloudflare Web Analytics, which does not use cookies/);
  });

  it("says the AI try count is also kept against the IP address alone", () => {
    // server/limit.js: AI_TRIES_PER_IP, counted against a salted IP-only hash.
    expect(text).toMatch(/IP address alone/);
  });

  it("says a reply 'unsubscribe' is handled by hand, well within ten business days", () => {
    // Reply detection is optional (scout §5.5); without it, a person reads the reply.
    // The timeframe is the Spam Control Act's. jura-growth check-copy fails any
    // figure, digits or words, in a sentence about Jura ("we"), so the sentence
    // is written without "we".
    const outreach = PRIVACY.sections.find((s) => s.heading === "Emails we send to businesses").paragraphs.join(" ");
    expect(outreach).toMatch(/reply “unsubscribe”, and the address is added by hand, well within ten business days\./);
    expect(outreach).not.toMatch(/reply[^.]*\. Either way the address goes on our do-not-email list straight away/);
  });

  it("describes the addresses the scout writes to as scout §5.2 does", () => {
    const outreach = PRIVACY.sections.find((s) => s.heading === "Emails we send to businesses").paragraphs.join(" ");
    expect(outreach).not.toMatch(/personal addresses/);
    expect(outreach).toMatch(/named person's address only/);
  });
});
