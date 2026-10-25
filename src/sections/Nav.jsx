import React from "react";
import { Logo, Button, Icon } from "../ds.js";
import { NAV } from "../content.js";
import { useLocation, homeAnchor, normalisePath } from "../lib/router.js";

/** Side padding that narrows on small phones, so both buttons fit at 360px. */
const SNUG = "0 clamp(var(--space-3), 3.5vw, var(--space-5))";

/**
 * Sticky bar: the logo, the toolbox, and the primary action. The toolbox is
 * the only destination in the bar (Ting Yu, 2026-10-26), shown as a button so
 * it stands out; the home page's sections stay reachable from the footer and
 * by scrolling. Both buttons fit on a 360px phone, so there is no menu sheet.
 */
export function Nav() {
  const { pathname } = useLocation();
  const path = normalisePath(pathname);
  const onHome = path === "/";
  const inToolbox = path === "/apps" || path.startsWith("/apps/");

  return (
    <header className="navbar">
      <div className="wrap navbar-inner">
        {/* The lockup does not fit beside the two buttons on a small phone, so
            the mark carries the brand there. */}
        <span className="brand-lockup">
          <Logo href={onHome ? "#top" : "/"} size={32} />
        </span>
        <span className="brand-mark">
          <Logo href={onHome ? "#top" : "/"} size={32} variant="mark" />
        </span>

        <nav className="nav-actions" aria-label={NAV.label}>
          {/* The bar keeps the 44px tap target (design system §6); the
              component sets its height inline, so the override goes through
              its style prop. */}
          <Button
            variant="secondary"
            href="/apps"
            aria-current={inToolbox ? "page" : undefined}
            iconLeft={<Icon name="wrench" size={18} color="var(--text-brand)" />}
            style={{
              minHeight: "var(--tap-min)",
              padding: SNUG,
              // A green-tinted fill so the toolbox stands out from the page,
              // without competing with the one primary button beside it.
              background: "var(--brand-subtle)",
              border: `1px solid ${inToolbox ? "var(--brand)" : "var(--brand-border)"}`,
              color: "var(--text-brand)",
            }}
          >
            {NAV.toolbox}
          </Button>
          <Button href={homeAnchor("#contact", onHome)} style={{ minHeight: "var(--tap-min)", padding: SNUG }}>
            {NAV.cta}
          </Button>
        </nav>
      </div>
    </header>
  );
}
