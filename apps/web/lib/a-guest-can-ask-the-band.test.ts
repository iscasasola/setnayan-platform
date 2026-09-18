/**
 * A GUEST CAN ASK THE BAND FOR A SONG — and is never told "sent" to nobody.
 *
 * SUP-52 was a join, not a feature: the table, both RPC lanes, the band's pause
 * and the band's paid inbox all shipped in July, and nothing on `/[slug]` could
 * post. These checks pin the join from both ends, and the one rule that makes it
 * honest — the card shows only when a booked act can READ the requests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  SONG_REQUEST_COPY,
  SONG_REQUEST_RPC_ERRORS,
  songRequestCardShows,
  songRequestErrorFor,
  songRequestOutcomeFor,
} from './guest-song-request-rule';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('the card shows only in the live window AND only when an act can read', () => {
  assert.equal(songRequestCardShows({ isLive: true, door: 'open' }), true);
  assert.equal(songRequestCardShows({ isLive: true, door: 'paused' }), true);
  // 🔑 The case this whole join turns on: the RPC calls a band-less event OPEN.
  assert.equal(songRequestCardShows({ isLive: true, door: null }), false);
  assert.equal(songRequestCardShows({ isLive: false, door: 'open' }), false);
});

test('a repeat ask is not reported as "sent" — ON CONFLICT DO NOTHING returns no row', () => {
  assert.equal(songRequestOutcomeFor([{ request_id: 'r1' }]), 'sent');
  assert.equal(songRequestOutcomeFor([]), 'already_asked');
  assert.equal(songRequestOutcomeFor(null), 'already_asked');
  assert.notEqual(SONG_REQUEST_COPY.sent, SONG_REQUEST_COPY.already_asked);
});

test('every refusal the guest lane can RAISE has a name the guest can read', () => {
  // Read the tags out of the migrations rather than restating them, so a new
  // RAISE in a future migration fails here instead of arriving as a bare 500.
  const dir = join(process.cwd(), '..', '..', 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
  const tags = new Set<string>();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    if (!sql.includes('guest_submit_song_request') && !sql.includes('resolve_song_id')) continue;
    for (const m of sql.matchAll(/RAISE EXCEPTION '(songreq:[a-z_]+)'/g)) tags.add(m[1]!);
  }
  // The open lane's own two refusals cannot reach a guest-lane call.
  const openLaneOnly = new Set(['songreq:invalid_key', 'songreq:unknown_event']);
  const guestLane = [...tags].filter((t) => !openLaneOnly.has(t));
  console.log(`guest-lane refusal tags found: ${guestLane.length} (${guestLane.join(', ')})`);
  assert.ok(guestLane.length >= 6, `expected ≥6 guest-lane tags, found ${guestLane.length} — the scan is pointing at nothing`);
  for (const tag of guestLane) {
    assert.ok(SONG_REQUEST_RPC_ERRORS[tag], `${tag} is raised but unmapped — a guest would see "hiccuped"`);
    const mapped = songRequestErrorFor(`ERROR: ${tag}`);
    assert.notEqual(mapped.error, 'save_failed', tag);
    assert.ok(SONG_REQUEST_COPY[mapped.error], `${mapped.error} has no copy`);
  }
  assert.equal(songRequestErrorFor('something else').error, 'save_failed');
});

test('the card is mounted ONCE, in the guest tree, behind the render rule', () => {
  const src = stripComments(read('app/[slug]/_components/site-body.tsx'));
  const mounts = [...src.matchAll(/<SongRequestCard[\s/>]/g)];
  assert.equal(mounts.length, 1, `expected 1 mount, found ${mounts.length}`);
  // The guest tree begins where the guest branch binds its own `isLive`; the
  // anonymous tree has no guest session to post with.
  const guestTree = src.indexOf("const isLive = dayOfPhase === 'live';");
  assert.ok(guestTree > 0, 'guest-tree marker not found — this guard is pointing at nothing');
  assert.ok(mounts[0]!.index! > guestTree, 'the card is mounted outside the guest tree');
  const before = src.slice(Math.max(0, mounts[0]!.index! - 200), mounts[0]!.index!);
  assert.match(before, /songRequestCardShows\(\{\s*isLive,\s*door:\s*songRequestDoor\s*\}\)\s*\?/);
});

test('the page loads the door, and the route re-checks it BEFORE the RPC', () => {
  const page = stripComments(read('app/[slug]/page.tsx'));
  assert.match(page, /songRequestDoor:\s*\n?\s*dayOfPhase === 'live'[\s\S]{0,120}eventSongRequestDoor\(admin, event\.event_id\)/);

  const route = stripComments(read('app/api/song-requests/route.ts'));
  const phase = route.indexOf("phase !== 'live'");
  const door = route.indexOf('eventSongRequestDoor(admin');
  const rpc = route.indexOf("rpc('guest_submit_song_request'");
  assert.ok(phase > 0 && door > 0 && rpc > 0, `markers phase=${phase} door=${door} rpc=${rpc}`);
  assert.ok(phase < rpc && door < rpc, 'the live window and the audience must be checked before anything is written');
  assert.match(route, /if \(door === null\) return NextResponse\.json\(\{ error: 'no_band' \}/);
});

test('the door asks the band’s OWN gate, with the event tiles passed in', () => {
  const lib = stripComments(read('lib/guest-song-request.ts'));
  // Same admission rule for "booked" as requireSongDeskAct…
  assert.match(lib, /fetchVendorRoomEvents\(admin, /);
  // …and the tiles handed over, or the brief refuses service_role and the
  // narrowing silently never runs (the probes.ts lesson of 2026-08-15).
  assert.match(lib, /resolveSongDeskAccess\([\s\S]*?tilesForVendorCategories\(/);
  // The pause is read from the SAME predicate the RPC refuses on.
  assert.match(lib, /rpc\('song_requests_open_for_event'/);
});
