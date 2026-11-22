/**
 * 💬 UNICHAT PART H1 — what the SCREEN may offer for one message (approved Unichat prototype v3, DECISION_LOG
 * 2026-11-20: "Hold your own new message: Edit or Unsend." · 15 minutes · a voice note has Unsend only · "… unsent a
 * message"). The database decides again (`tests/db/your-own-message-edit-unsend-voice-and-reminders.db.test.ts`);
 * this holds the menu to the same rule, so a row is never offered that will only be refused.
 *
 * Run from apps/web: tsx --test lib/chat-message-extras.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_EDIT_WINDOW_MS,
  CHAT_VOICE_MAX_SECONDS,
  CHAT_VOICE_MIME,
  canOfferEdit,
  canOfferUnsend,
  isVoiceNote,
  messageChangeRefusal,
  messageChangeWords,
  pickVoiceMime,
  unsentLine,
  voiceFileName,
  voiceLength,
  voiceMimeOf,
  voiceSecondsFromForm,
} from './chat-message-extras';
import { CHAT_ATTACHMENT_ACCEPT, CHAT_ATTACHMENT_MIME } from './chat-attachment-limits';

const ME = 'me';
const NOW = Date.parse('2026-11-20T10:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const base = {
  sender_user_id: ME,
  created_at: ago(60_000),
  body: 'See you at 3',
  proposal_id: null,
  appointment_id: null,
  change_order_id: null,
  amendment_id: null,
  offered_service_id: null,
  vendor_offer_id: null,
  attachment_r2_key: null,
  attachment_url: null,
  attachment_mime: null,
  is_bot: false,
};
const voice = { ...base, body: '', attachment_r2_key: 'r2://setnayan-thread-files/chat/t/me/n.webm', attachment_mime: 'audio/webm', voice_seconds: 7 };

test('the window is the drawing’s: 15 minutes', () => {
  assert.equal(CHAT_EDIT_WINDOW_MS, 900_000);
});

test('Edit and Unsend are offered on your own new words — and on nobody else’s', () => {
  assert.equal(canOfferEdit(base, ME, NOW), true);
  assert.equal(canOfferUnsend(base, ME, NOW), true);
  assert.equal(canOfferEdit(base, 'someone-else', NOW), false);
  assert.equal(canOfferUnsend(base, 'someone-else', NOW), false);
  assert.equal(canOfferEdit({ ...base, sender_user_id: null }, ME, NOW), false, 'a system line has no sender');
  assert.equal(canOfferEdit(base, '', NOW), false, 'no viewer id is nobody');
});

test('after 15 minutes neither is offered', () => {
  const old = { ...base, created_at: ago(CHAT_EDIT_WINDOW_MS) };
  assert.equal(canOfferEdit(old, ME, NOW), false);
  assert.equal(canOfferUnsend(old, ME, NOW), false);
  const justInside = { ...base, created_at: ago(CHAT_EDIT_WINDOW_MS - 1000) };
  assert.equal(canOfferEdit(justInside, ME, NOW), true);
  assert.equal(canOfferEdit({ ...base, created_at: 'not a date' }, ME, NOW), false, 'an unreadable time is not "new"');
});

test('a card, a bot line and an unsent message are offered nothing', () => {
  for (const card of ['proposal_id', 'appointment_id', 'change_order_id', 'amendment_id', 'offered_service_id', 'vendor_offer_id'] as const) {
    const m = { ...base, [card]: card === 'vendor_offer_id' ? 4 : 'x' };
    assert.equal(canOfferEdit(m, ME, NOW), false, card);
    assert.equal(canOfferUnsend(m, ME, NOW), false, card);
  }
  assert.equal(canOfferEdit({ ...base, is_bot: true }, ME, NOW), false);
  assert.equal(canOfferUnsend({ ...base, is_bot: true }, ME, NOW), false);
  const gone = { ...base, body: '', unsent_at: ago(1000) };
  assert.equal(canOfferEdit(gone, ME, NOW), false);
  assert.equal(canOfferUnsend(gone, ME, NOW), false);
});

test('a voice note has Unsend only; a photo has neither (it leaves by its own swipe)', () => {
  assert.equal(isVoiceNote(voice), true);
  assert.equal(canOfferEdit(voice, ME, NOW), false);
  assert.equal(canOfferUnsend(voice, ME, NOW), true);
  const photo = { ...base, attachment_r2_key: 'r2://setnayan-thread-files/chat/t/me/p.jpg', attachment_mime: 'image/jpeg' };
  assert.equal(isVoiceNote(photo), false);
  assert.equal(canOfferEdit(photo, ME, NOW), false);
  assert.equal(canOfferUnsend(photo, ME, NOW), false);
  // An audio file with no length is not a voice note.
  assert.equal(isVoiceNote({ ...voice, voice_seconds: null }), false);
});

test('the quiet line is the drawing’s words', () => {
  assert.equal(unsentLine('you'), 'You unsent a message');
  assert.equal(unsentLine('Ana'), 'Ana unsent a message');
});

test('a voice note’s length reads m:ss', () => {
  assert.equal(voiceLength(7), '0:07');
  assert.equal(voiceLength(59), '0:59');
  assert.equal(voiceLength(61), '1:01');
  assert.equal(voiceLength(null), '0:00');
  assert.equal(voiceLength(6.6), '0:07');
});

test('the recorder’s type becomes a plain audio type the chat accepts — or nothing', () => {
  assert.equal(voiceMimeOf('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(voiceMimeOf('audio/mp4'), 'audio/mp4');
  assert.equal(voiceMimeOf('AUDIO/OGG; codecs=opus'), 'audio/ogg');
  assert.equal(voiceMimeOf('video/webm'), null);
  assert.equal(voiceMimeOf(''), null);
  assert.equal(pickVoiceMime((m) => m === 'audio/mp4'), 'audio/mp4', 'an iPhone');
  assert.equal(pickVoiceMime((m) => m.startsWith('audio/webm')), 'audio/webm;codecs=opus', 'Chrome');
  assert.equal(pickVoiceMime(() => false), null);
  assert.equal(
    pickVoiceMime(() => {
      throw new Error('unknown type');
    }),
    null,
  );
  for (const m of CHAT_VOICE_MIME) assert.match(voiceFileName(m), /^Voice note\.[a-z0-9]+$/);
});

test('every voice type is on the SERVER’s allowlist, and none is offered by the file picker', () => {
  for (const m of CHAT_VOICE_MIME) {
    assert.ok((CHAT_ATTACHMENT_MIME as readonly string[]).includes(m), `${m} would be refused at upload and at send`);
    assert.ok(!CHAT_ATTACHMENT_ACCEPT.split(',').includes(m), `${m} is offered by the picker — a voice note is recorded, not picked`);
  }
  assert.ok(!CHAT_ATTACHMENT_ACCEPT.includes('audio/'));
  // The picker still offers what it offered.
  for (const m of ['image/jpeg', 'application/pdf', 'video/mp4', '.docx']) assert.ok(CHAT_ATTACHMENT_ACCEPT.split(',').includes(m), m);
});

test('the posted length is whole seconds inside the cap, or nothing', () => {
  assert.equal(voiceSecondsFromForm('7'), 7);
  assert.equal(voiceSecondsFromForm('0'), 1);
  assert.equal(voiceSecondsFromForm('6.5'), 7);
  assert.equal(voiceSecondsFromForm('9999'), CHAT_VOICE_MAX_SECONDS);
  assert.equal(voiceSecondsFromForm(''), null);
  assert.equal(voiceSecondsFromForm('abc'), null);
  assert.equal(voiceSecondsFromForm(null), null);
  assert.equal(voiceSecondsFromForm(12), null, 'a form field is a string');
});

test('a database refusal becomes its reason, and its words — unknown text is never guessed at', () => {
  assert.equal(messageChangeRefusal('edit_my_chat_message: NOT_YOURS'), 'not_yours');
  assert.equal(messageChangeRefusal('unsend_my_chat_message: GONE — this message was already unsent'), 'gone');
  assert.equal(messageChangeRefusal('edit_my_chat_message: NOT_WORDS — only a message of words is edited'), 'not_words');
  assert.equal(messageChangeRefusal('edit_my_chat_message: FILED — …'), 'filed');
  assert.equal(messageChangeRefusal('edit_my_chat_message: WINDOW_CLOSED — …'), 'window_closed');
  assert.equal(messageChangeRefusal('edit_my_chat_message: EMPTY — a message needs words'), 'empty');
  assert.equal(messageChangeRefusal('edit_my_chat_message: TOO_LONG — max 4,000 characters'), 'too_long');
  assert.equal(messageChangeRefusal('edit_my_chat_message: CONTACT_BLOCKED — …'), 'contact_blocked');
  assert.equal(messageChangeRefusal('connection reset'), 'failed');
  assert.equal(messageChangeRefusal(null), 'failed');
  assert.match(messageChangeWords('edit', 'window_closed'), /edited for 15 minutes/);
  assert.match(messageChangeWords('unsend', 'window_closed'), /unsent for 15 minutes/);
  assert.match(messageChangeWords('edit', 'failed'), /Try again/);
  assert.match(messageChangeWords('unsend', 'failed'), /Try again/);
  for (const why of ['not_yours', 'gone', 'not_words', 'filed', 'window_closed', 'empty', 'too_long', 'contact_blocked', 'failed'] as const) {
    assert.ok(messageChangeWords('edit', why).length > 10);
    assert.ok(messageChangeWords('unsend', why).length > 10);
  }
});
