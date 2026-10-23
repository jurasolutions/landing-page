/**
 * Cloudflare Turnstile in the browser. The script is added only by this
 * tool's page, on demand. The widget runs when "Read receipts" is pressed
 * (execution: "execute") and stays invisible unless Cloudflare needs the
 * visitor to tick a box (appearance: "interaction-only").
 *
 * The site key is set at build time as VITE_TURNSTILE_SITE_KEY. On the local
 * dev server, without one, Cloudflare's invisible always-pass test key is
 * used, which only ever passes against the matching test secret.
 */
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const DEV_TEST_KEY = "1x00000000000000000000BB";

export const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? DEV_TEST_KEY : "");

let loading = null;

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Renders the widget into `container` and returns { token(), reset(), remove() }. */
export async function createTurnstile(container) {
  const turnstile = await loadTurnstile();
  let pending = null;
  const settle = (fn, value) => {
    const current = pending;
    pending = null;
    current?.[fn](value);
  };

  const widget = turnstile.render(container, {
    sitekey: SITE_KEY,
    execution: "execute",
    appearance: "interaction-only",
    callback: (token) => settle("resolve", token),
    "error-callback": () => {
      settle("reject", new Error("turnstile"));
      return true;
    },
    "expired-callback": () => turnstile.reset(widget),
    "timeout-callback": () => settle("reject", new Error("turnstile")),
  });

  return {
    token() {
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        turnstile.reset(widget);
        turnstile.execute(widget);
      });
    },
    reset: () => turnstile.reset(widget),
    remove: () => turnstile.remove(widget),
  };
}
