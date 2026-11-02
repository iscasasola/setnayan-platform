/**
 * dashboard-reads-are-honest.test.ts — the event dashboard's FX-HONEST batch (event-dashboard audit 2026-11-02).
 *
 * The rule is the supplier side's (`vendor-dashboard/reads-are-honest.test.ts`) and the guest list's
 * (`lib/guests-read-is-honest.test.ts`): Supabase RESOLVES with `{ error }`, so a refused read arrives as `data: null`,
 * `?? []` makes it empty, and the screen states an absence it never measured. Each reader below was found doing that;
 * each test pins the ONE property that fixes it — the error is bound, and the refusal reaches the render as
 * "couldn't load", never as 0, "none", "not a guest" or "not valid". One test per reader.
 *
 * Behaviour is run where the reader is pure or takes a client (`readScheduleSuppliers`, `keepsakeDoors`); the rest
 * are pinned in comment-free source, and every assertion was mutation-checked (the fix reverted → this file red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]/';
/** `a` appears, and before `b`. */
function before(code: string, a: RegExp | string, b: RegExp | string, why: string) {
  const ia = typeof a === 'string' ? code.indexOf(a) : code.search(a);
  const ib = typeof b === 'string' ? code.indexOf(b) : code.search(b);
  assert.ok(ia >= 0, `${why} — missing: ${a}`);
  assert.ok(ib >= 0, `${why} — missing: ${b}`);
  assert.ok(ia < ib, `${why} — ${a} must come before ${b}`);
}

