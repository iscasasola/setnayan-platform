/**
 * focus-search.test.ts — Focus at Spotlight level (owner approved 18 Nov 2026).
 *
 * Each block pins one promise of the approved drawing, and each fails on the
 * `origin/main` this was cut from (the module did not exist, and `ugatSearch`
 * turned every failed read into `[]`):
 *   · a group whose read failed SAYS so — never "no matches";
 *   · a whole public ID / a payment reference is ROUTED to the right table;
 *   · a count that could not be read never renders 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { redactContactDetail } from './admin-record-rows';
import {
  classifyFocusQuery,
  countOrNull,
  focusAnswerWords,
  focusIsExactOnly,
  focusPaymentHref,
  focusVendorHref,
  matchFocusAnswer,
  parseFocusRecents,
  pushFocusRecent,
  recentWhen,
  referenceDigits,
  referenceIlikePattern,
  referenceIsExact,
  referenceMatches,
  settleRead,
  toFocusRows,
  PUBLIC_ID_KINDS,
  type FocusSearchGroup,
} from './focus-search';

const WEB = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── PUBLIC-ID ROUTING ─────────────────────────────────────────────────── */

test('a whole public ID is routed to the one table its letter belongs to', () => {
  const v = classifyFocusQuery('S89B-9TX4BH2FGB');
  assert.equal(v.kind, 'public-id');
  assert.equal(v.kind === 'public-id' && v.known, 'B');
  assert.equal(PUBLIC_ID_KINDS.B.table, 'vendor_profiles');
  for (const [id, table] of [
    ['S89U-2MD8XR4TJW', 'users'],
    ['S89E-5WT8KD2NRA', 'events'],
    ['S89O-7HN2V5CKQ3', 'orders'],
    ['S89G-5WT8KD2NRA', 'guests'],
  ] as const) {
    const q = classifyFocusQuery(id);
    assert.equal(q.kind, 'public-id', id);
    assert.equal(q.kind === 'public-id' && q.known ? PUBLIC_ID_KINDS[q.known].table : null, table, id);
  }
});

test('a pasted ID is read whatever its case or surrounding spaces, and stored upper case', () => {
  const q = classifyFocusQuery('  s89b-9tx4bh2fgb ');
  assert.equal(q.kind, 'public-id');
  assert.equal(q.kind === 'public-id' && q.publicId, 'S89B-9TX4BH2FGB');
});

test('an ID letter Focus cannot open is still an ID — it never falls back to a name search', () => {
  const q = classifyFocusQuery('S89Z-9TX4BH2FGB');
  assert.equal(q.kind, 'public-id');
  assert.equal(q.kind === 'public-id' && q.known, null);
});

test('a partial ID or a name stays words', () => {
  assert.equal(classifyFocusQuery('S89B-9TX4').kind, 'words');
  assert.equal(classifyFocusQuery('Walk Cakes').kind, 'words');
});

/* ── PAYMENT-REFERENCE ROUTING ─────────────────────────────────────────── */

test('a GCash / BDO reference is routed to the payments read, however it is spaced', () => {
  for (const typed of ['4012345678901', '4012 345 678 901', '4012-345-678-901']) {
    const q = classifyFocusQuery(typed);
    assert.equal(q.kind, 'words');
    assert.equal(q.kind === 'words' && q.referenceDigits, '4012345678901', typed);
  }
});

test('words, short numbers and dates are not references', () => {
  assert.equal(referenceDigits('maria'), null);
  assert.equal(referenceDigits('1234'), null);
  assert.equal(referenceDigits('ref 4012345678901'), null);
});

test('the reference pattern finds the stored value whatever its spacing, and the exact check decides', () => {
  const pat = referenceIlikePattern('4012345678901');
  assert.equal(pat, '%4%0%1%2%3%4%5%6%7%8%9%0%1%');
  assert.doesNotMatch(pat, /[,()]/, 'the pattern could re-parse a PostgREST filter');
  assert.ok(referenceMatches('4012 345 678 901', '4012345678901'));
  assert.ok(referenceIsExact('4012-345-678-901', '4012345678901'));
  assert.ok(!referenceMatches('4102 345 678 901', '4012345678901'));
  assert.ok(!referenceIsExact('99 4012 345 678 901', '4012345678901'));
});

test('a payment opens on the Payments desk; a supplier with papers waiting opens ITS Verify job', () => {
  assert.equal(focusPaymentHref('abc'), '/admin/payments?filter=all&open=abc');
  assert.equal(focusVendorHref('v1', 'pending_review'), '/admin/verify?status=pending_review&shop=v1');
  assert.equal(focusVendorHref('v1', null), '/admin/vendors/v1');
});

