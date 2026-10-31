/**
 * The list "Download PDF" shows while a tax invoice is missing a required
 * field (PRD §2 criterion 5, decision D4, technical.md §5): the PRD's heading,
 * then one "Please add: {field}" link per entry from `missingFields`.
 *
 * It renders inside the page's existing live region, so it is announced as it
 * appears, and renders nothing when the list is empty. The heading carries
 * `data-missing-heading` and `tabIndex={-1}` so the page can move focus to it.
 * A link hands its input's id to `onFollow`, which switches a phone to the
 * Edit view before focusing the input; without script, the `#id` still jumps
 * to the input.
 */
import React from "react";
import { Alert, Icon } from "../../ds.js";
import { TAP } from "../_shared/controls.js";

const HEADING = {
  margin: 0,
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--weight-semibold)",
  color: "var(--danger-fg)",
};
const LIST = { margin: 0, padding: 0, listStyle: "none" };
const LINK = { ...TAP, display: "inline-flex", alignItems: "center", textDecoration: "underline", textUnderlineOffset: 3 };

export function MissingSummary({ missing, copy, onFollow }) {
  if (!missing.length) return null;
  return (
    <Alert tone="danger" icon={<Icon name="alert-circle" size={18} />}>
      <h2 tabIndex={-1} data-missing-heading="" style={HEADING}>
        {copy.missing.heading}
      </h2>
      <ul style={LIST}>
        {missing.map(({ key, label, target }) => (
          <li key={key}>
            <a
              href={`#${target}`}
              style={LINK}
              onClick={(event) => {
                event.preventDefault();
                onFollow(target);
              }}
            >
              {copy.missing.field(label)}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
