import React from "react";
import { Card, Button, Icon } from "../../ds.js";
import { APP_SHELL } from "../../content.js";

/**
 * The enquiry form (the #contact section of the home page), tagged with the
 * tool that sent the visitor. Slugs are [a-z0-9-] only, so nothing needs
 * escaping.
 */
export function enquiryHref(slug) {
  return `/?from=apps/${slug}#contact`;
}

/**
 * Closes every tool page: the bigger version Jura would build, and one
 * button to the enquiry form with `?from=apps/<slug>`.
 */
export function TalkToUsCard({ slug, heading, body, button }) {
  return (
    <Card padding="var(--space-6)" className="tb-talk">
      <div className="stack-4">
        <span className="ju-overline">{APP_SHELL.talkEyebrow}</span>
        <h2 className="tb-talk-heading">{heading}</h2>
        <p className="tb-talk-body">{body}</p>
        <div>
          <Button
            size="lg"
            href={enquiryHref(slug)}
            iconRight={<Icon name="arrow-right" size={20} />}
          >
            {button}
          </Button>
        </div>
      </div>
    </Card>
  );
}
