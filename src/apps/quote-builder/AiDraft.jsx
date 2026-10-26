import React from "react";
import { Alert, Button, Field, Icon, Textarea } from "../../ds.js";
import { TryLimitNotice } from "../_shared/TryLimitNotice.jsx";
import { fetchLimit } from "../_shared/ai-limit.js";
import { SITE_KEY, createTurnstile } from "../_shared/turnstile.js";
import { LIMITS } from "./model.js";
import { TOOL, draftFailure, sendDraftRequest } from "./draft.js";

/**
 * Draft with AI (APP-001a). The example request shows in light grey as the
 * box's placeholder; drafting with the box empty sends the example, so one
 * press shows a first-time visitor what it does. The rest of the quote
 * builder works without any of this.
 *
 * onDraft(draft) receives the Function's validated draft.
 */
export function AiDraft({ copy, onDraft }) {
  const A = copy.ai;
  const [prompt, setPrompt] = React.useState("");
  const [limit, setLimit] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const widgetRef = React.useRef(null);
  const turnstile = React.useRef(null);

  React.useEffect(() => {
    let live = true;
    fetchLimit(TOOL).then((value) => live && setLimit(value));
    return () => {
      live = false;
    };
  }, []);

  React.useEffect(() => {
    if (!SITE_KEY || !widgetRef.current) return undefined;
    let cancelled = false;
    createTurnstile(widgetRef.current, () => cancelled)
      .then((widget) => {
        if (cancelled) widget.remove();
        else turnstile.current = widget;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      turnstile.current?.remove();
      turnstile.current = null;
    };
  }, []);

  const unavailable = Boolean(limit && (!limit.ready || !SITE_KEY));
  const outOfTries = Boolean(limit?.ready && (limit.capReached || limit.triesLeft <= 0));
  const canDraft = Boolean(limit) && !unavailable && !outOfTries && !sending;

  const draft = async () => {
    if (!canDraft) return;
    const triesBefore = limit.triesLeft;
    setSending(true);
    setError("");
    let token;
    try {
      token = await turnstile.current.token();
    } catch {
      setSending(false);
      setError(A.errors.botCheck);
      return;
    }
    const { status, body } = await sendDraftRequest(prompt.trim() || A.example, token);
    setSending(false);

    if (status === 200 && body.draft && Array.isArray(body.draft.items)) {
      setLimit((current) => ({ ...current, triesLeft: body.triesLeft ?? 0 }));
      onDraft(body.draft);
      return;
    }
    if (status === 429) {
      setLimit((current) => ({ ...current, triesLeft: 0, capReached: body.error === "cap" }));
      return;
    }
    if (typeof body.triesLeft === "number") setLimit((current) => ({ ...current, triesLeft: body.triesLeft }));
    setError(draftFailure({ status, body, triesBefore }, copy));
  };

  const limitCopy = { triesLeft: A.triesLeft, limitReached: A.limitReached, capReached: A.capReached };

  return (
    <section className="qb-ai stack-4" aria-labelledby="qb-ai-heading">
      <div className="qb-ai-head">
        <h2 id="qb-ai-heading" className="qb-ai-title">
          {A.heading}
        </h2>
        {unavailable ? null : <TryLimitNotice limit={limit} copy={limitCopy} />}
      </div>

      {unavailable && (
        <Alert tone="warning" icon={<Icon name="alert-circle" size={18} />}>
          {A.notReady}
        </Alert>
      )}

      <Field label={A.label} htmlFor="qb-ai-prompt">
        <Textarea
          id="qb-ai-prompt"
          rows={4}
          value={prompt}
          placeholder={A.example}
          maxLength={LIMITS.aiPrompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-describedby="qb-ai-hint"
          disabled={sending}
        />
        <span id="qb-ai-hint" className="qb-note">
          {A.hint}
        </span>
      </Field>

      <div className="qb-ai-send">
        <Button
          type="button"
          size="lg"
          disabled={!canDraft}
          aria-describedby="qb-ai-one-try"
          onClick={draft}
          iconLeft={<Icon name={sending ? "loader" : "file-text"} size={20} />}
        >
          {sending ? A.drafting : A.button}
        </Button>
        <p className="qb-hint" id="qb-ai-one-try">
          {limit ? A.oneTry : A.loading}
        </p>
      </div>
      <div ref={widgetRef} className="qb-ai-turnstile" />

      <div className="tb-live" aria-live="polite">
        {error && (
          <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
            {error}
          </Alert>
        )}
      </div>
    </section>
  );
}
