/**
 * THE MESSAGE MUST CARRY THE DOOR — the property this whole feature is for.
 *
 * A guest invitation that reaches somebody without their link is not a weaker
 * invitation; it is a broken one, and the couple only finds out after they have
 * pressed send. So the builder refuses to produce a message with no link, and
 * these tests hold that refusal rather than trusting the caller.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuestInviteMessage } from './guest-invite-message';

const BASE = {
  guestName: 'Indalecio Casasola',
  coupleNames: 'Cale & Ice',
  weddingDate: '2026-12-18',
  venue: 'Santuario de San Vicente de Paul Parish',
  inviteUrl: 'https://www.setnayan.com/cale-ice/invite?t=abc123',
};

test('🔑 the guest’s OWN link appears verbatim, exactly once', () => {
  const msg = buildGuestInviteMessage(BASE)!;
  assert.ok(msg.includes(BASE.inviteUrl), 'the door is missing from the message');
  assert.equal(msg.split(BASE.inviteUrl).length - 1, 1, 'the link is pasted twice');
  /* On its own line: a URL wrapped inside a sentence is what chat clients
     mangle when they auto-link, and what a reader skips. */
  assert.ok(msg.split('\n').includes(BASE.inviteUrl));
});

test('🔒 no link → NO MESSAGE, so a Copy button can never offer a dead invitation', () => {
  assert.equal(buildGuestInviteMessage({ ...BASE, inviteUrl: '' }), null);
  assert.equal(buildGuestInviteMessage({ ...BASE, inviteUrl: '   ' }), null);
});

test('⚖ the greeting is the FIRST name — a chat message, not a printed card', () => {
  /* Deliberate contrast with printedCardName (2026-09-16), which puts the
     formal name on paper. "Dear Atty. Indalecio Subia Casasola II" reads like
     a summons in a Viber thread. The surface decides. */
  const msg = buildGuestInviteMessage({ ...BASE, guestName: 'Atty. Indalecio Subia Casasola II' })!;
  assert.match(msg, /^Dear Atty\.,/, 'the greeting takes the first word as written');
  const plain = buildGuestInviteMessage(BASE)!;
  assert.match(plain, /^Dear Indalecio,/);
});

test('a nameless guest still gets a sendable message', () => {
  const msg = buildGuestInviteMessage({ ...BASE, guestName: '   ' })!;
  assert.match(msg, /^Hello,/);
  assert.ok(msg.includes(BASE.inviteUrl));
});

test('the date and venue elide cleanly rather than pasting "Invalid Date"', () => {
  const noDate = buildGuestInviteMessage({ ...BASE, weddingDate: null, venue: null })!;
  assert.doesNotMatch(noDate, /Invalid Date|null|undefined/);
  assert.match(noDate, /are getting married, and we would love/);

  const bad = buildGuestInviteMessage({ ...BASE, weddingDate: 'not-a-date' })!;
  assert.doesNotMatch(bad, /Invalid Date/);
  /* Venue survives on its own when the date cannot be read. */
  assert.ok(bad.includes(BASE.venue));
});

test('a ceremonial role is named; a plain guest gets no invented title', () => {
  const ninong = buildGuestInviteMessage({ ...BASE, role: 'principal_sponsor_ninong' })!;
  assert.match(ninong, /as our Ninong/);

  const guest = buildGuestInviteMessage({ ...BASE, role: 'guest' })!;
  assert.doesNotMatch(guest, /Ninong|Ninang|Best Man|Maid of Honour|bridesmaids|groomsmen/);

  /* An unknown role must add nothing rather than throw — roles grow. */
  const future = buildGuestInviteMessage({ ...BASE, role: 'role_invented_next_year' })!;
  assert.doesNotMatch(future, /undefined/);
  assert.ok(future.includes(BASE.inviteUrl));
});
