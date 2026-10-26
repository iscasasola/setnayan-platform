#!/usr/bin/env node
/**
 * lint-nav-icon-source.mjs
 *
 * Locks the nav/icon/menu-registry single-source invariant (Phase 9 of the
 * registry plan · project_setnayan_nav_icon_menu_registry · 2026-06-16):
 *
 *   "Every nav-chrome surface sources its menu LABEL + ICON from the registry,
 *    not from a private hardcoded list. The registry is the single import."
 *
 * Three checks, all fail the build:
 *
 *   (A) DELEGATION — every canonical nav-chrome chokepoint (the per-doorway
 *       sidebars + bottom navs + the public marketing top-nav) MUST consume the
 *       registry: it has to reference `navSlots` / `getNavSlotMap` / the
 *       `NAV_SLOT_*` defaults, or import the registry icon resolver
 *       (`navIconComponent` / `<DynamicIcon>`). This stops a doorway from
 *       quietly forking back to a private hardcoded label/icon table.
 *
 *   (B) PLUMBING INTEGRITY — the registry's own central files must still export
 *       the resolver + defaults + icon converter the chokepoints depend on. This
 *       stops a future edit from gutting the registry out from under them.
 *
 *   (C) THROUGH THE MAP (brand refresh step 3, 2026-10-26) — the registry's icon resolvers draw
 *       through app/_components/icon/icon-map.ts and never import an icon library themselves.
 *
 * IMPORTANT — this is a POSITIVE delegation guard, NOT a "ban lucide-react in
 * nav files" rule. The wired chokepoints INTENTIONALLY import a handful of
 * lucide glyphs as `fallbackIcon` values (used only when a registry slot is
 * absent), and ~400+ files import lucide app-wide, so a blanket lucide ban would
 * fail CI on day one. A hard no-direct-lucide rule is a deliberate Phase 2 to
 * land only after those fallback icons migrate into the registry/getLucideIcon
 * path. For now we assert consumption, not import-purity.
 *
 * Scope note (honest, mirrors lint-bottom-nav): the delegation check keys on an
 * explicit chokepoint LIST (not a glob over app/_components/nav/**, which would
 * false-positive on structural primitives that import Chevron/Search for chrome,
 * and on profile-menu / _overview-tile which own their decoration and are not
 * registry consumers). A NEW nav-chrome surface added under a different path is
 * not caught until it is added to CHOKEPOINTS below — keep this list current
 * when new doorway nav lands.
 *
 * Usage:
 *   pnpm --filter @setnayan/web lint:navicon
 *   node apps/web/scripts/lint-nav-icon-source.mjs
 */

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');

// Canonical nav-chrome chokepoints. Each MUST source its menu labels + icons
// from the registry. Bracket route segments (e.g. [eventId]) are written
// LITERALLY — they are real directory names on disk, never shell-globbed.
const CHOKEPOINTS = [
  // NOTE: the account doorway no longer has a sidebar — `(account)` surfaces
  // render the launcher's chrome-less top bar (owner 2026-07-13; PR #3224), so
  // `account-sidebar.tsx` was retired and dropped from this list. If an account
  // nav-chrome surface is ever reintroduced, add it back here.
  'app/dashboard/[eventId]/_components/customer-sidebar.tsx',
  'app/dashboard/[eventId]/_components/customer-bottom-nav.tsx',
  // NOTE: the vendor doorway's desktop menu moved into the SHARED front-door
  // rail on 2026-08-14 (One Shell slice 2), and `vendor-sidebar.tsx` was
  // deleted with the rail that hosted it — it had no importers left. The
  // registry consumer is now the destinations module that resolves the five
  // rows, which is what the rail renders. Same rule, new address.
  'app/vendor-dashboard/_components/vendor-nav-destinations.ts',
  'app/vendor-dashboard/_components/vendor-bottom-nav.tsx',
  'app/admin/_components/admin-sidebar.tsx',
  'app/admin/_components/admin-bottom-nav.tsx',
  'app/_components/marketing/site-nav.tsx',
];

