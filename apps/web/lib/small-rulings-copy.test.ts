/**
 * SMALL OWNER RULINGS — COPY (DECISION_LOG 2026-08-12 · 2026-09-30 · 2026-07-17).
 *
 *   · "Journal" is retired → "Articles" (2026-08-12: "Remove Journal just name it
 *     Articles"): the public site-nav slot and the social post title prefix.
 *   · Live Studio → "Live Watch" (2026-09-30): the More Services card.
 *   · No "parish" on the Groups empty state (2026-07-17: the group kind taxonomy
 *     is removed; a parish read as a religious-affiliation signal).
 *
 * Sabotage notes (each verified red once): restore label "Journal" · restore
 * the `Journal ·` title prefix · put "parish" back in the Groups blurb · rename
 * the card back to "Live Studio".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { buildOurServices, type OurServicesInput } from '@/lib/our-services';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the public site nav says "Articles", never "Journal"', () => {
  const slot = NAV_SLOT_DEFAULTS.find((s) => s.key === 'public.site-nav.journal');
  assert.ok(slot, 'the /blog nav slot is missing — this guard is pointed at nothing');
  assert.equal(slot.route, '/blog');
  assert.equal(slot.label, 'Articles');
  // No PUBLIC slot anywhere wears the retired word (the admin spotlights tool is internal).
  const wearing = NAV_SLOT_DEFAULTS.filter((s) => s.scope === 'public' && /journal/i.test(s.label));
  assert.deepEqual(wearing.map((s) => s.key), [], 'a public nav label still says Journal');
});

test('an article posted to social is titled "Articles · …", not "Journal · …"', () => {
  const src = readCode('lib/social/flush.ts');
  assert.match(src, /title: `Articles · \$\{article\.title\}`/, 'the social title prefix is not "Articles ·"');
  assert.doesNotMatch(src, /`Journal ·/, 'the retired "Journal ·" prefix is back');
});

test('the More Services card for the live service reads "Live Watch"', () => {
  const input: OurServicesInput = {
    eventId: 'E',
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map(),
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    papicOwnedBy: [],
    refusesPath: () => false,
  };
  const card = buildOurServices(input).find((c) => c.key === 'live-studio');
  assert.ok(card, 'the live service card is gone');
  assert.equal(card.name, 'Live Watch');
  assert.doesNotMatch(card.name, /Studio/);
});

test('the Groups empty state does not name a parish', () => {
  const src = readCode('app/dashboard/(account)/samahan/page.tsx');
  assert.match(src, /Wala ka pang group\./, 'the empty state moved — this guard is pointed at nothing');
  assert.match(src, /your barkada or clan/, 'the blurb lost its example');
  assert.doesNotMatch(src, /parish/i, 'a parish is named on the Groups screen again');
});
