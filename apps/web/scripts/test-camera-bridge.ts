/**
 * scripts/test-camera-bridge.ts — unit suite for the Camera Bridge core
 * (lib/camera-bridge: protocol types + MockBridge + DslrPairing FSM).
 *
 * Run: pnpm exec tsx scripts/test-camera-bridge.ts   (from apps/web)
 *
 * Deterministic: a virtual scheduler drives all timing — no real timers, no
 * hardware, no network. House pattern: plain node:assert + tsx (same as the
 * seating collision suite), no test-runner dependency.
 */

import assert from 'node:assert/strict';

import { MockBridge } from '../lib/camera-bridge/mock-bridge';
import {
  DslrPairingController,
  resetBridgeSlots,
} from '../lib/camera-bridge/pairing-fsm';
import { deliverCapture } from '../lib/camera-bridge/papic-sink';
import { syncOneWith } from '../lib/offline/service-handlers/camera-bridge-handler';
import {
  BridgeError,
  BridgeSlotBusyError,
  PAPIC_CLIP_DURATION_MS,
  type BridgeScheduler,
  type Unsubscribe,
} from '../lib/camera-bridge/types';

// ── virtual clock ───────────────────────────────────────────────────────────

class VirtualScheduler implements BridgeScheduler {
  private t = 0;
  private tasks: { due: number; fn: () => void; id: number }[] = [];
  private nextId = 1;

  now(): number {
    return this.t;
  }

  schedule(fn: () => void, delayMs: number): Unsubscribe {
    const id = this.nextId++;
    this.tasks.push({ due: this.t + delayMs, fn, id });
    return () => {
      this.tasks = this.tasks.filter((task) => task.id !== id);
    };
  }

  /** Advance virtual time, firing due tasks in order; drain microtasks after. */
  async advance(ms: number): Promise<void> {
    const target = this.t + ms;
    for (;;) {
      const next = this.tasks
        .filter((task) => task.due <= target)
        .sort((a, b) => a.due - b.due)[0];
      if (!next) break;
      this.t = next.due;
      this.tasks = this.tasks.filter((task) => task.id !== next.id);
      next.fn();
      await drain();
    }
    this.t = target;
    await drain();
  }
}

