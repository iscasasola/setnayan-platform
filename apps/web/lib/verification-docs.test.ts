/**
 * The verification-documents page decides whether someone's government ID can
 * be permanently deleted. These tests pin the gates that make that safe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_REFERENCE_SET_REASON,
  LISTING_FAILED_REASON,
  REFERENCES_INCOMPLETE_REASON,
  buildVerificationDocsReportFrom,
  classifyVerificationDocs,
  collectPlainStrings,
  collectReferencedKeys,
  isDeletableVerificationDoc,
  parseVerificationKey,
  readAllPages,
  referenceCandidateForms,
  referencedKeysFrom,
  verificationDeleteVerdict,
  verificationDeletionBlockReason,
  VERIFICATION_REFERENCE_SOURCES,
  collectPlainStringsDetailed,
  collectReferencedKeysDetailed,
  documentReferenceCount,
  foldReferenceReads,
  readReferenceSource,
  readAllReferenceSources,
  buildVerificationDocsReportWith,
  referenceSelectColumns,
  type ReferenceQueryClient,
  type ReferenceQueryResult,
  type ReferenceRead,
  type ReferenceSource,
} from './verification-docs';
import { buildSlotValue } from './vendor-verification-slots';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = readFileSync(
  join(HERE, '..', 'app', 'admin', 'verification-docs', 'actions.ts'),
  'utf8',
);

// Synthetic. Was a real prod vendor_profile_id — the live shop `setnaprod` —
// which this test never needed: it only builds object KEYS to check the prefix
// rules, so any uuid-shaped value does the same work without putting a real
// row in the repo.
const VENDOR_SHOP = '00000000-0000-4000-8000-00000000ce11';
const GOV = `vendors/${VENDOR_SHOP}/verification/government_id.jpg`;
const DTI = `vendors/${VENDOR_SHOP}/verification/dti_certificate.pdf`;

const obj = (key: string) => ({ key, size: 1024, lastModified: null });

// ── The prefix comes from the UPLOAD CALL SITES ─────────────────────────────
// A previous media page derived its allowlist from module names and matched
// ZERO objects. These are the real shapes written by
// vendor-dashboard/verify/page.tsx and shop/_components/docs-body.tsx.

test('a real upload key yields its vendor and its slot', () => {
  assert.deepEqual(parseVerificationKey(GOV), {
    vendorProfileId: VENDOR_SHOP,
    slot: 'government_id',
  });
});

test('a key we do not recognise yields nulls rather than a guess', () => {
  for (const key of ['stray.jpg', 'vendors/', 'events/EVT/hero.png', '']) {
    assert.deepEqual(parseVerificationKey(key), { vendorProfileId: null, slot: null });
  }
});

// ── Classification ──────────────────────────────────────────────────────────

test('a document a vendor record still names is IN USE', () => {
  const [doc] = classifyVerificationDocs([obj(GOV)], new Set([GOV]));
  assert.equal(doc?.state, 'in_use');
});

test('a document nothing points at is LEFT OVER', () => {
  const [doc] = classifyVerificationDocs([obj(GOV)], new Set([DTI]));
  assert.equal(doc?.state, 'left_over');
});

test('an unparseable key is listed, not dropped', () => {
  // Dropping it would hide exactly the file someone needs to find.
  const docs = classifyVerificationDocs([obj('stray.jpg')], new Set());
  assert.equal(docs.length, 1);
  assert.equal(docs[0]?.state, 'unrecognised');
});

// ── The delete gate ─────────────────────────────────────────────────────────

test('a referenced document can never be deleted', () => {
  assert.equal(isDeletableVerificationDoc(GOV, new Set([GOV])), false);
});

test('an unrecognised key can never be deleted — we cannot say whose it is', () => {
  assert.equal(isDeletableVerificationDoc('stray.jpg', new Set()), false);
});

test('only a parseable, unreferenced document is deletable', () => {
  assert.equal(isDeletableVerificationDoc(GOV, new Set([DTI])), true);
});

// ── The gates that live in the action, not the page ─────────────────────────

test('the delete action re-reads what is in use AT PRESS TIME', () => {
  // The listing in front of a person may be minutes old, and a vendor can
  // attach a document in between. A stale "left over" label must not be able to
  // authorise a delete.
  const fn = ACTIONS.slice(ACTIONS.indexOf('export async function deleteVerificationDoc'));
  assert.match(fn, /await referencedVerificationKeys\(\)/);
  assert.ok(
    fn.indexOf('referencedVerificationKeys') < fn.indexOf('r2Delete'),
    'the reference read must happen BEFORE the delete',
  );
});

test('a failed reference read deletes NOTHING', () => {
  // An empty set from a failed query is indistinguishable from "nothing points
  // at this" — the RLS-denial-reads-as-empty trap. Here it would erase a live
  // government ID.
  //
  // 🔑 Asked by CALLING the rule, not by matching the action's text. The action
  // is a `'use server'` module no node:test can load, so its decision was moved
  // into `verificationDeleteVerdict` where this question has an answer.
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set<string>(),
      referenceError: 'vendor_verifications: permission denied',
      referencesComplete: false,
    }),
    'refs',
  );
  // And a NON-empty set does not rescue a failed read either — a read that
  // raised part-way through can still have collected keys.
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([DTI]),
      referenceError: 'vendor_verification_applications: permission denied',
      referencesComplete: false,
    }),
    'refs',
  );
});

test('the delete gate is the shared rule, not a re-typed condition', () => {
  const fn = ACTIONS.slice(ACTIONS.indexOf('export async function deleteVerificationDoc'));
  assert.match(fn, /verificationDeleteVerdict\(/);
  assert.ok(
    fn.indexOf('verificationDeleteVerdict') < fn.indexOf('r2Delete'),
    'the verdict must be taken BEFORE the delete',
  );
  // And the verdict is what the redirect carries, so a gate cannot be added to
  // the rule and forgotten at the call site.
  assert.match(fn, /error=\$\{verdict\}/);
});

test('the delete gate refuses a referenced key and admits an unreferenced one', () => {
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([GOV, DTI]),
      referenceError: null,
      referencesComplete: true,
    }),
    'inuse',
  );
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([DTI]),
      referenceError: null,
      referencesComplete: true,
    }),
    'ok',
  );
  // The empty-set gate reaches the action too.
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set<string>(),
      referenceError: null,
      referencesComplete: true,
    }),
    'inuse',
  );
});

test('there is no bulk delete on this page', () => {
  // The value of the gate is that a person looked at each file.
  //
  // ⚠ Strip comments first. The version of this test that matched the raw file
  // failed on its OWN docblock, which contains the word it was searching for —
  // the same false positive that tripped three smell tests earlier this week.
  // A guard that reads prose is testing the prose.
  const code = ACTIONS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !/deleteAll|clearFolder|bulkDelete/i.test(code),
    'a bulk path would defeat the one-file-at-a-time review this page exists for',
  );
  // And exactly one r2Delete call site, so "one object per press" is structural.
  assert.equal((code.match(/r2Delete\(/g) ?? []).length, 1);
});

test('viewing a document downloads it instead of rendering it in the tab', () => {
  // Without a content disposition a presigned GET for a JPEG renders inline —
  // and a government ID ends up in the browser's tab history.
  const fn = ACTIONS.slice(ACTIONS.indexOf('export async function viewVerificationDoc'));
  assert.match(fn, /contentDispositionAttachment\(/);
});

test('both actions require an admin before doing anything', () => {
  for (const name of ['viewVerificationDoc', 'deleteVerificationDoc']) {
    const fn = ACTIONS.slice(ACTIONS.indexOf(`export async function ${name}`));
    const head = fn.slice(0, fn.indexOf('\n}'));
    assert.ok(
      head.indexOf('await requireAdmin()') >= 0 &&
        head.indexOf('await requireAdmin()') < head.indexOf('formData.get'),
      `${name} must gate on admin before reading the form`,
    );
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// THE REFERENCED SET — where it comes from, which is where the bug was
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔑 EVERY TEST ABOVE HANDS THE CLASSIFIER A SET IT BUILT ITSELF. That is why
// they were all green while the page would have deleted a live government ID:
// the classifier was never wrong, the SET was empty. These tests start from
// the REAL writer — `buildSlotValue`, the one function both upload actions go
// through — so a slot shape added next year is covered on the day it ships.

const BUCKET = 'setnayan-vendor-verification';
const MEDIA_BUCKET = 'setnayan-media';
/** What the uploader really persists: a FULL ref, not a key. */
const ref = (key: string) => `r2://${BUCKET}/${key}`;
const slot = (slotKey: string, fields: Parameters<typeof buildSlotValue>[1]) =>
  buildSlotValue(slotKey, fields);
const blank = { r2Ref: null, url: null, scheduledAt: null };

