/**
 * Per-route title, description and canonical URL, kept in step with the
 * prerendered copies `scripts/prerender-routes.mjs` writes into `dist/`.
 */
import { useEffect } from "react";
import { SITE_ORIGIN } from "../content.js";

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element && value != null) element.setAttribute(attribute, value);
}

export function applyMeta({ title, description, path, noindex = false }) {
  const url = `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
  document.title = title;
  setMeta('meta[name="description"]', "content", description);
  setMeta('link[rel="canonical"]', "href", url);
  setMeta('meta[property="og:url"]', "content", url);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);

  let robots = document.head.querySelector('meta[name="robots"]');
  if (noindex) {
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex");
  } else if (robots) {
    robots.remove();
  }
}

export function useMeta(meta) {
  useEffect(() => {
    if (meta) applyMeta(meta);
  }, [meta?.title, meta?.description, meta?.path, meta?.noindex]);
}
