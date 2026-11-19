/**
 * 🔒 Locked card medals (Card Maker v36 · owner 18 Nov):
 *   1 · a locked medal is the medal the card does NOT hold, in the fixed order, never Setnayan Verified;
 *   2 · it draws the real medal (its own colour) with a small lock, and the word "Locked";
 *   3 · it is NEVER on a couple's card: no file outside `app/vendor-dashboard/` (and the dev labs, which never ship) imports it;
 *   4 · the Services list draws it only on an honest read (an unread badge set is never "all locked").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { CARD_BADGE_KEYS } from './card-badges';
import { CARD_BADGE_ART } from './card-badges-art';

// Same harness as award-kit.test.ts: the .tsx is compiled with the classic runtime, so React must be global before it loads.
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const load = () => import('@/app/_components/card-badges/card-locked-medals');

const WEB = join(import.meta.dirname, '..');

test('1 · locked = the card-earned medals it does not hold, in order; Verified is never listed', async () => {
  const { lockedCardMedals } = await load();
  assert.deepEqual(lockedCardMedals([]), [...CARD_BADGE_KEYS]);
  assert.deepEqual(
    lockedCardMedals([{ key: 'hot_booking' }, { key: 'verified' }]),
    CARD_BADGE_KEYS.filter((k) => k !== 'hot_booking'),
  );
  assert.ok(!lockedCardMedals([]).includes('verified' as never));
  assert.deepEqual(lockedCardMedals(CARD_BADGE_KEYS.map((key) => ({ key }))), []);
});

test('2 · the real art (its own colour), a small lock, the word Locked; nothing when all are held', async () => {
  const { CardLockedMedals } = await load();
  const m = renderToStaticMarkup(h(CardLockedMedals, { held: [{ key: 'hot_booking' }] }));
  assert.ok(m.includes('data-card-locked-medals'));
  assert.ok(m.includes(CARD_BADGE_ART.trending_now.fill), 'the medal keeps its own colour');
  assert.ok(!/grayscale/.test(m), 'never greyed');
  assert.equal((m.match(/data-card-medal-lock/g) ?? []).length, CARD_BADGE_KEYS.length - 1, 'one lock per locked medal');
  assert.ok(m.includes('Trending Now') && m.includes('Locked'));
  assert.ok(!m.includes('Hot Booking'), 'a held medal is not drawn as locked');
  assert.equal(renderToStaticMarkup(h(CardLockedMedals, { held: CARD_BADGE_KEYS.map((key) => ({ key })) })), '');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

test('3 · never on a couple\'s card: only app/vendor-dashboard/ imports it', () => {
  const importers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((p) => /card-locked-medals/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p))
    .filter((p) => p !== 'app/_components/card-badges/card-locked-medals.tsx');
  assert.ok(importers.length > 0, 'something draws it (else this test proves nothing)');
  for (const p of importers) assert.ok(p.startsWith('app/vendor-dashboard/') || p.startsWith('app/dev/'), `${p} is not a supplier-only screen`);
});

test('4 · the Services list draws it only on an honest badge read', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/services-manager.tsx'), 'utf8'));
  assert.match(src, /cardBadges\.kind === 'ok' \? \(\s*<CardLockedMedals /);
});

test('5 · Shop › Badges: a locked badge keeps its colours too — no grey, no fade, a small corner lock', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-badge-row.tsx'), 'utf8'));
  assert.ok(!/grayscale/.test(src), 'the shelf never greys a badge');
  assert.ok(!/opacity: earned \? 1 : 0\.45/.test(src), 'the shelf never fades a locked badge');
  // The shelf's look is main's now (#7986, the same 18 Nov ruling): the lock sits on the ring at the lower right, by `lockAt`.
  assert.match(src, /style=\{\{ left: lockAt, top: lockAt, width: LOCK_PX, height: LOCK_PX \}\}/);
  assert.match(src, /data-badge-lock=""/);
});
