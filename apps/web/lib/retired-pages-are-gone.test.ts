/**
 * 🗑 Final check · lane R · R1–R9 (25 Nov; LAUNCH-GATE L6). Each retired page is either GONE (no `page.tsx` at its
 * address) or a PERMANENT forward to its new home, and no menu, nav source or route builder still links to a deleted
 * one. R2 (the Setnayan AI buy page) forwards to the event's plans page; R8 (API keys, the API reference) forwards to
 * the dashboard; R5 (the 3D seating lab address) forwards to Guests › Seats › 3D, whose room component it used to hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const has = (rel: string) => existsSync(join(WEB, rel));
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const GONE: ReadonlyArray<[string, string]> = [
  ['R1', 'app/dashboard/(account)/profile/concierge/page.tsx'],
  ['R3', 'app/dashboard/(account)/clusters/page.tsx'],
  ['R3', 'app/dashboard/(account)/clusters/[clusterId]/page.tsx'],
  ['R4', 'app/dashboard/[eventId]/guests/quick/page.tsx'],
  ['R6', 'app/dashboard/[eventId]/studio/papic/challenges/page.tsx'],
  ['R6', 'app/dashboard/[eventId]/studio/papic/run-of-show/page.tsx'],
  ['R7', 'app/admin/concierge-abuse/page.tsx'],
  ['R9', 'app/papic/lightcheck/page.tsx'],
];

const FORWARDS: ReadonlyArray<[string, string, RegExp]> = [
  ['R2', 'app/dashboard/[eventId]/studio/setnayan-ai/page.tsx', /permanentRedirect\(routes\.dashboard\.eventServices\(eventId, 'ai'\)\)/],
  ['R5', 'app/dashboard/[eventId]/seating/lab/page.tsx', /permanentRedirect\(guestsViewHref\(eventId, 'seats', \{ seat: '3d' \}\)\)/],
  ['R8', 'app/dashboard/(account)/api-keys/page.tsx', /permanentRedirect\(routes\.dashboard\.index\(\)\)/],
  ['R8', 'app/api/v1/page.tsx', /permanentRedirect\(routes\.dashboard\.index\(\)\)/],
];

test('R1 · R3 · R4 · R6 · R7 · R9 — the page is gone', () => {
  for (const [r, page] of GONE) assert.equal(has(page), false, `${r}: ${page} is back`);
});

test('R2 · R5 · R8 — the old address forwards PERMANENTLY to its new home, and draws nothing else', () => {
  for (const [r, page, to] of FORWARDS) {
    assert.ok(has(page), `${r}: ${page} is gone — an old link would 404`);
    const s = src(page);
    assert.match(s, to, `${r}: ${page} does not forward to its new home`);
    assert.doesNotMatch(s, /<[A-Z]|return \(/, `${r}: ${page} draws a page again`);
  }
});

test('R5 — the 3D room the Seats page mounts moved out of the route, intact', () => {
  assert.ok(has('app/dashboard/[eventId]/seating/lab/_components/seating-room.tsx'));
  assert.match(src('app/dashboard/[eventId]/seating/page.tsx'), /import SeatingLabPage from '\.\/lab\/_components\/seating-room';/);
});

test('no door left: menus, nav sources and route builders name no retired address', () => {
  const RETIRED = /\/dashboard\/profile\/concierge|\/studio\/setnayan-ai\b|\/dashboard\/clusters|\/guests\/quick\b|\/seating\/lab\b|\/studio\/papic\/challenges|\/studio\/papic\/run-of-show|\/admin\/concierge-abuse|\/dashboard\/api-keys|\/papic\/lightcheck/;
  for (const f of [
    'lib/routes.ts',
    'lib/customer-menu.ts',
    'lib/nav-registry-defaults.ts',
    'lib/admin/admin-pages.ts',
    'lib/admin/admin-tabs.ts',
    'lib/admin/work-rows.ts',
    'lib/admin-tabs.ts',
    'app/admin/_components/admin-nav-groups.tsx',
    'app/dashboard/(account)/profile/page.tsx',
    'app/dashboard/[eventId]/_components/home-cards/home-planner-card.tsx',
    'app/dashboard/[eventId]/_components/home-first-screen.tsx',
    'app/dashboard/[eventId]/vendors/page.tsx',
    'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx',
    'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx',
    'app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx',
    'app/admin/users/[userId]/page.tsx',
    'app/sitemap-static.xml/route.ts',
  ]) {
    if (!has(f)) continue;
    const m = src(f).match(RETIRED);
    assert.equal(m, null, `${f} still links to a retired address: ${m?.[0]}`);
  }
});
