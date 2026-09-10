/**
 * The bus is read through `useSyncExternalStore`, which has one hard rule: the
 * snapshot must be the SAME reference until something actually changes. Break
 * that and React re-renders forever with "The result of getSnapshot should be
 * cached". A bus that built a fresh `{ input, note }` on every READ would pass
 * every behavioural test and still hang the controller.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  publishEncoderHealth,
  readEncoderHealth,
  resetEncoderHealthBus,
  subscribeEncoderHealth,
} from './encoder-health-bus';
import type { EncoderHealthInput } from '../live-studio-ingest-health';

const reading: EncoderHealthInput = {
  rtmp: 'publishing',
  reconnectingForMs: 0,
  droppedFrames: 0,
  bitrateRung: 0,
  recording: true,
};

beforeEach(() => resetEncoderHealthBus());

test('the snapshot is stable between publishes — useSyncExternalStore requires it', () => {
  publishEncoderHealth('S89EV-A', reading);
  const first = readEncoderHealth('S89EV-A');
  const second = readEncoderHealth('S89EV-A');
  assert.ok(first);
  assert.equal(first, second, 'two reads with no publish between them must be the SAME object');
});

test('a publish produces a new snapshot', () => {
  publishEncoderHealth('S89EV-A', reading);
  const before = readEncoderHealth('S89EV-A');
  publishEncoderHealth('S89EV-A', { ...reading, rtmp: 'reconnecting' });
  const after = readEncoderHealth('S89EV-A');
  assert.notEqual(before, after);
  assert.equal(after?.input.rtmp, 'reconnecting');
});

test('the transport note travels with the reading', () => {
  publishEncoderHealth('S89EV-A', reading, {
    transportEnvelope: 'base64',
    guardSentence: 'slower than usual',
  });
  const got = readEncoderHealth('S89EV-A');
  assert.equal(got?.note.transportEnvelope, 'base64');
  assert.equal(got?.note.guardSentence, 'slower than usual');
});

test('one event never sees another event\'s reading', () => {
  publishEncoderHealth('S89EV-A', reading);
  assert.equal(readEncoderHealth('S89EV-B'), null);
});

test('clearing leaves nothing behind for the strip to render', () => {
  publishEncoderHealth('S89EV-A', reading);
  publishEncoderHealth('S89EV-A', null);
  assert.equal(readEncoderHealth('S89EV-A'), null);
});

test('subscribers are told, and stop being told once they leave', () => {
  let heard = 0;
  const off = subscribeEncoderHealth(() => {
    heard += 1;
  });
  publishEncoderHealth('S89EV-A', reading);
  assert.equal(heard, 1);
  off();
  publishEncoderHealth('S89EV-A', reading);
  assert.equal(heard, 1);
});
