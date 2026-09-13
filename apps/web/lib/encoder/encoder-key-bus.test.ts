import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  announceStreamKeyHeld,
  readStreamKeyHandoffs,
  subscribeStreamKeyHeld,
  resetStreamKeyBus,
} from './encoder-key-bus';

beforeEach(() => resetStreamKeyBus());

test('no key handed over reads as zero, not as a throw', () => {
  assert.equal(readStreamKeyHandoffs('S89E-NOBODY'), 0);
});

test('a handoff notifies every subscriber', () => {
  let woken = 0;
  subscribeStreamKeyHeld(() => {
    woken += 1;
  });
  announceStreamKeyHeld('S89E-AAA');
  assert.equal(woken, 1, 'the encoder host must be woken by a paste');
});

test('a RE-paste is a distinguishable second event, not a no-op', () => {
  // The couple fixed a typo'd key. A boolean flag would already be true and the
  // encoder would never try again with the corrected key.
  announceStreamKeyHeld('S89E-AAA');
  announceStreamKeyHeld('S89E-AAA');
  assert.equal(readStreamKeyHandoffs('S89E-AAA'), 2);
});

test('handoffs are kept per event — one wedding cannot answer for another', () => {
  announceStreamKeyHeld('S89E-AAA');
  assert.equal(readStreamKeyHandoffs('S89E-BBB'), 0);
});

test('unsubscribing actually stops the notifications', () => {
  let woken = 0;
  const off = subscribeStreamKeyHeld(() => {
    woken += 1;
  });
  off();
  announceStreamKeyHeld('S89E-AAA');
  assert.equal(woken, 0);
});

test('the bus never carries the key or the address, only a count', () => {
  // The type system says so, and this pins it against a future "helpful" edit:
  // the key crosses IPC once, into Rust, and must not live on a module
  // singleton in the renderer. See the module docblock and stream_key.rs.
  announceStreamKeyHeld('S89E-AAA');
  const carried = JSON.stringify(readStreamKeyHandoffs('S89E-AAA'));
  assert.equal(carried, '1');
  assert.equal(typeof readStreamKeyHandoffs('S89E-AAA'), 'number');
});
