/**
 * Writes a copy of dist/index.html for each toolbox route, with that route's
 * title, description, canonical URL and Open Graph tags, so a shared link to
 * /apps or /apps/quote-builder previews as that page rather than the home
 * page. The app itself is the same SPA; only the <head> differs.
 *
 * Files are written as `dist/apps.html` and `dist/apps/<slug>.html`, not
 * `.../index.html`: Cloudflare Pages serves `apps.html` at `/apps`, whereas
 * `apps/index.html` would answer at `/apps/` and redirect `/apps` there.
 *
 * Runs after `vite build` (see package.json). Only live tools are written.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const { ROUTE_META, APP_SHELL, SITE_ORIGIN } = await import(
  pathToFileURL(path.join(root, "src/content.js")).href
);
const registry = JSON.parse(fs.readFileSync(path.join(root, "src/apps/registry.json"), "utf8"));

const escape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function swap(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${label} in index.html`);
  return html.replace(pattern, replacement);
}

export function withMeta(html, { title, description, path: routePath, noindex }) {
  const url = `${SITE_ORIGIN}${routePath}`;
  const t = escape(title);
  const d = escape(description);
  let out = html;
  out = swap(out, /<title>[\s\S]*?<\/title>/, `<title>${t}</title>`, "<title>");
  out = swap(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${d}" />`,
    "meta description"
  );
  out = swap(out, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, "canonical");
  out = swap(out, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`, "og:url");
  out = swap(out, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`, "og:title");
  out = swap(
    out,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${d}" />`,
    "og:description"
  );
  out = swap(out, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}" />`, "twitter:title");
  out = swap(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${d}" />`,
    "twitter:description"
  );
  if (noindex) out = out.replace("</head>", `    <meta name="robots" content="noindex" />\n  </head>`);
  return out;
}

async function toolMeta(entry) {
  const copyPath = path.join(root, "src/apps", entry.slug, "copy.js");
  let copy = { title: entry.name, subtitle: entry.description };
  if (fs.existsSync(copyPath)) copy = (await import(pathToFileURL(copyPath).href)).default ?? copy;
  return {
    path: `/apps/${entry.slug}`,
    title: APP_SHELL.metaTitle(copy.title),
    description: copy.subtitle,
  };
}

async function main() {
  const indexPath = path.join(dist, "index.html");
  if (!fs.existsSync(indexPath)) throw new Error("prerender: run vite build first");
  const html = fs.readFileSync(indexPath, "utf8");

  const pages = [["apps.html", ROUTE_META.apps]];
  for (const key of ["privacy", "unsubscribed"]) {
    if (ROUTE_META[key]) pages.push([`${key}.html`, ROUTE_META[key]]);
  }
  for (const entry of registry.filter((item) => item.status === "live")) {
    pages.push([`apps/${entry.slug}.html`, await toolMeta(entry)]);
  }

  for (const [file, meta] of pages) {
    const target = path.join(dist, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, withMeta(html, meta));
    console.log(`prerender: ${file}  ${meta.title}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
