/**
 * A REQUESTER HOLDS THEIR OWN KEY — AND IT UNLOCKS ONLY WHEN THE COUPLE ACCEPTS
 * (owner 2026-09-29, DECISION_LOG "A REQUESTER GETS THEIR QR AT ONCE; IT UNLOCKS
 * ONLY WHEN THE COUPLE ACCEPTS" · "IT IS THEIR DIGITAL TICKET, IN A 'REQUEST
 * PENDING' STATE" · "NO EMAIL TO GUESTS"; prototype
 * `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html` frames B–E, G1–G2, H1–H3).
 *
 * The decision is pure and executed here; the source checks below pin that every
 * door that reads a key asks it LIVE — the redeem hop, the request screen, the
 * pending ticket, the check-in desk and its server action — and that the
 * request's key is never a guest session.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  DOOR_WORDS,
  REQUEST_WORDS,
  UNDO_WINDOW_MS,
  doorVerdict,
  linkedIntoFrom,
  linkedIntoTag,
  requestKeyState,
  undoStillOpen,
} from './request-key';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const T = '11111111-2222-4333-8444-555555555555';

test('the key’s state, live from the row: pending · accepted · linked · declined · none', () => {
  assert.equal(requestKeyState({ entry_source: 'self_added_unlisted', deleted_at: null }).kind, 'pending');
  assert.equal(requestKeyState({ entry_source: 'host_seeded', deleted_at: null }).kind, 'accepted', 'Accept (Keep) did not unlock the key');
  assert.deepEqual(requestKeyState({ entry_source: 'self_added_unlisted', deleted_at: 'x', custom_tags: [linkedIntoTag(T)] }), { kind: 'linked', into: T });
  assert.equal(requestKeyState({ entry_source: 'self_added_unlisted', deleted_at: 'x', custom_tags: [] }).kind, 'declined');
  assert.equal(requestKeyState({ entry_source: 'host_seeded', deleted_at: 'x' }).kind, 'none', 'a removed list guest’s key opens something');
  assert.equal(requestKeyState(null).kind, 'none');
});

test('the Link forward honours only a well-formed guest id', () => {
  assert.equal(linkedIntoFrom([linkedIntoTag(T)]), T);
  assert.equal(linkedIntoFrom(['linked_into:not-a-uuid', 'linked_into:']), null);
  assert.equal(linkedIntoFrom(['vip', `x${linkedIntoTag(T)}`]), null);
  assert.equal(linkedIntoFrom(null), null);
});

test('the door: valid admits the seat now held (a Linked request → the guest it joined), pending and declined never admit', () => {
  assert.deepEqual(doorVerdict({ guest_id: 'g', entry_source: 'host_seeded', deleted_at: null }), { kind: 'valid', guestId: 'g' });
  assert.deepEqual(doorVerdict({ guest_id: 'r', entry_source: 'self_added_unlisted', deleted_at: 'x', custom_tags: [linkedIntoTag(T)] }), { kind: 'valid', guestId: T });
  assert.equal(doorVerdict({ guest_id: 'r', entry_source: 'self_added_unlisted', deleted_at: null }).kind, 'pending');
  assert.equal(doorVerdict({ guest_id: 'r', entry_source: 'self_added_unlisted', deleted_at: 'x' }).kind, 'declined');
  assert.equal(doorVerdict(null).kind, 'unknown');
});

test('Undo stays for a moment, then closes', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');
  assert.equal(undoStillOpen('2026-09-29T11:59:30Z', now), true);
  assert.equal(undoStillOpen(new Date(now - UNDO_WINDOW_MS - 1).toISOString(), now), false);
  assert.equal(undoStillOpen(null, now), false);
  assert.equal(undoStillOpen('2026-09-29T12:05:00Z', now), false, 'a future stamp is not "just now"');
});

test('the words are the approved prototype’s, verbatim', () => {
  assert.equal(REQUEST_WORDS.sentTitle, 'Sent to the couple');
  assert.equal(REQUEST_WORDS.waiting, 'Waiting for the couple to confirm you');
  assert.equal(REQUEST_WORDS.declined, 'Sorry, your request was not approved.');
  assert.equal(REQUEST_WORDS.inTitle, 'You’re in!');
  assert.equal(REQUEST_WORDS.saveUpdated, 'Save your Digital ticket');
  assert.equal(REQUEST_WORDS.band, 'Request pending');
  assert.equal(REQUEST_WORDS.notValid, 'Not valid at the door yet');
  assert.equal(DOOR_WORDS.valid, 'Valid ticket');
  assert.equal(DOOR_WORDS.pending, 'Not confirmed yet');
  assert.equal(DOOR_WORDS.declined, 'Not approved');
  assert.equal(DOOR_WORDS.checkedLive('3:14 PM', 119, 142), 'Checked live at 3:14 PM · 119 of 142 arrived');
});

// ── The doors that read a key ask it LIVE ───────────────────────────────────

test('🔒 redeem: a pending or declined key is remembered as a REQUEST and never becomes a guest session', () => {
  const r = read('app/[slug]/redeem/route.ts');
  const ask = r.indexOf('const keyState = requestKeyState(keyRow)');
  const session = r.indexOf('await setGuestSession(');
  assert.ok(ask > -1 && session > ask, 'the redeem hop mints a session before asking the key’s state');
  const gate = r.slice(ask, session);
  assert.match(gate, /keyState\.kind === 'pending' \|\| keyState\.kind === 'declined'\) \{\s*await rememberRequestKey\([^)]*\);\s*return NextResponse\.redirect\(new URL\(`\/\$\{event\.slug\}\/request`/);
  assert.match(gate, /keyState\.kind === 'none'\) \{\s*target\.searchParams\.set\('invite_error', 'invalid_token'\)/, 'a removed list guest’s key opens their page');
  assert.match(gate, /\.eq\('guest_id', keyState\.into\)[\s\S]{0,120}\.is\('deleted_at', null\)/, 'a Linked key is not forwarded to a live guest');
  assert.match(r, /if \(wasRequest\) \{\s*await forgetRequestKey\(\);\s*return NextResponse\.redirect\(new URL\(`\/\$\{event\.slug\}\/invite\/enter\?in=1`/);
});

test('🔒 the join door hands the key on Send — its OWN cookie, never a guest session, and no email box', () => {
  const a = read('app/join/[eventId]/actions.ts');
  const sent = a.slice(a.indexOf('async function requestSent('), a.indexOf('export async function joinEventAction'));
  assert.match(sent, /await rememberRequestKey\(key\);\s*redirect\(`\/\$\{slug\}\/request\?sent=1`\)/);
  assert.doesNotMatch(sent, /setGuestSession/, 'a request mints a guest session — it would be inside');
  assert.equal((a.match(/return requestSent\(admin, eventId, token, requestId\)/g) ?? []).length, 2, 'a request path does not hand over the key');
  const form = read('app/join/[eventId]/_components/request-form.tsx');
  assert.doesNotMatch(form, /contact_email|type="email"/, 'the request asks for an email again');
  assert.doesNotMatch(read('lib/guest-requests.ts'), /formData\.get\('contact_email'\)|text\(fd, 'contact_email'/);
});

test('🔒 the request screen reads only THIS browser’s remembered key, and sends an accepted one through redeem', () => {
  const p = read('app/[slug]/request/page.tsx');
  assert.match(p, /const key = await readRememberedRequest\(event\.event_id as string\)/);
  assert.doesNotMatch(p, /searchParams[\s\S]{0,40}(token|guest)/, 'the screen takes a key from the address');
  assert.match(p, /key\.state\.kind === 'accepted' \|\| key\.state\.kind === 'linked'\) \{\s*redirect\(`\/\$\{home\}\/redeem/);
  for (const w of ['sentTitle', 'waiting', 'declined', 'saveThis']) assert.match(p, new RegExp(`REQUEST_WORDS\\.${w}\\b`), `frame copy ${w} is not drawn`);
  assert.match(p, /<TicketRow\s+href=\{REQUEST_TICKET_ROUTE\}/, 'frame B draws no pending ticket');
});

test('🔒 the pending ticket is drawn only while pending, and the card says so', () => {
  const r = read('app/api/guest/request-ticket/route.ts');
  assert.match(r, /if \(key\.state\.kind !== 'pending'\) return new NextResponse\(PASS_CARD_REFUSED, \{ status: 404 \}\)/);
  assert.match(r, /renderPassCardFor\(kit, target, 'classic', \{ pending: REQUEST_WORDS\.bandSub\(couple\) \}\)/);
  const layout = read('lib/print-layout.ts');
  assert.match(layout, /pass\.pending \? 'Not valid at the door yet' : undefined/);
  assert.match(layout, /fitLine\(ops, 'Request pending',/);
  assert.match(layout, /const facts = pass\.pending \? \[/, 'a pending ticket still prints Table / Arrive');
  const server = read('lib/pass-card.server.ts');
  assert.match(server, /seat: null, arrive: null, party: 0, bringing: null, pending: opts\.pending/);
});

test('🔒 the door scanner asks the server LIVE on every scan, and check-in itself refuses a request', () => {
  const desk = read('app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx');
  const on = desk.slice(desk.indexOf('const onToken = useCallback('), desk.indexOf('// ---- NFC tag reader'));
  assert.match(on, /const check = await checkTicketLive\(eventId, token\)/, 'a scan is judged from the list loaded earlier');
  assert.ok(on.indexOf('checkTicketLive') < on.indexOf('setSelectedId(check.guestId)'), 'a guest is selected before the live answer');
  assert.match(on, /check\.verdict === 'pending' \|\| check\.verdict === 'declined'\) \{\s*setSelectedId\(null\)/);
  assert.match(desk, /DOOR_WORDS\.checkedLive\(/, 'the desk does not say it checked live');
  const actions = read('app/dashboard/[eventId]/guests/checkin/actions.ts');
  const checkIn = actions.slice(actions.indexOf('export async function checkInGuest'), actions.indexOf('export async function undoCheckIn'));
  assert.match(checkIn, /if \(doorVerdict\(guest as never\)\.kind !== 'valid'\) \{/, 'a pending request can be checked in by id');
  const live = actions.slice(actions.indexOf('export async function checkTicketLive'));
  assert.match(live, /await assertDoorCrew\(eventId\)/);
  assert.match(live, /const v = doorVerdict\(row as never\)/);
});

test('🔒 Link leaves the forward, and the Requests page words are Accept · Decline · Link with Undo', () => {
  const a = read('app/dashboard/[eventId]/guests/claims/actions.ts');
  const link = a.slice(a.indexOf('export async function linkGuestAction'));
  assert.match(link, /custom_tags: \[\.\.\.sourceTags, linkedIntoTag\(targetId\)\]/, 'a Linked request reads as Declined');
  assert.match(a, /export async function undoAcceptAction/);
  assert.match(a, /export async function undoDeclineAction/);
  const page = read('app/dashboard/[eventId]/guests/claims/page.tsx');
  assert.match(page, />\s*Accept\s*<\/summary>/);
  assert.match(page, />\s*Decline\s*<\/SubmitButton>/);
  assert.match(page, /Accepted · just now · their QR and link now open their invitation/);
  assert.match(page, /<SendInviteActions\b/, 'the accepted row has no Send invite · Copy message');
  assert.doesNotMatch(page, />\s*(Keep|Remove)\s*</, 'the old verbs are back');
});
