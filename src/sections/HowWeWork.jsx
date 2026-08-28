import React from "react";
import { MotionPanel, ApprovalTrack } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { HOW } from "../content.js";

export function HowWeWork() {
  return (
    <Section id="how" label={HOW.label} tone="sunken">
      <div className="split split--top">
        <div className="stack-5">
          <h2 className="heading-1">{HOW.heading}</h2>
          <p className="lede">{HOW.lede}</p>
          <MotionPanel caption={HOW.motionCaption}>
            <ApprovalTrack
              stages={["Submitted", "Checked", "Approved", "Filed"]}
              title="Purchase request"
              meta="auto-routed"
            />
          </MotionPanel>
        </div>

        {/* The steps are a real sequence, so they are numbered. */}
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {HOW.steps.map((step) => (
            <li className="step" key={step.n}>
              <span className="step-n" aria-hidden="true">
                {step.n}
              </span>
              <div className="stack-3">
                <h3 className="heading-2">{step.title}</h3>
                <p className="prose">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
