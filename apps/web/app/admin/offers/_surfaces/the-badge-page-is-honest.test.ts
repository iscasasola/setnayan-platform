/**
 * 🏅 ADMIN › MONEY › OFFERS & GIFTS › BADGES & SEALS (slice 1) — one guard per claim the page makes.
 * Contract: Setnayan-specs prototypes/admin_badge_ledger_2026-11-15 (5bac5f14) · DECISION_LOG dd7d05f1.
 * Carried from #7827 (`app/admin/badges/the-badge-page-is-honest.test.ts`) into the admin reorg, 17 Nov 2026 — its
 * claims kept; the "tiers not yet built" row became the real read through #7807's adapter, so that claim flipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { adminMergedForward, adminShellPlaceFor } from '@/lib/admin/admin-pages';
import { NOT_YET_BUILT } from './not-yet-built';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const VIEW = code('app/admin/offers/_surfaces/badges-view.tsx');

test('the page is one Money view, and the Spotlight Awards addresses fold into it', () => {
  for (const [path, q] of [
    ['/admin/offers', 'view=badges'],
    ['/admin/badges', ''],
    ['/admin/spotlight-awards', ''],
    ['/admin/studio', 'tab=spotlight-awards'],
  ] as const) {
    const place = adminShellPlaceFor(path, new URLSearchParams(q));
    assert.equal(place?.kind === 'tab' ? `${place.tab.key}/${place.page.key}/${place.view.href}` : null, 'money/offers//admin/offers?view=badges', `${path}?${q}`);
  }
  assert.equal(adminMergedForward('/admin/spotlight-awards', '?ok=1'), '/admin/offers?view=badges&ok=1', 'a Spotlight save still lands with its answer');
  assert.match(code('app/admin/studio/page.tsx'), /key === 'spotlight-awards' \? 'badges' : key/);
  assert.match(VIEW, /<SpotlightAwardsSurface /, 'the monthly awards are mounted on this page');
});

test('a piece whose engine has not landed says "not yet built" — never a sample shop from the drawing', () => {
  const drawingShops = ['Liwanag', 'Casa Mesa', 'Bulaklak', 'Himig', 'Tala Lights', 'Lakbay', 'Hiraya', 'Kain Tayo'];
  for (const f of [VIEW, code('app/admin/offers/_surfaces/not-yet-built.ts')]) {
    for (const name of drawingShops) assert.ok(!f.includes(name), `the drawing's example shop "${name}" must never render`);
  }
  for (const r of [...NOT_YET_BUILT.seals, ...NOT_YET_BUILT.shops]) assert.match(r.line, /^Not yet built — /, r.key);
  assert.match(NOT_YET_BUILT.lock.line, /^Not yet built — /);
  assert.match(VIEW, /NOT_YET_BUILT\.seals\.map/);
  assert.match(VIEW, /NOT_YET_BUILT\.shops\.map/);
});

test('an engine that lands takes its "not yet built" row with it — the tiers read the #7807 adapter now', () => {
  assert.ok(!NOT_YET_BUILT.shops.some((r) => r.key === 'tiers'), 'the badge tiers are on main: their row must be the real read');
  assert.ok(!/J0 #7753/.test(NOT_YET_BUILT.queue.line), 'J0 is on main: the queue row must not say it waits on it');
  assert.match(VIEW, /from '@\/app\/vendor-dashboard\/shop\/_components\/badges\/badge-page-model'/, 'tiers come through the one adapter');
  assert.match(VIEW, /readBadgeRewardFacts\(/, 'from the counts the badge engine itself reads');
});

test('a refused read is "—", never 0 or "none"', () => {
  assert.match(VIEW, /paidThisYear === null\s*\?\s*\{ label: 'Paid this year · couldn’t read', value: '—'/);
  assert.match(VIEW, /readError=\{rewardsError\}/);
  assert.match(VIEW, /readError=\{upgradesError\}/);
  assert.match(VIEW, /c\.state === 'unread' \? <span>—<\/span>/);
});

test('slice 1 writes nothing: no server action, no typed price, no Cancel, no hold or lock button', () => {
  for (const f of ['badges-view.tsx', 'not-yet-built.ts']) {
    const src = code(`app/admin/offers/_surfaces/${f}`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${f} adds a server action`);
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a price — read it from the catalogue`);
    assert.doesNotMatch(src, />\s*Cancel\s*</, `${f}: a tier reward has no Cancel, only Hold`);
    assert.doesNotMatch(src, /method="post"|formAction=|action=\{/, `${f}: holds and the lock wait on an owner decision`);
  }
});