test('the writer never persists a bare string — the shape the old reader looked for', () => {
  const built = [
    slot('dti_certificate', { ...blank, r2Ref: ref(DTI) }),
    slot('portfolio_samples', { ...blank, portfolioRefs: [ref(DTI)] }),
    slot('client_references', {
      ...blank,
      references: [{ name: 'A', contact_number: '09', event: 'w', date: '2026-01-01' }],
    }),
    slot('social_media', { ...blank, social: { website: 'https://a.example' } }),
    slot('google_meet', { ...blank, scheduledAt: '2026-09-20T02:00:00Z' }),
  ];
  for (const value of built) {
    assert.notEqual(typeof value, 'string', `a slot value came back a bare string: ${JSON.stringify(value)}`);
  }
  // And the old reader, transcribed. 🔑 The `unknown` cast is not laziness — the
  // `DocUpload` union has no `string` member at all, so TypeScript narrows the
  // guard's body to `never` and refuses to compile it. The TYPE SYSTEM was
  // already saying this filter can never fire; nothing was listening.
  const oldReader = new Set<string>();
  for (const value of Object.values(built as unknown as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim().length > 0) oldReader.add(value.trim());
  }
  assert.equal(oldReader.size, 0);
});

// ── One test per shape ──────────────────────────────────────────────────────

test('SHAPE · a normal document slot — the object the uploader writes', () => {
  const uploads = { dti_certificate: slot('dti_certificate', { ...blank, r2Ref: ref(DTI) }) };
  const keys = new Set(referencedKeysFrom(uploads));
  assert.ok(keys.has(DTI), 'the BARE key the listing hands back must be in the set');
  assert.ok(keys.has(ref(DTI)), 'the raw stored value must be in the set too');
  const [doc] = classifyVerificationDocs([obj(DTI)], keys);
  assert.equal(doc?.state, 'in_use');
  assert.equal(isDeletableVerificationDoc(DTI, keys), false);
});

test('SHAPE · portfolio_samples is an ARRAY, and every entry counts', () => {
  const a = `vendors/${VENDOR_SHOP}/verification/portfolio_samples/one.jpg`;
  const b = `vendors/${VENDOR_SHOP}/verification/portfolio_samples/two.jpg`;
  const uploads = {
    portfolio_samples: slot('portfolio_samples', { ...blank, portfolioRefs: [ref(a), ref(b)] }),
  };
  const keys = new Set(referencedKeysFrom(uploads));
  for (const k of [a, b]) {
    assert.ok(keys.has(k), `${k} fell out of the set`);
    assert.equal(isDeletableVerificationDoc(k, keys), false);
  }
});

test('SHAPE · a portfolio sample in the PUBLIC media bucket is kept, not filtered out', () => {
  // The writer accepts `vendorOwnedMediaPolicy` as well, so a ref can name a
  // different bucket. Dropping it could only ever ENABLE a delete.
  const k = `vendors/${VENDOR_SHOP}/verification/portfolio_samples/public.jpg`;
  const uploads = {
    portfolio_samples: slot('portfolio_samples', {
      ...blank,
      portfolioRefs: [`r2://${MEDIA_BUCKET}/${k}`],
    }),
  };
  const keys = new Set(referencedKeysFrom(uploads));
  assert.ok(keys.has(k));
  assert.equal(isDeletableVerificationDoc(k, keys), false);
});

