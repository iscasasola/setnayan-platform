import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHANNEL_HEARTBEAT_MS,
  CHANNEL_STALE_MS,
} from '@/lib/live-studio-channel-cameras';
import { stripComments } from '@/lib/strip-comments';
import {
  CHANNEL_REFRESH_MS,
  WORST_CASE_CARD_AGE_MS,
  shouldWatchChannels,
} from '@/lib/live-studio-channel-freshness';

/**
 * WHY THIS FILE EXISTS.
 *
 * The controller's honest status was already correct and already rendered — and a
 * card was still seen reading "Camera connected" over a heartbeat 140 seconds
 * stale, because the server component that computed it never ran again. These
 * hold the second half of that fix: the gate that decides whether to re-ask, the
 * cadence, and the wiring that carries it onto the page.
 */

/* ── THE GATE ──────────────────────────────────────────────────────────────── */

test('a control room with no seats bound watches nothing', () => {
  assert.equal(shouldWatchChannels({ channels: [] }), false);
  assert.equal(
    shouldWatchChannels({ channels: [{ hasSeat: false }, { hasSeat: false }] }),
    false,
  );
});

test('a bound seat is watched BEFORE anyone claims it — the waiting-host case', () => {
  // The direction of the lie a live-only or claimed-only gate would leave in
  // place: the host printed a card, scanned it on the phone, and is standing at
  // the laptop watching "Waiting for a camera" that nothing will ever update.
  assert.equal(shouldWatchChannels({ channels: [{ hasSeat: true }] }), true);
});

test('one bound seat among many unbound is enough', () => {
  assert.equal(
    shouldWatchChannels({
      channels: [{ hasSeat: false }, { hasSeat: true }, { hasSeat: false }],
    }),
    true,
  );
});

/* ── THE CADENCE ───────────────────────────────────────────────────────────── */

test('the refresh cadence is the heartbeat, not a number somebody picked', () => {
  // Derived, and pinned to its derivation rather than to a literal: polling on the
  // beat keeps the render from adding a second delay larger than the staleness
  // window the resolver already sized at 3x the beat.
  assert.equal(CHANNEL_REFRESH_MS, CHANNEL_HEARTBEAT_MS);
  assert.ok(
    CHANNEL_REFRESH_MS <= CHANNEL_STALE_MS,
    'refreshing slower than the staleness window would dominate the delay it exists to bound',
  );
});

test('the worst case a card can lie is stated, bounded, and made of both constants', () => {
  assert.equal(WORST_CASE_CARD_AGE_MS, CHANNEL_STALE_MS + CHANNEL_REFRESH_MS);
  // The whole point: bounded at all. Today it is unbounded.
  assert.ok(Number.isFinite(WORST_CASE_CARD_AGE_MS) && WORST_CASE_CARD_AGE_MS > 0);
  assert.ok(
    WORST_CASE_CARD_AGE_MS < 2 * CHANNEL_STALE_MS,
    'the render must not add more delay than the resolver itself tolerates',
  );
});

/* ── THE WIRING ────────────────────────────────────────────────────────────── */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/**
 * Comment-stripped, via the repo's ONE stripper. The controller documents itself
 * heavily and names `<SetupSheet>` in prose long before it renders it — a raw
 * indexOf finds the sentence, not the element, and the ordering assertion below
 * then fails on correct code.
 */
const code = (p: string) => stripComments(read(p));

test('the controller actually mounts it, and outside the setup sheet', () => {
  const src = code('app/panood/control/[eventId]/page.tsx');
  assert.match(src, /<ChannelFreshness/, 'the controller does not mount ChannelFreshness');

  const mount = src.indexOf('<ChannelFreshness');
  const sheetOpen = src.indexOf('<SetupSheet>');
  assert.ok(mount > -1 && sheetOpen > -1);
  // Same rule ProgramBridgeHost is held to: the sheet unmounts what it contains,
  // and a refresher that dies when the host closes the sheet is the frozen card
  // back again.
  assert.ok(
    mount < sheetOpen,
    'ChannelFreshness moved inside SetupSheet — closing the sheet would freeze the cards again',
  );
});

test('it is fed hasSeat, so an unbound control room installs no timer', () => {
  const src = code('app/panood/control/[eventId]/page.tsx');
  assert.match(
    src,
    /<ChannelFreshness channels=\{zones\.map\(\(z\) => \(\{ hasSeat: Boolean\(z\.camera\) \}\)\)\}/,
    'ChannelFreshness must be fed the real per-channel seat binding',
  );
});

test('the refresher reuses the shipped tick machinery rather than a second copy', () => {
  const src = code('app/panood/control/[eventId]/_components/channel-freshness.tsx');
  assert.match(src, /useVisibleTick/, 'must reuse useVisibleTick');
  assert.match(src, /router\.refresh\(\)/, 'must actually re-run the server render');
  assert.doesNotMatch(
    src,
    /visibilitychange|addEventListener/,
    'listener bookkeeping belongs in useVisibleTick, not re-implemented here',
  );
});

test('the day-of hook still delegates — its six surfaces keep one definition of "visible"', () => {
  const src = code('lib/use-day-of-live-refresh.ts');
  assert.match(src, /export function useVisibleTick/);
  assert.match(
    src,
    /useVisibleTick\(\(\) => isEventDayActive/,
    'useDayOfLiveTick must delegate to useVisibleTick, not keep its own listeners',
  );
  // A missing date installed no listeners before the extraction and must still.
  assert.match(src, /enabled: Boolean\(eventDate\)/);
  // Exactly one interval in the module: the extracted one.
  assert.equal(
    (src.match(/setInterval\(/g) ?? []).length,
    1,
    'a second setInterval means the extraction left a copy behind',
  );
});
