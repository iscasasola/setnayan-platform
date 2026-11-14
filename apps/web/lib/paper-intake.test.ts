import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_TRIES,
  INTAKE_MESSAGE,
  casMerge,
  fileTypedValues,
  mergeIntake,
  openSealedSlot,
  type IntakeSlot,
  type PageRead,
} from './paper-intake';
import type { ModelPaperRead } from './verification-paper-read';

/**
 * ONE UPLOAD PLACE · THREE TRIES · ONLY CLEAN FILES — guards. All SYNTHETIC.
 */

const KEY = 'test-only-derived-key-not-a-secret';
const CTX = { nowIso: '2026-11-14T02:00:00.000Z', todayManila: '2026-11-14', key: KEY };

const m = (over: Partial<ModelPaperRead>): ModelPaperRead => ({
  registry: 'dti', accountName: 'SAMPLE BLOOMS', ownerName: 'JUAN DELA CRUZ', registrationNumber: '5512034',
  rdo: null, address: '1 Sample St, Pasig', city: 'Pasig', barangay: null, expirationDate: null, readAs: null,
  couldNotRead: [], tin: null, unsure: [], ...over,
});
const page = (r2Key: string, model: ModelPaperRead | null, extra: Partial<PageRead> = {}): PageRead => ({
  r2Key, page: null, fileProblem: null, model, qrTexts: [], ...extra,
});
const slot = (next: Record<string, unknown>, k: string) => next[k] as IntakeSlot | undefined;

test('multi-file classification files each paper under the slot it IS', () => {
  const r = mergeIntake({}, [
    page('a', m({ registry: 'lgu', expirationDate: '2026-12-31' })),
    page('b', m({ registry: 'dti' })),
    page('c', m({ registry: 'bir', registrationNumber: '210-334-871-000' })),
  ], CTX);
  assert.equal(slot(r.next, 'mayors_permit')?.r2_key, 'a');
  assert.equal(slot(r.next, 'dti_certificate')?.r2_key, 'b');
  assert.equal(slot(r.next, 'bir_2303')?.r2_key, 'c');
  assert.deepEqual(r.reports.map((x) => x.outcome), ['read_ok', 'read_ok', 'read_ok']);
  assert.equal(r.reports[1]!.fields?.registration_number_raw, '5512034', 'read-only autofill');
  assert.deepEqual(r.discard, []);
});

test('a two-paper PDF splits — each PAGE files on its own', () => {
  const r = mergeIntake({}, [
    page('pdf1', m({ registry: 'dti' }), { page: 0 }),
    page('pdf1', m({ registry: 'bir', registrationNumber: '210334871000' }), { page: 1 }),
  ], CTX);
  assert.equal(slot(r.next, 'dti_certificate')?.page, 0);
  assert.equal(slot(r.next, 'bir_2303')?.page, 1);
  assert.equal(slot(r.next, 'bir_2303')?.r2_key, 'pdf1');
  assert.deepEqual(r.discard, [], 'a file with a filed page is kept');
});

test('unknown / other are not filed and NOT counted as a try', () => {
  const r = mergeIntake({}, [page('u', m({ registry: 'unreadable' })), page('o', m({ registry: 'other' }))], CTX);
  assert.deepEqual(r.reports.map((x) => x.outcome), ['unknown', 'other']);
  assert.equal(r.reports[1]!.message, INTAKE_MESSAGE.other);
  for (const k of ['dti_certificate', 'bir_2303', 'mayors_permit']) assert.equal(r.next[k], undefined);
  assert.deepEqual(r.discard.sort(), ['o', 'u'], 'neither file is kept');
});

