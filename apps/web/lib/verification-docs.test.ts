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
  classifyVerificationDocs,
  collectPlainStrings,
  isDeletableVerificationDoc,
  parseVerificationKey,
  referencedKeysFrom,
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
  const fn = ACTIONS.slice(ACTIONS.indexOf('export async function deleteVerificationDoc'));
  const guard = fn.slice(fn.indexOf('const { keys, error }'), fn.indexOf('r2Delete'));
  assert.match(guard, /if \(error\)/, 'the read error must be checked');
  assert.match(guard, /redirect\('\/admin\/verification-docs\?error=refs'\)/);
});

test('the delete gate is the shared predicate, not a re-typed condition', () => {
  const fn = ACTIONS.slice(ACTIONS.indexOf('export async function deleteVerificationDoc'));
  assert.match(fn, /isDeletableVerificationDoc\(key, keys\)/);
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

test('the report refuses deletion when it sees files but no references', () => {
  const SERVER = readFileSync(join(HERE, 'verification-docs-server.ts'), 'utf8');
  const stripped = SERVER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(
    stripped,
    /keys\.size === 0 && objects\.length > 0/,
    'buildVerificationDocsReport must block on an empty set while the bucket has files',
  );
  assert.match(stripped, /referencesComplete: blockReason === null/);
});

// ── The server half reads through the shared helper, both sources ───────────

test('both reference sources go through referencedKeysFrom', () => {
  const SERVER = readFileSync(join(HERE, 'verification-docs-server.ts'), 'utf8');
  const stripped = SERVER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const calls = stripped.match(/referencedKeysFrom\(/g) ?? [];
  assert.equal(calls.length, 2, `expected one call per source, found ${calls.length}`);
  assert.doesNotMatch(
    stripped,
    /typeof value === 'string'/,
    'the string-only filter is the bug; it must not come back',
  );
});
