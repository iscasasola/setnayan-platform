/**
 * remembered-read-core.test.ts — the rule behind a remembered public read,
 * EXECUTED against a stand-in store that behaves the way Next's
 * `unstable_cache` does (read from `next/dist/server/web/spec-extension/
 * unstable-cache.js`, 15.5): a fresh entry is returned; a STALE entry is
 * returned too and refreshed behind the response; a thrown load stores nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ReadRefused, asRead, rememberWith, stableIds } from './remembered-read-core';
import { fakeSwrStore } from './remembered-read-fake-store';

function counted<T>(answer: () => T) {
  const state = { calls: 0 };
  return { state, load: async (..._args: unknown[]) => ((state.calls += 1), answer()) };
}

const OPTS = { key: 'k', tags: ['t'], softSeconds: 60, hardSeconds: 300 };

test('inside the soft age a second ask makes no call', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  const { state, load } = counted(() => ['row']);
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  assert.deepEqual(await read(), ['row']);
  clock.now += 59_000;
  assert.deepEqual(await read(), ['row']);
  assert.equal(state.calls, 1);
});

test('between the soft and the hard age the remembered rows are shown and refreshed behind', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  let version = 1;
  const { state, load } = counted(() => [`v${version}`]);
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  await read();
  version = 2;
  clock.now += 120_000;
  assert.deepEqual(await read(), ['v1'], 'the view was made to wait for the refresh');
  await fake.settle();
  assert.equal(state.calls, 2, 'the refresh behind the response did not run');
  assert.deepEqual(await read(), ['v2']);
  assert.equal(state.calls, 2);
});

test('past the hard age the remembered rows are NEVER shown — the read is asked again now', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  let version = 1;
  const { load } = counted(() => [`v${version}`]);
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  await read();
  version = 2;
  // A quiet night: nobody asked for nine hours.
  clock.now += 9 * 3600 * 1000;
  assert.deepEqual(await read(), ['v2'], "last night's rows reached the first visitor of the morning");
});

test('the hard age is measured from when the rows were READ, not from when they were last handed out', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  let version = 1;
  // The refresh fails every time after the first read, so the entry only ages.
  const load = async () => {
    if (version > 1) throw new ReadRefused('x');
    return [`v${version}`];
  };
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  await read();
  version = 2;
  for (let i = 0; i < 4; i += 1) {
    clock.now += 70_000;
    assert.deepEqual(await read(), ['v1']);
    await fake.settle();
  }
  // 280 s old and handed out four times. One more step crosses 300 s.
  clock.now += 70_000;
  await assert.rejects(read(), ReadRefused, 'rows older than the hard age were shown because they were recently handed out');
});

test('a refused read is never remembered', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  let refuse = true;
  const state = { calls: 0 };
  const load = async () => {
    state.calls += 1;
    if (refuse) throw new ReadRefused('world', { message: 'timeout' });
    return ['row'];
  };
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  await assert.rejects(read(), ReadRefused);
  assert.equal(fake.entries.size, 0, 'a refusal was stored');
  refuse = false;
  assert.deepEqual(await read(), ['row'], 'the next view did not ask again');
  assert.equal(state.calls, 2);
});

test('different arguments never share an entry', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  const read = rememberWith(fake.store, async (day: string) => [day], { ...OPTS, now: () => clock.now });
  assert.deepEqual(await read('2026-10-11'), ['2026-10-11']);
  assert.deepEqual(await read('2026-10-12'), ['2026-10-12']);
});

test('a cleared tag is a miss on the very next ask', async () => {
  const clock = { now: 1_000_000 };
  const fake = fakeSwrStore(clock);
  let version = 1;
  const { load } = counted(() => [`v${version}`]);
  const read = rememberWith(fake.store, load, { ...OPTS, now: () => clock.now });
  await read();
  version = 2;
  fake.clear();
  assert.deepEqual(await read(), ['v2']);
});

test('stableIds: one spelling for one set', () => {
  assert.deepEqual(stableIds(['b', 'a', 'b']), ['a', 'b']);
  assert.deepEqual(stableIds(['a', 'b']), stableIds(['b', 'a']));
});

test('asRead hands the caller the database’s own error, and the rows otherwise', async () => {
  const refused = await asRead(Promise.reject(new ReadRefused('world', { code: '57014' })));
  assert.deepEqual(refused, { data: null, error: { code: '57014' } });
  const bare = await asRead(Promise.reject(new ReadRefused('featuredChapters')));
  assert.ok(bare.error instanceof ReadRefused, 'a refusal with no reason became "no error"');
  assert.deepEqual(await asRead(Promise.resolve([1])), { data: [1], error: null });
});
