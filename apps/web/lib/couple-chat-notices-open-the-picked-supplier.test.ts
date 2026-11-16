/**
 * couple-chat-notices-open-the-picked-supplier.test.ts — CHAT-06 · CHAT-07 (W1 walk 16 Nov 2026).
 *
 *   CHAT-07 · a couple's chat notice opened `/dashboard/<event>/messages/<thread>` — the old thread page, no tabs —
 *             while their Messages row opens the picked supplier on Chat. And the supplier's chat PUSH still opened the
 *             bare thread page after its tray notice had moved (11 Nov).
 *   CHAT-06 · reading a thread left its chat notices unread; only the one tapped cleared.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. `coupleChatHref` — the event's row for the shop opens the workspace on Chat; no row keeps the thread page.
 *      The Messages list builds its row link through it (one shape, two callers).
 *   2. NO couple CHAT notice (chat_message · chat_message_in_app · service_card_shared) in app/ or lib/ links
 *      `/dashboard/${…}/messages/${…}`; the senders the walk named go through `readCoupleChatHref`; the supplier's
 *      chat push goes through `supplierChatHref`.
 *   3. Reading a thread clears its chat notices: `markThreadRead` calls `markThreadNoticesRead` (in `after()`, once
 *      the read marker was written); the doors it clears are THIS conversation's — old and new — and only chat types.
 *
 * SABOTAGE (each run once, each went red): put `/dashboard/${args.eventId}/messages/${args.threadId}` back as a
 * shop→host notice link in lib/chat-actions.ts → 2; drop the `markThreadNoticesRead` call → 3; drop the old thread
 * page from `threadNoticeDoors` → 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { coupleChatHref } from '@/lib/couple-chat-door';
import { threadNoticeDoors, CHAT_NOTICE_TYPES } from '@/lib/thread-notice-doors';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

type Call = { file: string; type: string; link: string };

/** Every `emitNotification({ … })`: its `type` and its `relatedUrl` expression, a local resolved to what built it. */
function notificationCalls(): Call[] {
  const calls: Call[] = [];
  for (const abs of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const raw = readFileSync(abs, 'utf8');
    if (!raw.includes('emitNotification(')) continue;
    const code = stripComments(raw);
    const file = relative(WEB, abs);
    let at = code.indexOf('emitNotification({');
    while (at !== -1) {
      const end = code.indexOf('});', at);
      const block = code.slice(at, end === -1 ? at + 1200 : end);
      const type = /type:\s*'([a-z_]+)'/.exec(block)?.[1] ?? '(computed)';
      let link = /relatedUrl(?::\s*([\s\S]*?))?,\s*\n/.exec(block)?.[1] ?? '';
      const local = link === '' ? 'relatedUrl' : /^[A-Za-z_$][\w$]*$/.test(link.trim()) ? link.trim() : null;
      if (local) {
        const def = new RegExp(`const ${local}(?::[^=]+)?\\s*=([\\s\\S]*?);\\n`).exec(code.slice(0, at));
        if (def) link = def[1]!;
      }
      calls.push({ file, type, link });
      at = code.indexOf('emitNotification({', at + 1);
    }
  }
  return calls;
}

const COUPLE_CHAT_TYPES = new Set(['chat_message', 'chat_message_in_app', 'service_card_shared']);

test('1 · the couple’s door: the workspace on Chat when the shop has a row, else the thread page; the list uses it', () => {
  assert.equal(coupleChatHref('e1', 'v9', 't1'), '/dashboard/e1/vendors/v9/workspace?tab=chat');
  assert.equal(coupleChatHref('e1', null, 't1'), '/dashboard/e1/messages/t1', 'a thread with no row lost its only page');
  assert.match(src('app/dashboard/[eventId]/messages/page.tsx'), /href: coupleChatHref\(eventId, eventVendorId, r\.threadId\)/);
});

test('2 · no couple chat notice opens the old thread page, and the supplier’s chat push opens the picked client', () => {
  const calls = notificationCalls();
  assert.ok(calls.length > 40, `anti-vacuity: only ${calls.length} emitNotification calls were read`);
  const old = calls.filter((c) => COUPLE_CHAT_TYPES.has(c.type) && /\/dashboard\/\$\{[^}]+\}\/messages\/\$\{/.test(c.link));
  assert.deepEqual(
    old.map((c) => `${c.file} · ${c.type}`),
    [],
    'a couple chat notice opens /dashboard/<event>/messages/<thread> — use readCoupleChatHref (the workspace’s Chat)',
  );
  const chat = src('lib/chat-actions.ts');
  assert.ok(
    (chat.match(/relatedUrl: coupleChatHref\(args\.eventId, await coupleRow\(\), args\.threadId\)/g) ?? []).length >= 3,
    'the shop→host and host→host chat notices lost the door',
  );
  assert.match(chat, /readCoupleWorkspaceRowId\(admin, \{ eventId: args\.eventId, vendorProfileId: args\.vendorProfileId, threadId: args\.threadId \}\)/);
  const ring = src('app/_actions/thread-call-actions.ts');
  assert.match(ring, /coupleChatHref\(\s*thread\.event_id,\s*await readCoupleWorkspaceRowId\(createAdminClient\(\)/, 'the call ring lost the couple’s door');
  assert.match(src('lib/offer-service-core.ts'), /const coupleRow = await readCoupleWorkspaceRowId\(admin/);
  assert.match(src('lib/offer-service-core.ts'), /relatedUrl: coupleChatHref\(thread\.event_id, coupleRow, threadId\)/);
  const push = src('app/api/notify/route.ts');
  assert.match(push, /url: supplierChatHref\(/, 'the supplier’s chat push opens the bare thread page again');
  assert.doesNotMatch(push, /url: `\/vendor-dashboard\/messages\/\$\{thread_id\}`/);
});

test('3 · reading a thread clears that conversation’s chat notices — its doors only, chat types only', () => {
  const chat = src('lib/chat-actions.ts');
  const fn = chat.slice(chat.indexOf('export async function markThreadRead'), chat.indexOf('export async function sendChatMessage'));
  assert.match(fn, /\} else \{\s*after\(\(\) => markThreadNoticesRead\(user\.id, threadId\)\);/, 'reading a thread no longer clears its notices');
  const doors = threadNoticeDoors({ eventId: 'e1', threadId: 't1', coupleDoor: '/dashboard/e1/vendors/v9/workspace?tab=chat' });
  for (const d of [
    '/dashboard/e1/vendors/v9/workspace?tab=chat',
    '/vendor-dashboard/clients/e1?tab=chat',
    '/dashboard/e1/messages/t1',
    '/vendor-dashboard/messages/t1',
  ]) {
    assert.ok(doors.includes(d), `${d} — a notice with this link stays unread after its thread is read`);
  }
  assert.ok(!doors.some((d) => /\/vendors\/(?!v9)/.test(d)), 'another shop’s workspace door would be cleared');
  assert.deepEqual([...CHAT_NOTICE_TYPES], ['chat_message', 'chat_message_in_app']);
  const mark = src('lib/thread-notices-read.server.ts');
  assert.match(mark, /\.eq\('user_id', userId\)/, 'the admin update is no longer scoped to the reader');
  assert.match(mark, /\.in\('related_url', threadNoticeDoors\(/);
  assert.match(mark, /\.in\('type', \[\.\.\.CHAT_NOTICE_TYPES\]\)/);
});
