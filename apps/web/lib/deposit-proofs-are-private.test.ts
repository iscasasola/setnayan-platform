/**
 * 🔒 A COUPLE'S DEPOSIT RECEIPT IS A PRIVATE FILE (N5, 2026-09-11 · found by N4).
 *
 * Both deposit writers in `vendors/actions.ts` (the lock that carries a
 * downpayment, and "record a deposit") uploaded the screenshot under
 * `deposit-proof/<eventId>/`, a prefix the router sends to the PUBLIC media
 * bucket, and stored its permanent public URL — a bank or GCash screenshot
 * readable by anyone the link reached. And every reader rendered the stored
 * value as an `href`, which the couple's own session can write (measured in the
 * replay: `https://wa.me/…` accepted) — a "View proof" link on the SUPPLIER'S
 * page that leaves the app.
 *
 * Pinned here:
 *   1 · the folder routes to the PRIVATE bucket by its prefix alone, and the
 *       read policy accepts exactly what the writer stores — nothing else;
 *   2 · the writers use the one private uploader and store its REF;
 *   3 · the uploader refuses the public fallback and never stores a URL, and
 *       the reader checks the policy BEFORE it signs (no legacy pass-through);
 *   4 · every surface that reads the column shows it only through that reader.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { bucketForPrefix } from '@/lib/bucket-routing';
import { depositProofFolder, depositProofPolicy, parseClientRef } from '@/lib/r2-client-ref';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const EVENT = '4d1f6c2e-8a3b-4c5d-9e7f-0a1b2c3d4e5f';
const OTHER = '9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4';
/** Exactly what `uploadPublicAsset` + `encodeR2Ref` produce for this folder. */
const WRITTEN = `r2://setnayan-thread-files/${depositProofFolder(EVENT)}/0b6c6f1e-2f4a-4c7e-9d51-3a1f0e9b7c21-gcash.jpg`;

/* ── 1 · where it lives, and what the reader accepts ─────────────────────── */

test('the deposit folder routes to the PRIVATE bucket by its prefix alone', () => {
  assert.equal(bucketForPrefix(depositProofFolder(EVENT)), 'threadFiles');
  // The old folder is what went public — say so, so nobody moves it back.
  assert.equal(bucketForPrefix(`deposit-proof/${EVENT}`), 'media');
});

test('the read policy accepts what the writer stores, and nothing else', () => {
  const policy = depositProofPolicy(EVENT);
  assert.ok(parseClientRef(WRITTEN, policy), 'the reader refuses the writer’s own ref — no receipt could ever show');
  const refused = [
    'https://wa.me/639171234567',
    'viber://chat?number=639171234567',
    `https://media.setnayan.com/deposit-proof/${EVENT}/x.jpg`,
    WRITTEN.replace(EVENT, OTHER),
    WRITTEN.replace('setnayan-thread-files', 'setnayan-vendor-verification'),
    WRITTEN.replace('setnayan-thread-files', 'setnayan-media'),
    `r2://setnayan-thread-files/payment-proof/events/${EVENT}/receipt.jpg`,
    `r2://setnayan-thread-files/${depositProofFolder(EVENT)}/../../${OTHER}/deposit/x.jpg`,
    `r2://setnayan-thread-files/${depositProofFolder(EVENT)}/`,
  ];
  for (const v of refused) assert.equal(parseClientRef(v, policy), null, `accepted ${v}`);
  console.log(`# deposit-proof policy: 1 accepted, ${refused.length} refused`);
});

/* ── 2 · the writers ──────────────────────────────────────────────────────── */

const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';

