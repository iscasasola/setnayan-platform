/**
 * every-listing-asks-findable.test.ts — every couple-facing list of shops asks
 * the ONE findable rule, or it fails here.
 *
 * ─── THE RULING ──────────────────────────────────────────────────────────
 * DECISION_LOG 2026-11-07 "🔎 AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST
 * INQUIRY — THEN LOCKED OUT OF FIND UNTIL VERIFIED". The rule is one generated
 * column, `vendor_profiles.is_findable` (migration 20271320303985), reached in
 * the app only through `lib/findable-shop.ts` (or `LIVE_SHOP_GATE`, which is
 * built from it plus the demo half).
 *
 * ─── WHY A SOURCE SCAN ───────────────────────────────────────────────────
 * A list that keeps its old hand-typed `.eq('verification_state', 'verified')`
 * runs perfectly and returns the verified shops — so it never errors, and the
 * not-yet-decided shop the ruling says a couple must find is simply absent. An
 * absence has no throw to catch. Only the source says which question was asked.
 *
 * ─── WHAT IT ENFORCES ────────────────────────────────────────────────────
 *   1 · THE REGISTRY — each named listing (Explore, event supplier search,
 *       category pages, Discover/front door, suggestions) applies the gate, by
 *       file, and the PR body lists the same set.
 *   2 · THE TREE — any file that reads `vendor_market_stats` (the marketplace
 *       view; every reader of it is a list) and re-types the verified pair must
 *       ALSO apply the gate. A new list cannot quietly go back to verified-only.
 *   3 · THE GATE ITSELF — executed, not grepped: the values the lists share.
 *
 * Comments are stripped through the real lexer (`lib/strip-comments.ts`) so a
 * docblock that NAMES the gate can never satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { FINDABLE_SHOP_GATE, findableShopGate, isShopFindable } from './findable-shop';
import { LIVE_SHOP_GATE } from './live-shops';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Applies the one rule: a `.match()` of the findable gate (direct, embedded, or the live-shop gate built on it). */
const APPLIES_GATE = /\.match\(\s*(?:FINDABLE_SHOP_GATE|LIVE_SHOP_GATE|findableShopGate\(\s*['"][a-z_]+['"]\s*\))\s*\)/g;
/** Imports it from its one home. */
const IMPORTS_GATE =
  /from\s+['"](?:@\/lib\/findable-shop|\.\/findable-shop|@\/lib\/live-shops|\.\/live-shops)['"]/;
/** The verified pair re-typed as a listing filter. */
const RETYPED_VERIFIED = /\.eq\(\s*['"](?:vendor_profiles\.)?verification_state['"]\s*,\s*['"]verified['"]\s*\)/g;

/**
 * Every couple-facing listing, by surface. `retypedAllowed` is how many times
 * the file may still spell the verified pair itself, each with its reason.
 */
const LISTINGS: ReadonlyArray<{ surface: string; path: string; minGates?: number; retypedAllowed?: number }> = [
  // Explore — the grid, the "Show all" count and the empty-landing live shops (3 gates). The one re-typed pair is the
  // "Verified only" filter, a NARROWING the couple asks for on top of the gate.
  { surface: 'Explore grid', path: 'app/(shell)/explore/page.tsx', minGates: 3, retypedAllowed: 1 },
  { surface: 'Explore service cards', path: 'lib/marketplace-service-cards.ts' },
  // Tile counts + preview cards ask the gate (2). The two re-typed pairs are deliberately VERIFIED-only: the
  // marketing "N verified suppliers" figure (a claim about verified shops), and the tile's "Sample: A · B · C" line,
  // which prints raw business names — an undecided shop's name stays hidden until it replies (hybrid anonymity).
  { surface: 'Category tiles + previews (Explore catalog, Suppliers › Find counts)', path: 'lib/vendor-counts.ts', minGates: 2, retypedAllowed: 2 },
  { surface: 'Category pages (/suppliers/[event]/[category][/city])', path: 'lib/supplier-landing-data.ts' },
  { surface: 'Discover / front door search + shelf', path: 'app/_components/frontdoor/data.ts' },
  { surface: 'Home shelf + count', path: 'lib/home-public-reads-core.ts', minGates: 2 },
  { surface: 'Live-shop count', path: 'lib/live-shops.ts' },
  { surface: 'Suggestions engine (onboarding, wizard, event Category Search)', path: 'lib/wizard-recommendations.ts' },
  { surface: 'Event supplier search — shortlist bench', path: 'app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts' },
  { surface: 'Event supplier search — add by name', path: 'app/dashboard/[eventId]/vendors/actions.ts' },
  { surface: 'Event Suppliers — available pool count', path: 'app/dashboard/[eventId]/vendors/page.tsx' },
  { surface: 'Onboarding match pool', path: 'app/onboarding/wedding/actions.ts' },
  { surface: 'Date selection — who is free', path: 'app/dashboard/[eventId]/date-selection/page.tsx' },
  { surface: 'Day-of "Get help" suggestions', path: 'lib/same-day-vendors.ts' },
];

test('1 · every named couple-facing listing applies the one findable rule', () => {
  const failures: string[] = [];
  for (const l of LISTINGS) {
    const src = read(l.path);
    const gates = (src.match(APPLIES_GATE) ?? []).length;
    const retyped = (src.match(RETYPED_VERIFIED) ?? []).length;
    // live-shops.ts DEFINES the gate it applies, so it needs no import of itself.
    if (l.path !== 'lib/live-shops.ts' && !IMPORTS_GATE.test(src)) failures.push(`${l.surface} (${l.path}): does not import the gate`);
    if (gates < (l.minGates ?? 1)) failures.push(`${l.surface} (${l.path}): applies the gate ${gates}× (needs ${l.minGates ?? 1})`);
    if (retyped > (l.retypedAllowed ?? 0)) {
      failures.push(`${l.surface} (${l.path}): re-types the verified pair ${retyped}× (allowed ${l.retypedAllowed ?? 0})`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    'A couple-facing list stopped asking `is_findable` (lib/findable-shop.ts). It still answers — with VERIFIED shops ' +
      'only — so the not-yet-decided shop the 2026-11-07 ruling says a couple must find silently vanishes:\n  ' +
      failures.join('\n  '),
  );
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Readers of the marketplace view that are NOT a Find list, each with the reason it stays verified-only. A new
 * entry is a decision somebody has to write down — that is the point of a list rather than a blanket pass.
 */
const NOT_A_FIND_LIST: ReadonlyMap<string, string> = new Map([
  ['app/_actions/plan3d-demo-actions.ts', '3D plan booth ADS — a paid placement, verified-only by design, not search or Find'],
]);

test('2 · no reader of the marketplace view goes back to verified-only without the gate', () => {
  const offenders: string[] = [];
  let readers = 0;
  for (const dir of ['app', 'lib']) {
    for (const file of walk(join(WEB, dir))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (!/\.from\(\s*['"]vendor_market_stats['"]\s*\)/.test(src)) continue;
      readers += 1;
      if (NOT_A_FIND_LIST.has(relative(WEB, file))) continue;
      if (RETYPED_VERIFIED.test(src) && !(src.match(APPLIES_GATE) ?? []).length) {
        offenders.push(relative(WEB, file));
      }
      RETYPED_VERIFIED.lastIndex = 0;
    }
  }
  // Anti-vacuity: the scan must have found the marketplace's readers, or it checked nothing.
  assert.ok(readers >= 8, `only ${readers} readers of vendor_market_stats found — the scan is not looking at the tree`);
  assert.deepEqual(
    offenders,
    [],
    `These read the marketplace view, filter it to verified shops by hand, and never ask is_findable:\n  ${offenders.join('\n  ')}`,
  );
});

test('3 · the gate the lists share is the one column, and the live-shop gate is built on it', () => {
  assert.deepEqual(FINDABLE_SHOP_GATE, { is_findable: true });
  assert.deepEqual(findableShopGate('vendor_profiles'), { 'vendor_profiles.is_findable': true });
  assert.deepEqual(LIVE_SHOP_GATE, { is_findable: true, is_demo: false }, 'the live-shop gate drifted from the findable rule + demo');
  assert.match(read('lib/live-shops.ts'), /\.\.\.FINDABLE_SHOP_GATE/, 'LIVE_SHOP_GATE re-types the rule instead of spreading it');
  // The twin, on the four corners that matter.
  assert.equal(isShopFindable({ public_visibility: 'verified', verification_state: 'verified' }), true);
  assert.equal(isShopFindable({ public_visibility: 'hidden', verification_state: 'unverified' }), true);
  assert.equal(isShopFindable({ public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: '2026-11-07T00:00:00Z' }), false);
  assert.equal(isShopFindable({ public_visibility: 'hidden', verification_state: 'rejected' }), false);
});

test('the detector convicts the shapes it is meant to, and not prose', () => {
  // 🔑 Proven on known input before it is trusted on the tree.
  assert.equal((`q.match(FINDABLE_SHOP_GATE)`.match(APPLIES_GATE) ?? []).length, 1);
  assert.equal((`q.match(findableShopGate('vendor_profiles'))`.match(APPLIES_GATE) ?? []).length, 1);
  assert.equal((`q.match(LIVE_SHOP_GATE)`.match(APPLIES_GATE) ?? []).length, 1);
  assert.equal((stripComments(`// .match(FINDABLE_SHOP_GATE)\nq.eq('x', 1)`).match(APPLIES_GATE) ?? []).length, 0, 'a comment satisfied the gate');
  assert.equal((`.eq('verification_state', 'verified')`.match(RETYPED_VERIFIED) ?? []).length, 1);
  assert.equal((`.eq('vendor_profiles.verification_state', 'verified')`.match(RETYPED_VERIFIED) ?? []).length, 1);
  assert.equal((`r.verification_state === 'verified'`.match(RETYPED_VERIFIED) ?? []).length, 0, 'a row read was convicted as a filter');
});
