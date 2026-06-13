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
];

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
