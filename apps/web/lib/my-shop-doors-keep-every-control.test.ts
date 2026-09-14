/**
 * THE SIX DOORS MOVED CONTROLS; THEY MUST NOT HAVE LOST ANY.
 *
 * G1 ports the hero, the rail and door 1 of the approved drawing
 * (`prototypes/shop_page_2026-09-10.html`, owner 2026-09-14 "doors 1-3 ok")
 * onto `app/vendor-dashboard/shop/page.tsx`. The owner's brief for the whole
 * chain is *"improving what we have"*, and the drawing's own headline is
 * **"Nothing removed, three things moved."**
 *
 * 🔑 SO THE RISK IS NOT THAT THE NEW THING LOOKS WRONG — IT IS THAT AN OLD
 * THING QUIETLY STOPS BEING MOUNTED. A restructure of an 1,876-line page can
 * drop a component and leave a page that renders perfectly and is missing a
 * control a shop owner needs, with nothing red anywhere. This guard exists for
 * that, and it is derived from the drawing's own "every shipped control → its
 * door" table rather than from the page it is checking.
 *
 * ─── WHY THIS IS A SOURCE PIN, AND HOW IT AVOIDS BEING A USELESS ONE ───────
 * `page.tsx` is a server component tree with `server-only` imports, so
 * `tsx --test` cannot render it. Comments are stripped before every negative
 * assertion, so a component named only in a docblock can never satisfy a claim
 * that it is mounted — the docblock above literally names both anchors, which
 * would satisfy a naive grep.
 *
 * ⚠ AND IT COUNTS. `assert count === 1` on every mount, not `includes`: a
 * duplicated `id` is as broken as a missing one (two `#get-verified` sections
 * make the hero pill's deep-link land on whichever the browser sees first), and
 * a bare `includes` cannot tell one from two.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { SHOP_DOORS } from '@/app/vendor-dashboard/shop/_components/shop-rail';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOP = resolve(HERE, '../app/vendor-dashboard/shop');
const read = (p: string) => stripComments(readFileSync(resolve(SHOP, p), 'utf8'));
const PAGE = () => read('page.tsx');

const count = (src: string, needle: string) => src.split(needle).length - 1;

/**
 * Count JSX mounts of a component by NAME, at a real element boundary.
 *
 * 🪤 A PLAIN SUBSTRING COUNT CANNOT TELL `<ManageTiles` FROM `<ManageTilesXX`.
 * The first cut of this file used one, and a sabotage that renamed a component
 * — exactly how a mount gets lost in a restructure — left the guard green. The
 * trailing class is what makes the match a whole tag name.
 */
const mountCount = (src: string, component: string) =>
  (src.match(new RegExp(`<${component}(?![A-Za-z0-9_])`, 'g')) ?? []).length;

/**
 * Every component the shipped page mounted BEFORE G1, with the door the
 * drawing's table assigns it. Transcribed from that table, not from the page —
 * a list copied off the page it checks can only ever agree with it.
 *
 * ⛔ NOTHING IS EVER REMOVED FROM THIS LIST. A control that genuinely retires
 * is retired by an owner ruling, and then this line is deleted in the same
 * commit as the mount, with the ruling cited. Deleting a line to make a red
 * test pass is the exact failure the drawing's "nothing removed" is about.
 */
const SHIPPED_MOUNTS: ReadonlyArray<readonly [string, string]> = [
  ['<HeroCard', 'hero'],
  ['<ManageTiles', 'door 1 — shop information'],
  ['<VerifySection', 'door 1 — your papers'],
  ['<ServicesDisclosure', 'door 3 — what you sell'],
  ['<EarningsSurface', 'door 5 — earnings'],
  ['<FeatureAccordion', 'door 6 — the folds'],
];

test('every control the page shipped before G1 is still mounted, exactly once', () => {
  const src = PAGE();
  for (const [mount, where] of SHIPPED_MOUNTS) {
    const name = mount.slice(1);
    assert.equal(
      mountCount(src, name),
      1,
      `<${name} (${where}) is mounted ${mountCount(src, name)}× — the drawing says nothing is removed`,
    );
  }
});

