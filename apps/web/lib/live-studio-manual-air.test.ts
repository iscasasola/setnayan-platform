import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveAir, shouldOfferManualAir } from './live-studio-manual-air';

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

describe('shouldOfferManualAir — the switch is offered exactly when it is needed', () => {
  test('offered when one-tap go-live is unavailable', () => {
    assert.equal(shouldOfferManualAir({ automaticAvailable: false }), true);
  });

  test('hidden when one-tap works and nothing was set by hand', () => {
    assert.equal(shouldOfferManualAir({ automaticAvailable: true }), false);
  });

  test('NO GATE WITHOUT A HANDLE: still offered once set, even after YouTube connects', () => {
    // The trap this closes: switch on by hand → later connect YouTube → the control
    // that turns it off vanishes while the red light stays on forever.
    assert.equal(
      shouldOfferManualAir({
        automaticAvailable: true,
        manualOnAirAt: '2026-12-12T06:30:00.000Z',
      }),
      true,
    );
  });

  test('a junk stored value does not conjure a handle for a state that reads off', () => {
    assert.equal(
      shouldOfferManualAir({ automaticAvailable: true, manualOnAirAt: 'garbage' }),
      false,
    );
  });
});
