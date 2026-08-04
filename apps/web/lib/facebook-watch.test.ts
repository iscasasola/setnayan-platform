/**
 * Pure-logic spec for the Facebook watch-URL barrier (lib/facebook-watch.ts).
 *
 * This value ends up in an `href` on the PUBLIC wedding page, so
 * normalize-or-reject is the security contract and the reject cases below are
 * the load-bearing half of this file. Mirrors the YouTube parser's spec
 * (tests/e2e/panood-watch-math.spec.ts) case-for-case, but runs under
 * `pnpm test:unit` so it gates the main CI job rather than only the e2e run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FACEBOOK_REPLAY_WARNING, normalizeFacebookWatchUrl } from './facebook-watch';

/** apps/web/lib → apps/web */
const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ID = '1234567890123456';
const CODE = 'aBcD1234ef';

test('accepts the shapes Facebook’s own share sheet produces', () => {
  const cases: Array<[input: string, expected: string]> = [
    [`https://www.facebook.com/watch/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`https://www.facebook.com/watch?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`https://www.facebook.com/watch/live/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`https://www.facebook.com/video.php?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`https://m.facebook.com/watch/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`https://web.facebook.com/watch/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`facebook.com/watch/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [`http://www.facebook.com/watch/?v=${ID}`, `https://www.facebook.com/watch/?v=${ID}`],
    [
      `https://www.facebook.com/SetnayanPH/videos/${ID}/`,
      `https://www.facebook.com/SetnayanPH/videos/${ID}/`,
    ],
    [
      `https://www.facebook.com/SetnayanPH/videos/anna-and-ben-live/${ID}/`,
      `https://www.facebook.com/SetnayanPH/videos/${ID}/`,
    ],
    [`https://www.facebook.com/reel/${ID}`, `https://www.facebook.com/reel/${ID}/`],
    [`https://www.facebook.com/share/v/${CODE}/`, `https://www.facebook.com/share/v/${CODE}/`],
    [`https://www.facebook.com/share/r/${CODE}/`, `https://www.facebook.com/share/r/${CODE}/`],
    [`https://fb.watch/${CODE}/`, `https://fb.watch/${CODE}/`],
    [`fb.watch/${CODE}`, `https://fb.watch/${CODE}/`],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeFacebookWatchUrl(input), expected, input);
  }
});

test('strips tracking params, fragments and userinfo from the canonical form', () => {
  // The canonical value is REBUILT from validated parts, never echoed back — so
  // a query tail, a fragment, or a `user@` prefix cannot ride along into the href.
  assert.equal(
    normalizeFacebookWatchUrl(`https://www.facebook.com/watch/?v=${ID}&mibextid=junk&t=90`),
    `https://www.facebook.com/watch/?v=${ID}`,
  );
  assert.equal(
    normalizeFacebookWatchUrl(`https://fb.watch/${CODE}/?mibextid=x#frag`),
    `https://fb.watch/${CODE}/`,
  );
  assert.equal(
    normalizeFacebookWatchUrl(`https://evil.example.com@www.facebook.com/watch/?v=${ID}`),
    `https://www.facebook.com/watch/?v=${ID}`,
  );
});

