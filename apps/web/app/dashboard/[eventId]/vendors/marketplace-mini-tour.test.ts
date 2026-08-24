/**
 * The Marketplace mini-tour is MOUNTED, not merely defined.
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

test('the vendors page mounts the Marketplace mini-tour exactly once, in the takeover branch', () => {
  const page = read('page.tsx');
  const mounts = page.match(/<MiniTour tourKey="customer_vendors_v1"/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `expected exactly one <MiniTour tourKey="customer_vendors_v1"> mount, found ${mounts.length} — ` +
      'if it moved, keep it inside the isBudgetBuildEnabled() branch: the copy describes the takeover.',
  );
  // It must sit in the takeover's return, after <ServicesTakeover …/>: the
  // rewritten copy narrates bench → build → compare, which the kill-switch
  // accordion does not render.
  const takeoverAt = page.indexOf('<ServicesTakeover');
  const mountAt = page.indexOf('<MiniTour tourKey="customer_vendors_v1"');
  assert.ok(takeoverAt > -1, 'ServicesTakeover render not found — the takeover branch moved; re-anchor this test');
  assert.ok(
    mountAt > takeoverAt,
    'the mini-tour mount sits before/outside the ServicesTakeover render — it must ride the takeover branch',
  );
});

test('the tour definition describes the takeover, not the retired card/stage page', () => {
  const tours = read('../../../../lib/tours.ts');
  assert.ok(
    tours.includes("customer_vendors_v1: {"),
    'customer_vendors_v1 definition missing from lib/tours.ts',
  );
  // The single strongest stale-copy marker from the pre-2026-05-31 surface.
  assert.ok(
    !tours.includes('total/deposit fields'),
    'lib/tours.ts still carries the retired card/stage copy ("total/deposit fields") — the 2026-08-24 rewrite regressed',
  );
});
