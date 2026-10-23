import React from "react";
import { Card, Badge, Button, Icon, Tag } from "../ds.js";
import { TOOLBOX } from "../content.js";
import { REGISTRY, liveApps, liveCategories } from "../apps/registry.js";
import { usePageHeading } from "../lib/router.js";
import "../styles/toolbox.css";

/**
 * /apps: every live tool from the registry, filterable by category. Only
 * categories that have a live tool get a filter, so a filter never leads to
 * an empty grid.
 */
export function AppsIndex({ registry = REGISTRY }) {
  const heading = usePageHeading();
  const apps = liveApps(registry);
  const categories = liveCategories(registry);
  const [category, setCategory] = React.useState("all");

  const shown = category === "all" ? apps : apps.filter((app) => app.category === category);

  const filterTag = (value, label) => {
    const selected = category === value;
    const choose = () => setCategory(value);
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
              {categories.length > 1 && (
                <div className="tb-filters" role="group" aria-label={TOOLBOX.filterLabel}>
                  <span className="tb-filters-label" aria-hidden="true">
                    {TOOLBOX.filterLabel}
                  </span>
                  {filterTag("all", TOOLBOX.allLabel)}
                  {categories.map((name) => filterTag(name, name))}
                </div>
              )}

              {shown.length === 0 ? (
                <p className="prose">{TOOLBOX.noneInCategory}</p>
              ) : (
                <ul className="tb-grid" aria-live="polite">
                  {shown.map((app) => (
                    <li key={app.slug}>
                      <a className="tb-card-link" href={`/apps/${app.slug}`}>
                        <Card interactive padding="var(--space-5)" className="tb-card">
                          <div className="tb-badges">
                            <Badge tone="neutral">{app.category}</Badge>
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
