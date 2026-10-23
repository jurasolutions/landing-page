import React from "react";

import { Hero } from "../sections/Hero.jsx";
import { Problem } from "../sections/Problem.jsx";
import { Services } from "../sections/Services.jsx";
import { HowWeWork } from "../sections/HowWeWork.jsx";
import { Proof } from "../sections/Proof.jsx";
import { Trust } from "../sections/Trust.jsx";
import { Faq } from "../sections/Faq.jsx";
import { Contact } from "../sections/Contact.jsx";
import { scrollToHash } from "../lib/router.js";

/**
 * The house section order, from `design-system/README.md` §7: hero, problem,
 * services, how we work, proof of method, trust, FAQ, CTA band, footer.
 * White and sunken bands alternate; the CTA band is the only dark surface
 * above the footer.
 *
 * When the visitor arrives from another page with a hash (/#services, or
 * /?from=apps/<slug>#contact from a tool's talk-to-us card), the sections
 * only exist once this renders, so scroll to the anchor here.
 */
export function Home() {
  React.useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash);
  }, []);

  return (
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
  );
}