test('🔑 BOTH DEEP-LINK ANCHORS STILL RESOLVE, AND EXACTLY ONCE EACH', () => {
  /*
    `#manage-shop` and `#get-verified` are the targets of the hero pills,
    Today's first steps and the Subscription page's "Get verified first". They
    live INSIDE their components, not on the page — so a restructure that
    wrapped them could shadow one, and a copy-paste could duplicate one. Both
    are checked at their real homes.
  */
  assert.equal(
    count(read('_components/manage-tiles.tsx'), 'id="manage-shop"'),
    1,
    '#manage-shop no longer resolves — the hero pill and Today\'s first steps dead-end',
  );
  assert.equal(
    count(read('_components/verify-section.tsx'), 'id="get-verified"'),
    1,
    '#get-verified no longer resolves — the verification deep-links dead-end',
  );
  // And the page must not mint a competing copy of either.
  const src = PAGE();
  assert.equal(count(src, 'id="manage-shop"'), 0, 'the page duplicates #manage-shop');
  assert.equal(count(src, 'id="get-verified"'), 0, 'the page duplicates #get-verified');
});

test('door 1 holds BOTH the shop information and the papers', () => {
  /*
    The whole point of door 1: "fix my shop information and verification,
    branches, team" is ONE errand. Before G1 the papers sat below the service
    cards. A door that contains only the tiles is the move half-done — and
    would look completely fine on screen.
  */
  const src = PAGE();
  const open = src.indexOf('<ShopDoorSection');
  assert.ok(open > -1, 'door 1 is not mounted at all');
  const close = src.indexOf('</ShopDoorSection>', open);
  assert.ok(close > open, 'the door shell is never closed');
  const inside = src.slice(open, close);
  assert.ok(inside.includes('<ManageTiles'), 'the shop information is not inside door 1');
  assert.ok(inside.includes('<VerifySection'), 'the papers are not inside door 1');
  assert.match(inside, /id="d1"/, 'door 1 does not carry the anchor the rail points at');
});

test('the rail is mounted, and above the door it points at', () => {
  const src = PAGE();
  assert.equal(count(src, '<ShopRail />'), 1, 'the rail is missing or duplicated');
  assert.ok(
    src.indexOf('<ShopRail />') < src.indexOf('<ShopDoorSection'),
    'the rail renders below door 1 — a map under the room it maps',
  );
});

test('the rail offers all six doors, in the drawing’s order', () => {
  assert.equal(SHOP_DOORS.length, 6, 'the drawing has six doors');
  assert.deepEqual(
    SHOP_DOORS.map((d) => d.key),
    ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    'the doors are out of order or renamed — the rail is the drawing',
  );
  assert.deepEqual(
    SHOP_DOORS.map((d) => d.title),
    ['Your shop', 'Your website', 'What you sell', 'Auto-reply', 'Getting paid', 'Other tools'],
    'a door title drifted from the approved drawing',
  );
});

test('🪤 NO DOOR POINTS AT A ROOM THAT IS NOT THERE', () => {
  /*
    G1 builds door 1 only. The other five must point at where their content
    ALREADY lives, or the rail becomes a set of links that scroll nowhere — the
    most quietly broken thing a map can be, because a fragment link to a missing
    id fails silently and just does nothing.
  */
  /*
    🪤 AN ANCHOR IS RARELY ON page.tsx. `#manage-shop` sits on ManageTiles's own
    <section> and `#get-verified` on VerifySection's — the first cut of this test
    searched only page.tsx and reported a perfectly good door as dead. So the
    whole rendered surface is searched: the page plus every component it mounts.
  */
  const surface = [PAGE(), ...readdirSync(resolve(SHOP, '_components'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => read(`_components/${f}`))].join('\n');
  for (const door of SHOP_DOORS) {
    assert.ok(door.href.startsWith('#'), `${door.key} routes off the page: ${door.href}`);
    const id = door.href.slice(1);
    const carried =
      count(surface, `id="${id}"`) > 0 ||
      (door.built && count(surface, `id={id}`) > 0);
    assert.ok(
      carried,
      `door ${door.key} ("${door.title}") points at #${id}, which nothing on the page carries`,
    );
  }
});

test('only door 1 claims to be built', () => {
  /*
    Doors 4–6 are NOT ruled by the owner. A later session marking one `built`
    without a ruling is how an unapproved design ships behind an approved one.
  */
  assert.deepEqual(
    SHOP_DOORS.filter((d) => d.built).map((d) => d.key),
    ['d1'],
    'a door claims to be built that the owner has not ruled on',
  );
});

test('the rail needs no JavaScript', () => {
  /*
    A shop owner finding one setting quickly must not wait for hydration. Plain
    fragment anchors do that; a scroll handler would replace it with something
    that only works once React has loaded.
  */
  const railSrc = read('_components/shop-rail.tsx');
  assert.ok(!railSrc.includes("'use client'"), 'the rail became a client component');
  assert.ok(!/onClick|useEffect|scrollIntoView/.test(railSrc), 'the rail grew a scroll handler');
});
