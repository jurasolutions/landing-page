import React from "react";
import { Badge, Icon } from "../../ds.js";
import { APP_SHELL } from "../../content.js";
import { usePageHeading } from "../../lib/router.js";
import { PrivacyNote } from "./PrivacyNote.jsx";
import { TalkToUsCard } from "./TalkToUsCard.jsx";
import { trackUsage } from "./usage.js";

/** Lets a tool tell the shell it is showing its own talk-to-us card. */
const OwnTalkCard = React.createContext(null);

/**
 * For a tool that sometimes shows the talk-to-us card itself (the receipt
 * reader puts it under the out-of-tries notice, APP-002 §5.1 step 7). While
 * `showing` is true, the shell leaves out its closing card, so the page has
 * the card, its heading and its link once.
 */
export function useOwnTalkCard(showing) {
  const setOwn = React.useContext(OwnTalkCard);
  React.useEffect(() => {
    if (!setOwn) return undefined;
    setOwn(Boolean(showing));
    return () => setOwn(false);
  }, [setOwn, showing]);
}

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
  const [ownCard, setOwnCard] = React.useState(false);

  const counted = React.useRef(false);
  React.useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    trackUsage(app.slug, "open");
  }, [app.slug]);

  return (
    <OwnTalkCard.Provider value={setOwnCard}>
      <ToolPage app={app} copy={copy} closingCard={!ownCard}>
        {children}
      </ToolPage>
    </OwnTalkCard.Provider>
  );
}

/** The page itself. `closingCard` is false while the tool shows its own card. */
export function ToolPage({ app, copy, closingCard = true, children }) {
  const heading = usePageHeading();

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
          {closingCard && <TalkToUsCard slug={app.slug} {...copy.talk} />}
        </div>
      </section>
    </main>
  );
}
