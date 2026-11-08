/**
 * today-rows-jump.test.ts — 🦘 EVERY TODAY ROW JUMPS (THE ONE BUILD A7 · A8 · A10, A2 guard 1; owner v112 HOLD answer
 * *"Jump"* — a Today row opens its page, never in place).
 *
 *   1 · every desk kind has a page: `todayRowTarget` is never `{ to: 'today' }` (a door onto Today itself), and the
 *       row's href is exactly `nextHref(todayRowTarget(card))`;
 *   2 · the two answers that lived only on Today have a landing: `ANSWERED_ONLY_ON_TODAY` is [] AND the three shipped
 *       actions are mounted by `ClientDayAnswers` (the client's Details mount, L2) — a jumping row with nowhere to
 *       land is the defect this holds;
 *   3 · a logged payment jumps to the client's Payment page (Confirm received · Not received live there);
 *   4 · Show is ONE dropdown with the app's kinds (no "Access requests" — owner Q7) and the search narrows the
 *       server-drawn rows in place, saying "Nothing waiting matches that search" on a miss.
 *
 * SABOTAGE (each seen red once, THE ONE BUILD C1 notes): unmount `vendorAnswerDateChange` from client-day-answers.tsx
 * → 2 red; send `delete_request` back to `{ to: 'today' }` → 1 red; add "Access requests" to Show → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { WhatsNewCard } from '@/lib/vendor-overview';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NOW = Date.parse('2026-11-07T02:00:00Z');
const at = new Date(NOW - 3_600_000).toISOString();

const CARDS: WhatsNewCard[] = [
  { kind: 'message', id: 'm', threadId: 't1', eventId: 'e1', coupleName: 'Ana', excerpt: 'Hi', lastMessageAt: at },
  { kind: 'lock_request', id: 'lr', eventId: 'e2', eventVendorId: 'v2', coupleName: 'RC', eventDate: '2026-12-01', requestedAt: at, expiresAt: null },
  { kind: 'lock', id: 'l', eventId: 'e3', eventVendorId: 'v3', coupleName: 'Cruz', eventDate: null, proofUrl: null, recordedAt: at },
  { kind: 'date_change', id: 'dc', eventId: 'e4', eventVendorId: 'v4', coupleName: 'Cruz', fromDate: '2026-12-01', fromPrecision: 'day', proposedDate: '2026-12-08', proposedPrecision: 'day', askedAt: at, dueAt: new Date(NOW + 86_400_000).toISOString() },
  { kind: 'delete_request', id: 'dr', eventId: 'e5', eventVendorId: 'v5', eventDate: null, requestedAt: at },
  { kind: 'mark_complete', id: 'mc', eventVendorId: 'v6', eventId: 'e6', eventName: 'Reyes', eventDate: null, createdAt: at },
  { kind: 'review', id: 'rv', reviewId: 'r1', coupleName: 'Dela Cruz', quote: null, rating: 5, createdAt: at },
  { kind: 'lock_request_lapsed', id: 'll', eventId: 'e7', eventVendorId: 'v7', coupleName: 'Uy', eventDate: null, requestedAt: at, expiresAt: null },
  { kind: 'dispute', id: 'd', eventId: 'e8', eventName: 'Perez', label: null, createdAt: at, threadHref: null },
] as WhatsNewCard[];

test('1 · every desk kind has a page — never a door onto Today itself', async () => {
  const L = await import('@/lib/supplier-today');
  const { nextHref } = await import('./supplier-today-first-screen');
  for (const card of CARDS) {
    const t = L.todayRowTarget(card, NOW);
    assert.notDeepEqual(t, { to: 'today' }, `${card.kind}: its row would point back at Today`);
    const href = nextHref(t);
    assert.ok(href.startsWith('/vendor-dashboard/') && !href.startsWith('/vendor-dashboard#'), `${card.kind}: ${href}`);
    assert.deepEqual(L.todayNeedOf(card, NOW).target, t, `${card.kind}: the row and its target disagree`);
  }
  assert.equal(nextHref(L.todayRowTarget(CARDS[3]!, NOW)), '/vendor-dashboard/clients/e4?tab=details', 'a date change does not land on Details');
  assert.equal(nextHref(L.todayRowTarget(CARDS[4]!, NOW)), '/vendor-dashboard/clients/e5?tab=details', 'a delete request does not land on Details');
  // The screen draws each row with exactly that href.
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(first, /<TodayRow\s+key=\{n\.key\}\s+href=\{nextHref\(n\.target\)\}/, 'a Needs-you row is not one link to its target');
});

test('2 · the two answers that left Today have a landing — ANSWERED_ONLY_ON_TODAY is [] and Details holds them', async () => {
  const L = await import('@/lib/supplier-today');
  assert.deepEqual([...L.ANSWERED_ONLY_ON_TODAY], []);
  const body = code('app/vendor-dashboard/_components/client-day-answers.tsx');
  for (const action of ['vendorAnswerDateChange', 'vendorAgreeToDeletion', 'vendorDeclineDeletion']) {
    assert.match(body, new RegExp(`import \\{[^}]*\\b${action}\\b[^}]*\\} from '\\.\\./clients/\\[eventId\\]/actions'`), `${action} is not imported by the Details mount`);
    assert.ok((body.match(new RegExp(`\\b${action}\\b`, 'g')) ?? []).length >= 2, `${action} is imported but not handed to its body`);
  }
  // The read behind it is the desk's own readers, filtered to the event — never a second rule for "open".
  const read = code('lib/client-day-answers.server.ts');
  assert.match(read, /readDateChangeAsks\(admin, vendorProfileId\)/);
  assert.match(read, /readDeletionRequests\(admin, vendorProfileId\)/);
  assert.match(read, /dateChangeCardOf\(/);
  assert.match(read, /deleteRequestCardOf\(/);
  const desk = code('lib/vendor-overview.ts');
  assert.match(desk, /whatsNew\.push\(dateChangeCardOf\(dc, /, 'the desk and Details build the date-change card two ways');
  assert.match(desk, /whatsNew\.push\(deleteRequestCardOf\(dr, /);
  // A refused read on Details is said, never "nothing open".
  assert.match(body, /if \(read\.cards\.length === 0 && read\.complete\) return null;/);
  assert.match(body, /couldn’t load/);
});

test('3 · a logged payment jumps to the client’s Payment page', async () => {
  const L = await import('@/lib/supplier-today');
  assert.deepEqual(L.todayRowTarget(CARDS[2]!, NOW), { to: 'card', eventId: 'e3', tab: 'payments' });
});

test('4 · Show is ONE dropdown of the app’s kinds; the search narrows the drawn rows and says a miss', async () => {
  const L = await import('@/lib/supplier-today');
  assert.deepEqual(
    L.TODAY_SHOW_OPTIONS.map((o) => o.label),
    ['Everything', 'Inquiries', 'Bookings', 'Payments', 'Meetings', 'Messages', 'Quotes & contracts', 'Reviews', 'Documents'],
  );
  assert.ok(!L.TODAY_SHOW_OPTIONS.some((o) => /access/i.test(o.label)), 'an "Access requests" filter with no source (owner Q7)');
  for (const card of CARDS) assert.ok(L.TODAY_SHOW_OPTIONS.some((o) => o.key === L.needKindOf(card.kind)), `${card.kind} has no Show value`);
  const thumb = code('app/vendor-dashboard/_components/today-thumb-row.tsx');
  assert.match(thumb, /<ThumbRow\b/, 'not the shared thumb row');
  assert.match(thumb, /menu: TODAY_SHOW_OPTIONS\.map/, 'Show is not ONE dropdown of the shared options');
  assert.match(thumb, /placeholder: 'Search today'/);
  assert.match(thumb, /narrowTodayNeeds\(document, w, s\)/, 'the row does not narrow with the shared rule');
  // The narrowing, executed on a tiny DOM stand-in.
  const { narrowTodayNeeds } = await import('@/lib/today-needs-narrow');
  type El = { hidden: boolean; textContent: string; style: { display: string }; attrs: Record<string, string>; getAttribute(n: string): string | null };
  const el = (kind: string, words: string): El => ({ hidden: false, textContent: words, style: { display: '' }, attrs: { 'data-today-need-kind': kind }, getAttribute(n) { return this.attrs[n] ?? null; } });
  const rows = [el('inquiries', 'Reply to Lim'), el('payments', 'Confirm a payment'), el('reviews', 'Reply to a review')];
  const none = { hidden: true } as { hidden: boolean };
  const root = {
    querySelectorAll: (sel: string) => (sel === '[data-today-need]' ? rows : sel.includes('data-fee-bill-today') && !sel.includes(',') ? [] : rows),
    querySelector: () => none,
  } as unknown as ParentNode;
  assert.equal(narrowTodayNeeds(root, 'reply', 'all'), 2);
  assert.deepEqual(rows.map((r) => r.style.display), ['', 'none', ''], 'a row is hidden with `hidden`, which a grid row ignores');
  assert.equal(narrowTodayNeeds(root, '', 'payments'), 1);
  assert.equal(narrowTodayNeeds(root, 'zzz', 'all'), 0);
  assert.equal(none.hidden, false, 'a miss is not said');
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(first, /Nothing waiting matches that search/);
});
