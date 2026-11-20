/**
 * 🤫 A WHISPER NEVER REACHES THE SUPPLIER (DECISION_LOG 2026-11-19 — "MESSAGE ⇄ WHISPER APPROVED", "MIS-SEND REMINDER +
 * WHISPER TYPING", "WHISPER UN-PARKED"; drawing `prototypes/chat_send_to_private_2026-11-19.html`).
 *
 * The database half (the supplier's read returns no whisper row; the typing channel refuses the shop) is
 * `tests/db/a-whisper-never-reaches-the-supplier.db.test.ts`. This file holds the APP half — the parts a migration
 * cannot see:
 *
 *   1 · the list is the server's (`whisperRecipients`): never the sender, never a shop login, never a posted id;
 *   2 · the send core REFUSES a whisper nobody can hear, or from someone who is not a host — it never falls through to
 *       a line for everyone — and a refused whisper is a thrown error at the action (never a silent "sent");
 *   3 · while whispering, typing is never tracked on the chat's own presence channel, and the whisper-typing broadcast
 *       rides the event team's PRIVATE channel only;
 *   4 · the box: one box (＋ and Send inside), "Message" / "Whisper", no lock, the ＋ and every attach gone while
 *       whispering, the field posted only then; the 🔒 picker button is gone from a host's composer;
 *   5 · the mis-send reminder's words and its one ask;
 *   6 · the Send icon is the drawing's two paths and their order, on the motion table's speeds;
 *   7 · a line reads as a whisper only when its people are exactly the co-hosts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { PrivateMark, PrivateTime } from '@/app/_components/chat/private-message';
import { setChatPeople, setPrivateTo } from '@/app/_components/chat/private-to';
import { setWhisper } from '@/app/_components/chat/whisper-mode';
import { WhisperSendIcon } from '@/app/_components/chat/whisper-send-icon';
import { MOVE_MS, QUICK_MS, TAP_MS } from './motion-table';
import {
  BUBBLE_D,
  CHAT_WHISPER_FIELD,
  LEFT_WHISPER_ASK,
  PLANE_D,
  WHISPER_STRIP,
  creaseAt,
  dragFollowPx,
  dragSwitches,
  dragVerdict,
  everyoneWillSeeLine,
  isWhisperLine,
  leftWhisperAskBody,
  shapeAt,
  whisperFromForm,
  whisperRecipients,
  whisperTracks,
  whisperingLine,
} from './chat-whisper';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;
const send = async () => {};
const lead = h('button', { type: 'button', 'data-lab-plus': '' }, '+');
const WHISPER = { supplierName: 'Mang Ben', coHosts: 2 };

test('1 · the list is the server’s: the co-hosts in the chat, never the sender, never a shop login', () => {
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['a', 'b', 'c'], shopUserIds: ['s'], senderUserId: 'a' }), ['b', 'c']);
  // One login can host the event AND be on the shop's team — on this thread it is the supplier.
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['a', 'b', 's'], shopUserIds: ['s', 't'], senderUserId: 'a' }), ['b']);
  // Alone → nobody. The caller must refuse, never send.
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['a'], shopUserIds: ['s'], senderUserId: 'a' }), []);
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['a', 's'], shopUserIds: ['s'], senderUserId: 'a' }), []);
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['a', 'b', 'b', ''], shopUserIds: [], senderUserId: 'a' }), ['b']);
  // The posted field is a yes/no — never a list of people.
  assert.equal(whisperFromForm('1'), true);
  for (const raw of [null, '', '0', 'true', '00000000-0000-4000-8000-0000000000ee']) assert.equal(whisperFromForm(raw), false);
});

test('2 · the core decides who hears a whisper and REFUSES one nobody can hear — it never becomes a line for everyone', () => {
  const core = read('lib/chat-send.ts');
  const at = core.indexOf('if (input.whisper) {');
  assert.ok(at > 0, 'the send core no longer knows a whisper');
  const block = core.slice(at, core.indexOf('const privateList = (', at));
  // Only a host, only words, and the list comes from the thread's own rows.
  assert.match(block, /if \(senderRole !== 'couple' \|\| !coupleCheck\.data\) \{\s*return \{ ok: false, code: 'whisper_refused'/, 'someone who is not a host can whisper');
  assert.match(block, /if \(hasAttachment \|\| storedRef\) \{\s*return \{ ok: false, code: 'whisper_refused'/, 'a whisper can carry a file');
  assert.match(block, /readThreadHostPeople\(createAdminClient\(\), \{ threadId: thread\.thread_id, eventId: thread\.event_id \}\)/);
  assert.match(block, /whisperTo = whisperRecipients\(\{\s*hostMemberIds: hostPeople\.members,\s*shopUserIds: \[\.\.\.shop\.userIds, \.\.\.\(shop\.ownerUserId \? \[shop\.ownerUserId\] : \[\]\)\],\s*senderUserId: user\.id,/, 'the whisper list is not the server’s');
  // 🛑 The fence: nobody to hear it → refused. (Sabotage: delete this return and the next line makes it a shared message.)
  assert.match(block, /if \(whisperTo\.length === 0\) \{\s*return \{ ok: false, code: 'whisper_refused', message: WHISPER_NO_COHOSTS_MESSAGE \};\s*\}/, 'a whisper nobody can hear is not refused — it would be sent to everyone');
  assert.doesNotMatch(block, /input\.privateTo/, 'a posted recipient can shape a whisper');
  // The whisper's list REPLACES the posted one — it is read first, and the posted list only when there is no whisper.
  assert.match(core, /const privateList = \(\s*whisperTo \?\? \(input\.privateTo == null/, 'a posted private_to can widen a whisper');
  // The row is written with the list, like every private line: no other write shape exists for it.
  assert.match(core, /\.\.\.\(privateTo \? \(privateTo\.length === 1 \? \{ \[CHAT_PRIVATE_RECIPIENT_COLUMN\]: privateTo\[0\] \} : \{ \[CHAT_PRIVATE_RECIPIENTS_COLUMN\]: privateTo \}\) : \{\}\)/);
  // A private line never wakes the auto-reply and only its people are told — a whisper is one.
  assert.match(core, /senderRole === 'couple' && !privateTo && vendorAutoReplyEnabled\(\)/);
  // The action: the field is a yes/no, and a refused whisper THROWS (the composer says "Not sent") — it is not one of
  // the codes that return quietly, which the box would paint as sent.
  const action = read('lib/chat-actions.ts');
  assert.match(action, /const whisper = whisperFromForm\(formData\.get\(CHAT_WHISPER_FIELD\)\);/);
  const quiet = action.slice(action.indexOf("result.code === 'attachment_invalid'"), action.indexOf('throw new Error(result.message);'));
  assert.doesNotMatch(quiet, /whisper_refused/, 'a refused whisper returns quietly — the box would show it as sent');
});

test('3 · while whispering, typing never rides the chat’s channel — only the event team’s private one', () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  const local = stream.slice(stream.indexOf('const handleLocalTyping = useCallback('), stream.indexOf('const handleSendClear'));
  // The whisper branch comes FIRST, takes the shared flag down, and returns before any `broadcastTyping(true)`.
  const whisperAt = local.indexOf('if (readWhisper(threadId)) {');
  const sharedOn = local.indexOf('broadcastTyping(true)');
  assert.ok(whisperAt > 0 && sharedOn > whisperAt, 'typing is tracked on the shared channel before whisper is asked');
  const branch = local.slice(whisperAt, local.indexOf('tellWhisperTyping(false);', whisperAt));
  assert.match(branch, /if \(typingActiveRef\.current\) broadcastTyping\(false\);/, 'a whisperer keeps "is typing…" up for the supplier');
  assert.match(branch, /return;\s*\}\s*$/, 'the whisper branch falls through to the shared channel');
  assert.doesNotMatch(branch, /broadcastTyping\(true\)/, 'a whisperer is tracked as typing on the chat’s channel');
  // The only `track({ typing … })` calls are the join's `false` and `broadcastTyping` itself.
  assert.equal((stream.match(/channel\.track\(\{ typing/g) ?? []).length, 2, 'a new typing track on the chat’s channel');
  // Switching to Whisper takes a live "is typing…" down at once.
  assert.match(stream, /subscribeWhisper\(\(\) => \{[\s\S]{0,260}if \(readWhisper\(threadId\)\) \{\s*if \(typingActiveRef\.current\) broadcastTyping\(false\);/, 'words typed before the drag keep hinting to the supplier');
  // "X is whispering…" is drawn on the host's side only, and never with the shop's label.
  assert.match(stream, /if \(viewerRole !== 'couple'\) return;\s*const lapse = new Map/, 'the supplier’s stream listens for whispered typing');
  assert.match(stream, /senderNames\[userId\] \?\? 'A co-host'/, 'a whisperer can be named with the shop’s label');
  // The broadcast lives on the team channel's join and nowhere else; that channel is PRIVATE (the migration's predicate
  // admits hosts and moderators — proven against the schema in the db test).
  const join = read('app/dashboard/[eventId]/_components/event-team-presence-join.ts');
  assert.match(join, /supabase\.channel\(eventTeamTopic\(eventId\), \{\s*config: \{ private: true,/);
  assert.match(join, /channel\.send\(\{ type: 'broadcast', event: WHISPER_TYPING_EVENT, payload: \{ \.\.\.payload, userId: me\.id \} \}\)/);
  const mode = read('app/_components/chat/whisper-mode.ts');
  assert.doesNotMatch(mode, /supabase|\.channel\(/, 'the whisper store opened a channel of its own');
  assert.doesNotMatch(stream, /WHISPER_TYPING_EVENT/, 'the chat stream sends whispered typing on its own channel');
  assert.equal(whisperingLine('Maria'), 'Maria is whispering');
});

test('4 · one box: ＋ and Send inside it, "Message" / "Whisper", no lock, words only while whispering', () => {
  const T = 'thread-whisper-box';
  setChatPeople(T, [{ userId: '00000000-0000-4000-8000-0000000000ee', name: 'Jose' }]);
  setPrivateTo(T, null);
  setWhisper(T, false);
  const off = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead, whisper: WHISPER }));
  setWhisper(T, true);
  const on = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead, whisper: WHISPER }));
  // A composer the page offers no whisper on (the supplier's, a group) ignores the store entirely.
  const supplier = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead, sentAs: 'vendor' }));
  setWhisper(T, false);
  const alone = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead, whisper: { supplierName: 'Mang Ben', coHosts: 0 } }));

  // ONE box: the ＋ and Send are both inside the one row that is the box.
  const box = (m: string) => m.slice(m.indexOf('data-chat-one-box'), m.indexOf('</form>'));
  assert.ok(off.indexOf('data-chat-one-box') > 0, 'the composer is not one box');
  assert.ok(box(off).indexOf('data-lab-plus') > 0 && box(off).indexOf('data-lab-plus') < box(off).indexOf('name="body"'), 'the ＋ is not inside the box, at its left');
  assert.ok(box(off).indexOf('aria-label="Send"') > box(off).indexOf('name="body"'), 'Send is not inside the box, at its right');

  // Placeholders.
  assert.match(off, /placeholder="Message"/);
  assert.match(on, /placeholder="Whisper"/);
  assert.doesNotMatch(on, /placeholder="Message"/);

  // The mode, the field, the line.
  assert.match(off, /data-chat-whisper="off"/);
  assert.match(on, /data-chat-whisper="on"/);
  assert.doesNotMatch(off, new RegExp(`name="${CHAT_WHISPER_FIELD}"`), 'a normal message posts the whisper field');
  assert.match(on, new RegExp(`name="${CHAT_WHISPER_FIELD}" value="1"`), 'a whisper does not post its field');
  assert.match(on, /Whispering · co-hosts only · swipe to end/);
  assert.doesNotMatch(off, /Whispering/);

  // Words only: the ＋ and every attach are not on the page while whispering.
  assert.equal((on.match(/data-lab-plus/g) ?? []).length, 0, 'the ＋ is drawn while whispering');
  assert.doesNotMatch(on, /name="attachment"|data-chat-camera|data-chat-photo/, 'an attach is on the page while whispering');
  assert.equal((off.match(/data-lab-plus/g) ?? []).length, 1);

  // No lock anywhere on a host's composer — and its 🔒 picker button is gone (a face in the strip is still a door).
  for (const [name, m] of [['Message', off], ['Whisper', on]] as const) {
    assert.doesNotMatch(m, /lucide-lock|chat-private-open/, `${name}: a lock is drawn on the host’s box`);
  }
  // Send: ink at rest, sky blue while whispering, the plane / the whisper bubble.
  const sendBtn = (m: string) => m.slice(m.lastIndexOf('<button', m.indexOf('aria-label="Send"')), m.indexOf('</button>', m.indexOf('aria-label="Send"')));
  assert.match(sendBtn(off), /text-ink/);
  assert.doesNotMatch(sendBtn(off), /sn-accent/, 'Send is the brand colour at rest — the drawing’s is ink');
  assert.match(sendBtn(on), /color-private/);
  assert.match(sendBtn(off), /data-whisper-send-icon="plane"/);
  assert.match(sendBtn(on), /data-whisper-send-icon="whisper"/);

  // Where no whisper is offered: no mode, no field, no switch — and the store being ON changes nothing there.
  assert.doesNotMatch(supplier, /data-chat-whisper=|data-chat-whisper-switch|name="whisper"/, 'the supplier’s composer can whisper');
  // The drag has a keyboard twin, a real switch.
  assert.match(off, /role="switch" aria-checked="false"[^>]*data-chat-whisper-switch=""/);
  assert.match(on, /role="switch" aria-checked="true"/);
  assert.match(alone, /data-chat-whisper="off"/);

  // The drag is the BOX's, never Send's: a press that starts on a control inside the box is not a drag.
  const form = read('app/_components/chat-send-form.tsx');
  assert.match(form, /if \(target\.closest\('button, a, label, input'\)\) return;/, 'a drag can start on Send');
  assert.match(form, /endDrag\(d\.ours && dragSwitches\(e\.clientX - d\.x\)\)/);
  // …and the switch never sends: it sets the mode and nothing else.
  const sw = form.slice(form.indexOf('const switchWhisper = () => {'), form.indexOf('const hasPrivateTo'));
  assert.doesNotMatch(sw, /requestSubmit|sendAction|deliver\(/, 'switching Message ⇄ Whisper can send');
  // Nobody to whisper to → it does not turn on.
  assert.match(sw, /const blocked = whisperBlockedLine\(whisper\);\s*if \(blocked\) \{\s*sayForAMoment\(blocked\);\s*return;/);
  // A private recipient and a whisper are never on together.
  assert.match(form, /const canWhisper = Boolean\(whisper\) && !feeWordsOnly && !privateTo;/);

  // The drag itself.
  assert.equal(dragVerdict(3, 2), 'none');
  assert.equal(dragVerdict(30, 4), 'sideways');
  assert.equal(dragVerdict(6, 30), 'vertical');
  assert.equal(dragSwitches(39), false);
  assert.equal(dragSwitches(40), true);
  assert.equal(dragSwitches(-200), false, 'a drag to the LEFT switches');
  assert.equal(dragFollowPx(-50), 0);
  assert.ok(dragFollowPx(400) <= 12);
});

test('5 · the mis-send reminder: the line, and the one ask before the first Send', () => {
  assert.equal(everyoneWillSeeLine('Mang Ben'), 'Everyone will see this, including Mang Ben.');
  assert.equal(LEFT_WHISPER_ASK, 'You left Whisper. Send to everyone?');
  assert.equal(leftWhisperAskBody('Mang Ben'), 'Mang Ben will see it.');
  const form = read('app/_components/chat-send-form.tsx');
  // Armed only when the box holds words as it leaves Whisper.
  assert.match(form, /setWhisper\(threadId, false\);\s*const typed = \(textareaRef\.current\?\.value \?\? ''\)\.trim\(\)\.length > 0;\s*setLeftWithWords\(typed\);/);
  // The ask stops the Send BEFORE the action runs (the words stay), once.
  assert.match(form, /onSubmit=\{\(e\) => \{\s*if \(!leftWithWords \|\| askPassedRef\.current\) return;[\s\S]{0,160}e\.preventDefault\(\);\s*setAsking\(true\);/);
  assert.match(form, /title=\{LEFT_WHISPER_ASK\}[\s\S]{0,120}confirmLabel="Send"\s*cancelLabel="Cancel"/);
  // Cancel keeps the words: it sends nothing and clears nothing.
  const cancel = form.slice(form.indexOf('onCancel={() => {', form.indexOf('title={LEFT_WHISPER_ASK}')), form.indexOf('/>', form.indexOf('title={LEFT_WHISPER_ASK}')));
  assert.doesNotMatch(cancel, /requestSubmit|\.value = ''/, 'Cancel sends or clears');
  // Going back to Whisper, emptying the box, or sending, ends the reminder.
  assert.match(form, /if \(leftWithWords && el\.value\.trim\(\)\.length === 0\) setLeftWithWords\(false\);/);
});

test('6 · the Send icon is the drawing’s two outlines and its order, on the motion table', () => {
  assert.equal(PLANE_D, 'M4.6 4.48L19.9 11.72Q20.5 12 19.9 12.28L4.6 19.52Q4 19.8 4.19 19.23L6.41 12.57Q6.6 12 6.41 11.43L4.19 4.77Q4 4.2 4.6 4.48Z');
  assert.equal(BUBBLE_D, 'M7.5 4.5L16.5 4.5Q20 4.5 20 8L20 12.5Q20 16 16.5 16L7.5 16Q4 16 4 12.5L4 8Q4 4.5 7.5 4.5Z');
  // One path, the same commands in the same order — so it morphs.
  const shape = (d: string) => d.replace(/-?\d*\.?\d+/g, '#');
  assert.equal(shape(PLANE_D), shape(BUBBLE_D));
  assert.equal(shapeAt(0), PLANE_D);
  assert.equal(shapeAt(1), BUBBLE_D);
  assert.equal(shape(shapeAt(0.5)), shape(PLANE_D));
  assert.equal(creaseAt(0), 'translate(6.6 12) rotate(0) scale(1 1) translate(-6.6 -12)');
  assert.equal(creaseAt(1), 'translate(8 16) rotate(113) scale(0.6 1) translate(-6.6 -12)');

  const start = (on: boolean, key: string) => whisperTracks(on).find((t) => t.key === key)!.delay;
  const end = (on: boolean, key: string) => {
    const t = whisperTracks(on).find((x) => x.key === key)!;
    return t.delay + t.dur;
  };
  // ON: triangle → rounded square, THEN the line → the chat tip, THEN the dots one by one. Overlapping.
  assert.ok(start(true, 'shape') < start(true, 'crease') && start(true, 'crease') < start(true, 'dot0'));
  assert.ok(start(true, 'dot0') < start(true, 'dot1') && start(true, 'dot1') < start(true, 'dot2'), 'the dots do not show one by one');
  assert.ok(start(true, 'crease') < end(true, 'shape'), 'ON does not overlap');
  // OFF: the dots go FIRST (last first), THEN square → triangle, THEN the line completes the plane.
  assert.ok(start(false, 'dot2') < start(false, 'dot1') && start(false, 'dot1') < start(false, 'dot0'));
  assert.ok(end(false, 'dot0') <= start(false, 'shape') + TAP_MS, 'the square starts back before the dots have gone');
  assert.ok(start(false, 'dot2') < start(false, 'shape') && start(false, 'shape') < start(false, 'crease'));
  assert.ok(start(false, 'crease') < end(false, 'shape'), 'OFF does not overlap');
  // The speeds are the table's (Tap · Quick · Move) — the file types no millisecond of its own.
  assert.equal(whisperTracks(true).find((t) => t.key === 'shape')!.dur, MOVE_MS);
  assert.equal(start(true, 'crease'), QUICK_MS);
  const lib = read('lib/chat-whisper.ts');
  assert.doesNotMatch(lib, /\b\d+\s*ms\b|\b(?:delay|dur): [1-9]/, 'a hand-typed duration in the whisper order');
  // No bounce: neither curve overshoots.
  assert.match(lib, /bezier\(0\.45, 0, 0\.2, 1, x\) : bezier\(0\.2, 0\.8, 0\.2, 1, x\)/);
  // The component draws both resting icons without a frame, and holds still under reduced motion.
  const plane = renderToStaticMarkup(h(WhisperSendIcon, { on: false }));
  const bubble = renderToStaticMarkup(h(WhisperSendIcon, { on: true }));
  assert.ok(plane.includes(`d="${PLANE_D}"`) && bubble.includes(`d="${BUBBLE_D}"`));
  assert.equal((bubble.match(/data-whisper-dot=""/g) ?? []).length, 3);
  const icon = read('app/_components/chat/whisper-send-icon.tsx');
  assert.match(icon, /prefers-reduced-motion: reduce[\s\S]{0,200}pose\.current = rest\(on\);\s*paint\(pose\.current, on\);\s*return;/, 'reduced motion still morphs');
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const from = css.indexOf('.sn-chat-onebox {');
  const block = css.slice(from, css.indexOf('.meter-fill', from));
  assert.doesNotMatch(block, /\d+m?s\b/, 'a hand-typed duration in the one box’s CSS');
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-chat-onebox,\s*\.sn-whisper-send,\s*\.sn-chat-onebox-field \{ transition: none; \}/);
});

test('7 · a line is a whisper only when its people are exactly the co-hosts; its strip has no lock', () => {
  const co = ['b', 'c'];
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: ['b', 'c'] }, co, 'a'), true);
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'b', recipient_user_ids: ['a', 'c'] }, co, 'a'), true, 'a co-host’s whisper does not read as one');
  // Private to ONE co-host of two is a private line, not a whisper.
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: ['b'] }, co, 'a'), false);
  // Anyone off the host list (the supplier, a coordinator) → not a whisper.
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: ['b', 's'] }, co, 'a'), false);
  assert.equal(isWhisperLine({ sender_role: 'vendor', sender_user_id: 's', recipient_user_ids: ['a', 'b', 'c'] }, co, 'a'), false);
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: null }, co, 'a'), false, 'a shared line reads as a whisper');
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: ['b', 'c'] }, [], 'a'), false);
  assert.equal(isWhisperLine({ sender_role: 'couple', sender_user_id: 'a', recipient_user_ids: ['b', 'c'] }, null, 'a'), false);

  const strip = renderToStaticMarkup(h(PrivateMark, { privateWith: ['Ben', 'Cai'], whisper: true }));
  assert.match(strip, new RegExp(WHISPER_STRIP));
  assert.equal(WHISPER_STRIP, 'Whisper · co-hosts only');
  assert.doesNotMatch(strip, /<svg|Private ·/, 'a whisper’s strip wears a lock or the private words');
  assert.doesNotMatch(renderToStaticMarkup(h(PrivateTime, { at: '2026-11-19T02:05:00Z', alignEnd: true, whisper: true })), /<svg/, 'a whisper’s time row wears a lock');
  // A private line that is NOT a whisper keeps its lock and its names.
  assert.match(renderToStaticMarkup(h(PrivateMark, { privateWith: 'Jose' })), /Private · only you and Jose/);
  // The stream only ever calls a line a whisper on the host's side.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /const whisper = privateWith !== null && viewerRole === 'couple' && isWhisperLine\(m, whisperCoHostIds, currentUserId\);/);
  // …and the supplier's page hands the stream no co-host list and the composer no whisper.
  const supplierPage = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.doesNotMatch(supplierPage, /whisper/i, 'the supplier’s thread page knows about whisper');
});

test('8 · Chat send (motion #26): the sent line rises from the box in Move on Spring, fades on Settle, tokens only', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
  const from = css.indexOf('.sn-m-chat-send {');
  assert.ok(from > 0, 'Chat send has no rule');
  const block = css.slice(from, css.indexOf('.sn-m-row-wash', from));
  assert.match(block, /transition: translate var\(--sn-m-move\) var\(--sn-m-spring\), scale var\(--sn-m-move\) var\(--sn-m-spring\), opacity var\(--sn-m-move\) var\(--sn-m-settle\);/, 'Chat send is not Move on Spring with a Settle fade');
  assert.match(block, /@starting-style \{\s*\.sn-m-chat-send \{ translate: 0 40px; scale: 0\.9; opacity: 0; \}/, 'the line does not rise from the box');
  assert.doesNotMatch(block, /\d+m?s\b|cubic-bezier|@keyframes/, 'a raw time, a raw curve or a keyframe in Chat send');
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*@starting-style \{\s*\.sn-m-chat-send \{ translate: none; scale: none; \}/, 'reduced motion still travels');
  // Only the line being SENT plays it — a stored message arriving (or the whole thread on open) never does.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.equal((stream.match(/sn-m-chat-send/g) ?? []).length, 1);
  assert.match(stream, /className="sn-m-chat-send flex flex-col items-end" data-chat-pending=\{p\.state\}/);
});