/* ── COUNTS NEVER RENDER 0 ON A FAILED READ ─────────────────────────────── */

test('a refused count is null, never 0 — and a real zero stays 0', () => {
  assert.equal(countOrNull({ count: null, error: { message: 'permission denied' } }), null);
  assert.equal(countOrNull({ count: 0, error: { message: 'x' } }), null, 'an error with a 0 count is still a failure');
  assert.equal(countOrNull(null), null);
  assert.equal(countOrNull({ count: 0, error: null }), 0);
  assert.equal(countOrNull({ count: 3, error: null }), 3);
});

test('an answer that could not be counted says so and shows no number at all', () => {
  const w = focusAnswerWords({ key: 'paid-today', count: null });
  assert.equal(w.number, null);
  assert.match(w.line, /Couldn’t count/);
  assert.doesNotMatch(w.line, /\b0\b/);
  assert.deepEqual(focusAnswerWords({ key: 'paid-today', count: 3 }).number, '3');
  assert.match(focusAnswerWords({ key: 'paid-today', count: 1 }).line, /^payment confirmed today/);
});

test('the answer row the box draws for a failed count carries no 0', () => {
  const rows = toFocusRows([{ category: 'Answer', hits: [], answer: [{ key: 'paid-today', count: null }, { key: 'payments-waiting', count: null }] }], redactContactDetail);
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.kind, 'answer');
    assert.equal(r.kind === 'answer' && r.number, null);
  }
});

test('the questions the drawing names are understood; anything else stays a search', () => {
  assert.equal(matchFocusAnswer('paid today'), 'paid-today');
  assert.equal(matchFocusAnswer('Paid today?'), 'paid-today');
  assert.equal(matchFocusAnswer('orders this week'), 'orders-this-week');
  assert.equal(matchFocusAnswer('waiting to verify'), 'waiting-to-verify');
  assert.equal(matchFocusAnswer('payments waiting'), 'payments-waiting');
  assert.equal(matchFocusAnswer('walk cakes'), null);
  assert.equal(matchFocusAnswer('maria'), null);
});

/* ── PER-GROUP FAILURE, SHOWN HONESTLY ─────────────────────────────────── */

test('a read that resolves with { error } or throws is FAILED, not empty', async () => {
  assert.deepEqual(await settleRead(Promise.resolve({ data: null, error: { message: 'denied' } })), { rows: [], failed: true });
  assert.deepEqual(await settleRead(Promise.reject(new Error('net'))), { rows: [], failed: true });
  assert.deepEqual(await settleRead(Promise.resolve({ data: [], error: null })), { rows: [], failed: false });
  assert.deepEqual(await settleRead(Promise.resolve({ data: [1], error: null })), { rows: [1], failed: false });
});

