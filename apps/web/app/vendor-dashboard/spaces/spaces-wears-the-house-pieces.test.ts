/**
 * 🔒 B4 · A7-15 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 4, approved): Shop › Spaces
 * wears the house pieces — the pinned row `PartPin` (Back from the one page-home map + the title; no hand-made title,
 * caption or Back round), a save that landed is the house
 * toast (no banner pushing the tiles down), a removal is the Undo toast (6 s) backed by one op in the SAME dispatcher,
 * the empty page is `EmptyState` with one "Add a space" and no date row, and no half-pixel type.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const SCREEN = read('_components/spaces-screen.tsx');
const ACTIONS = read('actions.ts');

test('4a · the title and Back are the house pinned row; the hand-made title, caption and Back round are gone', () => {
  assert.match(PAGE, /<PartPin route="\/vendor-dashboard\/spaces" title=\{metadata\.title\} \/>/);
  assert.doesNotMatch(PAGE, /<h1|BackButton|Set once for the shop\. Your cards pick from here\./);
});

test('4a · a save that landed is the house toast; only warnings stay in the page', () => {
  assert.match(SCREEN, /else if \(done\) toast\.success\(done\);/);
  assert.doesNotMatch(SCREEN, /tone: 'success'/, 'a success banner is back in the page');
  assert.match(SCREEN, /<ShopNotice tone="warn" role="alert">/);
});

test('4b · remove is gone at once with Undo, and Undo is one op in the same dispatcher (no new server action)', () => {
  assert.match(SCREEN, /<PeekToast[\s\S]*?action=\{\{\s*label: 'Undo',/);
  assert.match(SCREEN, /run\(\{ op: 'restoreSpace', id: back\.id, connectsTo: back\.connectsTo \}/);
  assert.match(ACTIONS, /\| \{ op: 'restoreSpace'; id: string; connectsTo: string \| null \}/);
  assert.match(ACTIONS, /case 'restoreSpace':\s*return restoreSpace\(o\.id, o\.connectsTo, day\);/);
  assert.equal((ACTIONS.match(/^export async function /gm) ?? []).length, 1, 'Spaces grew a second server action');
  const restore = ACTIONS.slice(ACTIONS.indexOf('async function restoreSpace('), ACTIONS.indexOf('/* ── Tables and doors'));
  assert.match(restore, /\.eq\('vendor_profile_id', s\.profile\.vendor_profile_id\)/, 'Undo can switch on another shop\'s space');
  assert.match(restore, /\.eq\('is_active', false\)/);
});

test('4c · empty: the house EmptyState with one "Add a space", and no date row', () => {
  const empty = SCREEN.slice(SCREEN.indexOf('data-spaces-empty=""'));
  assert.match(empty.slice(0, 700), /<EmptyState\s+Icon=\{MapPin\}\s+title="No spaces yet"/);
  assert.match(empty.slice(0, 700), /label="Add a space"/);
  assert.match(SCREEN, /\{read\.spaces\.length > 0 \? \(\s*<div className="flex min-h-11 items-center justify-between gap-3" data-spaces-date="">/);
});

test('no half-pixel type left in Spaces', () => {
  const files = ['page.tsx', ...readdirSync(join(HERE, '_components')).map((f) => `_components/${f}`)];
  for (const f of files) {
    if (!/\.(tsx|css)$/.test(f)) continue;
    assert.doesNotMatch(readFileSync(join(HERE, f), 'utf8'), /\d\.5px/, `${f} keeps a half-pixel size`);
  }
});
