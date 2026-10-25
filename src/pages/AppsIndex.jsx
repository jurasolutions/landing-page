import React from "react";
import { Card, Badge, Button, Icon, Tag } from "../ds.js";
import { TOOLBOX } from "../content.js";
import { REGISTRY, appsForIndustries, industryLabel, liveApps, liveIndustries, parseIndustries } from "../apps/registry.js";
import { usePageHeading } from "../lib/router.js";
import "../styles/toolbox.css";

/** The industries in this page's address, for a link such as /apps?industry=general,retail. */
function industriesInAddress() {
  if (typeof window === "undefined") return [];
  return parseIndustries(new URLSearchParams(window.location.search).get("industry"));
}

/** Keeps the address in step with the filter, so the filtered list can be shared. */
function writeIndustriesToAddress(picked) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("industry");
  const rest = url.searchParams.toString();
  // Written by hand so the commas stay readable (URLSearchParams would write %2C).
  const query = [picked.length ? `industry=${picked.join(",")}` : "", rest].filter(Boolean).join("&");
  const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
  // Keep history.state: the router stores the scroll position there.
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, "", next);
  }
}

/**
 * /apps: every live tool from the registry, filterable by industry. The
 * visitor can pick several industries at once (General and Retail, say) and
 * sees every tool tagged with any of them; "All" clears the choice. Only
 * industries that have a live tool get a filter.
 */
export function AppsIndex({ registry = REGISTRY }) {
  const heading = usePageHeading();
  const apps = liveApps(registry);
  const industries = liveIndustries(registry);
  const [picked, setPicked] = React.useState(industriesInAddress);

  React.useEffect(() => writeIndustriesToAddress(picked), [picked]);

  const shown = appsForIndustries(apps, picked);

  const toggle = (id) =>
    setPicked((current) =>
      industries.map((industry) => industry.id).filter((each) => (each === id ? !current.includes(each) : current.includes(each)))
    );

  const filterTag = (value, label) => {
    const selected = value === "all" ? picked.length === 0 : picked.includes(value);
    const choose = () => (value === "all" ? setPicked([]) : toggle(value));
    return (
      <Tag
        key={value}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        selected={selected}
        onClick={choose}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            choose();
          }
        }}
        style={{ minHeight: "var(--tap-min)", paddingInline: "var(--space-4)" }}
      >
        {label}
      </Tag>
    );
  };

  return (
    <main id="main" className="tb-page">
      <header className="tb-band tb-head">
        <div className="wrap stack-4">
          <span className="ju-overline">{TOOLBOX.label}</span>
          <h1 ref={heading} className="tb-title">
            {TOOLBOX.heading}
          </h1>
          <p className="tb-subtitle">{TOOLBOX.lede}</p>
        </div>
      </header>

      <section className="tb-band" aria-labelledby="toolbox-list">
        <div className="wrap stack-5">
          <h2 id="toolbox-list" className="tb-visually-hidden">
            {TOOLBOX.heading}
          </h2>

          {apps.length === 0 ? (
            <Card padding="var(--space-6)" tone="sunken" className="tb-empty">
              <div className="stack-4">
                <h3 className="tb-empty-heading">{TOOLBOX.emptyHeading}</h3>
                <p className="prose">{TOOLBOX.emptyBody}</p>
                <div>
                  <Button size="lg" href="/#contact" iconRight={<Icon name="arrow-right" size={20} />}>
                    {TOOLBOX.emptyButton}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {industries.length > 1 && (
                <div className="tb-filters" role="group" aria-label={TOOLBOX.filterLabel} aria-describedby="tb-filters-hint">
                  <span className="tb-filters-label" aria-hidden="true">
                    {TOOLBOX.filterLabel}
                  </span>
                  {filterTag("all", TOOLBOX.allLabel)}
                  {industries.map((industry) => filterTag(industry.id, industry.label))}
                  <span id="tb-filters-hint" className="tb-filters-hint">
                    {TOOLBOX.filterHint}
                  </span>
                </div>
              )}

              {shown.length === 0 ? (
                <p className="prose">{TOOLBOX.noneForIndustries}</p>
              ) : (
                <ul className="tb-grid" aria-live="polite">
                  {shown.map((app) => (
                    <li key={app.slug}>
                      <a className="tb-card-link" href={`/apps/${app.slug}`}>
                        <Card interactive padding="var(--space-5)" className="tb-card">
                          <div className="tb-badges">
                            {(app.industries ?? []).map((id) => (
                              <Badge key={id} tone="neutral">
                                {industryLabel(id)}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="tb-card-name">{app.name}</h3>
                          <p className="tb-card-desc">{app.description}</p>
                          <span className="tb-card-foot">
                            <span className="tb-card-tier">{TOOLBOX.tierLabel[app.tier]}</span>
                            <span className="tb-card-open">
                              {TOOLBOX.open}
                              <Icon name="arrow-right" size={16} />
                            </span>
                          </span>
                        </Card>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default AppsIndex;
