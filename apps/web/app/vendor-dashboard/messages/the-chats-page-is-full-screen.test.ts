/**
 * 🔒 THE SUPPLIER'S CHATS IS A FULL-SCREEN PAGE OF ITS OWN (owner 2026-11-06, verbatim: *"The chat page is a full screen
 * page, correct? Independent of any other menus? Why is it still jumping to customer events"*).
 *
 *   a · the ✉ envelope (and every Messages door) opens `/vendor-dashboard/messages` — never Customers › Events;
 *   b · that page is the couple's `ChatInbox` (the same component), not a redirect stub and not a second inbox;
 *   c · it is FULL SCREEN: its root is the chat takeover (`data-chat-takeover` — fixed over the shell below 1024, so no
 *       bottom tabs and no pinned row), and its search row stands at its own foot, not on the bottom dock it covers;
 *   d · a refused thread read says "Couldn't load your chats" with Try again — never "No chats yet";
 *   + the dots read the ✉ badge's own unread rule, and an empty inbox is one line and nothing else.
 *
 * Rendered with `renderToStaticMarkup` (the real component tree), plus source checks where a render cannot reach.
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SUPPLIER_CHATS_HREF } from '../customers/anchors';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    // No app router in node: the hooks the head's ‹ and the Try again read, as inert stand-ins.
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ back() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }),
        usePathname: () => '/vendor-dashboard/messages',
        useSearchParams: () => new URLSearchParams(),
        redirect: () => {
          throw new Error('redirect');
        },
        notFound: () => {
          throw new Error('notFound');
        },
      };
    }
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = read('app/vendor-dashboard/messages/page.tsx');
const VIEW = read('app/vendor-dashboard/messages/_components/supplier-chats.tsx');

async function render(readState: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierChats } = await import('./_components/supplier-chats');
  return renderToStaticMarkup(React.createElement(SupplierChats, { read: readState as never, viewerId: 'u1' }));
}

const ROW = {
  threadId: 't1',
  href: '/vendor-dashboard/messages/t1',
  name: "Ana's Wedding (Dec 18)",
  logoUrl: null,
  preview: 'Is Dec 18 still free?',
  timeLabel: '2m',
  unread: true,
  eventLine: '',
  archived: false,
  archive: null,
};

test('a · the envelope opens Chats — /vendor-dashboard/messages — never Customers › Events', () => {
  assert.equal(SUPPLIER_CHATS_HREF, '/vendor-dashboard/messages');
  const layout = read('app/vendor-dashboard/layout.tsx');
  const env = layout.match(/<UnreadMessagesBadge\b[\s\S]*?\/>/);
  assert.ok(env, 'the envelope is gone from the supplier top bar');
  assert.match(env[0], /href=\{SUPPLIER_CHATS_HREF\}/, 'the envelope does not open Chats');
  // The customer card's chat fallback is a Messages door too. THE ONE BUILD (8 Nov 2026) moved the card's chat
  // doors onto its Chat page (`_pages/chat.tsx`): the strip tab and the quick link are gone, one door remains.
  const card = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.doesNotMatch(card, /customerLandingHref\('messages'\)/, 'a Messages door still lands on Customers');
  assert.equal((card.match(/: SUPPLIER_CHATS_HREF\b/g) ?? []).length, 0, 'a chat door came back onto the card body');
  const chatPage = read('app/vendor-dashboard/clients/[eventId]/_pages/chat.tsx');
  // Integration (8 Nov): C2's Chat page draws the thread in place; with no thread its one fallback link opens Chats.
  assert.equal((chatPage.match(/href=\{SUPPLIER_CHATS_HREF\}/g) ?? []).length, 1, 'the Chat page’s fallback does not open Chats');
});

test('b · the page is the couple’s ChatInbox, fed the supplier’s rows — not a stub', () => {
  assert.doesNotMatch(PAGE, /redirect\(\s*`\/vendor-dashboard\/customers/, 'Chats is a redirect into Customers again');
  assert.match(PAGE, /<SupplierChats read=\{read\} viewerId=\{user\.id\} \/>/, 'the page does not draw the Chats view');
  assert.match(VIEW, /import \{ ChatInbox, type InboxRow \} from '@\/app\/dashboard\/\[eventId\]\/messages\/_components\/chat-inbox';/, 'Chats is not the couple’s inbox component');
  assert.equal((VIEW.match(/<ChatInbox\b/g) ?? []).length, 1);
  // ONE row shape: the thread column's builder over the thread column's inputs.
  assert.match(PAGE, /buildVendorConversationRows\(\{/);
  assert.match(PAGE, /readVendorConversationInputs\(\{/);
  // A tap opens the one thread page, unchanged.
  assert.match(PAGE, /href: `\$\{SUPPLIER_CHATS_HREF\}\/\$\{r\.threadId\}`/);
});

test('b · rows: the event’s chat title whole, All · Unread only, newest first with Archived folded below', async () => {
  const html = await render({ kind: 'read', rows: [ROW, { ...ROW, threadId: 't2', archived: true, unread: false }], unreadMeasured: true, complete: true });
  assert.match(html, /data-chat-inbox=""/);
  // The chat title IS the event line (whose event · kind · day) — it takes the row's width, so its date is not cut.
  assert.match(html, /<span class="min-w-0 shrink truncate[^"]*">Ana(?:'|&#x27;)s Wedding \(Dec 18\)<\/span>/, 'the chat title is capped beside an empty event line');
  assert.match(PAGE, /eventChatTitle\(\{ name: facts\.displayName, kind, date: facts\.eventDate, nowMs \}\)/, 'the row is not named by the one chat title');
  // The couple's rows (with an event line) keep their 70 % name.
  const couple = await render({ kind: 'read', rows: [{ ...ROW, eventLine: 'Dec 18 · Ana & Miguel' }], unreadMeasured: true, complete: true });
  assert.match(couple, /style="max-width:70%"/);
  assert.match(html, /aria-label="Unread"/, 'an unread chat has no dot');
  assert.match(html, />All</);
  assert.match(html, />Unread</);
  assert.doesNotMatch(html, />Suppliers</, 'the couple’s Suppliers chip leaked onto the supplier’s Chats');
  assert.doesNotMatch(html, /data-testid="chat-new-message"|New message/, 'a supplier answers chats — there is no ✎');
  assert.match(html, /<details>[\s\S]*Archived/, 'archived chats are not folded below');
  assert.match(PAGE, /\[\.\.\.active, \.\.\.archived\]/, 'active first, archived after');
});

test('c · full screen: the page root is the chat takeover — no bottom tabs, no pinned row — and its search is at its own foot', async () => {
  const html = await render({ kind: 'read', rows: [ROW], unreadMeasured: true, complete: true });
  assert.match(html, /^<section data-chat-takeover="" data-supplier-chats=""/, 'the page root is not the takeover');
  // The foot is drawn once mounted (its field ids come from `useId`), so it is read from the inbox's source here.
  assert.match(VIEW, /dock="foot"/);
  const inbox = read('app/dashboard/[eventId]/messages/_components/chat-inbox.tsx');
  assert.match(inbox, /\{dock === 'foot' && mounted \? \(\s*<div className="sticky bottom-0[^"]*" data-chat-inbox-foot="">\s*\{thumb\}/, 'the search row is not at the page’s own foot');
  assert.match(inbox, /\{dock === 'float' \? <ThumbDock>\{thumb\}<\/ThumbDock> : null\}/, 'a full-screen page still portals its row onto the dock it covers');
  assert.doesNotMatch(html, /data-thumb-dock/);
  // The takeover is what covers the shell: fixed, edge to edge, above the bottom dock and the top bar.
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  assert.match(css, /\[data-chat-takeover\] \{\s*position: fixed;\s*inset: 0;\s*z-index: 45;/, 'the takeover no longer covers the shell');
  // ‹ is the house back, back in place to where the supplier came from, else Today.
  assert.match(html, /data-chat-back=""/, 'Chats has no ‹');
  assert.match(html, /href="\/vendor-dashboard"/, 'the ‹ fallback is not Today');
});

test('d · a refused thread read says it could not load — never "No chats yet"', async () => {
  const html = await render({ kind: 'refused' });
  assert.match(html, /Couldn’t load your chats/);
  assert.match(html, /data-timeline-retry=""/, 'no Try again');
  assert.doesNotMatch(html, /No chats yet/);
  assert.doesNotMatch(html, /data-chat-inbox=""/, 'an inbox was drawn over a read that never happened');
  // …and the page maps a thrown thread read to exactly that state.
  const fn = PAGE.slice(PAGE.indexOf('async function readSupplierChats('));
  assert.match(fn, /try \{\s*listed = await fetchVendorThreadsDetailed\(supabase, vendorProfileId\);\s*\} catch \(caught\) \{[\s\S]*?return \{ kind: 'refused' \};/);
  // An incomplete read says so too.
  const partial = await render({ kind: 'read', rows: [ROW], unreadMeasured: true, complete: false });
  assert.match(partial, /some older ones didn’t load/);
});

test('+ the dots read the ✉ badge’s own rule; empty is one line and nothing else', async () => {
  assert.match(PAGE, /readCoupleUnread\(\s*supabase,\s*userId,/, 'the dots no longer read the badge’s unread rule');
  assert.match(PAGE, /unreadThreadIds: new Set\(unread\.threadIds\)/);
  assert.match(PAGE, /unreadMeasured: unread\.measured/, 'a refused unread read would say "Nothing unread."');
  const html = await render({ kind: 'read', rows: [], unreadMeasured: true, complete: true });
  assert.match(html, /No chats yet/);
  assert.doesNotMatch(html, /data-chat-inbox=""|data-thumb-row|role="group"/, 'an empty inbox drew filters or a search over nothing');
});
