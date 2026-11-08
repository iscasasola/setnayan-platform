import test from 'node:test';
import assert from 'node:assert/strict';

import { settledValue } from './settled-read';

test('a fulfilled read hands back its value', async () => {
  const [a] = await Promise.allSettled([Promise.resolve(42)]);
  assert.equal(settledValue(a!), 42);
});

test('a rejected read throws its own reason — the same object, not a wrapper', async () => {
  const boom = new Error('boom');
  const [a] = await Promise.allSettled([Promise.reject(boom)]);
  assert.throws(() => settledValue(a!), (e) => e === boom);
});

test('the first failure IN THE ORDER WRITTEN wins, even when a later read fails sooner', async () => {
  const slowFirst = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('first')), 20));
  const fastSecond = Promise.reject(new Error('second'));
  // Promise.all would surface "second" — it rejects first in time.
  await assert.rejects(Promise.all([slowFirst, fastSecond]), /second/);
  const [a, b] = await Promise.allSettled([
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('first')), 20)),
    Promise.reject(new Error('second')),
  ]);
  const seen: string[] = [];
  assert.throws(() => {
    seen.push('before a');
    settledValue(a!);
    seen.push('after a');
    settledValue(b!);
  }, /first/);
  assert.deepEqual(seen, ['before a']);
});

test('what runs between two takes still runs when only the later read failed', async () => {
  const [a, b] = await Promise.allSettled([Promise.resolve('ok'), Promise.reject(new Error('later'))]);
  const log: string[] = [];
  assert.throws(() => {
    log.push(settledValue(a!));
    log.push('logged between');
    settledValue(b!);
  }, /later/);
  assert.deepEqual(log, ['ok', 'logged between']);
});
