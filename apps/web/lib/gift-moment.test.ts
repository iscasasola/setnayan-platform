/**
 * 🎁 THE GIFT MOMENT — the rules (owner 2026-11-14, DECISION_LOG "THE GIFT MOMENT" · "ONE PIECE, USED THREE WAYS" ·
 * "PRESSING REDEEM IS THE CLAIM" · "GIFT DESIGN APPROVED — WITH FABLE'S EIGHT PICKS").
 *
 *   1 · the words: packs, never pesos; "Already in your event's Papic pool" right above Redeem; a plan gift says it is on.
 *   2 · the badge moment: the previous badge, then the new one ("No badge yet" before the first).
 *   3 · each host once, oldest first, "1 of 2" back to back; every unclaimed gift waits.
 *   4 · the claim: 'claimed' and 'already' are BOTH claimed (the same claim, never two); anything else is "no
 *       connection", which re-sends the same claim.
 *   5 · the piece: loaded lazily, motion from tokens only, no typed duration, buttons ≥ 44 px, says "supplier".
 *
 * Sabotage (2026-11-14): `claimStateFrom` answering 'idle' for 'already' turns 4 red; a static
 * `import GiftMoment from './gift-moment'` in gift-moments.tsx turns 5 red; `animation: gm-shake 640ms` turns 5 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  andList,
  badgeRewardMomentView,
  badgeStepFor,
  claimStateFrom,
  giftLinesWords,
  giftMomentSeenKey,
  giftWaitingNoticeKey,
  momentsToPlay,
  momentsWaiting,
  queueCounter,
  sealFor,
  shopGiftMomentView,
  type GiftMomentView,
} from './gift-moment';

const EVENT = '11111111-1111-4111-8111-111111111111';

test('1 · a supplier gift says what came, in packs, and where it already is', () => {
  const v = shopGiftMomentView(
    {
      ref: 'p1',
      giverName: 'Liwanag Lights & Bar',
      logoSrc: null,
      lines: [{ title: 'Papic 1000', kind: 'papic', credits: 1000 }],
      landedAt: '2026-11-20T00:00:00Z',
      claimedAt: null,
    },
    EVENT,
  );
  assert.equal(v.received, 'You received 1 × Papic 1000 from Liwanag Lights & Bar');
  assert.equal(v.detail, '1,000 Papic credits');
  assert.equal(v.landedLine, 'Already in your event’s Papic pool');
  assert.equal(v.waitingLine, 'A gift from Liwanag Lights & Bar is waiting');
  assert.equal(v.fromLine, 'A gift from Liwanag Lights & Bar');
  assert.equal(v.redeemHref, `/dashboard/${EVENT}/memories`);
  assert.deepEqual(v.seal, { kind: 'initials', initials: 'LL' });
  assert.doesNotMatch(JSON.stringify(v), /₱|PHP|peso/i, 'a gift moment named money');

  const two = giftLinesWords([
    { title: 'Papic 150', kind: 'papic', credits: 150 },
    { title: 'Papic 150', kind: 'papic', credits: 150 },
    { title: 'Event Plus', kind: 'event_plus', credits: 1 },
  ]);
  assert.deepEqual(two, ['2 × Papic 150', 'Event Plus']);
  assert.equal(andList(two), '2 × Papic 150 and Event Plus');

  const mixed = shopGiftMomentView(
    {
      ref: 'p2',
      giverName: 'Bulaklak Florals',
      logoSrc: 'https://example.test/logo.png',
      lines: [
        { title: 'Event Ultra', kind: 'event_ultra', credits: 1 },
        { title: 'Papic 1000', kind: 'papic', credits: 1000 },
      ],
      landedAt: '2026-11-20T00:00:00Z',
      claimedAt: null,
    },
    EVENT,
  );
  assert.equal(mixed.landedLine, 'Both are already on your event');
  assert.equal(mixed.seal.kind, 'logo');

  const planOnly = shopGiftMomentView(
    { ref: 'p3', giverName: 'X', logoSrc: null, lines: [{ title: 'Event Pro', kind: 'event_pro', credits: 1 }], landedAt: 'a', claimedAt: null },
    EVENT,
  );
  assert.equal(planOnly.detail, null);
  assert.equal(planOnly.landedLine, 'Already on your event');
  assert.match(planOnly.redeemHref, /settings=1/);
});

test('1b · the seal: logo, else the two initials, else Setnayan for a Setnayan gift', () => {
  assert.equal(sealFor('Saysay Live Band & Hosting', null).kind, 'initials');
  assert.deepEqual(sealFor('Saysay Live Band', null), { kind: 'initials', initials: 'SL' });
  assert.equal(sealFor('Shop', 'https://x.test/l.png').kind, 'logo');
  const badge = badgeRewardMomentView({ ref: 'r', rewardKey: 'events:50', badge: 'events', rewardKind: 'event_plus', units: 1, landedAt: 'a', claimedAt: null });
  assert.deepEqual(badge.seal, { kind: 'setnayan' });
  assert.equal(badge.fromLine, 'From Setnayan');
  assert.equal(badge.waitingLine, 'A gift from Setnayan is waiting');
});

test('2 · the badge moment: the previous badge, then the new one', () => {
  const silver = badgeStepFor('events:50');
  assert.equal(silver?.from?.key, 'milestone:10');
  assert.equal(silver?.to.key, 'milestone:50');
  const first = badgeStepFor('events:10');
  assert.equal(first?.from, null, 'the first badge starts from "No badge yet"');
  assert.equal(first?.to.key, 'milestone:10');
  assert.equal(badgeStepFor('verified')?.to.key, 'verified');
  assert.equal(badgeStepFor('reviews:5'), null, 'a badge with no pill is said in words only');
  assert.equal(badgeStepFor('events:7'), null, 'a number that is not a step is never drawn as one');

  const v = badgeRewardMomentView({ ref: 'r', rewardKey: 'events:50', badge: 'events', rewardKind: 'event_plus', units: 1, landedAt: 'a', claimedAt: null });
  assert.equal(v.received, 'You earned 50 events · Silver');
  assert.equal(v.detail, 'Your reward: Event Plus');
  assert.equal(v.landedLine, 'In your gifts');
  assert.equal(v.redeemHref, '/vendor-dashboard/shop/promote#gifts');

  const firstV = badgeRewardMomentView({ ref: 'r', rewardKey: 'events:10', badge: 'events', rewardKind: 'event_plus', units: 1, landedAt: 'a', claimedAt: null });
  assert.match(firstV.received, /your first badge, 10 events · Bronze/);

  const fee = badgeRewardMomentView({ ref: 'r', rewardKey: 'events:1000', badge: 'events', rewardKind: 'fee_waiver', units: 1, landedAt: 'a', claimedAt: null });
  assert.equal(fee.landedLine, 'Used by itself on your next booking');

  // A reward kind this build does not name yet still says something, never "undefined".
  const later = badgeRewardMomentView({ ref: 'r', rewardKey: 'events:500', badge: 'events', rewardKind: 'event_ultra', units: 1, landedAt: 'a', claimedAt: null });
  assert.equal(later.detail, 'Your reward: Event Ultra');
});

function view(key: string, landedAt: string, claimedAt: string | null = null): GiftMomentView {
  return { ...shopGiftMomentView({ ref: key, giverName: key, logoSrc: null, lines: [], landedAt, claimedAt }, EVENT) };
}

test('3 · each host once, oldest first, back to back; every unclaimed one waits', () => {
  const a = view('a', '2026-11-20T02:00:00Z');
  const b = view('b', '2026-11-20T01:00:00Z');
  const c = view('c', '2026-11-19T00:00:00Z', '2026-11-19T05:00:00Z');
  const play = momentsToPlay([a, b, c], (v) => v.key === giftMomentKeyOf(c));
  assert.deepEqual(play.map((v) => v.ref), ['b', 'a'], 'oldest first, the seen one left out');
  // Claimed by the OTHER host, never seen by this one: it still plays (each host once).
  assert.deepEqual(momentsToPlay([c], () => false).map((v) => v.ref), ['c']);
  assert.deepEqual(momentsWaiting([a, b, c]).map((v) => v.ref), ['b', 'a'], 'a claimed gift does not wait');
  assert.equal(queueCounter(0, 2), '1 of 2');
  assert.equal(queueCounter(1, 2), '2 of 2');
  assert.equal(queueCounter(0, 1), null, 'one gift has no counter');
  assert.notEqual(giftMomentSeenKey(a), giftWaitingNoticeKey(a));
  assert.ok(giftMomentSeenKey(a).length <= 200 && giftWaitingNoticeKey(a).length <= 200, 'a memory key over the notice key limit');
});

function giftMomentKeyOf(v: GiftMomentView) {
  return v.key;
}

test('4 · 🚨 the claim: a repeat is the SAME claim; no answer is "no connection"', () => {
  assert.equal(claimStateFrom({ status: 'claimed' }), 'claimed');
  assert.equal(claimStateFrom({ status: 'already' }), 'claimed', 'a repeated press must read as claimed, never as a new gift');
  assert.equal(claimStateFrom({ status: 'refused' }), 'refused');
  for (const none of [null, undefined, {}, { status: 'unknown' }, 'oops']) {
    assert.equal(claimStateFrom(none), 'offline');
  }
});

const HERE = join(__dirname, '..', 'app', '_components', 'gift-moment');
const strip = (src: string) => stripComments(src);

test('5 · the piece: lazy, tokens only, 44 px, "supplier"', () => {
  const host = readFileSync(join(HERE, 'gift-moments.tsx'), 'utf8');
  assert.match(host, /dynamic\(\(\) => import\('\.\/gift-moment'\)/, 'the popup must load lazily');
  assert.doesNotMatch(strip(host), /^import [^;]*from '\.\/gift-moment';/m, 'the popup is imported statically — every page would carry it');

  const css = strip(readFileSync(join(HERE, 'gift-moment.module.css'), 'utf8'));
  assert.doesNotMatch(css, /\b\d+(\.\d+)?m?s\b(?![^(]*\))/, 'a typed duration in the gift moment’s motion — use the tokens');
  assert.doesNotMatch(css, /cubic-bezier|ease-in-out|\blinear\b(?! backwards)/, 'a typed curve — use the tokens');
  assert.match(css, /prefers-reduced-motion: reduce/);

  const popup = readFileSync(join(HERE, 'gift-moment.tsx'), 'utf8');
  assert.match(popup, /OverlayBackdrop/, 'the gift moment must use THE one backdrop');
  assert.match(popup, /StdTouchGlow/, 'the press must use the shipped touch glow');
  const buttons = strip(popup).split('<button').slice(1).map((b) => b.slice(0, b.indexOf('</button>')));
  assert.ok(buttons.length >= 4, 'the popup’s buttons were not found');
  for (const btn of buttons) {
    assert.match(btn, /min-h-1[12]|h-11/, `a button under 44 px: ${btn.slice(0, 80)}`);
  }
  for (const f of ['gift-moment.tsx', 'gift-moments.tsx', 'gift-art.tsx']) {
    assert.doesNotMatch(strip(readFileSync(join(HERE, f), 'utf8')), /\bvendor\b/i, `${f} says "vendor"`);
  }
});
