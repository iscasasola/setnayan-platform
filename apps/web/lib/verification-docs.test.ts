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
  isDeletableVerificationDoc,
  parseVerificationKey,
} from './verification-docs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = readFileSync(
  join(HERE, '..', 'app', 'admin', 'verification-docs', 'actions.ts'),
  'utf8',
);

const VP = '51858369-2970-466b-99a2-a6713a7ea1bb';
const GOV = `vendors/${VP}/verification/government_id.jpg`;
const DTI = `vendors/${VP}/verification/dti_certificate.pdf`;

const obj = (key: string) => ({ key, size: 1024, lastModified: null });

// ── The prefix comes from the UPLOAD CALL SITES ─────────────────────────────
// A previous media page derived its allowlist from module names and matched
// ZERO objects. These are the real shapes written by
// vendor-dashboard/verify/page.tsx and shop/_components/docs-body.tsx.

test('a real upload key yields its vendor and its slot', () => {
  assert.deepEqual(parseVerificationKey(GOV), {
    vendorProfileId: VP,
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
