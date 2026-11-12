/**
 * card-queue.test.ts — ➕ "Make N cards" (ruling 5820): the queue the Card Maker carries from one card to the next.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CARD_QUEUE_FIELD, CARD_QUEUE_MAX, cardMakerQueueHref, cardQueueLine, parseCardQueue } from '@/lib/card-queue';
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
  assert.match(actions, /cardMakerQueueHref\(cardQueue\)/);
  const door = read('app/vendor-dashboard/services/new/[category]/page.tsx');
  assert.match(door, /parseCardQueue\(/);
  assert.match(door, /cardQueue=\{/);
});
