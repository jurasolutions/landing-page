import React from "react";
import { Button, Icon, MotionPanel, AutomationFlow } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { HERO } from "../content.js";
import { usePageHeading } from "../lib/router.js";

export function Hero() {
  // The page's heading, so arriving at / from another page starts here.
  const heading = usePageHeading();

  return (
    <Section id="top" label={HERO.label} tone="wash" spine="start">
      {/* The claim sits above the diagram rather than beside it, so the flow
          gets the full column and reads left to right, which is the whole
          point of it. */}
      <div className="stack-6">
        <div className="hero-copy stack-5">
          <h1
            ref={heading}
            style={{
              fontSize: "var(--text-display-1)",
              letterSpacing: "var(--tracking-display)",
              lineHeight: "var(--leading-tight)",
              fontWeight: "var(--weight-semibold)",
            }}
          >
            {HERO.heading}
          </h1>

          <p className="lede">{HERO.lede}</p>

          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button size="lg" href="#contact" iconRight={<Icon name="arrow-right" size={18} />}>
              {HERO.primary}
            </Button>
            <Button size="lg" variant="secondary" href="#how">
              {HERO.secondary}
            </Button>
          </div>

          <ul
            className="assurances"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {HERO.assurances.map((item) => (
              <li className="assurance" key={item}>
                <Icon name="check" size={16} color="var(--green-600)" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <MotionPanel caption={HERO.motionCaption}>
          <AutomationFlow steps={HERO.flowSteps} />
        </MotionPanel>
      </div>
    </Section>
  );
}
