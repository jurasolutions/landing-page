import React from "react";
import { Button, Icon } from "../ds.js";
import { NOT_FOUND, ROUTE_META } from "../content.js";
import { usePageHeading } from "../lib/router.js";
import { useMeta } from "../lib/meta.js";
import "../styles/toolbox.css";

export function NotFound() {
  const heading = usePageHeading();
  useMeta(ROUTE_META.notfound);

  return (
    <main id="main" className="tb-page">
      <section className="tb-band tb-head tb-head--tall">
        <div className="wrap stack-5">
          <h1 ref={heading} className="tb-title">
            {NOT_FOUND.heading}
          </h1>
          <p className="tb-subtitle">{NOT_FOUND.body}</p>
          <div className="tb-actions">
            <Button size="lg" href="/apps" iconRight={<Icon name="arrow-right" size={20} />}>
              {NOT_FOUND.toToolbox}
            </Button>
            <Button size="lg" variant="secondary" href="/">
              {NOT_FOUND.toHome}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default NotFound;
