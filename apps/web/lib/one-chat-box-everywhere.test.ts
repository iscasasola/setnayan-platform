/**
 * ONE CHAT BOX, EVERYWHERE — a conversation is drawn in exactly two places.
 *
 * ── WHAT THIS EXISTS TO CATCH (owner, 2026-09-18) ───────────────────────────
 * "why did the chatbox never change?" #5586 turned the two THREAD pages into
 * one Messenger-style frame. The page the supplier actually lands on — the
 * client page — and the couple's vendor workspace each still EMBEDDED their
 * own copy of the chat under the flag-on shell: two nav rows above a
 * conversation that #5586 never touched, a couple-facing privacy sentence on
 * the supplier's screen, and a next-move tile that did not know a quote can
 * be accepted. A frame drawn by two mechanisms is a frame that will disagree
 * with itself again; the fix is that the embedding pages hold NO copy and
 * send a chat landing to the one frame.
 *
 * Every assertion below is a COUNT read from source with comments stripped,
 * and every floor fails the mistake actually made:
 *
 *   1. `<ChatMessageStream` is mounted in exactly the two thread pages
 *   2. the two embedding pages import none of the frame's parts
 *   3. the couple workspace redirects a chat landing to its thread page; the supplier's client draws Chat IN PLACE
 *      (THE ONE BUILD, 8 Nov 2026 · v111) with no second stream
 *   4. Chat is a page of the picked client / a LINK tab on the couple strip, with no Call tab anywhere
 *   5. the shell renders a link tab as an anchor and never selects it
 *   6. each thread frame's ⋮ carries the embedding page's sections
 *   7. the supplier's notice is addressed to the supplier; the couple's
 *      canonical string is untouched
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SUPPLIER_THREAD = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const COUPLE_THREAD = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const CLIENT_PAGE = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const WORKSPACE = 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const SHELL = 'app/_components/relationship-tab-shell.tsx';
const PICKED_CHAT_PAGE = 'app/vendor-dashboard/clients/[eventId]/_pages/chat.tsx';
const PICKED_MENU = 'app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu.ts';
const NOTICE = 'app/_components/chat-privacy-notice.tsx';

const supplierThread = read(SUPPLIER_THREAD);
const coupleThread = read(COUPLE_THREAD);
const client = read(CLIENT_PAGE);
const workspace = read(WORKSPACE);
const shell = read(SHELL);
const notice = read(NOTICE);

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') && !full.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const [rel, src] of [
    [SUPPLIER_THREAD, supplierThread],
    [COUPLE_THREAD, coupleThread],
    [CLIENT_PAGE, client],
    [WORKSPACE, workspace],
    [SHELL, shell],
    [NOTICE, notice],
  ] as const) {
    assert.ok(src.length > 800, `${rel} read as ${src.length} chars`);
  }
});

test('1 · the stream is mounted in exactly the two thread pages, nowhere else under app/', () => {
  const files = walk(join(WEB, 'app'));
  assert.ok(files.length > 800, `walked ${files.length} files — the walk broke`);
  const mounts: string[] = [];
  for (const f of files) {
    const n = count(stripComments(readFileSync(f, 'utf8')), /<ChatMessageStream\b/g);
    for (let i = 0; i < n; i++) mounts.push(f.slice(WEB.length + 1));
  }
  // The ONE exception: the chat lab (`/dev/chat-lab`), which draws the real stream on fixtures so a walk can see it —
  // allowed only because it 404s in production as its FIRST statement (checked here, not assumed).
  // The supplier's chat lab (`/dev/supplier-chat-lab`) draws it too since 2026-10-29, on the same terms.
  const LABS = ['app/dev/chat-lab/t/[threadId]/page.tsx', 'app/dev/supplier-chat-lab/page.tsx'];
  const product = mounts.filter((m) => !LABS.includes(m));
  for (const LAB of LABS.filter((l) => mounts.includes(l))) {
    const lab = stripComments(readFileSync(join(WEB, LAB), 'utf8'));
    const body = lab.slice(lab.indexOf('{', lab.indexOf(')', lab.indexOf('export default async function'))) + 1).trimStart();
    assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, `${LAB} can render on the live site`);
  }
  assert.deepEqual(
    product.sort(),
    [COUPLE_THREAD, SUPPLIER_THREAD].sort(),
    `a conversation is drawn somewhere other than the two frames: ${mounts.join(', ')}`,
  );
});

test('2 · the two embedding pages hold no piece of the frame', () => {
  for (const [rel, src] of [
    [CLIENT_PAGE, client],
    [WORKSPACE, workspace],
  ] as const) {
    for (const part of ['ChatMessageStream', 'ChatSendForm', 'ChatThreadMenu', 'ThreadCallLauncherLazy', 'ChatPrivacyNotice', 'ChatSafetyBanner']) {
      assert.equal(count(src, new RegExp(`\\b${part}\\b`, 'g')), 0, `${rel} still carries ${part}`);
    }
  }
});

test('3 · the couple workspace sends a chat landing to its thread page; the supplier client draws Chat in place', () => {
  // 🗂 THE ONE BUILD (8 Nov 2026 · v111/v113; spec §4: "Chat lives in the client … guard tests 3–4 updated
  // honestly"). The supplier's client page no longer forwards a chat landing — its Chat page draws the ONE
  // conversation in place (`_pages/chat.tsx`, which mounts no stream of its own: test 1 still counts every mount).
  assert.equal(
    count(client, /redirect\(`\/vendor-dashboard\/messages\/\$\{threadId\}`\)/g),
    0,
    'the client page forwards a chat landing again — the Chat page lives in the client now',
  );
  const chatPage = read(PICKED_CHAT_PAGE);
  assert.equal(count(chatPage, /<ChatMessageStream\b/g), 0, 'the Chat page mounts a second chat box');
  assert.equal(
    count(workspace, /relationshipShellEnabled && chatThread/g),
    1,
    'the workspace no longer redirects a chat landing',
  );
  assert.equal(
    count(workspace, /redirect\(`\/dashboard\/\$\{eventId\}\/messages\/\$\{chatThread\.thread_id\}`\)/g),
    1,
  );
  assert.equal(count(workspace, /rawLanding === 'chat' \|\| rawLanding === 'call'/g), 1);
});

test('4 · "Chat" is a page of the picked client and a door on the couple strip; there is no Call tab', () => {
  // Supplier: Chat is one of the picked client's nine pages (read back from the menu), and `call` only resolves TO
  // Chat — never a page of its own (the call lives on the composer row; `the-chat-has-no-calls`).
  const menu = read(PICKED_MENU);
  const pages = menu.slice(menu.indexOf('export const PICKED_CLIENT_PAGES'), menu.indexOf('] as const;'));
  assert.match(pages, /\{ id: 'chat', label: 'Chat'/, 'the picked client lost its Chat page');
  assert.equal(count(pages, /id: 'call'/g), 0, 'the picked client has a Call page — the call lives on the composer row');
  assert.match(menu, /call: 'chat'/, '`?tab=call` must land on Chat');
  assert.equal(count(client, /id: 'call'/g), 0, `${CLIENT_PAGE} still has a Call tab`);
  // Couple: unchanged — Chat stays a link tab in the workspace strip.
  const chatTab = workspace.match(/id: 'chat',[\s\S]{0,400}?\},/);
  assert.ok(chatTab, `${WORKSPACE} lost its Chat tab`);
  assert.match(chatTab![0], /href:/, `${WORKSPACE}: the Chat tab must be a link, not a panel`);
  assert.doesNotMatch(chatTab![0], /node: [^n]/, `${WORKSPACE}: a link tab renders no panel`);
  assert.equal(count(workspace, /id: 'call'/g), 0, `${WORKSPACE} still has a Call tab — the call lives on the composer row`);
});

test('5 · the shell draws a link tab as an anchor and never selects it', () => {
  assert.equal(count(shell, /href\?: string;/g), 1, 'RelationshipTab lost its href');
  assert.equal(count(shell, /data-tab-link=\{t\.id\}/g), 1, 'a link tab is not rendered as an anchor');
  assert.match(shell, /visible\.filter\(\(t\) => !t\.href\)\.map\(\(t\) => t\.id\)/, 'link tabs must be excluded from the selectable ids');
  assert.match(shell, /t\.id === active && !t\.href/, 'a link tab must never be the active panel');
});

test("6 · each frame's ⋮ carries the embedding page's sections", () => {
  // Read inside the ⋮'s own `links` (2026-10-28: the head's TITLE also opens `?tab=details`, the event's card).
  const menu = supplierThread.slice(supplierThread.indexOf('<ChatThreadMenu'), supplierThread.indexOf('/>', supplierThread.indexOf('links={[')));
  for (const tab of ['quote', 'files', 'schedule', 'details']) {
    assert.equal(
      count(menu, new RegExp(`clients/\\$\\{thread\\.event_id\\}\\?tab=${tab}`, 'g')),
      1,
      `the supplier's ⋮ lost the client page's ${tab} section`,
    );
  }
  // A bare profile link would bounce straight back to the frame.
  assert.equal(count(supplierThread, /clients\/\$\{thread\.event_id\}`,/g), 0, "the supplier's ⋮ links the client page with no ?tab — that redirects back here");
  // `workspaceHref`, not `quoteLockHref`: since 2026-09-19 the lock link opens
  // the bench (lib/lock-door.ts) and the workspace route is the ⋮'s base only.
  for (const tab of ['quote', 'payments', 'files', 'schedule', 'details']) {
    assert.equal(
      count(coupleThread, new RegExp(`\\$\\{workspaceHref\\}\\?tab=${tab}`, 'g')),
      1,
      `the couple's ⋮ lost the workspace's ${tab} section`,
    );
  }
});

test('7 · the supplier reads a notice addressed to the supplier; the couple’s canonical string is untouched', () => {
  assert.equal(count(supplierThread, /<ChatPrivacyNotice inBox viewer="vendor" \/>/g), 1, 'the supplier frame must pass viewer="vendor"');
  const vendorBlock = notice.match(/vendor: \{[\s\S]*?\},/);
  assert.ok(vendorBlock, 'the notice has no vendor copy');
  assert.doesNotMatch(vendorBlock![0], /your vendor/i, 'the supplier copy still talks about "your vendor"');
  assert.match(vendorBlock![0], /Never ask for private info/);
  // Iteration 0019 § Gate, EN canonical — byte for byte.
  assert.match(notice, /lead: 'All your event info is already in Setnayan',/);
  assert.match(notice, /body: '— your supplier sees what they need from your profile\. Please don’t share private info in chat\.',/);
  assert.match(notice, /report: 'If a supplier asks for these, report it via Help\.',/);
  // The default reader is the couple, so an unlabelled mount cannot show a shop the supplier line.
  assert.match(notice, /viewer = 'couple',/);
});

test('9 · THE ONE BUILD · the picked client\'s Chat and Quotation pages draw the ONE thread body — no frame part of their own', () => {
  // v111 (owner 8 Nov 2026): Chat lives in the client. Still ONE chat body: each client page renders
  // `SupplierThreadBody`, which renders the supplier thread page itself (test 1's one mount site) — nothing else.
  const body = read('app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body.tsx');
  assert.match(body, /import VendorThreadPage from '\.\.\/page';/, 'the body is not the thread page');
  assert.match(body, /<VendorThreadPage\b/);
  for (const rel of ['app/vendor-dashboard/clients/[eventId]/_pages/chat.tsx', 'app/vendor-dashboard/clients/[eventId]/_pages/quotation.tsx']) {
    const src = read(rel);
    assert.equal(count(src, /<SupplierThreadBody\b/g), 1, `${rel} does not draw the one thread body`);
    for (const part of ['ChatMessageStream', 'ChatSendForm', 'ChatThreadMenu', 'ChatBox', 'ChatThreadFrame', 'ChatPrivacyNotice']) {
      assert.equal(count(src, new RegExp(`\\b${part}\\b`, 'g')), 0, `${rel} carries ${part} of its own`);
    }
  }
  // The full-screen route keeps working for the envelope doors (6 Nov ruling): the embed is opt-in, internal.
  // Build 2 · B2-D: every embed (chat · quotation · decisions) goes through the ONE shared draw; anything else is full.
  assert.match(supplierThread, /sp\?\.__embed === 'chat' \|\| sp\?\.__embed === 'quotation' \|\| sp\?\.__embed === 'decisions'/);
  assert.match(supplierThread, /return \(await drawVendorThread\(threadId, sp, false\)\)\.full;/);
});