async function drain(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function isBridgeError(code: BridgeError['code']): (e: unknown) => boolean {
  return (e: unknown) => e instanceof BridgeError && e.code === code;
}

// ── tiny harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  resetBridgeSlots();
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

function makeRig(surface: 'papic' | 'patiktok' | 'panood', opts?: { failConnects?: number }) {
  const clock = new VirtualScheduler();
  const primary = new MockBridge({
    brand: 'canon',
    model: 'EOS R6 Mark II',
    now: () => clock.now(),
    failConnects: opts?.failConnects,
  });
  const fallback = new MockBridge({ brand: 'internal', model: 'Phone sensor', now: () => clock.now() });
  const ctl = new DslrPairingController({
    primary,
    fallback,
    surface,
    phoneId: 'phone-1',
    scheduler: clock,
  });
  return { clock, primary, fallback, ctl };
}

// ── suite ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('camera-bridge core test suite\n');

  // T1 — MockBridge protocol conformance
  await test('mock: connect → live, capability download, model populated', async () => {
    const m = new MockBridge();
    assert.equal(m.status, 'disconnected');
    await m.connect();
    assert.equal(m.status, 'live');
    assert.ok(m.capabilities);
    assert.equal(m.model, 'Mock EOS (CI)');
  });

  await test('mock: triggerStill returns a JPEG with brand stamping', async () => {
    const m = new MockBridge({ brand: 'canon', model: 'EOS R8' });
    await m.connect();
    const f = await m.triggerStill();
    assert.equal(f.kind, 'still');
    assert.equal(f.mimeType, 'image/jpeg');
    assert.equal(f.bytes[0], 0xff); // JPEG magic
    assert.equal(f.bytes[1], 0xd8);
    assert.equal(f.pairedCameraBrand, 'canon');
    assert.equal(f.pairedCameraModel, 'EOS R8');
  });

  await test('mock: capture before connect throws not_connected', async () => {
    const m = new MockBridge();
    await assert.rejects(() => m.triggerStill(), isBridgeError('not_connected'));
  });

  await test(`mock: clip cap — ${PAPIC_CLIP_DURATION_MS}ms ok, beyond rejected (locked 5s rule)`, async () => {
    const m = new MockBridge();
    await m.connect();
    const ok = await m.triggerClip({ durationMs: PAPIC_CLIP_DURATION_MS });
    assert.equal(ok.durationMs, PAPIC_CLIP_DURATION_MS);
    assert.equal(m.status, 'live', 'returns to live after the clip');
    await assert.rejects(
      () => m.triggerClip({ durationMs: PAPIC_CLIP_DURATION_MS + 1 }),
      isBridgeError('invalid_argument'),
    );
    await assert.rejects(() => m.triggerClip({ durationMs: 0 }), isBridgeError('invalid_argument'));
  });

  await test('mock: livePreview yields frames while live, terminates on drop', async () => {
    const m = new MockBridge();
    await m.connect();
    const frames: number[] = [];
    for await (const fr of m.livePreview()) {
      frames.push(fr.sequence);
      assert.equal(fr.widthPx, 1280);
      assert.equal(fr.heightPx, 720);
      if (frames.length === 5) m.dropConnection();
      if (frames.length > 50) break; // safety net: must terminate long before
    }
    assert.ok(
      frames.length >= 5 && frames.length <= 7,
      `stream ended at the drop (got ${frames.length} frames)`,
    );
  });

  await test('mock: setFocusPoint validates the normalized 0..1 range', async () => {
    const m = new MockBridge();
    await m.connect();
    await m.setFocusPoint({ x: 0.5, y: 0.5 });
    await assert.rejects(() => m.setFocusPoint({ x: 1.5, y: 0 }), isBridgeError('invalid_argument'));
  });

  // T2 — FSM happy path
  await test('fsm: start → pairing → live; captures route to the primary', async () => {
    const { ctl, primary } = makeRig('papic');
    await ctl.start();
    assert.equal(ctl.getState(), 'live');
    const f = await ctl.captureStill();
    assert.equal(f.pairedCameraBrand, 'canon');
    assert.equal(f.pairedCameraModel, 'EOS R6 Mark II');
    assert.equal(primary.stillCount, 1);
    const reasons = ctl.getTransitions().map((t) => t.reason);
    assert.deepEqual(reasons, ['start', 'pair_success']);
    await ctl.stop();
  });

  // T3 — drop → immediate fallback (≤ the locked 3s bar), shutter keeps firing
  await test('fsm: drop with reconnect blocked → fallback immediately; gap-captures stamped null', async () => {
    const { clock, primary, fallback, ctl } = makeRig('papic');
    await ctl.start();
    assert.equal(ctl.getState(), 'live');

    primary.blockConnects();
    primary.dropConnection();
    await clock.advance(0);
    assert.equal(ctl.getState(), 'fallback', 'switched at the drop instant (within the 3s SLA)');

    const gap = await ctl.captureStill();
    assert.equal(gap.pairedCameraBrand, null, 'gap-capture stamped paired_camera_brand=null');
    assert.equal(gap.pairedCameraModel, null);
    assert.equal(fallback.stillCount, 1);
    assert.ok(ctl.getTransitions().some((t) => t.reason === 'primary_dropped'));
    await ctl.stop();
  });

  // T4 — auto-retry cadence + recovery
  await test('fsm: auto-retry every 5s; primary recovery returns state to live', async () => {
    const { clock, primary, ctl } = makeRig('papic');
    await ctl.start();
    const attemptsAfterStart = primary.connectAttempts;

    primary.blockConnects();
    primary.dropConnection();
    await clock.advance(0); // one immediate reconnect attempt (fails)
    assert.equal(ctl.getState(), 'fallback');
    const attemptsAfterDrop = primary.connectAttempts;
    assert.equal(attemptsAfterDrop, attemptsAfterStart + 1, 'one immediate reconnect attempt');

    await clock.advance(5000); // retry tick #1 (fails)
    assert.ok(primary.connectAttempts >= attemptsAfterDrop + 1, 'retry fired at the 5s cadence');
    assert.equal(ctl.getState(), 'fallback');

    primary.allowConnects();
    await clock.advance(5000); // retry tick #2 → succeeds
    assert.equal(ctl.getState(), 'live');
    const back = await ctl.captureStill();
    assert.equal(back.pairedCameraBrand, 'canon', 'captures route back to the DSLR');
    await ctl.stop();
  });

  // T5 — patiktok seam semantics
  await test('fsm[patiktok]: mid-take drop keeps the take — one seam, two segments, zero loss', async () => {
    const { clock, primary, ctl } = makeRig('patiktok');
    await ctl.start();

    ctl.beginTake();
    assert.equal(ctl.getState(), 'recording');
    await clock.advance(2000);

    primary.blockConnects();
    primary.dropConnection();
    await clock.advance(0);
    assert.equal(ctl.getState(), 'fallback');

    await clock.advance(1500);
    const take = ctl.endTake();
    assert.equal(take.seamMarkers.length, 1, 'exactly one seam');
    assert.equal(take.segments.length, 2, 'primary segment + fallback segment');
    assert.equal(take.segments[0]?.brand, 'canon');
    assert.equal(take.segments[0]?.endMs, 2000);
    assert.equal(take.segments[1]?.brand, 'internal');
    assert.equal(take.endMs - take.startMs, 3500, 'the take was never lost across the swap');
    assert.equal(take.seamMarkers[0]?.fromBrand, 'canon');
    assert.equal(take.seamMarkers[0]?.toBrand, 'internal');
    await ctl.stop();
  });

  await test('fsm[patiktok]: primary recovery mid-take defers the swap-back (no second seam)', async () => {
    const { clock, primary, ctl } = makeRig('patiktok');
    await ctl.start();
    ctl.beginTake();

    primary.failConnectsNext(1); // the immediate reconnect attempt fails…
    primary.dropConnection();
    await clock.advance(0);
    assert.equal(ctl.getState(), 'fallback');
    await clock.advance(5000); // …the 5s retry succeeds mid-take
    assert.equal(primary.status, 'live', 'primary reconnected');
    assert.equal(ctl.getState(), 'fallback', 'no mid-take swap-back (would add a 2nd seam)');

    const take = ctl.endTake();
    assert.equal(take.seamMarkers.length, 1, 'still exactly one seam');
    assert.equal(ctl.getState(), 'live', 'swapped back the moment the take ended');
    await ctl.stop();
  });

  // T6 — panood continuity
  await test('fsm[panood]: drop emits maintain-stream-continuity at the swap instant (zero grace)', async () => {
    const { clock, primary, ctl } = makeRig('panood');
    await ctl.start();
    await clock.advance(60_000);

    primary.blockConnects();
    primary.dropConnection();
    await clock.advance(0);

    const events = ctl.getContinuityEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.action, 'maintain-stream-continuity');
    assert.equal(events[0]?.atMs, 60_000, 'continuity demanded at the drop instant');
    assert.equal(ctl.getState(), 'fallback');
    await ctl.stop();
  });

  // T7 — 1:1 guard
  await test('fsm: 1-phone:1-DSLR guard — second pairing on the same phone throws; freed on stop', async () => {
    const clock = new VirtualScheduler();
    const mk = () =>
      new DslrPairingController({
        primary: new MockBridge({ now: () => clock.now() }),
        fallback: new MockBridge({ brand: 'internal', now: () => clock.now() }),
        surface: 'papic',
        phoneId: 'same-phone',
        scheduler: clock,
      });
    const a = mk();
    const b = mk();
    await a.start();
    await assert.rejects(() => b.start(), (e: unknown) => e instanceof BridgeSlotBusyError);
    await a.stop();
    await b.start(); // slot freed by stop()
    await b.stop();
  });

  await test('fsm: different phones pair concurrently (the guard is per-phone)', async () => {
    const clock = new VirtualScheduler();
    const mk = (phoneId: string) =>
      new DslrPairingController({
        primary: new MockBridge({ now: () => clock.now() }),
        fallback: new MockBridge({ brand: 'internal', now: () => clock.now() }),
        surface: 'papic',
        phoneId,
        scheduler: clock,
      });
    const a = mk('phone-A');
    const b = mk('phone-B');
    await a.start();
    await b.start();
    assert.equal(a.getState(), 'live');
    assert.equal(b.getState(), 'live');
    await a.stop();
    await b.stop();
  });

  // T8 — initial pair failure: the shutter never blocks, retry recovers
  await test('fsm: failed first pair stays pairing, serves captures via the phone, recovers on retry', async () => {
    const { clock, primary, fallback, ctl } = makeRig('papic', { failConnects: 2 });
    await ctl.start();
    assert.equal(ctl.getState(), 'pairing');

    // The paparazzo can shoot while pairing limps — phone sensor, null stamp.
    const f = await ctl.captureStill();
    assert.equal(f.pairedCameraBrand, null);
    assert.equal(fallback.stillCount, 1);

    await clock.advance(5000); // retry #1 (injected failure again)
    assert.equal(ctl.getState(), 'pairing');
    await clock.advance(5000); // retry #2 → succeeds
    assert.equal(ctl.getState(), 'live');
    assert.ok(primary.connectAttempts >= 3);
    await ctl.stop();
  });

  // T9 — surface guard
  await test('fsm[papic]: beginTake is rejected (file surface, not a stream surface)', async () => {
    const { ctl } = makeRig('papic');
    await ctl.start();
    assert.throws(() => ctl.beginTake(), /stream-surface API/);
    await ctl.stop();
  });

  // T10 — clean stop releases everything
  await test('fsm: stop() cancels retries, disconnects, and logs the stopped transition', async () => {
    const { clock, primary, ctl } = makeRig('papic');
    await ctl.start();
    primary.blockConnects();
    primary.dropConnection();
    await clock.advance(0);
    await ctl.stop();
    assert.equal(ctl.getState(), 'disconnected');
    const attempts = primary.connectAttempts;
    await clock.advance(30_000); // any surviving retry timer would fire here
    assert.equal(primary.connectAttempts, attempts, 'no retries after stop()');
  });

  // T11 — S0 sink: delivery orchestration (deliverCapture)
  const mkFile = (kind: 'still' | 'clip' = 'still'): import('../lib/camera-bridge/types').CapturedFile => ({
    kind,
    bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
    mimeType: kind === 'clip' ? 'video/webm' : 'image/jpeg',
    capturedAtMs: 1718000000000,
    durationMs: kind === 'clip' ? 5000 : undefined,
    pairedCameraBrand: 'canon',
    pairedCameraModel: 'EOS R6 Mark II',
  });

  await test('sink: happy path — presign → put → record, correct meta', async () => {
    const calls: string[] = [];
    const result = await deliverCapture(
      {
        presign: async (req) => {
          calls.push('presign');
          assert.equal(req.pathPrefix, 'papic/seat-3');
          assert.equal(req.contentType, 'image/jpeg');
          assert.ok(req.filename.endsWith('.jpg'));
          assert.equal(req.sizeBytes, 4);
          return { uploadUrl: 'https://r2/put', r2Ref: 'r2://media/k1' };
        },
        put: async (url, bytes, ct) => {
          calls.push('put');
          assert.equal(url, 'https://r2/put');
          assert.equal(bytes.byteLength, 4);
          assert.equal(ct, 'image/jpeg');
          return true;
        },
        record: async (r2Ref, kind) => {
          calls.push('record');
          assert.equal(r2Ref, 'r2://media/k1');
          assert.equal(kind, 'photo');
          return { ok: true, count: 7 };
        },
      },
      mkFile(),
      { seatIndex: 3 },
    );
    assert.deepEqual(calls, ['presign', 'put', 'record']);
    assert.deepEqual(result, { ok: true, count: 7 });
  });

  await test('sink: clip kind maps to record(clip) + webm filename', async () => {
    const result = await deliverCapture(
      {
        presign: async (req) => {
          assert.ok(req.filename.endsWith('.webm'));
          return { uploadUrl: 'u', r2Ref: 'r' };
        },
        put: async () => true,
        record: async (_r, kind) => {
          assert.equal(kind, 'clip');
          return { ok: true, count: 1 };
        },
      },
      mkFile('clip'),
      { seatIndex: 1 },
    );
    assert.ok(result.ok);
  });

  await test('sink: presign failure → queued when a queue dep exists', async () => {
    let queuedReason = '';
    const result = await deliverCapture(
      {
        presign: async () => null,
        put: async () => true,
        record: async () => ({ ok: true, count: 0 }),
        enqueueOffline: async (_f, reason) => {
          queuedReason = reason;
          return true;
        },
      },
      mkFile(),
      { seatIndex: 1 },
    );
    assert.deepEqual(result, { ok: false, error: 'presign_failed', queued: true });
    assert.equal(queuedReason, 'presign_failed');
  });

  await test('sink: PUT failure → queued; record never called', async () => {
    let recorded = false;
    const result = await deliverCapture(
      {
        presign: async () => ({ uploadUrl: 'u', r2Ref: 'r' }),
        put: async () => false,
        record: async () => {
          recorded = true;
          return { ok: true, count: 0 };
        },
        enqueueOffline: async () => true,
      },
      mkFile(),
      { seatIndex: 1 },
    );
    assert.deepEqual(result, { ok: false, error: 'upload_failed', queued: true });
    assert.equal(recorded, false);
  });

  await test('sink: record NETWORK throw → queued (safe retry)', async () => {
    const result = await deliverCapture(
      {
        presign: async () => ({ uploadUrl: 'u', r2Ref: 'r' }),
        put: async () => true,
        record: async () => {
          throw new Error('network');
        },
        enqueueOffline: async () => true,
      },
      mkFile(),
      { seatIndex: 1 },
    );
    assert.deepEqual(result, { ok: false, error: 'record_failed', queued: true });
  });

  await test('sink: server REJECTION → error surfaced, NOT queued', async () => {
    let enqueued = false;
    const result = await deliverCapture(
      {
        presign: async () => ({ uploadUrl: 'u', r2Ref: 'r' }),
        put: async () => true,
        record: async () => ({ ok: false, error: 'not_your_seat' }),
        enqueueOffline: async () => {
          enqueued = true;
          return true;
        },
      },
      mkFile(),
      { seatIndex: 1 },
    );
    assert.deepEqual(result, { ok: false, error: 'not_your_seat', queued: false });
    assert.equal(enqueued, false, 'a rejected capture must never be queued for retry');
  });

  await test('sink: no queue dep → queued:false on infra failure', async () => {
    const result = await deliverCapture(
      { presign: async () => null, put: async () => true, record: async () => ({ ok: true, count: 0 }) },
      mkFile(),
      { seatIndex: 1 },
    );
    assert.deepEqual(result, { ok: false, error: 'presign_failed', queued: false });
  });

  // T12 — O1 offline handler (syncOneWith)
  const mkItem = (payload: Record<string, unknown>): import('../lib/offline/types').OfflineItem => ({
    item_id: 'i1',
    event_id: 'e1',
    queued_at: new Date(0).toISOString(),
    payload,
    retry_count: 0,
  });
  const validPayload = () => ({
    seat_token: 'tok',
    seat_index: 2,
    kind: 'photo',
    content_type: 'image/jpeg',
    captured_at_ms: 123,
    bytes: Uint8Array.from([1, 2, 3]).buffer as ArrayBuffer,
  });

  await test('handler: valid queued item drains through the sink → ok', async () => {
    const calls: string[] = [];
    const result = await syncOneWith(
      {
        presign: async (req) => {
          calls.push('presign');
          assert.equal(req.pathPrefix, 'papic/seat-2');
          return { uploadUrl: 'u', r2Ref: 'r' };
        },
        put: async (_u, bytes) => {
          calls.push('put');
          assert.equal(bytes.byteLength, 3);
          return true;
        },
        record: async (_r, kind) => {
          calls.push('record');
          assert.equal(kind, 'photo');
          return { ok: true, count: 4 };
        },
      },
      mkItem(validPayload()),
    );
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, ['presign', 'put', 'record']);
  });

  await test('handler: Blob bytes accepted (IndexedDB structured-clone shape)', async () => {
    const payload = { ...validPayload(), bytes: new Blob([Uint8Array.from([9, 9])], { type: 'image/jpeg' }) };
    const result = await syncOneWith(
      {
        presign: async () => ({ uploadUrl: 'u', r2Ref: 'r' }),
        put: async (_u, bytes) => {
          assert.equal(bytes.byteLength, 2);
          return true;
        },
        record: async () => ({ ok: true, count: 1 }),
      },
      mkItem(payload),
    );
    assert.deepEqual(result, { ok: true });
  });

  await test('handler: invalid payload → invalid_payload (stays queued, visible)', async () => {
    const result = await syncOneWith(
      { presign: async () => null, put: async () => false, record: async () => ({ ok: false, error: 'x' }) },
      mkItem({ seat_token: '', nope: true }),
    );
    assert.deepEqual(result, { ok: false, error: 'invalid_payload' });
  });

  await test('handler: infra failure during drain → ok:false, item stays', async () => {
    const result = await syncOneWith(
      {
        presign: async () => null,
        put: async () => true,
        record: async () => ({ ok: true, count: 0 }),
      },
      mkItem(validPayload()),
    );
    assert.deepEqual(result, { ok: false, error: 'presign_failed' });
  });

  await test('handler: server rejection → reason surfaced on last_error path', async () => {
    const result = await syncOneWith(
      {
        presign: async () => ({ uploadUrl: 'u', r2Ref: 'r' }),
        put: async () => true,
        record: async () => ({ ok: false, error: 'revoked' }),
      },
      mkItem(validPayload()),
    );
    assert.deepEqual(result, { ok: false, error: 'revoked' });
  });

  // ── results ──
  console.log(`\n${passed} passed · ${failed} failed${failed ? ` → ${failures.join(', ')}` : ''}`);
  if (failed > 0) process.exit(1);
}

void main();
