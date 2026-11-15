/**
 * 🏅 ADMIN › MONEY › BADGES & SEALS (slice 1) — one guard per claim the page makes.
 * Contract: Setnayan-specs prototypes/admin_badge_ledger_2026-11-15 (5bac5f14) · DECISION_LOG dd7d05f1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { adminPlaceFor } from '@/lib/admin/admin-tabs';
import { NOT_YET_BUILT } from './not-yet-built';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));
const PAGE = code('app/admin/badges/page.tsx');

test('the page is one Money view, and the Spotlight Awards addresses fold into it', () => {
  for (const [path, q] of [
    ['/admin/badges', ''],
    ['/admin/spotlight-awards', ''],
    ['/admin/studio', 'tab=spotlight-awards'],
  ] as const) {
    const place = adminPlaceFor(path, new URLSearchParams(q));
    assert.equal(place?.kind, 'tab', path);
    assert.equal(place?.kind === 'tab' ? `${place.tab.key}/${place.view.key}` : null, 'money/badges', `${path}?${q}`);
  }
  assert.match(code('app/admin/spotlight-awards/page.tsx'), /redirect\(qs \? `\/admin\/badges\?\$\{qs\}` : '\/admin\/badges'\)/);
  assert.match(PAGE, /<SpotlightAwardsSurface /, 'the monthly awards are mounted on this page');
});

test('a piece whose engine has not landed says "not yet built" — never a sample shop from the drawing', () => {
  const drawingShops = ['Liwanag', 'Casa Mesa', 'Bulaklak', 'Himig', 'Tala Lights', 'Lakbay', 'Hiraya', 'Kain Tayo'];
  const files = [PAGE, code('app/admin/badges/not-yet-built.ts')];
  for (const name of drawingShops) {
    for (const f of files) assert.ok(!f.includes(name), `the drawing's example shop "${name}" must never render`);
  }
  for (const r of [...NOT_YET_BUILT.seals, ...NOT_YET_BUILT.shops]) assert.match(r.line, /^Not yet built — /, r.key);
  assert.match(NOT_YET_BUILT.lock.line, /^Not yet built — /);
  assert.match(PAGE, /NOT_YET_BUILT\.seals\.map/);
  assert.match(PAGE, /NOT_YET_BUILT\.shops\.map/);
});

test('an engine that lands takes its "not yet built" row with it', () => {
  // J0's ladder exports its reward queue from lib/award-queue.ts (#7753); J2/J3 are not on main yet.
  if (existsSync(join(WEB, 'lib/award-queue.ts'))) {
    assert.ok(!/J0 #7753/.test(NOT_YET_BUILT.queue.line), 'J0 is on main: the queue row must read the real queue now');
  }
});

test('a refused read is "—", never 0 or "none"', () => {
  assert.match(PAGE, /paidThisYear === null\s*\?\s*\{ label: 'Paid this year · couldn’t read', value: '—'/);
  assert.match(PAGE, /readError=\{rewardsError\}/);
  assert.match(PAGE, /readError=\{upgradesError\}/);
  assert.doesNotMatch(PAGE, /\?\? \[\]/, 'a refused ledger must not be flattened to an empty list');
});

test('slice 1 writes nothing: no server action, no typed price, no Cancel on a tier reward', () => {
  const dir = join(WEB, 'app/admin/badges');
  for (const f of readdirSync(dir).filter((n) => /\.(ts|tsx)$/.test(n) && !n.includes('.test.'))) {
    const src = code(`app/admin/badges/${f}`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${f} adds a server action`);
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a price — read it from the catalogue`);
    assert.doesNotMatch(src, />\s*Cancel\s*</, `${f}: a tier reward has no Cancel, only Hold`);
  }
});
