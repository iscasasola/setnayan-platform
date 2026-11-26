/**
 * Final check 25 Nov, area 8 wording (A8·B-9, A8·B-10, A8·F-22, A8·G-16, A8·I-11).
 * The admin reads the same house words as everyone else: plan names Plus · Pro · Ultra (never a code
 * key, never "Supplier Ultra"), Event Hub (never "site"), supplier (never a "/vendors" address).
 * Comment-stripped, so a note explaining a fix never trips it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from '@/lib/strip-comments';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const admin = dirname(fileURLToPath(import.meta.url));
const strip = stripComments;
const code = (p: string) => strip(readFileSync(resolve(admin, p), 'utf8'));

test('pricing add-on rows say "Ultra", never "Supplier Ultra" (B-10)', () => {
  assert.doesNotMatch(code('pricing/_surfaces/pricing-surface.tsx'), /Supplier Ultra/);
});

test('supplier free windows print the plan name, not its code key (B-9)', () => {
  const src = code('pricing/_surfaces/free-windows-surface.tsx');
  assert.match(src, /TIER_LABEL\[row\.promoted_vendor_tier/);
  assert.doesNotMatch(src, /\{row\.promoted_vendor_tier \?\? '—'\}/);
});

test('Papic storage says "copies" (F-22)', () => {
  assert.doesNotMatch(code('papic-storage/backfill-tiles-button.tsx'), /copy\{/);
});

test('Music Maker delivery says Event Hub, not "site" (G-16)', () => {
  assert.doesNotMatch(code('pakanta/pakanta-deliver.tsx'), /couple[’']s site/);
});

test('the demo-mode row names the marketplace, not "/vendors" (I-11)', () => {
  assert.doesNotMatch(code('settings/_surfaces/demo-mode-surface.tsx'), /View \/vendors/);
});
