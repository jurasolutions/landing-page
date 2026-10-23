/**
 * A very small history-API router. The site has five kinds of page, so a
 * routing library would be more code than the routes themselves.
 *
 *   /                  the marketing page, unchanged
 *   /apps              the toolbox index
 *   /apps/<slug>       one tool, loaded on demand
 *   /privacy           the privacy notice
 *   /unsubscribed      where /unsubscribe sends people afterwards
 *
 * Cloudflare Pages serves `index.html` for any path that is not a file
 * (there is no top-level 404.html), and `scripts/prerender-routes.mjs` writes
 * a copy per route with that route's title and description, so links shared
 * from any of these pages preview properly.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

const listeners = new Set();
let focusPending = false;
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const snapshot = () => window.location.pathname + window.location.search;

/** The current path and query. Re-renders on navigation. */
export function useLocation() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "/");
  const at = value.indexOf("?");
  return at === -1
    ? { pathname: value, search: "" }
    : { pathname: value.slice(0, at), search: value.slice(at) };
}

/** Strips a trailing slash so /apps/ and /apps are the same page. */
export function normalisePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "") || "/";
  return pathname;
}

export function matchRoute(rawPathname) {
  const pathname = normalisePath(rawPathname);
  if (pathname === "/") return { name: "home" };
  if (pathname === "/apps") return { name: "apps" };
  if (pathname === "/privacy") return { name: "privacy" };
  if (pathname === "/unsubscribed") return { name: "unsubscribed" };
  const tool = pathname.match(/^\/apps\/([a-z0-9-]{1,60})$/);
  if (tool) return { name: "app", slug: tool[1] };
  return { name: "notfound" };
}

/** True for paths this router renders (as opposed to Functions such as /submit). */
export function isAppPath(pathname) {
  return matchRoute(pathname).name !== "notfound";
}

export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, window.location.href);
  const samePage =
    url.pathname === window.location.pathname && url.search === window.location.search;

  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  focusPending = !url.hash;
  notify();

  if (url.hash) {
    // Give the new page a frame to render before looking for the anchor.
    requestAnimationFrame(() => scrollToHash(url.hash));
  } else if (!samePage) {
    window.scrollTo(0, 0);
  }
}

/**
 * Ref for a page's main heading. After a client-side navigation the heading
 * takes focus, so keyboard and screen reader users start at the top of the
 * page that just appeared. On a first page load nothing moves.
 */
export function usePageHeading() {
  const ref = useRef(null);
  useEffect(() => {
    if (!focusPending || !ref.current) return;
    focusPending = false;
    ref.current.setAttribute("tabindex", "-1");
    ref.current.focus({ preventScroll: true });
  }, []);
  return ref;
}

export function scrollToHash(hash) {
  if (!hash || hash.length < 2) return;
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    target = null;
  }
  target?.scrollIntoView();
}

/**
 * Turns clicks on ordinary same-origin links to router paths into client-side
 * navigation. Working at the document level means the design system's
 * `Button href` and plain anchors both behave, with no special Link
 * component. Hash-only links (`#services` on the home page) and anything
 * with a modifier key, a target or a download attribute are left to the
 * browser.
 */
export function interceptLinks() {
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest?.("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || !isAppPath(url.pathname)) return;

    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

/**
 * `href` for a link to a section of the home page. On the home page itself
 * it stays a plain `#anchor`, exactly as before; elsewhere it points back to
 * `/#anchor`.
 */
export function homeAnchor(hash, onHome) {
  return onHome ? hash : `/${hash}`;
}
