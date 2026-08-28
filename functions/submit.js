/**
 * Cloudflare Pages Function — POST /submit
 *
 * Takes an enquiry from the site's form and emails it to the inbox via Resend.
 * The API key lives in the Pages environment (`RESEND_API_KEY`) and never in
 * this repo.
 *
 * Responses the page knows how to handle:
 *   200  sent
 *   400  the enquiry did not validate
 *   405  any method other than POST or GET
 *   500  the function is not configured (no API key)
 *   502  Resend refused or was unreachable
 *
 * GET /submit is a health check — see the bottom of this file.
 */

const TO = "info@jurasolutions.sg";
const FROM = "Jura Solutions <no_reply@jurasolutions.sg>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const LIMITS = { name: 120, email: 200, phone: 40, company: 160, message: 2000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+(]?[\d\s()+.-]{6,}$/;

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The same rules the form applies in the browser. */
function validate(enquiry) {
  const problems = [];
  if (!enquiry.name) problems.push("name");
  if (!enquiry.email || !EMAIL.test(enquiry.email)) problems.push("email");
  if (enquiry.phone && !PHONE.test(enquiry.phone)) problems.push("phone");
  if (!enquiry.message || enquiry.message.length < 10) problems.push("message");
  return problems;
}

function body(enquiry) {
  const rows = [
    ["Name", enquiry.name],
    ["Work email", enquiry.email],
    ["Contact number", enquiry.phone || "not given"],
    ["Company", enquiry.company || "not given"],
  ];

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "What they would like to automate:",
    enquiry.message,
  ].join("\n");

  const html = [
    "<h2>New enquiry from jurasolutions.sg</h2>",
    "<table cellpadding='6' style='border-collapse:collapse'>",
    ...rows.map(
      ([label, value]) =>
        `<tr><td style='color:#6f7973'>${label}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`
    ),
    "</table>",
    "<p style='color:#6f7973'>What they would like to automate</p>",
    `<p>${escapeHtml(enquiry.message).replace(/\n/g, "<br>")}</p>`,
  ].join("");

  return { text, html };
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Send the enquiry as JSON." }, 400);
  }

  const enquiry = {
    name: clean(payload.name, LIMITS.name),
    email: clean(payload.email, LIMITS.email),
    phone: clean(payload.phone, LIMITS.phone),
    company: clean(payload.company, LIMITS.company),
    message: clean(payload.message, LIMITS.message),
  };

  const problems = validate(enquiry);
  if (problems.length > 0) {
    return json({ error: "Some answers did not validate.", fields: problems }, 400);
  }

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set on this Pages project.");
    return json({ error: "The enquiry form is not configured to send yet." }, 500);
  }

  const { text, html } = body(enquiry);

  let response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: enquiry.email,
        subject: `Enquiry from ${enquiry.name}${enquiry.company ? ` (${enquiry.company})` : ""}`,
        text,
        html,
      }),
    });
  } catch (error) {
    console.error("Resend was unreachable", error);
    return json({ error: "The enquiry could not be sent." }, 502);
  }

  if (!response.ok) {
    console.error("Resend refused the message", response.status, await response.text());
    return json({ error: "The enquiry could not be sent." }, 502);
  }

  return json({ ok: true }, 200);
}

/**
 * GET /submit — health check.
 *
 * Exists so it is possible to tell, from outside, whether this Function is
 * actually running. Without it a missing Function is indistinguishable from a
 * working one: an undeployed /submit falls through to the static handler, which
 * serves index.html on GET and rejects POST with 405, and neither of those says
 * what is wrong.
 *
 * A JSON reply here means the Function is live. HTML means it is not deployed.
 *
 * `canSend` reports whether RESEND_API_KEY is visible to this deployment. It
 * reveals nothing a real submission would not already expose through the 500
 * this returns when the key is absent, and it saves sending a test enquiry to
 * the live inbox just to find out.
 *
 * Method-specific handlers sit alongside each other, so this does not shadow
 * onRequestPost the way a catch-all onRequest would. Any other method still
 * gets 405 from Pages.
 */
export async function onRequestGet({ env }) {
  return json({ endpoint: "enquiry", ok: true, canSend: Boolean(env.RESEND_API_KEY) }, 200);
}
