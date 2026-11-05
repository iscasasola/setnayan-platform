/**
 * guest-pages-reads-are-honest.test.ts — six places a guest (or the crew at
 * their door) was told something false because a read was refused.
 *
 * The rule is the guest list's (`lib/guests-read-is-honest.test.ts`): Supabase
 * RESOLVES with `{ error }`, so a refused read arrives as `data: null`, and a
 * page that reads `null` as "none" states an absence it never measured — in
 * output byte-identical to the real absence. 🔑 A LOG LINE NEVER CHANGED A
 * PIXEL: the measurement has to reach the RENDER.
 *
 *   1 · a LISTED, signed-in guest was told "You're not on the guest list for
 *       this event yet" + "Ask to join" / "Join as a guest" — now "We couldn't
 *       check your invitation just now" + Try again;
 *   2 · closing "Lost QR? Login" sent a guest to the marketing front page — now
 *       back to their event;
 *   3 · a guest the host gave 0 shots read "That's all 0 photos!" + a thank-you
 *       — now "The host hasn't opened your camera yet", from the first frame;
 *   4 · MY camera said "This link isn't active… replaced" on a blip — now the
 *       guest error page ("Your link is fine… Try again");
 *   5 · door staff were told a guest was "not on this event's list", and the
 *       offline queue dropped the scan for good — now a try-again it retries;
 *   6 · the entrance chart, the 3D plan and the tea-ceremony order drew an
 *       empty room — now "We couldn't load your guest list".
 *
 * Behaviour is run where the code takes a client or renders on its own (1, 3);
 * the rest is pinned in comment-free source. Every assertion was mutation-checked:
 * the fix reverted → this file red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { readGuestSeatForUser } from '@/lib/guest-seat-read';
import { anonymousIdentity } from '@/app/[slug]/_lib/site-identity';

// The components are compiled with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
/** `a` appears, and before `b`. */
function before(code: string, a: RegExp | string, b: RegExp | string, why: string) {
  const ia = typeof a === 'string' ? code.indexOf(a) : code.search(a);
  const ib = typeof b === 'string' ? code.indexOf(b) : code.search(b);
  assert.ok(ia >= 0, `${why} — missing: ${a}`);
  assert.ok(ib >= 0, `${why} — missing: ${b}`);
  assert.ok(ia < ib, `${why} — ${a} must come before ${b}`);
}

/** A client whose reads answer, in order, with `results` — every chained filter returns the builder. */
function stubClient(results: { data: unknown; error: unknown }[]): SupabaseClient {
  let call = 0;
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit']) builder[m] = () => builder;
  builder.maybeSingle = () => Promise.resolve(results[call++] ?? { data: null, error: null });
  return { from: () => builder } as unknown as SupabaseClient;
}
const REFUSED = { data: null, error: { message: 'permission denied for table event_members', code: '42501' } };

// ═══ 1 · THE SEAT READ ══════════════════════════════════════════════════════

test('1 · a REFUSED membership read is measured:false — not "no seat"', async () => {
  const got = await readGuestSeatForUser(stubClient([REFUSED]), 'e1', 'u1');
  assert.deepEqual(got, { seat: null, measured: false });
});

test('1 · a REFUSED seat read (membership found) is measured:false too', async () => {
  const got = await readGuestSeatForUser(stubClient([{ data: { guest_id: 'g1' }, error: null }, REFUSED]), 'e1', 'u1');
  assert.deepEqual(got, { seat: null, measured: false });
});

test('1 · a read that ANSWERED "no seat" is measured:true — the only case that may say "not listed"', async () => {
  assert.deepEqual(await readGuestSeatForUser(stubClient([{ data: null, error: null }]), 'e1', 'u1'), { seat: null, measured: true });
  // A seat the host removed (deleted_at filter → no row) is a measured "none", too.
  assert.deepEqual(
    await readGuestSeatForUser(stubClient([{ data: { guest_id: 'g1' }, error: null }, { data: null, error: null }]), 'e1', 'u1'),
    { seat: null, measured: true },
  );
});