// A chokepoint "consumes the registry" if it references the resolved slot map
// (navSlots / getNavSlotMap), the in-code defaults (NAV_SLOT_*), or imports the
// registry icon resolver. Permissive ON PURPOSE: the label-only consumers
// (site-nav, customer-sidebar) use `navSlots` with no icon-resolver import, so a
// guard that ONLY looked for navIconComponent would wrongly fail them.
const REGISTRY_RE =
  /\bnavSlots\b|\bgetNavSlotMap\b|\bNAV_SLOT_|from\s+['"]@\/app\/_components\/nav\/(nav-icon-component|dynamic-icon)['"]/;

// Central registry plumbing the chokepoints depend on: file → required markers.
const PLUMBING = [
  ['lib/nav-registry.ts', ['export async function getNavSlotMap', 'NAV_REGISTRY_TAG']],
  ['lib/nav-registry-defaults.ts', ['NAV_SLOT_DEFAULTS']],
  ['app/_components/nav/nav-icon-component.tsx', ['export function navIconComponent']],
  ['app/_components/nav/dynamic-icon.tsx', []],
  // BRAND REFRESH STEP 3 (owner 2026-10-26): the registry's icons are drawn by the ONE icon map, and
  // stored lucide names reach it through the translation table — so switching icon sets is an edit to
  // icon-map.ts, and a row that stores "Users" follows it with no data migration.
  ['lib/nav-icons.ts', ["from '@/app/_components/icon/legacy-icon-names'"]],
  ['app/_components/icon/icon-map.ts', ['export const GLYPHS', 'export const ICONS', 'export type IconComponent']],
  ['app/_components/icon/legacy-icon-names.ts', ['export const LEGACY_ICON_NAMES', 'export function glyphForStoredName']],
  ['app/_components/icon/icon.tsx', ['export function Icon']],
];

// (C) The registry's resolvers read icons THROUGH THE MAP (step 3) — none of them may import an icon
// library again. (The app-wide ratchet on every other importer is lint-icon-source.mjs.)
const THROUGH_THE_MAP = [
  'lib/nav-icons.ts',
  'app/_components/nav/nav-icon-component.tsx',
  'app/_components/nav/dynamic-icon.tsx',
  'lib/nav-line-icon.ts',
  'lib/taxonomy-icon-name.ts',
];
const ICON_LIB_RE = /from\s+['"](?:lucide-react|@carbon\/icons-react)(?:\/[^'"]*)?['"]/;

const errors = [];

// (A) Delegation.
for (const rel of CHOKEPOINTS) {
  let src;
  try {
    src = readFileSync(join(WEB_ROOT, rel), 'utf8');
  } catch {
    errors.push(
      `Chokepoint missing: ${rel}\n` +
        `    → if a nav surface was renamed/moved, update CHOKEPOINTS in this guard.`,
    );
    continue;
  }
  if (!REGISTRY_RE.test(src)) {
    errors.push(
      `${rel} is a nav-chrome chokepoint but does NOT source its labels/icons from the nav/icon/menu registry.\n` +
        `    → resolve getNavSlotMap() in the server ancestor, pass navSlots down, overlay slot.label and\n` +
        `      resolve icons via navIconComponent('@/app/_components/nav/nav-icon-component'); do not hardcode a private label/icon table.`,
    );
  }
}

// (B) Plumbing integrity.
for (const [rel, markers] of PLUMBING) {
  let src;
  try {
    src = readFileSync(join(WEB_ROOT, rel), 'utf8');
  } catch {
    errors.push(`Registry plumbing file is missing at ${rel}.`);
    continue;
  }
  for (const marker of markers) {
    if (!src.includes(marker)) {
      errors.push(
        `Registry plumbing ${rel} lost the required marker \`${marker}\`.\n` +
          `    → the nav chokepoints depend on it; restore it or get owner sign-off.`,
      );
    }
  }
}

// (C) Through the map.
for (const rel of THROUGH_THE_MAP) {
  let src;
  try {
    src = readFileSync(join(WEB_ROOT, rel), 'utf8');
  } catch {
    errors.push(`Registry icon resolver is missing at ${rel}.`);
    continue;
  }
  if (ICON_LIB_RE.test(src)) {
    errors.push(
      `${rel} imports an icon library directly. The registry draws through app/_components/icon/icon-map.ts\n` +
        `    → use GLYPHS / glyphForStoredName (legacy-icon-names.ts) so an icon-set switch stays one file.`,
    );
  }
}

if (errors.length > 0) {
  console.error('\n❌ Nav-icon-source guard failed:\n');
  for (const e of errors) console.error('  • ' + e + '\n');
  console.error(
    'Nav labels + icons are owner-managed via the registry (/admin/menus). See\n' +
      '  apps/web/lib/nav-registry.ts + lib/nav-registry-defaults.ts and memory\n' +
      '  project_setnayan_nav_icon_menu_registry.\n',
  );
  process.exit(1);
}

console.log('✅ Nav-icon-source guard passed (chokepoint delegation + registry plumbing integrity).');
