/**
 * The toolbox registry.
 *
 * `registry.json` is the single source of truth for which tools exist. It is
 * data, not code, because three things read it: this site, the Pages
 * Functions (to validate slugs), and the growth CLI in `repos/growth`.
 *
 * Each entry:
 *   { slug, name, description, category, industries: ["general", ...],
 *     tier: "browser" | "ai", status: "live" | "draft", added: "YYYY-MM-DD",
 *     prd: "APP-NNN" }
 *
 * `category` is what the tool does (Sales, Finance and so on) and stays for
 * the app factory. `industries` is who it suits, and drives the filter on
 * /apps: every tool any business can use is tagged "general", plus each
 * industry it fits especially well.
 *
 * Adding a tool means adding one folder under `src/apps/<slug>/` (with an
 * `index.jsx` and a `copy.js`) and one entry here. Nothing else changes.
 */
import entries from "./registry.json";

export const CATEGORIES = ["Sales", "Finance", "Admin", "HR", "Marketing", "Documents"];

/**
 * The industries the toolbox can be filtered by, in the order the filter
 * shows them. `id` is what the registry and the /apps?industry= link use.
 */
export const INDUSTRIES = [
  { id: "general", label: "General" },
  { id: "fnb", label: "F&B" },
  { id: "retail", label: "Retail" },
  { id: "logistics", label: "Logistics" },
  { id: "professional-services", label: "Professional services" },
];
const INDUSTRY_IDS = INDUSTRIES.map((industry) => industry.id);

export const industryLabel = (id) => INDUSTRIES.find((industry) => industry.id === id)?.label ?? id;
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
    if (
      !Array.isArray(entry.industries) ||
      entry.industries.length === 0 ||
      !entry.industries.every((id) => INDUSTRY_IDS.includes(id)) ||
      new Set(entry.industries).size !== entry.industries.length
    )
      problems.push(`${at}: industries must be one or more of ${INDUSTRY_IDS.join(", ")}`);
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

/** Industries that have at least one live tool, in the house order. */
export function liveIndustries(list = REGISTRY) {
  const used = new Set(liveApps(list).flatMap((entry) => entry.industries ?? []));
  return INDUSTRIES.filter((industry) => used.has(industry.id));
}

/**
 * The tools to show for the industries picked: any tool tagged with at least
 * one of them. Nothing picked shows every tool.
 */
export function appsForIndustries(apps, picked) {
  if (!picked || picked.length === 0) return apps;
  return apps.filter((app) => (app.industries ?? []).some((id) => picked.includes(id)));
}

/**
 * The industries in an /apps?industry=general,retail link: known ids only,
 * each once, in the house order.
 */
export function parseIndustries(value) {
  const asked = new Set(String(value ?? "").split(",").map((part) => part.trim().toLowerCase()));
  return INDUSTRY_IDS.filter((id) => asked.has(id));
}

/** Categories that have at least one live tool, in the house order. */
export function liveCategories(list = REGISTRY) {
  const used = new Set(liveApps(list).map((entry) => entry.category));
  return CATEGORIES.filter((category) => used.has(category));
}
