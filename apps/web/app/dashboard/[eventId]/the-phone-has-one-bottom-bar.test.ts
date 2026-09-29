/**
 * the-phone-has-one-bottom-bar.test.ts — ON PHONES, NO SUB BOTTOM NAV.
 *
 * Owner, verbatim (2026-09-29): *"on mobile mode. we do not want that sub
 * bottom nav anymore. we want it to be simple and easy to manage"* —
 * DECISION_LOG "ON PHONES, NO SUB BOTTOM NAV — ONE SIMPLE BOTTOM BAR", built
 * with Stage D (the five-row event menu).
 *
 * WHAT THIS HOLDS, and how each half would fail without a sound:
 *
 *   1 · ONE BAR IN THE DOCK. The event layout's <BottomDock> holds the bar and
 *       nothing else — a strip mounted beside it compiles, renders, and is
 *       exactly the second row the owner removed.
 *   2 · NOTHING ELSE IN THE EVENT TREE MOUNTS A BAR. No page under
 *       `app/dashboard/[eventId]` mounts a <SubNav>, a <BottomNav> or a
 *       <BottomDock> of its own — a page-level strip is the same second row by
 *       another door. And the retired section sub-nav stays deleted.
 *   3 · THE BAR DOES NOT REARRANGE ITSELF. The same five tabs, same words,
 *       same order, in plan · day-of · after — and the SAME five rows the
 *       desktop rail draws, so the phone and the laptop are one menu.
 *
 * Sabotage-checked: re-mounting a `<SubNav …/>` inside the dock, adding a
 * `<BottomNav` to a page, or letting the day-of bar swap a tab each turns this
 * red (see the PR for the runs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildCustomerMenuTree, PHONE_BAR_SHORT, type CustomerMenuKey } from '@/lib/customer-menu';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { SUITE_NAV_ON } from '@/lib/studio-hub';
import { stripComments } from '@/lib/strip-comments';
import { buildCustomerNavGroups } from './_components/customer-nav-config';

const HERE = import.meta.dirname;
const LAYOUT = join(HERE, 'layout.tsx');
const EVENT_ID = 'S89E-ONEBARTEST';

/** Every .tsx file under the event tree (tests excluded). */
function eventTreeSources(dir = HERE): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...eventTreeSources(p));
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(p);
  }
  return out;
}

test('the anchor: the files this guard reads exist, and the tree is not empty', () => {
  assert.ok(existsSync(LAYOUT), 'the event layout moved — re-point this guard');
  const n = eventTreeSources().length;
  assert.ok(n > 100, `only ${n} .tsx files under the event tree — the walk found nothing to check`);
});

test('1 · the dock holds the bar and nothing else', () => {
  const src = stripComments(readFileSync(LAYOUT, 'utf8'));
  const open = src.indexOf('<BottomDock>');
  const close = src.indexOf('</BottomDock>');
  assert.ok(open >= 0 && close > open, 'the event layout mounts no <BottomDock>');
  const inside = src.slice(open + '<BottomDock>'.length, close);
  const mounted = [...inside.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]);
  assert.deepEqual(mounted, ['CustomerBottomNav'], `the dock mounts ${mounted.join(', ')} — one bar only`);
});

test('2 · no page in the event tree mounts a second bar, and the sub-nav stays retired', () => {
  const offenders: string[] = [];
  for (const file of eventTreeSources()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(HERE, file);
    for (const tag of ['<SubNav', '<BottomNav', '<BottomDock', '<CustomerSectionSubnav']) {
      if (!src.includes(tag)) continue;
      // The layout's own dock and the one bar it holds are the allowed mounts.
      if (rel === 'layout.tsx' && tag === '<BottomDock') continue;
      if (rel === join('_components', 'customer-bottom-nav.tsx') && tag === '<BottomNav') continue;
      offenders.push(`${rel}: ${tag}`);
    }
  }
  assert.deepEqual(offenders, [], `a second bottom row is back:\n  ${offenders.join('\n  ')}`);
  assert.ok(
    !existsSync(join(HERE, '_components', 'customer-section-subnav.tsx')),
    'customer-section-subnav.tsx is back — the retired strip must be gone, not merely unmounted',
  );
});

test('3 · the same five tabs in every phase, and the same five rows on the rail', () => {
  const ctx = { websiteEnabled: true, seatingEnabled: true } as const;
  const bars = (['plan', 'dayof', 'after'] as const).map((phase) =>
    buildCustomerMenuTree(EVENT_ID, { ...ctx, phase }).map((m) => `${m.key}:${m.label}`),
  );
  assert.equal(bars[0]!.length, 5, `the bar has ${bars[0]!.length} tabs: ${bars[0]!.join(' · ')}`);
  assert.deepEqual(bars[1], bars[0], 'the day-of bar rearranged itself');
  assert.deepEqual(bars[2], bars[0], 'the after bar rearranged itself');
  // Same rows, same order — and the same word, except the owner's two short
  // bar words, which come from the one map and nowhere else.
  const rail = buildCustomerNavGroups(EVENT_ID, ctx)
    .find((g) => g.key === 'pillars')!
    .items.map((i) => `${i.key}:${PHONE_BAR_SHORT[i.key as CustomerMenuKey] ?? i.label}`);
  assert.deepEqual(bars[0], rail, 'the phone and the laptop disagree about the menu');
});

test('4 · the phone says "Maker" and "Services"; the rail and ☰ keep the full names', () => {
  /*
    Owner, 2026-09-29: "accept it. Maker and Services" — on the PHONE bottom
    bar only. Asserted on BOTH sides, because each half fails silently: a
    short word leaking onto the rail renders fine, and so does a full name
    wrapping to two lines on a 375px bar.
  */
  const ctx = { websiteEnabled: true, seatingEnabled: true } as const;
  const services = SUITE_NAV_ON;
  const bar = buildCustomerMenuTree(EVENT_ID, ctx).map((m) => m.label);
  assert.deepEqual(bar, ['Home', 'Guest list', 'Your Team', 'Maker', services ? 'Services' : 'Studio']);
  const rail = buildCustomerNavGroups(EVENT_ID, ctx)
    .find((g) => g.key === 'pillars')!
    .items.map((i) => i.label);
  assert.deepEqual(rail, ['Home', 'Guest list', 'Your Team', 'Event Hub Maker', services ? 'Our Services' : 'Studio']);
  // The registry defaults are what the bar and the rail actually overlay first.
  const slot = new Map(NAV_SLOT_DEFAULTS.map((s) => [s.key, s.label]));
  assert.equal(slot.get('customer.bottom-nav.launch'), 'Maker');
  assert.equal(slot.get('customer.sidebar.launch'), 'Event Hub Maker');
  if (services) {
    assert.equal(slot.get('customer.bottom-nav.studio'), 'Services');
    assert.equal(slot.get('customer.sidebar.studio'), 'Our Services');
  }
});

test('5 · the day-of "Planning" pill is gone from the top bar (owner: "remove it")', () => {
  const src = stripComments(readFileSync(LAYOUT, 'utf8'));
  assert.ok(!src.includes('/more`'), 'the event top bar links /more again');
  assert.ok(!/>\s*Planning\s*</.test(src), 'the event top bar says "Planning" again');
});
