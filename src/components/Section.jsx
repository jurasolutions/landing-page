import React from "react";

/**
 * A page band with its node on the spine.
 *
 * The spine is the page's one structural device: a hairline running from the
 * hero claim down to the closing conversation, with a node at each section.
 * `spine="start"` opens the rail at the hero node; `spine="end"` closes it at
 * the last one. Below 1024px the rail is hidden and the node and label render
 * as the ordinary eyebrow above the heading.
 */
export function Section({ id, label, tone, spine, children }) {
  const classes = ["band"];
  if (tone) classes.push(`band--${tone}`);
  if (spine) classes.push(`band--spine-${spine}`);

  return (
    <section id={id} className={classes.join(" ")}>
      <div className="wrap band-grid">
        <div className="spine">
          <span className="spine-node" aria-hidden="true" />
          <span className="spine-label">{label}</span>
        </div>
        <div className="band-body">{children}</div>
      </div>
    </section>
  );
}
