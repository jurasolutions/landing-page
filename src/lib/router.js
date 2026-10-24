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
const notify = () => listeners.forEach((listener) => listener());

// One popstate handler for the whole router. It plans focus and scroll
// before telling React, because React renders the new page (and runs its
// heading effect) as soon as it is told.
function subscribe(listener) {
  if (listeners.size === 0) {
    current = here();
    window.addEventListener("popstate", onPopState);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("popstate", onPopState);
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

const samePage = (from, to) =>
  normalisePath(from.pathname) === normalisePath(to.pathname) && from.search === to.search;

/**
 * What a client-side navigation does once the URL has changed. A new page
 * starts at the top with its heading focused. A link to a section scrolls
 * there and leaves focus alone. A link to the page already showing does
 * nothing, so it leaves no focus request behind to fire on a later page.
 */
export function planNavigation(from, to) {
  if (to.hash) return { focus: false, scroll: "hash" };
  if (samePage(from, to)) return { focus: false, scroll: "none" };
  return { focus: true, scroll: "top" };
}

/**
 * What back or forward does. Moving within one page (the home page's section
 * links) is the browser's business. Moving between pages restores the scroll
 * position saved when the visitor left that entry, or the top, and focuses
 * the heading the way a click would. `state` is the entry's history state.
 */
export function planHistoryStep(from, to, state) {
  if (samePage(from, to)) return null;
  const saved = state?.scrollY;
  const known = typeof saved === "number" && Number.isFinite(saved) && saved >= 0;
  if (!known && to.hash) return { focus: false, scroll: "hash" };
  return { focus: true, scroll: "restore", scrollY: known ? saved : 0 };
}

// The page whose heading should take focus when it mounts, or null. Every
// navigation replaces it, so a request nobody claimed cannot move focus on a
// page reached later.
let focusFor = null;

export function requestHeadingFocus(pathname) {
  focusFor = pathname == null ? null : normalisePath(pathname);
}

/** True once for the page the request was made for, then false. */
export function claimHeadingFocus(pathname) {
  if (focusFor === null || focusFor !== normalisePath(pathname)) return false;
  focusFor = null;
  return true;
}

const here = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
});

// Where the visitor was before the latest history change. The popstate event
// arrives after the URL has already changed, so it is kept here.
let current = null;
let restoring = 0;

function scrollTop(top) {
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

/**
 * Scrolls to `top` once the page is tall enough to get there. A route loaded
 * on demand renders a short placeholder first, so this waits up to about a
 * second for the real page before settling for as far as it can go.
 */
function restoreScroll(top) {
  const run = (restoring += 1);
  const attempt = (framesLeft) => {
    if (run !== restoring) return;
    const reachable = document.documentElement.scrollHeight - window.innerHeight;
    if (reachable >= top || framesLeft <= 0) scrollTop(top);
    else requestAnimationFrame(() => attempt(framesLeft - 1));
  };
  attempt(60);
}

export function navigate(to, { replace = false } = {}) {
  const from = here();
  const url = new URL(to, window.location.href);
  const plan = planNavigation(from, url);
  restoring += 1;

  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    // Remember how far down the page the visitor was, for the back button.
    window.history.replaceState({ ...(window.history.state ?? {}), scrollY: window.scrollY }, "");
    window.history.pushState(null, "", url);
  }
  current = here();
  requestHeadingFocus(plan.focus ? url.pathname : null);
  notify();

  if (plan.scroll === "hash") {
    // Give the new page a frame to render before looking for the anchor.
    requestAnimationFrame(() => scrollToHash(url.hash));
  } else if (plan.scroll === "top") {
    // Instant, not the smooth scroll the page uses for its section links.
    scrollTop(0);
  }
}

/**
 * Back and forward. Between the router's pages, the heading of the page that
 * appears takes focus and the scroll position is restored once the page has
 * rendered. Within one page (section links) the browser handles it.
 */
function onPopState(event) {
  const to = here();
  const plan = planHistoryStep(current ?? to, to, event.state);
  current = to;
  if (plan) {
    restoring += 1;
    requestHeadingFocus(plan.focus ? to.pathname : null);
  }
  notify();
  if (plan?.scroll === "hash") requestAnimationFrame(() => scrollToHash(to.hash));
  else if (plan) restoreScroll(plan.scrollY);
}

/**
 * Ref for a page's main heading. After a client-side navigation the heading
 * takes focus, so keyboard and screen reader users start at the top of the
 * page that just appeared. On a first page load nothing moves.
 */
export function usePageHeading() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !claimHeadingFocus(window.location.pathname)) return;
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
