/**
 * Writes the test PDFs next to this script, for trying the tool by hand on
 * the dev server (PRD §5.4). The unit tests build the same files themselves.
 *
 *   node src/apps/pdf-merge-and-split/__fixtures__/make-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fixtures from "./fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const files = {
  "portrait-a4.pdf": await fixtures.portraitA4(),
  "landscape-a4.pdf": await fixtures.landscapeA4(),
  "us-letter.pdf": await fixtures.usLetter(),
  "ten-pages.pdf": await fixtures.tenPages(),
  "password-protected.pdf": fixtures.passwordProtected(),
  "damaged.pdf": await fixtures.damaged(),
  "not-a-pdf.pdf": fixtures.notAPdf(),
};

for (const [name, bytes] of Object.entries(files)) {
  fs.writeFileSync(path.join(here, name), bytes);
  console.log(`${name}  ${bytes.length} bytes`);
}
