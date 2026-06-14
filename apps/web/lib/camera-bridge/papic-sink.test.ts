/**
 * deliverCapture poster-leg invariants (Node built-in test runner, run via
 * tsx — `pnpm test:unit`).
 *
 * Guards the CLIP path of the always-on NSFW screen: a clip ships one poster
 * JPEG (extracted client-side) so the image-only classifier can screen the
 * video by proxy. The locked failure policy: the poster leg is STRICTLY
 * best-effort — no poster failure may ever lose or block a capture (the clip
 * then simply stays 'unscreened', which guest surfaces exclude).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deliverCapture,
  posterUploadMeta,
  captureUploadMeta,
  type PapicSinkDeps,
  type PresignRequest,
} from './papic-sink';
import type { CapturedFile } from './types';

function makeClip(overrides: Partial<CapturedFile> = {}): CapturedFile {
  return {
    kind: 'clip',
    bytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: 'video/webm',
    capturedAtMs: 1_760_000_000_000,
    durationMs: 5_000,
    pairedCameraBrand: null,
    pairedCameraModel: null,
    ...overrides,
  };
}

function makeStill(): CapturedFile {
  return { ...makeClip(), kind: 'still', mimeType: 'image/jpeg', durationMs: undefined };
}

type RecordCall = { r2Ref: string; kind: 'photo' | 'clip'; posterR2Ref?: string };

/** Happy-path deps that log every call; tweak per test. */
function makeDeps(overrides: Partial<PapicSinkDeps> = {}) {
  const presigns: PresignRequest[] = [];
  const puts: { uploadUrl: string; contentType: string; byteLength: number }[] = [];
  const records: RecordCall[] = [];
  const deps: PapicSinkDeps = {
    presign: async (req) => {
      presigns.push(req);
      return {
        uploadUrl: `https://r2.example/${req.filename}`,
        r2Ref: `r2://media/papic/${req.filename}`,
      };
    },
    put: async (uploadUrl, bytes, contentType) => {
      puts.push({ uploadUrl, contentType, byteLength: bytes.byteLength });
      return true;
    },
    record: async (r2Ref, kind, posterR2Ref) => {
      records.push({ r2Ref, kind, posterR2Ref });
      return { ok: true, count: records.length };
    },
    ...overrides,
  };
  return { deps, presigns, puts, records };
}

test('clip with a working poster extractor records posterR2Ref', async () => {
  const { deps, presigns, puts, records } = makeDeps({
    extractPoster: async () => new Uint8Array([9, 9, 9]),
  });
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 2 });
  assert.equal(result.ok, true);
  // Two presigns: the clip, then the poster (image/jpeg, -poster.jpg name).
  assert.equal(presigns.length, 2);
  assert.equal(presigns[1]!.contentType, 'image/jpeg');
  assert.match(presigns[1]!.filename, /-poster\.jpg$/);
  assert.equal(presigns[1]!.sizeBytes, 3);
  // Two PUTs (clip bytes, poster bytes).
  assert.equal(puts.length, 2);
  assert.equal(puts[1]!.contentType, 'image/jpeg');
  // The record carries the poster ref alongside the clip ref.
  assert.equal(records.length, 1);
  assert.equal(records[0]!.kind, 'clip');
  assert.match(records[0]!.posterR2Ref ?? '', /-poster\.jpg$/);
  assert.notEqual(records[0]!.posterR2Ref, records[0]!.r2Ref);
});

test('poster extraction returning null still delivers the clip (no poster)', async () => {
  const { deps, presigns, records } = makeDeps({ extractPoster: async () => null });
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(presigns.length, 1); // no poster presign
  assert.equal(records[0]!.posterR2Ref, undefined);
});

test('poster extraction THROWING still delivers the clip (fail-open)', async () => {
  const { deps, records } = makeDeps({
    extractPoster: async () => {
      throw new Error('decoder exploded');
    },
  });
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(records[0]!.posterR2Ref, undefined);
});

test('poster presign failure still delivers the clip (fail-open)', async () => {
  let presignCount = 0;
  const base = makeDeps({ extractPoster: async () => new Uint8Array([1]) });
  const deps: PapicSinkDeps = {
    ...base.deps,
    presign: async (req) => {
      presignCount += 1;
      if (presignCount > 1) return null; // clip presign works, poster presign fails
      return base.deps.presign(req);
    },
  };
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(base.records[0]!.posterR2Ref, undefined);
});

test('poster PUT failure still delivers the clip (fail-open)', async () => {
  let putCount = 0;
  const base = makeDeps({ extractPoster: async () => new Uint8Array([1]) });
  const deps: PapicSinkDeps = {
    ...base.deps,
    put: async (uploadUrl, bytes, contentType) => {
      putCount += 1;
      if (putCount > 1) return false; // clip PUT works, poster PUT fails
      return base.deps.put(uploadUrl, bytes, contentType);
    },
  };
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(base.records[0]!.posterR2Ref, undefined);
});

test('stills never invoke the poster extractor', async () => {
  let extracted = 0;
  const { deps, presigns, records } = makeDeps({
    extractPoster: async () => {
      extracted += 1;
      return new Uint8Array([1]);
    },
  });
  const result = await deliverCapture(deps, makeStill(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(extracted, 0);
  assert.equal(presigns.length, 1);
  assert.equal(records[0]!.kind, 'photo');
  assert.equal(records[0]!.posterR2Ref, undefined);
});

test('clip without an extractPoster dep delivers normally (backwards compatible)', async () => {
  const { deps, records } = makeDeps(); // no extractPoster
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.equal(result.ok, true);
  assert.equal(records[0]!.posterR2Ref, undefined);
});

test('clip-leg presign failure queues and never reaches the poster leg', async () => {
  let extracted = 0;
  const { deps, records } = makeDeps({
    presign: async () => null,
    extractPoster: async () => {
      extracted += 1;
      return new Uint8Array([1]);
    },
    enqueueOffline: async () => true,
  });
  const result = await deliverCapture(deps, makeClip(), { seatIndex: 1 });
  assert.deepEqual(result, { ok: false, error: 'presign_failed', queued: true });
  assert.equal(extracted, 0);
  assert.equal(records.length, 0);
});

test('posterUploadMeta derives a -poster.jpg JPEG next to the clip name', () => {
  const clip = makeClip({ capturedAtMs: 42 });
  assert.deepEqual(posterUploadMeta(clip), {
    filename: 'bridge-42-poster.jpg',
    contentType: 'image/jpeg',
  });
  // Sits beside the clip's own name (same capturedAtMs stem).
  assert.equal(captureUploadMeta(clip).filename, 'bridge-42.webm');
});
