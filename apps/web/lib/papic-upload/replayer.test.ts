/**
 * The save-first replayer, driven end to end against a fake server and a fake
 * R2 — the whole loop the browser runs, without a browser.
 *
 * Owner 2026-10-23: "each phone can shoot continuously while uploading online
 * works on the background". Proven here:
 *   • ten photos and two clips taken OFFLINE are all kept on the phone;
 *   • on reconnect every one lands — once (no duplicate row, no double spend),
 *     even when the answer to a record is lost and the record is replayed;
 *   • every thumbnail goes up before any display copy, every display copy
 *     before any original;
 *   • a shot refused for credits stays on the phone, visibly, and lands after
 *     a top-up; a shot refused for good is dropped and counted;
 *   • the chip never says "All saved" while anything waits.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PapicUploader, type UploaderDeps, type NewShot } from './replayer';
import { chipLabel, type QueuedShot } from './schedule';
import type { LocalPiece } from './store';
import type { CaptureLane, CaptureTier } from './tiers';
import { recordBody, signBody, attachBody } from './lanes';

const CCID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function memoryStore() {
  const shots = new Map<string, QueuedShot>();
  const blobs = new Map<string, Blob>();
  return {
    shots,
    blobs,
    async saveShot(s: QueuedShot) {
      shots.set(s.id, structuredClone(s));
    },
    async saveBlob(s: { id: string }, p: LocalPiece, b: Blob) {
      blobs.set(`${s.id}:${p}`, b);
    },
    async loadBlob(id: string, p: LocalPiece) {
      return blobs.get(`${id}:${p}`) ?? null;
    },
    async deleteBlob(id: string, p: LocalPiece) {
      blobs.delete(`${id}:${p}`);
    },
    async deleteShot(s: { id: string }, pieces: readonly LocalPiece[]) {
      for (const p of pieces) blobs.delete(`${s.id}:${p}`);
      shots.delete(s.id);
    },
    async loadShots() {
      return [...shots.values()];
    },
  };
}

/** A server with the capture routes' rules, and an R2 that records every PUT. */
function fakeServer() {
  const st = {
    online: false,
    credits: Infinity as number,
    closed: false,
    staged: new Map<string, number>(), // `${ccid}:${tier}` → size
    rows: new Map<string, { tiers: Set<CaptureTier> }>(),
    recordCalls: 0,
    rowsCreated: 0,
    putLog: [] as string[], // tiers in PUT order
    loseNextRecordAnswer: new Set<string>(),
  };
  const call = async (_lane: CaptureLane, body: Record<string, unknown>) => {
    if (!st.online) return { httpStatus: 0, body: null };
    const id = String(body.client_capture_id);
    const row = st.rows.get(id);
    if (body.op === 'sign') {
      const tier = body.tier as CaptureTier;
      if (!row && st.closed) return { httpStatus: 403, body: { error: 'guest_capture_closed' } };
      if (!row && st.credits <= 0) return { httpStatus: 409, body: { status: 'camera_points_exhausted' } };
      if (row && (tier === 'thumb' || tier === 'poster' || tier === 'clip_web')) {
        return { httpStatus: 200, body: { status: 'ok', already: true } };
      }
      return { httpStatus: 200, body: { status: 'ok', uploadUrl: `r2://${id}:${tier}:${body.size_bytes}` } };
    }
    if (body.op === 'record') {
      st.recordCalls += 1;
      if (row) return { httpStatus: 200, body: { status: 'ok', duplicate: true, captureId: `cap-${id}`, wantFull: true } };
      const first = body.media_type === 'clip' ? ['poster'] : ['thumb'];
      const missing = first.filter((t) => !st.staged.has(`${id}:${t}`));
      if (missing.length) return { httpStatus: 409, body: { error: 'object_missing', missing } };
      if (st.credits <= 0) return { httpStatus: 409, body: { status: 'camera_points_exhausted' } };
      st.credits -= 1;
      st.rows.set(id, { tiers: new Set(first as CaptureTier[]) });
      st.rowsCreated += 1;
      if (st.loseNextRecordAnswer.delete(id)) return { httpStatus: 0, body: null }; // landed, answer lost
      return { httpStatus: 200, body: { status: 'ok', captureId: `cap-${id}`, wantFull: true, remaining: st.credits } };
    }
    if (body.op === 'attach') {
      if (!row) return { httpStatus: 409, body: { error: 'not_recorded_yet' } };
      for (const t of body.tiers as CaptureTier[]) {
        if (!st.staged.has(`${id}:${t}`)) return { httpStatus: 409, body: { error: 'object_missing', missing: [t] } };
        row.tiers.add(t);
      }
      return { httpStatus: 200, body: { status: 'ok' } };
    }
    return { httpStatus: 400, body: { error: 'bad_request' } };
  };
  const transport = {
    name: 'fake',
    async put(req: { url: string; body: Blob }) {
      if (!st.online) return { ok: false as const, status: null };
      const [id, tier, size] = req.url.replace('r2://', '').split(':');
      assert.equal(Number(size), req.body.size, 'the PUT carries exactly the signed size');
      st.staged.set(`${id}:${tier}`, req.body.size);
      st.putLog.push(tier!);
      return { ok: true as const };
    },
  };
  return { st, call, transport };
}

