/**
 * GUARD — A CLASHING DATE GOES TO THE SUPPLIER IN CONFLICT, AND EVERY HALF OF
 * THE MECHANISM IS WIRED (owner 2026-10-01, DECISION_LOG "AMENDS THE ROW ABOVE —
 * A CLASHING DATE GOES TO THE SUPPLIER IN CONFLICT…", "THE CLASHING-DATE FLOW —
 * APPROVED WITH THE CONTROLLER'S THREE SAFEGUARDS"; 2026-10-02 "Q7 + Q8";
 * "BUDGET IS FOR TRACKING, NEVER FOR LIMITING").
 *
 * The database half (who may ask, answer, settle; the release; the calendar
 * following the date) is executed by
 * `tests/db/a-clashing-date-goes-to-the-supplier.db.test.ts`. This file holds
 * the halves a db test cannot see: the notice AND its allowlist line (two
 * halves of one mechanism), the desk card AND its buttons, the Next card, Home,
 * Apply's relaxation, and that money never narrows a date.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  DATE_ANSWER_NOTICE,
  dateChangeAnswerLine,
  dateChangeHomeLine,
  dateMoveClearance,
  dateMovedNotice,
  summarizeDateChange,
} from '@/lib/date-change';
import { answerNext, nextAnswerOf } from '@/lib/supplier-today';
import type { WhatsNewCard } from '@/lib/vendor-overview';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(raw(rel));
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const migration = (suffix: string) => {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith(suffix));
  assert.ok(f, `migration *${suffix} is missing`);
  return readFileSync(join(MIGRATIONS, f!), 'utf8');
};

const TYPES = ['date_change_requested', 'date_change_answered', 'date_change_closed', 'date_moved'] as const;

test('1 · each notice is emitted, exists in the database, and is on the EMAIL allowlist — never marketing-gated', () => {
  const emit = code('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf('const MARKETING_GATED_EMAIL_TYPES'));
  const gated = emit.slice(emit.indexOf('const MARKETING_GATED_EMAIL_TYPES'));
  const gatedSet = gated.slice(0, gated.indexOf(']);'));
  const server = code('lib/date-change.server.ts');
  const enumSql = migration('_notification_types_date_change.sql');
  for (const t of TYPES) {
    // SABOTAGE: drop one line from EMAIL_ENABLED_TYPES → RED.
    assert.match(allow, new RegExp(`'${t}'`), `${t} is not emailed — an in-app badge never reaches a supplier who is not in the app`);
    assert.doesNotMatch(gatedSet, new RegExp(`'${t}'`), `${t} is marketing-gated — silenced for everyone with marketing_opt_in = FALSE`);
    assert.match(server, new RegExp(`type: '${t}'`), `${t} is on the allowlist but nothing emits it`);
    assert.match(enumSql, new RegExp(`ADD VALUE IF NOT EXISTS '${t}'`), `${t} is not a database label — the INSERT would be refused`);
    assert.match(code('lib/notifications.ts'), new RegExp(`\\| '${t}'`), `${t} is not in the NotificationType union`);
  }
});

test('2 · the couple’s ask names the suppliers on the SERVER, through the shipped availability read — never from the browser', () => {
  const server = code('lib/date-change.server.ts');
  const ask = server.slice(server.indexOf('export async function askDateChange('), server.indexOf('export async function settleDateChange('));
  assert.match(ask, /datePickClash\(\{[\s\S]*?failClosed: true,[\s\S]*?\}\)/, 'the ask reads who clashes with the matrix, fail-closed');
  assert.match(ask, /p_event_vendor_ids: clash\.clash\.map\(\(c\) => c\.vendorId\)/, 'the suppliers asked are the ones the server found');
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const branch = action.slice(action.indexOf("if (intent === 'date_change')"), action.indexOf("if (intent === 'restore')"));
  assert.doesNotMatch(branch, /event_vendor_ids|getAll\(/, 'a list of suppliers was read from the form');
  // Nothing in the date-change door writes the live page or the draft directly.
  assert.doesNotMatch(branch, /\.from\('events'\)|writeHubDraft\(|\.update\(/, 'the date-change door wrote something itself');
  // One confirm, worded as the owner approved, before anything is sent.
  const note = code('app/dashboard/[eventId]/launch/_components/details-date-clash.tsx');
  // SABOTAGE: the first button calling `ask` directly → RED.
  assert.equal((note.match(/onClick=\{ask\}/g) ?? []).length, 1, 'the ask is reachable from more than one button');
  const confirmBranch = note.slice(note.indexOf(') : confirming ? ('), note.indexOf(') : (', note.indexOf(') : confirming ? (') + 5));
  assert.match(confirmBranch, /onClick=\{ask\}[\s\S]*?Yes, ask them/, 'the send is not inside the one confirm');
  assert.match(note, /onClick=\{\(\) => setConfirming\(true\)\}[\s\S]*?Ask them to move or unlock\?/, 'the owner’s words open the confirm, they do not send');
});

test('3 · the supplier gets a desk card with exactly two buttons — Move to <date> · Unlock my service — wired to ONE action', () => {
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.match(sections, /card\.kind === 'date_change' \? \(\s*<DateChangeBody card=\{card\} answerDateChange=\{answerDateChange\} \/>/);
  const body = sections.slice(sections.indexOf('function DateChangeBody('), sections.indexOf('function DeleteRequestBody('));
  assert.equal((body.match(/<form action=\{answerDateChange\}>/g) ?? []).length, 2, 'not exactly two answers');
  assert.match(body, /name="answer" value="moved"[\s\S]*?Move to \{to\}/);
  assert.match(body, /name="answer" value="unlocked"[\s\S]*?Unlock my service/);
  // 💸 Said BEFORE the press: the deposit follows the booking's own terms.
  assert.match(body, /settled by the cancellation terms on the booking/);
  assert.doesNotMatch(body, /\bvendor\b/i, 'a supplier page says "supplier", never "vendor"');
  // Both seams (the feed AND the closed list) carry the action — counted, not matched.
  const page = code('app/vendor-dashboard/page.tsx');
  assert.equal((page.match(/answerDateChange=\{vendorAnswerDateChange\}/g) ?? []).length, 2);
  assert.equal((sections.match(/answerDateChange=\{answerDateChange\}/g) ?? []).length, 2);
  // The action exists, reads the answer from the form, and asks the database.
  const actions = code('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const fn = actions.slice(actions.indexOf('export async function vendorAnswerDateChange('), actions.indexOf('export async function vendorAgreeToDeletion('));
  assert.match(fn, /isSupplierDateAnswer\(answer\)/);
  assert.match(fn, /answerDateChange\(\{/);
  assert.match(code('lib/date-change.server.ts'), /supabase\.rpc\('answer_event_date_change'/);
  for (const v of Object.values(DATE_ANSWER_NOTICE)) assert.doesNotMatch(v, /\bvendor\b/i);
});

const dc = (id: string, dueAt: string): WhatsNewCard => ({
  kind: 'date_change',
  id,
  eventId: 'e1',
  eventVendorId: 'ev1',
  coupleName: 'Ana & Miguel',
  fromDate: '2030-06-01',
  fromPrecision: 'day',
  proposedDate: '2030-07-06',
  proposedPrecision: 'day',
  askedAt: '2030-05-01T00:00:00Z',
  dueAt,
});

test('4 · a date-change request becomes THE Next card on Today — "Date change request", soonest deadline first', () => {
  const older: WhatsNewCard = { kind: 'delete_request', id: 'd', eventId: 'e', eventVendorId: 'v', eventDate: null, requestedAt: '2020-01-01T00:00:00Z' };
  const a = dc('a', '2030-05-04T00:00:00Z');
  const b = dc('b', '2030-05-03T00:00:00Z');
  // SABOTAGE: nextAnswerOf returning needsAnswer[0] → RED (the older delete card wins).
  assert.equal(nextAnswerOf([older, a, b])?.id, 'b');
  assert.equal(nextAnswerOf([older])?.id, 'd', 'with no date change the desk order stands');
  const next = answerNext(b, null, Date.parse('2030-05-01T12:00:00Z'));
  assert.equal(next.title, 'Date change request');
  assert.match(next.body, /Ana & Miguel asks to move/);
  assert.match(next.body, /answer within 2 days/);
  assert.deepEqual(next.target, { to: 'today' }, 'the one button opens the desk card with the two answers');
});

test('5 · one rule for "may the date go live": every clashing supplier moved — a fitting date needs nobody (Q8)', () => {
  assert.deepEqual(dateMoveClearance({ clashing: [], moved: [] }), { cleared: true, waitingOn: [] });
  assert.deepEqual(dateMoveClearance({ clashing: ['a', 'b'], moved: ['a'] }), { cleared: false, waitingOn: ['b'] });
  assert.deepEqual(dateMoveClearance({ clashing: ['a', 'a'], moved: ['a'] }), { cleared: true, waitingOn: [] });
  // Apply asks it ONLY where the refusal would be 'locked', fail-closed, then tells every booked supplier.
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /if \(refusal === 'locked' && nextDate\.date\) \{\s*const clearance = await dateApplyClearance\(/);
  assert.match(action, /if \(!clearance\.ok\) return \{ ok: false, intent, error:/, 'an unread calendar is not "everyone is free"');
  assert.match(action, /await afterDateApplied\(\{ supabase, eventId, next: dateMove\.next, requestId: dateMove\.requestId \}\)/);
  const server = code('lib/date-change.server.ts');
  const clear = server.slice(server.indexOf('export async function dateApplyClearance('), server.indexOf('export async function afterDateApplied('));
  assert.match(clear, /failClosed: true/);
  assert.match(clear, /catch \{\s*return \{ ok: false \};\s*\}/);
  const after = server.slice(server.indexOf('export async function afterDateApplied('));
  assert.match(after, /title: dateMovedNotice\(next\.date, next\.precision\)/, 'the plain notice "The date moved to <date>"');
  assert.equal(dateMovedNotice('2030-07-06', 'day'), 'The date moved to Saturday, July 6, 2030');
  // The Event Details writer keeps the lock — it does not ask the suppliers.
  assert.match(code('app/dashboard/[eventId]/actions.ts'), /const refusal = eventDateRefusal\(prior, next, count \?\? 0\);/);
});

test('6 · Home: "Date change: n of N suppliers answered", the 3-day choices only when due, withdraw anytime', () => {
  const view = summarizeDateChange({
    requestId: 'r',
    proposedDate: '2030-07-06',
    proposedPrecision: 'day',
    fromDate: '2030-06-01',
    askedAt: '2030-05-01T00:00:00Z',
    rows: [
      { event_vendor_id: 'a1', vendor_profile_id: 'A', answer: 'moved', due_at: '2030-05-04T00:00:00Z', answered_at: 'x', money_flag_id: null },
      // A package: two rows, one supplier — still deciding while either is asked.
      { event_vendor_id: 'b1', vendor_profile_id: 'B', answer: 'asked', due_at: '2030-05-04T00:00:00Z', answered_at: null, money_flag_id: null },
      { event_vendor_id: 'b2', vendor_profile_id: 'B', answer: 'asked', due_at: '2030-05-04T00:00:00Z', answered_at: null, money_flag_id: null },
      { event_vendor_id: 'c1', vendor_profile_id: 'C', answer: 'unlocked', due_at: '2030-05-04T00:00:00Z', answered_at: 'x', money_flag_id: 'f' },
    ],
    names: new Map([['a1', 'Studio A'], ['b1', 'Casa B'], ['c1', 'Bloom C']]),
    now: Date.parse('2030-05-05T00:00:00Z'),
  });
  assert.equal(dateChangeHomeLine(view), 'Date change: 2 of 3 suppliers answered');
  assert.equal(view.ready, false);
  const b = view.suppliers.find((s) => s.vendorProfileId === 'B')!;
  assert.deepEqual(b.eventVendorIds, ['b1', 'b2']);
  assert.equal(b.overdue, true);
  assert.equal(dateChangeAnswerLine(b, Date.parse('2030-05-05T00:00:00Z')), 'No answer after 3 days');
  assert.match(dateChangeAnswerLine(view.suppliers.find((s) => s.vendorProfileId === 'C')!, 0), /cancellation terms/);
  const door = code('app/dashboard/[eventId]/_components/date-change-doorway.tsx');
  assert.match(door, /\{s\.overdue \? \(/, 'keep waiting / drop are offered before the 3 days are up');
  assert.match(door, /name="action" value="wait"/);
  assert.match(door, /name="action" value="drop"/);
  // Withdraw is outside the overdue branch — anytime.
  const overdueBranch = door.slice(door.indexOf('{s.overdue ? ('), door.indexOf(') : null}', door.indexOf('{s.overdue ? (')));
  assert.doesNotMatch(overdueBranch, /value="withdraw"/);
  assert.match(door, /name="action" value="withdraw"/);
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /<DateChangeDoorway eventId=\{eventId\} \/>/);
});

test('7 · budget never filters: no date-change code reads a price, a plan total or a budget', () => {
  // SABOTAGE: a `total_cost_php` read added to dateApplyClearance → RED.
  for (const f of ['lib/date-change.ts', 'lib/date-change.server.ts', 'app/dashboard/[eventId]/_components/date-change-doorway.tsx']) {
    assert.doesNotMatch(code(f), /budget|price|total_cost|agreed_total|afford/i, `${f} lets money into a date decision`);
  }
  const sql = migration('_a_clashing_date_goes_to_the_supplier.sql').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /budget|total_cost|price/i, 'a date-change function reads money');
});