test('1 · a seat that is there still arrives', async () => {
  const got = await readGuestSeatForUser(
    stubClient([
      { data: { guest_id: 'g1' }, error: null },
      { data: { guest_id: 'g1', qr_token: 'tok', events: { slug: ' ana-ben ' } }, error: null },
    ]),
    'e1',
    'u1',
  );
  assert.deepEqual(got, { seat: { guestId: 'g1', qrToken: 'tok', slug: 'ana-ben' }, measured: true });
});

test('1 · the server-only lookup is the SAME read, not a second copy', () => {
  const lib = src('lib/guest-membership-session.ts');
  assert.match(lib, /return readGuestSeatForUser\(createAdminClient\(\), eventId, userId\);/);
  assert.match(lib, /return \(await findGuestSeatForUserMeasured\(eventId, userId\)\)\.seat;/);
  assert.doesNotMatch(lib, /\.from\('event_members'\)|\.from\('guests'\)/, 'a second copy of the seat read is back');
});

test('1 · a refused read is never ALSO "not listed" on the identity the page builds', () => {
  const id = anonymousIdentity({ reason: null, publicCandidCameraActive: false, publicAlbumHref: null, signedInNotListed: true, seatUnread: true });
  assert.equal(id.seatUnread, true);
  assert.equal(id.signedInNotListed, false, 'both flags reached the door — it would pick the not-listed copy');
});

test('1 · the door: try again — never "not on the guest list", never Ask to join or Join as a guest', () => {
  const { GetInside } = require('@/app/[slug]/_components/get-inside') as typeof import('@/app/[slug]/_components/get-inside');
  const join = async () => {};
  for (const over of [{ mayAskToJoin: true }, { mayAskToJoin: false }, { joinAction: join }]) {
    const html = renderToStaticMarkup(
      React.createElement(GetInside, { slug: 'ana-ben', eventId: 'e-1', signedInNotListed: true, seatUnread: true, theOrganizer: 'the couple', ...over }),
    );
    assert.match(html, /We couldn’t check your invitation just now/);
    assert.match(html, /<a href="\/ana-ben"[^>]*>Try again<\/a>/, 'the try-again does not re-open this page');
    assert.doesNotMatch(html, /not on the guest list/, 'a refused read said "not on the guest list"');
    assert.doesNotMatch(html, /Ask to join|Join as a guest|<form/, 'a refused read offered a way to join — a second seat');
  }
  // …and a measured "not listed" is unchanged.
  const listed = renderToStaticMarkup(
    React.createElement(GetInside, { slug: 'ana-ben', eventId: 'e-1', signedInNotListed: true, theOrganizer: 'the couple', mayAskToJoin: true }),
  );
  assert.match(listed, /You’re not on the guest list for this event yet/);
  assert.doesNotMatch(listed, /couldn’t check your invitation/);
});

