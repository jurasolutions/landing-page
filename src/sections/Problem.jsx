import React from "react";
import { Section } from "../components/Section.jsx";
import { PROBLEM } from "../content.js";

/**
 * Plain statements of the daily reality. No icons here by design — the
 * hairline between rows is the only structure the list needs.
 */
export function Problem() {
  return (
    <Section label={PROBLEM.label} tone="sunken">
      <div className="stack-6">
        <div className="stack-3">
          <h2 className="heading-1">{PROBLEM.heading}</h2>
          <p className="lede">{PROBLEM.lede}</p>
        </div>

        <ul className="reality-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {PROBLEM.statements.map((statement) => (
            <li className="reality-item" key={statement}>
              {statement}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
