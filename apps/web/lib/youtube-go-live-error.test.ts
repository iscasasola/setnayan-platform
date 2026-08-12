import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGoLiveFailure } from './youtube-go-live-error';

/**
 * These fixtures are shaped like what `youtubeFetch` actually throws:
 *   `YouTube POST <url> failed: <status> <first 300 chars of Google's JSON>`
 * — including the truncation, which is why classification must not depend on the
 * body being parseable JSON.
 */
const thrown = (status: number, body: string) =>
  new Error(
    `YouTube POST https://www.googleapis.com/youtube/v3/liveBroadcasts failed: ${status} ${body}`.slice(
      0,
      300,
    ),
  );

describe('classifyGoLiveFailure — the reason survives', () => {
  test('THE LIKELY ONE: live streaming not enabled on the channel', () => {
    const f = classifyGoLiveFailure(
      thrown(403, '{"error":{"errors":[{"reason":"liveStreamingNotEnabled"}],"code":403}}'),
    );
    assert.equal(f.kind, 'live-not-enabled');
    assert.match(f.message, /24 hours/);
    // The single most important property: it must NOT send him to reconnect.
    assert.match(f.message, /will not speed it up/i);
  });

  test('a channel-level block is named as YouTube-side, not as our connection', () => {
    const f = classifyGoLiveFailure(
      thrown(403, '{"error":{"errors":[{"reason":"livePermissionBlocked"}]}}'),
    );
    assert.equal(f.kind, 'live-permission-blocked');
    assert.match(f.message, /will not change it/i);
  });

  test('quota says wait, not reconnect', () => {
    const f = classifyGoLiveFailure(thrown(403, '{"error":{"errors":[{"reason":"quotaExceeded"}]}}'));
    assert.equal(f.kind, 'quota');
    assert.match(f.message, /few minutes/);
  });

  test('ONLY a genuine auth failure tells the host to reconnect', () => {
    const f = classifyGoLiveFailure(
      thrown(401, '{"error":{"errors":[{"reason":"authError"},{"reason":"insufficientPermissions"}]}}'),
    );
    assert.equal(f.kind, 'auth');
    assert.match(f.message, /Reconnect/i);
  });

  test('reconnect is advised in EXACTLY one class — the old copy advised it always', () => {
    const kinds = ['live-not-enabled', 'live-permission-blocked', 'quota', 'auth'] as const;
    const bodies: Record<(typeof kinds)[number], string> = {
      'live-not-enabled': '{"error":{"errors":[{"reason":"liveStreamingNotEnabled"}]}}',
      'live-permission-blocked': '{"error":{"errors":[{"reason":"livePermissionBlocked"}]}}',
      quota: '{"error":{"errors":[{"reason":"quotaExceeded"}]}}',
      auth: '{"error":{"errors":[{"reason":"insufficientPermissions"}]}}',
    };
    const advises = kinds.filter((k) =>
      /reconnect the channel/i.test(classifyGoLiveFailure(thrown(403, bodies[k])).message),
    );
    assert.deepEqual(advises, ['auth']);
  });

  test('an unrecognised reason is honest rather than confidently wrong', () => {
    const f = classifyGoLiveFailure(thrown(500, '{"error":{"errors":[{"reason":"backendError"}]}}'));
    assert.equal(f.kind, 'unknown');
    // It must not invent a cause, and must not send him to reconnect.
    assert.doesNotMatch(f.message, /Reconnect the channel/i);
    assert.match(f.message, /recorded/i);
  });

  test('TRUNCATION: classification survives a body cut mid-JSON', () => {
    // youtubeFetch slices to 300 chars, so the body is regularly invalid JSON.
    // A parse-based implementation would throw and degrade everything to unknown.
    const long = `{"error":{"errors":[{"domain":"youtube.liveBroadcast","reason":"liveStreamingNotEnabled","message":"${'x'.repeat(400)}"`;
    const f = classifyGoLiveFailure(thrown(403, long));
    assert.equal(f.kind, 'live-not-enabled');
  });

  test('the raw detail is always preserved for the server log', () => {
    const e = thrown(403, '{"error":{"errors":[{"reason":"liveStreamingNotEnabled"}]}}');
    const f = classifyGoLiveFailure(e);
    assert.ok(f.detail.includes('liveStreamingNotEnabled'));
    assert.ok(f.detail.includes('403'));
  });

  test('non-Error throws do not crash the classifier', () => {
    for (const v of ['plain string', null, undefined, 42, { a: 1 }]) {
      const f = classifyGoLiveFailure(v);
      assert.ok(f.message.length > 0);
      assert.equal(typeof f.detail, 'string');
    }
  });

  test('matching is case-insensitive — Google is not consistent about casing', () => {
    assert.equal(
      classifyGoLiveFailure(thrown(403, '{"reason":"LIVESTREAMINGNOTENABLED"}')).kind,
      'live-not-enabled',
    );
  });

  test('a harmless word containing a reason substring does not misfire', () => {
    // "forbidden" is an auth reason; make sure a body that merely mentions
    // something else does not get classified as auth.
    const f = classifyGoLiveFailure(thrown(404, '{"error":{"errors":[{"reason":"notFound"}]}}'));
    assert.equal(f.kind, 'unknown');
  });
});
