/**
 * GUARD — the Uploads camera is minted in ONE place, and that place already
 * knows who is asking.
 *
 * Owner 2026-08-26: *"papic is the source where they collect media files for
 * that event"* and *"they can upload their work via papic credits as well per
 * event."* An upload is a camera taking a shot, so it rides the metering, the
 * safety screen, the derivatives and the Drive copy that every capture gets.
 *
 * 🚨 THE HOLE THIS PREVENTS WAS IN THE FIRST DESIGN OF THIS FEATURE. The
 * obvious shape — *"one server action that mints-or-fetches the event's Uploads
 * camera"* — is a **SERVICE-ROLE write keyed on a client-supplied event id**.
 * A signed-in stranger could mint a live seat on somebody else's wedding and
 * claim it, and every gate downstream would wave them through: the upload
 * presign and the record path both check **claimer identity** and nothing else.
 * A takeover door built out of fully-legitimate, fully-gated parts.
 *
 * 🔑 SO THE RULE IS THE CALL SITE, NOT THE FUNCTION. The provisioner is safe
 * only because the one place that calls it has already done the couple check.
 * Nothing about the function's own body can express that, which is exactly why
 * it needs a test rather than a comment.
 *
 * 🪤 AND THE INDEX IS NOT ARBITRARY. The build plan proposed 110; measured in
 * production, `seat_index = 110` already holds the free dedicated camera on
 * FOUR events. Minting there upserts with `ignoreDuplicates: true` — creating
 * NOTHING, returning success, leaving the couple with no camera and no error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const CAMERAS = readFileSync(join(WEB, 'lib/papic-cameras.ts'), 'utf8');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const FILES = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];

test('the sweep found the tree — or every rule below is vacuous', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} source files walked`);
});

test('🚨 the Uploads camera index collides with nothing', () => {
  const idx = /export const PAPIC_UPLOADS_CAMERA_INDEX = (\d+);/.exec(CAMERAS)?.[1];
  assert.ok(idx, 'the reserved index is gone');
  const n = Number(idx);
  const others = [...CAMERAS.matchAll(/export const (PAPIC_[A-Z_]*INDEX[A-Z_]*) = (\d+);/g)]
    .filter((m) => m[1] !== 'PAPIC_UPLOADS_CAMERA_INDEX')
    .map((m) => ({ name: m[1]!, v: Number(m[2]) }));
  for (const o of others) {
    assert.notEqual(n, o.v, `the Uploads camera shares index ${n} with ${o.name} — the upsert ignores duplicates, so it would create NOTHING, report success, and leave the couple with no camera and no error`);
  }
  // It must also clear the free BLOCK, which is a range rather than a point.
  const base = Number(/PAPIC_FREE_CAMERA_INDEX_BASE = (\d+);/.exec(CAMERAS)?.[1] ?? '100');
  const count = Number(/PAPIC_FREE_CAMERA_COUNT = (\d+);/.exec(CAMERAS)?.[1] ?? '3');
  assert.ok(n < base || n > base + count - 1, `index ${n} lands inside the free camera block ${base}..${base + count - 1}`);
  const paid = Number(/PAPIC_CAMERA_INDEX_BASE = (\d+);/.exec(CAMERAS)?.[1] ?? '200');
  assert.ok(n < paid, `index ${n} lands in the paid camera range (${paid}+)`);
});

test('🚨 the provisioner is called only from COUPLE-CHECKED RENDERS — the studio page and the Memories page', () => {
  // 2026-10-26 (owner, live: "the turn on is not working as well fix it"): the studio render was the ONE minter, and
  // since 2026-10-24 it sends the couple to Home before it gets there — so on 7 of 13 live events + Add photos found no
  // camera and could only say "please try again". The Memories render is the second minter, and it is held to the same
  // two facts as the first: it runs AFTER a couple check on the viewer's own session, and the event id is the route's.
  const callers = FILES.filter((f) => /provisionUploadsCameraAdmin\s*\(/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(WEB.length + 1))
    .filter((rel) => rel !== 'lib/papic-cameras.ts')
    .sort();
  assert.deepEqual(
    callers,
    ['app/dashboard/[eventId]/memories/page.tsx', 'app/dashboard/[eventId]/studio/papic/page.tsx'],
    'the Uploads camera is minted somewhere new. This is a SERVICE-ROLE write: a caller that takes a ' +
      'client-supplied event id lets a signed-in stranger mint a live seat on somebody else\'s wedding ' +
      'and claim it — and every gate downstream checks claimer identity and nothing else.',
  );
});

test('🚨 Memories mints it only inside the host branch, from the route\'s event id, after the couple read', () => {
  const page = readFileSync(join(WEB, 'app/dashboard/[eventId]/memories/page.tsx'), 'utf8');
  // The couple check: the viewer's OWN membership, read on their own session, decides `host`.
  assert.match(page, /const \{ eventId \} = await params;/, 'the Memories event id no longer comes from the route');
  assert.match(
    page,
    /supabase\.from\('event_members'\)\.select\('member_type'\)\.eq\('event_id', eventId\)\.eq\('user_id', user\.id\)/,
    'the host is no longer read from the viewer\'s own membership',
  );
  assert.match(page, /const host = membershipRes\.data\?\.member_type === 'couple';/, 'host is no longer "a couple member"');
  const hostBranch = /\n  if \(host\) \{[\s\S]*?\n  \}\n/.exec(page)?.[0] ?? '';
  assert.ok(hostBranch, 'the Memories host branch is gone or restructured beyond recognition');
  const outside = page.replace(hostBranch, '');
  assert.ok(/provisionUploadsCameraAdmin\(/.test(hostBranch), 'the mint left the host branch');
  assert.ok(!/provisionUploadsCameraAdmin\(/.test(outside), 'the Uploads camera is minted OUTSIDE the host branch — any viewer\'s render would mint it');
  const call = /provisionUploadsCameraAdmin\([\s\S]{0,200}?\}\)/.exec(hostBranch)?.[0] ?? '';
  assert.match(call, /provisionUploadsCameraAdmin\(admin, eventId,/, 'the mint no longer takes the route\'s event id');
  assert.match(call, /validFrom: win\.startIso/, 'the Memories mint no longer takes the event window');
  assert.match(call, /validUntil: win\.endIso/, 'the Memories mint no longer takes the event window');
  assert.ok(!/validFrom: null/.test(call), 'a null window makes this the only seat exempt from the dates the couple picked');
});

test('🚨 there is no server action wrapper for it', () => {
  const actions = FILES.filter((f) => /\/actions\.ts$/.test(f) || /['"]use server['"]/.test(readFileSync(f, 'utf8')));
  const offenders = actions
    .filter((f) => /provisionUploadsCameraAdmin/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(WEB.length + 1));
  assert.deepEqual(offenders, [], `a server action mints the Uploads camera: ${offenders.join(', ')} — that is the takeover door this file exists for`);
});

test('🚨 it takes the event\'s real capture window, never null', () => {
  const page = readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/papic/page.tsx'), 'utf8');
  const call = /provisionUploadsCameraAdmin\([\s\S]{0,300}?\}\)/.exec(page)?.[0] ?? '';
  assert.match(call, /validFrom: papicWindow\.startIso/, 'the Uploads camera no longer takes the event window');
  assert.match(call, /validUntil: papicWindow\.endIso/, 'the Uploads camera no longer takes the event window');
  // captureWindowState returns 'open' on null bounds, so a null-window seat
  // would be the only camera in the product exempt from the couple's dates.
  assert.ok(!/validFrom: null/.test(call), 'a null window makes this the only seat exempt from the dates the couple picked');
});

test('idempotency is the database constraint, not a TypeScript check', () => {
  const fn = /export async function provisionUploadsCameraAdmin[\s\S]*?\n}/.exec(CAMERAS)?.[0] ?? '';
  assert.ok(fn, 'the provisioner was restructured beyond recognition');
  assert.match(
    fn,
    /onConflict: 'event_id,seat_index'/,
    'the upsert no longer names the unique constraint — two concurrent renders both read "missing" and both insert; only the database can settle that',
  );
  assert.match(fn, /if \(readErr\) return 0;/, 'a refused read is treated as "there is none" — it must retry, not insert on an unread');
});