test('#5 · the door: a refused ticket read is "unreadable", never "not a guest", and the desk falls back to its saved list', () => {
  const live = src(`${D}guests/checkin/actions.ts`);
  const fn = live.slice(live.indexOf('export async function checkTicketLive'));
  assert.equal((fn.match(/error: (rowError|joinedError)/g) ?? []).length, 2, 'both guest reads bind their error');
  before(fn, "if (rowError) return { verdict: 'unreadable'", "if (!row || row.event_id !== eventId) return { verdict: 'unknown'", 'a refused read is said before "unknown"');
  assert.match(fn, /if \(joinedError\) return \{ verdict: 'unreadable'/);
  const desk = src(`${D}guests/checkin/_components/checkin-desk.tsx`);
  before(desk, "if (check?.verdict === 'unreadable') check = null;", 'if (!check) {', 'the desk decides from the saved list');
});

test('#13 · the invite and join doors: a refused read throws to the error page, never "This link isn’t valid"', () => {
  const invite = src('app/[slug]/invite/page.tsx');
  before(invite, /const \{ data: tokenRow, error: tokenError \} = await admin\s*\.from\('event_join_tokens'\)/, 'if (tokenError) {', 'the token read binds its error');
  before(invite, 'if (tokenError) {\n    throw new Error(', 'return <InvalidTokenScreen />;', 'refused → error page, before Invalid');
  const join = src('app/join/[eventId]/page.tsx');
  const read = join.slice(join.indexOf("const { data: event, error: eventError } = await admin\n    .from('events')"));
  assert.ok(read.length > 0, 'the join event read binds its error');
  before(read, 'if (eventError) {\n    throw new Error(', 'return <InvalidTokenScreen />;', 'refused → error page, before Invalid');
});

test('#34 · the Hub seat tile: a refused seat read says "Couldn’t load your seat", never "Not yet assigned"', () => {
  const hub = src('app/[slug]/hub/page.tsx');
  assert.match(hub, /if \(assignmentErr\) \{\s*seatUnreadable = true;/);
  assert.match(hub, /if \(tableErr\) \{\s*seatUnreadable = true;/);
  assert.match(hub, /seatUnreadable \? 'Couldn’t load your seat' : 'Not yet assigned'/);
});

test('#14 · prints, exports and the seat plan never build from an unmeasured guest list', () => {
  const files = ['seating/caterer/route.ts', 'seating/export/route.ts', 'seating/print/route.ts', 'invitation/print/page.tsx', 'invitation/page.tsx', 'seating/page.tsx'];
  for (const f of files) {
    const code = src(D + f);
    assert.doesNotMatch(code, /fetchGuestsByEvent\(/, `${f} reads the guest list unmeasured`);
    assert.match(code, /fetchGuestsByEventMeasured\(/, `${f} reads the guest list measured`);
    assert.match(code, /if \(!c?[gG]uestsRead\.measured\)/, `${f} acts on a refusal`);
  }
});

test('#11 · Messages: a refused unread read never says "Nothing unread."', () => {
  assert.match(src(`${D}messages/page.tsx`), /unreadMeasured=\{unread\.measured\}/);
  const inbox = src(`${D}messages/_components/chat-inbox.tsx`);
  assert.match(inbox, /\? unreadMeasured\s*\? 'Nothing unread\.'\s*: 'We couldn’t check which chats are unread/);
});

test('#12 · a supplier’s change orders: a refused read is said, never "No change orders yet."', () => {
  assert.match(src(`${D}vendors/[vendorId]/workspace/page.tsx`), /readFailed=\{Boolean\(changeOrderRowsError\)\}/);
  const trail = src(`${D}vendors/[vendorId]/workspace/_components/change-order-trail.tsx`);
  before(trail, '{readFailed ? (', 'No change orders yet.', 'the refusal is drawn first');
});

test('#22 · Find: a refused category or name search says "Couldn’t load", never "none here" or "nothing matches"', () => {
  const cat = src(`${D}vendors/_actions/category-search.ts`);
  assert.match(cat, /if \(evError\) \{[\s\S]{0,160}return \{ \.\.\.EMPTY, unreadable: true \};/);
  assert.match(cat, /onReadRefused: \(\) => \{\s*recsRefused = true;/);
  assert.match(cat, /if \(recsRefused\) return \{ \.\.\.EMPTY, unreadable: true \};/);
  assert.match(src('lib/wizard-recommendations.ts'), /if \(error \|\| !data\) \{\s*if \(error\) args\.onReadRefused\?\.\(\);/);
  const overlay = src(`${D}vendors/_components/category-search-overlay.tsx`);
  assert.match(overlay, /setUnreadable\(res\.unreadable === true\)/);
  before(overlay, 'results.length === 0 && unreadable ?', 'suppliers here yet', 'the refusal is drawn before the empty state');
  assert.match(src(`${D}vendors/_actions/bench-marketplace-search.ts`), /if \(error\) return \{ results: \[\], unreadable: true \};/);
  assert.match(src(`${D}vendors/categories/page.tsx`), /\{shopsRead\.unreadable \? \(/);
});

test('#18 · Recap and the keepsake row: a refused count is said, never 0 or "opens once the first photo lands"', async () => {
  const recap = src('lib/auto-recap.ts');
  assert.match(recap, /unreadable: Boolean\(seatErr \|\| guestCapsErr \|\| approvedErr \|\| wallSafeErr \|\| voicesErr \|\| guestsErr \|\| evErr\)/);
  assert.match(src(`${D}studio/papic/recap/page.tsx`), /\{summary\.unreadable \? \(\s*<ReadRefusedNotice/);
  const { keepsakeDoors } = await import('@/lib/memories-keepsakes');
  const doors = keepsakeDoors({ magazine: { photos: 1 }, recap: { privatePhotos: 0, approvedKwentos: 0, unreadable: true }, flash: null, flashMin: 3, thankYou: false });
  const r = doors.find((d) => d.key === 'recap')!;
  assert.match(r.reason ?? '', /couldn’t count/);
  assert.doesNotMatch(r.reason ?? '', /opens once/);
});

test('#44 · Budget: a refused target read says "Couldn’t load the target", never "—" or an empty field', () => {
  assert.match(src(`${D}budget/page.tsx`), /targetUnread: eventData === null && Boolean\(eventRes\.error\)/);
  assert.match(src(`${D}budget/_components/budget-screen.tsx`), /targetUnread=\{summary\.targetUnread\}/);
  before(src(`${D}budget/_components/budget-summary.tsx`), '{targetUnread ? (', ') : canEdit ? (', 'the refusal is drawn before the field');
});

test('#20 · Access requests: a refused read is said, never "Nothing waiting on you."', () => {
  before(src(`${D}access-requests/page.tsx`), /\{dataError \? \(\s*<ReadRefusedNotice/, 'Nothing waiting on you.', 'the refusal is drawn first');
});

test('#16 · Schedule suppliers: a refused read is null (unknown), never [] — and every caller says so', async () => {
  const { readScheduleSuppliers } = await import('@/lib/schedule-suppliers-read');
  const refused = {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'order', 'in']) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'refused' } }).then(ok);
      return q;
    },
  } as unknown as SupabaseClient;
  assert.equal(await readScheduleSuppliers(refused, 'e1'), null);
  assert.match(src('lib/schedule-view-as.server.ts'), /readScheduleSuppliers\(supabase, eventId\)\.catch\(\(\) => null\)/);
  assert.match(src('app/api/schedule/[eventId]/export/route.ts'), /if \(!suppliers\) return unread\(\);/);
  const page = src(`${D}schedule/page.tsx`);
  assert.match(page, /if \(suppliersRes === null\) suppliersUnread = true;/);
  assert.match(page, /if \(r === null\) suppliersUnread = true;/);
  assert.match(page, /\{suppliersUnread \? <ReadRefusedNotice what="your suppliers" partial/);
});

test('#17 · Planning Stage payments: a refused payments read is unread, and only a real booking owes', () => {
  const prep = src('lib/preparation.ts');
  const fn = prep.slice(prep.indexOf('async function fetchPaymentItems'));
  assert.match(fn, /Promise<PreparationItem\[\] \| null>/);
  assert.match(fn, /if \(paymentsRes\.error && !isMissingRelation\(paymentsRes\.error\)\) \{[\s\S]{0,120}return null;/);
  assert.match(fn, /\.filter\(\(v\) => booked\.has\(v\.status \?\? ''\) && !v\.archived_at\)/);
  assert.match(prep, /if \(payments === null\) unread\.push\('payment'\);/);
});
