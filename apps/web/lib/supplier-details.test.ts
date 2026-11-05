/**
 * YOUR DETAILS — "N of 6 done · left: …" (lib/supplier-details.ts). The six are the shipped checks grouped; a read
 * that failed is never done and never "not yet".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detailsLine, detailsProgress, docsRow, payRow, type DetailsInput } from './supplier-details';

const ALL_OK = [
  'logo',
  'business_name',
  'business_owner_name',
  'maps_pin',
  'contact_phone',
  'contact_email',
  'in_business_since_year',
  'services',
].map((key) => ({ key, ok: true }));

const base = (over: Partial<DetailsInput> = {}): DetailsInput => ({
  checklist: ALL_OK,
  docs: { measured: true, isVerified: true, status: 'approved', requiredIn: 4, requiredTotal: 4 },
  payMethods: 2,
  ...over,
});

test('a finished, verified shop reads 6 of 6 · everything is in', () => {
  const p = detailsProgress(base());
  assert.equal(p.done, 6);
  assert.equal(p.left.length, 0);
  assert.equal(detailsLine(p), '6 of 6 done · everything is in');
  assert.equal(p.firstLeft, null);
});

test('the prototype’s church: 4 of 6 · left: documents · how clients pay you', () => {
  const p = detailsProgress(
    base({
      docs: { measured: true, isVerified: false, status: 'draft', requiredIn: 1, requiredTotal: 4 },
      payMethods: 0,
    }),
  );
  assert.equal(p.done, 4);
  assert.equal(detailsLine(p), '4 of 6 done · left: documents · how clients pay you');
  assert.equal(p.firstLeft, 'docs');
  assert.deepEqual(
    p.rows.find((r) => r.key === 'docs')?.badge,
    { tone: 'wait', word: '3 left' },
  );
});

test('papers sent count as done for the supplier — and the line says Setnayan is checking', () => {
  const p = detailsProgress(
    base({ docs: { measured: true, isVerified: false, status: 'pending_review', requiredIn: 4, requiredTotal: 4 } }),
  );
  assert.equal(p.done, 6);
  assert.equal(detailsLine(p), '6 of 6 done · Setnayan is checking your documents');
  assert.equal(p.rows.find((r) => r.key === 'docs')?.badge.word, 'Checking');
});

test('all papers in but not sent: the one thing left is Send', () => {
  const r = docsRow({ measured: true, isVerified: false, status: 'draft', requiredIn: 4, requiredTotal: 4 });
  assert.equal(r.state, 'todo');
  assert.equal(r.badge.word, 'Send them');
});

test('a refused application is a fix, in danger colour', () => {
  const r = docsRow({ measured: true, isVerified: false, status: 'rejected', requiredIn: 4, requiredTotal: 4 });
  assert.equal(r.state, 'fix');
  assert.equal(r.badge.tone, 'no');
});

test('a failed read is NOT READ — never done, never "not yet", and out of the left list', () => {
  const pay = payRow(null);
  assert.equal(pay.state, 'unknown');
  assert.equal(pay.badge.word, 'Not read');
  const p = detailsProgress(
    base({ payMethods: null, docs: { measured: false, isVerified: false, status: null, requiredIn: 0, requiredTotal: 4 } }),
  );
  assert.equal(p.done, 4);
  assert.equal(p.left.length, 0);
  assert.equal(p.incomplete, true);
  assert.equal(detailsLine(p), '4 of 6 done · some of it could not be read just now');
});

test('a verified shop is Verified even when its application read failed', () => {
  assert.equal(docsRow({ measured: false, isVerified: true, status: null, requiredIn: 0, requiredTotal: 4 }).state, 'done');
});

test('each checklist key lands in its fold — a missing phone is Contact, a missing logo is Name and logo', () => {
  const checklist = ALL_OK.map((i) =>
    i.key === 'contact_phone' || i.key === 'logo' ? { ...i, ok: false } : i,
  );
  const p = detailsProgress(base({ checklist }));
  assert.deepEqual(
    p.left.map((r) => r.key),
    ['name', 'contact'],
  );
  assert.equal(detailsLine(p), '4 of 6 done · left: name and logo · contact');
});

test('a venue’s room size belongs to What you do', () => {
  const p = detailsProgress(base({ checklist: [...ALL_OK, { key: 'venue_size', ok: false }] }));
  assert.deepEqual(p.left.map((r) => r.key), ['what']);
});
