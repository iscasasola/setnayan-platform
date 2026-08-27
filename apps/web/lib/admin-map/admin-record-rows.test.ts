/**
 * admin-record-rows.test.ts — the fence, and the ruling surviving the cap.
 *
 * Two things are pinned here and they fail in opposite directions:
 *  · a contact detail must never reach a result row (the owner's fence), and
 *  · a matching GUEST must never be squeezed out by louder categories, which
 *    is the ruling this whole feature exists to serve.
 *
 * Both are executed against the shipped function, never described beside it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toAdminRecordRows,
  redactContactDetail,
  looksLikeContactDetail,
  MAX_ADMIN_RECORD_ROWS,
  type AdminRecordSearchGroup,
} from './admin-record-rows';

const hit = (over: Partial<{ id: string; type: string; title: string; sub: string; href: string; score: number }> = {}) => ({
  id: over.id ?? 'S89G-AAAAAAAAAA',
  type: over.type ?? 'guest',
  title: over.title ?? 'Maria Dela Cruz',
  sub: over.sub ?? 'Replied yes · Ana & Marco',
  href: over.href ?? '/admin/accounts?tab=events&q=S89E-1',
  score: over.score ?? 50,
});

const group = (category: string, hits: ReturnType<typeof hit>[]): AdminRecordSearchGroup => ({
  category,
  hits,
});

/* ── THE FENCE ──────────────────────────────────────────────────────────── */

test('an email address never reaches a result row', () => {
  const rows = toAdminRecordRows([
    group('Users', [hit({ type: 'user', title: 'Ana Reyes', sub: 'ana.reyes@example.com' })]),
  ]);
  assert.equal(rows.length, 1, 'the row itself must still be findable');
  assert.equal(rows[0].title, 'Ana Reyes', 'the NAME is what identifies the record');
  assert.equal(rows[0].detail, '', 'a contact detail must not be shown');
});

test('an email EMBEDDED in an otherwise fine subtitle drops the whole subtitle', () => {
  // Partial redaction is the tempting version and the wrong one: it leaves
  // whatever the pattern did not recognise still on screen.
  const rows = toAdminRecordRows([
    group('Guests', [hit({ sub: 'Replied yes · maria@example.com · Ana & Marco' })]),
  ]);
  assert.equal(rows[0].detail, '');
});

test('a phone number never reaches a result row', () => {
  for (const phone of ['+63 917 555 0142', '09175550142', '(02) 8555 0142 21']) {
    assert.equal(looksLikeContactDetail(phone), true, `not caught: ${phone}`);
    assert.equal(redactContactDetail(`Replied yes · ${phone}`), '');
  }
});

test('a DATE in a subtitle is not mistaken for a phone number', () => {
  // The false positive a seven-digit floor actually had. A celebration named
  // for its date is ordinary, and redacting it would be this guard crying wolf
  // on every one of them.
  const keep = 'Replied yes · Wedding 2026-08-27';
  assert.equal(looksLikeContactDetail(keep), false);
  assert.equal(redactContactDetail(keep), keep);
});

test('an ordinary status subtitle survives untouched', () => {
  const rows = toAdminRecordRows([group('Guests', [hit({ sub: 'Replied yes · Ana & Marco' })])]);
  assert.equal(rows[0].detail, 'Replied yes · Ana & Marco');
});

/* ── THE RULING SURVIVING THE CAP ───────────────────────────────────────── */

test('a matching guest is still offered when louder categories fill the cap', () => {
  /*
    The search returns vendors FIRST and caps each arm at 6. A plain "sort by
    score, take the top N" therefore spends every slot before the guest arm is
    even read — and the one thing the owner's ruling is about disappears with
    no symptom but an absence.
  */
  const vendors = Array.from({ length: 6 }, (_, i) =>
    hit({ id: `V${i}`, type: 'vendor', title: `Shop ${i}`, score: 100 }),
  );
  const users = Array.from({ length: 6 }, (_, i) =>
    hit({ id: `U${i}`, type: 'user', title: `User ${i}`, score: 100 }),
  );
  const guest = hit({ id: 'G1', type: 'guest', title: 'Maria Dela Cruz', score: 1 });

  const rows = toAdminRecordRows([
    group('Vendors', vendors),
    group('Users', users),
    group('Guests', [guest]),
  ]);

  // The guest scores LOWEST of all thirteen — which is the point: if this
  // passes for the wrong reason the test is worthless.
  assert.equal(
    Math.min(...[...vendors, ...users, guest].map((h) => h.score)),
    guest.score,
    'fixture no longer makes the guest the weakest match',
  );
  assert.ok(
    rows.some((r) => r.kind === 'guest' && r.title === 'Maria Dela Cruz'),
    'the guest was squeezed out by louder categories',
  );
});

test('every category that matched is represented before any category repeats', () => {
  const rows = toAdminRecordRows([
    group('Vendors', [hit({ id: 'V0', type: 'vendor', score: 100 }), hit({ id: 'V1', type: 'vendor', score: 99 })]),
    group('Guests', [hit({ id: 'G0', type: 'guest', score: 2 })]),
  ]);
  const firstTwo = rows.slice(0, 2).map((r) => r.category);
  assert.deepEqual(firstTwo, ['Vendors', 'Guests']);
});

test('the remainder is ordered by score', () => {
  const rows = toAdminRecordRows([
    group('Guests', [
      hit({ id: 'A', score: 10 }),
      hit({ id: 'B', score: 90 }),
      hit({ id: 'C', score: 50 }),
    ]),
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['A', 'B', 'C'], 'best-of-category first, then by score');
});

/* ── ORDINARY FLOORS ────────────────────────────────────────────────────── */

test('the cap is honoured', () => {
  const many = Array.from({ length: 6 }, (_, i) => hit({ id: `X${i}` }));
  const rows = toAdminRecordRows([
    group('Vendors', many),
    group('Events', many),
    group('Guests', many),
  ]);
  assert.ok(rows.length <= MAX_ADMIN_RECORD_ROWS, `offered ${rows.length} rows`);
});

test('a hit with no destination is not offered', () => {
  // A row that opens nowhere is the defect the search`s required href exists to
  // prevent; this is the floor for a future arm that forgets.
  const rows = toAdminRecordRows([group('Guests', [hit({ href: '' })])]);
  assert.deepEqual(rows, []);
});

test('no results, or a refused read, yields no rows rather than throwing', () => {
  assert.deepEqual(toAdminRecordRows([]), []);
  assert.deepEqual(toAdminRecordRows(null), []);
  assert.deepEqual(toAdminRecordRows(undefined), []);
  assert.deepEqual(toAdminRecordRows([group('Guests', [])]), []);
});
