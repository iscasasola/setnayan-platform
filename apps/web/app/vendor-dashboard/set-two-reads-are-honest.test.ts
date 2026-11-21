/**
 * set-two-reads-are-honest.test.ts — WHEN A READ FAILS, THE PAGE STAYS, AND SAYS SO, on the eight supplier pages of
 * "set two" (owner-approved 21 Nov 2026, DECISION_LOG "STOP ADDING AFTER THE CAKE MAKER — BUILD AND FIX ONLY" point 2;
 * drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html`, the nine frames marked
 * "Honest state · new" and the shared "When a read fails" frame).
 *
 * The same disease `reads-are-honest.test.ts` pins one layer down: a read that FAILED rendered identically to a read
 * that found nothing — here as a "not found" page, a redirect back to the brief, or a sentence about the supplier's
 * business ("You need to be in conversation with a couple…") that the page never measured. The rule for the build:
 *
 *   · never a redirect, a "not found", an empty list, a hidden section, "—" alone, or ₱0 for a read that failed;
 *   · the page keeps its shell and its title, says "We couldn’t load {the thing} right now.", and offers Try again,
 *     which re-runs the read IN PLACE (`router.refresh()`), never navigates.
 *
 * Held as properties of each page's source — WHICH read is measured, and that the failed branch is decided BEFORE the
 * absent one (an order a count over a file cannot see; `reads-are-honest.test.ts` learned that the hard way).
 *
 * 🛡 Mutation-checked (2026-11-21), each broken on purpose and seen RED, then restored:
 *   · `readContract` → `fetchContract` back on the opened contract (rule 1);
 *   · the `read.failed` branch moved below `notFound()` (rule 1, order);
 *   · `eventOptions === null` branch removed from the upload body (rule 2);
 *   · `router.refresh()` swapped for `router.push('/vendor-dashboard')` in Try again (rule 0).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The words of the shared frame. */
const COULDNT = /We couldn(?:&rsquo;|’|')t load/;

test('rule 0 · Try again re-runs the read in place — it never navigates', () => {
  const tryAgain = read('_components/set-two/try-again.tsx');
  assert.match(tryAgain, /router\.refresh\(\)/, 'Try again must re-run the read with router.refresh()');
  assert.doesNotMatch(tryAgain, /router\.(push|replace|back)\(|redirect\(|href=/, 'Try again must never leave the page');
  const failed = read('_components/set-two/read-failed.tsx');
  assert.match(failed, /<TryAgain main \/>/, 'a whole-page failure offers Try again as the one main button');
  assert.match(failed, /end=\{<TryAgain \/>\}/, 'a one-part failure offers Try again inside its note');
  assert.match(failed, /role="alert"/, 'a failed read is announced');
  assert.match(failed, /This is on our side, not a sign you owe nothing\./, 'the money line is the shipped words');
});

test('rule 1 · the opened contract says a refused read — it is not "not found"', () => {
  const page = read('contracts/[contractId]/page.tsx');
  assert.match(page, /await readContract\(supabase, contractId\)/, 'the page must read with readContract, which tells failed from absent');
  assert.doesNotMatch(page, /fetchContract\(/, 'fetchContract folds a refused read into null — "not found"');
  const failedAt = page.indexOf('if (read.failed) return <ContractReadFailed');
  const notFoundAt = page.indexOf('notFound()');
  assert.ok(failedAt > -1, 'the failed read must return the honest frame');
  assert.ok(notFoundAt > failedAt, 'the failed branch must be decided BEFORE not-found');
  const body = read('contracts/[contractId]/contract-body.tsx');
  assert.match(body, /export function ContractReadFailed[\s\S]*?<PartPin[\s\S]*?title="Contract"[\s\S]*?<ReadFailedBody[^>]*>\s*We couldn&rsquo;t load this contract right now\./);
  const lib = readWeb('lib/contracts.ts');
  assert.match(lib, /export async function readContract[\s\S]*?if \(error\) \{[\s\S]*?return \{ failed: true \};/);
});

test('rule 2 · upload a contract says unread conversations — never "You need to be in conversation"', () => {
  const page = read('contracts/new/page.tsx');
  assert.match(page, /let threadsMeasured = true;/);
  assert.match(page, /catch \(err\) \{\s*threadsMeasured = false;/, 'a thrown conversations read is unmeasured, not empty');
  assert.match(page, /if \(!read\.complete && read\.threads\.length === 0\) threadsMeasured = false;/);
  assert.match(page, /eventOptions=\{threadsMeasured \? eventOptions : null\}/, 'an unread list is handed on as null, not []');
  const body = read('contracts/new/upload-body.tsx');
  const nullAt = body.indexOf('eventOptions === null ?');
  const emptyAt = body.indexOf('eventOptions.length === 0 ?');
  assert.ok(nullAt > -1 && emptyAt > nullAt, 'the body must branch on the read before it branches on the count');
  assert.match(body.slice(nullAt, emptyAt), COULDNT);
});

test('every read on a set-two page binds the error it may be refused with', () => {
  const files = ['contracts/new/page.tsx', 'contracts/[contractId]/page.tsx'];
  const offenders: string[] = [];
  for (const rel of files) {
    const src = read(rel);
    for (const m of src.matchAll(/const\s*\{[^}]*\bdata\b[^}]*\}/g)) {
      if (!/\berror\b/.test(m[0])) offenders.push(`${rel} → ${m[0].replace(/\s+/g, ' ').slice(0, 60)}`);
    }
    for (const m of src.matchAll(/const (\w+) = await supabase[\s\S]{0,400}?\.maybeSingle\(\);/g)) {
      if (!new RegExp(`${m[1]}\\.error`).test(src)) offenders.push(`${rel} → ${m[1]} is read without its .error`);
    }
  }
  assert.deepEqual(offenders, [], `Bind the error and say it: ${offenders.join(' · ')}`);
});
