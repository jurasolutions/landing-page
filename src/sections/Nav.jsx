import React from "react";
import { Logo, Button, IconButton, Icon } from "../ds.js";
import { NAV_LINKS, NAV, HERO } from "../content.js";
import { useLocation, homeAnchor, normalisePath } from "../lib/router.js";

/**
 * Sticky bar. The section links live in the bar on tablet and up and collapse
 * to a sheet below 900px; the primary action never leaves the bar.
 *
 * On the home page every link is the same in-page anchor it always was. On
 * any other page the section links point back to `/#section`.
 */
export function Nav() {
  const { pathname } = useLocation();
  const path = normalisePath(pathname);
  const onHome = path === "/";
  const inToolbox = path === "/apps" || path.startsWith("/apps/");
  const hrefFor = (href) => (href.startsWith("#") ? homeAnchor(href, onHome) : href);
  const currentFor = (href) => (href === "/apps" && inToolbox ? "page" : undefined);

  const [open, setOpen] = React.useState(false);
  const sheetRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      // The design system's IconButton is not a forwardRef component, so the
      // ref sits on its wrapper and we reach the button through it.
      if (wasOpen.current) triggerRef.current?.querySelector("button")?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 901px)");
    const onWiden = (event) => {
      if (event.matches) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWiden);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector("a")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWiden);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <header className="navbar">
        <div className="wrap navbar-inner">
          {/* The lockup does not fit beside the action on a small phone, so the
              mark carries the brand there. */}
          <span className="brand-lockup">
            <Logo href={onHome ? "#top" : "/"} size={32} />
          </span>
          <span className="brand-mark">
            <Logo href={onHome ? "#top" : "/"} size={32} variant="mark" />
          </span>

          <nav className="navlinks" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                className="navlink"
                href={hrefFor(link.href)}
                aria-current={currentFor(link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <Button size="sm" href={homeAnchor("#contact", onHome)}>
              {NAV.cta}
            </Button>
            <span className="nav-menu-button" ref={triggerRef}>
              <IconButton
                label={open ? NAV.menuClose : NAV.menuOpen}
                variant="ghost"
                aria-expanded={open}
                aria-controls="nav-sheet"
                onClick={() => setOpen((value) => !value)}
                icon={<Icon name={open ? "x" : "menu"} size={20} />}
              />
            </span>
          </div>
        </div>
      </header>

      {open && (
        <div
          id="nav-sheet"
          ref={sheetRef}
          className="nav-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Sections"
        >
          <div className="wrap nav-sheet-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                className="nav-sheet-link"
                href={hrefFor(link.href)}
                aria-current={currentFor(link.href)}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              className="nav-sheet-link"
              href={homeAnchor("#contact", onHome)}
              onClick={() => setOpen(false)}
            >
              {HERO.primary}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
