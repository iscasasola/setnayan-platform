/**
 * 🪞 ONE PICKED SHELL, BOTH SIDES — and both Chats lists open it on Chat (Supplier Build 3 · Lane A, 9 Nov 2026).
 *
 * Owner, 8 Nov: the host's picked supplier opens *"the same full screen effect"* as the supplier's picked client (🪞), and
 * the supplier's top-right Chats is one row per event, unread pinned on top, a row opening the picked client on Chat (✉️).
 *
 *   1. ONE screen: only `picked-shell.tsx` draws the picked layer (portal, `--sn-z-pop`, `pickedMotion`, replaceState);
 *      the two sides are wrappers that render `<PickedShell` and hold none of those pieces — no second copy.
 *   2. The host's Chats draws the picked supplier OVER itself — a `supplier` slot whose intercept only re-exports the
 *      workspace page (no second body); the flag-ON workspace IS the picked supplier (no `RelationshipTabShell`).
 *   3. Doors: a Chats row opens the picked page ON CHAT and records its tap (`opensPicked`) — supplier rows fold by event
 *      (`foldByEvent`); the Clients / Suppliers lists open on the menu's first page (no `?tab` → Chat on both menus
 *      since 11 Nov; Details when there is no conversation).
 *   4. The order is the inbox's own (`messengerOrder`) with the "Unread · pinned" head — one rule for both lists.
 *   5. The host's Chat page is the shipped thread page itself (`__embed: 'chat'`), marked read only while shown.
 *
 * SABOTAGE (done once, 9 Nov): an `el.animate(` in `picked-supplier-shell.tsx` → 1 RED; the intercept given its own
 * body → 2 RED; the host row's href back to `/messages/${r.threadId}` only → 3 RED; `<ul>{active.map(renderRow)}</ul>`
 * alone in the inbox → 4 RED; a needs-you level computed inside the inbox → 4 RED; `markThreadRead(threadId)` without the `embedded` return → 5 RED; the host embed's `hosts` spread removed → 6 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { visiblePickedPage } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import {
  PICKED_SUPPLIER_PAGES,
  pickedSupplierMenuFor,
  pickedSupplierPageOf,
  visiblePickedSupplierPage,
} from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-menu';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const SHELL = '_components/picked/picked-shell.tsx';
const CLIENT_SHELL = 'vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx';
const SUPPLIER_SHELL = 'dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx';
const WORKSPACE = 'dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const HOST_CHATS = 'dashboard/[eventId]/messages';
const SUPPLIER_CHATS = 'vendor-dashboard/messages/page.tsx';
const INBOX = 'dashboard/[eventId]/messages/_components/chat-inbox.tsx';
const HOST_THREAD = 'dashboard/[eventId]/messages/[threadId]/page.tsx';
const SUPPLIER_THREAD = 'vendor-dashboard/messages/[threadId]/page.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · ONE screen draws the picked layer; both sides only wrap it', () => {
  const shell = read(SHELL);
  assert.match(shell, /export function PickedShell</);
  assert.match(shell, /createPortal\(screen, host\)/);
  assert.match(shell, /style=\{\{ zIndex: 'var\(--sn-z-pop\)' \}\}/);
  assert.match(shell, /window\.history\.replaceState\(/);
  for (const rel of [CLIENT_SHELL, SUPPLIER_SHELL]) {
    const src = read(rel);
    assert.match(src, /<PickedShell</, `${rel} no longer opens through the ONE picked shell`);
    for (const part of ['createPortal', 'el.animate(', 'replaceState', 'zIndex', 'useModalA11y', 'role="dialog"']) {
      assert.ok(!src.includes(part), `${rel} carries "${part}" — a second copy of the picked screen`);
    }
  }
  // Nothing else in app/ draws a picked layer of its own.
  const drawers = walk(APP)
    .filter((p) => /data-picked-client=\{/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(APP, p));
  assert.deepEqual(drawers, [SHELL], `a picked layer is drawn outside the ONE shell: ${drawers.join(', ')}`);
});

test('2 · the host Chats draws the picked supplier over itself; the workspace IS the picked supplier', () => {
  const layout = read(`${HOST_CHATS}/layout.tsx`);
  assert.match(layout, /\{ children, supplier \}/);
  assert.match(layout, /\{children\}\s*\{supplier\}/, 'the supplier is drawn AFTER (over) the still-mounted list');
  assert.match(read(`${HOST_CHATS}/@supplier/default.tsx`), /return null;/);
  assert.equal(
    read(`${HOST_CHATS}/@supplier/(..)vendors/[vendorId]/workspace/page.tsx`).trim(),
    "export { default } from '../../../../../vendors/[vendorId]/workspace/page';",
    'the intercept must only re-export the workspace page — never a second body',
  );
  const ws = read(WORKSPACE);
  assert.match(ws, /<PickedSupplierShell\b/);
  assert.ok(!ws.includes('RelationshipTabShell'), 'the workspace draws the old tab shell again');
  assert.match(ws, /<CoupleThreadBody eventId=\{eventId\} threadId=\{chatThread\.thread_id\} \/>/, 'the Chat page is not the shipped thread');
});

test('3 · a Chats row opens the picked page ON CHAT; the host’s lists open on Details, the supplier’s on Chat (11 Nov)', () => {
  const sup = read(SUPPLIER_CHATS);
  assert.match(sup, /foldByEvent\(/, 'the supplier Chats no longer folds threads by event');
  assert.match(sup, /href: `\/vendor-dashboard\/clients\/\$\{r\.eventId\}\?tab=chat`,\s*opensPicked: true,/);
  const host = read(`${HOST_CHATS}/page.tsx`);
  assert.match(host, /`\/dashboard\/\$\{eventId\}\/vendors\/\$\{eventVendorId\}\/workspace\?tab=chat`/);
  assert.match(host, /opensPicked: Boolean\(eventVendorId\)/);
  // The menus: `?tab=chat` → Chat. No tab: BOTH open on Chat — the supplier's picked client since the owner's 11 Nov order
  // (DECISION_LOG "THE PICKED-CLIENT MENU AND THE CHAT (+) FOLLOW ONE ORDER"), the host's picked supplier mirrored the same
  // day ("Clients side is not fixed also") — and on Details when there is no conversation (no Chat page to open).
  assert.equal(visiblePickedPage('chat', true), 'chat');
  assert.equal(visiblePickedPage(null, true), 'chat');
  const full = pickedSupplierMenuFor({ quote: true, chat: true });
  assert.equal(visiblePickedSupplierPage('chat', full), 'chat');
  assert.equal(visiblePickedSupplierPage(undefined, full), 'chat');
  assert.equal(pickedSupplierPageOf('call'), 'chat');
  // A page that could only be blank is not offered.
  assert.equal(visiblePickedSupplierPage('chat', pickedSupplierMenuFor({ quote: false, chat: false })), 'details');
  assert.deepEqual(
    PICKED_SUPPLIER_PAGES.map((p) => p.label).slice(0, 6),
    ['Chat', 'Details', 'Quotation', 'Payment', 'Forms', 'Schedule'],
    'the owner-ruled tab order (11 Nov, the supplier’s order mirrored)',
  );
});

test('4 · one ordering rule for both lists: unread pinned on top, then the most recent', () => {
  const inbox = read(INBOX);
  assert.match(inbox, /const \{ pinned, recent \} = messengerOrder\(active\);/);
  assert.match(inbox, />Unread · pinned</);
  assert.match(inbox, /pinned\.map\(renderRow\)/);
  assert.match(inbox, /recent\.map\(renderRow\)/);
  assert.match(inbox, /rememberPickedOrigin\(/, 'a picked row no longer records its tap — the open would not rise from it');
  // 🚦 The needs-you dot draws ONLY the level handed in (Lane B's `needsYouLevel()`), never one the inbox works out.
  assert.match(inbox, /r\.needsYou === 'blocker' \?/, 'the blocker dot is gone');
  assert.match(inbox, /r\.needsYou === 'due-now' \?/, 'the due-now dot is gone');
  assert.doesNotMatch(inbox, /needsYou\s*=(?!=)|needsYouLevel\(/, 'the inbox decides a needs-you level itself — a second rule');
});

test('5 · the host Chat page is the shipped thread, marked read only while shown', () => {
  const t = read(HOST_THREAD);
  assert.match(t, /const embedded = sp\?\.__embed === 'chat';/);
  assert.match(t, /if \(embedded\) return;\s*await markThreadRead\(threadId\);/, 'the embedded draw marks the chat read on the server');
  assert.match(t, /<MarkReadWhenShown threadId=\{threadId\} \/>/);
  assert.equal((t.match(/<ChatMessageStream\b/g) ?? []).length, 1, 'the host thread page mounts a second chat stream');
});

test('6 · both picked Chats draw the SHIPPED host strip — no second presence row', () => {
  // The host embed hands the stream its hosts (the stream draws `ChatHostStrip` when `hosts` is given), read from the
  // one source the supplier side reads, `event_chat_hosts`; only when embedded.
  const t = read(HOST_THREAD);
  // Build 3 (Lane A): the read moved into ONE helper the host thread calls — the same `event_chat_hosts` rpc.
  assert.match(t, /readCoupleChatStripPeople\([^)]*eventId: thread\.event_id/, 'the host embed no longer reads its hosts');
  assert.match(read('../lib/chat-strip-people.server.ts'), /rpc\('event_chat_hosts', \{ p_event_id: opts\.eventId \}\)/, 'the host strip no longer reads event_chat_hosts');
  assert.match(t, /\{\.\.\.\(hosts !== undefined \? \{ hosts \} : \{\}\)\}/, 'the host embed no longer hands the stream its hosts');
  assert.match(read(SUPPLIER_THREAD), /\{\.\.\.\(embedded \? \{ hosts: customerPlan\.hosts \} : \{\}\)\}/, 'the supplier embed lost its hosts');
  // No invented presence: nobody in Lane A's files says "online" or "last seen" or draws a strip of their own.
  for (const rel of [SHELL, HOST_THREAD, INBOX, 'dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /\bonline\b|last seen|<ChatHostStrip\b/i, `${rel} draws a second presence row`);
  }
});
