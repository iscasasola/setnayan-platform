/**
 * SMALL TARGETS PRESS AT 44 — the controller's round of 15 Nov 2026. Each control below measured under 44 px on the
 * live site; each now presses at 44+ WITHOUT a new drawing (the shared invisible `::after` halos: `.sn-hit` vertical,
 * `.sn-hit-2d` both ways). Plus two copy fixes in the same round: "First couple" (never "First 1 couples") and the
 * admin email row's "status check" error said once, plain, inside the ⓘ.
 *
 * SABOTAGE: take `sn-hit-2d` / `sn-hit` off any control below, shrink the halo's 46, or bring back "First 1 couples"
 * or the red status-check line → RED (each assertion names its control).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { ruleBody } from './press-reach';
import { badgeWords, offerStatus, whoLine } from './offers';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = read('app/globals.css');

test('the both-ways halo reaches 46 on every side of its centre', () => {
  const after = ruleBody(css, '.sn-hit-2d::after');
  assert.ok(after, '.sn-hit-2d::after is gone');
  for (const side of ['left', 'right', 'top', 'bottom']) {
    assert.match(after!, new RegExp(`${side}: min\\(0px, calc\\(\\(100% - 46px\\) / 2\\)\\);`), `the halo's ${side} no longer reaches 46`);
  }
  assert.match(css, /:where\(\.sn-hit-2d\)\s*\{\s*position:\s*relative;/, 'a .sn-hit-2d control is not a positioning box for its halo');
});

test('each fixed control wears its halo', () => {
  const cases: [string, RegExp, string][] = [
    ['app/dashboard/[eventId]/guests/new/page.tsx', /className="sn-hit inline-block font-mono[^"]*"\s*>\s*‹ Back to guest list/, '‹ Back to guest list (18 tall)'],
    ['app/dashboard/[eventId]/galleries/page.tsx', /className=\{`sn-hit inline-flex shrink-0 items-center gap-1\.5 rounded-full px-4 py-2/, 'Open Papic / Add photos (38 tall)'],
    ['app/dashboard/[eventId]/schedule/_components/planning-todo-controls.tsx', /className=\{`sn-hit-2d inline-flex h-11 w-9 /, 'the Mark tick (36 wide)'],
    ['app/_components/unread-messages-badge.tsx', /className="fd-round sn-hit-2d relative inline-flex h-9 w-9 /, 'top bar Messages (36×36)'],
    ['app/_components/unread-bell-badge.tsx', /className="fd-round sn-hit-2d relative inline-flex h-9 w-9 /, 'top bar Notifications (36 wide)'],
    // RW-322
    ['app/admin/layout.tsx', /className="fd-urgency sn-hit relative inline-flex /, 'admin "1 queue is past SLA" pill (24 tall)'],
    ['app/admin/studio/_surfaces/website-surface.tsx', /className="sn-hit inline-block text-xs font-medium text-mulberry[^"]*"\s*>\s*View live →/, 'Admin › Studio "View live →" (16 tall)'],
    ['app/vendor-dashboard/shop/_components/shop-cover.tsx', /className="sn-hit-2d grid h-10 w-10 [^"]*"\s*data-shop-cover-gear=""/, 'the Shop settings gear (40 wide)'],
  ];
  for (const [rel, re, what] of cases) assert.match(read(rel), re, what);
  const row = read('app/dashboard/[eventId]/_components/home-control-row.tsx');
  assert.equal((row.match(/className="hc-fig"/g) ?? []).length, 0, 'a Home figure ("3 coming") is a 21-px line again');
  assert.ok((row.match(/className="hc-fig sn-hit"/g) ?? []).length >= 6, 'the Home figures lost their halo');
});

test('a first-N offer for one couple reads naturally', () => {
  const base = { who: 'first_n', firstNCap: 1, firstNTaken: 0 } as unknown as Parameters<typeof whoLine>[0];
  assert.equal(whoLine(base), 'First couple · still open');
  assert.equal(whoLine({ ...base, firstNTaken: 1 }), 'Taken');
  assert.doesNotMatch(badgeWords(base), /First 1\b/);
  assert.equal(offerStatus({ ...base, firstNTaken: 1 }, '2026-11-15').label, 'Taken');
  const three = { ...base, firstNCap: 3, firstNTaken: 1 };
  assert.equal(whoLine(three), 'First 3 couples · 2 left');
});

test('the admin email row says the send-only key once, in the ⓘ — never in red under every row', () => {
  const src = read('app/admin/settings/_components/email-delivery-section.tsx');
  assert.match(src, /r\.error && v !== 'delivered' && !isStatusCheckError\(r\.error\)/, 'the status-check error is red under each row again');
  assert.match(src, /Resend says the email key is restricted to only sending/, 'the ⓘ no longer says why delivery is unconfirmed');
  assert.match(read('app/_components/info-tip.tsx'), /sn-dot-btn inline-flex h-4 w-4/, 'the ⓘ lost its 46-px halo');
});
