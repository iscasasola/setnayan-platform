import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { endOnAirTarget, resolveLiveAir, shouldOfferManualAir } from './live-studio-manual-air';

describe('resolveLiveAir — the two routes on air', () => {
  test('off air when neither route says otherwise', () => {
    const s = resolveLiveAir({ hasActiveBroadcast: false });
    assert.equal(s.isLive, false);
    assert.equal(s.startedAt, null);
    assert.equal(s.source, null);
  });

  test('an automatic broadcast is on air, carrying its own start', () => {
    const s = resolveLiveAir({
      hasActiveBroadcast: true,
      broadcastStartedAt: '2026-12-12T06:00:00.000Z',
    });
    assert.equal(s.isLive, true);
    assert.equal(s.startedAt, '2026-12-12T06:00:00.000Z');
    assert.equal(s.source, 'broadcast');
  });

  test('THE FIX: a by-hand host is on air, with the instant they said so', () => {
    const s = resolveLiveAir({
      hasActiveBroadcast: false,
      manualOnAirAt: '2026-12-12T06:30:00.000Z',
    });
    assert.equal(s.isLive, true);
    assert.equal(s.startedAt, '2026-12-12T06:30:00.000Z');
    assert.equal(s.source, 'manual');
  });

  test('a real broadcast outranks a stale manual flag, and keeps ITS start', () => {
    // Preferring the (earlier) manual instant would move the never-interrupt bound
    // backwards — the one direction that gives multi-cam away.
    const s = resolveLiveAir({
      hasActiveBroadcast: true,
      broadcastStartedAt: '2026-12-12T09:00:00.000Z',
      manualOnAirAt: '2026-12-12T01:00:00.000Z',
    });
    assert.equal(s.source, 'broadcast');
    assert.equal(s.startedAt, '2026-12-12T09:00:00.000Z');
  });

  test('an automatic broadcast with no usable start stays live (existing fail-open)', () => {
    const s = resolveLiveAir({ hasActiveBroadcast: true, broadcastStartedAt: null });
    assert.equal(s.isLive, true);
    assert.equal(s.startedAt, null);
  });

  test('MONEY: a manual value that is on air NEVER lacks a start', () => {
    // "on air + no start" is precisely the state decideBroadcastWindow protects.
    // The manual branch must never be able to produce it.
    for (const raw of [
      '2026-12-12T06:30:00.000Z',
      '2026-01-01T00:00:00+08:00',
      'not-a-date',
      '',
      null,
      undefined,
    ]) {
      const s = resolveLiveAir({ hasActiveBroadcast: false, manualOnAirAt: raw });
      if (s.isLive) assert.ok(s.startedAt, `on air with no start for ${JSON.stringify(raw)}`);
    }
  });

  test('a junk stored instant reads OFF air, not "live with unknown start"', () => {
    const s = resolveLiveAir({ hasActiveBroadcast: false, manualOnAirAt: 'garbage' });
    assert.equal(s.isLive, false);
    assert.equal(s.source, null);
  });

  test('empty string is off air, not on air', () => {
    assert.equal(resolveLiveAir({ hasActiveBroadcast: false, manualOnAirAt: '' }).isLive, false);
  });
});

describe('shouldOfferManualAir — withdrawn only by a REAL broadcast', () => {
  test('offered when nothing is broadcasting', () => {
    assert.equal(shouldOfferManualAir({ broadcastLive: false }), true);
  });

  test('withdrawn while an automatic broadcast is actually on air', () => {
    // Then the red light is already lit by the real thing; a second on-air control
    // would be two answers to one question.
    assert.equal(shouldOfferManualAir({ broadcastLive: true }), false);
  });

  test('CONNECTING IS NOT BROADCASTING — the switch survives a connected channel', () => {
    // The trap this closes: the first cut hid the switch the moment a channel
    // existed. That is exactly the moment it is needed — the host connects, presses
    // Go live, YouTube refuses (live streaming not enabled yet, quota, a strike),
    // and the only remaining way to light the control room has just been removed
    // BECAUSE they connected.
    assert.equal(shouldOfferManualAir({ broadcastLive: false }), true);
  });

  test('NO GATE WITHOUT A HANDLE: a manually-on host can always switch off', () => {
    // Manually on air means source==='manual', which means no broadcast row, which
    // means broadcastLive is false — so the off switch is always reachable.
    const air = resolveLiveAir({
      hasActiveBroadcast: false,
      manualOnAirAt: '2026-12-12T06:30:00.000Z',
    });
    // Compute BEFORE asserting: an equality assert narrows `source` to the literal
    // 'manual', after which comparing it to 'broadcast' is a type error rather than
    // the runtime check this test is making.
    const offered = shouldOfferManualAir({ broadcastLive: air.source === 'broadcast' });
    assert.equal(air.source, 'manual');
    assert.equal(offered, true);
  });

  test('the predicate is not a tautology — both outcomes are reachable', () => {
    const outcomes = new Set(
      [true, false].map((b) => shouldOfferManualAir({ broadcastLive: b })),
    );
    assert.equal(outcomes.size, 2, 'a boolean that cannot say no is not a decision');
  });
});

describe('endOnAirTarget — DEFECT 1: "End broadcast" must not end a broadcast that was never created', () => {
  test('a real broadcast is ended via the broadcast route', () => {
    assert.equal(endOnAirTarget('broadcast'), 'broadcast');
  });

  test('THE FIX: a by-hand host is ended via the manual route, never the broadcast one', () => {
    // Before this fix, TransportRow always called endPanoodBroadcast — which, for a
    // manual-only host, has no panood_broadcasts row to close and instead wipes the
    // watch_url the host pasted themselves while leaving panood_manual_on_air_at
    // (the thing actually making isLive true) untouched.
    assert.equal(endOnAirTarget('manual'), 'manual');
    assert.notEqual(endOnAirTarget('manual'), 'broadcast');
  });

  test('off air has no end target', () => {
    assert.equal(endOnAirTarget(null), null);
  });

  test('every isLive source maps to a distinct, non-null target', () => {
    // A guard that could route both sources to the same action would let the
    // manual-air host's End button silently fall back to endPanoodBroadcast again.
    const targets = (['broadcast', 'manual'] as const).map((s) => endOnAirTarget(s));
    assert.ok(targets.every((t) => t !== null));
    assert.equal(new Set(targets).size, 2, 'broadcast and manual must route differently');
  });
});