test('a failed group says "Couldn’t search", and the other groups still show', () => {
  const groups: FocusSearchGroup[] = [
    { category: 'People', hits: [{ id: 'u', type: 'user', title: 'Maria Santos', sub: 'Person', href: '/admin/users/u', score: 70 }] },
    { category: 'Suppliers', hits: [], failed: true },
    { category: 'Events', hits: [{ id: 'e', type: 'event', title: 'Maria & Paolo', sub: 'Event', href: '/admin/accounts?tab=events&q=e', score: 45 }] },
  ];
  const rows = toFocusRows(groups, redactContactDetail);
  const failed = rows.filter((r) => r.kind === 'failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.category, 'Suppliers');
  assert.match(failed[0]!.kind === 'failed' ? failed[0]!.title : '', /Couldn’t search Suppliers/);
  assert.match(failed[0]!.kind === 'failed' ? failed[0]!.detail : '', /Not “no matches”/);
  assert.ok(rows.some((r) => r.kind === 'record' && r.title === 'Maria & Paolo'), 'a healthy group vanished beside the failed one');
});

test('records sit under their own kind, each its own few — no flat 8-row cap across kinds', () => {
  const hits = (n: number, type: string) =>
    Array.from({ length: n }, (_, i) => ({ id: `${type}${i}`, type, title: `${type} ${i}`, sub: '', href: `/admin/${type}/${i}`, score: 8 }));
  const rows = toFocusRows(
    [
      { category: 'Suppliers', hits: hits(6, 'vendor') },
      { category: 'Guests', hits: hits(6, 'guest') },
      { category: 'People', hits: hits(6, 'user') },
    ],
    redactContactDetail,
  );
  for (const cat of ['Suppliers', 'Guests', 'People']) {
    assert.equal(rows.filter((r) => r.category === cat).length, 4, cat);
  }
  assert.ok(!rows.some((r) => r.category === 'Records'), 'the single flat "Records" heading is back');
});

test('the top hit leads, carries its public ID, and brings its prepared pages', () => {
  const rows = toFocusRows(
    [
      {
        category: 'Suppliers',
        hits: [
          {
            id: 'S89B-9TX4BH2FGB',
            type: 'vendor',
            title: 'TEST W2 Walk Cakes',
            sub: 'Supplier · documents waiting · opens Verify',
            href: '/admin/verify?status=pending_review&shop=v1',
            publicId: 'S89B-9TX4BH2FGB',
            prepared: [{ label: 'Open its shop page', sub: 'Plan, team and edit live there', href: '/admin/vendors/v1' }],
            score: 70,
          },
        ],
      },
    ],
    redactContactDetail,
  );
  assert.equal(rows[0]!.category, 'Top hit');
  assert.equal(rows[0]!.kind === 'record' && rows[0]!.publicId, 'S89B-9TX4BH2FGB');
  assert.equal(rows[1]!.kind, 'prepared');
  assert.ok(!rows.some((r, i) => i > 1 && r.kind === 'record' && r.title === 'TEST W2 Walk Cakes'), 'the top hit is listed twice');
});

test('an exact ID stands alone — no top hit, no pages beside it', () => {
  const rows = toFocusRows(
    [{ category: 'Exact ID', hits: [{ id: 'x', type: 'vendor', title: 'TEST W2 Walk Cakes', sub: '', href: '/admin/vendors/v1', publicId: 'S89B-9TX4BH2FGB', score: 100 }] }],
    redactContactDetail,
  );
  assert.equal(rows.length, 1);
  assert.ok(focusIsExactOnly(rows));
});

test('a contact detail never reaches a Focus row', () => {
  const rows = toFocusRows(
    [{ category: 'People', hits: [{ id: 'u', type: 'user', title: 'Maria', sub: 'maria@example.com', href: '/admin/users/u', score: 8 }] }],
    redactContactDetail,
  );
  assert.equal(rows[0]!.kind === 'record' && rows[0]!.detail, '');
});

/* ── RECENT ────────────────────────────────────────────────────────────── */

test('Recent keeps the newest first, moves a re-opened thing up, and drops junk', () => {
  let list = pushFocusRecent([], { href: '/admin/a', title: 'A', label: 'Page', at: 1 });
  list = pushFocusRecent(list, { href: '/admin/b', title: 'B', label: 'Supplier', at: 2 });
  list = pushFocusRecent(list, { href: '/admin/a', title: 'A', label: 'Page', at: 3 });
  assert.deepEqual(list.map((r) => r.href), ['/admin/a', '/admin/b']);
  assert.deepEqual(parseFocusRecents('not json'), []);
  assert.deepEqual(parseFocusRecents(JSON.stringify([{ href: 'https://evil.example', title: 'x', label: 'Page', at: 1 }])), []);
  assert.equal(parseFocusRecents(JSON.stringify(list)).length, 2);
});

test('Recent says when in Manila days', () => {
  const now = Date.parse('2026-11-18T10:00:00+08:00');
  assert.equal(recentWhen(Date.parse('2026-11-18T01:00:00+08:00'), now), 'opened today');
  assert.equal(recentWhen(Date.parse('2026-11-17T23:00:00+08:00'), now), 'opened yesterday');
  assert.equal(recentWhen(Date.parse('2026-11-15T12:00:00+08:00'), now), 'opened 3 days ago');
});

/* ── THE WIRING — the search and the box keep the difference ───────────── */

test('the shipped search no longer turns a failed read into an empty list', () => {
  const data = src('lib/ugat/data.ts');
  const fn = data.slice(data.indexOf('async function ugatSearchInner'), data.indexOf('export const ugatSearch'));
  assert.ok(fn.length > 0);
  assert.doesNotMatch(fn, /\(\)\s*=>\s*\[\]/, 'an arm swallows its error into [] again');
  assert.match(fn, /settleRead/, 'the arms stopped settling their reads');
  assert.match(fn, /failed: true/, 'a failed group is no longer returned');
  assert.match(fn, /classifyFocusQuery\(q\)/, 'a whole ID is no longer routed');
  assert.match(fn, /reference_number/, 'payment references are no longer searched');
});

test('the box draws a failed group and an uncounted answer instead of hiding them', () => {
  const palette = src('app/admin/_components/admin-command-palette.tsx');
  assert.match(palette, /toFocusRows\(groups, redactContactDetail\)/);
  assert.match(palette, /r\.kind === 'failed'/, 'the failed row is never drawn');
  assert.match(palette, /r\.number \?\? '—'/, 'an uncounted answer could render a number');
  assert.match(palette, /setRetry\(/, 'a failed row cannot be tried again');
});
