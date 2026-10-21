/**
 * lib/tab-return.ts — the three shapes that replace a socket where nothing is live, driven on a fake clock and a
 * fake tab (no DOM). What each test holds:
 *
 *   · a FAILED read changes nothing — `null` and a throw never reach `onValue`, so a badge's real count is never
 *     replaced by a false 0 (the repo rule: a failure must never render as emptiness);
 *   · a hidden tab asks nothing; coming back asks at once, and focus + visibility firing together ask ONCE;
 *   · a live channel is let go only after the tab has been hidden `hiddenMs`, and opened again on return — after the
 *     old one has finished leaving.
 *
 * Sabotage (2026-10-21, each on lib/tab-return.ts, restored by `git checkout`): see the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onTabReturn, pauseWhileHidden, startCountPoll, type TabEnv } from './tab-return';

function fakeTab() {
  let t = 0;
  let visible = true;
  const wakes = new Set<() => void>();
  const vis = new Set<() => void>();
  const timers: { at: number; cb: () => void; every?: number; id: number }[] = [];
  let nextId = 1;
  const env: TabEnv = {
    isVisible: () => visible,
    onWake: (cb) => {
      wakes.add(cb);
      return () => wakes.delete(cb);
    },
    onVisibility: (cb) => {
      vis.add(cb);
      return () => vis.delete(cb);
    },
    now: () => t,
    setInterval: (cb, ms) => {
      const id = nextId++;
      timers.push({ at: t + ms, cb, every: ms, id });
      return id;
    },
    clearInterval: (h) => {
      const i = timers.findIndex((x) => x.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timers.push({ at: t + ms, cb, id });
      return id;
    },
    clearTimeout: (h) => {
      const i = timers.findIndex((x) => x.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  const advance = async (ms: number) => {
    const end = t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      t = next.at;
      if (next.every) next.at += next.every;
      else timers.shift();
      next.cb();
      await flush();
    }
    t = end;
    await flush();
  };
  const setVisible = async (v: boolean) => {
    visible = v;
    vis.forEach((cb) => cb());
    if (v) wakes.forEach((cb) => cb());
    await flush();
  };
  const wake = async () => {
    wakes.forEach((cb) => cb());
    await flush();
  };
  return { env, advance, setVisible, wake };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

test('a failed read changes nothing — null and a throw never reach the badge', async () => {
  const tab = fakeTab();
  const answers: Array<number | null | Error> = [4, null, new Error('refused'), 2];
  const seen: number[] = [];
  const stop = startCountPoll({
    read: async () => {
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return a ?? null;
    },
    onValue: (n) => seen.push(n),
    intervalMs: 60_000,
    env: tab.env,
  });
  await tab.advance(60_000 * 4);
  assert.deepEqual(seen, [4, 2], 'a refused read must leave the drawn count alone — never a 0 in its place');
  stop();
});

test('the first ask waits — the server render that seeded the count has only just read it', async () => {
  const tab = fakeTab();
  let reads = 0;
  const stop = startCountPoll({ read: async () => (reads += 1), onValue: () => {}, intervalMs: 60_000, env: tab.env });
  await tab.advance(59_000);
  assert.equal(reads, 0);
  await tab.advance(1_000);
  assert.equal(reads, 1);
  stop();
});

test('a hidden tab asks nothing; coming back asks at once, and once', async () => {
  const tab = fakeTab();
  let reads = 0;
  const stop = startCountPoll({ read: async () => (reads += 1), onValue: () => {}, intervalMs: 60_000, minGapMs: 10_000, env: tab.env });
  await tab.setVisible(false);
  await tab.advance(10 * 60_000);
  assert.equal(reads, 0, 'a background tab polled — every hidden tab asks the database once a minute for nothing');
  await tab.setVisible(true); // visibilitychange + focus land together…
  await tab.wake();
  await tab.wake();
  assert.equal(reads, 1, 'coming back must ask exactly once, however many wake events fire together');
  stop();
  await tab.advance(10 * 60_000);
  assert.equal(reads, 1, 'stop() must end the timer and the listeners');
});

test('onTabReturn re-reads on return, at most once per gap, never while hidden', async () => {
  const tab = fakeTab();
  let calls = 0;
  const stop = onTabReturn(() => (calls += 1), { minGapMs: 30_000, env: tab.env });
  await tab.wake();
  assert.equal(calls, 0, 'a return right after mount is not a new look');
  await tab.advance(31_000);
  await tab.wake();
  await tab.wake();
  assert.equal(calls, 1);
  await tab.setVisible(false);
  await tab.advance(60_000);
  await tab.wake();
  assert.equal(calls, 1, 'a hidden tab must not refresh');
  await tab.setVisible(true);
  assert.equal(calls, 2);
  stop();
});

test('a live channel is let go after the tab is hidden long enough, and opened again on return', async () => {
  const tab = fakeTab();
  let opens = 0;
  let closes = 0;
  let release: () => void = () => {};
  const stop = pauseWhileHidden(
    () => {
      opens += 1;
      return () => {
        closes += 1;
        return new Promise<void>((r) => (release = r));
      };
    },
    { hiddenMs: 30_000, env: tab.env },
  );
  assert.equal(opens, 1, 'the channel opens at mount');

  await tab.setVisible(false);
  await tab.advance(30_000);
  await tab.setVisible(true);
  await tab.advance(60_000);
  assert.equal(closes, 0, 'a short look away must not drop a live channel');

  await tab.setVisible(false);
  await tab.advance(30_000);
  assert.equal(closes, 1, 'a tab hidden 30 s must let its channel go');
  await tab.advance(10 * 60_000);
  assert.equal(closes, 1);

  await tab.setVisible(true);
  assert.equal(opens, 1, 'it must not reopen while the old channel is still leaving (same topic)');
  release();
  await tab.advance(0);
  assert.equal(opens, 2, 'coming back must open the channel again — that re-subscribe is what re-reads');

  stop();
  assert.equal(closes, 2, 'unmount closes the open channel');
  await tab.setVisible(false);
  await tab.advance(60_000);
  await tab.setVisible(true);
  assert.equal(opens, 2, 'nothing reopens after stop()');
});
