/**
 * a-message-has-its-extras.test.ts — 💬 UNICHAT PART H1, the wiring (approved Unichat prototype v3, DECISION_LOG
 * 2026-11-20): Edit · Unsend · Remind me on a bubble, the mic in an empty box, a voice note that plays in the bubble.
 *
 * The rules are held where they live (the database test, `lib/chat-message-extras.test.ts`). This holds the SCREENS to
 * them — each a thing that would otherwise fail by looking fine:
 *   • an unsent row must be drawn as its own line BEFORE the file rules (else it reads "a file was removed", or draws
 *     an empty bubble);
 *   • a voice note must be read through the chat's own attachment route and never be swiped away like a photo;
 *   • the menu is Edit · Unsend · Remind me only — the 🔒 is still the one private door (11 Nov), a tap still a heart;
 *   • the mic stands in for Send only where a file may be sent — never in private / whisper / words-only, never
 *     mid-edit, and never in a group chat (which takes no files yet);
 *   • mid-edit, Send SAVES the edit with the submit prevented — it must never also send a new message;
 *   • the writes go through the two database functions, never an UPDATE from the app.
 *
 * SABOTAGE (each seen red, restored): drop `&& !voice` from ownFile · add `voice` to the group composer · delete the
 * `e.preventDefault(); … return;` that keeps an edit out of the send action.
 *
 * Run from apps/web: tsx --test app/_components/chat/a-message-has-its-extras.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));
const STREAM = src('app', '_components', 'chat-message-stream.tsx');
const FORM = src('app', '_components', 'chat-send-form.tsx');
const MENU = src('app', '_components', 'chat', 'message-extras-menu.tsx');
const MIC = src('app', '_components', 'chat', 'voice-mic.tsx');
const ACTIONS = src('lib', 'chat-message-calls.ts');
const GROUP = src('app', 'samahan', 'chat', '[threadId]', '_components', 'group-chat-view.tsx');

test('an unsent message is its own quiet line, decided before any file rule', () => {
  const unsent = STREAM.indexOf('if (m.unsent_at) {');
  const words = STREAM.indexOf("const hasWords = (m.body ?? '').trim() !== '';");
  assert.ok(unsent > -1 && words > -1, 'the stream moved — this guard is blind');
  assert.ok(unsent < words, 'an unsent row reaches the file rules: it would read "a file was removed" or draw empty');
  const branch = STREAM.slice(unsent, words);
  assert.match(branch, /data-chat-unsent=""/);
  assert.match(branch, /unsentLine\(mine \? 'you' : /);
});

test('an edited message says so', () => {
  assert.match(STREAM, /m\.edited_at \? \([\s\S]{0,260}data-chat-edited=""[\s\S]{0,40}edited/);
});

test('a voice note plays in the bubble through the chat’s own route, and is not swiped away', () => {
  assert.match(STREAM, /const voice = hasFile && isVoiceNote\(m\);/);
  assert.match(STREAM, /const ownFile = mine && privateWith === null && hasFile && !voice;/, 'a voice note gets the photo swipe');
  assert.match(STREAM, /\{voice \? \(\s*<VoiceNote url=\{`\/api\/chat\/attachment\/\$\{m\.message_id\}`\}/, 'a voice note is not read through the attachment route');
});

test('the menu is Edit · Unsend · Remind me — offered by the shared rule, and no private door', () => {
  assert.match(STREAM, /canEdit=\{mine && privateWith === null && canOfferEdit\(m, currentUserId, Date\.now\(\)\)\}/);
  assert.match(STREAM, /canUnsend=\{mine && canOfferUnsend\(m, currentUserId, Date\.now\(\)\)\}/);
  const kinds = [...MENU.matchAll(/data-chat-extras="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['edit', 'unsend', 'remind']);
  assert.doesNotMatch(MENU, /private|Private|whisper/i, 'the menu grew a private door — the 🔒 beside the box is the one');
  // Holding opens the menu and must not ALSO heart the bubble.
  // The hold's own click is swallowed in the CAPTURE phase, before the bubble's tap runs — so the
  // bubble's onClick keeps its pinned shape (lib/a-bubble-is-not-a-decision.test.ts) and never hearts a hold.
  assert.match(STREAM, /onClickCapture: \(e: React\.MouseEvent\) => \{\s*if \(!extrasHeld\.current\) return;\s*extrasHeld\.current = false;\s*e\.stopPropagation\(\);/);
  // Reachable without a hold: a real button.
  assert.match(STREAM, /aria-label="More for this message"/);
});

test('a reminder that could not be read says so — it never looks like "no reminder"', () => {
  assert.match(MENU, /setReminder\(error \? null : /);
  assert.match(MENU, /reminder === null \? \([\s\S]{0,260}CHAT_REMINDERS_NOT_LOADED/);
});

test('the mic stands in for Send only where a file may be sent', () => {
  const mic = FORM.match(/const micShown = ([^;]+);/)?.[1] ?? '';
  for (const term of ['voice', 'voiceOk', 'Boolean(userId)', '!hasDraft', '!fileName', '!toolInBox', '!wordsMode', '!feeWordsOnly', '!editing']) {
    assert.ok(mic.split(' && ').includes(term), `micShown lost "${term}"`);
  }
  assert.match(FORM, /voice = false \}: Props\)/, 'the mic is on unless asked for — a group chat would get it');
  assert.doesNotMatch(GROUP, /\bvoice\b/, 'a group chat takes no files yet, and a voice note is a file');
  // One upload road: the recording rides the composer's own deliver, as `attachment`.
  const send = FORM.slice(FORM.indexOf('const sendVoice = '), FORM.indexOf('const micShown = '));
  assert.match(send, /formData\.set\('attachment', file\);/);
  assert.match(send, /formData\.set\(CHAT_VOICE_SECONDS_FIELD, String\(seconds\)\);/);
  assert.match(send, /void deliver\(formData, pending, true\);/);
  assert.doesNotMatch(MIC, /fetch\(|\/api\//, 'the mic uploads by itself — a second storage path');
});

test('everything that stops a recording says so', () => {
  for (const words of ['VOICE_HOLD_HINT', 'VOICE_MIC_REFUSED', 'VOICE_NOT_SUPPORTED', 'VOICE_NOT_RECORDED']) {
    assert.ok(MIC.split(`hintRef.current(${words})`).length > 1, `${words} is never said`);
  }
});

test('mid-edit, Send saves the edit and never sends a second message', () => {
  // Decided in onSubmit, FIRST, with the submit prevented: a prevented submit runs no form action — so nothing is
  // sent, and React does not reset the box under a refusal.
  assert.match(
    FORM,
    /onSubmit=\{\(e\) => \{\s*if \(editingRef\.current\) \{\s*e\.preventDefault\(\);\s*void saveEdit\(\);\s*return;\s*\}/,
    'an edit reaches the send action — it would also send a new message',
  );
  const save = FORM.slice(FORM.indexOf('const saveEdit = async () => {'), FORM.indexOf('const sendVoice = '));
  assert.ok(save.length > 100, 'the composer moved — this guard is blind');
  assert.match(save, /await editChatMessage\(edit\.messageId, words\)/);
  assert.doesNotMatch(save, /sendAction|deliver\(/, 'saving an edit sends a message');
  // A refusal keeps the words in the box and says why.
  assert.match(save, /if \(!out\.ok\) \{\s*setBlockError\(out\.message\);\s*return;\s*\}/);
});

test('the app writes through the two database functions — never an UPDATE of its own', () => {
  assert.match(ACTIONS, /rpc\('edit_my_chat_message', \{ p_message_id: messageId, p_body: trimmed \}\)/);
  assert.match(ACTIONS, /rpc\('unsend_my_chat_message', \{ p_message_id: messageId \}\)/);
  assert.doesNotMatch(ACTIONS, /from\('chat_messages'\)\s*\.(update|delete)\(/);
  assert.doesNotMatch(ACTIONS, /createAdminClient/, 'the service role is in the message actions — the caller’s own RLS no longer decides');
});
