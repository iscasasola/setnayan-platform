/**
 * inquiry-reminder.test.ts — ONE reminder per unanswered inquiry, at the SAME
 * 48 hours the in-app nudge uses, and it cannot repeat.
 *
 * The rule (`inquiriesDueAReminder`) is EXECUTED. The parts a pure test cannot
 * run — that the sweep reads the record before it sends, sends only once that
 * record exists, and that the sign-in nudge of the same type stays out of the
 * inbox — are pinned on the source, per function.
 *
 * SABOTAGE (each seen red, restored): a second definition of the threshold ·
 * the sweep stops reading the record · the sweep drops onlyIfStored · the
 * sign-in nudge drops skipEmail · the emitter emails without a stored row ·
 * the rule ignores the record.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';
import {
  GHOST_THRESHOLD_HOURS,
  inquiriesDueAReminder,
  inquiryReminderLink,
  inquiryReminderNotice,
  reminderKey,
  type PendingInquiry,
} from './inquiry-reminder';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const HOUR = 3600 * 1000;
const NOW = Date.parse('2026-10-10T12:00:00Z');
const thread = (id: string, hoursOld: number, over: Partial<PendingInquiry> = {}): PendingInquiry => ({
  thread_id: id,
  event_id: `event-${id}`,
  vendor_profile_id: `shop-${id}`,
  created_at: new Date(NOW - hoursOld * HOUR).toISOString(),
  inquiry_status: 'pending',
  archived_at: null,
  ...over,
});
const shops = (...ids: string[]) => new Map(ids.map((id) => [`shop-${id}`, `user-${id}`]));

test('due at the threshold and not a minute before — the same 48 hours as the sign-in nudge', () => {
  assert.equal(GHOST_THRESHOLD_HOURS, 48);
  const threads = [thread('young', GHOST_THRESHOLD_HOURS - 1), thread('edge', GHOST_THRESHOLD_HOURS), thread('old', 200)];
  const due = inquiriesDueAReminder({ threads, supplierUserByShop: shops('young', 'edge', 'old'), alreadyReminded: new Set(), nowMs: NOW });
  assert.deepEqual(due.map((d) => d.thread.thread_id), ['edge', 'old']);
  assert.deepEqual(due[0], { thread: threads[1], userId: 'user-edge', link: '/vendor-dashboard/messages/edge' });
});

test('🔒 it cannot repeat: once a reminder is on record, that inquiry is never due again', () => {
  const threads = [thread('a', 60), thread('b', 60)];
  const supplierUserByShop = shops('a', 'b');
  // Pass 1 — nothing on record.
  const first = inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded: new Set(), nowMs: NOW });
  assert.equal(first.length, 2);
  // What the sweep stores for each one it sent.
  const record = new Set(first.map((d) => reminderKey(d.userId, d.link)));
  // Pass 2, a day later, the same inquiries still unanswered: nothing is due.
  const second = inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded: record, nowMs: NOW + 24 * HOUR });
  assert.deepEqual(second, [], 'an inquiry that was already reminded came due again');
  // …and a year later.
  assert.deepEqual(inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded: record, nowMs: NOW + 365 * 24 * HOUR }), []);
  // The record is per (supplier, thread): one stored reminder does not excuse another thread.
  const onlyA = new Set([reminderKey('user-a', inquiryReminderLink('a'))]);
  assert.deepEqual(
    inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded: onlyA, nowMs: NOW }).map((d) => d.thread.thread_id),
    ['b'],
  );
  // A thread listed twice in one read is still one reminder.
  assert.equal(inquiriesDueAReminder({ threads: [threads[0]!, threads[0]!], supplierUserByShop, alreadyReminded: new Set(), nowMs: NOW }).length, 1);
});

test('only an inquiry still waiting on the supplier is reminded', () => {
  const threads = [
    thread('accepted', 100, { inquiry_status: 'accepted' }),
    thread('declined', 100, { inquiry_status: 'declined' }),
    thread('displaced', 100, { inquiry_status: 'displaced' }),
    thread('withdrawn', 100, { archived_at: new Date(NOW - HOUR).toISOString() }),
    thread('noaccount', 100),
    thread('baddate', 100, { created_at: 'not a date' }),
    thread('waiting', 100),
  ];
  const due = inquiriesDueAReminder({
    threads,
    supplierUserByShop: shops('accepted', 'declined', 'displaced', 'withdrawn', 'baddate', 'waiting'),
    alreadyReminded: new Set(),
    nowMs: NOW,
  });
  assert.deepEqual(due.map((d) => d.thread.thread_id), ['waiting']);
});

test('the words: the nudge\'s own title, the threshold printed from the constant, nobody named', () => {
  const n = inquiryReminderNotice();
  assert.equal(n.title, 'An inquiry is awaiting your reply');
  assert.ok(n.body.includes(`more than ${GHOST_THRESHOLD_HOURS} hours ago`), 'the sentence does not print the threshold');
  assert.doesNotMatch(`${n.title} ${n.body}`, /vendor|celebration|website/i);
  // The same title the sign-in nudge uses for one inquiry.
  assert.ok(code('lib/ghosting.ts').includes(`'${n.title}'`), 'the reminder and the sign-in nudge no longer share a title');
});

test('ONE number: the threshold is defined once, and both the nudge and the sweep read it', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const definers: string[] = [];
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    if (/\bGHOST_THRESHOLD_HOURS\s*=/.test(stripComments(readFileSync(abs, 'utf8')))) {
      definers.push(relative(WEB, abs).split(sep).join('/'));
    }
  }
  assert.deepEqual(definers, ['lib/inquiry-reminder.ts'], 'the 48 hours is written down in a second place');
  for (const rel of ['lib/ghosting.ts', 'lib/inquiry-reminder.server.ts']) {
    const src = code(rel);
    assert.match(src, /import \{[^}]*\bGHOST_THRESHOLD_HOURS\b[^}]*\} from '@\/lib\/inquiry-reminder';/, `${rel} does not import the threshold`);
    assert.match(src, /GHOST_THRESHOLD_HOURS \* 3600 \* 1000/, `${rel} no longer measures the wait with the shared threshold`);
    assert.doesNotMatch(src, /\b48\b/, `${rel} types the number itself`);
  }
});

test('the sweep: reads the record BEFORE it sends, refuses to guess, and sends only with the record', () => {
  const src = code('lib/inquiry-reminder.server.ts');
  const fn = src.slice(src.indexOf('export async function runInquiryReminderSweep('), src.indexOf('export async function maybeRunInquiryReminder('));
  const record = fn.indexOf(".eq('type', 'inquiry_awaiting_reply')");
  const rule = fn.indexOf('inquiriesDueAReminder({ threads, supplierUserByShop, alreadyReminded, nowMs })');
  const send = fn.indexOf('await emitNotification({');
  console.log(`# sweep: record@${record} rule@${rule} send@${send}`);
  assert.ok(record > -1 && rule > record && send > rule, 'the sweep must read what was sent, ask the rule, then send — in that order');
  // The record is read by the SAME link the reminder is stored with.
  assert.match(fn, /const links = threads\.map\(\(t\) => inquiryReminderLink\(t\.thread_id\)\);/);
  assert.match(fn, /\.in\('related_url', links\)/);
  assert.match(fn, /relatedUrl: inquiryReminderLink\(d\.thread\.thread_id\),/);
  // An unreadable record sends NOTHING (thrown → the run is recorded as failed).
  assert.match(fn, /if \(sentError\) throw new Error\(/, 'an unreadable record is treated as an empty one — every pass would re-send');
  // No row, no email.
  assert.match(fn, /onlyIfStored: true,/, 'the reminder can be emailed without the row that stops the next one');
  // One claimed pass a day.
  assert.match(src, /runClaimedJob\('inquiry-reminder', DAILY_GAP_MS,/);
});

test('the emitter: with onlyIfStored, no stored row means no email — and it says so', () => {
  const emit = code('lib/notification-emit.ts');
  const fn = emit.slice(emit.indexOf('export async function emitNotification('));
  // `stored` is set only where an insert reported no error.
  assert.equal(fn.split('stored = true;').length - 1, 2, 'the emitter no longer tracks whether the row landed on both insert paths');
  assert.match(fn, /if \(!error\) stored = true;/);
  assert.match(fn, /: args\.onlyIfStored && !stored\s*\? 'row_not_stored'/, 'onlyIfStored no longer holds the email back');
  assert.match(fn, /if \(EMAIL_ENABLED_TYPES\.has\(type\) && heldBack === null\) \{/, 'a held-back notice is emailed anyway');
  // Held back for a missing row is recorded, not silent.
  assert.match(fn, /if \(heldBack === 'row_not_stored' && EMAIL_ENABLED_TYPES\.has\(type\)\) \{\s*await recordDelivery\(/);
});

test('the sign-in nudge of the same type stays out of the inbox', () => {
  const src = code('lib/ghosting.ts');
  const at = src.indexOf("type: 'inquiry_awaiting_reply'");
  assert.ok(at > -1, 'the sign-in nudge is gone');
  const call = src.slice(src.lastIndexOf('emitNotification({', at), src.indexOf('});', at));
  assert.match(call, /skipEmail: true,/, 'the sign-in nudge would now email a supplier who is looking at the app — at every sign-in');
  // And it links the inbox, never a thread — so it can never be mistaken for a reminder's record.
  assert.match(call, /relatedUrl: '\/vendor-dashboard\/messages',/);
  // The emitter honours it.
  assert.match(code('lib/notification-emit.ts'), /args\.skipEmail\s*\? 'reader_is_in_the_app'/);
});

test('the sweep is mounted where traffic exists, and registered', () => {
  for (const rel of ['app/admin/layout.tsx', 'app/vendor-dashboard/layout.tsx', 'app/dashboard/layout.tsx']) {
    assert.equal(code(rel).split('after(() => maybeRunInquiryReminder().catch(() => {}));').length - 1, 1, `${rel} does not run the reminder`);
  }
  assert.match(code('lib/periodic-job-registry.ts'), /key: 'inquiry-reminder',/);
});
