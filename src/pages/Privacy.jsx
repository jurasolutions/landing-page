import React from "react";
import { CONTACT_EMAIL, PRIVACY, ROUTE_META } from "../content.js";
import { usePageHeading } from "../lib/router.js";
import { useMeta } from "../lib/meta.js";
import "../styles/toolbox.css";

/** Plain text with the contact address turned into a mailto link. */
function withEmailLink(text) {
  const parts = text.split(CONTACT_EMAIL);
  return parts.flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <a key={index} href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>,
          part,
        ]
  );
}

export function Privacy() {
  const heading = usePageHeading();
  useMeta(ROUTE_META.privacy);

  return (
    <main id="main" className="tb-page">
      <header className="tb-band tb-head">
        <div className="wrap stack-4">
          <span className="ju-overline">{PRIVACY.label}</span>
          <h1 ref={heading} className="tb-title">
            {PRIVACY.heading}
          </h1>
          <p className="tb-subtitle">{PRIVACY.lede}</p>
        </div>
      </header>

      <div className="tb-band">
        <div className="wrap">
          <div className="tb-prose">
          {PRIVACY.sections.map((section) => (
            <section key={section.heading} className="tb-prose-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{withEmailLink(paragraph)}</p>
              ))}
            </section>
          ))}
          <p className="note">{PRIVACY.updated}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Privacy;
