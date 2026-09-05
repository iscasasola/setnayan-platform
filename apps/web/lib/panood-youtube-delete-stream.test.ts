/**
 * S8 — deleteYoutubeStream (lib/panood-youtube.ts). The durable half of the
 * stream-key threat model: invalidate the YouTube liveStream's key on
 * YouTube's side the moment a broadcast ends, independent of the claim-nonce
 * handoff. See lib/live-studio-encoder-claims.ts's module docblock.
 *
 * Fetch-mocking pattern mirrors lib/live-studio-recordings.test.ts's coverage
 * of the same file's fetchYoutubeVideoArchives. The dynamic `import()` (rather
 * than a static one) is required here too: panood-youtube.ts carries
 * `import 'server-only'`, which node:test's plain module resolution can't
 * satisfy outside a Next.js build, so each test loads it defensively and
 * skips itself if that fails — covered by typecheck instead in that case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function loadDeleteYoutubeStream(): Promise<
  typeof import('./panood-youtube').deleteYoutubeStream | null
> {
  try {
    const mod = await import('./panood-youtube');
    return mod.deleteYoutubeStream;
  } catch {
    return null;
  }
}

test('sends DELETE to the liveStreams endpoint with the bearer token and stream id', async (t) => {
  const deleteYoutubeStream = await loadDeleteYoutubeStream();
  if (!deleteYoutubeStream) return t.skip('server-only unresolvable under this runner');

  const realFetch = globalThis.fetch;
  let seenUrl = '';
  let seenMethod = '';
  let seenAuth = '';
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenMethod = init?.method ?? 'GET';
    seenAuth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
    return { ok: true, status: 204 } as unknown as Response;
  }) as typeof globalThis.fetch;

  try {
    await deleteYoutubeStream('tok-123', 'stream-abc');
    assert.equal(seenMethod, 'DELETE');
    assert.match(seenUrl, /[?&]id=stream-abc/);
    assert.equal(seenAuth, 'Bearer tok-123');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('treats a 404 (already deleted) as success, not an error', async (t) => {
  const deleteYoutubeStream = await loadDeleteYoutubeStream();
  if (!deleteYoutubeStream) return t.skip('server-only unresolvable under this runner');

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: false, status: 404, text: async () => '' }) as unknown as Response) as typeof globalThis.fetch;
  try {
    await assert.doesNotReject(() => deleteYoutubeStream('tok', 'gone'));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a real failure (e.g. 401/500) throws, so the best-effort caller can catch and ignore it deliberately', async (t) => {
  const deleteYoutubeStream = await loadDeleteYoutubeStream();
  if (!deleteYoutubeStream) return t.skip('server-only unresolvable under this runner');

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: false, status: 500, text: async () => 'server error' }) as unknown as Response) as typeof globalThis.fetch;
  try {
    await assert.rejects(() => deleteYoutubeStream('tok', 'stream-x'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