test('rejects non-Facebook, look-alike and malformed input', () => {
  for (const url of [
    '',
    '   ',
    'not a url at all',
    'https://vimeo.com/12345678',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    // look-alike hosts — the exact-match host set is what stops these
    `https://facebook.com.evil.com/watch/?v=${ID}`,
    `https://notfacebook.com/watch/?v=${ID}`,
    `https://www.facebook.evil.com/watch/?v=${ID}`,
    `https://fb.watch.evil.com/${CODE}/`,
    // non-http schemes
    `javascript:alert(1)//facebook.com/watch/?v=${ID}`,
    `data:text/html,<script>alert(1)</script>`,
    `ftp://facebook.com/watch/?v=${ID}`,
    // right host, wrong shape — none of these identify a broadcast
    'https://www.facebook.com/',
    'https://www.facebook.com/SetnayanPH',
    'https://www.facebook.com/SetnayanPH/live',
    'https://www.facebook.com/profile.php?id=100000000000000',
    'https://www.facebook.com/permalink.php?story_fbid=123&id=456',
    'https://www.facebook.com/groups/1234567890123456',
    // right shape, wrong id
    'https://www.facebook.com/watch/?v=abc',
    'https://www.facebook.com/watch/?v=',
    'https://www.facebook.com/watch/?v=123',
    `https://www.facebook.com/watch/?v=${'9'.repeat(30)}`,
    'https://www.facebook.com/SetnayanPH/videos/not-a-number/',
    'https://www.facebook.com/reel/nope',
    // injection attempts inside the id / code slots
    `https://www.facebook.com/watch/?v=${ID}"><script>alert(1)</script>`,
    'https://fb.watch/<script>/',
    'https://www.facebook.com/share/v/..%2F..%2Fevil/',
  ]) {
    assert.equal(normalizeFacebookWatchUrl(url), null, url);
  }
});

test('every accepted value is an absolute https Facebook URL', () => {
  // The structural guarantee the href relies on: whatever comes back begins with
  // a scheme and host WE wrote, so no attacker-controlled scheme or host can
  // reach the DOM even if a hostile value were PATCHed into the column.
  for (const input of [
    `https://www.facebook.com/watch/?v=${ID}`,
    `https://www.facebook.com/SetnayanPH/videos/${ID}/`,
    `https://www.facebook.com/reel/${ID}`,
    `https://www.facebook.com/share/v/${CODE}/`,
    `https://fb.watch/${CODE}/`,
  ]) {
    const out = normalizeFacebookWatchUrl(input);
    assert.ok(out, input);
    assert.ok(
      (out as string).startsWith('https://www.facebook.com/') ||
        (out as string).startsWith('https://fb.watch/'),
      `${input} → ${out}`,
    );
  }
});

test('the 30-day replay warning states the retention AND names the permanent copy', () => {
  // Owner directive 2026-07-26 — mandatory honesty. Meta deletes live replays
  // after ~30 days, so a couple must never believe Facebook is their archive.
  assert.match(FACEBOOK_REPLAY_WARNING, /30 days/i);
  assert.match(FACEBOOK_REPLAY_WARNING, /facebook/i);
  assert.match(FACEBOOK_REPLAY_WARNING, /youtube/i);
});

test('the 30-day warning actually ships — on EVERY surface that sets the link', () => {
  // A constant nobody renders is not a warning. This asserts the card renders it
  // unconditionally (not inside the collapsed <details>, not behind a saved/error
  // branch) and that BOTH couple-facing setup surfaces mount that card.
  const card = readFileSync(join(WEB_ROOT, 'app/_components/facebook-dual-stream-card.tsx'), 'utf8');
  assert.match(card, /\{FACEBOOK_REPLAY_WARNING\}/, 'the card never renders the warning');
  const detailsAt = card.indexOf('<details');
  const warningAt = card.indexOf('{FACEBOOK_REPLAY_WARNING}');
  assert.ok(detailsAt === -1 || warningAt < detailsAt, 'the warning was moved inside the collapsed guide');

  for (const surface of [
    'app/dashboard/[eventId]/studio/panood/setup/page.tsx',
    'app/panood/control/[eventId]/page.tsx',
  ]) {
    assert.match(
      readFileSync(join(WEB_ROOT, surface), 'utf8'),
      /<FacebookDualStreamCard/,
      `${surface} lets a couple reach the Facebook link without the 30-day warning`,
    );
  }
});

test('the setup guide names the concrete OBS steps and the bandwidth cost', () => {
  const card = readFileSync(join(WEB_ROOT, 'app/_components/facebook-dual-stream-card.tsx'), 'utf8');
  assert.match(card, /obs-multi-rtmp/, 'the guide does not name the plugin that makes dual-streaming work');
  assert.match(card, /stream key/i, 'the guide never mentions the Facebook stream key');
  assert.match(card, /upload/i, 'the guide omits the doubled upload cost');
  assert.match(card, /venue/i, 'the guide omits "test at the venue"');
});
