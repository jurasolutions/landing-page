import React from "react";
import { Alert, Button, Icon } from "../../ds.js";

/**
 * What shows under the buttons: done (with "Start again") or a failure. The
 * region is live, so a screen reader hears each change, including "Putting
 * your file together…", which sighted visitors see on the button itself.
 */
export function Outcome({ state, copy, onStartAgain }) {
  return (
    <div className="pm-outcome" aria-live="polite">
      {state === "working" && <p className="tb-visually-hidden">{copy.working}</p>}
      {state === "done" && (
        <div className="stack-3">
          <Alert tone="success" icon={<Icon name="check" size={18} />}>
            {copy.done}
          </Alert>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={onStartAgain}
              iconLeft={<Icon name="rotate-ccw" size={20} />}
            >
              {copy.buttons.startAgain}
            </Button>
          </div>
        </div>
      )}
      {state === "failed" && (
        <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
          {copy.errors.failed}
        </Alert>
      )}
    </div>
  );
}

/** Waits for the browser to paint, so "Putting your file together…" shows before the work starts. */
export const nextPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** Puts focus on the first button inside an element, after React has drawn it. */
export function focusFirstButton(element) {
  requestAnimationFrame(() => element?.querySelector("button:not([disabled])")?.focus());
}
