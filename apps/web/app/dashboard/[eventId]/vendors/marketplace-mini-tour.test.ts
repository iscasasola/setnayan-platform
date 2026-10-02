/**
 * The Marketplace mini-tour (customer_vendors_v1) — RETIRED 2026-10-02.
 *
 * `customer_vendors_v1` sat in lib/tours.ts defined-but-unmounted from
 * 2026-05-31 (879c1c138 removed the mount when the accordion replaced the
 * card/stage page its copy described) until 2026-08-24 — a granted capability
 * nothing rendered. This pins the remount so it cannot silently regress to
 * that state again.
 *
 * Comments are stripped before matching: the mount site carries a comment that
 * names the tour key, so a raw-source count would stay green with the JSX gone.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) =>
  readFileSync(path.join(__dirname, rel), 'utf8')
    // block comments (incl. JSX {/* … */}) then line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

test('the Suppliers tour is RETIRED — not mounted, not defined (first-timer fix 23)', () => {
  // ⚖ 2026-10-02 (corpus FIRST_TIMER_TEST_2026-10-02.md, fix 23): the three
  // slides narrated the desktop page ("marketplace", "Build your team", "Save
  // plans, compare") on a phone that shows none of it. Retired until the
  // spotlight tour. This flips the 2026-08-24 remount pin on purpose: a tour
  // that describes a different screen than the one in front of you is worse
  // than no tour.
  const page = read('page.tsx');
  assert.equal((page.match(/tourKey="customer_vendors_v1"/g) ?? []).length, 0, 'the retired Suppliers tour is mounted again');
  const tours = read('../../../../lib/tours.ts');
  assert.ok(!tours.includes("customer_vendors_v1: {"), 'the retired Suppliers tour is defined again in lib/tours.ts');
  assert.ok(!/'customer_vendors_v1'/.test(tours), 'customer_vendors_v1 is still a TourKey');
});

test('the vendor dashboard mounts its welcome tour, gated on the batched profile read', () => {
  const layout = read('../../../vendor-dashboard/layout.tsx');
  const mounts = layout.match(/<GuidedTour tourKey="vendor_welcome_v1"/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `expected exactly one vendor_welcome_v1 mount in the vendor layout, found ${mounts.length}`,
  );
  // The gate reads tour_seen_keys from the layout's ONE batched users select —
  // dropping the column there makes the gate read undefined and the tour fire
  // on every page load forever, which is worse than no tour.
  assert.ok(
    /select\('[^']*tour_seen_keys[^']*'\)/.test(layout),
    "the vendor layout's users select no longer fetches tour_seen_keys — the welcome-tour gate is reading undefined",
  );
});

