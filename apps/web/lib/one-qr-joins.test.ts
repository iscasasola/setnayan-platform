/**
 * 🎟 ONE QR FOR EVERYONE — the TS half (the SQL half is
 * tests/db/one-qr-lets-a-signed-in-guest-in.db.test.ts).
 *
 * Owner rulings held here:
 *   · 2026-09-30 "THE RSVP IS OPTIONAL — AND AN EVENT CAN RUN ON ONE QR FOR
 *     EVERYONE": a person who scans the one QR and signs in is ADDED, no reply,
 *     no approval unless the host picks "I approve each one";
 *   · 2026-10-02 "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS ('YOUR
 *     INFO') — ONE HOME, MAPPED": "Will guests reply? / Entry" and the
 *     guest-list type are ONE dropdown in Your info over the SAME keys
 *     onboarding writes; the Guest list may show it, never set it.
 *
 * SABOTAGE (run 2026-10-02): making `oneQrLetsYouIn` ignore `approveEach`
 * turns tests 1 and 2 red; changing the door's gate to
 * `oneQrLetsYouIn(…) && false` turns test 4 red; giving the Invite panel a
 * `guestsGetInPatch` reference turns test 6 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oneQrLetsYouIn, sanitizeRsvpAskConfig, anyoneMayAskToJoin, readGuestsReply } from './rsvp-ask';
import { GUESTS_GET_IN_CHOICES, guestsGetInPatch, readGuestsGetIn, type GuestsGetIn } from './who-can-reply';
import { setupColumns } from './onboarding/event-insert';
import type { SetupAnswers } from './onboarding/setup-answers';
import { stripComments } from './strip-comments';

const APP = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

test('1 · only "No reply · one QR, no approval" lets a signed-in person straight in', () => {
  assert.equal(oneQrLetsYouIn({ guestsReply: false, whoCanRsvp: 'anyone' }), true);
  assert.equal(oneQrLetsYouIn({ guestsReply: false, whoCanRsvp: 'anyone', approveEach: false }), true);
  assert.equal(oneQrLetsYouIn({ guestsReply: false, whoCanRsvp: 'anyone', approveEach: true }), false);
  assert.equal(oneQrLetsYouIn({ whoCanRsvp: 'anyone' }), false, 'guests reply → a request, as before');
  assert.equal(oneQrLetsYouIn({ guestsReply: false, whoCanRsvp: 'guest_list' }), false, 'personal QR only');
  assert.equal(oneQrLetsYouIn({ guestsReply: false }), false);
  assert.equal(oneQrLetsYouIn(null), false);
  assert.equal(oneQrLetsYouIn({ guestsReply: 'false', whoCanRsvp: 'anyone' }), false, 'a string is not a boolean');
  // The key survives the sanitizer — a Maker save cannot drop it.
  assert.deepEqual(sanitizeRsvpAskConfig({ approveEach: true, junk: 1 }), { approveEach: true });
  assert.deepEqual(sanitizeRsvpAskConfig({ approveEach: 'yes' }), {});
});

test('2 · the one dropdown round-trips every choice through the stored keys', () => {
  for (const { value } of GUESTS_GET_IN_CHOICES) {
    const stored = sanitizeRsvpAskConfig({ meal: false, ...guestsGetInPatch(value) });
    assert.equal(readGuestsGetIn(stored), value, value);
    assert.equal(stored.meal, false, `${value}: the patch wiped another RSVP key`);
  }
  // Each patch sets all three keys, so merging it onto ANY base is exact.
  const stale = { guestsReply: false, whoCanRsvp: 'anyone', approveEach: true } as const;
  assert.equal(readGuestsGetIn({ ...stale, ...guestsGetInPatch('list') }), 'list');
  assert.equal(readGuestsGetIn({ ...stale, ...guestsGetInPatch('one_qr') }), 'one_qr');
  // Who is let in / may ask, per choice — the door reads the same keys.
  const door = (v: GuestsGetIn) => {
    const c = guestsGetInPatch(v);
    return [readGuestsReply(c), anyoneMayAskToJoin(c), oneQrLetsYouIn(c)];
  };
  assert.deepEqual(door('list'), [true, false, false]);
  assert.deepEqual(door('requests'), [true, true, false]);
  assert.deepEqual(door('personal'), [false, false, false]);
  assert.deepEqual(door('one_qr'), [false, true, true]);
  assert.deepEqual(door('one_qr_approve'), [false, true, false]);
});

test('3 · what onboarding wrote reads back as the same choice in Your info', () => {
  const base = { reply: 'yes', entry: 'one_qr', requests: false } as unknown as SetupAnswers;
  const cfg = (a: Partial<SetupAnswers>) => setupColumns({ ...base, where: null, whereText: '', look: 'house', ...a } as SetupAnswers).rsvp_ask_config;
  assert.equal(readGuestsGetIn(cfg({ reply: 'yes', requests: false })), 'list');
  assert.equal(readGuestsGetIn(cfg({ reply: 'yes', requests: true })), 'requests');
  assert.equal(readGuestsGetIn(cfg({ reply: 'no', entry: 'personal' })), 'personal');
  assert.equal(readGuestsGetIn(cfg({ reply: 'no', entry: 'one_qr' })), 'one_qr');
  assert.equal(readGuestsGetIn(cfg({ reply: 'no', entry: 'both' })), 'one_qr');
});

test('4 · the join door adds through the database, before any request is written', () => {
  const src = read('app/join/[eventId]/actions.ts');
  const body = src.slice(src.indexOf('export async function joinEventAction'), src.indexOf('export async function selfJoinAction'));
  const gate = body.indexOf('if (oneQrLetsYouIn(visRow.rsvp_ask_config))');
  const rpc = body.indexOf("admin.rpc('join_open_event_as_guest'");
  assert.ok(gate > -1 && rpc > gate, 'the one-QR add is not gated by oneQrLetsYouIn');
  assert.ok(rpc < body.indexOf('await createJoinRequest('), 'a request is written before the one-QR add is tried');
  assert.ok(body.indexOf('if (!anyoneMayAskToJoin(') < gate, 'the one-QR add runs before the door rule');
  assert.ok(body.indexOf("=== 'private'") < gate, 'the one-QR add runs before the private-event refusal');
  assert.ok(body.indexOf('supabase.auth.getUser()') < gate, 'the one-QR add runs before sign-in is checked');
  assert.match(body.slice(rpc, rpc + 200), /p_user_id: user\.id/, 'the add is for someone other than the signed-in account');
  assert.match(
    body.slice(rpc, rpc + 900),
    /if \(outcome === 'joined' \|\| outcome === 'member'\) \{\s*const dest = await enterAsGuest\(/,
    'a session is minted for an answer other than joined / member',
  );
  assert.match(body.slice(rpc, rpc + 1200), /outcome === 'locked'\) return backToDoor\(eventId, token, 'list_finalized'\)/);
  // The accountless door never auto-adds (no account to add).
  const self = src.slice(src.indexOf('export async function selfJoinAction'));
  assert.doesNotMatch(self, /join_open_event_as_guest/);
});

test('5 · the Event Hub offers one "Join as a guest" press to a signed-in stranger on a one-QR event', () => {
  const inside = read('app/[slug]/_components/get-inside.tsx');
  assert.match(inside, /if \(signedInNotListed && joinAction\)/);
  assert.match(inside, /<form action=\{joinAction\}>/);
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(
    body,
    /joinAction=\{\s*oneQrLetsYouIn\(event\.rsvp_ask_config\) \? joinEventAction\.bind\(null, event\.event_id, ''\) : undefined\s*\}/,
    'the one-QR button is offered on an event that does not let people straight in',
  );
});

test('6 · Your info sets it as ONE dropdown; the Guest list only shows it', () => {
  const maker = read('app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx');
  assert.match(maker, /options=\{guestsGetInOptions\(\)/);
  assert.equal((maker.match(/<PickMenu\s+label=\{GUESTS_GET_IN_LABEL\}/g) ?? []).length, 1, 'one dropdown, drawn once');
  assert.doesNotMatch(maker, /role="radiogroup"/, 'the setting is a pill row again');
  const invite = read('app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx');
  assert.match(invite, /guestsGetInLabel\(readGuestsGetIn\(/);
  assert.doesNotMatch(invite, /guestsGetInPatch|hubDraftAction/, 'the Guest list grew a writer for How guests get in');
});
