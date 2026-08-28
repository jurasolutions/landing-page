import React from "react";

import { Nav } from "./sections/Nav.jsx";
import { Hero } from "./sections/Hero.jsx";
import { Problem } from "./sections/Problem.jsx";
import { Services } from "./sections/Services.jsx";
import { HowWeWork } from "./sections/HowWeWork.jsx";
import { Proof } from "./sections/Proof.jsx";
import { Trust } from "./sections/Trust.jsx";
import { Faq } from "./sections/Faq.jsx";
import { Contact } from "./sections/Contact.jsx";
import { Footer } from "./sections/Footer.jsx";

/**
 * The house section order, from `design-system/README.md` §7: hero, problem,
 * services, how we work, proof of method, trust, FAQ, CTA band, footer.
 * White and sunken bands alternate; the CTA band is the only dark surface
 * above the footer.
 */
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <Hero />
        <Problem />
        <Services />
        <HowWeWork />
        <Proof />
        <Trust />
        <Faq />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
