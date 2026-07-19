/**
 * papic-vendor-drain invariants (Node built-in test runner, run via tsx —
 * `pnpm test:unit`).
 *
 * Covers the browser-free pieces of the VENDOR on-the-day offline queue
 * (recon vendor-papic#offline): terminal-vs-infra error classification
 * (decides whether a failed capture is queued vs rolled back), the multipart
 * replay (a queued clip re-POSTs the identical form the live controller
 * sends, consent attestation included), terminal-resolution (a capture that
 * can never land is dropped, not retried to the TTL), and the per-event
 * backlog cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPapicVendorTerminalError,
  drainVendorCaptureWith,
  hasVendorQueueRoom,
  VENDOR_OFFLINE_QUEUE_MAX,
  type PapicVendorQueuePayload,
  type VendorPostResult,
} from './papic-vendor-drain';

function vendorPayload(
  overrides: Partial<PapicVendorQueuePayload> = {},
): PapicVendorQueuePayload {
  return {
    mode: 'vendor',
    event_id: 'S89E-EVENT00001',
    media_type: 'photo',
    content_type: 'image/jpeg',
    filename: 'photo.jpg',
    bytes: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    captured_at_ms: 1_760_000_000_000,
    ...overrides,
  };
}

test('isPapicVendorTerminalError: server rejections are terminal, infra failures are not', () => {
  for (const code of [
    'out_of_points',
    'video_not_allowed',
    'consent_required',
    'not_allowed',
    'no_vendor',
    'disabled',
    'too_long',
    'too_large',
  ]) {
    assert.equal(isPapicVendorTerminalError(code), true, `${code} should be terminal`);
  }
  // no_session is NOT terminal — the vendor can sign back in and the queued
  // re-POST then succeeds; 5xx codes + network are retryable infra.
  for (const code of [
    'no_session',
    'upload_failed',
    'record_failed',
    'uploads_unavailable',
    'network',
    '',
    undefined,
  ]) {
    assert.equal(isPapicVendorTerminalError(code), false, `${String(code)} should be retryable`);
  }
});

test('drainVendorCaptureWith: a queued clip re-POSTs the full multipart form (consent attested)', async () => {
  let seen: FormData | null = null;
  const post = async (form: FormData): Promise<VendorPostResult> => {
    seen = form;
    return { ok: true, status: 200, body: { status: 'ok' } };
  };

  const result = await drainVendorCaptureWith(
    post,
    vendorPayload({
      media_type: 'clip',
      content_type: 'video/mp4',
      filename: 'clip.mp4',
      duration_ms: 5_000,
      device_model: 'test-agent',
      poster_bytes: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
      poster_filename: 'poster.jpg',
    }),
  );

  assert.deepEqual(result, { ok: true });
  assert.ok(seen);
  const form = seen as FormData;
  assert.equal(form.get('event_id'), 'S89E-EVENT00001');
  assert.equal(form.get('media_type'), 'clip');
  assert.equal(form.get('consent'), '1'); // faithful replay of the attested capture
  assert.equal(form.get('duration_ms'), '5000');
  assert.equal(form.get('device_model'), 'test-agent');
  assert.ok(form.get('file'));
  assert.ok(form.get('poster'));
});

test('drainVendorCaptureWith: a photo never sends clip-only fields', async () => {
  let seen: FormData | null = null;
  const post = async (form: FormData): Promise<VendorPostResult> => {
    seen = form;
    return { ok: true, status: 200, body: { status: 'ok' } };
  };

  await drainVendorCaptureWith(
    post,
    vendorPayload({
      // a stray poster/duration on a photo payload must not leak into the form
      duration_ms: 4_000,
      poster_bytes: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
    }),
  );

  const form = seen as unknown as FormData;
  assert.equal(form.get('media_type'), 'photo');
  assert.equal(form.get('duration_ms'), null);
  assert.equal(form.get('poster'), null);
});

test('drainVendorCaptureWith: a terminal rejection (out_of_points) resolves the item (dequeue)', async () => {
  const post = async (): Promise<VendorPostResult> => ({
    ok: false,
    status: 409,
    body: { error: 'out_of_points' },
  });
  const result = await drainVendorCaptureWith(post, vendorPayload());
  assert.deepEqual(result, { ok: true }); // dropped, not retried forever
});

test('drainVendorCaptureWith: the closed counsel gate (disabled) resolves the item', async () => {
  const post = async (): Promise<VendorPostResult> => ({
    ok: false,
    status: 403,
    body: { error: 'disabled' },
  });
  const result = await drainVendorCaptureWith(post, vendorPayload());
  assert.deepEqual(result, { ok: true }); // never hold guest PI against a closed gate
});

test('drainVendorCaptureWith: a 5xx is kept for retry; a network throw is kept; no_session is kept', async () => {
  const serverError = await drainVendorCaptureWith(
    async () => ({ ok: false, status: 502, body: { error: 'upload_failed' } }),
    vendorPayload(),
  );
  assert.equal(serverError.ok, false);

  const networkError = await drainVendorCaptureWith(async () => {
    throw new Error('offline');
  }, vendorPayload());
  assert.deepEqual(networkError, { ok: false, error: 'network' });

  const signedOut = await drainVendorCaptureWith(
    async () => ({ ok: false, status: 401, body: { error: 'no_session' } }),
    vendorPayload(),
  );
  assert.deepEqual(signedOut, { ok: false, error: 'no_session' }); // retries after re-login
});

test('hasVendorQueueRoom: the per-event backlog cap is a hard boundary', () => {
  assert.equal(hasVendorQueueRoom(0), true);
  assert.equal(hasVendorQueueRoom(VENDOR_OFFLINE_QUEUE_MAX - 1), true);
  assert.equal(hasVendorQueueRoom(VENDOR_OFFLINE_QUEUE_MAX), false);
  assert.equal(hasVendorQueueRoom(VENDOR_OFFLINE_QUEUE_MAX + 5), false);
});