test('EXPIRED is refused, not stored, and not a try', () => {
  const r = mergeIntake({}, [page('x', m({ registry: 'lgu', expirationDate: '2026-11-13' }))], CTX);
  assert.equal(r.reports[0]!.outcome, 'expired');
  assert.match(r.reports[0]!.message, /^This Mayor's Permit ended on .+ — please upload your current one\.$/);
  assert.equal(r.next.mayors_permit, undefined, 'no slot entry, no try');
  assert.deepEqual(r.discard, ['x'], 'the expired file leaves no stored object');
  const lastYear = mergeIntake({}, [page('y', m({ registry: 'lgu', expirationDate: '2026-12-31' }))], { ...CTX, todayManila: '2027-01-02' });
  assert.equal(lastYear.reports[0]!.outcome, 'expired');
  const dtiOld = mergeIntake({}, [page('z', m({ registry: 'dti', expirationDate: '2025-01-01' }))], CTX);
  assert.equal(dtiOld.reports[0]!.outcome, 'expired');
  const birNone = mergeIntake({}, [page('w', m({ registry: 'bir', expirationDate: null }))], CTX);
  assert.equal(birNone.reports[0]!.outcome, 'read_ok', 'a BIR 2303 with no expiry passes');
});

test('ONLY CLEAN FILES: tries 1 and 2 are refused, not stored, but counted; try 3 keeps the file; a 4th is refused', () => {
  const unclear = (k: string) => page(k, m({ registry: 'bir', couldNotRead: ['registration_number'], registrationNumber: null }));
  const t1 = mergeIntake({}, [unclear('t1')], CTX);
  assert.equal(t1.reports[0]!.outcome, 'unreadable');
  assert.equal(t1.reports[0]!.message, INTAKE_MESSAGE.unclear);
  assert.equal(slot(t1.next, 'bir_2303')?.attempts, 1);
  assert.equal(slot(t1.next, 'bir_2303')?.r2_key, undefined, 'a rejected file leaves no r2_key');
  assert.deepEqual(t1.discard, ['t1'], 'a rejected file leaves no stored object');
  const t2 = mergeIntake(t1.next, [unclear('t2')], CTX);
  assert.equal(slot(t2.next, 'bir_2303')?.attempts, 2);
  assert.equal(slot(t2.next, 'bir_2303')?.r2_key, undefined);
  assert.deepEqual(t2.discard, ['t2']);
  const t3 = mergeIntake(t2.next, [unclear('t3')], CTX);
  assert.equal(t3.reports[0]!.outcome, 'tries_used_kept');
  assert.equal(slot(t3.next, 'bir_2303')?.attempts, MAX_TRIES);
  assert.equal(slot(t3.next, 'bir_2303')?.r2_key, 't3', 'the third try keeps the file');
  assert.equal(slot(t3.next, 'bir_2303')?.manual, true);
  assert.deepEqual(t3.discard, []);
  const t4 = mergeIntake(t3.next, [unclear('t4')], CTX);
  assert.equal(t4.reports[0]!.outcome, 'tries_used', 'a 4th try is refused');
  assert.equal(slot(t4.next, 'bir_2303')?.r2_key, 't3');
  assert.deepEqual(t4.discard, ['t4']);
});

test('wrong kind, unknown, expired do NOT increment attempts', () => {
  let cur: Record<string, unknown> = {};
  cur = mergeIntake(cur, [page('a', m({ registry: 'bir', couldNotRead: ['tin'], registrationNumber: null }))], CTX).next;
  assert.equal(slot(cur, 'bir_2303')?.attempts, 1);
  cur = mergeIntake(cur, [page('b', m({ registry: 'other' })), page('c', m({ registry: 'unreadable' })), page('d', m({ registry: 'lgu', expirationDate: '2020-01-01' }))], CTX).next;
  assert.equal(slot(cur, 'bir_2303')?.attempts, 1);
  assert.equal(cur.mayors_permit, undefined);
});

test('a duplicate replaces the older and says so', () => {
  const one = mergeIntake({}, [page('old', m({ registry: 'bir', registrationNumber: '210334871000' }))], CTX).next;
  const two = mergeIntake(one, [page('new', m({ registry: 'bir', registrationNumber: '210334871000' }))], CTX);
  assert.equal(slot(two.next, 'bir_2303')?.r2_key, 'new');
  assert.equal(two.reports[0]!.outcome, 'replaced');
});

test('DTI + SEC keeps ONE — the clearer — and says only one is needed', () => {
  const both = mergeIntake({}, [
    page('dti', m({ registry: 'dti' })),
    page('sec', m({ registry: 'sec', unsure: ['owner_name'] })),
  ], CTX);
  assert.equal(slot(both.next, 'dti_certificate')?.r2_key, 'dti');
  assert.equal(both.reports[1]!.outcome, 'only_one_needed');
  assert.deepEqual(both.discard, ['sec']);
  const clearerSec = mergeIntake({}, [
    page('dti', m({ registry: 'dti', unsure: ['owner_name', 'account_name'] })),
    page('sec', m({ registry: 'sec' })),
  ], CTX);
  assert.equal(slot(clearerSec.next, 'dti_certificate')?.r2_key, 'sec');
  assert.equal(clearerSec.reports[1]!.outcome, 'only_one_needed');
});

test('typed values: only after three tries, stored apart, slot stays MANUAL', () => {
  const ok = mergeIntake({}, [page('x', m({ registry: 'dti' }))], CTX).next;
  assert.equal(fileTypedValues(ok, 'dti_certificate', { registration_number_raw: '1' }, KEY).ok, false, 'never over a clean read');
  let cur: Record<string, unknown> = {};
  for (const k of ['a', 'b', 'c']) cur = mergeIntake(cur, [page(k, m({ registry: 'dti', couldNotRead: ['account_name'] }))], CTX).next;
  const typed = fileTypedValues(cur, 'dti_certificate', { registration_number_raw: '5512034' }, KEY);
  assert.ok(typed.ok);
  const s = openSealedSlot('dti_certificate', typed.next.dti_certificate, KEY)!;
  assert.equal(s.manual, true);
  assert.equal(s.typed_by_supplier, true);
  assert.equal(s.typed?.registration_number_raw, '5512034');
});

test('THE SEAL: an edited slot (a forged read, a reset try count) no longer opens', () => {
  const r = mergeIntake({}, [page('x', m({ registry: 'dti' }))], CTX).next;
  const forged = { ...(r.dti_certificate as IntakeSlot), evidence: { model: m({ registrationNumber: '0000001' }), qrTexts: [], read_at: '' } };
  assert.equal(openSealedSlot('dti_certificate', forged, KEY), null);
  assert.equal(openSealedSlot('dti_certificate', { ...(r.dti_certificate as IntakeSlot), attempts: 2 }, KEY), null);
  assert.equal(openSealedSlot('bir_2303', r.dti_certificate, KEY), null, 'a slot moved to another key does not open');
  assert.equal(openSealedSlot('dti_certificate', r.dti_certificate, 'another-key'), null);
  assert.ok(openSealedSlot('dti_certificate', r.dti_certificate, KEY));
});

test('PARALLEL UPLOADS DO NOT LOSE A SLOT — compare-and-set re-merges on the fresher row', async () => {
  let row: { docUploads: Record<string, unknown>; version: number } = { docUploads: {}, version: 0 };
  const db = {
    load: async () => ({ docUploads: row.docUploads, version: String(row.version) }),
    save: async (next: Record<string, unknown>, version: string | null) => {
      if (String(row.version) !== version) return false;
      row = { docUploads: next, version: row.version + 1 };
      return true;
    },
  };
  // Both requests LOAD the same empty row before either saves.
  const loadedA = await db.load();
  const loadedB = await db.load();
  const a = mergeIntake(loadedA.docUploads, [page('dti', m({ registry: 'dti' }))], CTX);
  const b = mergeIntake(loadedB.docUploads, [page('bir', m({ registry: 'bir', registrationNumber: '210334871000' }))], CTX);
  assert.equal(await db.save(a.next, loadedA.version), true);
  assert.equal(await db.save(b.next, loadedB.version), false, 'the stale write is refused…');
  const retried = await casMerge({
    load: db.load,
    save: db.save,
    merge: (cur) => mergeIntake(cur, [page('bir', m({ registry: 'bir', registrationNumber: '210334871000' }))], CTX),
  });
  assert.ok(retried, '…and the retry lands');
  assert.equal(slot(row.docUploads, 'dti_certificate')?.r2_key, 'dti', 'the first upload survives');
  assert.equal(slot(row.docUploads, 'bir_2303')?.r2_key, 'bir');
});

/* ── THE PIN IS NOT WRITTEN WITHOUT THE SUPPLIER'S CONFIRM ──────────────── */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(new URL('.', import.meta.url).pathname, '..');

test('the permit address is only a PROPOSAL at upload; the pin is written only behind confirm=yes', () => {
  const intake = stripComments(readFileSync(join(WEB, 'lib', 'paper-intake.server.ts'), 'utf8'));
  assert.ok(!/from\('vendor_profiles'\)/.test(intake), 'the upload path touches the profile');
  assert.match(intake, /pin_proposal: proposal/);
  const actions = stripComments(readFileSync(join(WEB, 'app', 'vendor-dashboard', 'shop', 'inline-docs-actions.ts'), 'utf8'));
  const fn = actions.slice(actions.indexOf('async function confirmPermitPin('));
  const confirm = fn.indexOf("String(formData.get('confirm') ?? formData.get('location_confirmed') ?? '') !== 'yes'");
  const nudge = fn.indexOf('PIN_NUDGE_MAX_KM');
  const write = fn.indexOf('hq_latitude: lat');
  assert.ok(confirm > 0 && nudge > confirm && write > nudge, 'the confirm and the nudge check must come before the write');
  // The only writers of the shop pin in this file are the confirm path.
  assert.equal((actions.match(/hq_latitude:/g) ?? []).length, 1);
});

/* ── WHAT DOES NOT COUNT AS A TRY (approved papers demo, DECISION_LOG 7e4de291) ── */

import { NOT_A_TRY, DIFFERENT_NAME_BELOW } from './paper-intake';

test('every NOT_A_TRY outcome leaves the try count exactly as it was', () => {
  // One unclear try already used on the permit.
  const start = mergeIntake({}, [page('t1', m({ registry: 'lgu', couldNotRead: ['address'], address: null }))], CTX).next;
  assert.equal(slot(start, 'mayors_permit')?.attempts, 1);
  const withDti = mergeIntake(start, [page('dti', m({ registry: 'dti', accountName: 'LIWANAG PHOTO AND FILM' }))], CTX).next;
  const cases: Array<[string, PageRead]> = [
    ['other', page('o', m({ registry: 'other' }))],
    ['unknown', page('u', m({ registry: 'unreadable' }))],
    ['different_name', page('d', m({ registry: 'lgu', accountName: 'KUSINA ROSARIO CATERING', ownerName: 'MARIA SANTOS', expirationDate: '2026-12-31' }))],
    ['expired', page('e', m({ registry: 'lgu', accountName: 'LIWANAG PHOTO AND FILM', expirationDate: '2025-12-31' }))],
    ['file_refused', page('f', null, { fileProblem: 'The file is over 15 MB.' })],
    ['reader_unavailable', page('r', null)],
    ['only_one_needed', page('s', m({ registry: 'sec', accountName: 'LIWANAG PHOTO AND FILM', unsure: ['owner_name', 'account_name'] }))],
  ];
  const seen = new Set<string>();
  for (const [want, pg] of cases) {
    const out = mergeIntake(withDti, [pg], CTX);
    assert.equal(out.reports[0]!.outcome, want, want);
    seen.add(want);
    assert.equal(slot(out.next, 'mayors_permit')?.attempts, 1, `${want} used a try`);
    if (want !== 'only_one_needed') assert.ok(out.discard.includes(pg.r2Key), `${want} kept a file it refused`);
  }
  assert.deepEqual([...seen].sort(), [...NOT_A_TRY].sort(), 'NOT_A_TRY and the tested list drifted apart');
});

test('a paper from a DIFFERENT shop name is refused and not counted; a near match is filed for the Submit check', () => {
  const dti = mergeIntake({}, [page('dti', m({ registry: 'dti', accountName: 'LIWANAG PHOTO AND FILM', ownerName: 'RAMON BAUTISTA' }))], CTX).next;
  const other = mergeIntake(dti, [page('x', m({ registry: 'bir', accountName: 'KUSINA ROSARIO CATERING', ownerName: 'MARIA SANTOS', registrationNumber: '210334871000' }))], CTX);
  assert.equal(other.reports[0]!.outcome, 'different_name');
  assert.match(other.reports[0]!.message, /Not counted as a try/);
  assert.equal(other.next.bir_2303, undefined);
  const near = mergeIntake(dti, [page('y', m({ registry: 'bir', accountName: 'LIWANAG PHOTO & FILM SERVICES', ownerName: null, registrationNumber: '210334871000' }))], CTX);
  assert.equal(near.reports[0]!.outcome, 'read_ok', 'a near match is filed (the Submit check sends it to a person)');
  const owner = mergeIntake(dti, [page('z', m({ registry: 'bir', accountName: null, ownerName: 'RAMON BAUTISTA', registrationNumber: '210334871000' }))], CTX);
  assert.equal(owner.reports[0]!.outcome, 'read_ok', 'a sole proprietor’s BIR names the owner — that matches');
  assert.ok(DIFFERENT_NAME_BELOW > 0 && DIFFERENT_NAME_BELOW < 1);
});

test('a BLURRY copy of a recognised paper DOES count (demo: "Try 2 of 3")', () => {
  const t = mergeIntake({}, [page('b', m({ registry: 'lgu', couldNotRead: ['address'], address: null }))], CTX);
  assert.equal(t.reports[0]!.outcome, 'unreadable');
  assert.equal(slot(t.next, 'mayors_permit')?.attempts, 1);
  assert.ok(!NOT_A_TRY.includes('unreadable'));
});

test('after 3 tries the PERMIT typed form is the demo’s two fields, and the admin sees them on a request card', () => {
  const place = stripComments(readFileSync(join(WEB, 'app', 'vendor-dashboard', 'shop', '_components', 'paper-upload-place.tsx'), 'utf8'));
  const permit = place.slice(place.indexOf('mayors_permit: ['), place.indexOf('],', place.indexOf('mayors_permit: [')));
  assert.match(permit, /key: 'permit_number', label: 'Permit number'/);
  assert.match(permit, /key: 'valid_until', label: 'Good until'/);
  assert.match(place, /Send for checking/);
  const admin = stripComments(readFileSync(join(WEB, 'app', 'admin', 'verify', 'page.tsx'), 'utf8'));
  assert.match(admin, /function typedBySupplier\(/);
  assert.match(admin, /Typed by the supplier · Try \{formatCount\(typed\.attempts\)\}/);
  assert.match(admin, /permit_number: 'Permit number'/);
});
