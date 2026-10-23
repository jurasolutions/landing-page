import React from "react";
import { Badge, Icon } from "../../ds.js";
import { APP_SHELL } from "../../content.js";
import { usePageHeading } from "../../lib/router.js";
import { PrivacyNote } from "./PrivacyNote.jsx";
import { TalkToUsCard } from "./TalkToUsCard.jsx";
import { trackUsage } from "./usage.js";

/**
 * Every tool page has the same shape (app factory PRD §5.2): the one-line
 * promise, the tool, a privacy note, then the talk-to-us card.
 *
 * `app` is the registry entry. `copy` is the tool's copy.js:
 *   { title, subtitle, privacy, talk: { heading, body, button } }
 *
 * Opening the page counts one anonymous "open" for the tool.
 */
export function AppShell({ app, copy, children }) {
  const heading = usePageHeading();

  const counted = React.useRef(false);
  React.useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    trackUsage(app.slug, "open");
  }, [app.slug]);

  return (
    <main id="main" className="tb-page">
      <header className="tb-band tb-head">
        <div className="wrap stack-4">
          <a className="tb-crumb" href="/apps">
            <Icon name="arrow-left" size={16} />
            {APP_SHELL.back}
          </a>
          <div className="tb-badges">
            <Badge tone="neutral">{app.category}</Badge>
            <Badge tone="brand">{APP_SHELL.tierLabel[app.tier]}</Badge>
          </div>
          <h1 ref={heading} className="tb-title">
            {copy.title}
          </h1>
          <p className="tb-subtitle">{copy.subtitle}</p>
        </div>
      </header>

      <section className="tb-band tb-tool" aria-label={copy.title}>
        <div className="wrap">{children}</div>
      </section>

      <section className="tb-band tb-after">
        <div className="wrap stack-6">
          <PrivacyNote link={APP_SHELL.privacyHref ? { href: APP_SHELL.privacyHref, label: APP_SHELL.privacyLink } : null}>
            {copy.privacy}
          </PrivacyNote>
          <TalkToUsCard slug={app.slug} {...copy.talk} />
        </div>
      </section>
    </main>
  );
}
