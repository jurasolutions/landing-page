import React from "react";
import { Button, Icon } from "../ds.js";
import { CONTACT_EMAIL, ROUTE_META, UNSUBSCRIBED } from "../content.js";
import { useLocation, usePageHeading } from "../lib/router.js";
import { useMeta } from "../lib/meta.js";
import "../styles/toolbox.css";

/**
 * Where /unsubscribe sends people after checking their link. The Function
 * has already done the work; this page only says how it went:
 *   /unsubscribed                  done
 *   /unsubscribed?status=invalid   the link was not genuine; nothing written
 *   /unsubscribed?status=error     our side failed; nothing written
 */
export function Unsubscribed() {
  const heading = usePageHeading();
  useMeta(ROUTE_META.unsubscribed);
  const status = new URLSearchParams(useLocation().search).get("status");
  const state = status === "invalid" ? UNSUBSCRIBED.invalid : status === "error" ? UNSUBSCRIBED.error : UNSUBSCRIBED.ok;
  const [before, after] = state.body.split(CONTACT_EMAIL);

  return (
    <main id="main" className="tb-page">
      <section className="tb-band tb-head tb-head--tall">
        <div className="wrap stack-5">
          <span className="tb-state-icon" aria-hidden="true">
            <Icon name={state === UNSUBSCRIBED.ok ? "check" : "alert-circle"} size={24} color="var(--green-600)" />
          </span>
          <h1 ref={heading} className="tb-title">
            {state.heading}
          </h1>
          <p className="tb-subtitle">
            {before}
            {after !== undefined && (
              <>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                {after}
              </>
            )}
          </p>
          <div className="tb-actions">
            <Button size="lg" variant="secondary" href="/">
              {UNSUBSCRIBED.home}
            </Button>
            <Button size="lg" variant="ghost" href="/privacy">
              {UNSUBSCRIBED.privacy}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Unsubscribed;
