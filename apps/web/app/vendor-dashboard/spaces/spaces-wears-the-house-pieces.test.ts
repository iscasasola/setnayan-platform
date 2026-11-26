/**
 * 🔒 B4 · A7-15 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 4, approved): Shop › Spaces
 * wears the house pieces — `PageMasthead` (the title and its Back read in the app's top bar, as on Chats; no in-page
 * title, caption or Back round), a save that landed is the house
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

test('4a · the title and Back move to the app top bar through PageMasthead; nothing in-page draws them', () => {
  assert.match(PAGE, /<PageMasthead title=\{metadata\.title\} \/>/);
  assert.doesNotMatch(PAGE, /<h1|BackButton|PartPin|Set once for the shop\. Your cards pick from here\./, 'an in-page title or Back round is back');
});

test('4a · a save that landed is the house toast; only warnings stay in the page', () => {
  assert.match(SCREEN, /if \(done\) toast\.success\(done\);/);
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

const CSS = readFileSync(join(HERE, '_components/spaces-screen.module.css'), 'utf8');

test('4 motion · a removed tile leaves with Quick 200 (opacity), Undo returns it with Move 320; reduced is 120 ms', () => {
  assert.match(CSS, /\.leaving \{\s*opacity: 0;\s*transition: opacity var\(--sn-m-quick\) var\(--sn-m-settle\);/);
  assert.match(CSS, /\.returning \{\s*animation: spaces-return var\(--sn-m-move\) var\(--sn-m-settle\) both;/);
  assert.match(CSS, /prefers-reduced-motion: reduce\)[\s\S]*var\(--sn-dur-rise-reduced\)/);
  assert.doesNotMatch(CSS.slice(CSS.indexOf('.leaving')), /\d+ms|cubic-bezier|transform/, 'a raw timing, or a moving grid, in the tile motion');
  // The tile fades for exactly Quick before it leaves the grid; a late leave can never drop a tile Undo brought back.
  assert.match(SCREEN, /leaveTimer\.current = window\.setTimeout\(\(\) => \{[\s\S]*?\}, QUICK_MS\);/);
  assert.match(SCREEN, /window\.clearTimeout\(leaveTimer\.current\)/);
  assert.match(SCREEN, /if \(op\.op === 'restoreSpace'\) setReturning\(op\.id\);/);
});

test('4b · Undo after a booking is refused: a booked space is never removed, so no Undo is offered and the tile stays', () => {
  // The server refuses a booked space BEFORE it switches anything off.
  const remove = ACTIONS.slice(ACTIONS.indexOf('async function removeSpace('), ACTIONS.indexOf('async function restoreSpace('));
  const refusal = remove.indexOf("It is booked. Close its dates instead; it can’t be removed.");
  assert.ok(refusal > 0, 'the booked refusal is gone');
  assert.ok(refusal < remove.indexOf("is_active: false"), 'a booked space is switched off before the refusal');
  // On the screen, the Undo toast and the fade start ONLY on a removal that landed; a refusal is the page warning.
  const run = SCREEN.slice(SCREEN.indexOf('const run = '), SCREEN.indexOf('const openNew = '));
  const ok = run.indexOf('if (r.ok) {');
  const refused = run.indexOf("} else setMsg({ tone: 'warn', text: r.error });");
  assert.ok(ok > 0 && refused > ok, 'the refusal branch moved');
  for (const step of ['setRemoved(', 'setLeaving(', 'setRead(']) {
    const at = run.indexOf(step);
    assert.ok(at > ok && at < refused, `${step} runs on a refused write`);
  }
  // And an Undo the server refuses (the space can't come back) is said in the page; nothing fades back in.
  assert.match(ACTIONS, /That space can’t come back now\. Open the page again\./);
  assert.ok(run.indexOf('setReturning(') > ok && run.indexOf('setReturning(') < refused, 'a refused Undo still fades a tile in');
});
