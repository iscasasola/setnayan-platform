/**
 * card-queue.test.ts — ➕ "Make N cards" (ruling 5820): the queue the Card Maker carries from one card to the next.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CARD_QUEUE_FIELD,
  CARD_QUEUE_MAX,
  CARD_SPECIALTIES_FIELD,
  cardMakerQueueHref,
  cardQueueLine,
  encodeCardSpecialties,
  parseCardQueue,
  parseCardSpecialties,
  specialtiesAsInitial,
} from '@/lib/card-queue';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('only well-shaped service keys, in order, once each, capped', () => {
  assert.deepEqual(parseCardQueue('lights,sound,lights'), ['lights', 'sound']);
  assert.deepEqual(parseCardQueue(' a , b '), ['a', 'b']);
  assert.deepEqual(parseCardQueue('ok,../x,//evil.com,UPPER,a b,'), ['ok']);
  assert.deepEqual(parseCardQueue(null), []);
  assert.deepEqual(parseCardQueue(''), []);
  const many = Array.from({ length: 40 }, (_, i) => `s${i}`).join(',');
  assert.equal(parseCardQueue(many).length, CARD_QUEUE_MAX);
});

test('the first service opens the maker, the rest ride on the address', () => {
  assert.equal(cardMakerQueueHref(['cake']), '/vendor-dashboard/services/new/cake');
  assert.equal(cardMakerQueueHref(['cake', 'lights', 'sound']), '/vendor-dashboard/services/new/cake?then=lights,sound');
  assert.equal(cardMakerQueueHref([]), null);
  assert.equal(cardMakerQueueHref(['//evil.com']), null, 'never a path someone typed');
});

test('the line over a queued maker names what waits', () => {
  assert.equal(cardQueueLine([], (k) => k), null);
  assert.equal(cardQueueLine(['a', 'b'], (k) => k.toUpperCase()), '2 more after this: A, B');
});

test('the maker posts the queue and the save reads it — a CREATE goes on to the next card, a refusal keeps it', () => {
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, new RegExp(`name="${CARD_QUEUE_FIELD}"`));
  const actions = read('app/vendor-dashboard/services/actions.ts');
  assert.match(actions, /parseCardQueue\(formData\.get\(CARD_QUEUE_FIELD\)\)/);
  assert.match(actions, /cardMakerQueueHref\(cardQueue(, queuedSpecialties)?\)/);
  const door = read('app/vendor-dashboard/services/new/[category]/page.tsx');
  assert.match(door, /parseCardQueue\(/);
  assert.match(door, /cardQueue=\{/);
});

// ── 🏷 Specialties belong to EACH service (prototype makers_match_2026-11-07 §2) — carried to that service's card only.
test('specialties ride with their own service: shape-checked, only for the services being made', () => {
  const picks = { cake: { style: ['fondant'] }, lights: { kind: ['led', 'par'] }, other: { x: ['y'] } };
  const href = cardMakerQueueHref(['cake', 'lights'], picks)!;
  const url = new URL(href, 'https://x.test');
  assert.equal(url.pathname, '/vendor-dashboard/services/new/cake');
  assert.equal(url.searchParams.get('then'), 'lights');
  const carried = parseCardSpecialties(url.searchParams.get('sp'));
  assert.deepEqual(carried, { cake: { style: ['fondant'] }, lights: { kind: ['led', 'par'] } }, 'a service not being made never rides');
  // Nothing picked → no `sp` on the address at all.
  assert.equal(cardMakerQueueHref(['cake'], {}), '/vendor-dashboard/services/new/cake');
  // Malformed / hostile reads as nothing.
  assert.deepEqual(parseCardSpecialties('{"../x":{"a":["b"]}}'), {});
  assert.deepEqual(parseCardSpecialties('not json'), {});
  assert.deepEqual(parseCardSpecialties('["a"]'), {});
  assert.deepEqual(parseCardSpecialties('{"cake":{"BAD KEY":["b"]}}'), {});
  assert.equal(encodeCardSpecialties(picks, ['nothing']), '');
});

test('a card pre-ticks only ITS OWN service\'s picks, only what its schema has, over what the shop saved', () => {
  const fields = { style: { type: 'multi_select', options: ['fondant', 'naked'] }, tier: { type: 'enum', options: ['one', 'two'] }, vegan: { type: 'boolean' } };
  const saved = { style: ['naked'], kept: 'x' };
  const out = specialtiesAsInitial(fields, saved, { style: ['fondant', 'made_up'], tier: ['two'], vegan: ['true'], gone: ['z'] });
  assert.deepEqual(out, { style: ['naked', 'fondant'], kept: 'x', tier: 'two', vegan: true });
  assert.equal(specialtiesAsInitial(fields, saved, undefined), saved, 'no picks → the saved values, untouched');
});

test('the maker posts the queued specialties and the save carries them to the next card, never writing them early', () => {
  assert.equal(CARD_SPECIALTIES_FIELD, 'card_specialties');
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, /name="card_specialties" value=\{cardSpecialties\}/);
  const actions = read('app/vendor-dashboard/services/actions.ts');
  assert.match(actions, /parseCardSpecialties\(formData\.get\(CARD_SPECIALTIES_FIELD\), cardQueue\)/);
  assert.match(actions, /cardMakerQueueHref\(cardQueue, queuedSpecialties\)/);
  const page = read('app/vendor-dashboard/services/new/[category]/page.tsx');
  assert.match(page, /specialtiesAsInitial\(details\.refinements\.fields, details\.values, carried\[category\]\)/);
});

// ── 🔒 Honest reads on the dashboard's Add a service.
test('the shop\'s services unread → the picker says so, never a list that pretends the shop has none', () => {
  const loader = read('lib/service-card-maker.server.ts');
  assert.match(loader, /ownKinds: ownRowsRes\.error \? null : /);
  const add = read('app/vendor-dashboard/services/new/_components/add-service-picker.tsx');
  assert.match(add, /onShop: readonly string\[\] \| null/);
  assert.match(add, /if \(onShop === null\) return unread\('Couldn’t load your services\. Try again\.'/);
  assert.match(add, /if \(tree\.length === 0\) return unread\('Couldn’t load the list of services\. Try again\.'/);
  // The unread line comes BEFORE the picker is drawn — the ServicePicker only renders below both checks.
  assert.ok(add.indexOf("if (onShop === null)") < add.indexOf('<ServicePicker'));
});

test('each picked service shows ITS OWN "+ Specialties (optional)" and the meter is the sign-up\'s, from TIER_CAPS', () => {
  const add = read('app/vendor-dashboard/services/new/_components/add-service-picker.tsx');
  assert.match(add, /<Specialties\s+service=\{\{ key: p\.key, label: p\.label \}\}\s+fields=\{specialties\[p\.key\]!\}/);
  assert.match(add, /<CoverageMeter list=\{meterList\} \/>/);
  assert.match(add, /\[\.\.\.onShop, \.\.\.picked\.map\(\(p\) => p\.key\)\]/, 'the meter counts what is on the shop AND the new picks');
  const cards = read('app/open-shop/_components/service-cards.tsx');
  assert.match(cards, /export function CoverageMeter\(\{ list \}: \{ list: readonly MeterService\[\] \}\) \{\s+const line = coverageLine\(list\);/);
});
