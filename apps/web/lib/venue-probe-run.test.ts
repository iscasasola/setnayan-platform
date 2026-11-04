/**
 * lib/venue-probe-run.test.ts — the venue check's test upload always ends, and measures what moved.
 *
 * Driven on a virtual clock: every wait in the runner is a timer, and the scheduler below always fires
 * the earliest one next, so 25 seconds of uploads run in milliseconds with their real ordering.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runVenueProbe, type ProbeRunEnv } from './venue-probe-run';
import { PROBE_CHUNK_BYTES, PROBE_RUN_MS, PROBE_SLOT_MS, judgeVenue } from './venue-check';

type Timer = { id: number; due: number; fn: () => void };

function virtualClock() {
  let now = 0;
  let next = 1;
  const timers: Timer[] = [];
  const pump = () => {
    if (timers.length === 0) return;
    timers.sort((a, b) => a.due - b.due || a.id - b.id);
    const t = timers.shift()!;
    now = Math.max(now, t.due);
    t.fn();
  };
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const id = next++;
      timers.push({ id, due: now + ms, fn });
      setImmediate(pump);
      return id;
    },
    clearTimeout: (id: unknown) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  };
}

type Behaviour = { ms: number; status?: number } | 'never';

/** A fake XHR whose PUT number `n` behaves as `plan(n)`. */
function fakeXhr(clock: ReturnType<typeof virtualClock>, plan: (n: number) => Behaviour) {
  let count = 0;
  const sent: { url: string; type: string | null }[] = [];
  class FakeXhr {
    status = 0;
    private listeners: Record<string, (() => void)[]> = {};
    private uploadListeners: Record<string, ((e: { lengthComputable: boolean; loaded: number }) => void)[]> = {};
    private url = '';
    private type: string | null = null;
    upload = {
      addEventListener: (k: string, fn: (e: { lengthComputable: boolean; loaded: number }) => void) => {
        (this.uploadListeners[k] ??= []).push(fn);
      },
    };
    addEventListener(k: string, fn: () => void) {
      (this.listeners[k] ??= []).push(fn);
    }
    open(_m: string, url: string) {
      this.url = url;
    }
    setRequestHeader(_k: string, v: string) {
      this.type = v;
    }
    send() {
      sent.push({ url: this.url, type: this.type });
      const b = plan(count++);
      if (b === 'never') {
        // Some bytes leave, then the connection goes silent: no event ever fires again.
        clock.setTimeout(() => this.uploadListeners.progress?.forEach((f) => f({ lengthComputable: true, loaded: 1000 })), 100);
        return;
      }
      clock.setTimeout(() => {
        this.status = b.status ?? 200;
        this.listeners.load?.forEach((f) => f());
      }, b.ms);
    }
    abort() {}
  }
  return { Xhr: FakeXhr as unknown as typeof XMLHttpRequest, sent };
}

function env(clock: ReturnType<typeof virtualClock>, Xhr: typeof XMLHttpRequest): ProbeRunEnv {
  return {
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    XMLHttpRequest: Xhr,
    fetch: (async () => {
      await new Promise<void>((r) => clock.setTimeout(r, 40));
      return { ok: true } as Response;
    }) as typeof fetch,
    makeBody: () => new Uint8Array(1),
  };
}

const TARGET = { uploadUrl: 'https://storage.example/venue-check/e/c.bin?sig', contentType: 'application/octet-stream' };

test('a healthy venue: one PUT a second to the ONE signed URL, a delay figure, a green verdict', async () => {
  const clock = virtualClock();
  const { Xhr, sent } = fakeXhr(clock, () => ({ ms: 100 }));
  const out = await runVenueProbe(TARGET, {}, env(clock, Xhr)).done;
  assert.equal(out.kind, 'measured');
  if (out.kind !== 'measured') return;
  assert.equal(out.delayMs, 40);
  assert.equal(out.samples.length, PROBE_RUN_MS / PROBE_SLOT_MS);
  assert.ok(sent.every((s) => s.url === TARGET.uploadUrl && s.type === TARGET.contentType));
  assert.ok(out.samples.every((s) => s.bytes === PROBE_CHUNK_BYTES));
  assert.equal(judgeVenue(out.samples).verdict, 'full');
  // Paced, not flooded: the run took the run's length, not 25 × 100 ms.
  assert.ok(clock.now() >= PROBE_RUN_MS - PROBE_SLOT_MS);
});

test('a PUT that goes silent forever is CUT at the deadline and measured, never awaited', async () => {
  const clock = virtualClock();
  const { Xhr } = fakeXhr(clock, (n) => (n < 3 ? { ms: 100 } : 'never'));
  const out = await runVenueProbe(TARGET, {}, env(clock, Xhr)).done;
  assert.equal(out.kind, 'measured');
  if (out.kind !== 'measured') return;
  const last = out.samples.at(-1)!;
  assert.equal(last.bytes, 1000, 'what moved before the silence is what it is measured as');
  assert.ok(clock.now() <= PROBE_RUN_MS + 300, `ended at ${clock.now()} ms — the deadline did not end it`);
  assert.equal(judgeVenue(out.samples).verdict, 'not_enough');
});

test('storage refusing the PUT is NOT a venue verdict — the run says refused', async () => {
  const clock = virtualClock();
  const { Xhr } = fakeXhr(clock, () => ({ ms: 50, status: 403 }));
  const out = await runVenueProbe(TARGET, {}, env(clock, Xhr)).done;
  assert.deepEqual(out, { kind: 'refused', status: 403 });
});

test('cancel ends the run', async () => {
  const clock = virtualClock();
  const { Xhr } = fakeXhr(clock, () => ({ ms: 100 }));
  const run = runVenueProbe(TARGET, {}, env(clock, Xhr));
  run.cancel();
  assert.deepEqual(await run.done, { kind: 'cancelled' });
});
