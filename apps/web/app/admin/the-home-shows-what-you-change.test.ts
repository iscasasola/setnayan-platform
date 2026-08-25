/**
 * The Overview must carry the six jobs the owner actually does — and none of
 * their tiles may point nowhere.
 *
 * 🔑 THE DEFECT THIS PINS: "Pricing" — 52% of every admin action in the audit
 * record — appeared ZERO times on the page he lands on, while twelve queue tiles
 * reading zero did. A guard that only checked "the component is imported" would
 * have passed on a component rendering an empty list, so these assert the KEYS
 * and the MOUNT separately.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app/admin');
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
/** Comments name the very things these rules ban, so strip them first. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const tile = code(read('_components/what-you-change.tsx'));
const nav = code(read('_components/admin-nav-groups.tsx'));
const home = code(read('page.tsx'));

/** Every `key: '…'` that sits on a nav ITEM (8-space indent), not a group. */
function navItemKeys(src: string): Set<string> {
  return new Set(
    [...src.matchAll(/^ {8}key: '([a-z0-9-]+)',$/gm)].map((m) => m[1]),
  );
}

test('every tile resolves to a nav item that exists', () => {
  const keys = [...tile.matchAll(/\{ key: '([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.equal(keys.length, 6, `expected six jobs, found ${keys.length}`);
  const known = navItemKeys(nav);
  const dead = keys.filter((k) => !known.has(k));
  assert.deepEqual(
    dead,
    [],
    `these tiles point at nav keys that no longer exist: ${dead.join(', ')}. ` +
      'A tile whose key is gone throws at render — fix the key, do not delete the check.',
  );
});

test('the job the owner does most is on the page he lands on', () => {
  // The whole reason this component exists. If the mount goes, so does the point.
  assert.match(home, /<WhatYouChange \/>/);
  assert.match(tile, /key: 'pricing'/);
});

test('the tiles never re-type a destination', () => {
  // Two copies of an href always drift. Everything routes through hrefFor().
  assert.ok(
    !/href="\/admin\//.test(tile) && !/href: '\/admin\//.test(tile),
    'a tile hardcodes an /admin path — derive it from ADMIN_NAV_GROUPS by key instead',
  );
  assert.match(tile, /href=\{hrefFor\(key\)\}/);
});

test('gold stays a rule and an icon, never text', () => {
  // In this repo the slot named `terracotta` IS the atelier gold (3.37:1 on the
  // page ground) — legal on an icon and a hairline, never on something read.
  const goldOnText = /className="[^"]*text-terracotta[^"]*"[^>]*>\s*\{(?:label|note)\}/.test(tile);
  assert.equal(goldOnText, false, 'gold is below the AA floor for text — use it on the icon/rule only');
  assert.match(tile, /text-terracotta[^"]*"\s*\/>/); // the icon carries it
});
