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
 *   3. …and each redirects a chat landing to its thread page, under the flag
 *   4. …and each keeps "Chat" in its strip as a LINK tab, with no Call tab
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
  assert.deepEqual(
    mounts.sort(),
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

test('3 · each embedding page sends a chat landing to its thread page, behind the shell flag', () => {
  assert.equal(
    count(client, /relationshipShellEnabled && threadId && \(!rawTab \|\| rawTab === 'chat' \|\| rawTab === 'call'\)/g),
    1,
    'the client page no longer redirects a chat landing',
  );
  assert.equal(count(client, /redirect\(`\/vendor-dashboard\/messages\/\$\{threadId\}`\)/g), 1);
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

test('4 · "Chat" stays in each strip as a door (href), and there is no Call tab', () => {
  for (const [rel, src] of [
    [CLIENT_PAGE, client],
    [WORKSPACE, workspace],
  ] as const) {
    const chatTab = src.match(/id: 'chat',[\s\S]{0,400}?\},/);
    assert.ok(chatTab, `${rel} lost its Chat tab`);
    assert.match(chatTab![0], /href:/, `${rel}: the Chat tab must be a link, not a panel`);
    assert.doesNotMatch(chatTab![0], /node: [^n]/, `${rel}: a link tab renders no panel`);
    assert.equal(count(src, /id: 'call'/g), 0, `${rel} still has a Call tab — the call lives on the composer row`);
  }
});

test('5 · the shell draws a link tab as an anchor and never selects it', () => {
  assert.equal(count(shell, /href\?: string;/g), 1, 'RelationshipTab lost its href');
  assert.equal(count(shell, /data-tab-link=\{t\.id\}/g), 1, 'a link tab is not rendered as an anchor');
  assert.match(shell, /visible\.filter\(\(t\) => !t\.href\)\.map\(\(t\) => t\.id\)/, 'link tabs must be excluded from the selectable ids');
  assert.match(shell, /t\.id === active && !t\.href/, 'a link tab must never be the active panel');
});

test("6 · each frame's ⋮ carries the embedding page's sections", () => {
  for (const tab of ['quote', 'files', 'schedule', 'details']) {
    assert.equal(
      count(supplierThread, new RegExp(`clients/\\$\\{thread\\.event_id\\}\\?tab=${tab}`, 'g')),
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
  assert.match(notice, /body: '— your vendor sees what they need from your profile\. Please don’t share private info in chat\.',/);
  assert.match(notice, /report: 'If a vendor asks for these, report it via Help\.',/);
  // The default reader is the couple, so an unlabelled mount cannot show a shop the supplier line.
  assert.match(notice, /viewer = 'couple',/);
});
