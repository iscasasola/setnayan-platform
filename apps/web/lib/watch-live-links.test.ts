/**
 * Pure-logic spec for the dual-stream watch reduction (lib/watch-live-links.ts).
 *
 * This is the seam the public event page renders from, so these cases ARE the
 * "what shows on the wedding page" contract:
 *   YouTube only → today's behaviour unchanged · both → both links ·
 *   Facebook only → link, no embed · neither → nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveWatchLinks } from './watch-live-links';

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YT_EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0';
const FB = 'https://www.facebook.com/watch/?v=1234567890123456';

test('YouTube only — unchanged from the single-stream behaviour', () => {
  const out = resolveWatchLinks({ youtubeWatchUrl: YT, facebookWatchUrl: null });
  assert.deepEqual(out, { embedUrl: YT_EMBED, watchUrl: YT, facebookUrl: null });
});

test('both set — the embed plus BOTH link-outs', () => {
  const out = resolveWatchLinks({ youtubeWatchUrl: YT, facebookWatchUrl: FB });
  assert.deepEqual(out, { embedUrl: YT_EMBED, watchUrl: YT, facebookUrl: FB });
});

test('Facebook only — a link, and deliberately NO embed', () => {
  // facebook.com is absent from next.config.ts frame-src on purpose; the only
  // Meta embed would drop Meta cookies on a public wedding page.
  const out = resolveWatchLinks({ youtubeWatchUrl: null, facebookWatchUrl: FB });
  assert.deepEqual(out, { embedUrl: null, watchUrl: null, facebookUrl: FB });
});

test('neither set — null, so the caller renders nothing (today’s behaviour)', () => {
  assert.equal(resolveWatchLinks({ youtubeWatchUrl: null, facebookWatchUrl: null }), null);
  assert.equal(resolveWatchLinks({}), null);
  assert.equal(resolveWatchLinks({ youtubeWatchUrl: '', facebookWatchUrl: '' }), null);
});

test('a non-canonical stored value is re-normalized on read, not echoed', () => {
  const out = resolveWatchLinks({
    youtubeWatchUrl: 'youtu.be/dQw4w9WgXcQ?si=share-junk',
    facebookWatchUrl: 'facebook.com/watch?v=1234567890123456&mibextid=junk',
  });
  assert.deepEqual(out, { embedUrl: YT_EMBED, watchUrl: YT, facebookUrl: FB });
});

test('a FORGED stored value renders nothing — the PostgREST PATCH is neutralised', () => {
  // events UPDATE RLS is ROW-level and the anon key is public, so a host can
  // write anything into either column. Re-validating on read is what makes that
  // pointless: a hostile value degrades to "no link", never to a rendered href.
  const hostile = resolveWatchLinks({
    youtubeWatchUrl: 'javascript:alert(1)//watch?v=dQw4w9WgXcQ',
    facebookWatchUrl: 'https://facebook.com.evil.example/watch/?v=1234567890123456',
  });
  assert.equal(hostile, null);

  // …and one poisoned side must not take the healthy side down with it.
  const halfHostile = resolveWatchLinks({
    youtubeWatchUrl: YT,
    facebookWatchUrl: 'https://evil.example/watch/?v=1234567890123456',
  });
  assert.deepEqual(halfHostile, { embedUrl: YT_EMBED, watchUrl: YT, facebookUrl: null });
});
