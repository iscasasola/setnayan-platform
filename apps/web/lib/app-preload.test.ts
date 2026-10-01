/**
 * ⚡ THE ONE PRELOAD QUEUE (`lib/app-preload.ts`) KEEPS ITS PROMISES.
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT
 * AFTER IT OPENS"): never block or delay the first paint; skipped under
 * Save-Data; every tool preloaded; the progress line full only when all are.
 * Driven with a fake environment — the page's load and its idle moments are
 * handed out by the test, one at a time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreloader, preloadFraction, type PreloadEnv, type PreloadJob, type PreloadProgress } from './app-preload';

function fakeEnv(saveData = false) {
  const loads: Array<() => void> = [];
  const idles: Array<() => void> = [];
  const env: PreloadEnv = { saveData, afterLoad: (cb) => loads.push(cb), whenIdle: (cb) => idles.push(cb) };
  return {
    env,
    load: () => loads.splice(0).forEach((cb) => cb()),
    idleCount: () => idles.length,
    /** Give the queue one idle moment, then let the job's promise settle. */
    async idle() {
      const cb = idles.shift();
      assert.ok(cb, 'the queue asked for no idle moment');
      cb();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

function jobs(keys: string[], calls: string[], fail: string[] = []): PreloadJob[] {
  return keys.map((key) => ({
    key,
    load: () => {
      calls.push(key);
      return fail.includes(key) ? Promise.reject(new Error(`${key} failed`)) : Promise.resolve();
    },
  }));
}

test('nothing runs before the page has loaded, and each job waits for its own idle moment, one at a time', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  createPreloader(f.env).preload(jobs(['a', 'b', 'c'], calls));
  assert.deepEqual(calls, [], 'a job ran before the page had loaded');
  assert.equal(f.idleCount(), 0);
  f.load();
  assert.equal(f.idleCount(), 1, 'more than one job was waiting for idle at once');
  assert.deepEqual(calls, [], 'a job ran without waiting for idle');
  await f.idle();
  assert.deepEqual(calls, ['a']);
  await f.idle();
  await f.idle();
  assert.deepEqual(calls, ['a', 'b', 'c'], 'every job ran, in order');
  assert.equal(f.idleCount(), 0);
});

test('Save-Data: nothing is queued, nothing loads, no progress is reported (the line stays hidden)', async () => {
  const f = fakeEnv(true);
  const calls: string[] = [];
  const seen: PreloadProgress[] = [];
  createPreloader(f.env).preload(jobs(['a', 'b'], calls), { onProgress: (p) => seen.push(p) });
  f.load();
  assert.equal(f.idleCount(), 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(seen, [], 'progress was reported under Save-Data — the line would show');
});

test('progress fills only when every job has loaded; a failure leaves it short and is asked again later', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const q = createPreloader(f.env);
  const seen: PreloadProgress[] = [];
  q.preload(jobs(['a', 'b', 'c'], calls, ['b']), { onProgress: (p) => seen.push(p) });
  f.load();
  await f.idle();
  await f.idle();
  await f.idle();
  const last = seen.at(-1)!;
  assert.deepEqual(last, { loaded: 2, total: 3, finished: true });
  assert.ok(seen.every((p) => preloadFraction(p) < 1), 'the line reached 100% with a tool missing');
  // A later caller asks for the failed one again; the loaded ones are not re-fetched.
  const again: PreloadProgress[] = [];
  q.preload(jobs(['a', 'b', 'c'], calls), { onProgress: (p) => again.push(p) });
  f.load();
  await f.idle();
  assert.deepEqual(calls, ['a', 'b', 'c', 'b'], 'loaded jobs were fetched twice, or the failed one was not retried');
  assert.deepEqual(again.at(-1), { loaded: 3, total: 3, finished: true });
  assert.equal(preloadFraction(again.at(-1)!), 1);
});

test('two callers share one queue: a key is loaded once, and `first` goes ahead of what is waiting', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const q = createPreloader(f.env);
  q.preload(jobs(['route:/home', 'route:/guests', 'maker:details'], calls));
  q.preload(jobs(['maker:details', 'maker:schedule'], calls), { first: true });
  f.load();
  for (let i = 0; i < 4; i++) await f.idle();
  assert.deepEqual(calls, ['maker:details', 'maker:schedule', 'route:/home', 'route:/guests'], 'the Maker’s tools did not go first, or one was loaded twice');
  assert.equal(f.idleCount(), 0);
});

test('a job that throws synchronously is a failure, not a stuck queue', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const q = createPreloader(f.env);
  q.preload([{ key: 'boom', load: () => { throw new Error('sync'); } }, ...jobs(['after'], calls)]);
  f.load();
  await f.idle();
  await f.idle();
  assert.deepEqual(calls, ['after']);
});
