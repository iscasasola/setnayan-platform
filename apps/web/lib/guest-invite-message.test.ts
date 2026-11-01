/**
 * THE MESSAGE MUST CARRY THE DOOR — and say it in the event's own words.
 *
 * A guest invitation that reaches somebody without their link is not a weaker
 * invitation; it is a broken one, and the couple only finds out after they have
 * pressed send. So the builder refuses to produce a message with no link, and
 * these tests hold that refusal rather than trusting the caller.
 *
 * Owner, 2026-09-29 (DECISION_LOG): each guest gets their PERSONAL link, their
 * Digital ticket (owner 2026-09-30: the ticket, not the bare QR), "it opens our
 * Event Hub anytime". Never "website".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupInviteMessage,
  buildGuestInviteMessage,
  defaultInviteTemplate,
  formatInviteDate,
  inviteEventPhrase,
  sanitizeInviteTemplate,
  INVITE_TEMPLATE_MAX,
} from './guest-invite-message';

const NOW = new Date(Date.UTC(2026, 8, 29));
const BASE = {
  firstName: 'Maria',
  guestName: 'Maria Santos',
  hostsName: 'Indalecio & Claire',
  eventWord: 'wedding',
  eventDate: '2026-12-18',
  datePrecision: 'day',
  inviteUrl: 'https://www.setnayan.com/cale-ice?invite=abc123',
  now: NOW,
};

test('🔑 the approved message (2026-10-30): name, the couple’s wedding, the date, their own link, the Event Hub, signed', () => {
  const msg = buildGuestInviteMessage(BASE)!;
  assert.equal(
    msg,
    [
      'Hi Maria! 💌',
      '',
      'You’re invited to Indalecio & Claire’s wedding on Friday, December 18, and it simply wouldn’t be the same without you.',
      '',
      'Your invitation is ready. Tap to open it and let us know if you’re coming — it only takes a minute:',
      'https://www.setnayan.com/cale-ice?invite=abc123',
      '',
      'Inside is your ticket: it opens our Event Hub anytime, and it’s your pass at the door.',
      '',
      'This link was made just for you, so please keep it to yourself.',
      '',
      'We can’t wait to see you there. ✨',
      '',
      'Indalecio & Claire',
    ].join('\n'),
  );
  // The hosts' wording no longer carries the other website's phrases.
  assert.doesNotMatch(msg, /With joyful hearts|With love,|don’t forward/);
});

test('🔑 the guest’s OWN link appears verbatim, exactly once, on its own line', () => {
  const msg = buildGuestInviteMessage(BASE)!;
  assert.equal(msg.split(BASE.inviteUrl).length - 1, 1, 'the link is pasted twice (or not at all)');
  assert.ok(msg.split('\n').includes(BASE.inviteUrl));
});

test('🔒 no link → NO MESSAGE, so a Send button can never offer a dead invitation', () => {
  assert.equal(buildGuestInviteMessage({ ...BASE, inviteUrl: '' }), null);
  assert.equal(buildGuestInviteMessage({ ...BASE, inviteUrl: '   ' }), null);
  assert.equal(buildGroupInviteMessage({ ...BASE, joinUrl: '' }), null);
});

test('🔒 no message ever says "website" or "site" — it is an Event Hub (owner 2026-09-24)', () => {
  const all = [
    buildGuestInviteMessage(BASE)!,
    buildGuestInviteMessage({ ...BASE, ticketAttached: true })!,
    buildGuestInviteMessage({ ...BASE, voice: 'guest' })!,
    buildGuestInviteMessage({ ...BASE, solemn: true, eventWord: 'wake', hostsName: 'Lola Nena' })!,
    buildGroupInviteMessage({ ...BASE, joinUrl: 'https://www.setnayan.com/cale-ice/invite' })!,
    defaultInviteTemplate(),
    defaultInviteTemplate({ solemn: true }),
  ];
  for (const m of all) assert.doesNotMatch(m, /\bweb ?site\b|\bsite\b/i, m);
});

test('the ticket line is true in both paths — "(attached)" only when the share sheet attaches it', () => {
  // Owner 2026-09-30: "we do not copy the QR Code, we copy the Digital Ticket".
  const attached = buildGuestInviteMessage({ ...BASE, ticketAttached: true })!;
  assert.match(attached, /Your ticket is attached: it opens our Event Hub anytime, and it’s your pass at the door\./);
  const copied = buildGuestInviteMessage(BASE)!;
  assert.doesNotMatch(copied, /attached/);
  assert.match(copied, /Inside is your ticket: it opens our Event Hub anytime/);
  // The guest voice and the solemn wording keep their own ticket line.
  const passed = buildGuestInviteMessage({ ...BASE, voice: 'guest', ticketAttached: true })!;
  assert.match(passed, /Here’s your ticket for the event \(attached\) — it opens the Event Hub anytime/);
  assert.match(buildGuestInviteMessage({ ...BASE, voice: 'guest' })!, /Your ticket for the event is on that page too/);
  for (const m of [attached, copied]) assert.doesNotMatch(m, /QR/, 'the guest is handed the ticket, not a QR');
});

test('event-type aware: the name and the word the event type uses', () => {
  assert.equal(inviteEventPhrase({ hostsName: 'Mia', eventWord: 'birthday' }), 'Mia’s birthday');
  // The name already carries the word → never "…Birthday’s birthday".
  assert.equal(inviteEventPhrase({ hostsName: 'Mia’s 7th Birthday', eventWord: 'birthday' }), 'Mia’s 7th Birthday');
  // The generic word is dropped → never "Movie Night’s event".
  assert.equal(inviteEventPhrase({ hostsName: 'Movie Night', eventWord: 'event' }), 'Movie Night');
  // A name ending in s takes the bare mark.
  assert.equal(inviteEventPhrase({ hostsName: 'The Reyes', eventWord: 'reunion' }), 'The Reyes’ reunion');
  // No name → our (the couple sending) / the (a guest sending).
  assert.equal(inviteEventPhrase({ eventWord: 'debut' }), 'our debut');
  assert.equal(inviteEventPhrase({ eventWord: 'debut' }, 'guest'), 'the debut');
  // Nothing known → still a sentence.
  assert.equal(inviteEventPhrase({}), 'our event'); // "event", never "celebration" (DECISION_LOG 2026-10-04)
});

test('a wake is written in the solemn register — no "!", no 💌, no "invited"', () => {
  const msg = buildGuestInviteMessage({
    ...BASE,
    hostsName: 'Lola Nena',
    eventWord: 'wake',
    solemn: true,
  })!;
  assert.match(msg, /^Hi Maria\. We would be grateful to have you with us at the wake for Lola Nena on Friday, December 18\./);
  assert.doesNotMatch(msg, /!|💌|invited/);
  assert.ok(msg.includes(BASE.inviteUrl));
});

test('a missing, partial or unreadable date elides — never "on ." or "Invalid Date"', () => {
  for (const eventDate of [null, '', 'not-a-date', '2026-02-31']) {
    const msg = buildGuestInviteMessage({ ...BASE, eventDate })!;
    assert.match(msg, /invited to Indalecio & Claire’s wedding, and it simply/, String(eventDate));
    assert.doesNotMatch(msg, /Invalid Date|null|undefined| on \./);
  }
  // A date set only to the month is not written as a day.
  assert.equal(formatInviteDate('2026-12-01', 'month', NOW), null);
  // Another year shows the year; this year does not.
  assert.equal(formatInviteDate('2027-01-08', 'day', NOW), 'Friday, January 8, 2027');
  assert.equal(formatInviteDate('2026-12-18', null, NOW), 'Friday, December 18');
});

test('a nameless guest still gets a sendable message — "Hi!", never "Hi !"', () => {
  const msg = buildGuestInviteMessage({ ...BASE, firstName: '  ', guestName: '' })!;
  assert.match(msg, /^Hi! 💌/);
  assert.ok(msg.includes(BASE.inviteUrl));
  // First name wins; the display name's first word is only the fallback.
  assert.match(buildGuestInviteMessage({ ...BASE, firstName: null, guestName: 'Ana Cruz' })!, /^Hi Ana!/);
});

test('🛡 ESCAPING: a value is printed as typed and never expands — one pass, function replacer', () => {
  const msg = buildGuestInviteMessage({ ...BASE, firstName: '{link} $& $1', hostsName: '{date} & {name}' })!;
  assert.match(msg, /^Hi \{link\} \$& \$1! /);
  assert.match(msg, /invited to \{date\} & \{name\}’s wedding/);
  assert.equal(msg.split(BASE.inviteUrl).length - 1, 1, 'a name that says {link} pasted the link again');
});

test('the couple’s own wording fills itself — and still carries the door if they dropped {link}', () => {
  const own = 'Mabuhay {name}! Join us for {event} on {date}. {link}';
  assert.equal(
    buildGuestInviteMessage({ ...BASE, template: own }),
    `Mabuhay Maria! Join us for Indalecio & Claire’s wedding on Friday, December 18. ${BASE.inviteUrl}`,
  );
  const noLink = buildGuestInviteMessage({ ...BASE, template: 'See you there, {name}!' })!;
  assert.equal(noLink, `See you there, Maria!\n\n${BASE.inviteUrl}`);
  // Placeholders are case-insensitive — a phone keyboard capitalises.
  assert.match(buildGuestInviteMessage({ ...BASE, template: '{Name} {LINK}' })!, /^Maria https:/);
});

test('a guest passing their plus-one the key never sends the COUPLE’s wording', () => {
  const msg = buildGuestInviteMessage({ ...BASE, voice: 'guest', template: 'Couple-only words {link}' })!;
  assert.doesNotMatch(msg, /Couple-only words/);
  assert.match(msg, /opens the Event Hub anytime/);
  assert.doesNotMatch(msg, /our Event Hub/);
});

test('sanitize: blank is OURS (null), control characters go, the length is capped', () => {
  assert.equal(sanitizeInviteTemplate('   \n  '), null);
  assert.equal(sanitizeInviteTemplate(42), null);
  assert.equal(sanitizeInviteTemplate('a\r\nb\u0007c'), 'a\nbc');
  assert.equal(sanitizeInviteTemplate('x'.repeat(INVITE_TEMPLATE_MAX + 50))!.length, INVITE_TEMPLATE_MAX);
});

test('the group-chat message: reply with your full name, and we’ll confirm you — and no QR promise', () => {
  const url = 'https://www.setnayan.com/cale-ice/invite';
  const msg = buildGroupInviteMessage({ ...BASE, joinUrl: url })!;
  assert.match(msg, /^Hi everyone! 💌 You’re invited to Indalecio & Claire’s wedding on Friday, December 18\./);
  assert.match(msg, /Tap the link, reply with your full name, and we’ll confirm you:\nhttps:/);
  assert.doesNotMatch(msg, /QR|just for you/, 'the shared link is not a personal key and must not say so');
  assert.equal(msg.split(url).length - 1, 1);
});

test('💌 no names to sign with → the signature line goes whole, never a bare "With love," or a trailing blank', () => {
  const msg = buildGuestInviteMessage({ firstName: 'Maria', inviteUrl: 'https://www.setnayan.com/x?invite=1', eventWord: 'wedding' });
  assert.ok(msg);
  assert.doesNotMatch(msg!, /With love|\{hosts\}/);
  assert.match(msg!, /We can’t wait to see you there\. ✨$/, 'the message ends on a blank line where the names would be');
  // A couple's OWN wording from before 2026-10-30 ("With love,\n{hosts}") still drops its sign-off whole.
  const own = buildGuestInviteMessage({ firstName: 'Maria', inviteUrl: 'https://x.test/?invite=1', template: 'Hi {name}!\n{link}\n\nWith love,\n{hosts}' });
  assert.equal(own, 'Hi Maria!\nhttps://x.test/?invite=1');
});

test('💌 a guest passing their invite on keeps the plain wording — never signs as the couple', () => {
  const msg = buildGuestInviteMessage({ firstName: 'Ben', hostsName: 'Indalecio & Claire', eventWord: 'wedding', inviteUrl: 'https://www.setnayan.com/x?invite=2', voice: 'guest' });
  assert.ok(msg);
  assert.doesNotMatch(msg!, /With love/);
  assert.match(msg!, /You’re invited to/);
});
