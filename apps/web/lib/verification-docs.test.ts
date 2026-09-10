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
  // The half-fix: pull `.r2_key` out and insert it as-is. Still deletable.
  const halfFixed = new Set([ref(DTI)]);
  assert.equal(isDeletableVerificationDoc(DTI, halfFixed), true);
  // The whole fix.
  const whole = new Set(referencedKeysFrom({ dti_certificate: { r2_key: ref(DTI) } }));
  assert.equal(isDeletableVerificationDoc(DTI, whole), false);
});

test('a value neither form recognises is kept raw and can still mark a file in use', () => {
  const weird = '  ../../vendors/odd//thing.bin  ';
  const keys = new Set(referencedKeysFrom({ mystery: { r2_key: weird } }));
  assert.ok(keys.has(weird.trim()), 'an unresolvable value must survive, trimmed');
  assert.equal(isDeletableVerificationDoc(weird.trim(), keys), false);
});

test('collectPlainStrings keeps every NON-ref string, at any depth, trimmed', () => {
  const found = new Set(
    collectPlainStrings({ a: [' x ', { b: 'y' }], c: null, d: '', e: ref(GOV) }),
  );
  assert.deepEqual([...found].sort(), ['x', 'y']);
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

test('FINDING 3 · a page that comes back exactly FULL is never the end', () => {
  // The cap's signature. A limit that is never asked past looks identical to a
  // table that happens to hold exactly that many rows.
  let calls = 0;
  return readAllPages(
    async () => {
      calls += 1;
      return { rows: Array.from({ length: 4 }, (_, i) => ({ i })), error: null };
    },
    { pageSize: 4, maxPages: 3 },
  ).then((r) => {
    assert.equal(calls, 3, 'a full page must be followed by a request for the next one');
    assert.equal(r.complete, false, 'a read that never reached a short page is NOT complete');
  });
});

test('FINDING 3 · only a SHORT page proves the end', async () => {
  const pages = [4, 4, 1];
  let n = 0;
  const r = await readAllPages(
    async () => ({ rows: Array.from({ length: pages[n++] ?? 0 }, (_, i) => ({ i })), error: null }),
    { pageSize: 4, maxPages: 50 },
  );
  assert.equal(r.complete, true);
  assert.equal(r.rows.length, 9, 'every page must be kept, not just the last');
  assert.equal(n, 3, 'and it must stop at the short page rather than reading forever');
});

test('FINDING 3 · an empty first page is a complete read of an empty table', async () => {
  const r = await readAllPages(async () => ({ rows: [], error: null }), { pageSize: 4 });
  assert.deepEqual(r, { rows: [], error: null, complete: true });
});

test('FINDING 3 · a page that errors stops the read and is NOT complete', async () => {
  let n = 0;
  const r = await readAllPages(
    async () => {
      n += 1;
      return n === 1
        ? { rows: [{ a: 1 }, { a: 2 }], error: null }
        : { rows: null, error: 'vendor_verifications: permission denied' };
    },
    { pageSize: 2, maxPages: 9 },
  );
  assert.equal(r.error, 'vendor_verifications: permission denied');
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
      referenceKeyCount: 3,
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
// this ONE assertion still reads source, because "the untestable module makes no
// decision" is a claim about ABSENCE and absence has no behaviour to call. It is
// a structural bill, not a behavioural guard — everything the module used to
// decide is covered by the tests above, which CALL it.

test('the server module decides nothing — it fetches and delegates', () => {
  const SERVER = readFileSync(join(HERE, 'verification-docs-server.ts'), 'utf8');
  const stripped = SERVER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const helper of [
    'collectReferencedKeys(',
    'buildVerificationDocsReportFrom(',
    'readAllPages(',
  ]) {
    assert.ok(stripped.includes(helper), `${helper} must be where the decision comes from`);
  }
  assert.doesNotMatch(
    stripped,
    /typeof value === 'string'/,
    'the string-only filter is the bug; it must not come back',
  );
  // Both reference SELECTs must be RANGED. An unbounded one is finding 3.
  const ranges = stripped.match(/\.range\(/g) ?? [];
  assert.equal(ranges.length, 1, 'the one shared reader ranges; a second, unranged query is the bug');
  assert.doesNotMatch(
    stripped,
    /referencesComplete: true/,
    'completeness must be MEASURED by the paging, never asserted',
  );
});

