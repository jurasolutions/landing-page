import React from "react";
import { Alert, Button, Field, Icon, Input } from "../../ds.js";
import { TOOLBOX } from "../../content.js";
import { submitCode } from "./access-code.js";

/**
 * The quiet access code control at the foot of /apps. It shows as one line of
 * plain muted text, so most visitors scroll past it; the people we give a code
 * to are told where it is. It is still a real button, reachable by keyboard
 * and screen reader. A right code sets a cookie (server/promo.js) that lifts
 * the daily limit on the AI tools for this browser.
 */
export function AccessCode() {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState(null);
  const [checking, setChecking] = React.useState(false);
  const COPY = TOOLBOX.code;

  React.useEffect(() => {
    // The design system Input does not forward a ref, so find it by id.
    if (open) document.getElementById("tb-code-input")?.focus();
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (checking || !code.trim()) return;
    setChecking(true);
    setStatus(null);
    const result = await submitCode(code);
    if (result === "accepted") setCode("");
    setStatus(result);
    setChecking(false);
  };

  return (
    <div className="tb-code">
      <button
        type="button"
        className="tb-code-toggle"
        aria-expanded={open}
        aria-controls="tb-code-panel"
        onClick={() => setOpen((current) => !current)}
      >
        {COPY.open}
      </button>
      {open && (
        <form id="tb-code-panel" className="stack-3" onSubmit={submit} noValidate>
          <div className="tb-code-row">
            <Field label={COPY.label} htmlFor="tb-code-input">
              <Input
                id="tb-code-input"
                name="access-code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={checking || !code.trim()}>
              {COPY.apply}
            </Button>
          </div>
          <div aria-live="polite">
            {status && (
              <Alert
                tone={status === "accepted" ? "success" : status === "wrong" ? "info" : "warning"}
                icon={<Icon name={status === "accepted" ? "check" : "alert-circle"} size={18} />}
              >
                {COPY[status]}
              </Alert>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
