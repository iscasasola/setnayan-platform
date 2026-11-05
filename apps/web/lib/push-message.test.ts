/**
 * push-message.test.ts — EVERY PHONE NOTIFICATION READS WELL.
 *
 * Owner, 2026-10-31: "Also fix the way how the notification messages the phones".
 * Runs the ONE template (`lib/push-message.ts`) — properties, not phrasing:
 *   1 · the title is who it is about: the event, the shop, or "Setnayan";
 *   2 · no internal words reach the phone (uuid, S89 id, snake_case, a link),
 *       and "celebration" reads "event";
 *   3 · ~40 / ~110 characters, cut at a word — never through a name;
 *   4 · the tap is a same-origin path, never off-site, never "/";
 *   5 · one collapse key per kind, and a Web Push Topic that is ≤32 URL-safe chars;
 *   6 · every pushed type's bell title is turned into a phone sentence — and the
 *       titles parsed are the ones the emit sites write (read from them).
 *
 * SABOTAGE (seen red, then restored): removed the SNAKE scrub (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  fitWords,
  noticeSentence,
  pushMessage,
  pushWireBody,
  scrubInternal,
  topicFor,
} from './push-message';

const EV = '11111111-2222-4333-8444-555555555555';

test('1 · the title is who it is about', () => {
  const m = (subject: Parameters<typeof pushMessage>[0]['subject']) =>
    pushMessage({ subject, sentence: 'x', url: '/dashboard', collapseKey: 'k:1', level: 'normal' }).title;
  assert.equal(m({ kind: 'event', name: 'Indalecio & Claire' }), 'Indalecio & Claire');
  assert.equal(m({ kind: 'shop', name: 'Luz Photography' }), 'Luz Photography');
  assert.equal(m({ kind: 'account' }), 'Setnayan');
  assert.equal(m({ kind: 'event', name: null }), 'Setnayan', 'a refused name read must not print a blank title');
});

test('2 · no internal words reach the phone', () => {
  const dirty = `Order S89O-7K2M9QX4PA for ${EV} is order_awaiting_reconciliation — see https://x.test/a for the celebration`;
  const clean = scrubInternal(dirty);
  assert.ok(!/S89O|1111|_|https?:/.test(clean), clean);
  assert.match(clean, /for the event$/);
});

test('3 · lock-screen lengths, cut at a word', () => {
  const long = 'Maria Santos-Dela Cruz and the whole Reyes family from Batangas replied that they are all coming to the reception';
  const body = fitWords(long, PUSH_BODY_MAX);
  assert.ok(body.length <= PUSH_BODY_MAX, `${body.length}`);
  assert.ok(body.endsWith('…'));
  assert.ok(long.startsWith(body.slice(0, -1)), 'the cut invented text');
  assert.ok(/\s/.test(long[body.length - 1] ?? ' '), 'cut through a word');
  const title = pushMessage({ subject: { kind: 'event', name: 'Indalecio Casasola & Claire Marie Villanueva-Santos' }, sentence: 'x', url: '/d', collapseKey: 'k', level: 'normal' }).title;
  assert.ok(title.length <= PUSH_TITLE_MAX, title);
  assert.ok(!/\bVillanueva-Sa…$/.test(title), title);
});

test('4 · the tap is a same-origin path', () => {
  const at = (url: string | null) => pushMessage({ subject: { kind: 'account' }, sentence: 'x', url, collapseKey: 'k', level: 'normal', fallbackUrl: '/dashboard/x' }).url;
  assert.equal(at('/dashboard/x/guests'), '/dashboard/x/guests');
  assert.equal(at('https://evil.test/'), '/dashboard/x');
  assert.equal(at('//evil.test/'), '/dashboard/x');
  assert.equal(at(null), '/dashboard/x');
});

test('5 · collapse key and Topic', () => {
  const t = topicFor(`rsvp:${EV}`);
  assert.ok(t.length <= 32 && /^[A-Za-z0-9_-]+$/.test(t), t);
  assert.equal(t, topicFor(`rsvp:${EV}`));
  assert.notEqual(t, topicFor('rsvp:22222222-2222-4333-8444-555555555555'));
  const wire = JSON.parse(pushWireBody(pushMessage({ subject: { kind: 'account' }, sentence: 'x', url: '/a', collapseKey: `rsvp:${EV}`, level: 'normal', badge: 3 })));
  assert.deepEqual(Object.keys(wire).sort(), ['badge', 'body', 'tag', 'title', 'url']);
  assert.equal(wire.tag, `rsvp:${EV}`);
  assert.equal(wire.badge, 3);
});

test('5b · a kind with no sentence of its own says the bell\'s headline, scrubbed', () => {
  const n = noticeSentence({ type: 'order_quoted', title: 'Order S89O-7K2M9QX4PA quoted at ₱1,500', body: 'x', relatedUrl: '/a', eventId: null });
  assert.equal(scrubInternal(n.sentence), 'Order quoted at ₱1,500');
  assert.equal(n.collapseKey, 'order_quoted:/a');
});

test('6 · every pushed type becomes a phone sentence, from the titles the emit sites write', () => {
  const s = (type: string, title: string, body: string | null, relatedUrl: string | null, eventId: string | null = null) =>
    noticeSentence({ type, title, body, relatedUrl, eventId });
  assert.deepEqual(s('chat_message', 'New message from Luz Photography', 'Can we move the shoot to 3pm?', `/dashboard/${EV}/messages/t1`, EV), {
    sentence: 'Luz Photography: Can we move the shoot to 3pm?',
    collapseKey: 'chat:t1',
  });
  assert.equal(s('vendor_inquiry_received', 'New booking inquiry', 'Hi! Are you free on 12 Dec?', '/vendor-dashboard/messages/t2').sentence, 'New inquiry: “Hi! Are you free on 12 Dec?”');
  assert.equal(s('vendor_inquiry_received', 'New booking inquiry — from a Setnayan founder', 'This inquiry comes from a founder of Setnayan. Hello!', '/vendor-dashboard/messages/t3').sentence, 'New inquiry from a Setnayan founder: “Hello!”');
  assert.equal(s('vendor_inquiry_received', 'A past client wants to book you again', 'They asked to re-book your service for a new event. Open it to re-quote or decline.', '/vendor-dashboard/proposals').sentence, 'A past client wants to book you again');
  assert.equal(s('inquiry_accepted', 'Luz Photography accepted your inquiry', 'Your chat is open.', `/dashboard/${EV}/messages/t1`, EV).sentence, 'Luz Photography accepted your inquiry — say hello.');
  assert.equal(s('security_alert', 'Security alert on your Setnayan account', 'Your password was changed. When: today.', '/dashboard/profile').sentence, 'Your password was changed.');
  assert.equal(s('security_alert', 'A guest replaced their QR code', 'Ana issued themselves a new QR.', `/dashboard/${EV}/invitation`, EV).sentence, 'A guest replaced their QR code');

  // The emit sites — a reworded title must fail HERE, not on a phone.
  const chat = readFileSync(join(process.cwd(), 'lib', 'chat-actions.ts'), 'utf8');
  assert.match(chat, /title: `New message from \$\{(eventName|vendorName)\}`/);
  assert.match(chat, /`\$\{vendorName\} accepted your inquiry`/);
  const founder = readFileSync(join(process.cwd(), 'lib', 'founder-seats.ts'), 'utf8');
  assert.match(founder, /'This inquiry comes from a founder of Setnayan\. '/);
});
