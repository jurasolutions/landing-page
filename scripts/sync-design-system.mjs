/**
 * Copies the Jura Solutions design system into the repo.
 *
 * The design system is authoritative and lives outside this repo at
 * `jurasolutions/design-system/`. This repo has to build standalone on
 * Cloudflare Pages, so a verbatim copy is vendored into `src/design-system/`.
 *
 * The copy is read-only: never hand-edit it. Change the design system at
 * source, then run `npm run sync:ds` to bring the change across.
 */
import { cp, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const source = process.env.JURA_DS_PATH
  ? resolve(process.env.JURA_DS_PATH)
  : resolve(repoRoot, "../../design-system");
const target = resolve(repoRoot, "src/design-system");

// Only what the app needs at build time. The preview cards, the generated
// bundle and the docs stay at source.
const INCLUDE = ["styles.css", "tokens", "assets", "components"];
const SKIP = /\.(card\.html|prompt\.md)$/;

try {
  await stat(source);
} catch {
  console.error(`Design system not found at ${source}`);
  console.error("Set JURA_DS_PATH to point at jurasolutions/design-system.");
  process.exit(1);
}

await rm(target, { recursive: true, force: true });

for (const entry of INCLUDE) {
  await cp(resolve(source, entry), resolve(target, entry), {
    recursive: true,
    filter: (src) => !SKIP.test(src),
  });
}

console.log(`Design system synced from ${source} to src/design-system`);