test('1 · the page hands the door the measurement, on public AND private events', () => {
  const page = src('app/[slug]/page.tsx');
  assert.doesNotMatch(page, /await findGuestSeatForUser\(/, 'the page reads the seat unmeasured');
  assert.match(page, /signedInNotListed:\s*Boolean\(viewerAccount\?\.id\) && !viewerSeatUnread && /, '"not listed" is said on a refused read');
  assert.match(page, /seatUnread:\s*Boolean\(viewerAccount\?\.id\) && viewerSeatUnread && /, 'the door is never told the read was refused');
  assert.match(page, /const viewerSeatUnread = !viewerSeatRead\.measured;/);
  assert.match(src('app/[slug]/_components/site-body.tsx'), /seatUnread=\{anon\.seatUnread\}/, 'site-body drops the flag');
  // Private: the lock screen ("ask your hosts to add you") is never the answer to a refused read.
  assert.match(page, /seatReadRefused = !seatRead\.measured;/);
  before(page, /if \(seatReadRefused\) \{\s*throw new Error\(/, '<PrivateLanding\n          event={event}', 'a refused seat read reaches the lock screen');
});

// ═══ 2 · THE LOGIN ✕ ════════════════════════════════════════════════════════

test('2 · closing "Lost QR? Login" returns a guest to their event, everyone else to Discover', () => {
  const page = src('app/login/page.tsx');
  assert.match(page, /dismissHref=\{view\.forGuest \? view\.next : '\/'\}/, 'the ✕ ignores where a guest came from');
  // `next` is same-site and `forGuest` means it opens a real event — the ✕ can never be an open redirect or /login.
  const data = src('app/login/_components/login-data.ts');
  assert.match(data, /const next = safeNext\(params\.next\);/);
  assert.match(data, /const forGuest = await nextOpensAnEvent\(next\);/);
});

// ═══ 3 · THE CAMERA THE HOST HAS NOT OPENED ═════════════════════════════════

async function camera(over: Record<string, unknown>) {
  const { PapicGuestCapture } = await import('@/app/papic/guest/_components/papic-guest-capture');
  return renderToStaticMarkup(
    React.createElement(PapicGuestCapture, {
      eventName: 'Ana & Ben',
      eventId: 'e-1',
      termsAccepted: true,
      sponsorShare: false,
      eventStyle: 'orig' as never,
      faceMode: 'mode_b' as never,
      embedded: false,
      exitTo: { slug: 'ana-ben', tab: 'live' },
      ...over,
    } as never),
  );
}

test('3 · a ceiling of 0 says "The host hasn’t opened your camera yet" from the first frame', async () => {
  const html = await camera({ capApplies: true, total: 0, initialRemaining: 0 });
  assert.match(html, /data-papic-camera-not-opened=""[^>]*>\s*The host hasn’t opened your camera yet/);
  assert.doesNotMatch(html, /That’s all 0 photos/, 'a guest given no shots is told they used them all');
  assert.doesNotMatch(html, /Thank you for helping capture/, 'thanked for photos nobody took');
  // The caption under the shutter (the embedded camera draws it) says nothing about "used up" either.
  const embedded = await camera({ capApplies: true, total: 0, initialRemaining: 0, embedded: true });
  assert.match(embedded, /hasn’t opened your camera yet/);
  assert.doesNotMatch(embedded, /all used up/, 'the caption says a camera nobody opened is used up');
});

test('3 · a ceiling that was REACHED still says "That’s all N photos"', async () => {
  const html = await camera({ capApplies: true, total: 20, initialRemaining: 0 });
  assert.match(html, /That’s all 20 photos!/);
  assert.doesNotMatch(html, /hasn’t opened your camera/);
  // …and an open camera says neither.
  const open = await camera({ capApplies: true, total: 20, initialRemaining: 12 });
  assert.doesNotMatch(open, /hasn’t opened your camera|That’s all/);
});

// ═══ 4 · MY CAMERA ══════════════════════════════════════════════════════════

test('4 · MY camera: a refused read reaches the guest error page, never "This link isn’t active"', () => {
  const page = src('app/papic/me/[token]/page.tsx');
  assert.match(page, /const \{ data, error: guestError \} = await admin\s*\.from\('guests'\)/, 'the guest read drops its error');
  assert.match(page, /const \{ data: ev, error: eventError \} = await admin\s*\.from\('events'\)/, 'the event read drops its error');
  before(page, /if \(guestError\) \{\s*throw new Error\(/, 'title="This link isn\'t active."', 'a refused read is said as a dead link');
  assert.match(page, /if \(eventError\) \{\s*throw new Error\(/);
  // The throw lands on the INVITATION's boundary ("Your link is fine… Try again"), not the root one ("Take me home").
  const boundary = join(WEB, 'app/papic/me/[token]/error.tsx');
  assert.ok(existsSync(boundary), 'MY camera has no error page of its own — the root one says "Take me home"');
  const b = src('app/papic/me/[token]/error.tsx');
  assert.match(b, /^'use client';/);
  assert.match(b, /export \{ default \} from '@\/app\/\[slug\]\/error';/);
  assert.match(src('app/[slug]/error.tsx'), /Your link is fine/);
});

// ═══ 5 · THE DOOR ═══════════════════════════════════════════════════════════

test('5 · check-in: a refused read is "couldn’t check — try again", never "not on this event’s list"', () => {
  const live = src('app/dashboard/[eventId]/guests/checkin/actions.ts');
  const fn = live.slice(live.indexOf('export async function checkInGuest'), live.indexOf('export async function undoCheckIn'));
  assert.match(fn, /const \{ data: guest, error: guestError \} = await supabase\s*\.from\('guests'\)/, 'the guest read drops its error');
  before(fn, 'if (guestError) return { ok: false, error: COULD_NOT_CHECK };', 'if (!guest) return', 'a refused read is said before "not on the list"');
  // Not `refused`: a refusal is a permanent NO the offline queue files and stops sending.
  assert.doesNotMatch(fn, /if \(guestError\)[^\n]*refused/);
  assert.match(live, /const COULD_NOT_CHECK = 'Couldn’t check that guest just now — try again\.';/);
  // The crew check itself: a refused membership read is not "only the couple or a coordinator".
  const crew = live.slice(live.indexOf('async function assertDoorCrew'));
  assert.match(crew, /const \{ data, error \} = await supabase\s*\.from\('event_members'\)/);
  before(crew, 'if (error) throw new DoorCrewUnread();', "if (!data) throw new Error('forbidden');", 'a refused crew read is "forbidden"');
  before(fn, 'if (e instanceof DoorCrewUnread) return { ok: false, error: COULD_NOT_CHECK };', 'onlyOrganizerOrCoordinator(eventId', 'the couple is told they are not door crew');
});

test('5 · the live ticket check: a refused crew read is "unreadable", never "unknown" for a real ticket', () => {
  const live = src('app/dashboard/[eventId]/guests/checkin/actions.ts');
  const fn = live.slice(live.indexOf('export async function checkTicketLive'));
  before(fn, "if (e instanceof DoorCrewUnread) return { verdict: 'unreadable', checkedAt };", "return { verdict: 'unknown', checkedAt };", 'a refused crew read calls the ticket unknown');
  // The desk is the only caller, and its page admits couple + coordinator only — no other crew reaches this.
  const page = src('app/dashboard/[eventId]/guests/checkin/page.tsx');
  assert.match(page, /\.in\('member_type', \['couple', 'coordinator'\]\)/);
  // …and "unreadable" is decided from the desk's saved list (pinned in dashboard-reads-are-honest.test.ts #5).
  assert.match(src('app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx'), /if \(check\?\.verdict === 'unreadable'\) check = null;/);
});

// ═══ 6 · THE ROOMS ══════════════════════════════════════════════════════════

test('6 · the entrance chart, the 3D plan and the tea ceremony never draw from an unmeasured guest list', () => {
  for (const f of ['seating/chart/page.tsx', 'seating/lab/page.tsx', 'guests/tea-ceremony/page.tsx']) {
    const code = src(`app/dashboard/[eventId]/${f}`);
    assert.doesNotMatch(code, /fetchGuestsByEvent\(/, `${f} reads the guest list unmeasured`);
    assert.match(code, /fetchGuestsByEventMeasured\(supabase, eventId\)/, `${f} reads the guest list measured`);
    assert.match(code, /<ReadRefusedNotice what="your guest list" \/>/, `${f} never says the read was refused`);
  }
  // Said BEFORE anything is counted or drawn.
  const chart = src('app/dashboard/[eventId]/seating/chart/page.tsx');
  before(chart, 'if (!guestsRead.measured) {', 'seatingUnits(tables, assignments, guests)', 'the chart counts "0 seated" first');
  const lab = src('app/dashboard/[eventId]/seating/lab/page.tsx');
  before(lab, 'if (!guestsRead.measured) {', 'guestPhotoDisplayUrls(guestsRaw)', 'the 3D plan draws first');
  const tea = src('app/dashboard/[eventId]/guests/tea-ceremony/page.tsx');
  before(tea, '{!guestsRead.measured ? (', '<EmptyState eventId={eventId} />', 'the tea ceremony says "add your families" first');
});
