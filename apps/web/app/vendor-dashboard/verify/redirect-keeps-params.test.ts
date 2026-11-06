/**
 * redirect-keeps-params.test.ts — /vendor-dashboard/verify is RETIRED as a
 * standalone destination (2026-09-11): its 701-line "12-document … unlock Pro
 * Vendor" checklist is superseded by the current papers flow on My Shop
 * (#5395). This route now exists only to redirect to
 * the papers (since 2026-10-14: /vendor-dashboard/profile#docs, Your details ›
 * Your documents; before that /vendor-dashboard/shop#get-verified), copying the pattern already proven by
 * /vendor-dashboard/services (RULE 0 — extend, don't reinvent).
 *
 * Guarded here: the redirect target is the papers anchor, not a bare
 * `/vendor-dashboard/shop`; the old notification/deep-link query params
 * (error / slot_saved / submitted / withdrawn) survive the hop so an
 * in-flight bookmark or a stale email link still lands on the right state
 * instead of silently losing its context; and the route contains no leftover
 * page body (a half-ported redirect that still renders the old form would be
 * worse than either extreme).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
}

test('the route redirects to the papers — Your details › Your documents (step 5, 2026-10-14)', () => {
  const src = stripComments(readFileSync(path.join(HERE, 'page.tsx'), 'utf8'));
  assert.match(
    src,
    /redirect\(`\/vendor-dashboard\/profile\$\{query \? `\?\$\{query\}` : ''\}#docs`\)/,
    'The verify route no longer redirects to /vendor-dashboard/profile#docs with its query preserved.',
  );
});

test('every deep-link query param the old page recognised is forwarded', () => {
  const src = stripComments(readFileSync(path.join(HERE, 'page.tsx'), 'utf8'));
  for (const param of ['error', 'slot_saved', 'submitted', 'withdrawn']) {
    assert.ok(
      src.includes(param),
      `The redirect dropped the "${param}" deep-link param the old verify page recognised.`,
    );
  }
});

test('the route no longer renders the retired 12-document form', () => {
  const src = stripComments(readFileSync(path.join(HERE, 'page.tsx'), 'utf8'));
  assert.ok(
    !src.includes('DocSlotCard') && !src.includes('ApplicationProgress') && !src.includes('<main'),
    'The verify route still renders the old checklist body — it should be a pure redirect.',
  );
});

test('the Event Hub "Get verified" link points straight at the papers (Your details › Your documents since step 5)', () => {
  const src = stripComments(
    readFileSync(
      path.join(HERE, '..', 'on-the-day', 'page.tsx'),
      'utf8',
    ),
  );
  assert.match(
    src,
    /href="\/vendor-dashboard\/profile#docs"/,
    'on-the-day/page.tsx "Get verified" link still points at the retired /vendor-dashboard/verify route.',
  );
});

test('the sidebar nav entry points straight at the papers anchor', () => {
  const src = stripComments(
    readFileSync(
      path.join(HERE, '..', '..', '..', 'lib', 'nav-registry-defaults.ts'),
      'utf8',
    ),
  );
  assert.match(
    src,
    /key: "vendor\.sidebar\.verify",[\s\S]{0,400}route: "\/vendor-dashboard\/profile#docs"/,
    'nav-registry-defaults.ts "vendor.sidebar.verify" entry still routes to the retired /vendor-dashboard/verify page.',
  );
});
