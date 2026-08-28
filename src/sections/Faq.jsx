import React from "react";
import { Accordion } from "../ds.js";
import { Section } from "../components/Section.jsx";
import { FAQ } from "../content.js";

export function Faq() {
  return (
    <Section id="faq" label={FAQ.label}>
      <div className="split split--top">
        <div className="stack-3">
          <h2 className="heading-1">{FAQ.heading}</h2>
          <p className="lede">{FAQ.lede}</p>
        </div>

        <Accordion items={FAQ.items} />
      </div>
    </Section>
  );
}
