/**
 * supplier-notices-open-the-picked-client.test.ts — 🚪 A SUPPLIER'S NOTICE OPENS THE PICKED CLIENT, NEVER A DEAD END.
 *
 * Owner, 11 Nov, live as SetnaProd: *"When that is pressed it jump to the supplie-client card that was already planned
 * with the details-chat-form-quote-files-report and more menus that would grow to full screen"* — every way into a
 * client lands in the ONE picked client (`/vendor-dashboard/clients/<event>?tab=…`), the Clients rows, Today's rows and
 * the Chats inbox already did; an audit of origin/main found the NOTICES still on the old doors:
 *   1. inquiry · message · meeting · quote answer · booked · cancelled · payment logged · call → the bare thread page
 *      (`/vendor-dashboard/messages/<thread>`), outside the shell and its page menu;
 *   2. `guest_takedown_honored` and 3. `schedule_ask` → the live console, which redirects away unless today IS the event
 *      day — a dead end every other day.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. `supplierChatHref` — an event's thread opens the picked client on Chat; only a thread naming no event keeps the
 *      bare thread page. `supplierLiveOrClientHref` — the console on the day, else the picked client's Schedule / Hub.
 *   2. NO `emitNotification` in app/ or lib/ links a supplier to `/vendor-dashboard/messages/${…}` (directly or through
 *      the local it was built in), except the reasoned exceptions below.
 *   3. NO `emitNotification` links to `/vendor-dashboard/on-the-day/live/` except through the day check
 *      (`scheduleShiftHref` / `supplierLiveOrClientHref`).
 *
 * SABOTAGE (each run once, each went red): put `/vendor-dashboard/messages/${args.threadId}` back as the inquiry's link
 * in lib/chat-actions.ts → 2; put the takedown's literal live link back → 3; return the thread page from
 * `supplierChatHref` for an event → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { supplierChatHref } from '@/lib/upcoming-schedule-door';
import { supplierLiveOrClientHref, scheduleShiftHref } from '@/lib/schedule-shift-notice';

const WEB = join(import.meta.dirname, '..');

/**
 * The reasoned exceptions — `<file> · <notification type>`. Add one only with its reason.
 *   · inquiry_displaced — the couple booked someone else, so the inquiry is RELEASED: the picked client may no longer
 *     open for this shop, and the thread page is where `closingCopy` says who closed it.
 */
const THREAD_PAGE_ALLOWED = new Set(['app/dashboard/[eventId]/vendors/actions.ts · inquiry_displaced']);

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

/** Every `emitNotification({ … })` call: its `type` and its `relatedUrl` expression, a local resolved to what built it. */
function notificationCalls(): Call[] {
  const calls: Call[] = [];
  for (const abs of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const raw = readFileSync(abs, 'utf8');
    if (!raw.includes('emitNotification(')) continue;
    const src = stripComments(raw);
    const file = relative(WEB, abs);
    let at = src.indexOf('emitNotification({');
    while (at !== -1) {
      const end = src.indexOf('});', at);
      const block = src.slice(at, end === -1 ? at + 1200 : end);
      const type = /type:\s*'([a-z_]+)'/.exec(block)?.[1] ?? '(computed)';
      let link = /relatedUrl(?::\s*([\s\S]*?))?,\s*\n/.exec(block)?.[1] ?? '';
      // `relatedUrl,` (shorthand) or `relatedUrl: someLocal` — read the local's own expression.
      const local = link === '' ? 'relatedUrl' : /^[A-Za-z_$][\w$]*$/.test(link.trim()) ? link.trim() : null;
      if (local) {
        const def = new RegExp(`const ${local}(?::[^=]+)?\\s*=([\\s\\S]*?);\\n`).exec(src.slice(0, at));
        if (def) link = def[1]!;
      }
      calls.push({ file, type, link });
      at = src.indexOf('emitNotification({', at + 1);
    }
  }
  return calls;
}

test('1 · the two doors: an event’s thread opens the picked client on Chat; the console only on the day', () => {
  assert.equal(supplierChatHref('e1', 't1'), '/vendor-dashboard/clients/e1?tab=chat');
  assert.equal(supplierChatHref(null, 't1'), '/vendor-dashboard/messages/t1', 'a thread with no event lost its only page');
  assert.equal(supplierLiveOrClientHref('e1', true, 'hub'), '/vendor-dashboard/on-the-day/live/e1');
  assert.equal(supplierLiveOrClientHref('e1', false, 'hub'), '/vendor-dashboard/clients/e1?tab=hub');
  assert.equal(supplierLiveOrClientHref('e1', false, 'schedule'), '/vendor-dashboard/clients/e1?tab=schedule');
  assert.equal(scheduleShiftHref('e1', false), '/vendor-dashboard/clients/e1', 'the shipped shift notice changed its off-day door');
});

test('2 · no supplier notice opens the bare thread page for an event’s thread', () => {
  const calls = notificationCalls();
  assert.ok(calls.length > 40, `anti-vacuity: only ${calls.length} emitNotification calls were read`);
  const named = new Set(calls.map((c) => `${c.file} · ${c.type}`));
  for (const allowed of THREAD_PAGE_ALLOWED) assert.ok(named.has(allowed), `stale exception: ${allowed}`);
  const bare = calls.filter((c) => /\/vendor-dashboard\/messages\/\$\{/.test(c.link) && !THREAD_PAGE_ALLOWED.has(`${c.file} · ${c.type}`));
  assert.deepEqual(
    bare.map((c) => `${c.file} · ${c.type}`),
    [],
    'a supplier notice opens /vendor-dashboard/messages/<thread> — use supplierChatHref(eventId, threadId) (the picked client’s Chat)',
  );
  // And the ones the audit named do go through the door.
  const via = calls.filter((c) => /supplierChatHref\(/.test(c.link));
  for (const t of ['vendor_inquiry_received', 'chat_message', 'schedule_suggestion', 'payment_logged', 'booking_cancelled']) {
    assert.ok(via.some((c) => c.type === t), `${t} no longer opens the picked client’s Chat`);
  }
  // The quote answer's type is computed (accepted · declined) — held by its file.
  assert.ok(via.some((c) => c.file === 'app/vendor-dashboard/proposals/actions.ts'), 'a quote answer no longer opens the picked client’s Chat');
});

test('3 · no notice opens the live console without the day check', () => {
  const live = notificationCalls().filter((c) => /on-the-day\/live\//.test(c.link));
  assert.deepEqual(
    live.map((c) => `${c.file} · ${c.type}`),
    [],
    'a notice links the live console directly — it redirects away on every other day; use supplierLiveOrClientHref',
  );
  const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
  assert.match(src('lib/tell-the-supplier-it-came-down.ts'), /relatedUrl: supplierLiveOrClientHref\(eventId, onTheDay, 'hub'\)/);
  assert.match(src('lib/change-the-schedule.server.ts'), /relatedUrl: supplierLiveOrClientHref\(eventId, onTheDay, 'schedule'\)/);
});
