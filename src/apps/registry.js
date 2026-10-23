/**
 * The toolbox registry.
 *
 * `registry.json` is the single source of truth for which tools exist. It is
 * data, not code, because three things read it: this site, the Pages
 * Functions (to validate slugs), and the growth CLI in `repos/growth`.
 *
 * Each entry:
 *   { slug, name, description, category, tier: "browser" | "ai",
 *     status: "live" | "draft", added: "YYYY-MM-DD", prd: "APP-NNN" }
 *
 * Adding a tool means adding one folder under `src/apps/<slug>/` (with an
 * `index.jsx` and a `copy.js`) and one entry here. Nothing else changes.
 */
import entries from "./registry.json";

export const CATEGORIES = ["Sales", "Finance", "Admin", "HR", "Marketing", "Documents"];
export const TIERS = ["browser", "ai"];
export const STATUSES = ["live", "draft"];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRD = /^APP-\d{3,}$/;

export const REGISTRY = entries;

/** Problems with a registry list, as readable strings. Empty means valid. */
export function validateRegistry(list) {
  const problems = [];
  if (!Array.isArray(list)) return ["The registry must be an array."];

  const seen = new Set();
  list.forEach((entry, index) => {
    const at = `entry ${index} (${entry?.slug ?? "no slug"})`;
    if (!entry || typeof entry !== "object") {
      problems.push(`${at}: not an object`);
      return;
    }
    if (!SLUG.test(entry.slug ?? "") || entry.slug.length > 60) problems.push(`${at}: bad slug`);
    if (seen.has(entry.slug)) problems.push(`${at}: duplicate slug`);
    seen.add(entry.slug);
    if (typeof entry.name !== "string" || !entry.name.trim()) problems.push(`${at}: missing name`);
    if (typeof entry.description !== "string" || !entry.description.trim())
      problems.push(`${at}: missing description`);
    if (!CATEGORIES.includes(entry.category)) problems.push(`${at}: unknown category`);
    if (!TIERS.includes(entry.tier)) problems.push(`${at}: unknown tier`);
    if (!STATUSES.includes(entry.status)) problems.push(`${at}: unknown status`);
    if (!DATE.test(entry.added ?? "")) problems.push(`${at}: added must be YYYY-MM-DD`);
    if (!PRD.test(entry.prd ?? "")) problems.push(`${at}: prd must look like APP-001`);
  });
  return problems;
}

/** Tools a visitor can see on /apps, newest first. */
export function liveApps(list = REGISTRY) {
  return list
    .filter((entry) => entry.status === "live")
    .sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : a.name.localeCompare(b.name)));
}

export function findApp(slug, list = REGISTRY) {
  return list.find((entry) => entry.slug === slug) ?? null;
}

/** Categories that have at least one live tool, in the house order. */
export function liveCategories(list = REGISTRY) {
  const used = new Set(liveApps(list).map((entry) => entry.category));
  return CATEGORIES.filter((category) => used.has(category));
}