test('both deposit writers use the private uploader and store its ref', () => {
  const s = src(ACTIONS);
  assert.equal((s.match(/\buploadDepositProof\(eventId, proofEntry\)/g) ?? []).length, 2);
  assert.doesNotMatch(s, /[`'"]deposit-proof\//, 'the public-bucket folder is back in the deposit writers');
  assert.doesNotMatch(s, /DEPOSIT_PROOF_PATH_PREFIX/);
  // What reaches the column is the uploader's ref, never a public URL.
  assert.match(s, /if \(up\.ok\) proofUrl = up\.ref;/);
  assert.match(s, /proofUrl = uploadResult\.ref;/);
  assert.doesNotMatch(s, /proofUrl = [a-zA-Z]+\.publicUrl/);
});

/* ── 3 · the one uploader and the one reader ─────────────────────────────── */

function fnBody(s: string, name: string): string {
  const start = s.search(new RegExp(`export async function ${name}\\(`));
  assert.ok(start >= 0, `${name} is gone`);
  const next = s.slice(start + 1).search(/\nexport /);
  return next < 0 ? s.slice(start) : s.slice(start, start + 1 + next);
}

test('the uploader writes the private folder, refuses the public fallback, and stores a REF', () => {
  const body = fnBody(src('lib/deposit-proof.server.ts'), 'uploadDepositProof');
  assert.match(body, /uploadPublicAsset\(\{ pathPrefix: depositProofFolder\(eventId\), file \}\)/);
  assert.match(body, /if \(up\.bucket !== R2_BUCKETS\.threadFiles\)/);
  assert.match(body, /const ref = encodeR2Ref\(up\.bucket, up\.key\);/);
  assert.match(body, /parseClientRef\(ref, depositProofPolicy\(eventId\)\)/);
  assert.doesNotMatch(body, /publicUrl/, 'a receipt must never be stored as a URL');
});

test('the reader checks the policy BEFORE it signs — no legacy pass-through', () => {
  const body = fnBody(src('lib/deposit-proof.server.ts'), 'depositProofDisplayUrl');
  const check = body.indexOf('if (!parseClientRef(value.trim(), policy)) return null;');
  const sign = body.indexOf('displayUrlForPrivateStoredAsset(value, policy)');
  assert.ok(check > 0, 'the reader no longer refuses what its policy does not admit');
  assert.ok(sign > check, 'the reader signs before (or without) the policy check');
  assert.match(body, /const policy = depositProofPolicy\(eventId\);/);
});

/* ── 4 · every reader of the column ───────────────────────────────────────── */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Files that select the column in a query string. */
const SELECTS_IT = /['"`][^'"`\n]*\bdeposit_proof_url\b[^'"`\n]*['"`]/;

test('every surface that reads the receipt shows it only through the scoped reader', () => {
  const readers: string[] = [];
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const rel = relative(WEB, abs);
    if (rel === ACTIONS || rel === 'lib/deposit-proof.server.ts') continue;
    const s = stripComments(readFileSync(abs, 'utf8'));
    if (!SELECTS_IT.test(s)) continue;
    readers.push(rel);
    assert.match(s, /\bdepositProofDisplayUrl\(/, `${rel} reads deposit_proof_url but never passes it through depositProofDisplayUrl`);
  }
  assert.deepEqual(readers.sort(), [
    'app/admin/disputes/_components/deposit-disputes-section.tsx',
    'app/admin/force-majeure/[flagId]/page.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx',
    'app/vendor-dashboard/clients/[eventId]/page.tsx',
    'lib/vendor-overview.ts',
  ]);
  // No surface puts the stored value straight into a link.
  for (const rel of readers) {
    assert.doesNotMatch(src(rel), /href=\{\s*(?:r|ev|vendor|row)\.deposit_proof_url\s*\}/, `${rel} links the raw stored value`);
  }
});

test('the scoped reader is scoped by the ROW’s event, on every surface', () => {
  const pins: Array<[string, RegExp]> = [
    ['app/admin/disputes/_components/deposit-disputes-section.tsx', /depositProofDisplayUrl\(r\.deposit_proof_url, r\.event_id\)/],
    ['app/admin/force-majeure/[flagId]/page.tsx', /depositProofDisplayUrl\(vendor\.deposit_proof_url, vendor\.event_id\)/],
    ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx', /depositProofDisplayUrl\(ev\.deposit_proof_url, ev\.event_id\)/],
    ['app/vendor-dashboard/clients/[eventId]/page.tsx', /depositProofDisplayUrl\(completionRow\.deposit_proof_url, eventId\)/],
    ['lib/vendor-overview.ts', /depositProofDisplayUrl\(r\.deposit_proof_url, r\.event_id\)/],
  ];
  for (const [rel, re] of pins) assert.match(src(rel), re, `${rel} no longer scopes the receipt to its own event`);
});
