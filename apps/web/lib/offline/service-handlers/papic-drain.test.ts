/**
 * papic-drain invariants (Node built-in test runner, run via tsx —
 * `pnpm test:unit`).
 *
 * Covers the browser-free pieces of the Papic offline queue drain (Group A ·
 * PR A1): terminal-vs-infra error classification (decides whether a failed
 * capture is persisted), the deliverCapture integration (a queued clip/photo
 * replays through the shipped seat delivery), and duration preservation (a
 * queued 5-second clip must record with its real length — the sink's `record`
 * dep arity drops durationMs, so buildSeatSinkDeps closes over it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPapicTerminalError,
  buildSeatSinkDeps,
  drainPapicCaptureWith,
  drainGuestCaptureWith,
  type PapicSeatQueuePayload,
  type PapicGuestQueuePayload,
  type GuestPostResult,
} from './papic-drain';

function payload(overrides: Partial<PapicSeatQueuePayload> = {}): PapicSeatQueuePayload {
  return {
    seat_token: 'seat-tok-1',
    seat_index: 207,
    kind: 'photo',
    content_type: 'image/jpeg',
    captured_at_ms: 1_760_000_000_000,
    bytes: new Uint8Array([1, 2, 3, 4]).buffer,
    ...overrides,
  };
}

test('isPapicTerminalError: server rejections are terminal, infra failures are not', () => {
  for (const code of ['not_your_seat', 'revoked', 'capture_window_closed', 'awaiting_payment']) {
    assert.equal(isPapicTerminalError(code), true, `${code} should be terminal`);
  }
  for (const code of ['presign', 'put', 'network', '', undefined]) {
    assert.equal(isPapicTerminalError(code), false, `${String(code)} should be retryable`);
  }
});

test('drainPapicCaptureWith: a queued photo replays presign → put → record', async () => {
  const recorded: Array<{ r2Ref: string; kind: 'photo' | 'clip'; poster?: string }> = [];
  const puts: string[] = [];
  const deps = {
    presign: async () => ({ uploadUrl: 'https://r2/put', r2Ref: 'r2://photo-1' }),
    put: async (url: string) => {
      puts.push(url);
      return true;
    },
    record: async (r2Ref: string, kind: 'photo' | 'clip', posterR2Ref?: string) => {
      recorded.push({ r2Ref, kind, poster: posterR2Ref });
      return { ok: true as const, count: 1 };
    },
  };

  const result = await drainPapicCaptureWith(deps, payload(), new Uint8Array([1, 2, 3, 4]));

  assert.deepEqual(result, { ok: true });
  assert.equal(recorded.length, 1);
  const [photoRecord] = recorded;
  assert.ok(photoRecord);
  assert.equal(photoRecord.kind, 'photo');
  assert.equal(photoRecord.r2Ref, 'r2://photo-1');
  assert.equal(puts.length, 1); // photo: one PUT, no poster leg
});

test('drainPapicCaptureWith: an infra failure (presign returns null) does NOT record', async () => {
  let recordCalls = 0;
  const deps = {
    presign: async () => null, // R2 / network down
    put: async () => true,
    record: async () => {
      recordCalls += 1;
      return { ok: true as const, count: 1 };
    },
  };

  const result = await drainPapicCaptureWith(deps, payload(), new Uint8Array([1, 2, 3, 4]));

  assert.equal(result.ok, false);
  assert.equal(recordCalls, 0);
});

test('buildSeatSinkDeps: a clip records with its real durationMs (not dropped)', async () => {
  const recordArgs: Array<{
    token: string;
    kind: 'photo' | 'clip';
    poster?: string;
    durationMs?: number;
  }> = [];

  const deps = buildSeatSinkDeps(
    'seat-tok-9',
    5_000,
    async (token, _r2Ref, kind, posterR2Ref, durationMs) => {
      recordArgs.push({ token, kind, poster: posterR2Ref, durationMs });
      return { ok: true as const, count: 1, photoId: 'PHO-1' };
    },
    async () => null, // poster extractor unused here
  );

  // The sink calls deps.record(r2Ref, kind, posterR2Ref?) — no duration arg.
  await deps.record('r2://clip-1', 'clip', 'r2://poster-1');

  assert.equal(recordArgs.length, 1);
  const [clipRecord] = recordArgs;
  assert.ok(clipRecord);
  assert.equal(clipRecord.token, 'seat-tok-9');
  assert.equal(clipRecord.kind, 'clip');
  assert.equal(clipRecord.poster, 'r2://poster-1');
  assert.equal(clipRecord.durationMs, 5_000); // preserved via the closure
});

// ── guest drain ────────────────────────────────────────────────────────────

function guestPayload(overrides: Partial<PapicGuestQueuePayload> = {}): PapicGuestQueuePayload {
  return {
    mode: 'guest',
    media_type: 'photo',
    content_type: 'image/jpeg',
    filename: 'papic-1.jpg',
    bytes: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    captured_at_ms: 1_760_000_000_000,
    ...overrides,
  };
}

test('drainGuestCaptureWith: a queued clip re-POSTs the full multipart form', async () => {
  let seen: FormData | null = null;
  const post = async (form: FormData): Promise<GuestPostResult> => {
    seen = form;
    return { ok: true, status: 200, body: { status: 'ok' } };
  };

  const result = await drainGuestCaptureWith(
    post,
    guestPayload({
      media_type: 'clip',
      content_type: 'video/mp4',
      filename: 'papic-1.mp4',
      duration_ms: 5_000,
      share_publicly: true,
      poster_bytes: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
      poster_filename: 'papic-1-poster.jpg',
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.ok(seen);
  const form = seen as FormData;
  assert.equal(form.get('media_type'), 'clip');
  assert.equal(form.get('duration_ms'), '5000');
  assert.equal(form.get('share_publicly'), '1');
  assert.ok(form.get('file'));
  assert.ok(form.get('poster'));
});

test('drainGuestCaptureWith: a terminal state (quota_exhausted) resolves the item (dequeue)', async () => {
  const post = async (): Promise<GuestPostResult> => ({
    ok: false,
    status: 409,
    body: { status: 'quota_exhausted' },
  });
  const result = await drainGuestCaptureWith(post, guestPayload());
  assert.deepEqual(result, { ok: true }); // dropped, not retried forever
});

test('drainGuestCaptureWith: a 5xx is kept for retry; a network throw is kept', async () => {
  const serverError = await drainGuestCaptureWith(
    async () => ({ ok: false, status: 502, body: null }),
    guestPayload(),
  );
  assert.equal(serverError.ok, false);

  const networkError = await drainGuestCaptureWith(async () => {
    throw new Error('offline');
  }, guestPayload());
  assert.deepEqual(networkError, { ok: false, error: 'network' });
});
