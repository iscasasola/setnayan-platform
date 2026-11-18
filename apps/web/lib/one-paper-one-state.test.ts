/**
 * one-paper-one-state.test.ts — walk W1-B12 and owner ruling 17 (W1-B13), 16 Nov 2026.
 *
 *   B12 · The upload place drew a paper from TWO sources — the last upload's report list and the stored slot — so one
 *         paper read "We couldn't open that file" in the list and "Not clear enough · Try 2 of 3" (or "Waiting for a
 *         photo") on its row. Now ONE derivation, `paperState` (`lib/paper-intake-shared.ts`), gives each paper its
 *         status, refusal reason and try count; the row and the "N of 3" draw it, and the list draws only the files that
 *         named NO paper.
 *   B13 · Ruling 17: after the third refused copy the paper goes to a person (the admin verification queue's "typed
 *         after three tries" paper, `manual`) — never a refusal that files nothing and can never be passed.
 *
 * SABOTAGE (each seen red): the row back on its own `s.attempts > 0` text → 3 · the list drawing every report → 3 ·
 * `paperState` ignoring the report → 1 · the past-tries branch back to a bare `tries_used` → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { MAX_TRIES, PERSON_CHECKS_PAPER, latestReportBySlot, paperState, unplacedReports } from '@/lib/paper-intake-shared';
import { INTAKE_MESSAGE, mergeIntake, type IntakeReport, type PageRead } from '@/lib/paper-intake';
import { isSlotComplete } from '@/lib/vendor-verification';
import type { ModelPaperRead } from '@/lib/verification-paper-read';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const KEY = 'test-only-derived-key-not-a-secret';
const CTX = { nowIso: '2026-11-16T02:00:00.000Z', todayManila: '2026-11-16', key: KEY };
const m = (over: Partial<ModelPaperRead>): ModelPaperRead => ({
  registry: 'bir', accountName: 'SAMPLE BLOOMS', ownerName: 'JUAN DELA CRUZ', registrationNumber: '210334871000',
  rdo: null, address: '1 Sample St, Pasig', city: 'Pasig', barangay: null, expirationDate: null, readAs: null,
  couldNotRead: [], tin: null, unsure: [], ...over,
});
const page = (r2Key: string, model: ModelPaperRead | null, extra: Partial<PageRead> = {}): PageRead => ({
  r2Key, page: null, fileProblem: null, model, qrTexts: [], ...extra,
});
const unclear = (k: string) => page(k, m({ couldNotRead: ['registration_number'], registrationNumber: null }));

test('1 · one paper, one state — the row, its reason and its try count come from the stored slot AND its report', () => {
  // A refused copy on try 2: the row says THIS refusal and the next try, once.
  const t1 = mergeIntake({}, [unclear('a')], CTX);
  const t2 = mergeIntake(t1.next, [unclear('b')], CTX);
  const r2 = latestReportBySlot(t2.reports).bir_2303!;
  const st = paperState(t2.next.bir_2303, r2);
  assert.equal(st.kind, 'refused');
  assert.equal(st.reason, INTAKE_MESSAGE.unclear, 'the row does not say the report’s own reason');
  assert.equal(st.attempts, 2);
  assert.match(st.text, /Try 3 of 3 · last one$/);
  assert.equal(st.isIn, false);

  // A refusal that is NOT a try (an expired permit on a paper with one try used): its own reason, never "Try 2 of 3".
  const expired = mergeIntake(t1.next, [page('x', m({ registry: 'lgu', expirationDate: '2026-01-01' }))], CTX);
  const ex = paperState(expired.next.mayors_permit, latestReportBySlot(expired.reports).mayors_permit!);
  assert.equal(ex.kind, 'refused');
  assert.match(ex.text, /^This Mayor's Permit ended on .+ · Not counted as a try$/);

  // A clean read is "Recognised"; nothing to send is "Waiting for a photo".
  const ok = mergeIntake({}, [page('c', m({}))], CTX);
  assert.equal(paperState(ok.next.bir_2303, latestReportBySlot(ok.reports).bir_2303!).text, 'Recognised');
  assert.equal(paperState(undefined, null).text, 'Waiting for a photo');
  // A send-back's reason is the row's state, not a second line beside "Waiting for a photo".
  assert.equal(paperState({ attempts: 0 }, null, { sentBackReason: 'Blurry' }).text, 'Needs a new copy · Blurry');
});

test('2 · "in" is the SAME rule the counts use — a filed file is never "Waiting for a photo"', () => {
  for (const raw of [
    { r2_key: 'r2://x', attempts: 0, evidence: { model: m({}) } },
    { r2_key: 'r2://x', attempts: 3, manual: true },
    { r2_key: 'r2://legacy' }, // filed before the reader: counted in, so it must read as in
    { attempts: 2 },
    undefined,
  ]) {
    assert.equal(paperState(raw, null).isIn, isSlotComplete('bir_2303', raw as never), `${JSON.stringify(raw)} disagrees with the count`);
  }
  assert.equal(paperState({ r2_key: 'r2://legacy' }, null).kind, 'person');
});

test('3 · the upload place draws every row, its reason and its count from paperState; the list only from unplaced files', () => {
  const src = code('app/vendor-dashboard/shop/_components/paper-upload-place.tsx');
  assert.match(src, /paperState\(payload\.docMap\[r\.slot\], lastSaid\[r\.slot\] \?\? null,/, 'the rows no longer derive from paperState');
  assert.match(src, /const inCount = ROWS\.filter\(\(r\) => states\[r\.slot\]\.isIn\)\.length;/, '"N of 3" is counted apart from the rows');
  assert.match(src, /\{unplaced\.map\(/, 'the list draws reports that belong to a paper');
  assert.doesNotMatch(src, /\{reports\.map\(/, 'the list draws every report again — a paper is said twice');
  assert.doesNotMatch(src, /Waiting for a photo|Not clear enough|A person will check this|s\.attempts\s*>\s*0/, 'the row words its own state again');
  // Only files that named no paper are unplaced.
  const reports = [{ slot: null }, { slot: 'bir_2303' }] as Array<Pick<IntakeReport, 'slot'>>;
  assert.deepEqual(unplacedReports(reports), [{ slot: null }]);
});

test('4 · ruling 17 — past the tries a paper goes to a person; it is never refused with nothing filed', () => {
  // The third unclear copy is kept for a person (as before).
  let cur: Record<string, unknown> = {};
  for (const k of ['a', 'b', 'c']) cur = mergeIntake(cur, [unclear(k)], CTX).next;
  const third = cur.bir_2303 as { manual?: boolean; r2_key?: string };
  assert.equal(third.manual, true);
  assert.equal(paperState(cur.bir_2303, null, { sent: true }).text, PERSON_CHECKS_PAPER);

  // Tries used and NOTHING kept (its seal did not hold): the old refusal filed nothing forever. Now the copy is kept
  // for a person.
  const stuck = { bir_2303: { attempts: MAX_TRIES } };
  const r = mergeIntake(stuck, [unclear('d')], CTX);
  const slot = r.next.bir_2303 as { manual?: boolean; r2_key?: string; attempts: number };
  assert.equal(r.reports[0]!.outcome, 'tries_used_kept', 'the paper was refused past its tries instead of going to a person');
  assert.equal(slot.r2_key, 'd');
  assert.equal(slot.manual, true, 'kept, but not marked for a person');
  assert.equal(slot.attempts, MAX_TRIES, 'the try count ran past three');
  assert.deepEqual(r.discard, []);
  assert.equal(paperState(r.next.bir_2303, r.reports[0]!).isIn, true);

  // The words say a person checks it — never "you've used your tries".
  assert.doesNotMatch(INTAKE_MESSAGE.triesUsed, /used your three tries/);
  assert.match(INTAKE_MESSAGE.keptTyped, /kept it for a person at Setnayan to check/i);
  // W1-B35: before the papers are sent nothing says a person is checking it NOW.
  assert.doesNotMatch(INTAKE_MESSAGE.keptTyped + INTAKE_MESSAGE.triesUsed, /is (already )?checking/i);
});

test('audit #7898 · a sent-back paper\'s "Needs a new copy · …" line is still announced (role="alert")', () => {
  const src = readFileSync(join(process.cwd(), 'app/vendor-dashboard/shop/_components/paper-upload-place.tsx'), 'utf8');
  assert.match(src, /data-paper-state=\{st\.kind\}[\s\S]{0,200}role=\{sentBackOf\(payload\.docMap\[row\.slot\] as DocUpload\) && !st\.isIn \? 'alert' : undefined\}/);
});