test('SHAPE · a BARE key survives — both upload gates admit one', () => {
  // `!ref.startsWith('r2://') ||` short-circuits ownership to true in BOTH
  // SEC-1 gates, so a value that is already a bare key is a legal stored shape
  // — and the erasure walk, which requires `r2://`, drops it.
  const uploads = { government_id: slot('government_id', { ...blank, r2Ref: GOV }) };
  const keys = new Set(referencedKeysFrom(uploads));
  assert.ok(keys.has(GOV));
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

test('SHAPE · a cleared slot is null — what production actually holds — and breaks nothing', () => {
  const uploads = { bir_2303: slot('bir_2303', blank), dti_certificate: slot('dti_certificate', blank) };
  assert.deepEqual(uploads, { bir_2303: null, dti_certificate: null });
  assert.deepEqual(referencedKeysFrom(uploads), []);
});

test('SHAPE · the shapes that carry no file contribute no key', () => {
  const uploads = {
    client_references: slot('client_references', {
      ...blank,
      references: [{ name: 'A', contact_number: '09', event: 'w', date: '2026-01-01' }],
    }),
    social_media: slot('social_media', { ...blank, social: { website: 'https://a.example' } }),
    google_meet: slot('google_meet', { ...blank, scheduledAt: '2026-09-20T02:00:00Z' }),
  };
  const keys = new Set(referencedKeysFrom(uploads));
  // They add strings — deliberately, because erring toward "in use" is free —
  // but none of them is an object key, so nothing in the bucket changes state.
  assert.equal(keys.has(GOV), false);
  const [doc] = classifyVerificationDocs([obj(GOV)], keys);
  assert.equal(doc?.state, 'left_over');
});

test('SHAPE · a nested shape nobody has written yet is still walked', () => {
  const keys = new Set(referencedKeysFrom({ future: { pages: [{ scan: { r2_key: ref(GOV) } }] } }));
  assert.ok(keys.has(GOV), 'the walk must be shape-agnostic, not a fixed-key read');
});

test('SHAPE · a *_r2_key COLUMN value goes through the same helper', () => {
  const row = { government_id_r2_key: ref(GOV), bank_account_proof_r2_key: null };
  const keys = new Set(referencedKeysFrom(row));
  assert.ok(keys.has(GOV));
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

// ── Normalisation, both directions ──────────────────────────────────────────

test('the set carries BOTH the raw value and the resolved bare key', () => {
  const keys = new Set(referencedKeysFrom({ dti_certificate: { r2_key: ref(DTI) } }));
  assert.ok(keys.has(ref(DTI)), 'raw');
  assert.ok(keys.has(DTI), 'resolved');
});

test('widening the WALK alone is not enough — the listing holds bare keys', () => {
  // A live document belonging to SOMEBODY ELSE, so the round-3 canary (which
  // refuses everything when no reference is shaped like a file in this bucket)
  // is not what is doing the work here. This test is about the MATCH.
  const CONTROL = 'vendors/other-shop/verification/bank_account_proof.pdf';
  // The half-fix: pull `.r2_key` out and insert it as-is. Still deletable — a
  // full `r2://` ref never equals the bare key the listing hands back.
  const halfFixed = new Set([ref(DTI), CONTROL]);
  assert.equal(isDeletableVerificationDoc(DTI, halfFixed), true);
  // The whole fix carries BOTH forms, so the match lands.
  const whole = new Set([...referencedKeysFrom({ dti_certificate: { r2_key: ref(DTI) } }), CONTROL]);
  assert.equal(isDeletableVerificationDoc(DTI, whole), false);
});

test('R3-1 · and a set of nothing but unresolved refs is refused OUTRIGHT', () => {
  // The same half-fix without the control: no reference in the set is shaped
  // like a file in this bucket, which is what a broken reference reader looks
  // like. Round 3's canary fires on the COUNT OF DOCUMENT REFERENCES, so this
  // state — which used to score a live document `left_over` — is now refused
  // before the per-file match is even reached.
  const halfFixed = new Set([ref(DTI)]);
  assert.notEqual(halfFixed.size, 0);
  assert.equal(documentReferenceCount(halfFixed), 0);
  assert.equal(isDeletableVerificationDoc(DTI, halfFixed), false);
});

test('a value neither form recognises is kept raw and can still mark a file in use', () => {
  const weird = '  ../../vendors/odd//thing.bin  ';
  const keys = new Set(referencedKeysFrom({ mystery: { r2_key: weird } }));
  assert.ok(keys.has(weird.trim()), 'an unresolvable value must survive, trimmed');
  assert.equal(isDeletableVerificationDoc(weird.trim(), keys), false);
});

test('collectPlainStrings keeps every NON-ref string, at any depth, raw AND trimmed', () => {
  // Both forms, and only ever added. The trimmed form matches a stored value
  // written with stray whitespace; the RAW form matches an object key that
  // genuinely ends in one. Keeping only the trimmed one made this module's own
  // "kept raw" claim broader than its mechanism — round 3, finding 6.
  const found = new Set(
    collectPlainStrings({ a: [' x ', { b: 'y' }], c: null, d: '', e: ref(GOV) }),
  );
  assert.deepEqual([...found].sort(), [' x ', 'x', 'y']);
});

test('the two halves of the union are each load-bearing', () => {
  // Gut either and a shape stops being found — which is what the mutation run
  // measures. Pinned here so a future "simplification" has to answer for it.
  const refOnly = { dti_certificate: { r2_key: ref(DTI) } };
  const bareOnly = { government_id: { r2_key: GOV } };
  assert.deepEqual(collectPlainStrings(refOnly), [], 'the plain walk must not claim refs');
  assert.ok(collectPlainStrings(bareOnly).includes(GOV), 'the plain walk owns bare keys');
  assert.ok(new Set(referencedKeysFrom(refOnly)).has(DTI));
  assert.ok(new Set(referencedKeysFrom(bareOnly)).has(GOV));
});

// ── The empty-set gate ──────────────────────────────────────────────────────

test('NOTHING is deletable when the reference set is empty', () => {
  // This is the exact state the page shipped in: two reads that succeeded and
  // produced no keys at all. It is not proof the file is unused.
  assert.equal(isDeletableVerificationDoc(GOV, new Set<string>()), false);
  assert.equal(isDeletableVerificationDoc(DTI, new Set<string>()), false);
});

test('the empty-set gate does not disarm the normal case', () => {
  assert.equal(isDeletableVerificationDoc(GOV, new Set([DTI])), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// THE FIVE THINGS AN ADVERSARIAL REVIEW FOUND — 2026-09-10
// ═══════════════════════════════════════════════════════════════════════════

// ── 1 · LEADING WHITESPACE FELL THROUGH BOTH HALVES OF THE UNION ────────────
//
// The `r2://` test was ASYMMETRIC: half one included on `value.startsWith`
// (raw), half two excluded on `value.trim().startsWith` (trimmed). The
// exclusion was therefore strictly WIDER than the inclusion, and the gap was a
// hole neither half covered. Measured on the shipped code, against a NON-EMPTY
// reference set so the empty-set gate could not mask it:
//    "r2://…"     half1=1 half2=0  → in_use     deletable=false  ✓
//    "  r2://…"   half1=0 half2=0  → left_over  deletable=TRUE   ✗
//    "\n" / "\t" identical. A TRAILING space was always handled.

test('FINDING 1 · a ref with LEADING whitespace still marks its file in use', () => {
  for (const [label, stored] of [
    ['space', ` ${ref(GOV)}`],
    ['newline', `\n${ref(GOV)}`],
    ['tab', `\t${ref(GOV)}`],
    ['trailing space', `${ref(GOV)}  `],
    ['both ends', `  ${ref(GOV)}\n`],
  ] as const) {
    const keys = new Set([...referencedKeysFrom({ government_id: { r2_key: stored } }), DTI]);
    assert.ok(keys.has(GOV), `${label}: the bare key fell out of the set`);
    const [doc] = classifyVerificationDocs([obj(GOV)], keys);
    assert.equal(doc?.state, 'in_use', `${label}: a live document read as left over`);
    assert.equal(
      isDeletableVerificationDoc(GOV, keys),
      false,
      `${label}: a live government ID was offered for permanent deletion`,
    );
  }
});

test('FINDING 1 · the two halves divide the job on the SAME string', () => {
  // Whichever way the two predicates disagree, one side is a silent hole. Half
  // two must decline exactly what half one claims — raw, not trimmed.
  for (const stored of [ref(GOV), ` ${ref(GOV)}`, `\t${ref(GOV)}`, `${ref(GOV)} `]) {
    const claimedByHalfOne = stored.startsWith('r2://');
    const declinedByHalfTwo = collectPlainStrings({ v: stored }).length === 0;
    assert.equal(
      declinedByHalfTwo,
      claimedByHalfOne,
      `the halves disagree about ${JSON.stringify(stored)} — that gap is the hole`,
    );
  }
});

// ── 2 · THE FAIL-SAFE CLAIM WAS FALSE AS WRITTEN ────────────────────────────
//
// The docstring said a shape neither form recognises "still lands in the set
// raw, so it errs toward 'in use'". The set is compared against BARE LISTING
// KEYS, so a raw value that is not itself a bare key protects NOTHING. Every
// shape below is a legal stored value — both SEC-1 gates short-circuit
// ownership on `!ref.startsWith('r2://')`, `lib/uploads.ts` and
// `lib/vendor-identity-retention.ts` both model `legacy_url`, and
// `file-upload.tsx` supports legacy http(s) values — and every one came back
// `left_over`, `deletable: true`.

test('FINDING 2 · a presigned URL marks its file in use', () => {
  const stored = `https://abc.r2.cloudflarestorage.com/${BUCKET}/${GOV}?X-Amz-Signature=deadbeef&X-Amz-Expires=120`;
  const keys = new Set([...referencedKeysFrom({ government_id: { legacy_url: stored } }), DTI]);
  assert.ok(keys.has(GOV), 'the key must be derived from the PATH, signature and all');
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

test('FINDING 2 · a public-host URL marks its file in use', () => {
  for (const host of ['https://media.setnayan.com', 'https://pub-abc123.r2.dev']) {
    const keys = new Set([...referencedKeysFrom({ government_id: `${host}/${GOV}` }), DTI]);
    assert.ok(keys.has(GOV), `${host}: the key fell out`);
    assert.equal(isDeletableVerificationDoc(GOV, keys), false);
  }
});

test('FINDING 2 · an UPPERCASE r2 scheme marks its file in use', () => {
  const keys = new Set([...referencedKeysFrom({ government_id: `R2://${BUCKET}/${GOV}` }), DTI]);
  assert.ok(keys.has(GOV));
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

test('FINDING 2 · a bare key with a LEADING SLASH marks its file in use', () => {
  // S3 keys carry no leading slash and `ListObjectsV2` never returns one, so
  // `/vendors/…` and `vendors/…` name the same object.
  const keys = new Set([...referencedKeysFrom({ government_id: `/${GOV}` }), DTI]);
  assert.ok(keys.has(GOV));
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

test('FINDING 2 · a percent-encoded URL path is decoded', () => {
  const spaced = `vendors/${VENDOR_SHOP}/verification/government id.jpg`;
  const keys = new Set([
    ...referencedKeysFrom({ government_id: `https://media.setnayan.com/${encodeURI(spaced)}` }),
    DTI,
  ]);
  assert.ok(keys.has(spaced), 'the listing hands back the DECODED key');
  assert.equal(isDeletableVerificationDoc(spaced, keys), false);
});

test('FINDING 2 · every derived form ADDS — the trimmed raw value always survives', () => {
  // The property that makes an over-eager rule harmless. If any rule ever
  // filtered instead of appended, a value would stop protecting its object.
  for (const value of [
    ref(GOV),
    `R2://${BUCKET}/${GOV}`,
    `/${GOV}`,
    `https://media.setnayan.com/${GOV}`,
    'https://not-a-key.example/',
    'a referee named Ana',
    '2026-09-20T02:00:00Z',
    'https://%%%malformed',
  ]) {
    assert.ok(
      referenceCandidateForms(value).includes(value.trim()),
      `the raw value dropped out of the forms of ${JSON.stringify(value)}`,
    );
  }
});

test('FINDING 2 · a shape with no derivable key is kept raw, and that is SAID, not implied', () => {
  // The honest ceiling. This value protects an object only if the object's key
  // IS that string — which the docstring now states rather than papering over.
  const weird = '../../vendors/odd//thing.bin';
  const forms = referenceCandidateForms(weird);
  assert.ok(forms.includes(weird));
  assert.equal(forms.includes(GOV), false, 'nothing may be guessed into existence');
});

// ── 3 · THE REFERENCE READ WAS UNBOUNDED ────────────────────────────────────
//
// 🔴 The one that beat the new empty-set gate. Neither SELECT carried a
// `.limit()`, a `.range()` or a count, while PostgREST caps what it returns
// (Supabase's documented default for that setting is 1000). A capped read comes
// back LARGE, NON-EMPTY and INCOMPLETE with `error: null` — past the error gate
// AND past the empty-set gate — and marks every document belonging to a row
// past the cap deletable. The same disease as the bug this branch fixes, one
// axis over: a SUCCESSFUL read returning an INCOMPLETE set, feeding an
// IRREVERSIBLE delete.

// A server that holds `total` rows and refuses to hand over more than `cap` of
// them at a time — PostgREST's row cap, which is project configuration and
// cannot be read from a session.
const fakeRows = (total: number, cap: number) => {
  const windows: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    windows.push([from, to]);
    const want = Math.min(to - from + 1, cap);
    const rows = Array.from({ length: Math.max(0, Math.min(want, total - from)) }, (_, i) => ({
      i: from + i,
    }));
    return { rows, error: null, total };
  };
  return { fetchPage, windows };
};

test('FINDING 3 · completeness is proved against the server COUNT, not a page shape', async () => {
  const { fetchPage } = fakeRows(8, 1000);
  const r = await readAllPages(fetchPage, { pageSize: 4, maxPages: 50 });
  assert.equal(r.complete, true);
  assert.equal(r.rows.length, 8, 'every page must be kept, not just the last');
});

test('FINDING 3 · an exactly-full LAST page is still the end, because the count says so', async () => {
  // The old rule needed a SHORT page to stop, so a table holding exactly a
  // whole number of pages was read one extra time. The count settles it.
  const { fetchPage, windows } = fakeRows(8, 1000);
  const r = await readAllPages(fetchPage, { pageSize: 4, maxPages: 50 });
  assert.equal(r.complete, true);
  assert.equal(windows.length, 2, 'the count is reached at page 2; there is no third request');
});

test('FINDING 3 · an empty table is a complete read', async () => {
  const r = await readAllPages(async () => ({ rows: [], error: null, total: 0 }), { pageSize: 4 });
  assert.deepEqual(r, { rows: [], error: null, complete: true });
});

test('FINDING 3 · a page that errors stops the read and is NOT complete', async () => {
  let n = 0;
  const r = await readAllPages(
    async () => {
      n += 1;
      return n === 1
        ? { rows: [{ a: 1 }, { a: 2 }], error: null, total: 99 }
        : { rows: null, error: 'vendor_verifications: permission denied' };
    },
    { pageSize: 2, maxPages: 9 },
  );
  assert.equal(r.error, 'vendor_verifications: permission denied');
  assert.equal(r.complete, false);
});

// ── ROUND 3 · FINDING 4 — A SHORT PAGE WAS NOT PROOF OF THE END ─────────────
//
// The first repair paged until a page came back shorter than `pageSize`. That is
// sound only while `pageSize` is strictly BELOW the server's row cap — and the
// cap is project configuration, absent from `pg_db_role_setting`, unreadable
// from any session. A reviewer probed it: cap 3 against pageSize 4 produced ONE
// call and `complete: true`. Silent truncation feeding an irreversible delete —
// the original bug restored behind the guard written to prevent it.

test('R3-4 · a server cap BELOW the page size no longer ends the read early', async () => {
  const { fetchPage, windows } = fakeRows(10, 3);
  const r = await readAllPages(fetchPage, { pageSize: 4, maxPages: 50 });
  assert.equal(r.complete, true, 'a capped read must still be able to finish');
  assert.equal(r.rows.length, 10, 'and it must not skip a single row');
  assert.deepEqual(
    (r.rows as { i: number }[]).map((x) => x.i),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  // The window must advance by rows ACTUALLY collected, never by a fixed
  // stride — a fixed stride is what skips rows under a cap.
  assert.deepEqual(windows, [
    [0, 3],
    [3, 6],
    [6, 9],
    [9, 12],
  ]);
});

test('R3-4 · a read that reports NO count can never call itself complete', async () => {
  // Fail closed. A read that cannot prove it finished is treated exactly like
  // one that failed.
  const r = await readAllPages(async () => ({ rows: [{ a: 1 }], error: null }), {
    pageSize: 4,
    maxPages: 3,
  });
  assert.equal(r.complete, false);
});

test('R3-4 · a page that returns nothing before the count is reached is NOT complete', async () => {
  const r = await readAllPages(async () => ({ rows: [], error: null, total: 7 }), {
    pageSize: 4,
    maxPages: 3,
  });
  assert.equal(r.complete, false);
});

test('FINDING 3 · a CAPPED reference read switches deletion off page-wide', () => {
  // The whole point: the set is large and non-empty, so neither the error gate
  // nor the empty-set gate can see it. Only completeness can.
  const capped = new Set([DTI]);
  const report = buildVerificationDocsReportFrom({
    keys: capped,
    referenceError: null,
    referencesComplete: false,
    objects: [{ key: GOV, size: 1, lastModified: null }],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, false);
  assert.equal(report.referenceError, REFERENCES_INCOMPLETE_REASON);
});

test('FINDING 3 · and the delete ACTION refuses a capped read too', () => {
  // The page hiding the button is not the gate — the action re-derives at press
  // time, and a hand-posted form reaches it directly.
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([DTI]),
      referenceError: null,
      referencesComplete: false,
    }),
    'refs',
  );
});

// ── THE PAGE-WIDE DECISION, CALLED RATHER THAN READ ─────────────────────────
//
// 4 & 5 · Both guards that used to stand here read `verification-docs-server.ts`
// as TEXT and asserted a string was present, because that module imports
// `server-only` and no `node:test` can load it. A reviewer broke the guarded
// BEHAVIOUR twice while the suite stayed GREEN at `# tests 32 # fail 0`:
//   · B1 — kept both `referencedKeysFrom(` call sites (the asserted count of 2)
//     and discarded their results: `keys.add(key)` 2 → 0. The reference set was
//     empty by construction again — THE ORIGINAL DEFECT, restored.
//   · B2 — replaced the block-reason expression with `const blockReason =
//     referenceError;`, leaving `emptyWhileFilesExist` computed and unused.
//     Both asserted literals still present, gate gone.
// 🔑 THE ANSWER IS TO SPLIT THE PURE RULE OUT, NOT TO MATCH A LONGER STRING.
// Both decisions now live in this module and are CALLED below.

test('4 · the fold is a real fold — every source contributes to one set', () => {
  const keys = collectReferencedKeys([
    { government_id_r2_key: ref(GOV) },
    { dti_certificate: { r2_key: ref(DTI) } },
  ]);
  assert.ok(keys.has(GOV), 'the first source fell out of the fold');
  assert.ok(keys.has(DTI), 'the second source fell out of the fold');
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
  assert.equal(isDeletableVerificationDoc(DTI, keys), false);
});

test('4 · a fold that collects nothing leaves NOTHING deletable', () => {
  // B1's exact end state, asked as a question instead of as a string match.
  const keys = collectReferencedKeys([{ government_id_r2_key: ref(GOV) }]);
  assert.notEqual(keys.size, 0, 'this is the defect: a live ref producing no key');
});

test('5 · the report blocks when it sees files but no references', () => {
  const report = buildVerificationDocsReportFrom({
    keys: new Set<string>(),
    referenceError: null,
    referencesComplete: true,
    objects: [{ key: GOV, size: 1, lastModified: null }],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, false);
  assert.equal(report.referenceError, EMPTY_REFERENCE_SET_REASON);
});

test('5 · an empty bucket with no references is not an alarm', () => {
  const report = buildVerificationDocsReportFrom({
    keys: new Set<string>(),
    referenceError: null,
    referencesComplete: true,
    objects: [],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, true);
  assert.equal(report.referenceError, null);
});

test('5 · a failed reference read wins over every other reason', () => {
  const report = buildVerificationDocsReportFrom({
    keys: new Set<string>(),
    referenceError: 'vendor_verifications: permission denied',
    referencesComplete: false,
    objects: [{ key: GOV, size: 1, lastModified: null }],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referenceError, 'vendor_verifications: permission denied');
});

test('5 · a failed LISTING switches deletion off as well', () => {
  assert.equal(
    verificationDeletionBlockReason({
      referenceError: null,
      referencesComplete: true,
      documentReferenceCount: 3,
      listingError: 'the bucket could not be listed',
      objectCount: 0,
    }),
    LISTING_FAILED_REASON,
  );
});

test('5 · a SHORT LISTING is deliberately NOT a gate, and the asymmetry is the point', () => {
  // Fewer objects listed = fewer deletions offered, and every file still shown
  // is still checked against the full reference set. The DANGEROUS side is the
  // reference side, which is why that one blocks and this one only says so.
  const report = buildVerificationDocsReportFrom({
    keys: new Set([DTI]),
    referenceError: null,
    referencesComplete: true,
    objects: [{ key: GOV, size: 1, lastModified: null }],
    listingError: null,
    listingTruncated: true,
  });
  assert.equal(report.referencesComplete, true, 'a short listing must not refuse a cleanup');
  assert.equal(report.truncated, true, 'but the page must still say the list is partial');
});

test('5 · the normal case still works — nothing above disarmed the feature', () => {
  const report = buildVerificationDocsReportFrom({
    keys: new Set([DTI]),
    referenceError: null,
    referencesComplete: true,
    objects: [
      { key: GOV, size: 1, lastModified: null },
      { key: DTI, size: 1, lastModified: null },
    ],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, true);
  assert.deepEqual(
    report.docs.map((d) => [d.key, d.state]),
    [
      [DTI, 'in_use'],
      [GOV, 'left_over'],
    ],
  );
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([DTI]),
      referenceError: null,
      referencesComplete: true,
    }),
    'ok',
  );
});

// ── The server half is now FETCH ONLY ───────────────────────────────────────
//
// ⚠ HONEST LIMIT, stated rather than left standing as though it were a guard:
// "the untestable module makes no decision" is a claim about ABSENCE, and
// absence has no behaviour to call. The bill that carries it now pins that
// module's WHOLE body rather than enumerating forbidden spellings — see
// `R5 · the server module has NO body of its own beyond the pin` at the foot of
// this file, and the four `R5 ·` behavioural tests beside it that CALL the pure
// entry points the module delegates to.




// ═══════════════════════════════════════════════════════════════════════════
// ROUND 3 · THE ROOT CAUSE — the REAL select shape and the REAL range window
// were exercised by NOTHING
// ═══════════════════════════════════════════════════════════════════════════
//
// Every reference test above hands `readAllPages` a stub that ignores its
// arguments, so three separate defects lived in the query the server module
// built for itself and none of them could be caught:
//   · S-A — `fetchPage(from, from + pageSize - 1)` shifted to
//     `fetchPage(from + 1, from + pageSize)`. The FIRST row of the table is
//     never read; its five documents read `left_over` with Delete beside them,
//     and the read still reports `complete: true`. Suite GREEN, 55/55.
//   · S-F — `.order(pkColumn, { ascending: true })` DELETED, the very line the
//     code's own comment calls "what makes paging meaningful". GREEN, 55/55.
//   · The primary key in the SELECT list — see the canary tests below.
// The query is built in the pure module now, so a fake client can record what
// was actually asked for.

type Recorded = {
  table: string;
  columns: string;
  count: 'exact';
  orderBy: string;
  ascending: boolean;
  windows: [number, number][];
};

/**
 * A fake Supabase client that RECORDS the query and serves rows out of an
 * array, honouring a row cap the way PostgREST does.
 */
function recordingClient(
  rowsByTable: Record<string, unknown[]>,
  opts?: { cap?: number },
): { client: ReferenceQueryClient; log: Recorded[] } {
  const log: Recorded[] = [];
  const cap = opts?.cap ?? 1000;
  const client: ReferenceQueryClient = {
    from(table: string) {
      return {
        select(columns: string, options: { count: 'exact' }) {
          return {
            order(column: string, orderOptions: { ascending: boolean }) {
              return {
                range(from: number, to: number): PromiseLike<ReferenceQueryResult> {
                  const existing = log.find((entry) => entry.table === table);
                  const entry =
                    existing ??
                    (log.push({
                      table,
                      columns,
                      count: options.count,
                      orderBy: column,
                      ascending: orderOptions.ascending,
                      windows: [],
                    }),
                    log[log.length - 1]!);
                  entry.windows.push([from, to]);
                  const all = rowsByTable[table] ?? [];
                  const want = Math.min(to - from + 1, cap);
                  return Promise.resolve({
                    data: all.slice(from, from + Math.max(0, want)),
                    error: null,
                    count: all.length,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, log };
}

const VERIFICATIONS = VERIFICATION_REFERENCE_SOURCES[0] as ReferenceSource;
const APPLICATIONS = VERIFICATION_REFERENCE_SOURCES[1] as ReferenceSource;

// ── R3-1 · THE PR DISARMED ITS OWN CANARY ──────────────────────────────────
//
// Round 2 added the primary key to both reference SELECTs (to order by it) and
// handed the WHOLE ROW to the fold. `collectPlainStrings` keeps every string at
// any depth, so ONE ordinary `vendor_verifications` row whose five `*_r2_key`
// columns are all NULL yielded a set of size 1 — its own UUID. The gate is
// `referenceKeyCount === 0 && objectCount > 0`, so it did not fire, and the page
// offered Delete on a live government ID with verdict `ok`.
// Measured, executing both shapes:
//   MAIN's select shape   -> keyCount=0, gate FIRES,     govDeletable=false
//   BRANCH's select shape -> keyCount=1, gate DOES NOT FIRE, govDeletable=TRUE
// The gate's entire stated job is to catch "the reference reader collected
// nothing" — the original defect this branch exists to fix. From the first
// verification row onward it could never fire again.

const PK = '11111111-2222-4333-8444-555555555555';
const ALL_NULL_ROW = {
  dti_certificate_r2_key: null,
  bir_2303_r2_key: null,
  mayors_permit_r2_key: null,
  government_id_r2_key: null,
  bank_account_proof_r2_key: null,
};

test('R3-1 · the reference SELECT projects NO primary key — only reference columns', () => {
  for (const source of VERIFICATION_REFERENCE_SOURCES) {
    const columns = referenceSelectColumns(source);
    assert.equal(
      columns.includes(source.pkColumn),
      false,
      `${source.table} must not project ${source.pkColumn} — its UUID inflates the reference set`,
    );
    assert.ok(columns.length > 0, `${source.table} must project something`);
  }
  assert.equal(
    referenceSelectColumns(VERIFICATIONS),
    'dti_certificate_r2_key, bir_2303_r2_key, mayors_permit_r2_key, government_id_r2_key, bank_account_proof_r2_key',
  );
  assert.equal(referenceSelectColumns(APPLICATIONS), 'doc_uploads');
});

test('R3-1 · and the QUERY asks for exactly that — recorded off a fake client', async () => {
  const { client, log } = recordingClient({ vendor_verifications: [ALL_NULL_ROW] });
  await readReferenceSource(client, VERIFICATIONS, { pageSize: 500 });
  const entry = log[0]!;
  assert.equal(entry.table, 'vendor_verifications');
  assert.equal(entry.columns.includes('verification_id'), false, 'the PK is back in the SELECT');
  assert.equal(entry.count, 'exact', 'completeness is proved against the server count');
});

test('R3-1 · an all-NULL verification row collects NOTHING, so the canary can still fire', async () => {
  const { client } = recordingClient({ vendor_verifications: [ALL_NULL_ROW] });
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 500 });
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1, 'the row was read');
  const { keys } = collectReferencedKeysDetailed(read.rows);
  assert.equal(keys.size, 0, 'a row that names no document must contribute no key');
  const reason = verificationDeletionBlockReason({
    referenceError: null,
    referencesComplete: read.complete,
    documentReferenceCount: documentReferenceCount(keys),
    listingError: null,
    objectCount: 1,
  });
  assert.equal(reason, EMPTY_REFERENCE_SET_REASON, 'the canary must still fire');
  assert.equal(isDeletableVerificationDoc(GOV, keys), false);
});

test('R3-1 · the canary counts DOCUMENT references, so no stray string can inflate it', () => {
  // Defence in depth, and the real lesson: a set can be non-empty for reasons
  // that protect nothing. Even if a PK, a timestamp or a referee's name found
  // its way back into the fold, the gate must still fire.
  const junk = new Set([PK, '2026-09-20T02:00:00Z', 'a referee named Ana']);
  assert.notEqual(junk.size, 0, 'the set IS non-empty — that is the whole trap');
  assert.equal(documentReferenceCount(junk), 0);
  assert.equal(
    verificationDeletionBlockReason({
      referenceError: null,
      referencesComplete: true,
      documentReferenceCount: documentReferenceCount(junk),
      listingError: null,
      objectCount: 1,
    }),
    EMPTY_REFERENCE_SET_REASON,
  );
  assert.equal(isDeletableVerificationDoc(GOV, junk), false, 'and nothing may be deleted');
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: junk,
      referenceError: null,
      referencesComplete: true,
    }),
    'inuse',
    'the delete ACTION must refuse it too — the page is not the gate',
  );
});

test('R3-1 · a REAL document reference still counts, so nothing above disarmed the feature', () => {
  const live = new Set([DTI, PK]);
  assert.equal(documentReferenceCount(live), 1);
  assert.equal(isDeletableVerificationDoc(GOV, live), true);
});

test('R3-1 · a walk that hits its depth ceiling fails CLOSED instead of silently shrinking', () => {
  // A truncated walk returns a SMALLER set — the dangerous direction. It used
  // to stop silently, and a reviewer used exactly that to score a LIVE document
  // `left_over` with `pageOffersDelete = true`.
  const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: ref(GOV) } } } } } } } } } };
  const shallow = { doc: { r2_key: ref(GOV) } };
  assert.equal(collectPlainStringsDetailed(shallow).truncated, false);
  assert.equal(collectReferencedKeysDetailed([shallow]).truncated, false);
  assert.equal(collectReferencedKeysDetailed([deep]).truncated, true, 'the ceiling must be SAID');
  const reason = verificationDeletionBlockReason({
    referenceError: null,
    // What the server does with a truncated walk: `complete && !truncated`.
    referencesComplete: true && !collectReferencedKeysDetailed([deep]).truncated,
    documentReferenceCount: 5,
    listingError: null,
    objectCount: 1,
  });
  assert.equal(reason, REFERENCES_INCOMPLETE_REASON);
});

// ── R3-2 · THE RANGE WINDOW (S-A) ──────────────────────────────────────────

test('R3-2 · every range window is exact, and the FIRST row is never skipped', async () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({
    ...ALL_NULL_ROW,
    government_id_r2_key: ref(`vendors/v${i}/verification/government_id.jpg`),
  }));
  const { client, log } = recordingClient({ vendor_verifications: rows });
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4 });
  assert.deepEqual(
    log[0]!.windows,
    [
      [0, 3],
      [4, 7],
      [8, 11],
    ],
    'a window shifted by one row skips the first row of the table',
  );
  assert.equal(read.rows.length, 9);
  const { keys } = collectReferencedKeysDetailed(read.rows);
  assert.ok(
    keys.has('vendors/v0/verification/government_id.jpg'),
    "the FIRST row's document fell out of the reference set",
  );
  assert.equal(isDeletableVerificationDoc('vendors/v0/verification/government_id.jpg', keys), false);
});

// ── R3-3 · THE ORDERING (S-F) ──────────────────────────────────────────────

test('R3-3 · the read is ORDERED by the primary key, ascending', async () => {
  for (const source of VERIFICATION_REFERENCE_SOURCES) {
    const { client, log } = recordingClient({ [source.table]: [] });
    await readReferenceSource(client, source, { pageSize: 4 });
    assert.equal(log[0]!.orderBy, source.pkColumn, `${source.table} lost its stable order`);
    assert.equal(log[0]!.ascending, true);
  }
});

test('R3-3 · and a capped server is read to the end through the real query path', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    ...ALL_NULL_ROW,
    government_id_r2_key: ref(`vendors/w${i}/verification/government_id.jpg`),
  }));
  const { client } = recordingClient({ vendor_verifications: rows }, { cap: 3 });
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4 });
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 10, 'a cap below the page size must not truncate the read');
});

