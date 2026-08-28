import React from "react";
import { Card, Icon } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { SERVICES } from "../content.js";

export function Services() {
  return (
    <Section id="services" label={SERVICES.label}>
      <div className="stack-6">
        <div className="stack-3">
          <h2 className="heading-1">{SERVICES.heading}</h2>
          <p className="lede">{SERVICES.lede}</p>
        </div>

        <div className="grid2">
          {SERVICES.items.map((service) => (
            <Card
              key={service.name}
              interactive
              padding="var(--space-6)"
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
            >
              <span className="service-icon">
                <Icon name={service.icon} size={22} color="var(--green-600)" />
              </span>
              <h3 className="heading-2">{service.name}</h3>
              <p className="prose">{service.body}</p>
              <span className="service-gets">
                <strong>You get: </strong>
                {service.gets}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
