/**
 * Which registry entries the Functions serve. A `live` tool always; a
 * `draft` tool only where AI_ALLOW_DRAFTS=1, which belongs in `.dev.vars` for
 * local runs and is never set on Cloudflare Pages. It is the server's side of
 * VITE_SHOW_DRAFTS: without it, a draft tool's page could be hidden while its
 * API, and the money it spends, stayed open to anyone.
 */
export const allowDrafts = (env) => env?.AI_ALLOW_DRAFTS === "1";

export function isServed(entry, env) {
  return Boolean(entry) && (entry.status === "live" || allowDrafts(env));
}
