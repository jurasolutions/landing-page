/**
 * Finds each tool's code and copy by folder, so adding a tool is one folder
 * and one registry entry with nothing to wire up here.
 *
 *   src/apps/<slug>/index.jsx   default export: the tool component (lazy)
 *   src/apps/<slug>/copy.js     default export: the tool's words (eager, tiny)
 *
 * The copy is loaded eagerly so the page title, promise, privacy note and
 * talk-to-us card render before the tool's own chunk arrives.
 */
import React from "react";

const components = import.meta.glob("./*/index.jsx");
const copies = import.meta.glob("./*/copy.js", { eager: true });

const lazies = new Map();

export function hasTool(slug) {
  return Boolean(components[`./${slug}/index.jsx`]);
}

export function copyFor(slug) {
  return copies[`./${slug}/copy.js`]?.default ?? null;
}

export function lazyTool(slug) {
  const load = components[`./${slug}/index.jsx`];
  if (!load) return null;
  if (!lazies.has(slug)) lazies.set(slug, React.lazy(load));
  return lazies.get(slug);
}
