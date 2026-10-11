/**
 * abort-after.test.ts — a browser request that gives up, and says why it
 * stopped. (lib/abort-after.ts has the story.)
 *
 * BEHAVIOUR (an injected clock, a real AbortController, a fetch that — like the
 * real one — rejects with `AbortError` the moment its signal aborts):
 *   1 · the limit passes → the request is aborted, and `ranOut()` is true;
 *   2 · the request answers first → `clear()` disarms it; nothing aborts later;
 *   3 · the CALLER aborts (a newer search) → `ranOut()` stays false — the two
 *       aborts are told apart, which is the whole point.
 * WIRING (the find-seat name search, read from its source):
 *   4 · it arms the limit on its own controller, clears it in `finally` (after
 *       the body is read), and a timed-out lookup takes the existing "failed"
 *       state — the "try again" line — while a superseded one stays silent.
 *
 * ── Caveats ────────────────────────────────────────────────────────────────
 *   · No browser runs here: that a phone's real `fetch` rejects on abort mid-
 *     body, and what 15 s of "Looking…" feels like on a venue network, need a
 *     real phone with the signal pulled.
 *   · The limit covers the name search only. Other guest-side fetches
 *     (the service worker's network-first fetch, the ticket image) were not
 *     touched in this piece.
 *
 * Sabotage (2026-10-11): `ranOut` never set → § 1 red; the name search's catch
 * back to `!== 'AbortError'` alone → § 4 red; `limit.clear()` removed → § 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { abortAfter } from '@/lib/abort-after';
import { stripComments } from '@/lib/strip-comments';

function clock() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  return {
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (id: unknown) => {
      (id as { cleared: boolean }).cleared = true;
    },
    pass: (ms: number) => {
      for (const t of timers) if (!t.cleared && t.ms <= ms) (t.cleared = true), t.fn();
    },
  };
}

/** A request that never answers, and — like `fetch` — rejects with AbortError when its signal aborts. */
function hangingFetch(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
}

test('1 · the limit passes → aborted, and it knows the time ran out', async () => {
  const c = clock();
  const ctrl = new AbortController();
  const limit = abortAfter(ctrl, 15_000, c);
  const request = hangingFetch(ctrl.signal);
  c.pass(14_999);
  assert.equal(ctrl.signal.aborted, false, 'the request was given up on before its limit');
  c.pass(15_000);
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(limit.ranOut(), true, 'a timed-out request looks like a superseded one — it would fail in silence');
});

test('2 · the request answers first → clear() disarms the limit', () => {
  const c = clock();
  const ctrl = new AbortController();
  const limit = abortAfter(ctrl, 15_000, c);
  limit.clear();
  c.pass(60_000);
  assert.equal(ctrl.signal.aborted, false, 'a finished request\'s controller was aborted later');
  assert.equal(limit.ranOut(), false);
});

test('3 · the caller aborts (a newer search) → not a time-out', async () => {
  const c = clock();
  const ctrl = new AbortController();
  const limit = abortAfter(ctrl, 15_000, c);
  const request = hangingFetch(ctrl.signal);
  ctrl.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(limit.ranOut(), false, 'a superseded search would be reported as a failure');
});

test('4 · the find-seat name search arms the limit, clears it, and says "try again" when it runs out', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/find-seat/_components/name-search.tsx'), 'utf8'));
  const run = src.slice(src.indexOf('const runSearch = useCallback('), src.indexOf('useDayOfLiveTick(eventDate'));
  assert.ok(run.length > 200, 'anti-vacuity: runSearch moved');
  assert.match(run, /const limit = abortAfter\(ctrl, SEAT_LOOKUP_LIMIT_MS\);/, 'the lookup has no time limit');
  assert.match(run, /fetch\(\s*`\/api\/seat-lookup\/[^`]*`,\s*\{ signal: ctrl\.signal, headers \},?\s*\)/, 'the lookup is not sent on the controller the limit aborts');
  assert.match(
    run,
    /if \(\(\(err as Error\)\.name !== 'AbortError' \|\| limit\.ranOut\(\)\) && !quiet\) setOutcome\(\{ kind: 'failed' \}\);/,
    'a lookup that ran out of time is treated as superseded — "Looking…" ends and nothing is said',
  );
  assert.match(run, /\} finally \{\s*limit\.clear\(\);/, 'the limit is not cleared when the lookup ends');
  // …after the body is read: the clear is in `finally`, and the json read is inside the same try.
  assert.ok(run.indexOf('await res.json()') > -1 && run.indexOf('await res.json()') < run.indexOf('} finally {'));
  const ms = Number(/export const SEAT_LOOKUP_LIMIT_MS = ([\d_]+);/.exec(src)?.[1]?.replace(/_/g, ''));
  assert.ok(ms >= 8_000 && ms <= 20_000, `a limit of ${ms} ms would cut off a slow lookup, or leave a guest waiting too long`);
  // The words it lands on are the ones already there.
  assert.ok(src.includes('We couldn’t check just now. Your seat is fine — try again in a moment.'));
});
