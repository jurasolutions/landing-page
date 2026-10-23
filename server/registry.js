/**
 * The Functions' view of the toolbox registry. They import the same JSON the
 * site renders from, so a slug is valid on the server exactly when it is in
 * `src/apps/registry.json`.
 */
import entries from "../src/apps/registry.json";

export function isKnownSlug(slug, list = entries) {
  return typeof slug === "string" && list.some((entry) => entry.slug === slug);
}

export function findEntry(slug, list = entries) {
  return list.find((entry) => entry.slug === slug) ?? null;
}