test('R3-3 · a failed page names its table and stops the read', async () => {
  const client: ReferenceQueryClient = {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: () =>
            Promise.resolve({
              data: null,
              error: { message: 'permission denied' },
              count: null,
            } as ReferenceQueryResult),
        }),
      }),
    }),
  };
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4 });
  assert.equal(read.error, 'vendor_verifications: permission denied');
  assert.equal(read.complete, false);
});

// ── R3-5 · THE TWO HALVES DIVIDE THE JOB ON THE SAME TEST ──────────────────

test('R3-5 · the bare literal "r2://" lands in exactly ONE half, not neither', () => {
  // Half one includes on `startsWith('r2://') && length > 5`; half two used to
  // exclude on `startsWith('r2://')` alone, so this one value fell through both
  // (measured: half1=0 half2=0). Harmless in itself — a five-character scheme
  // can never equal a `vendors/…` key — but the comment claimed the predicates
  // were identical, and a comment that overstates a safety property is the
  // failure this repo keeps paying for.
  const value = 'r2://';
  const half2 = collectPlainStrings({ slot: value });
  assert.deepEqual(half2, [value], 'the shorter-than-a-scheme value must be kept by half two');
  // And a real ref still belongs to half one only.
  assert.deepEqual(collectPlainStrings({ slot: ref(GOV) }), []);
});

