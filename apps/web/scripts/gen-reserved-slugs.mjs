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

/**
 * Folders that add NO segment to the URL, so whatever sits inside them is
 * still a TOP-LEVEL word: Next.js route groups `(marketing)` and parallel-route
 * slots `@modal`. `app/(marketing)/foo/page.tsx` serves `/foo`.
 *
 * ⚠ WHY THIS MATTERS. The first cut read only the direct children of `app/` and
 * skipped these entirely, so a page inside a route group would have served a
 * real URL that nothing reserved — with this file's own test still green. That
 * is exactly the hand-typed-list blindness the generator exists to end, one
 * level deeper. (No top-level group exists today, so this changes no output
 * now; the fixture test is what proves it would.)
 *
 * `(.)photo` / `(..)photo` are INTERCEPTING routes, not groups — the anchors
 * keep them out, and they are not path-transparent.
 */
const PATH_TRANSPARENT = (name) => /^\([^().]+\)$/.test(name) || name.startsWith('@');

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

/**
 * Collect every word that is a FIRST URL SEGMENT beneath `dir`, descending
 * through path-transparent folders (route groups / parallel slots) so the words
 * they contain are counted at the level they actually serve.
 */
function collectTopLevel(dir, out, depth = 0) {
  // Guard against a pathological nest; real trees are 1–2 groups deep.
  if (depth > 6) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    const full = path.join(dir, name);
    if (!entry.isDirectory() && !safeIsDir(full)) continue;
    if (PATH_TRANSPARENT(name)) {
      collectTopLevel(full, out, depth + 1);
      continue;
    }
    if (!CLAIMABLE.test(name)) continue;
    if (!servesAUrl(full)) continue;
    out.add(name);
  }
}

function safeIsDir(full) {
  try {
    return statSync(full).isDirectory();
  } catch {
    return false;
  }
}

/** The set of top-level route words that exist on disk right now. */
export function routeSlugsFromDisk(appDir = APP_DIR) {
  if (!existsSync(appDir)) throw new Error(`app directory not found: ${appDir}`);
  const out = new Set();
  collectTopLevel(appDir, out);
  return [...out].sort();
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
