/**
 * The Functions' view of the toolbox registry. They use the same registry module
 * the site renders from, so a slug is valid on the server exactly when it is in
 * `src/apps/registry.json`.
 */
import { findApp } from "../src/apps/registry.js";

/** The site's own lookup: one registry entry, or null. */
export const findEntry = findApp;
