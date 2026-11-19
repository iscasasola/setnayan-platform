/**
 * 🧰 THE TOOL LIVES IN THE TEXT BOX · 💬 THE CHIPS FLOAT ABOVE IT (Unichat parts B + D, owner 20 Nov 2026 on the approved
 * live drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`: "build it now, I am happy with the design").
 *
 * What would silently undo it:
 *   1. the draft card is drawn twice (in the box AND at the foot of the stream), or the composer's send form swallows a
 *      card's own form (a form inside a form);
 *   2. the ← (the ＋, turned) slides away with the other tools while a tool is open, leaving no way back;
 *   3. on a computer the tool covers the chat instead of narrowing it;
 *   4. the chips push the box up again, lose Chat or Private, or typing stops landing back on All — or STARTS throwing
 *      you out of Private;
 *   5. Private touches who a whisper reaches (membership is the server's, and another build's).
 *
 * Source scans read through the repo's one comment stripper (lib/strip-comments.ts).
 * Run: cd apps/web && npx tsx --test lib/the-tool-lives-in-the-text-box.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const COMPOSER = read('app/_components/chat-send-form.tsx');
const STREAM = read('app/_components/chat-message-stream.tsx');
const DRAFT = read('app/_components/chat/plus-draft.tsx');
const CARD = read('app/_components/chat/chat-step-card.tsx');
const CSS = readFileSync(join(HERE, '..', 'app/globals.css'), 'utf8');

test('1 · one draft, one place: the composer draws the card, the stream only its toast — and the card sits OUTSIDE the send form', () => {
  assert.match(COMPOSER, /patchPlus\(threadId, \{ inBox: true \}\)/, 'the composer no longer says it holds the tool');
  assert.match(STREAM, /part=\{plusState\.inBox \? 'toast' : 'all'\}/, 'the stream draws the draft although the composer holds it');
  assert.match(COMPOSER, /<PlusDraft [^>]*part="draft" \/>/);
  assert.match(DRAFT, /part\?: 'all' \| 'toast' \| 'draft'/);
  // A draft the box holds is not pinned as a Running topic as well.
  assert.match(STREAM, /plusState\.draft && plusState\.inBox \? sentTopic : running/);
  // The tool wrap comes before the <form> in the composer's own wrapper — never inside it.
  const wrap = COMPOSER.indexOf('data-chat-tool-wrap=');
  const form = COMPOSER.indexOf('<form');
  assert.ok(wrap > 0 && form > wrap, 'the tool is drawn inside the send form (a form may not sit inside a form)');
  // A poll or a decision still rises full screen (CHAT-09): the composer never claims it.
  assert.match(COMPOSER, /plus\.draft && !RISING_DRAFTS\.has\(plus\.draft\.kind\) \? plus\.draft : null/);
});

test('2 · in the box the card drops its frame, and its Next / Send goes to the box’s own Send place', () => {
  assert.match(CARD, /const inBox = useContext\(ChatToolFrame\);\s*if \(inBox\) \{/);
  assert.match(CARD, /createPortal\(last \? sendButton : <ActionButton tone="brand" main icon=\{ChevronRight\} label="Next"[^)]*\/>, toolFrame\.sendSlot\)/);
  // The row while a tool is open: the tool's name and the Send place; the message field stays on the page, hidden.
  assert.match(COMPOSER, /data-chat-tool-label=""/);
  assert.match(COMPOSER, /ref=\{setSendSlot\}/);
  assert.match(COMPOSER, /\$\{toolInBox \? 'hidden' : 'flex'\}/, 'the message field is unmounted (the typed words would be lost) or still shown');
  // The ← must be there: the tools group never slides away while a tool is open.
  assert.match(COMPOSER, /const toolsAway = \(toolsOut \|\| whisperOn\) && !\(plus\.draft !== null && plus\.inBox/);
});

test('3 · a computer: the tiles and the tool are a third column on the chat’s frame, which narrows', () => {
  assert.match(COMPOSER, /const col3 = wide && chatBoxEl !== null && canHoldTool && \(tool !== null \|\| plus\.picker\);/);
  assert.match(COMPOSER, /chatBoxEl\.setAttribute\('data-chat-col3', ''\)/);
  assert.match(CSS, /\[data-chat-box\]\[data-chat-col3\] \{ position: relative; padding-right: min\(420px, 44%\); \}/, 'the chat no longer narrows beside the column');
  assert.match(CSS, /\.sn-chat-col3 \{[^}]*width: min\(420px, 44%\);/, 'the column and the room made for it differ — the chat would be covered');
  // In: Move (320 ms). Out: 80 % of it (256 ms). On Settle.
  assert.match(CSS, /\.sn-chat-toolwrap \{[^}]*transition: grid-template-rows calc\(var\(--sn-m-move\) \* 0\.8\) var\(--sn-m-settle\);/);
  assert.match(CSS, /\.sn-chat-toolwrap\[data-chat-tool-wrap='open'\] \{ grid-template-rows: 1fr; transition-duration: var\(--sn-m-move\); \}/);
  assert.match(CSS, /--sn-m-move:\s*320ms;/);
  assert.match(CSS, /--sn-m-settle:\s*cubic-bezier\(\.2,\.8,\.2,1\);/);
});

test('4 · the chips float (they push nothing up), hold Chat and Private, and typing lands back on All — never out of Private', () => {
  assert.match(CSS, /\.sn-chat-chips \{[^}]*position: absolute;[^}]*bottom: 100%;/, 'the chips are in the flow again — they push the box up');
  assert.match(COMPOSER, /className="sn-chat-chips"/);
  // 32 px drawn, a 44-px press (the house hit halo).
  assert.match(COMPOSER, /sn-press sn-hit relative inline-flex h-8 min-h-0 /);
  // The sliders only opens and folds the row; the picked chip stays, with a dot.
  assert.match(COMPOSER, /onClick=\{\(\) => setChipsUp\(\(was\) => !was\)\}/);
  assert.match(COMPOSER, /data-chat-kind-dot=""/);
  assert.match(COMPOSER, /<SlidersHorizontal aria-hidden className="sn-chat-sliders-a /);
  const back = COMPOSER.slice(COMPOSER.indexOf('const backToAll = () => {'));
  assert.match(back.slice(0, 220), /if \(!kinds \|\| kindState\.view === 'private'\) return;/, 'typing throws you out of Private');
  assert.match(COMPOSER, /if \(el\.value\.length > 0\) backToAll\(\);/);
});

test('5 · Private = the private lines only, and Whisper where this box can whisper — membership is never touched here', () => {
  const pick = COMPOSER.slice(COMPOSER.indexOf('const pickChip = '), COMPOSER.indexOf('const wasWhisperRef'));
  assert.match(pick, /pickKind\(threadId, 'private'\);\s*if \(canWhisper && !whisperOn\) \{\s*if \(tool\) closeTool\(\);\s*switchWhisper\(\);/);
  assert.match(pick, /if \(kindState\.view === 'private' && whisperOn\) switchWhisper\(\);/);
  assert.match(STREAM, /talkView === 'chat' \|\| privateOtherIds\(m, currentUserId\)\.length > 0/);
  assert.ok(!/chat_thread_members|current_thread_ids|thread_members/.test(pick), 'the chip reaches into who is in the chat');
});
