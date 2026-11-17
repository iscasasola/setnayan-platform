/**
 * a-conversation-opens-the-client-chat.test.ts — 🚪 EVERY WAY INTO A CLIENT CONVERSATION LANDS ON THE CLIENT'S CHAT.
 *
 * Owner, 17 Nov, on the #7901 preview (iPhone): the client workspace (Chat · Details · Quotation · Forms · Schedule ·
 * Files) is right, but a pop-up's Reply opened the OLD full-screen thread page (`/vendor-dashboard/messages/<thread>`)
 * instead. Owner rule, 11 Nov: *"a redesign moves every way in"*. `supplier-notices-open-the-picked-client.test.ts`
 * already holds the NOTICES; this holds every other link, the stored ones, and the page itself.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. No source in app/ or lib/ types a link to `/vendor-dashboard/messages/${…}` — links go through
 *      `supplierChatHref` (the client's Chat), `supplierThreadPaneHref` (the computer inbox's pane, owner 13 Nov D3) or
 *      `supplierThreadPageHref` (a closed / archived / older chat the client's Chat does not draw). The reasoned
 *      exceptions below are RETURNS from inside the thread, not ways in.
 *   2. `supplierThreadForward` — a plain arrival forwards to the client's Chat, "Update this quote" to its Quotation;
 *      a notice, the pane, an older chat or a thread with no event keeps the page.
 *   3. The thread page itself forwards (stored links: notices already in bells, old pushes) — only when it is not an
 *      embed, only a chat the client page admits (accepted, or pending and not archived), and only after asking which
 *      thread the client's Chat draws.
 *
 * SABOTAGE (each run once, each went red): the Today "Reply" typed back to the thread page → 1; the forward without the
 * `drawn === threadId` check → 3; `supplierThreadForward` forwarding a `?notice=` return → 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { supplierChatHref, supplierThreadForward, supplierThreadPageHref, supplierThreadPaneHref } from '@/lib/upcoming-schedule-door';

const WEB = join(import.meta.dirname, '..');

/** Files allowed to type the thread path, each with its reason. A folder ends in `/`. */
const ALLOWED: Record<string, string> = {
  'lib/upcoming-schedule-door.ts': 'the helpers themselves',
  'app/vendor-dashboard/messages/': "the thread route's own returns and revalidations (a notice comes back to the page)",
  'app/_components/chat-message-stream.tsx': 'returns from an action taken inside the thread (they carry its notice)',
  'lib/chat-actions.ts': "acceptInquiry's return, which carries `?error=` back to the thread",
  'app/dashboard/[eventId]/vendors/actions.ts':
    'inquiry_displaced — a released inquiry keeps the thread page (the reasoned exception in supplier-notices-open-the-picked-client.test.ts)',
};

const TYPED = /\/vendor-dashboard\/messages\/(?:\$\{|['"`]\s*\+)/;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.lab\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const allowed = (rel: string) => Object.keys(ALLOWED).some((k) => (k.endsWith('/') ? rel.startsWith(k) : rel === k));

test('1 · no link is typed to the full-screen thread page — it goes through the helpers', () => {
  const offenders: string[] = [];
  for (const abs of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const rel = relative(WEB, abs).split('\\').join('/');
    if (allowed(rel)) continue;
    const src = stripComments(readFileSync(abs, 'utf8'));
    src.split('\n').forEach((line, i) => {
      if (TYPED.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [], `a way into a conversation is typed to the old thread page — use supplierChatHref:\n${offenders.join('\n')}`);
});

test('2 · supplierThreadForward: a plain arrival opens the client, anything carrying state keeps the page', () => {
  assert.equal(supplierThreadForward('ev1', undefined, true), '/vendor-dashboard/clients/ev1?tab=chat');
  assert.equal(supplierThreadForward('ev1', {}, true), '/vendor-dashboard/clients/ev1?tab=chat');
  assert.equal(supplierThreadForward('ev1', { compose: 'quote' }, true), '/vendor-dashboard/clients/ev1?tab=quote');
  assert.equal(supplierThreadForward('ev1', { compose: 'deal' }, true), null, 'the counter-offer panel lives on the page');
  assert.equal(supplierThreadForward('ev1', { notice: 'proposal_sent' }, true), null, 'a notice must still be said');
  assert.equal(supplierThreadForward('ev1', { lock_agree: 'ok' }, true), null);
  assert.equal(supplierThreadForward('ev1', { pane: '1' }, true), null, 'the computer inbox pane draws the thread');
  assert.equal(supplierThreadForward('ev1', undefined, false), null, 'an older chat on the event is not the one Chat draws');
  assert.equal(supplierThreadForward(null, undefined, true), null, 'no event → no client to open');
  assert.equal(supplierChatHref('ev1', 't1'), '/vendor-dashboard/clients/ev1?tab=chat');
  assert.equal(supplierChatHref(null, 't1'), supplierThreadPageHref('t1'));
  assert.equal(supplierThreadPaneHref('t1'), '/vendor-dashboard/messages/t1?pane=1');
});

test('3 · the thread page forwards a plain arrival — never an embed, a released inquiry or another thread', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8'));
  const at = page.indexOf('supplierThreadForward(');
  assert.ok(at > 0, 'the thread page no longer asks supplierThreadForward');
  const block = page.slice(page.lastIndexOf('if (!embedded', at), page.indexOf('redirect(forward)', at) + 20);
  assert.ok(block.startsWith('if (!embedded'), 'the forward is no longer guarded by `if (!embedded …)`');
  assert.match(block, /clientAdmits/, 'only a chat the client page admits may forward');
  assert.match(page, /const clientAdmits =\s*thread\.inquiry_status === 'accepted' \|\| \(thread\.inquiry_status === 'pending' && !thread\.archived_at\)/, 'a released, declined or withdrawn chat must keep the page');
  assert.match(block, /readClientChatThreadId\(/, 'the forward must ask which thread the client\'s Chat draws');
  assert.match(block, /drawn === threadId/, 'only the thread the client\'s Chat draws may forward');
  assert.ok(page.indexOf('redirect(forward)') > page.indexOf('notFound()'), 'the forward runs after the ownership check');
});

test('4 · the computer inbox pane is marked, so it keeps drawing the thread beside the list', () => {
  const inbox = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/messages/page.tsx'), 'utf8'));
  assert.match(inbox, /paneHref:\s*supplierThreadPaneHref\(/);
});
