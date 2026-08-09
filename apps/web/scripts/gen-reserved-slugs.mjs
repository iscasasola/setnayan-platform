#!/usr/bin/env node
/**
 * Regenerate the ROUTE-DERIVED half of lib/reserved-slugs.ts.
 *
 * WHY THIS EXISTS. The reserved list used to be entirely hand-typed, and a
 * hand-typed list is silent about whatever nobody typed into it: fourteen real
 * top-level pages — including /creators and /open-shop, both live and in the
 * sitemap — could be claimed as a shop, wedding or person address. Deriving the
 * list from the route folders themselves means a page added tomorrow is
 * protected the moment its folder exists.
 *
 * Run:  node scripts/gen-reserved-slugs.mjs        (from apps/web)
 * Check: lib/reserved-slugs.test.ts fails if the committed block is stale.
 */
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, '..', 'app');
const TARGET = path.resolve(HERE, '..', 'lib', 'reserved-slugs.ts');

const BEGIN = '// >>> BEGIN GENERATED ROUTE SLUGS — regenerate with scripts/gen-reserved-slugs.mjs';
const END = '// <<< END GENERATED ROUTE SLUGS';

/**
 * A folder name is only a claimable top-level word if it could ever be typed as
 * a slug: lowercase letters, digits and hyphens. That drops Next.js route
 * groups `(x)`, private folders `_x`, dynamic segments `[x]`, metadata route
 * folders carrying a dot (`sitemap.xml`, `llms.txt`) and `3d_plan`'s
 * underscore — none of which a slug can collide with.
 */
const CLAIMABLE = /^[a-z0-9-]+$/;

/** True when the folder actually renders a URL somewhere beneath it. */
function servesAUrl(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.isFile() && /^(page|route)\.(tsx?|jsx?)$/.test(e.name)) return true;
  }
  for (const e of entries) {
    if (e.isDirectory() && servesAUrl(path.join(dir, e.name))) return true;
  }
  return false;
}

/** The set of top-level route words that exist on disk right now. */
export function routeSlugsFromDisk(appDir = APP_DIR) {
  if (!existsSync(appDir)) throw new Error(`app directory not found: ${appDir}`);
  const words = [];
  for (const entry of readdirSync(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (!CLAIMABLE.test(name)) continue;
    const full = path.join(appDir, name);
    if (!statSync(full).isDirectory()) continue;
    if (!servesAUrl(full)) continue;
    words.push(name);
  }
  return words.sort();
}

function renderBlock(words) {
  const lines = words.map((w) => `  '${w}',`).join('\n');
  // The BEGIN marker is already indented in the file; only the trailing marker
  // needs its own indent back.
  return `${BEGIN}\n${lines}\n  ${END}`;
}

function main() {
  const words = routeSlugsFromDisk();
  const source = readFileSync(TARGET, 'utf8');
  const start = source.indexOf(BEGIN);
  const stop = source.indexOf(END);
  if (start === -1 || stop === -1) {
    console.error(`Markers not found in ${TARGET}. Expected:\n${BEGIN}\n…\n${END}`);
    process.exit(1);
  }
  const next = source.slice(0, start) + renderBlock(words) + source.slice(stop + END.length);
  if (next === source) {
    console.log(`reserved-slugs: already up to date (${words.length} route words)`);
    return;
  }
  writeFileSync(TARGET, next);
  console.log(`reserved-slugs: wrote ${words.length} route words to lib/reserved-slugs.ts`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
