/**
 * 💬 THE SUPPLIER'S CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING (owner 19 Nov 2026 — *"can you make it live just as a
 * chat but everything is inside that chat?"* · *"given that you can freely improve the chat"* · *"Yes, build it"*;
 * DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, 13 screens).
 *
 * What would silently undo it:
 *   1. the seven-tab row comes back on a phone, or the chat stops being the body every other page rises over
 *      (a page SWAP loses the chat's scroll — the reason for the whole build);
 *   2. a page stops rising through the ONE full screen (`RiseScreen`), or closing it stops landing on the chat;
 *   3. an old `?tab=` door breaks — every one must open the chat with its page risen (the ids and aliases are held by
 *      `the-picked-client-has-nine-pages.test.ts`; here: the shell still reads them);
 *   4. the summary strip leaves the chat's ONE pinned stack (a second pinned region would break the 4/9 cap), or is
 *      fed something the page did not read;
 *   5. the chips leave the text box, the old Chat · Decisions · Files 📎 comes back beside them (two switches), or the
 *      suggested step stops stepping away when a word is typed;
 *   6. the routed thread page or the host's side picks any of this up by accident (their build is next).
 *   7. the tour's two stops inside a client point at a tab row a phone no longer has.
 *
 * SABOTAGE (19 Nov 2026, each seen RED then restored): `'hidden lg:flex'` → `'flex'` on the menu (1) · the risen
 * `<RiseScreen` replaced by a `<div>` (2) · `oneChat={embedded}` → `oneChat` (6) · `{oneChat ? <ChatHomeTop /> : null}`
 * moved under `</ChatPinnedStack>` (4) · `!hasDraft` dropped from the suggested step (5).
 *
 * Run: cd apps/web && npx tsx --test "app/vendor-dashboard/clients/*\/the-client-page-is-one-chat.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';
import { PICKED_CLIENT_PAGES, pickedAnchorOf, pickedPageNamed } from './_components/picked-client-menu';
import { TOURS } from '../../../../lib/tours';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SHELL = read('app/_components/picked/picked-shell.tsx');
const CLIENT_SHELL = read('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx');
const HOST_SHELL = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx');
const PAGE = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
const STREAM = read('app/_components/chat-message-stream.tsx');
const SEND = read('app/_components/chat-send-form.tsx');
const THREAD = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const HOST_THREAD = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
const STRIP = read('app/vendor-dashboard/clients/[eventId]/_components/client-chat-strip.tsx');

test('1 · the chat is the page: no tab row on a phone, and the chat is the one body', () => {
  assert.match(CLIENT_SHELL, /chatHome=\{chatHome\}/, 'the client shell no longer makes the chat its home');
  assert.match(CLIENT_SHELL, /page: 'chat' as const, line: `\$\{eventName\} · back to chat`, titleOpens: 'details' as const, more: MORE_PAGES/);
  assert.match(CLIENT_SHELL, /const MORE_PAGES: readonly PickedClientPage\[\] = \['files', 'hub', 'report'\];/, 'Files · Hub · Report are not the pages behind ⋯');
  // The tab row is drawn only from 1024 px (the computer keeps its tabs beside the always-open chat, owner 18 Nov).
  assert.match(SHELL, /\$\{chatHome \? 'hidden lg:flex' : 'flex'\} gap-0\.5 overflow-x-auto[^`]*`\}\s*data-picked-menu=""/, 'the tab row is drawn on a phone again');
  // The chat is the body whatever page is named; nothing swaps it out.
  assert.match(SHELL, /const rises = homePage !== null && awake && !split;/);
  assert.match(SHELL, /const workPage: P = rises \? homePage! : /, 'another page takes the chat’s place — its scroll is lost');
  // No swipe between pages when there is no row of pages.
  assert.match(SHELL, /on = !\(homePage !== null && !split\) && !!t && !t\.closest\(PAGE_SWIPE_SKIP\)/);
  // The name is the door to Details; ⋯ holds the rest, a phone only.
  assert.match(SHELL, /onClick=\{\(\) => nav\.select\(chatHome\.titleOpens\)\}/);
  assert.match(SHELL, /className="inline-flex shrink-0 lg:hidden" data-picked-more=""/);
});

test('2 · every other page RISES over the chat through the one full screen, and closing it lands on the chat', () => {
  const risen = SHELL.slice(SHELL.indexOf('{risenPage !== null && chatHome ? ('));
  assert.match(risen, /<RiseScreen\s+title=\{menu\.find\(\(m\) => m\.id === risenPage\)\?\.label \?\? title\}\s+line=\{chatHome\.line\}\s+data="picked-page"\s+onClose=\{landHome\}/, 'a page no longer rises through RiseScreen');
  assert.match(risen, /\{bodies\[risenPage\]\}/, 'the risen screen does not draw the shipped body');
  // The shipped body, unchanged — the same switch builds it (no second copy of a page for the risen screen).
  assert.equal((PAGE.match(/pickedPageBodies\(/g) ?? []).length, 1);
  // Closing: the chat again, at the plain address. A door back to the chat closes the screen the way its ✕ does.
  assert.match(SHELL, /const landHome = useCallback\(\(\) => \{\s*if \(homePage === null\) return;\s*setPage\(homePage\);[\s\S]{0,220}url\.searchParams\.delete\('tab'\);/);
  assert.match(SHELL, /if \(rises && id === homePage && riseCloseRef\.current\) return riseCloseRef\.current\(\);/);
  // The chat under a risen page never moves.
  assert.match(SHELL, /if \(rises\) return;\s*bodyRef\.current\?\.scrollTo\(\{ top: 0 \}\);/, 'opening a page scrolls the chat under it to its top');
  // A floating row of the risen page stays IN the risen layer (never under it).
  assert.match(risen, /<ThumbLayerContext\.Provider value=\{risenThumbLayer\}>\{bodies\[risenPage\]\}<\/ThumbLayerContext\.Provider>/);
});

test('3 · every old ?tab= door still opens — the chat, with that page risen', () => {
  for (const p of PICKED_CLIENT_PAGES) assert.equal(pickedPageNamed(p.id), p.id);
  for (const [door, page, anchor] of [['payments', 'quote', 'payments'], ['forms', 'details', 'forms'], ['decisions', 'details', 'decisions'], ['script', 'schedule', 'script']] as const) {
    assert.equal(pickedPageNamed(door), page, `?tab=${door}`);
    assert.equal(pickedAnchorOf(door), anchor, `?tab=${door} lands on its part`);
  }
  assert.match(PAGE, /initialPage=\{visiblePickedPage\(rawTab, isBooked\)\}/);
  assert.match(SHELL, /const scroller = part\?\.closest<HTMLElement>\('\[data-picked-body\],\[data-rise-body\]'\);/, 'a part of a risen page cannot be scrolled to');
  // A page named by the address rises the moment the page is awake (it was painted in place by the server).
  assert.match(SHELL, /const risenPage: P \| null = rises && page !== homePage \? page : null;/);
});

test('4 · the summary strip is FIRST in the chat’s one pinned stack, fed only what the page read', () => {
  const stack = STREAM.slice(STREAM.indexOf('<ChatPinnedStack'), STREAM.indexOf('</ChatPinnedStack>'));
  const fixed = stack.slice(stack.indexOf('fixed={'), stack.indexOf('{planRow}'));
  assert.match(fixed, /\{oneChat \? <ChatHomeTop \/> : null\}\s*\{hosts !== undefined \? <ChatHostStrip/, 'the strip is not first in the pinned stack (above the who’s-here strip and the pins)');
  assert.equal((STREAM.match(/<ChatHomeTop \/>/g) ?? []).length, 1);
  assert.equal((STREAM.match(/<ChatPinnedStack\b/g) ?? []).length, 1, 'a second pinned stack — the 4/9 cap no longer holds everything pinned');
  assert.match(PAGE, /strip=\{<ClientChatStrip boxes=\{stripBoxes\} threadId=\{threadId\} \/>\}/);
  assert.match(PAGE, /const stripBoxes = chatStrip\(\{/);
  // Its two own reads are said when refused (null → "Couldn't load"), never drawn as none.
  assert.match(PAGE, /theirAsk: !threadId \? undefined : stripAsks === null \? null : /, 'a refused asks read reads as "nobody countered"');
  assert.match(PAGE, /forms: stripForms && stripForms\.status === 'ok' \? \{ open: stripForms\.open, sent: stripForms\.sent \} : null,/, 'a refused forms read reads as a count');
  assert.match(PAGE, /quote: proposalRowsError \? null : sentQuote \? /, 'a refused quotes read reads as "not sent"');
  assert.match(PAGE, /const stripMeetings = isBooked\s*\? appointmentsReadFailed\s*\? null/, 'a refused meetings read reads as "nothing set"');
  // A failed box retries where it failed; a shut box is not a press.
  assert.match(STRIP, /if \(b\.failed\) return retry\(\(\) => router\.refresh\(\)\);/);
  assert.match(STRIP, /if \(!b\.door\) \{\s*return \(\s*<div key=\{b\.key\} className=\{box\} data-chat-strip-box=\{b\.key\} data-shut="">/);
  // The Next step no longer has a row of its own above the chat on this side.
  assert.doesNotMatch(CLIENT_SHELL, /chatTop=/);
});

test('5 · ONE switch, in the text box: the sliders raise the chips; the old 📎 is not drawn beside them', () => {
  assert.match(SEND, /import \{ Camera, ImageIcon, Lock, Paperclip, SlidersHorizontal, X \} from 'lucide-react';/, 'the show control is not the app’s one sliders icon');
  const box = SEND.slice(SEND.indexOf('data-chat-one-box=""'));
  const sliders = box.indexOf('data-chat-kind-open=""');
  const send = box.indexOf('aria-label="Send"');
  const field = box.indexOf('<textarea');
  assert.ok(field >= 0 && field < sliders && sliders < send, 'the sliders button is not inside the box, between the field and Send');
  assert.ok(SEND.indexOf('data-chat-kind-chips=""') < SEND.indexOf('data-chat-one-box=""'), 'the chips are not raised above the box');
  assert.match(SEND, /\{KIND_CHIPS\.map\(\(c\) => \{/);
  assert.match(SEND, /onClick=\{\(\) => \{\s*pickKind\(threadId, c\.key\);/);
  // The suggested step: inside the box, left of the field, gone once a word is typed (and never while words-only).
  const suggested = box.indexOf('data-chat-suggested=');
  assert.ok(suggested >= 0 && suggested < field, 'the suggested step is not inside the box, left of "Message"');
  assert.match(SEND, /const suggestOn = kinds && Boolean\(home\?\.suggest\) && !hasDraft && !wordsMode && !feeWordsOnly;/, 'the suggested step stays while typing, or shows in a words-only box');
  assert.match(SEND, /\{suggestOn && home\?\.suggest \? \(/);
  assert.match(SEND, /patchPlus\(threadId, \{ draft: \{ kind: card, startedAt: Date\.now\(\) \} \}\);/, 'the suggested step does not open the (+)’s own card');
  // In the stream: the picked chip filters, and the head's 📎 / Files panel are not drawn with the chips.
  assert.match(STREAM, /if \(kindView && chatKindOf\(m, Boolean\(filings\?\.byMessage\.get\(m\.message_id\)\)\) !== kindView\) \{/);
  assert.match(STREAM, /\{oneChat \? null : \(\s*<ActionButton\s+tone="neutral"\s+iconOnly\s+icon=\{Paperclip\}/, 'the 📎 is drawn beside the chips — two switches for one thing');
  assert.match(STREAM, /const filesOpen = filesPanel && !oneChat;/);
  assert.match(STREAM, /data-chat-filter-line=\{kindView\}/, 'a filtered chat does not say what it shows');
});

test('6 · only the supplier’s client page: the routed thread and the host’s side are as shipped', () => {
  assert.match(THREAD, /oneChat=\{embedded\}/, 'the routed thread page became a one-chat page');
  assert.match(THREAD, /kinds=\{embedded\}/);
  assert.doesNotMatch(HOST_THREAD, /\boneChat\b|\bkinds=/, 'the host’s chat picked up the supplier’s one-chat parts before its own build');
  assert.doesNotMatch(HOST_SHELL, /chatHome/, 'the host’s picked supplier lost its tabs before its own build');
  assert.match(STREAM, /oneChat = false,/);
  assert.match(SEND, /kinds = false \}: Props\)/);
  // A chat without the chips keeps its three shipped thirds.
  assert.match(STREAM, /useState<ThreadView>\(initialView === 'decisions' \? 'all' : legacyThreadView\(initialView\)\)/);
});

test('7 · the tour’s two stops inside a client stand on things a phone still has', () => {
  const anchors = new Set(Object.values(TOURS).flatMap((t) => JSON.stringify(t).match(/"anchor":"([^"]+)"/g) ?? []).map((a) => a.slice(10, -1)));
  for (const a of ['client-chat', 'client-quote']) assert.ok(anchors.has(a), `the tour lost its '${a}' stop`);
  assert.match(CLIENT_SHELL, /titleTour: 'client-chat'/);
  assert.match(SHELL, /data-tour=\{chatHome\.titleTour\}/, 'the chat’s stop is not on the client’s name');
  assert.match(STRIP, /data-tour=\{b\.key === 'money' \? 'client-quote' : undefined\}/, 'the quotation’s stop is not on the strip’s money box');
  assert.doesNotMatch(CLIENT_SHELL, /tours=\{/, 'the stops are still on the tab row a phone no longer draws');
});
