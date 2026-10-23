import React from "react";
import { Logo } from "../ds.js";
import { FOOTER } from "../content.js";
import { useLocation, homeAnchor, normalisePath } from "../lib/router.js";

export function Footer() {
  const onHome = normalisePath(useLocation().pathname) === "/";
  const hrefFor = (href) => (href.startsWith("#") ? homeAnchor(href, onHome) : href);

  return (
    <footer className="footer">
      <div className="wrap footer-top">
        <Logo tone="white" size={34} showTagline />

        <nav
          style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}
          aria-label="Footer"
        >
          {FOOTER.columns.map((column) => (
            <div className="footer-col" key={column.head}>
              <span className="footer-head">{column.head}</span>
              {column.links.map((link) => (
                <a className="footer-link" href={hrefFor(link.href)} key={link.label}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="wrap footer-base">
        <span>{FOOTER.base}</span>
        <span>{FOOTER.place}</span>
      </div>
    </footer>
  );
}