function harness() {
  const store = memoryStore();
  const server = fakeServer();
  let clock = 1_000_000;
  const deps: UploaderDeps = {
    store,
    transport: () => server.transport,
    call: server.call,
    bodies: { sign: signBody, record: recordBody, attach: attachBody },
    prepare: {
      photoPieces: async (o) => ({
        thumb: new Blob([new Uint8Array(30)], { type: 'image/webp' }),
        tile: new Blob([new Uint8Array(80)], { type: 'image/webp' }),
        display: new Blob([new Uint8Array(300)], { type: 'image/webp' }),
        ...(o.size === 0 ? {} : {}),
      }),
      poster: async () => new Blob([new Uint8Array(200)], { type: 'image/webp' }),
      clipWeb: async () => new Blob([new Uint8Array(500)], { type: 'video/mp4' }),
      faceVectors: async () => ({ vectors: [], subjectCenter: null }),
    },
    now: () => clock,
    random: () => 0.5,
    fullAllowed: () => true,
    online: () => server.st.online,
    setTimer: () => null,
    clearTimer: () => {},
  };
  const u = new PapicUploader(deps);
  const settle = async (rounds = 400) => {
    for (let i = 0; i < rounds; i++) {
      clock += 10_000;
      u.wake();
      for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r));
      if (u.pending() === 0) return;
    }
  };
  return { u, store, server, settle, tick: () => clock };
}

const photo = (n: number): NewShot => ({
  id: CCID(n),
  lane: 'guest',
  eventId: 'ev-1',
  media: 'photo',
  capturedAtMs: 1000 + n,
  primary: new Blob([new Uint8Array(2000)], { type: 'image/jpeg' }),
});
const clip = (n: number): NewShot => ({
  id: CCID(n),
  lane: 'guest',
  eventId: 'ev-1',
  media: 'clip',
  capturedAtMs: 1000 + n,
  durationMs: 8000,
  // ≥ 6 MB, the size the old route could never take.
  primary: new Blob([new Uint8Array(6_500_000)], { type: 'video/mp4' }),
  poster: new Blob([new Uint8Array(900)], { type: 'image/jpeg' }),
});

test('offline: 10 photos + 2 clips are all kept on the phone, and the shutter never waits on the network', async () => {
  const { u, store, server } = harness();
  server.st.online = false;
  for (let i = 1; i <= 10; i++) await u.addShot(photo(i));
  await u.addShot(clip(11));
  await u.addShot(clip(12));
  for (let k = 0; k < 50; k++) await new Promise((r) => setImmediate(r));
  assert.equal(u.pending(), 12);
  assert.equal(store.shots.size, 12, 'every shot is in IndexedDB');
  assert.equal(server.st.rowsCreated, 0);
  assert.equal(chipLabel(u.snapshot().chip), 'Offline · 12 waiting');
});

test('reconnect: every shot lands exactly once — even when a record answer is lost', async () => {
  const { u, store, server, settle } = harness();
  for (let i = 1; i <= 10; i++) await u.addShot(photo(i));
  await u.addShot(clip(11));
  await u.addShot(clip(12));
  server.st.loseNextRecordAnswer.add(CCID(3));
  server.st.loseNextRecordAnswer.add(CCID(11));
  server.st.online = true;
  await settle();
  assert.equal(u.pending(), 0, 'nothing left waiting');
  assert.equal(server.st.rowsCreated, 12, 'twelve shots, twelve rows');
  assert.equal(server.st.rows.size, 12, 'no duplicate row');
  assert.ok(server.st.recordCalls >= 14, 'the two lost answers were replayed');
  assert.equal(store.shots.size, 0, 'the phone keeps nothing it has sent');
  assert.equal(store.blobs.size, 0, 'no bytes left behind');
  for (let i = 1; i <= 10; i++) {
    const t = server.st.rows.get(CCID(i))!.tiers;
    assert.ok(t.has('thumb') && t.has('display') && t.has('tile') && t.has('original'), `photo ${i} complete`);
  }
  assert.equal(chipLabel(u.snapshot().chip), 'All saved');
});

test('order: every first piece before any display copy, every display copy before any original', async () => {
  const { u, server, settle } = harness();
  for (let i = 1; i <= 6; i++) await u.addShot(photo(i));
  server.st.online = true;
  await settle();
  const log = server.st.putLog;
  const lastThumb = log.lastIndexOf('thumb');
  const firstDisplay = Math.min(log.indexOf('display'), log.indexOf('tile'));
  const lastDisplay = Math.max(log.lastIndexOf('display'), log.lastIndexOf('tile'));
  const firstOriginal = log.indexOf('original');
  assert.ok(lastThumb < firstDisplay, `a display copy went before a thumbnail: ${log.join(',')}`);
  assert.ok(lastDisplay < firstOriginal, `an original went before a display copy: ${log.join(',')}`);
});

test('credits: a refused shot stays on the phone, says so, and lands after a top-up', async () => {
  const { u, server, settle } = harness();
  server.st.online = true;
  server.st.credits = 2;
  for (let i = 1; i <= 4; i++) await u.addShot(photo(i));
  await settle(30);
  assert.equal(server.st.rowsCreated, 2);
  assert.equal(u.pending(), 2, 'the two over the limit are kept');
  assert.equal(chipLabel(u.snapshot().chip), 'Credits ran out · 2 not sent');
  server.st.credits = 10; // the host topped up
  await settle();
  assert.equal(server.st.rowsCreated, 4);
  assert.equal(u.pending(), 0);
});

test('a refusal for good drops the shot and is counted, never shown as saved', async () => {
  const { u, server, settle } = harness();
  server.st.online = true;
  server.st.closed = true;
  await u.addShot(photo(1));
  await settle(10);
  assert.equal(u.pending(), 0);
  assert.equal(server.st.rowsCreated, 0);
  assert.equal(chipLabel(u.snapshot().chip), '1 not saved');
});
