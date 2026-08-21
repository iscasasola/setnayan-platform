/**
 * The ONE payment page keeps its three promises.
 *
 * Each assertion below was mutation-checked by OCCURRENCE COUNT (printed
 * before → after) — an unmeasured sabotage that reports green proves nothing,
 * which this repo has now been bitten by more than once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app', 'pay');
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');

/** Strip comments: every file here EXPLAINS the defect it closed, naming the
 *  very strings a raw-source grep would then count as the defect. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const page = stripComments(read('[reference]', 'page.tsx'));
const panel = stripComments(read('[reference]', '_components', 'pay-panel.tsx'));
const actions = stripComments(read('[reference]', 'actions.ts'));

test('the QR is in the same single column as the summary — never a second column', () => {
  // The owner's report: "it just went to the you're paying for… never showed
  // the pay this exact amount and no way to get there." That was a
  // side-by-side grid, which on a phone is a screen nothing points at.
  const twoCol = (page + panel).match(/(sm|md|lg):grid-cols-2|grid-cols-\[1fr_1fr\]/g) ?? [];
  assert.equal(twoCol.length, 0, 'a multi-column grid is back on the payment page');
  // And the panel must actually be rendered by the page, not merely imported.
  assert.match(page, /<PayPanel\b/);
});

test('every step is reachable — the bar names the next one', () => {
  assert.match(panel, /Show me the QR code/);
  assert.match(panel, /send my proof/);
  assert.match(panel, /id="payCard"/);
  assert.match(panel, /id="proofCard"/);
});

test('the screenshot preview stays on screen, above the reference field', () => {
  const previewAt = panel.indexOf('Read the reference number off it');
  const fieldAt = panel.indexOf('reference_last6');
  assert.ok(previewAt > 0, 'the preview caption is gone');
  assert.ok(fieldAt > 0, 'the last-6 field is gone');
  assert.ok(previewAt < fieldAt, 'the preview must render BEFORE the field they type into');
  assert.match(panel, /onFilePicked/, 'nothing captures the picked file to preview it');
});

test('proofs go to the PRIVATE bucket — a bank screenshot is never public', () => {
  assert.match(panel, /bucket="thread-files"/);
  assert.equal((panel.match(/bucket="media"/g) ?? []).length, 0);
});

test('the amount logged is the ORDER’s, never the form’s', () => {
  assert.match(actions, /amount_php: payable\.amountPhp/);
  // A posted amount must not be able to reach the insert.
  assert.equal((actions.match(/Number\(formData\.get\('amount_php'\)\)/g) ?? []).length, 0);
});

test('the payable is resolved on the SESSION client, so RLS scopes it', () => {
  assert.match(actions, /fetchPayableByReference\(supabase, reference\)/);
  assert.equal(
    (actions.match(/createMoneyWriterClient\(\)[\s\S]{0,80}\.from\('orders'\)/g) ?? []).length,
    0,
    'the ownership read must never run on the service-role client',
  );
});
