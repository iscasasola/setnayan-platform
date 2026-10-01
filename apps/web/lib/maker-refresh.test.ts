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
import { MAKER_REFRESH_COALESCE_MS, MAKER_WRITE_BEAT_MS, SUPERSEDED, createLatestWriter, createMakerRefresher } from './maker-refresh';

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

/* ═══ ⚡ SPEED FIRST (owner 2026-09-30): a pick the bridge drew re-renders nothing ═══ */

test('a HELD save — the bridge drew it — owes no refresh, however many land', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  const refresh = () => void (refreshes += 1);
  for (let i = 0; i < 5; i++) await r.save(async () => ({ ok: true }), refresh, undefined, true);
  clock.advance(60_000);
  assert.equal(refreshes, 0, 'a drawn pick asked the whole Maker to re-render');
  assert.equal(r.inFlight(), 0);
});

test('a held burst that the bridge could not draw all of (needRender) ends in exactly ONE refresh', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  const refresh = () => void (refreshes += 1);
  const a = deferred<{ ok: boolean }>();
  const run = r.save(() => a.promise, refresh, undefined, true);
  r.needRender();
  clock.advance(MAKER_REFRESH_COALESCE_MS * 3);
  assert.equal(refreshes, 0, 'never while the save is still on its way');
  a.resolve({ ok: true });
  await run;
  clock.advance(MAKER_REFRESH_COALESCE_MS);
  assert.equal(refreshes, 1);
  clock.advance(60_000);
  assert.equal(refreshes, 1);
});

test('an UNHELD save in a held burst still refreshes once — the bridge did not draw it', async () => {
  const clock = fakeClock();
  const r = createMakerRefresher(clock);
  let refreshes = 0;
  const refresh = () => void (refreshes += 1);
  await Promise.all([r.save(async () => ({ ok: true }), refresh, undefined, true), r.save(async () => ({ ok: true }), refresh)]);
  clock.advance(MAKER_REFRESH_COALESCE_MS);
  assert.equal(refreshes, 1);
});

test('five quick − / + taps are ONE write — the latest canvas; the four before it are SUPERSEDED', async () => {
  const clock = fakeClock();
  const w = createLatestWriter(clock);
  const sent: number[] = [];
  const results = [1, 2, 3, 4, 5].map((n) => {
    const p = w.write('canvas:hero', async () => {
      sent.push(n);
      return { ok: true, n };
    });
    clock.advance(MAKER_WRITE_BEAT_MS - 100);
    return p;
  });
  assert.deepEqual(sent, [], 'nothing is sent while the taps keep coming');
  assert.equal(w.pending('canvas:hero'), 1);
  clock.advance(100);
  const out = await Promise.all(results);
  assert.deepEqual(sent, [5], 'one write, carrying the last tap');
  assert.deepEqual(out.slice(0, 4), [SUPERSEDED, SUPERSEDED, SUPERSEDED, SUPERSEDED]);
  assert.deepEqual(out[4], { ok: true, n: 5 });
  assert.equal(w.pending(), 0);
});

test('a pick made while a write flies waits for it, then goes — never two writes for one scene at once', async () => {
  const clock = fakeClock();
  const w = createLatestWriter(clock);
  const first = deferred<{ ok: boolean }>();
  let flying = 0;
  let most = 0;
  const send = (d: Promise<{ ok: boolean }>) => async () => {
    flying += 1;
    most = Math.max(most, flying);
    try {
      return await d;
    } finally {
      flying -= 1;
    }
  };
  const a = w.write('canvas:hero', send(first.promise));
  clock.advance(MAKER_WRITE_BEAT_MS);
  assert.equal(flying, 1);
  const b = w.write('canvas:hero', send(Promise.resolve({ ok: true })));
  clock.advance(MAKER_WRITE_BEAT_MS * 4);
  assert.equal(flying, 1, 'the second write waited for the first');
  assert.equal(w.pending('canvas:hero'), 2);
  first.resolve({ ok: true });
  assert.deepEqual(await a, { ok: true });
  assert.deepEqual(await b, { ok: true });
  assert.equal(most, 1);
  assert.equal(w.pending(), 0);
});

test('two scenes never fold into one write', async () => {
  const clock = fakeClock();
  const w = createLatestWriter(clock);
  const sent: string[] = [];
  const a = w.write('canvas:hero', async () => void sent.push('hero'));
  const b = w.write('canvas:schedule', async () => void sent.push('schedule'));
  clock.advance(MAKER_WRITE_BEAT_MS);
  await Promise.all([a, b]);
  assert.deepEqual(sent.sort(), ['hero', 'schedule']);
});

test('flush sends every waiting pick NOW — a write that must follow them (Apply, a form) lands after them', async () => {
  const clock = fakeClock();
  const w = createLatestWriter(clock);
  const sent: string[] = [];
  const a = w.write('canvas:hero', async () => void sent.push('hero'));
  w.flush();
  assert.deepEqual(sent, ['hero'], 'sent in the same tick as the flush, before anything queued after it');
  await a;
  clock.advance(MAKER_WRITE_BEAT_MS * 2);
  assert.deepEqual(sent, ['hero'], 'and not sent twice');
});

test('a write that throws rejects its waiter and frees the scene for the next pick', async () => {
  const clock = fakeClock();
  const w = createLatestWriter(clock);
  const a = w.write('canvas:hero', async () => Promise.reject(new Error('network')));
  clock.advance(MAKER_WRITE_BEAT_MS);
  await assert.rejects(a);
  assert.equal(w.pending(), 0);
  const b = w.write('canvas:hero', async () => ({ ok: true }));
  clock.advance(MAKER_WRITE_BEAT_MS);
  assert.deepEqual(await b, { ok: true });
});