// ── R3-6 · THE "KEPT RAW" CLAIM IS TRUE NOW ────────────────────────────────

test('R3-6 · a value equal to a key that ENDS IN A SPACE keeps its raw form', () => {
  const spaced = `${GOV} `;
  const forms = referenceCandidateForms(spaced);
  assert.ok(forms.includes(spaced), 'the untrimmed value must survive');
  assert.ok(forms.includes(GOV), 'and the trimmed one, as before');
  const keys = new Set(referencedKeysFrom({ government_id: { r2_key: spaced } }));
  assert.ok(keys.has(spaced));
  assert.equal(isDeletableVerificationDoc(spaced, keys), false);
});

test('R3-6 · a protocol-relative //host/key resolves to its key', () => {
  const value = `//media.setnayan.com/${GOV}`;
  const forms = referenceCandidateForms(value);
  assert.ok(forms.includes(GOV), 'the host must not be kept as part of the key');
  assert.ok(forms.includes(value), 'and the raw value still survives — this only ever adds');
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND 4 · THE RULES WERE GUARDED; THE WIRING TO THEM WAS NOT
// ═══════════════════════════════════════════════════════════════════════════
//
// Round 3 moved every rule into this module and guarded each one by CALLING it.
// It then left five seams where the rule is reached — and all five were
// sabotaged with the suite GREEN at `# tests 72 # pass 72 # fail 0`. Every
// needle was counted before → after, and the string each sabotage ADDS was
// counted too, because a mutation that scores 0 → 0 did not land and its green
// means nothing:
//
//   SEAM 1 · `buildVerificationDocsReportFrom` feeding gate 4 the SET SIZE
//     instead of `documentReferenceCount` —
//     `documentReferenceCount: documentReferenceCount(input.keys),` 1 → 0,
//     `documentReferenceCount: input.keys.size,` 0 → 1. GREEN.
//     The exact defect round 3 was raised about, restored one level out: at the
//     ARGUMENT rather than in the rule. All four existing canary tests call
//     `verificationDeletionBlockReason` DIRECTLY and hand it the number
//     themselves, so nothing ever put a set through the real builder.
//   SEAMS 2–4 · the three conditions round 3 put back into
//     `verification-docs-server.ts`, which no `node:test` can load. See
//     `foldReferenceReads` for all three measurements. GREEN, three times.
//   SEAM 5 · `fetchReferencePage`'s `total: res.count ?? null` → `?? 0` —
//     needle 1 → 0, `total: res.count ?? 0,` 0 → 1. GREEN. `readAllPages` then
//     evaluates `rows.length >= 0`, which is ALWAYS true, so a server that
//     reports NO count is declared COMPLETE after one page — precisely the
//     failure its own docblock says it exists to prevent ("no count reported →
//     `complete: false`. FAIL CLOSED"). The existing test for it drives
//     `readAllPages` with an INJECTED STUB, never the real query path.
//
// 🔑 **PROVING IT ON A STUB IS NOT PROVING IT** — the same shape that let round
// 2's S-A and S-F ship green. Every test below drives the REAL seam.

// ── SEAM 1 · THE ARGUMENT THAT FEEDS GATE 4 ────────────────────────────────
//
// A realistic in-progress intake: the vendor has typed their socials and one
// client reference, and has uploaded NO documents. The reference set is
// non-empty (names, phone numbers, social links are all kept — see
// `collectPlainStringsDetailed`, which keeps every string because a missing one
// erases an identity document) and holds ZERO document-shaped references.
//
// That is the one input where set size and `documentReferenceCount` disagree,
// and it is an ordinary Tuesday for a supplier half-way through the form.
function inProgressIntakeKeys(): Set<string> {
  const row = {
    doc_uploads: {
      social_media: buildSlotValue('social_media', {
        r2Ref: null,
        url: null,
        scheduledAt: null,
        social: { facebook: 'https://facebook.com/hiraya.events', website: 'https://hiraya.ph' },
      }),
      client_references: buildSlotValue('client_references', {
        r2Ref: null,
        url: null,
        scheduledAt: null,
        references: [
          { name: 'Marites Villanueva', contact_number: '09171234567', event: 'Wedding', date: '' },
        ],
      }),
    },
  };
  return collectReferencedKeysDetailed([row]).keys;
}

test('R4-1 · an intake with socials and a referee but NO documents has a non-empty set of ZERO documents', () => {
  const keys = inProgressIntakeKeys();
  assert.ok(
    keys.size > 0,
    'the set must be NON-empty, or this test cannot tell set size from the document count',
  );
  assert.equal(
    documentReferenceCount(keys),
    0,
    'not one of those strings is shaped like a document in this bucket',
  );
});

test('R4-1 · SEAM 1 · the REPORT BUILDER feeds gate 4 the document count, not the set size', () => {
  const report = buildVerificationDocsReportFrom({
    keys: inProgressIntakeKeys(),
    referenceError: null,
    referencesComplete: true,
    objects: [obj(GOV)],
    listingError: null,
    listingTruncated: false,
  });
  // Under `documentReferenceCount: input.keys.size` this is TRUE and the page
  // renders Delete beside a live government ID on the "Left over" shelf.
  assert.equal(
    report.referencesComplete,
    false,
    'a set of nothing but names and links must not authorise a delete',
  );
  assert.equal(report.referenceError, EMPTY_REFERENCE_SET_REASON);
});

test('R4-1 · SEAM 1 · and the delete ACTION refuses that same government ID', () => {
  const keys = inProgressIntakeKeys();
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: keys,
      referenceError: null,
      referencesComplete: true,
    }),
    'inuse',
    'the per-file gate counts documents too — neither half is inflatable by a social link',
  );
});

