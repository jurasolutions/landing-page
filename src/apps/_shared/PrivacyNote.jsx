import React from "react";
import { Icon } from "../../ds.js";

/**
 * What happens to the visitor's data, in one or two plain sentences, beside a
 * shield. Browser tools say it stays in the browser; AI tools say what is
 * sent, to whom, and that Jura keeps none of it.
 */
export function PrivacyNote({ children, link }) {
  return (
    <div className="tb-privacy" role="note">
      <span className="tb-privacy-icon">
        <Icon name="shield-check" size={20} color="var(--green-600)" />
      </span>
      <p className="tb-privacy-text">
        {children}
        {link && (
          <>
            {" "}
            <a href={link.href}>{link.label}</a>
          </>
        )}
      </p>
    </div>
  );
}
