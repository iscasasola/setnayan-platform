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
 *   5. RETIRED 2026-11-09 — the two-sided strip (`relationship-tab-shell.tsx`) is gone; both sides open the ONE
 *      picked shell, which has no link tabs (Chat is a page)
 *   6. each thread frame's ⋮ carries the embedding page's sections
 *   7. the supplier's notice is addressed to the supplier; the couple's
 *      canonical string is untouched
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SUPPLIER_THREAD = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const COUPLE_THREAD = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const CLIENT_PAGE = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const WORKSPACE = 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const PICKED_CHAT_PAGE = 'app/vendor-dashboard/clients/[eventId]/_pages/chat.tsx';
const PICKED_MENU = 'app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu.ts';
const NOTICE = 'app/_components/chat-privacy-notice.tsx';

const supplierThread = read(SUPPLIER_THREAD);
const coupleThread = read(COUPLE_THREAD);
const client = read(CLIENT_PAGE);
const workspace = read(WORKSPACE);
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
  const LABS = ['app/dev/chat-lab/t/[threadId]/page.lab.tsx', 'app/dev/supplier-chat-lab/page.lab.tsx'];
  // 💬 12 Nov 2026 — EVENT GROUP CHATS (owner "group chats approved": "Same chat as the supplier's"). The group's ONE
  // view draws the same stream, in the same ChatBox; it is mounted by the group page and by its lab, which 404s in
  // production (checked below like the other labs).
  const GROUP_VIEW = 'app/samahan/chat/[threadId]/_components/group-chat-view.tsx';
  // 🪞 Supplier Build 3 · Lane A (9 Nov 2026): the picked-page labs draw the stream through ONE lab part,
  // `app/dev/_components/lab-picked-chat.tsx` — not a page, so it cannot 404 itself. It is allowed only while EVERY
  // file that imports it is a lab page that 404s in production as its first statement (checked here, not assumed).
  const LAB_PART = 'app/dev/_components/lab-picked-chat.tsx';
  const LAB_PART_PAGES = ['app/dev/chat-lab/page.lab.tsx', 'app/dev/supplier-chat-lab/page.lab.tsx'];
  const partImporters = files
    .filter((f) => /lab-picked-chat['"]/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1))
    .filter((f) => !/\.test\.tsx?$/.test(f));
  assert.deepEqual(partImporters.sort(), [...LAB_PART_PAGES].sort(), `the lab chat part is imported outside the two lab pages: ${partImporters.join(', ')}`);
  const groupViewImporters = files
    .filter((f) => /group-chat-view['"]/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1))
    .filter((f) => !/\.test\.tsx?$/.test(f));
  assert.deepEqual(groupViewImporters.sort(), ['app/dev/event-group-chat-lab/page.lab.tsx', 'app/samahan/chat/[threadId]/page.tsx'], `the group view is drawn elsewhere: ${groupViewImporters.join(', ')}`);
  {
    const lab = stripComments(readFileSync(join(WEB, 'app/dev/event-group-chat-lab/page.lab.tsx'), 'utf8'));
    const body = lab.slice(lab.indexOf('{', lab.indexOf(')', lab.indexOf('export default async function'))) + 1).trimStart();
    assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the group chat lab can render on the live site');
  }
  const product = mounts.filter((m) => !LABS.includes(m) && m !== LAB_PART);
  for (const LAB of [...LABS.filter((l) => mounts.includes(l)), ...(mounts.includes(LAB_PART) ? LAB_PART_PAGES : [])]) {
    const lab = stripComments(readFileSync(join(WEB, LAB), 'utf8'));
    const body = lab.slice(lab.indexOf('{', lab.indexOf(')', lab.indexOf('export default async function'))) + 1).trimStart();
    assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, `${LAB} can render on the live site`);
  }
  assert.deepEqual(
    product.sort(),
    [COUPLE_THREAD, SUPPLIER_THREAD, GROUP_VIEW].sort(),
    `a conversation is drawn somewhere other than the two frames and the group view: ${mounts.join(', ')}`,
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
  // 🪞 SUPPLIER BUILD 3 · LANE A (9 Nov 2026; DECISION_LOG 🪞): the couple's workspace is the host's picked supplier now,
  // and it no longer forwards a chat landing either — its Chat page draws the ONE conversation in place
  // (`CoupleThreadBody` → the thread page itself, `__embed: 'chat'`; it mounts no stream of its own: test 1 still counts
  // every mount). Honest update of the half that described the old redirect.
  assert.equal(count(workspace, /relationshipShellEnabled && chatThread/g), 0, 'the workspace forwards a chat landing again');
  assert.equal(
    count(workspace, /redirect\(`\/dashboard\/\$\{eventId\}\/messages\/\$\{chatThread\.thread_id\}`\)/g),
    0,
    'the workspace forwards to the thread again — Chat is a page of the picked supplier',
  );
  assert.equal(count(workspace, /<CoupleThreadBody eventId=\{eventId\} threadId=\{chatThread\.thread_id\} \/>/g), 1);
  const coupleBody = read('app/dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body.tsx');
  assert.equal(count(coupleBody, /<ChatMessageStream\b/g), 0, 'the couple Chat page mounts a second chat box');
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
  // Couple (🪞 Build 3 · Lane A, 9 Nov 2026): Chat is a page of the host's picked supplier too, and `call` only resolves
  // TO Chat — never a page of its own.
  const supplierMenu = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-menu.ts');
  const supplierPages = supplierMenu.slice(supplierMenu.indexOf('export const PICKED_SUPPLIER_PAGES'), supplierMenu.indexOf('] as const;', supplierMenu.indexOf('export const PICKED_SUPPLIER_PAGES')));
  assert.match(supplierPages, /\{ id: 'chat', label: 'Chat' \}/, 'the picked supplier lost its Chat page');
  assert.equal(count(supplierPages, /id: 'call'/g), 0, 'the picked supplier has a Call page — the call lives on the composer row');
  assert.match(supplierMenu, /call: 'chat'/, '`?tab=call` must land on Chat');
  assert.equal(count(workspace, /id: 'call'/g), 0, `${WORKSPACE} still has a Call tab — the call lives on the composer row`);
});

test('5 · the retired two-sided strip stays retired — one picked shell draws both sides', () => {
  assert.ok(!existsSync(join(WEB, 'app/_components/relationship-tab-shell.tsx')), 'the two-sided strip is back beside the one picked shell');
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
