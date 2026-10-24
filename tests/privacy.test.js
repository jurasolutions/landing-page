import { describe, expect, it } from "vitest";
import { PRIVACY } from "../src/content.js";

/**
 * The privacy notice must stay true of the code and of how the scout works.
 * These pin the statements that once said more than the system does.
 */
const text = PRIVACY.sections.flatMap((s) => s.paragraphs).join("\n");

describe("the privacy notice", () => {
  it("does not claim Cloudflare Web Analytics, which is not switched on", () => {
    expect(text).not.toMatch(/Web Analytics/);
  });

  it("says the AI try count is also kept against the IP address alone", () => {
    // server/limit.js: AI_TRIES_PER_IP, counted against a salted IP-only hash.
    expect(text).toMatch(/IP address alone/);
  });

  it("says a reply 'unsubscribe' is handled by hand, not straight away", () => {
    // Reply detection is optional (scout §5.5); without it, a person reads the reply.
    // No timeframe: "10 business days" is not an approved claim for jura-growth check-copy.
    const outreach = PRIVACY.sections.find((s) => s.heading === "Emails we send to businesses").paragraphs.join(" ");
    expect(outreach).toMatch(/reply “unsubscribe”, and we'll add the address by hand/);
    expect(outreach).not.toMatch(/reply[^.]*\. Either way the address goes on our do-not-email list straight away/);
  });

  it("describes the addresses the scout writes to as scout §5.2 does", () => {
    const outreach = PRIVACY.sections.find((s) => s.heading === "Emails we send to businesses").paragraphs.join(" ");
    expect(outreach).not.toMatch(/personal addresses/);
    expect(outreach).toMatch(/named person's address only/);
  });
});
