/**
 * bar-set.test.ts — the bottom bar builds out and in the way the owner said,
 * and only when the set of tabs changes.
 *
 * Owner, 22 Oct 2026 (verbatim in `lib/bar-set.ts`): pressing Shop, the account
 * icons leave to the LEFT and the shop's enter from the RIGHT; pressing an
 * event, the account icons leave to the RIGHT and the event's enter from the
 * LEFT. Within one bar, today's tab-to-tab behaviour stays.
 *
 * 🔑 PROPERTIES, NOT PHRASINGS:
 *   · the direction is asked of the real function on real addresses, and the
 *     word it returns is followed into globals.css to the keyframe that draws it
 *     — so "account → shop = left" is held from the press to the pixel;
 *   · the account spokes are read off the folders on disk, so a new spoke can
 *     never be mistaken for an event (which would slide it the wrong way);
 *   · reduced motion is held by behaviour (no slide, whatever else is true) and
 *     by the stylesheet (nothing in any transition moves).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACCOUNT_SPOKES, barSetOf, barSlideDir, barSlideFor } from './bar-set';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

/** The keyframe a `html[data-sn-bar-dir='<dir>']::view-transition-<side>(<name>)` rule animates. */
function keyframe(dir: 'fwd' | 'back', side: 'old' | 'new', name: string): string | null {
  const sel = `html[data-sn-bar-dir='${dir}']::view-transition-${side}(${name})`;
  const i = css.indexOf(sel + ' {');
  if (i < 0) return null;
  const body = css.slice(i, css.indexOf('}', i));
  return /animation-name:\s*([\w-]+)/.exec(body)?.[1] ?? null;
}
/** Which way a keyframe moves the snapshot, read from its own transform. */
function travel(kf: string | null): string {
  if (!kf) return 'no keyframe';
  const i = css.indexOf(`@keyframes ${kf} {`);
  assert.ok(i >= 0, `@keyframes ${kf} is not defined`);
  const body = css.slice(i, css.indexOf('}\n}', i) + 3);
  const from = /from\s*\{[^}]*translateX\((-?\d+)%\)/.exec(body);
  const to = /to\s*\{[^}]*translateX\((-?\d+)%\)/.exec(body);
  if (to) return Number(to[1]) < 0 ? 'out to the left' : 'out to the right';
  if (from) return Number(from[1]) > 0 ? 'in from the right' : 'in from the left';
  return 'does not travel';
}

