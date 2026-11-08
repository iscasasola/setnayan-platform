/**
 * 📌 THE PICKED HEAD CARRIES THE CHAT'S ACTIONS (v8.3, approved 9 Nov — "okay approved"; Build 3 · Lane A round 2).
 *
 * v8.3 draws ONE head row on a picked page's Chat — title · 📞 · 🎥 · 📎 · ⚙ · ✕ — then the page menu (with the Chat tab's
 * unread badge), then the conversation. There is no Chat · Decisions · Files row, no notice row, and the composer is
 * (+) · 🔒 · box · Send with the camera and photo inside the (+). This guard holds each of those:
 *
 *   1. the shell draws an action slot in its pinned row between the title and ⚙ and hands it down (`PickedHeadContext`);
 *   2. inside a picked shell the stream portals the booked calls and the 📎 into that slot, takes the calls OFF the host
 *      strip, draws no Chat · Decisions · Files switch, and opens Files + Decisions as a panel INSIDE the pinned stack;
 *   3. a picked chat draws no notice row — the privacy words sit behind the strip's ⓘ (`headNote` → `ChatPrivacyTip`);
 *   4. a composer with a (+) clips its 📷 · 🖼 shortcuts and the (+) sheet's Camera / Photo rows click their inputs;
 *      every picked chat lab mounts a (+);
 *   5. the Chat tab carries the unread count, read by ONE rule on both sides, and drops it once the tab is opened;
 *   6. the tab row is v8.3's size (66 px minimum, 13 px words, 20 px icons), so the sixth tab (Forms) peeks at 390.
 *
 * Sabotage (9 Nov 2026), each run once and restored: the slot moved after ⚙ → 1 RED · `calls={headCalls}` restored on the
 * strip → 2 RED · the panel moved below the stack → 2 RED · `notice={<ChatSafetyBanner inBox />}` unconditional on the
 * couple page → 3 RED · the shortcuts' `lead ? 'sr-only'` dropped → 4 RED · `seen.has(m.id) ? 0 :` dropped → 5 RED ·
 * `min-w-[66px]` back to `min-w-[64px]` → 6 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { unreadMessagesIn } from './couple-inbox';
import { ChatSendForm } from '@/app/_components/chat-send-form';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SHELL = read('app/_components/picked/picked-shell.tsx');
const STREAM = read('app/_components/chat-message-stream.tsx');
const VENDOR = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const COUPLE = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
const LAB = read('app/dev/_components/lab-picked-chat.tsx');
const SEND = read('app/_components/chat-send-form.tsx');
const SHEET = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');

test('1 · the pinned row is title · [the page actions] · ⚙ · ✕, and the slot is handed to the page', () => {
  const row = SHELL.slice(SHELL.indexOf('data-picked-pin=""'), SHELL.indexOf('data-picked-menu=""'));
  const at = (re: RegExp, what: string) => {
    const i = row.search(re);
    assert.ok(i >= 0, `the pinned row lost ${what}`);
    return i;
  };
  const title = at(/<h1\b/, 'its title');
  const slot = at(/ref=\{setHeadSlot\}[^>]*data-picked-head-actions=""/, 'the page-actions slot');
  const gear = at(/<MenuSettingsButton\b/, '⚙');
  const close = at(/data-testid="picked-close"/, '✕');
  assert.ok(title < slot && slot < gear && gear < close, 'the head row is not title · actions · ⚙ · ✕ (v8.3)');
  assert.match(SHELL, /<PickedHeadContext\.Provider value=\{headSlot\}>[\s\S]*\{bodies\[page\]\}[\s\S]*<\/PickedHeadContext\.Provider>/, 'the page body is not handed the head slot');
  assert.match(SHELL, /text-\[20px\] font-bold/, 'the title is not v8.3’s 20 px bold');
});

test('2 · inside a picked shell the calls and 📎 go to the head; no switch row; Files + Decisions open inside the stack', () => {
  assert.match(STREAM, /const headSlot = useContext\(PickedHeadContext\);\s*const inPicked = headSlot !== null;/);
  assert.match(STREAM, /<ChatHostStrip\b[^>]*\bcalls=\{inPicked \? null : headCalls\}/, 'the calls are drawn on the strip inside a picked page (v8.3: the head)');
  const portal = STREAM.slice(STREAM.indexOf('createPortal('), STREAM.indexOf('headSlot,', STREAM.indexOf('createPortal(')));
  assert.match(portal, /\{headCalls\}/, 'the head slot lost the calls');
  assert.match(portal, /icon=\{Paperclip\}[\s\S]*label="Files in this chat"[\s\S]*disabled=\{privateNow !== null\}/, 'the head lost the 📎, or it opens while private (words only)');
  assert.match(STREAM, /\{inPicked \? null : \(\s*<ThreadViewSwitch\b/, 'the Chat · Decisions · Files row is drawn inside a picked page');
  const stack = STREAM.slice(STREAM.indexOf('<ChatPinnedStack'), STREAM.indexOf('</ChatPinnedStack>'));
  assert.match(stack, /\{inPicked && filesOpen \? \([\s\S]*data-picked-files-panel=""[\s\S]*<FilesPanel\b[\s\S]*<DecisionsPanel\b/, 'the 📎 panel is not inside the pinned stack');
  assert.match(STREAM, /useState\(initialView !== 'all'\)/, 'a ?view=files|decisions link no longer lands with the panel open');
  assert.match(STREAM, /\{!inPicked && view === 'decisions' \?/, 'a picked chat can still swap the conversation for Decisions');
});

test('3 · a picked chat draws no notice row — the words sit behind the strip’s ⓘ', () => {
  assert.match(VENDOR, /\{embedded \? null : <ChatPrivacyNotice inBox viewer="vendor" \/>\}/, 'the supplier’s picked chat draws the notice row');
  assert.match(COUPLE, /notice=\{embedded \? null : <ChatSafetyBanner inBox \/>\}/, 'the host’s picked chat draws the notice row');
  assert.match(VENDOR, /headNote: <ChatPrivacyTip viewer="vendor" \/>/, 'the supplier’s locked privacy words became unreachable');
  assert.match(COUPLE, /headNote: <ChatPrivacyTip viewer="couple" \/>/, 'the host’s safety words became unreachable');
  assert.match(LAB, /notice=\{null\}/);
  assert.match(LAB, /headNote=\{<ChatPrivacyTip viewer=\{side\} \/>\}/);
  assert.match(STREAM, /<ChatHostStrip\b[^>]*\bnote=\{headNote\}/, 'the stream drops the ⓘ words');
  assert.match(read('app/_components/chat/chat-host-strip.tsx'), /\{note \? \(\s*<InfoTip\b/, 'the strip has no ⓘ for the words');
});

test('4 · with a (+) the camera and photo live inside it; every picked chat lab mounts a (+)', () => {
  assert.equal((SEND.match(/className=\{lead \? 'sr-only' : SHORTCUT\}/g) ?? []).length, 2, 'a 📷 / 🖼 shortcut is drawn beside the (+)');
  assert.match(SEND, /id=\{CHAT_CAMERA_INPUT_ID\}/);
  assert.match(SEND, /id=\{CHAT_PHOTO_INPUT_ID\}/);
  assert.match(SHEET, /key: 'camera'[^}]*attach: 'camera'/);
  assert.match(SHEET, /key: 'photo'[^}]*attach: 'photo'/);
  assert.match(SHEET, /const rows: readonly SheetRow\[\] = \[\.\.\.SHORTCUT_ROWS, \.\.\.ownRows\];/, 'the (+) sheet lost its Camera / Photo rows');
  assert.match(SHEET, /getElementById\(ATTACH_INPUT\[row\.attach === true \? 'file' : row\.attach\]\)\?\.click\(\)/);
  assert.match(SHEET, /export function ComposerPlusSheet\(\{ more = \[\]/, 'Lane B’s slot for the supplier’s (+) rows is gone');
  assert.match(LAB, /<ChatSendForm\b[\s\S]*?lead=\{side === 'couple' \? <CoupleThreadToolsSheet\b[^}]*\} \/> : <ComposerPlusSheet\b/, 'a picked chat lab has no (+)');

  const lead = React.createElement('button', { type: 'button', 'data-lab-plus': '' }, '+');
  const html = renderToStaticMarkup(React.createElement(ChatSendForm, { threadId: 't1', sendAction: async () => {}, lead }));
  assert.match(html, /<label class="sr-only" title="Camera" data-chat-camera="">/, 'the 📷 is visible beside a (+)');
  assert.match(html, /<label class="sr-only" title="Photo" data-chat-photo="">/, 'the 🖼 is visible beside a (+)');
  const bare = renderToStaticMarkup(React.createElement(ChatSendForm, { threadId: 't1', sendAction: async () => {} }));
  assert.doesNotMatch(bare, /<label class="sr-only" title="Camera"/, 'a composer with no (+) lost its visible 📷');
});

test('5 · the Chat tab carries the unread count — one rule, both sides — and drops it once opened', () => {
  assert.equal(unreadMessagesIn([{ created_at: '2026-11-09T10:00:00Z' }, { created_at: '2026-11-09T09:00:00Z' }], '2026-11-09T09:30:00Z'), 1);
  assert.equal(unreadMessagesIn([{ created_at: '2026-11-09T10:00:00Z' }], null), 1, 'never read ⇒ every message is unread');
  assert.equal(unreadMessagesIn([], '2026-11-09T09:30:00Z'), 0);
  assert.match(SHELL, /const count = seen\.has\(m\.id\) \? 0 : \(badges\[m\.id\] \?\? 0\);/, 'an opened tab keeps its badge');
  assert.match(SHELL, /\{count > 0 \? \(\s*<small\b[^>]*data-picked-badge=\{m\.id\}/, 'the tab row draws no badge');
  for (const rel of [
    'app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx',
  ]) {
    assert.match(read(rel), /badges=\{\{ chat: chatUnread \}\}/, `${rel}: the Chat tab has no badge`);
  }
  for (const rel of ['app/vendor-dashboard/clients/[eventId]/page.tsx', 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx']) {
    const src = read(rel);
    assert.match(src, /const chatUnreadP = \w+ \? readThreadUnreadCount\(supabase, user\.id, [\w.]+\) : Promise\.resolve\(null\);/, `${rel}: the badge is not the shared read`);
    assert.match(src, /chatUnread=\{await chatUnreadP\}/, `${rel}: the badge is read but not handed to the shell`);
  }
});

test('6 · the tab row is v8.3’s size, so the sixth tab peeks at 390', () => {
  const tab = SHELL.slice(SHELL.indexOf('role="tab"'), SHELL.indexOf('</button>', SHELL.indexOf('role="tab"')));
  assert.match(tab, /min-w-\[66px\]/, 'the tab is not v8.3’s 66 px minimum');
  assert.match(tab, /text-\[13px\] font-medium/, 'the tab’s word is not v8.3’s 13 px');
  assert.match(tab, /className="h-5 w-5"/, 'the tab’s icon is not v8.3’s 20 px');
  // v8.3: the picked tab is a gold border and ink words, no fill — a white fill under ink words vanishes in dark mode.
  assert.doesNotMatch(tab, /\bbg-white\b/, 'the picked tab has a white fill (its ink words disappear in dark mode)');
  assert.match(SHELL, /data-picked-menu=""/);
  assert.match(SHELL, /gap-0\.5 overflow-x-auto px-4/, 'the tab row lost v8.3’s 2 px gap / 16 px gutter');
});
