/**
 * maker-refresh.test.ts — ⚡ ONE REFRESH PER BURST OF PICKS, AFTER THE LAST SAVE.
 *
 * Owner, 2026-09-28: *"picking something takes a lot of time before the
 * website reacts"*. Every pick used to cost TWO whole-Maker renders (the
 * action's own `revalidatePath` render, thrown away, then `router.refresh()`),
 * and quick taps raced: the refresh for tap 1 landed while tap 3 was on the
 * canvas, so the canvas hold saw a mismatch and reloaded. `lib/maker-refresh.ts`
 * refreshes ONCE, after every save in flight has landed. Driven here with a
 * fake clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAKER_REFRESH_COALESCE_MS, createMakerRefresher } from './maker-refresh';

function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    set: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clear: (t: unknown) => void timers.delete(t as number),
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && timers.has(id)) {
          timers.delete(id);
          t.fn();
        }
      }
    },
  };
}

/** A save the test resolves by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const tick = () => new Promise((r) => setImmediate(r));

test('three quick taps: ONE refresh, and only after the LAST save has landed', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  const refresh = () => void (refreshes += 1);
  const saves = [deferred<{ ok: boolean }>(), deferred<{ ok: boolean }>(), deferred<{ ok: boolean }>()];
  const runs = saves.map((d) => r.save(() => d.promise, refresh));
  assert.equal(r.inFlight(), 3);

  saves[0]!.resolve({ ok: true });
  await tick();
  clock.advance(MAKER_REFRESH_COALESCE_MS * 5);
  assert.equal(refreshes, 0, 'tap 1 landed but taps 2 and 3 are still in flight — no refresh yet');

  saves[1]!.resolve({ ok: true });
  saves[2]!.resolve({ ok: true });
  await Promise.all(runs);
  assert.equal(r.inFlight(), 0);
  clock.advance(MAKER_REFRESH_COALESCE_MS - 1);
  assert.equal(refreshes, 0, 'waits a beat for another tap');
  clock.advance(1);
  assert.equal(refreshes, 1, 'exactly one refresh for the burst');
  clock.advance(10_000);
  assert.equal(refreshes, 1);
});

test('a tap during the beat extends the burst — still one refresh', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  await r.save(async () => ({ ok: true }), () => void (refreshes += 1));
  clock.advance(MAKER_REFRESH_COALESCE_MS / 2);
  const later = deferred<{ ok: boolean }>();
  const run = r.save(() => later.promise, () => void (refreshes += 1));
  clock.advance(MAKER_REFRESH_COALESCE_MS * 3);
  assert.equal(refreshes, 0, 'the first beat was cancelled by the second tap');
  later.resolve({ ok: true });
  await run;
  clock.advance(MAKER_REFRESH_COALESCE_MS);
  assert.equal(refreshes, 1);
});

test('a refused save owes no refresh; a burst with one success still refreshes once', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  const refresh = () => void (refreshes += 1);
  await r.save(async () => ({ ok: false }), refresh);
  clock.advance(1_000);
  assert.equal(refreshes, 0, 'nothing changed on the server');
  await Promise.all([r.save(async () => ({ ok: false }), refresh), r.save(async () => ({ ok: true }), refresh)]);
  clock.advance(1_000);
  assert.equal(refreshes, 1);
});

test('a save that throws still leaves the count honest, and the error reaches the caller', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  await assert.rejects(r.save(async () => Promise.reject(new Error('network')), () => {}));
  assert.equal(r.inFlight(), 0);
});
