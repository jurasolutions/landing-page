import React from "react";
import { Card, Field, Input, Textarea, Button, Alert, Icon } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { CONTACT, CONTACT_EMAIL } from "../content.js";
import { validateEnquiry, EMPTY_ENQUIRY, FIELD_ORDER, LIMITS, readFrom } from "../lib/validate.js";

const ENDPOINT = import.meta.env.VITE_ENQUIRY_ENDPOINT || "/submit";

const LABELS = {
  name: "Name",
  email: "Work email",
  phone: "Contact number",
  company: "Company",
  message: "What would you like to automate?",
};

export function Contact() {
  const [values, setValues] = React.useState(EMPTY_ENQUIRY);
  const [errors, setErrors] = React.useState({});
  const [status, setStatus] = React.useState("idle"); // idle | sending | sent | failed
  const formRef = React.useRef(null);
  const statusRef = React.useRef(null);

  // Send the visitor to the outcome rather than leaving it above the fold of a
  // long form. Works the same for a screen reader and for a mouse.
  React.useEffect(() => {
    if (status === "sent" || status === "failed") statusRef.current?.focus();
  }, [status]);

  const set = (key) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the visitor starts fixing it.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const focusFirstError = (found) => {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) formRef.current?.querySelector(`#enquiry-${first}`)?.focus();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (status === "sending") return;

    const found = validateEnquiry(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus("idle");
      focusFirstError(found);
      return;
    }

    setStatus("sending");
    // A toolbox page links here with ?from=apps/<slug>. Read it at send time
    // so it reflects the page the visitor actually arrived from.
    const from = readFrom(window.location.search);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(from ? { ...values, from } : values),
      });
      if (!response.ok) throw new Error(`Enquiry failed with status ${response.status}`);
      setStatus("sent");
      setValues(EMPTY_ENQUIRY);
    } catch {
      // Whatever went wrong, the visitor keeps everything they typed.
      setStatus("failed");
    }
  };

  const invalidCount = Object.values(errors).filter(Boolean).length;

  return (
    <Section id="contact" label={CONTACT.label} tone="dark" spine="end">
        <div className="split split--top">
          <div className="stack-4">
            <h2 className="contact-heading">{CONTACT.heading}</h2>
            <p className="contact-lede">{CONTACT.lede}</p>
            <p className="contact-detail">
              Or email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>

          <Card
            padding="var(--space-6)"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            <form ref={formRef} onSubmit={onSubmit} noValidate className="stack-4">
              {(status === "sent" || status === "failed") && (
                <div ref={statusRef} tabIndex={-1} style={{ outlineOffset: "var(--space-2)" }}>
                  {status === "sent" ? (
                    <Alert
                      tone="success"
                      title={CONTACT.successTitle}
                      icon={<Icon name="check" size={18} />}
                    >
                      {CONTACT.successBody}
                    </Alert>
                  ) : (
                    <Alert
                      tone="danger"
                      title={CONTACT.errorTitle}
                      icon={<Icon name="alert-circle" size={18} />}
                    >
                      {CONTACT.errorBody}
                    </Alert>
                  )}
                </div>
              )}

              {invalidCount > 0 && (
                <Alert
                  tone="danger"
                  title={
                    invalidCount === 1
                      ? "One answer needs another look"
                      : `${invalidCount} answers need another look`
                  }
                  icon={<Icon name="alert-circle" size={18} />}
                >
                  {FIELD_ORDER.filter((key) => errors[key])
                    .map((key) => LABELS[key])
                    .join(", ")}
                </Alert>
              )}

              <Field label={LABELS.name} required htmlFor="enquiry-name" error={errors.name}>
                <Input
                  id="enquiry-name"
                  name="name"
                  autoComplete="name"
                  maxLength={LIMITS.name}
                  placeholder="Your name"
                  value={values.name}
                  onChange={set("name")}
                  invalid={Boolean(errors.name)}
                  aria-invalid={Boolean(errors.name)}
                />
              </Field>

              <Field label={LABELS.email} required htmlFor="enquiry-email" error={errors.email}>
                <Input
                  id="enquiry-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={LIMITS.email}
                  placeholder="you@company.com"
                  iconLeft={<Icon name="mail" size={16} />}
                  value={values.email}
                  onChange={set("email")}
                  invalid={Boolean(errors.email)}
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <Field
                label={LABELS.phone}
                htmlFor="enquiry-phone"
                error={errors.phone}
                hint="Optional. Useful if you would rather we called."
              >
                <Input
                  id="enquiry-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={LIMITS.phone}
                  placeholder="+65 0000 0000"
                  iconLeft={<Icon name="phone" size={16} />}
                  value={values.phone}
                  onChange={set("phone")}
                  invalid={Boolean(errors.phone)}
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>

              <Field label={LABELS.company} htmlFor="enquiry-company" error={errors.company}>
                <Input
                  id="enquiry-company"
                  name="company"
                  autoComplete="organization"
                  maxLength={LIMITS.company}
                  placeholder="Where you work"
                  iconLeft={<Icon name="building-2" size={16} />}
                  value={values.company}
                  onChange={set("company")}
                  invalid={Boolean(errors.company)}
                  aria-invalid={Boolean(errors.company)}
                />
              </Field>

              <Field label={LABELS.message} required htmlFor="enquiry-message" error={errors.message}>
                <Textarea
                  id="enquiry-message"
                  name="message"
                  rows={4}
                  maxLength={LIMITS.message}
                  placeholder="Month-end reconciliation, onboarding paperwork, quoting…"
                  value={values.message}
                  onChange={set("message")}
                  invalid={Boolean(errors.message)}
                  aria-invalid={Boolean(errors.message)}
                />
              </Field>

              <Button type="submit" fullWidth size="lg" disabled={status === "sending"}>
                {status === "sending" ? "Sending" : CONTACT.submit}
              </Button>

              <span className="note" style={{ textAlign: "center" }}>
                {CONTACT.note}
              </span>
            </form>
          </Card>
        </div>
    </Section>
  );
}
