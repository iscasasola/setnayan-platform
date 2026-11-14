/**
 * a-send-back-names-only-its-paper.test.ts — 📨 A SEND-BACK NAMES ONLY THE PAPER THAT NEEDS A NEW COPY.
 *
 * Owner, 2026-11-14 (specs DECISION_LOG "A SEND-BACK NAMES ONLY THE PAPER THAT NEEDS A NEW COPY"): "Only the named one".
 *   · the admin picks one or more papers and gives a reason;
 *   · ONLY those papers read "Needs a new copy" with the reason;
 *   · the other papers keep their state and are not re-uploaded;
 *   · on re-Submit the whole application is decided again.
 *
 * Before this, `rejectApplication` sent the whole application back and the next draft started EMPTY, so every paper
 * needed a new copy whatever the reason named. A send-back made before the rule names nothing and still reads that
 * way — held here too, so old applications keep loading.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { setupPapers } from './setup-papers';
import {
  markSentBack,
  requiredDocsComplete,
  seedDraftAfterSendBack,
  sentBackOf,
  sentBackSlotKeys,
  verificationSubmitMissing,
  type DocUploadMap,
} from './vendor-verification';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ref = (k: string) => `r2://setnayan-vendor-verification/vendors/v1/verification/${k}.pdf`;
const SUBMITTED: DocUploadMap = {
  dti_certificate: { r2_key: ref('dti'), uploaded_at: '2026-11-01T00:00:00Z' },
  bir_2303: { r2_key: ref('bir'), uploaded_at: '2026-11-01T00:00:00Z' },
  mayors_permit: { r2_key: ref('permit'), uploaded_at: '2026-11-01T00:00:00Z' },
  portfolio_samples: [{ r2_key: 'r2://setnayan-media/vendors/v1/p1.jpg' }],
} as DocUploadMap;
const REASON = 'The BIR 2303 photo is cut off at the bottom — upload the whole page.';
const AT = '2026-11-14T03:00:00.000Z';

test('the admin’s send-back marks ONLY the named paper — the other two (and every file) are untouched', () => {
  const marked = markSentBack(SUBMITTED, ['bir_2303'], REASON, AT)!;
  assert.ok(marked, 'a one-paper send-back was refused');
  assert.deepEqual(marked.dti_certificate, SUBMITTED.dti_certificate, 'the DTI/SEC paper was touched');
  assert.deepEqual(marked.mayors_permit, SUBMITTED.mayors_permit, 'the permit was touched');
  assert.deepEqual(marked.portfolio_samples, SUBMITTED.portfolio_samples);
  // The named paper keeps its file for the record and gains the marker.
  assert.equal((marked.bir_2303 as { r2_key?: string }).r2_key, ref('bir'));
  assert.deepEqual(sentBackOf(marked.bir_2303), { reason: REASON, at: AT });
  assert.deepEqual(sentBackSlotKeys(marked), ['bir_2303']);
  // Pure: the input is not mutated.
  assert.equal(sentBackOf(SUBMITTED.bir_2303), null);
});

test('a send-back must name a paper, a real one, with a reason', () => {
  assert.equal(markSentBack(SUBMITTED, [], REASON, AT), null, 'a send-back naming nothing went through');
  assert.equal(markSentBack(SUBMITTED, ['portfolio_samples'], REASON, AT), null, 'an optional extra was named');
  assert.equal(markSentBack(SUBMITTED, ['bank_account_proof'], REASON, AT), null, 'a retired paper was named');
  assert.equal(markSentBack(SUBMITTED, ['bir_2303'], '   ', AT), null, 'a blank reason went through');
  // Two named is two named — and only two.
  assert.deepEqual(sentBackSlotKeys(markSentBack(SUBMITTED, ['mayors_permit', 'dti_certificate'], REASON, AT)), [
    'dti_certificate',
    'mayors_permit',
  ]);
});

test('the supplier sees the reason on that paper only — the others keep their state', () => {
  const marked = markSentBack(SUBMITTED, ['bir_2303'], REASON, AT)!;
  // While the latest application is the sent-back one…
  const onRejected = setupPapers({ measured: true, status: 'rejected', uploads: marked })!;
  assert.deepEqual(
    onRejected.map((p) => [p.key, p.state, p.reason]),
    [
      ['dti_certificate', 'uploaded', null],
      ['bir_2303', 'new_copy', REASON],
      ['mayors_permit', 'uploaded', null],
    ],
  );
  // …and in the next draft, seeded from it.
  const seed = seedDraftAfterSendBack(marked);
  const onDraft = setupPapers({ measured: true, status: 'draft', uploads: seed })!;
  assert.deepEqual(
    onDraft.map((p) => [p.key, p.state, p.reason]),
    [
      ['dti_certificate', 'uploaded', null],
      ['bir_2303', 'new_copy', REASON],
      ['mayors_permit', 'uploaded', null],
    ],
  );
});

test('the next draft keeps the papers that were not named — they are not re-uploaded', () => {
  const marked = markSentBack(SUBMITTED, ['bir_2303'], REASON, AT)!;
  const seed = seedDraftAfterSendBack(marked);
  assert.deepEqual(seed.dti_certificate, SUBMITTED.dti_certificate);
  assert.deepEqual(seed.mayors_permit, SUBMITTED.mayors_permit);
  assert.deepEqual(seed.portfolio_samples, SUBMITTED.portfolio_samples);
  // The named paper carries its marker and NO file, so it is not complete and Submit waits for it alone.
  assert.equal((seed.bir_2303 as { r2_key?: string }).r2_key, undefined);
  assert.equal(requiredDocsComplete(seed), false);
  assert.deepEqual(verificationSubmitMissing({ uploads: seed }), ['Upload your DTI/SEC, BIR 2303, and Business Permit']);
  // A new copy replaces the slot value (the shipped `buildSlotValue` writes a fresh object) — marker and reason go.
  const replaced = { ...seed, bir_2303: { r2_key: ref('bir-v2'), uploaded_at: AT } } as DocUploadMap;
  assert.equal(requiredDocsComplete(replaced), true);
  assert.deepEqual(verificationSubmitMissing({ uploads: replaced }), []);
  const after = setupPapers({ measured: true, status: 'draft', uploads: replaced })!;
  assert.ok(after.every((p) => p.state === 'uploaded' && p.reason === null), 'the reason outlived the new copy');
});

test('a send-back made before the rule (it names nothing) reads exactly as it always did', () => {
  assert.deepEqual(seedDraftAfterSendBack(SUBMITTED), {}, 'an old send-back seeded a draft');
  const rows = setupPapers({ measured: true, status: 'rejected', uploads: SUBMITTED })!;
  assert.ok(rows.every((p) => p.state === 'new_copy' && p.reason === null));
  // A malformed marker is not a marker.
  assert.equal(sentBackOf({ r2_key: 'x', sent_back: { reason: '' } } as never), null);
  assert.equal(sentBackOf({ r2_key: 'x', sent_back: 'yes' } as never), null);
});

test('wiring: both send-back doors pass the named papers, and the decision refuses a send-back naming none', () => {
  const actions = code('app/admin/verify/actions.ts');
  assert.match(actions, /formData\s*\.getAll\('sent_back_slots'\)/, 'the admin’s ticks are not read');
  assert.equal(
    (actions.match(/sentBackSlots: (?:decision === 'needs_fix' \? )?readSentBackSlots\(formData\)/g) ?? []).length,
    2,
    'rejectApplication and the work list’s "Needs a fix" must both name their papers',
  );
  assert.match(actions, /sentBackUploads = markSentBack\(/);
  assert.match(actions, /if \(!sentBackUploads\) \{\s*return \{ ok: false, error: 'Pick the paper that needs a new copy\.' \};/);
  assert.match(actions, /if \(sentBackUploads\) updatePayload\.doc_uploads = sentBackUploads;/, 'the marker is not written with the status');
  // The two forms offer a tick per required paper.
  for (const rel of ['app/admin/verify/page.tsx', 'app/admin/work/_components/supplier-inbox.tsx']) {
    const src = code(rel);
    assert.match(src, /name="sent_back_slots"/, `${rel} offers no paper to name`);
    assert.match(src, /REQUIRED_DOC_SLOT_KEYS\.has\(/, `${rel} hand-lists the papers`);
  }
  // The supplier's next draft is seeded from the send-back, never started empty after one.
  const docs = code('app/vendor-dashboard/shop/inline-docs-actions.ts');
  assert.match(docs, /status === 'rejected' \? seedDraftAfterSendBack\(/);
  assert.match(docs, /doc_uploads: seed,/);
  // The reason is drawn on the named paper, and the one line above the rows is only for an old send-back.
  assert.match(code('app/vendor-dashboard/shop/_components/verify-pairs.tsx'), /!paperPresent && sentBackOf\(entry\)/);
  const rows = code('app/vendor-dashboard/_components/setup-papers.tsx');
  assert.match(rows, /p\.reason \? `\$\{PAPER_STATE_WORD\.new_copy\} · \$\{p\.reason\}`/);
  assert.match(rows, /&& !papers\.some\(\(p\) => p\.reason\)/, 'the reason is said above every paper again');
  // The supplier's notice names the papers too (through the one notification pipeline the bell and #7631 read).
  assert.match(actions, /sentBackPapers:\s*input\.decision === 'rejected'/, 'the send-back notice does not name its papers');
  const notify = code('lib/vendor-status-notify.ts');
  assert.match(notify, /Needs a new copy: \$\{args\.sentBackPapers\.join\(', '\)\}/);
  assert.match(notify, /Your other papers are kept/);
  for (const rel of ['app/vendor-dashboard/profile/details-data.ts', 'lib/vendor-first-steps.server.ts']) {
    assert.match(code(rel), /sentBackSlotKeys\(uploads\)\.length > 0 \? null/, `${rel} repeats the reason off the paper`);
  }
});