test('R4-1 · SEAM 1 · a REAL document reference still authorises the page — nothing above disarmed it', () => {
  const report = buildVerificationDocsReportFrom({
    keys: new Set([DTI]),
    referenceError: null,
    referencesComplete: true,
    objects: [obj(GOV), obj(DTI)],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, true);
  assert.equal(report.referenceError, null);
  assert.equal(report.docs.find((d) => d.key === DTI)?.state, 'in_use');
  assert.equal(report.docs.find((d) => d.key === GOV)?.state, 'left_over');
});

// ── SEAMS 2–4 · THE FOLD, WHICH USED TO LIVE WHERE NOTHING COULD CALL IT ────

const completeRead = (rows: unknown[]): ReferenceRead => ({ rows, error: null, complete: true });

test('R4-2 · SEAM 2 · a source that RAISED yields the error, an EMPTY set and complete:false', () => {
  const folded = foldReferenceReads([
    completeRead([{ dti_certificate_r2_key: DTI }]),
    { rows: [], error: 'vendor_verification_applications: permission denied', complete: false },
  ]);
  assert.equal(folded.error, 'vendor_verification_applications: permission denied');
  assert.equal(folded.complete, false);
  assert.equal(
    folded.keys.size,
    0,
    'an error returns NOTHING — a partial set must never be mistaken for a small one',
  );
});

test('R4-3 · SEAM 3 · ONE incomplete source makes the WHOLE fold incomplete', () => {
  const folded = foldReferenceReads([
    completeRead([{ dti_certificate_r2_key: DTI }]),
    { rows: [{ doc_uploads: null }], error: null, complete: false },
  ]);
  assert.equal(folded.error, null, 'nothing raised — which is exactly why completeness must carry it');
  assert.equal(folded.complete, false, 'a capped or count-less read cannot authorise a delete');
  // And it reaches the page: a successful-but-short read switches deletion off.
  const report = buildVerificationDocsReportFrom({
    keys: folded.keys,
    referenceError: folded.error,
    referencesComplete: folded.complete,
    objects: [obj(GOV)],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, false);
  assert.equal(report.referenceError, REFERENCES_INCOMPLETE_REASON);
});

test('R4-4 · SEAM 4 · a walk that hits its DEPTH CEILING makes the fold incomplete', () => {
  // Deeper than `collectPlainStringsDetailed`'s ceiling of 8, so the walk stops
  // and the reference set comes back SHORT with nothing raised.
  let deep: unknown = { r2_key: DTI };
  for (let i = 0; i < 12; i += 1) deep = { nested: deep };
  const folded = foldReferenceReads([completeRead([{ doc_uploads: deep }])]);
  assert.equal(folded.error, null, 'a truncated walk raises nothing — that is the danger');
  assert.equal(
    folded.complete,
    false,
    'a set that stopped short must switch deletion off, not shrink silently',
  );
});

test('R4-5 · the fold still WORKS — two complete sources become one set', () => {
  const folded = foldReferenceReads([
    completeRead([{ dti_certificate_r2_key: DTI }]),
    completeRead([{ doc_uploads: { government_id: { r2_key: GOV, uploaded_at: 'x' } } }]),
  ]);
  assert.equal(folded.error, null);
  assert.equal(folded.complete, true);
  assert.ok(folded.keys.has(DTI), 'the column source contributed');
  assert.ok(folded.keys.has(GOV), 'the jsonb source contributed');
  assert.equal(documentReferenceCount(folded.keys), 2);
});

test('R4-5 · an empty estate folds to a complete read of nothing — and the page still refuses', () => {
  const folded = foldReferenceReads([completeRead([]), completeRead([])]);
  assert.equal(folded.complete, true, 'reading two empty tables IS a complete read');
  assert.equal(folded.keys.size, 0);
  // Gate 4, doing its job: no reference at all while the bucket holds a file.
  const report = buildVerificationDocsReportFrom({
    keys: folded.keys,
    referenceError: folded.error,
    referencesComplete: folded.complete,
    objects: [obj(GOV)],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referenceError, EMPTY_REFERENCE_SET_REASON);
});

// ── SEAM 5 · THE COUNT, THROUGH THE REAL QUERY PATH ────────────────────────
//
// The existing "a read that reports NO count can never call itself complete"
// test hands `readAllPages` a stub returning `{ rows, error }` with no `total`
// field at all. `fetchReferencePage` — the thing that actually decides what
// `total` is — is not on that path, so `total: res.count ?? null` was never
// exercised and `?? 0` sailed through GREEN.
//
// This fake is a Supabase client, driven through `readReferenceSource` →
// `readAllPages` → `fetchReferencePage`, and it reports `count: null` the way
// PostgREST does when it cannot produce an exact count.
function countlessClient(rows: unknown[]): ReferenceQueryClient {
  return {
    from() {
      return {
        select() {
          return {
            order() {
              return {
                range(from: number, to: number): PromiseLike<ReferenceQueryResult> {
                  return Promise.resolve({
                    data: rows.slice(from, to + 1),
                    error: null,
                    count: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('R4-6 · SEAM 5 · a server that reports NO count is never complete — through the real query', async () => {
  const client = countlessClient([{ dti_certificate_r2_key: DTI }]);
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4, maxPages: 10 });
  assert.equal(read.error, null, 'nothing failed — the read simply cannot prove it finished');
  assert.equal(
    read.complete,
    false,
    'no count reported must FAIL CLOSED; under `?? 0` this reports complete after one page',
  );
  assert.ok(read.rows.length >= 1, 'the rows were still read — this is a completeness verdict');
});

test('R4-6 · SEAM 5 · and an unprovable read switches deletion off page-wide', async () => {
  const client = countlessClient([{ dti_certificate_r2_key: DTI }]);
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4, maxPages: 10 });
  const folded = foldReferenceReads([read]);
  assert.equal(folded.complete, false);
  const report = buildVerificationDocsReportFrom({
    keys: folded.keys,
    referenceError: folded.error,
    referencesComplete: folded.complete,
    objects: [obj(GOV), obj(DTI)],
    listingError: null,
    listingTruncated: false,
  });
  assert.equal(report.referencesComplete, false);
  assert.equal(report.referenceError, REFERENCES_INCOMPLETE_REASON);
});

test('R4-6 · a server that DOES report a count still completes — the fail-closed arm is not a block', async () => {
  const { client } = recordingClient({ vendor_verifications: [{ dti_certificate_r2_key: DTI }] });
  const read = await readReferenceSource(client, VERIFICATIONS, { pageSize: 4 });
  assert.equal(read.complete, true, 'an exact count is what proves the read finished');
  assert.equal(read.rows.length, 1);
});

// ── THE CEILING THAT WAS DECIDED, NOT INHERITED ────────────────────────────

test('docs-inflation · a stored LINK whose path looks like a key DOES count — stated, not implied', () => {
  // `referenceCandidateForms` rule 4 derives a key from any http(s) path at its
  // first `vendors/`, so this social link inflates gate 4's number without
  // protecting a real file. Narrowing it needs PROVENANCE the fold deliberately
  // does not carry — see `documentReferenceCount` for why that trade was
  // refused. This test PINS the ceiling so it is a stated limit rather than an
  // unnoticed one, and so narrowing it later is a deliberate act.
  const keys = collectReferencedKeysDetailed([
    {
      doc_uploads: {
        social_media: {
          website: `https://example.test/${GOV}`,
        },
      },
    },
  ]).keys;
  assert.equal(
    documentReferenceCount(keys),
    1,
    'the URL-derived form is counted — this is the accepted ceiling, not a passing grade',
  );
  // ⚖ AND THE PRIMARY GATE IS UNAFFECTED, which is what bounds the risk: an
  // EXACT match cannot be inflated by anything.
  assert.equal(
    isDeletableVerificationDoc(GOV, keys),
    false,
    'the file that link names is still refused, exactly',
  );
  assert.equal(
    isDeletableVerificationDoc(DTI, keys),
    true,
    'and a file nothing names is still deletable — the ceiling is narrow, not a hole',
  );
});

// ── ROUND 5 · THE BILL OVER THE UNTESTABLE MODULE IS DERIVED, NOT ENUMERATED ─
//
// 🛑 **ROUND 4'S BILL WAS A DENY-LIST OF THREE LITERALS (`if (`, `complete =`,
// `&&`) AND TWO REVIEWERS EACH WALKED PAST IT ON THEIR FIRST TRY.** This repo's
// own rule says a deny-list is a bill you have to keep paying, and this page has
// now paid it four times. What got past it:
//   · X1 — the fold's verdict destructured and re-shaped on the way out, using
//     `||` so all three forbidden literals miss it. Needle 1 → 0, added 0 → 1,
//     suite GREEN at 85/85.
//   · X2 — `referencesComplete: complete` → `referencesComplete: Boolean(1)`,
//     one token away from the exact literal `referencesComplete: true` that the
//     bill DID forbid. Needle 1 → 0, added 0 → 1, GREEN at 85/85.
//   · X3 — `referenceError,` → `referenceError: null,`. GREEN at 85/85.
//   · X4 — `foldReferenceReads(reads)` → `foldReferenceReads([])`. GREEN.
//
// ⚖ **SO THE BILL IS NOW A WHITELIST OF THE WHOLE BODY, NOT A LIST OF FORBIDDEN
// SPELLINGS.** The module's entire comment-stripped, whitespace-normalised text
// is pinned against `SERVER_BODY_PIN` below. There is no "new spelling" to find:
// ANY edit fails, and whoever makes it has to update the pin deliberately, which
// is the point — the design rule for that file is that nothing goes in it.
//
// ⚠ WHAT THIS STILL CANNOT CATCH, stated rather than implied: an edit made
// *together with* a matching edit to the pin. That is a deliberate act with a
// diff a reviewer reads, which is the strongest thing available for a module no
// test can load. It also does NOT prove the two calls below behave — the four
// `R5 ·` tests underneath do that, by CALLING the pure entry points the module
// now delegates to.

/** Comment-stripped, whitespace-normalised — the shape both sides are compared in. */
function normaliseModuleBody(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The ENTIRE body `verification-docs-server.ts` is allowed to have.
 *
 * 🔑 Read it as the design rule it encodes: a client, a listing closure, and one
 * `return` each. No loop, no condition, no destructuring, no object literal, no
 * `try/catch`. Every one of those has been a live defect on this page.
 */
const SERVER_BODY_PIN = `
import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VERIFICATION_PREFIX,
  buildVerificationDocsReportWith,
  readAllReferenceSources,
  type ReferenceQueryClient,
  type VerificationDocsReport,
} from '@/lib/verification-docs';

export type { VerificationDocsReport };

const REFERENCE_PAGE_SIZE = 500;

export async function referencedVerificationKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
  complete: boolean;
}> {
  return readAllReferenceSources(createAdminClient() as unknown as ReferenceQueryClient, {
    pageSize: REFERENCE_PAGE_SIZE,
  });
}

export async function buildVerificationDocsReport(): Promise<VerificationDocsReport> {
  return buildVerificationDocsReportWith({
    client: createAdminClient() as unknown as ReferenceQueryClient,
    listObjects: () =>
      r2List({ bucket: R2_BUCKETS.vendorVerification, prefix: VERIFICATION_PREFIX }),
    pageSize: REFERENCE_PAGE_SIZE,
  });
}
`;

test('R5 · the server module delegates — the pure entry points are named there', () => {
  const SERVER = readFileSync(join(HERE, 'verification-docs-server.ts'), 'utf8');
  const stripped = normaliseModuleBody(SERVER);
  // Positive first, purely so a failure reads as a sentence before the exact
  // pin below prints a diff of the whole file.
  for (const helper of ['readAllReferenceSources(', 'buildVerificationDocsReportWith(']) {
    assert.ok(stripped.includes(helper), `${helper} must be where the work comes from`);
  }
  // And the two shapes this page shipped broken, kept as named regressions.
  assert.doesNotMatch(
    stripped,
    /typeof value === 'string'/,
    'the string-only filter is the bug; it must not come back',
  );
  assert.doesNotMatch(
    stripped,
    /referencesComplete/,
    'completeness must be MEASURED by the paging, never named here',
  );
});

test('R5 · the server module has NO body of its own beyond the pin', () => {
  const SERVER = readFileSync(join(HERE, 'verification-docs-server.ts'), 'utf8');
  assert.equal(
    normaliseModuleBody(SERVER),
    normaliseModuleBody(SERVER_BODY_PIN),
    [
      'verification-docs-server.ts is a module no node:test can load, so its whole',
      'body is pinned rather than a list of forbidden spellings being enumerated.',
      'If you MEANT to change it, update SERVER_BODY_PIN in the same commit and say',
      'in the PR what new thing that file now decides — five rounds of this page say',
      'the answer is usually that it should live in verification-docs.ts instead.',
    ].join(' '),
  );
});

// ── ROUND 5 · THE LOOP AND THE ASSEMBLY, CALLED RATHER THAN READ ────────────

test('R5 · EVERY reference source is actually read — the worst seam on this page', async () => {
  // X0: `for (const source of VERIFICATION_REFERENCE_SOURCES)` →
  // `.slice(0, 1)`, suite GREEN at 85/85, a live government ID offered for
  // permanent deletion. Asked here as a question instead of as a string match.
  const { client, log } = recordingClient({
    vendor_verifications: [ALL_NULL_ROW],
    vendor_verification_applications: [{ doc_uploads: { government_id: { r2_key: ref(GOV) } } }],
  });
  const read = await readAllReferenceSources(client, { pageSize: 500 });
  const tables = log.map((entry) => entry.table).sort();
  assert.deepEqual(
    tables,
    ['vendor_verification_applications', 'vendor_verifications'],
    'a source that is never queried is a source whose documents all read left_over',
  );
  assert.equal(
    tables.length,
    VERIFICATION_REFERENCE_SOURCES.length,
    'every declared reference source must be asked for, not a prefix of them',
  );
  assert.ok(read.keys.has(GOV), 'the in-progress intake source fell out of the read');
  assert.equal(read.complete, true);
  assert.equal(read.error, null);
});

test('R5 · dropping the in-progress source makes a LIVE government ID deletable', async () => {
  // The harm X0 causes, driven end to end: with one legacy row carrying a real
  // key the empty-set canary stays quiet, so nothing else catches it.
  const rows = {
    vendor_verifications: [{ ...ALL_NULL_ROW, dti_certificate_r2_key: ref(DTI) }],
    vendor_verification_applications: [
      { doc_uploads: { government_id: { r2_key: ref(GOV) } } },
    ],
  };
  const both = await readAllReferenceSources(recordingClient(rows).client, { pageSize: 500 });
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: both.keys,
      referenceError: both.error,
      referencesComplete: both.complete,
    }),
    'inuse',
    'reading both sources must protect the government ID',
  );
  // And the sabotage's end state, so the failure above has a stated meaning.
  const oneOnly = foldReferenceReads([
    await readReferenceSource(recordingClient(rows).client, VERIFICATIONS, { pageSize: 500 }),
  ]);
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: oneOnly.keys,
      referenceError: oneOnly.error,
      referencesComplete: oneOnly.complete,
    }),
    'ok',
    'this is the defect: one source read, the other document offered for deletion',
  );
});

test('R5 · a source that RAISES stops the whole read, through the real loop', async () => {
  const client: ReferenceQueryClient = {
    from(table: string) {
      return {
        select() {
          return {
            order() {
              return {
                range(): PromiseLike<ReferenceQueryResult> {
                  return Promise.resolve(
                    table === 'vendor_verification_applications'
                      ? { data: null, error: { message: 'permission denied' }, count: null }
                      : { data: [ALL_NULL_ROW], error: null, count: 1 },
                  );
                },
              };
            },
          };
        },
      };
    },
  };
  const read = await readAllReferenceSources(client, { pageSize: 500 });
  assert.equal(read.complete, false);
  assert.match(read.error ?? '', /vendor_verification_applications: permission denied/);
  assert.equal(read.keys.size, 0, 'a refused read must return NOTHING, never a partial set');
});

test('R5 · the whole report is assembled in the pure module, listing failure included', async () => {
  const rows = {
    vendor_verifications: [{ ...ALL_NULL_ROW, dti_certificate_r2_key: ref(DTI) }],
    vendor_verification_applications: [{ doc_uploads: {} }],
  };
  const listed = {
    objects: [obj(GOV), obj(DTI)],
    truncated: false,
  };
  const ok = await buildVerificationDocsReportWith({
    client: recordingClient(rows).client,
    listObjects: async () => listed,
    pageSize: 500,
  });
  assert.equal(ok.referencesComplete, true, 'the normal case must still offer a cleanup');
  assert.deepEqual(
    ok.docs.map((d) => [d.key, d.state]),
    [
      [DTI, 'in_use'],
      [GOV, 'left_over'],
    ],
  );

  // X3/X4 lived on these lines. A listing that THROWS must switch deletion off
  // rather than reporting an empty bucket.
  const blocked = await buildVerificationDocsReportWith({
    client: recordingClient(rows).client,
    listObjects: async () => {
      throw new Error('r2 said no');
    },
    pageSize: 500,
  });
  assert.equal(blocked.referencesComplete, false);
  assert.equal(blocked.referenceError, LISTING_FAILED_REASON);
  assert.equal(blocked.listingError, 'r2 said no');

  // And a reference read that RAISED must beat everything, with an empty set.
  const refused = await buildVerificationDocsReportWith({
    client: {
      from() {
        return {
          select() {
            return {
              order() {
                return {
                  range: (): PromiseLike<ReferenceQueryResult> =>
                    Promise.resolve({ data: null, error: { message: 'nope' }, count: null }),
                };
              },
            };
          },
        };
      },
    },
    listObjects: async () => listed,
    pageSize: 500,
  });
  assert.equal(refused.referencesComplete, false);
  assert.match(refused.referenceError ?? '', /nope/);

  // X1/X2 lived on `referencesComplete: complete` in the argument object below
  // this line. A read that SUCCEEDS but cannot prove it finished raises no
  // error for gate 1 and produces a non-empty set for gate 4, so gate 2 is the
  // only thing standing between a capped read and an irreversible delete — and
  // gate 2 is reachable ONLY through this argument. Drive it end to end.
  const unprovable = await buildVerificationDocsReportWith({
    client: countlessClient([{ dti_certificate_r2_key: ref(DTI) }]),
    listObjects: async () => listed,
    pageSize: 4,
    maxPages: 10,
  });
  assert.equal(
    unprovable.referencesComplete,
    false,
    'a read that cannot prove it finished must switch deletion off page-wide',
  );
  assert.equal(unprovable.referenceError, REFERENCES_INCOMPLETE_REASON);
  assert.equal(
    verificationDeleteVerdict({
      key: GOV,
      referenced: new Set([DTI]),
      referenceError: unprovable.referenceError,
      referencesComplete: unprovable.referencesComplete,
    }),
    'refs',
    'and the delete action must refuse on the same footing',
  );
});
