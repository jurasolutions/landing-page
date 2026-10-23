/**
 * Enquiry form rules, shared in spirit with `functions/submit.js` — the server
 * checks the same things, because client-side validation is a courtesy, not a
 * guarantee.
 *
 * Name, work email and the description are required. Contact number and
 * company are optional: asking for a phone number before a first conversation
 * is friction we do not need.
 */

export const LIMITS = {
  name: 120,
  email: 200,
  phone: 40,
  company: 160,
  message: 2000,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+(]?[\d\s()+.-]{6,}$/;

export const EMPTY_ENQUIRY = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
};

export function validateEnquiry(values) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  const company = values.company.trim();
  const message = values.message.trim();

  if (!name) errors.name = "Tell us your name.";
  else if (name.length > LIMITS.name) errors.name = "That is longer than we can store.";

  if (!email) errors.email = "We need an email address to reply to.";
  else if (!EMAIL.test(email) || email.length > LIMITS.email)
    errors.email = "That does not look like an email address.";

  if (phone && (!PHONE.test(phone) || phone.length > LIMITS.phone))
    errors.phone = "That does not look like a phone number.";

  if (company.length > LIMITS.company) errors.company = "That is longer than we can store.";

  if (!message) errors.message = "Tell us roughly what the work involves.";
  else if (message.length < 10) errors.message = "A sentence is enough, but we need a sentence.";
  else if (message.length > LIMITS.message)
    errors.message = `Keep it under ${LIMITS.message} characters.`;

  return errors;
}

/** Field order, so the error summary and focus follow the visual order. */
export const FIELD_ORDER = ["name", "email", "phone", "company", "message"];

/**
 * Where an enquiry came from. Toolbox pages link to the form with
 * `?from=apps/<slug>`, and the form passes that on so the email says which
 * tool brought the visitor in. Anything that does not match is dropped
 * quietly; it is a label, not an answer the visitor gave.
 * `functions/submit.js` applies the same pattern.
 */
export const FROM_PATTERN = /^apps\/[a-z0-9-]{1,60}$/;

export function readFrom(search) {
  const value = new URLSearchParams(search ?? "").get("from");
  return value && FROM_PATTERN.test(value) ? value : "";
}