test('the account spokes are exactly the account folders on disk — nothing else under /dashboard/<x> is one', () => {
  const dirs = new Set<string>();
  for (const group of ['(account)', '(launcher)']) {
    for (const e of readdirSync(join(WEB, 'app/dashboard', group), { withFileTypes: true })) {
      if (e.isDirectory() && !/^[_@(\[]/.test(e.name)) dirs.add(e.name);
    }
  }
  // …and no static folder sits directly under app/dashboard beside the groups and [eventId].
  const loose = readdirSync(join(WEB, 'app/dashboard'), { withFileTypes: true }).filter(
    (e) => e.isDirectory() && !/^[_@(\[]/.test(e.name),
  );
  assert.deepEqual(loose.map((e) => e.name), [], 'a static /dashboard/<x> outside the account groups — classify it');
  assert.ok(dirs.size >= 8, `read ${dirs.size} spokes — the walk must actually read the folders`);
  assert.deepEqual([...ACCOUNT_SPOKES].sort(), [...dirs].sort());
});

test('which bar a page carries', () => {
  for (const p of ['/', '/dashboard', '/dashboard/library', '/dashboard/people', '/dashboard/create-event', '/dashboard/profile'])
    assert.equal(barSetOf(p), 'account', p);
  for (const p of ['/vendor-dashboard', '/vendor-dashboard/bookings', '/vendor-dashboard/website'])
    assert.equal(barSetOf(p), 'shop', p);
  for (const p of ['/dashboard/S89E-7K2M9QX4PZ', '/dashboard/0b6f1c1e-4b1a-4c3e-9d2f-2a6e9b1c0d11/guests'])
    assert.equal(barSetOf(p), 'event', p);
  for (const p of ['/admin', '/papic', '/login', '/vendor-dashboardx', '/dashboards'])
    assert.equal(barSetOf(p), null, `${p} carries none of the three bars`);
  // The lab reads its prefix as the address it stands for.
  assert.equal(barSetOf('/dev/bar-lab'), 'account');
  assert.equal(barSetOf('/dev/bar-lab/vendor-dashboard'), 'shop');
  assert.equal(barSetOf('/dev/bar-lab/dashboard/ev-lab'), 'event');
  assert.equal(barSetOf('/dev/bar-labx/dashboard/ev-lab'), null);
});

test('🧭 the owner\'s map, from the press to the pixel', () => {
  const cases: [string, string, string, string][] = [
    // from page, to page, the bar that leaves, the bar that arrives
    ['/dashboard', '/vendor-dashboard', 'out to the left', 'in from the right'], //   account → Shop
    ['/vendor-dashboard', '/dashboard', 'out to the right', 'in from the left'], //    Shop → account
    ['/dashboard', '/dashboard/S89E-7K2M9QX4PZ', 'out to the right', 'in from the left'], // account → an event
    ['/dashboard/S89E-7K2M9QX4PZ', '/dashboard', 'out to the left', 'in from the right'], // an event → account
    ['/', '/vendor-dashboard', 'out to the left', 'in from the right'], //            Discover → Shop
    ['/dashboard/people', '/dashboard/S89E-7K2M9QX4PZ/guests', 'out to the right', 'in from the left'],
  ];
  for (const [from, to, leaves, arrives] of cases) {
    const dir = barSlideDir(barSetOf(from), barSetOf(to));
    assert.ok(dir, `${from} → ${to} changes the set, so it must slide`);
    // The bar itself…
    assert.equal(travel(keyframe(dir, 'old', 'sn-bottomnav')), leaves, `${from} → ${to}: the bar that leaves`);
    assert.equal(travel(keyframe(dir, 'new', 'sn-bottomnav')), arrives, `${from} → ${to}: the bar that arrives`);
    // …and the account page with it ("everything moves").
    assert.equal(travel(keyframe(dir, 'old', 'sn-acct-page')), leaves, `${from} → ${to}: the account page`);
    assert.equal(travel(keyframe(dir, 'new', 'sn-acct-page')), arrives, `${from} → ${to}: the account page`);
  }
});

test('a press inside one bar is not a set change — the tab-to-tab slide keeps it', () => {
  for (const [a, b] of [
    ['/dashboard', '/dashboard/library'],
    ['/dashboard/library', '/'],
    ['/vendor-dashboard', '/vendor-dashboard/bookings'],
    ['/dashboard/S89E-7K2M9QX4PZ', '/dashboard/S89E-7K2M9QX4PZ/guests'],
    ['/dashboard', '/admin'],
  ])
    assert.equal(barSlideDir(barSetOf(a), barSetOf(b)), null, `${a} → ${b}`);
});

test('🐢 reduced motion, no View Transitions, or no bar on screen → no slide, a plain link', () => {
  const go = { fromPath: '/dashboard', toPath: '/vendor-dashboard', supported: true, dockShown: true, tabletUp: false };
  assert.equal(barSlideFor({ ...go, reduced: false }), 'fwd', 'the control case must slide, or the rest proves nothing');
  assert.equal(barSlideFor({ ...go, reduced: true }), null, 'reduced motion must swap instantly');
  assert.equal(barSlideFor({ ...go, reduced: false, supported: false }), null);
  assert.equal(barSlideFor({ ...go, reduced: false, dockShown: false }), null, 'desktop (no dock drawn) is untouched');
  // From 701 the event tree draws the rail strip, not a dock — nothing to slide into.
  assert.equal(barSlideFor({ ...go, toPath: '/dashboard/S89E-7K2M9QX4PZ', reduced: false, tabletUp: true }), null);
  assert.equal(barSlideFor({ ...go, reduced: false, tabletUp: true }), 'fwd', 'account → shop: both draw a dock to 1024');
});

test('🐢 the listener asks the real reduced-motion query, and the stylesheet stills every transition under it', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/nav/bar-set-slide.tsx'), 'utf8'));
  assert.match(src, /reduced:\s*matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(src, /if \(!dir\) return;\s*e\.preventDefault\(\);/, 'the press must only be taken over when a slide will run');
  const rm = /@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\) \{([^}]*)\}/.exec(css);
  assert.ok(rm, 'no reduced-motion rule over every view-transition pseudo');
  assert.match(rm![1]!, /animation:\s*none !important/);
});

test('the slide is in no first load — <BottomDock> fetches it after mount, with a plain import()', () => {
  const dock = stripComments(readFileSync(join(WEB, 'app/_components/nav/bottom-nav.tsx'), 'utf8'));
  assert.match(dock, /import\('\.\/bar-set-slide'\)\.then\(\(m\) => setSetSlide\(\(\) => m\.BarSetSlide\)\)/);
  assert.ok(!/from '\.\/bar-set-slide'/.test(dock), 'a static import puts the slide in every first load that has a bar (the Maker\'s too)');
  assert.ok(!/next\/dynamic/.test(dock), 'next/dynamic\'s loadable runtime once put the Maker over its ceiling');
  // It runs before the tab-to-tab controller (window capture precedes document capture).
  const slide = stripComments(readFileSync(join(WEB, 'app/_components/nav/bar-set-slide.tsx'), 'utf8'));
  assert.match(slide, /window\.addEventListener\('click', onClick, true\)/);
  const ctl = stripComments(readFileSync(join(WEB, 'app/_components/nav/nav-slide-controller.tsx'), 'utf8'));
  assert.match(ctl, /if \(e\.defaultPrevented \|\| e\.button !== 0\) return;/, 'the controller must stand down for a press already taken');
});
