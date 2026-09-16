import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pabuyaQrPath, PABUYA_QR_ROUTE_PREFIX } from '@/lib/pabuya-qr-url';

/**
 * TWO PROMISES ON THE PABUYA GIFT PAGE, BOTH BROKEN IN PRODUCTION ON
 * 2026-09-16, both re-measurable from here.
 *
 *   1. The couple's uploaded QR must render at a URL that DOES NOT EXPIRE.
 *   2. The dashboard must never claim a privacy setting it did not read.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE ────────────────────────────────────
 * `pabuyaQrPath` is pure, so promise 1's core is EXECUTED below, not grepped.
 * `lib/egift.ts` is `server-only` and the manager is a client component with
 * JSX, so the two decisions that live inside them are checked against source.
 * ⚠ A source check cannot see a `return null`, a renamed symbol, or a reword —
 * it is the weaker half and is written to fail loudly rather than silently:
 * each one asserts a PROPERTY of the expression, and each anchors on a symbol
 * that cannot be renamed without breaking the build.
 */

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const EGIFT = 'lib/egift.ts';
const MANAGER = 'app/dashboard/[eventId]/pabuya/_components/pabuya-manager.tsx';
const PAGE = 'app/dashboard/[eventId]/pabuya/page.tsx';
const ROUTE = 'app/api/pabuya/qr/[publicId]/route.ts';

// ── 1 · THE PATH ITSELF — executed. ────────────────────────────────────────

test('pabuyaQrPath points at the permanent route, not a presigned URL', () => {
  const url = pabuyaQrPath('S89Y-ABCDEFGHJK');
  assert.equal(url, '/api/pabuya/qr/S89Y-ABCDEFGHJK');
  assert.ok(url.startsWith(PABUYA_QR_ROUTE_PREFIX));
  // The whole point: no signature, no expiry, no host.
  assert.ok(!/X-Amz-|Signature|Expires/i.test(url), 'a presigned URL leaked in');
  assert.ok(!url.startsWith('http'), 'must be same-origin so no bucket is named');
});

test('pabuyaQrPath escapes its id rather than pasting it into a path', () => {
  assert.equal(pabuyaQrPath('a/../b'), '/api/pabuya/qr/a%2F..%2Fb');
});

// ── 2 · THE READER — no presign may come back. ─────────────────────────────

test('egift.ts resolves QR images through the route, never a presigned URL', () => {
  const src = read(EGIFT);
  assert.ok(
    src.includes('pabuyaQrPath'),
    'egift.ts must build the QR URL with the shared pabuyaQrPath',
  );
  // `displayUrlForStoredAsset` / `presignDisplayUrl` are the 24-hour-TTL
  // helpers this change exists to get out of the gift path. Either one back in
  // this file re-introduces the expiry.
  for (const banned of ['displayUrlForStoredAsset', 'presignDisplayUrl']) {
    assert.ok(
      !src.includes(banned),
      `${banned} is back in egift.ts — the QR would expire again`,
    );
  }
});

// ── 3 · THE ROUTE — the id is not the access control. ──────────────────────

test('the QR route gates on visibility and on is_enabled, not on knowing the id', () => {
  const src = read(ROUTE);
  assert.ok(src.includes('canViewSlugEvent'), 'the visibility gate is missing');
  assert.ok(src.includes('userHostsEvent'), 'the host arm is missing');
  assert.ok(
    /!method\.is_enabled/.test(src),
    'a disabled (retired) destination must 404 for non-hosts',
  );
  // A host check that throws must not open the door.
  const hostBlock = src.slice(src.indexOf('let isHost'), src.indexOf('// ── The bytes'));
  assert.ok(
    /catch\s*\{[^}]*isHost\s*=\s*false/s.test(hostBlock),
    'a failed host lookup must fall back to the STRICTER arm, never escalate',
  );
});

test('the QR route never echoes a non-image content type back to the browser', () => {
  const src = read(ROUTE);
  assert.ok(
    src.includes("startsWith('image/')"),
    'a stored content-type is data, not a promise — it must be checked',
  );
  assert.ok(src.includes('nosniff'), 'X-Content-Type-Options is missing');
});

// ── 4 · THE SENTENCE — "private" may not be produced by a failure. ─────────

test('the manager may only call a page private when the event was actually read', () => {
  const src = read(MANAGER);
  const line = src
    .split('\n')
    .find((l) => /^\s*const isPrivate\s*=/.test(l));
  assert.ok(line, 'isPrivate is gone or renamed — re-point this guard');
  assert.ok(
    line.includes('eventWasRead'),
    `isPrivate must be conjoined with eventWasRead, got: ${line.trim()}`,
  );
  // The prop must be REQUIRED. An optional one with a default would let the
  // bug back in silently at the next call site.
  assert.ok(
    /\n\s*eventWasRead: boolean;/.test(src),
    'eventWasRead must be a required boolean prop, not optional',
  );
});

test('the unread state gets its own sentence, above both real readings', () => {
  const src = read(MANAGER);
  const at = (needle: string) => src.indexOf(needle);
  const unread = at('!eventWasRead');
  const privateSentence = at('Your event page is private');
  const liveSentence = at('This is what guests see on your event page');
  assert.ok(unread > -1 && privateSentence > -1 && liveSentence > -1);
  // Byte ORDER, not presence — both sentences exist either way, so only their
  // position relative to the unread branch says which one a hole falls into.
  assert.ok(
    unread < privateSentence && unread < liveSentence,
    'the unread branch must be evaluated BEFORE either claim about visibility',
  );
});

test('the page hands the manager whether the read succeeded', () => {
  const src = read(PAGE);
  assert.ok(
    /eventWasRead=\{eventWasRead\}/.test(src),
    'the page must pass eventWasRead to PabuyaManager',
  );
  assert.ok(
    /const eventWasRead = event !== null/.test(src),
    'eventWasRead must be derived from the row, not hard-coded true',
  );
});
