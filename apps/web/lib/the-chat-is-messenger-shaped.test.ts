/**
 * THE CHAT IS MESSENGER-SHAPED (owner 2026-10-27, *"We want it full screen like the first photo"* · *"This is how the
 * framing of messenger should look and feel like on our chatbox"*; chat prototype 2026-10-28, frames A–F).
 *
 *   • an open thread is FULL SCREEN on a phone (the takeover rule in globals.css, the ChatBox root carries it) — a phone
 *     is below 701, the system's line (owner 2026-11-13, D3); it was 1024, which gave a 768 tablet the phone's thread;
 *   • from 701 the list and the open thread stand side by side in the system's two columns (`ChatPanes` → `.sn-cols`),
 *     on both sides, and the right column is never empty — with no thread open, the latest one opens there;
 *   • the head is ‹ · avatar · name · event line · ⓘ;
 *   • bubbles join into runs, the other side's avatar sits by the LAST of a run, a time is centred between runs;
 *   • the inbox rows have no frame and each carries its event line (owner: *"i want isolation per event"*);
 *   • a thread opens with its last-known messages at once, for the same viewer only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { bubbleRun, timeBreakBefore, QUIET_GAP_MS } from './chat-bubble-runs';
import { lastKnownOf, recallThread } from './chat-last-known';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const iso = (m: number) => new Date(Date.UTC(2026, 9, 28, 2, m)).toISOString();

test('runs and times: one side, no quiet gap → one run; a card or a gap breaks it; a time once per stretch', () => {
  const rows = [
    { sender_role: 'vendor', created_at: iso(0) },
    { sender_role: 'vendor', created_at: iso(1) },
    { sender_role: 'couple', created_at: iso(2) },
    { sender_role: 'vendor', created_at: iso(3), proposal_id: 'q' },
    { sender_role: 'vendor', created_at: iso(4) },
    { sender_role: 'vendor', created_at: iso(4 + QUIET_GAP_MS / 60000) },
  ];
  assert.deepEqual(bubbleRun(rows, 0), { first: true, last: false });
  assert.deepEqual(bubbleRun(rows, 1), { first: false, last: true }, 'their avatar is not by the last bubble of the run');
  assert.deepEqual(bubbleRun(rows, 2), { first: true, last: true });
  assert.deepEqual(bubbleRun(rows, 4), { first: true, last: true }, 'a card did not break the run');
  assert.deepEqual(bubbleRun(rows, 5), { first: true, last: true }, 'a quiet gap did not break the run');
  assert.deepEqual(rows.map((_, i) => timeBreakBefore(rows, i)), [true, false, false, false, false, true]);
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /const run = bubbleRun\(messages, i\)/, 'the bubbles do not use the one run rule');
  assert.match(stream, /const brk = timeBreakBefore\(messages, i\)/, 'the centred time does not use the one rule');
  assert.doesNotMatch(stream, /'You'\s*:\s*counterpartyLabel\}\s*\{' · '\}/, 'every bubble prints its own time again');
});

test('an open thread is full screen on a phone: the takeover rule exists and the ChatBox root carries it', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf('AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE');
  assert.ok(at > 0, 'the takeover rule is gone');
  const rule = css.slice(at, at + 2600);
  assert.match(rule, /@media \(max-width: 700\.98px\)/, 'the takeover line is not the system’s 701');
  assert.doesNotMatch(rule, /1023\.98px/, 'a 768 tablet gets the phone’s full-screen thread again');
  // The rise that would draw the takeover inside the page is off on the same line, not a wider one.
  const rise = css.slice(css.indexOf('AN OPEN CHAT THREAD DOES NOT RISE ON A PHONE'));
  assert.match(rise.slice(0, 900), /@media \(max-width: 700\.98px\) \{\s*\.sn-page-enter:has\(\[data-chat-takeover\]\) \{ animation: none; \}/);
  // From the same line the thread keeps a quiet frame wherever it stands in flow — no gap between the two rules.
  assert.match(css, /@media \(min-width: 701px\) \{\s*\[data-chat-takeover\] \{\s*border: 1px solid/, 'from 701 the in-flow thread lost its frame');
  assert.doesNotMatch(css, /@media \(min-width: 1024px\) \{\s*\[data-chat-takeover\]/, 'the frame still waits for 1024');
  assert.match(rule, /\[data-chat-takeover\] \{\s*position: fixed;\s*inset: 0;\s*z-index: 45;/, 'the thread no longer covers the shell');
  assert.match(rule, /\.sn-vt-page:has\(\[data-chat-takeover\]\) \{\s*view-transition-name: none;/, 'the named page would capture the takeover');
  assert.match(read('app/_components/chat/chat-box.tsx'), /data-chat-box data-chat-takeover=""/, 'the ChatBox root is not the takeover');
  assert.doesNotMatch(read('app/_components/chat/chat-box.tsx'), /\bsn-row\b/, 'the thread is a framed card again');
});

test('the head is ‹ · avatar · name · event line · the chat menu — ONE head component, on both sides', () => {
  const head = read('app/_components/chat/chat-thread-head.tsx');
  // The ‹ is the shared BackButton (variant "chat") the page passes in — its link from lib/page-home.ts.
  assert.match(head, /\{back\}/, 'the shared head has no ‹');
  const bb = read('app/_components/back-button.tsx');
  assert.match(bb, /aria-label=\{`Back to \$\{label\}`\}/, 'the chat ‹ lost its name');
  assert.match(bb, /<ReturnInPlace>/, 'the chat ‹ no longer returns to the list in place');
  for (const [p, route] of [
    ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', '/dashboard/[eventId]/messages/[threadId]'],
    ['app/vendor-dashboard/messages/[threadId]/page.tsx', '/vendor-dashboard/messages/[threadId]'],
  ] as const) {
    assert.ok(read(p).includes(`<BackButton route="${route}"`) && /variant="chat"/.test(read(p)), `${p}: the ‹ is not BackButton route= (this page)`);
  }
  assert.match(head, /rounded-full bg-ink\/\[0\.1\]/, 'the shared head has no avatar beside the name');
  assert.match(head, /\[&>\*(?:\+\*)?\]:before:content-\['·'\]/, 'the muted line lost its separators');
  for (const p of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    const s = read(p);
    const at = s.indexOf('header={');
    const h = s.slice(at, s.indexOf('notice={', at));
    // THE ONE BUILD (8 Nov 2026, v111): inside the picked client the supplier's box draws NO head of its own — the
    // client's pinned row is the head — so the supplier page may say `embed === 'chat' ? null :` first, and only that.
    assert.match(
      h,
      // Build 2 · B2-D: the picked client's ONE draw serves every embed, so the condition reads `embedded`.
      /^header=\{\s*(?:embedded \? null : \(\s*)?<ChatThreadHead\b/,
      `${p}: the head is not the shared ChatThreadHead`,
    );
    assert.equal((h.match(/<ChatThreadMenu\b/g) ?? []).length, 1, `${p}: the chat menu is not the head's action`);
  }
  assert.match(read('app/_components/chat-thread-menu.tsx'), /aria-label="About this chat"/);
});

test('inbox rows: no frame, a 56px round, bold + dot when unread, and the event line on every row', () => {
  const s = read('app/dashboard/[eventId]/messages/_components/chat-inbox.tsx');
  const row = s.slice(s.indexOf('const renderRow'), s.indexOf('const sheet ='));
  assert.doesNotMatch(row, /\bborder\b|sn-tile|sn-row|rounded-xl/, 'an inbox row is framed again');
  assert.match(row, /size="lg"/, 'the avatar is not the 56px round');
  assert.match(row, /data-inbox-event-line/, 'a row lost its event line — two events could read as one');
  // The row open in the right column (from 701) is on screen, so it reads as read; every other unread row is bold.
  assert.match(row, /const unread = r\.unread && !isOpen;/);
  assert.match(row, /\$\{unread \? 'font-bold' : 'font-medium'\}/, 'unread is not bold');
  assert.match(row, /aria-label="Unread"/, 'unread has no dot');
});

test("a thread's last-known messages are painted only for the viewer this page marked", () => {
  const k = lastKnownOf(
    [{ message_id: 'm', sender_role: 'couple', body: 'hi', created_at: iso(0), proposal_id: null }],
    'couple',
    'u1',
    'Lumière',
    0,
  );
  assert.deepEqual(k.rows, [{ id: 'm', mine: true, body: 'hi', at: iso(0), card: false, file: null }]);
  // No window in node → nothing is recalled; in the browser `recallThread` also refuses an unmarked viewer.
  assert.equal(recallThread('t'), null);
  const lk = read('lib/chat-last-known.ts');
  assert.match(lk, /if \(!v \|\| v\.uid !== viewer/, 'a remembered thread is painted for a different viewer');
  assert.match(lk, /window\.sessionStorage/, 'the memory outlives the tab');
  for (const p of ['app/dashboard/[eventId]/messages/[threadId]/loading.tsx', 'app/vendor-dashboard/messages/[threadId]/loading.tsx']) {
    assert.match(read(p), /ThreadArrival as default/, `${p} is a grey skeleton again`);
  }
});

test('from 701 the list and the open thread stand side by side — the system’s two columns, both sides, never an empty pane', () => {
  const panes = read('app/dashboard/[eventId]/messages/_components/chat-panes.tsx');
  // The system's columns, not a chat copy of them, on the system's line.
  assert.match(panes, /import \{ SupplierColumns \} from '@\/app\/vendor-dashboard\/_components\/supplier-columns';/);
  assert.match(panes, /<SupplierColumns name="chats" list=\{list\} pane=\{/, 'the chat draws its own columns');
  assert.match(panes, /export const CHAT_PANES_FROM = '\(min-width: 701px\)';/);
  // Never empty: with no thread open the latest one opens — from 701 only, so a phone list is never replaced (or read).
  assert.match(panes, /if \(mq\.matches\) router\.replace\(latestHref/, 'the empty right column does not open the latest chat');
  assert.match(panes, /const splits = open \|\| Boolean\(latestHref\);/);
  assert.match(panes, /if \(!splits\) return <>\{list\}<\/>;/, 'a list with nothing to open splits around an empty pane');
  // The pane ends at the window's foot where the page's column starts below the pin line (the couple's 24 px gutter).
  assert.match(panes, /root\.style\.setProperty\('--sn-chat-pane-gap'/, 'the pane runs past the window and hides the composer');
  // Each tree: the list page hands the newest active chat and the arrival; each thread route draws the list page beside it.
  for (const [page, layout] of [
    ['app/dashboard/[eventId]/messages/page.tsx', 'app/dashboard/[eventId]/messages/[threadId]/layout.tsx'],
    ['app/vendor-dashboard/messages/page.tsx', 'app/vendor-dashboard/messages/[threadId]/layout.tsx'],
  ] as const) {
    const p = read(page);
    assert.match(p, /<ChatPanes list=\{list\} open=\{false\} latestHref=\{latestHref\}>\s*<ThreadArrival \/>\s*<\/ChatPanes>/, `${page}: the right column has no default`);
    assert.match(p, /\.find\(\(r\) => !r\.archived\)\?\.paneHref/, `${page}: the default is not the newest active chat`);
    assert.match(p, /paneHref: `\/[^`]*messages\/\$\{r\.threadId\}`/, `${page}: a row does not open its thread beside the list`);
    assert.match(p, /if \(besideThread\) return list;/, `${page}: beside a thread the list draws a second pair of columns`);
    const l = read(layout);
    assert.match(l, /<ChatPanes\s+open\s+list=\{\s*<Suspense fallback=\{null\}>\s*<\w+Page [^>]*searchParams=\{Promise\.resolve\(\{ __in: 'thread' \}\)\} \/>/, `${layout}: the list beside the thread is not the Chats page itself`);
    assert.match(l, /\{children\}\s*<\/ChatPanes>/, `${layout}: the thread is not the right column`);
  }
  // A row opens beside the list from 701 only; the open one is marked and reads as read.
  const inbox = read('app/dashboard/[eventId]/messages/_components/chat-inbox.tsx');
  assert.match(inbox, /if \(!window\.matchMedia\(CHAT_PANES_FROM\)\.matches\) return false;/, 'a phone tap opens beside the list');
  assert.match(inbox, /const unread = r\.unread && !isOpen;/);
  assert.match(inbox, /aria-current=\{isOpen \? 'page' : undefined\}/);
  // The CSS seats the chat in the columns: the phone keeps its full-screen thread, the pane fills edge to edge.
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const seat = css.slice(css.indexOf('THE LIST BESIDE THE OPEN THREAD'));
  assert.match(seat, /@media \(max-width: 700\.98px\) \{\s*\[data-chat-panes\]\[data-chat-open\] \[data-supplier-cols-list\] \{ display: none; \}\s*\[data-chat-panes\]\[data-chat-open\] \[data-supplier-cols-pane\] \{ display: block; \}/, 'on a phone an open thread is hidden in the undrawn pane');
  assert.match(seat, /\[data-chat-panes\] \[data-supplier-cols-pane\] \[data-chat-thread-frame\] > aside \{ display: none; \}/, 'two lists side by side at xl');
  // The couple's tree loads the columns' stylesheet (the supplier tree's own layout already does).
  assert.match(read('app/dashboard/[eventId]/messages/layout.tsx'), /import '@\/app\/vendor-dashboard\/_components\/supplier-frame\.css';/);
});
