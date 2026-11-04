/**
 * supplier-page-words.test.ts — what the /for-suppliers port (4 Nov 2026 prototype) says is read, not typed,
 * and every door and photo it draws is really there.
 *
 *   (1) NO DEMO-SHOP LINK TO A PAGE THAT IS NOT THERE. The prototype links "See the demo shop" to
 *       `/sample/supplier`, which is not built — a link there today is a 404 that looks like a door. The switch is
 *       `DEMO_SHOP.open` and it is OFF: owner, 2026-11-04, *"do not add buttons now"*. Turning it on is his call,
 *       so this test never asks for it — it only refuses it being on with no page behind it.
 *   (2) THE ALLOWANCES FOLLOW TIER_CAPS. The plan lines and the problem answers put reach, team seats, waitlists
 *       and the own web address into words. Every number in those words must be one TIER_CAPS holds, and no
 *       JavaScript value ("Infinity", "NaN", "undefined") may reach a person.
 *   (3) THE PHOTOS ARE ON DISK, with the owner's hero shifts.
 *
 * SABOTAGE (run 2026-11-04): set `DEMO_SHOP.open = true` → (1) RED · type "100 km" into planLine → (2) RED ·
 * delete public/marketing/2026-11-04/supplier-team-hero.webp → (3) RED · change florist's --dr to 5% → (3) RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import {
  DEMO_SHOP,
  HERO_SLIDES,
  MARKETING_PHOTOS,
  OPEN_SHOP_HREF,
  planLine,
  reachLine,
  seatsLine,
} from './supplier-page-words';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const has = (rel: string) => existsSync(join(WEB, rel));

test('(1) a demo-shop link is never drawn to a page that does not exist', () => {
  assert.equal(DEMO_SHOP.href, '/sample/supplier');
  if (DEMO_SHOP.open) {
    assert.ok(
      has('app/sample/supplier/page.tsx'),
      'DEMO_SHOP.open is on but app/sample/supplier has no page: every "See the demo shop" would be a 404',
    );
  }
  assert.ok(has(`app${OPEN_SHOP_HREF}/page.tsx`), `${OPEN_SHOP_HREF} — the "Open a shop" door — has no page`);
  assert.ok(has('app/vendor-dashboard/profile/page.tsx'), '"Get Verified — free" (the papers, /vendor-dashboard/profile#docs) points at a page that is gone');
});

test('(2) every allowance the page says is a number TIER_CAPS holds — none is typed', () => {
  const lines = [
    planLine('solo', 'verified'),
    planLine('pro', 'solo'),
    planLine('enterprise', 'pro'),
    seatsLine(),
    reachLine(),
  ];
  const known = new Set<string>();
  for (const t of ['verified', 'solo', 'pro', 'enterprise'] as const) {
    const c = TIER_CAPS[t];
    for (const n of [c.serviceRadiusKm, c.agentAccounts, c.waitlistAcceptances]) if (Number.isFinite(n)) known.add(String(n));
  }
  for (const line of lines) {
    assert.doesNotMatch(line, /Infinity|NaN|undefined|null/, `a JavaScript value reached a person: "${line}"`);
    for (const m of line.matchAll(/\d+/g)) {
      assert.ok(known.has(m[0]), `"${m[0]}" in "${line}" is not a number TIER_CAPS holds — it was typed`);
    }
  }
  // The reach line names every rung, in order, from the table.
  for (const t of ['verified', 'solo', 'pro', 'enterprise'] as const) {
    const km = TIER_CAPS[t].serviceRadiusKm;
    assert.ok(reachLine().includes(Number.isFinite(km) ? `${km} km` : 'the whole country'), `reach for ${t} is missing`);
  }
  // Each plan's line says THAT plan's reach — a number the table holds for some other plan is still a typed one.
  for (const [t, below] of [['solo', 'verified'], ['pro', 'solo'], ['enterprise', 'pro']] as const) {
    const km = TIER_CAPS[t].serviceRadiusKm;
    const line = planLine(t, below);
    if (km !== TIER_CAPS[below].serviceRadiusKm) {
      assert.ok(
        line.toLowerCase().includes(Number.isFinite(km) ? `${km} km reach` : 'nationwide reach'),
        `${t}'s line "${line}" does not say its own reach (${km})`,
      );
    }
    for (const m of line.matchAll(/(\d+) km/g)) assert.equal(Number(m[1]), km, `${t}'s line names another plan's reach: "${line}"`);
  }
  // A seat count the table says moved is said; one that did not move is not.
  const moved = TIER_CAPS.pro.agentAccounts !== TIER_CAPS.solo.agentAccounts;
  assert.equal(/team seat/.test(planLine('pro', 'solo')), moved);
});

test('(2b) the components draw these words and type no allowance of their own', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'vendor-grow-sections.tsx'), 'utf8');
  const port = src.slice(src.indexOf('/* ── 1b · VERIFIED ONLY'), src.indexOf('/* ── responsive helpers'));
  assert.ok(port.length > 2000, 'could not find the ported sections');
  assert.doesNotMatch(port, /\b\d+\s*km\b/, 'a reach is typed into the ported sections');
  assert.doesNotMatch(port, /\b(one|five|ten|\d+) (team )?seats? on\b/i, 'a seat count is typed into the ported sections');
  assert.doesNotMatch(port, /₱\s*[1-9]/, 'a peso figure is typed into the ported sections');
  for (const fn of ['planLine(', 'seatsLine()', 'reachLine()', 'ownAddressFrom()']) assert.ok(port.includes(fn), `${fn} is no longer drawn`);
});

test('(3) every photo is on disk, with the owner’s hero shifts', () => {
  const sections = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vendor-grow-sections.tsx'), 'utf8');
  const problemKeys = [...sections.matchAll(/photo: '([a-z0-9-]+)'/g)].map((m) => m[1]!);
  assert.equal(problemKeys.length, 12, `expected the twelve problem photos, found ${problemKeys.length}`);
  for (const key of [...HERO_SLIDES.map((s) => s.key), ...problemKeys]) {
    assert.ok(has(`public${MARKETING_PHOTOS}/${key}.webp`), `public${MARKETING_PHOTOS}/${key}.webp is missing`);
  }
  // Owner, 4 Nov ("images are too cut") — the prototype's --dr per slide.
  assert.deepEqual(Object.fromEntries(HERO_SLIDES.map((s) => [s.key.replace(/^supplier-|-hero$/g, ''), s.dr])), {
    florist: '4%',
    caterer: '19%',
    photographer: '0%',
    makeup: '22%',
    videographer: '19%',
    team: '19%',
  });
});
