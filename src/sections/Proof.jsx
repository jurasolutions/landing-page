import React from "react";
import {
  Tabs,
  MotionPanel,
  DocumentPipeline,
  IntegrationWeb,
  LiveDashboard,
  EffortMeter,
  ImagePlaceholder,
} from "../ds.js";
import { Section } from "../components/Section.jsx";
import { PROOF } from "../content.js";

const PANELS = {
  paperwork: (
    <DocumentPipeline
      incoming={["Supplier invoice", "Timesheet", "Delivery docket"]}
      outgoing={["Matched", "Filed"]}
    />
  ),
  systems: (
    <IntegrationWeb systems={["Accounting", "CRM", "Email", "Inventory", "Scheduling"]} />
  ),
  visibility: <LiveDashboard />,
};

export function Proof() {
  const [active, setActive] = React.useState("paperwork");
  const activeLabel = PROOF.tabs.find((tab) => tab.id === active)?.label;

  return (
    <Section id="proof" label={PROOF.label}>
      <div className="stack-6">
        <div className="stack-3">
          <h2 className="heading-1">{PROOF.heading}</h2>
          <p className="lede">{PROOF.lede}</p>
        </div>

        <Tabs tabs={PROOF.tabs} value={active} onChange={setActive} />

        <div className="split split--top" role="tabpanel" aria-label={activeLabel}>
          <MotionPanel caption={PROOF.captions[active]}>{PANELS[active]}</MotionPanel>

          <div className="stack-5">
            <EffortMeter value={80} suffix="%+" label={PROOF.meterLabel} />
            <p className="note" style={{ maxWidth: "var(--measure-narrow)" }}>
              {PROOF.meterNote}
            </p>
            <ImagePlaceholder label={PROOF.imageLabel} ratio="16 / 9" />
          </div>
        </div>
      </div>
    </Section>
  );
}
