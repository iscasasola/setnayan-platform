#!/usr/bin/env node
/**
 * lint-bottom-nav.mjs
 *
 * Enforces the UNBREAKABLE bottom-nav template (owner-locked 2026-06-13 ·
 * project_setnayan_bottom_nav_canonical · DECISION_LOG 2026-06-13):
 *
 *   "There is ONE canonical bottom navigation component for the whole app.
 *    Every bottom-nav surface mounts it and supplies only its own tabs.
 *    No surface hand-rolls its own bar."
 *
 * Two checks, both fail the build:
 *   (A) DELEGATION — every component file whose BASENAME looks like a
 *       bottom-nav wrapper (matches /bottom-?nav/i, e.g. customer-bottom-
 *       nav.tsx) other than the canonical primitive MUST import the
 *       canonical `@/app/_components/nav/bottom-nav`. This stops a doorway
 *       re-implementing its own bar instead of delegating.
 *   (B) TEMPLATE INTEGRITY — the canonical primitive itself must still
 *       contain the locked-interaction markers (the central tuning props +
 *       the travel-stretch hook + the nav aria-label). This stops a future
 *       edit from silently gutting the pill / press-glow / travel feel that
 *       the owner dialled in.
 *
 * Usage:
 *   pnpm --filter @setnayan/web lint:botnav
 *   node apps/web/scripts/lint-bottom-nav.mjs
 *
 * Scope note (honest): the delegation check keys on filename, so a tab bar
 * hand-rolled under an unrelated name is not caught here — the primary
 * enforcement is the single-source architecture + this guard + the decision
 * log + memory. If a future doorway adds a bar, name it `*-bottom-nav.tsx`
 * and this guard makes sure it delegates.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const SCAN_ROOT = join(WEB_ROOT, 'app');
const CANONICAL_REL = 'app/_components/nav/bottom-nav.tsx';
const CANONICAL_ABS = join(WEB_ROOT, CANONICAL_REL);

// A wrapper delegates if it imports the canonical primitive by its module
// path (alias or relative both end in `nav/bottom-nav`).
const DELEGATION_RE = /from\s+['"][^'"]*nav\/bottom-nav['"]/;

// Markers that prove the canonical primitive still carries the locked
// interaction. If any of these disappears, the template was gutted.
const REQUIRED_MARKERS = [
  '--bn-dur', // central tuning custom prop (duration knob)
  '--bn-grow', // icon-grow-on-press knob
  '--bn-glow', // press-light intensity knob
  '--bn-stretch', // pill travel-stretch knob
  'nav-pill-stretch', // the travel-stretch animation hook
  'nav-press-flash', // the press-down light bloom hook
  'aria-label="Primary navigation"',
  // NAV-9 (2026-06-21) — the frosted-paper bar fill. The locked white
  // press-light reads against THIS surface; silently changing or stripping it
  // makes the press bloom invisible. 🌗 Since dark B1 (2026-10-23) the bar reads
  // it as a TOKEN (so dark has a pair) and the LIGHT value is pinned where the
  // token is declared — see LOCKED_TOKENS below.
  "background: 'var(--sn-dock-bg)'",
  "background: 'var(--sn-dock-pill)'",
  "background: 'var(--sn-dock-press)'",
];

// 🌗 The dock's three surfaces, as tokens (dark B1, 2026-10-23). LIGHT must stay
// byte-for-byte the NAV-9 values (owner: light does not move by one pixel), and
// each must have an html.dark pair — painted inline, the bar stayed light in dark
// and its near-white labels read 1.15:1 (dark_mode_rollout_2026-10-22 §3).
const GLOBALS_ABS = join(WEB_ROOT, 'app/globals.css');
const LOCKED_TOKENS = {
  '--sn-dock-bg': 'rgba(248, 246, 240, 0.92)',
  '--sn-dock-pill': 'rgba(30, 34, 41, 0.15)',
  '--sn-dock-press': 'rgba(255, 255, 255, 0.95)',
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      out.push(...walk(full));
    } else if (name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const errors = [];

// (A) Delegation.
for (const file of walk(SCAN_ROOT)) {
  if (resolve(file) === resolve(CANONICAL_ABS)) continue;
  if (!/bottom-?nav/i.test(basename(file))) continue;
  const src = readFileSync(file, 'utf8');
  if (!DELEGATION_RE.test(src)) {
    errors.push(
      `${relative(WEB_ROOT, file)} looks like a bottom-nav wrapper but does NOT import the canonical primitive.\n` +
        `    → mount <BottomNav> from '@/app/_components/nav/bottom-nav' and pass items; do not hand-roll a bar.`,
    );
  }
}

// (B) Template integrity.
let canonicalSrc = '';
try {
  canonicalSrc = readFileSync(CANONICAL_ABS, 'utf8');
} catch {
  errors.push(`Canonical bottom-nav primitive is missing at ${CANONICAL_REL}.`);
}
if (canonicalSrc) {
  for (const marker of REQUIRED_MARKERS) {
    if (!canonicalSrc.includes(marker)) {
      errors.push(
        `Canonical ${CANONICAL_REL} lost the locked-interaction marker \`${marker}\`.\n` +
          `    → the bottom-nav template is owner-locked (project_setnayan_bottom_nav_canonical); restore it or get owner sign-off.`,
      );
    }
  }
}

// (C) The dock's light values + their dark pairs, read where they are declared.
if (canonicalSrc) {
  // No surface of the bar may paint a literal colour again — that is how it
  // stayed light under html.dark (a shadow is not a surface; it may stay).
  for (const m of canonicalSrc.matchAll(/\bbackground:\s*['"`](?:#|rgba?\()[^'"`]*['"`]/g)) {
    errors.push(
      `Canonical ${CANONICAL_REL} paints a literal background (${m[0]}).\n` +
        `    → read a token with a dark pair (--sn-dock-*), or the bar stays light in dark.`,
    );
  }
}
let globalsCss = '';
try {
  globalsCss = readFileSync(GLOBALS_ABS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
} catch {
  errors.push('app/globals.css is missing — the dock tokens cannot be checked.');
}
if (globalsCss) {
  const ruleBodies = (selRe) => [...globalsCss.matchAll(new RegExp(`(?:^|\\})\\s*${selRe}\\s*\\{([^{}]*)\\}`, 'g'))].map((m) => m[1]);
  const rootBodies = ruleBodies(':root');
  const darkBodies = ruleBodies('html\\.dark');
  const valueIn = (bodies, name) => {
    let v = null;
    for (const b of bodies) for (const m of b.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))) v = m[1].trim();
    return v;
  };
  for (const [name, light] of Object.entries(LOCKED_TOKENS)) {
    const got = valueIn(rootBodies, name);
    if (got !== light) {
      errors.push(
        `app/globals.css :root ${name} is ${got === null ? 'missing' : `\`${got}\``}; NAV-9 locks it at \`${light}\`.\n` +
          `    → light must not move (the press-light reads against this surface).`,
      );
    }
    const dark = valueIn(darkBodies, name);
    if (dark === null || dark === light) {
      errors.push(
        `app/globals.css html.dark has ${dark === null ? 'no' : 'the light value for'} ${name}.\n` +
          `    → give the dock a dark pair, or the bar paints light under html.dark.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('\n❌ Bottom-nav template guard failed:\n');
  for (const e of errors) console.error('  • ' + e + '\n');
  console.error(
    'The bottom nav is an UNBREAKABLE template (owner-locked 2026-06-13). See\n' +
      '  apps/web/app/_components/nav/bottom-nav.tsx and memory project_setnayan_bottom_nav_canonical.\n',
  );
  process.exit(1);
}

console.log('✅ Bottom-nav template guard passed (delegation + template integrity).');
