import React from "react";
import { Icon } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { TRUST } from "../content.js";

export function Trust() {
  return (
    <Section id="trust" label={TRUST.label} tone="sunken">
      <div className="stack-6">
        <div className="stack-3">
          <h2 className="heading-1">{TRUST.heading}</h2>
          <p className="lede">{TRUST.lede}</p>
        </div>

        <div className="grid2" style={{ rowGap: "var(--space-6)" }}>
          {TRUST.items.map((item) => (
            <div className="trust-item" key={item.title}>
              <span className="trust-icon">
                <Icon name={item.icon} size={20} color="var(--green-600)" />
              </span>
              <div className="stack-3">
                <h3 style={{ fontSize: "var(--text-h4)" }}>{item.title}</h3>
                <p className="prose">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
