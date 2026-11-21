/**
 * 🛠 THE MAKER IS DRAWING v17 — the pieces PR #8072 builds after the merge of the one-toolbar branches (owner 20 Nov 2026:
 * `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` v17 "final for build"; DECISION_LOG rows "POST EVENT LEAVES
 * THE EVENT HUB", "MAKER TABS REVISITED", "MAKER EDIT ROWS RUN BY IMPORTANCE", "MAKER PAYWALL", "UPLOAD YOUR OWN SONG IS
 * ◆", "MAKER · WAY BACK + BUILT-IN GUEST PAGES"). Each assertion names the ruling it holds; sabotage any one → red.
 * (⚙'s regroup is held by `the-hub-settings-sheet-holds-the-rest.test.ts` and `the-hubs-settings-draw-compact-rows.test.ts`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_STAGE_KEYS, MAKER_STAGE_MENU_KEYS, MAKER_PART_ANIMATE_STEPS, MAKER_PART_EXPANDS } from './maker-parts';
import { MAKER_ANIMATE_WORDS } from './maker-animate-words';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('Stage ▾ is four stages — Post Event left the Event Hub (20 Nov "POST EVENT LEAVES THE EVENT HUB" (1))', () => {
  assert.deepEqual([...MAKER_STAGE_MENU_KEYS], ['save_the_date', MAKER_STAGE_KEYS[1], 'rsvp', 'event']);
  assert.ok(!MAKER_STAGE_MENU_KEYS.includes('editorial'), 'Post Event is a stage of the Maker again');
  const menu = read(`${L}/stage-item-menu.tsx`);
  assert.match(menu, /\{MAKER_STAGE_MENU_KEYS\.map\(\(s\) => \{/, 'the stage list is not the four');
  assert.doesNotMatch(menu, /MAKER_STAGE_KEYS\.map/, 'the stage list draws all five again');
});

test('Animate says Arrives · While showing · Leaves · With the scroll; picking plays at once (20 Nov "MAKER TABS REVISITED" (3))', () => {
  assert.deepEqual({ ...MAKER_ANIMATE_WORDS }, { in: 'Arrives', act: 'While showing', out: 'Leaves', scroll: 'With the scroll' });
  assert.deepEqual(MAKER_PART_ANIMATE_STEPS.map((s) => s.label), ['Arrives', 'While showing', 'Leaves']);
  const animate = read(`${L}/stage-panel/stage-animate.tsx`);
  assert.match(animate, /\['in', MAKER_ANIMATE_WORDS\.in\],\s*\['act', MAKER_ANIMATE_WORDS\.act\],\s*\['out', MAKER_ANIMATE_WORDS\.out\],/);
  assert.doesNotMatch(animate, /'Build in'|'Build out'|"Build in plays"/, 'the retired words are drawn again');
  assert.match(animate, /keepRaw\(next\);\s*playPickedSoon\(\);/, 'picking a motion does not play it');
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /window\.addEventListener\(MAKER_PLAY_PICKED_EVENT, on\)/, 'the toolbar does not play a picked motion');
});

test('Edit runs by importance — the heading last (20 Nov "MAKER EDIT ROWS RUN BY IMPORTANCE" (1))', () => {
  const words = read(`${L}/stage-panel/part-words.ts`);
  assert.match(words, /export function byImportance\(fields: readonly PartWordsField\[\]\): PartWordsField\[\] \{\s*return \[\.\.\.fields\.filter\(\(f\) => f\.field !== 'title'\), \.\.\.fields\.filter\(\(f\) => f\.field === 'title'\)\];/);
  assert.match(words, /const ranked = byImportance\(fields\);/);
});

test('⤢ only where the work needs room — never on Dress code (20 Nov "DRESS COLOURS STAY IN MOOD BOARD" (2))', () => {
  assert.deepEqual([...MAKER_PART_EXPANDS], ['logo', 'story', 'schedule', 'gifts']);
  assert.ok(!(MAKER_PART_EXPANDS as readonly string[]).includes('dress'), 'Dress code has ⤢ again');
});

test('◆ means the full Event Hub at ✓ Apply (20 Nov "MAKER PAYWALL")', () => {
  const sheet = read('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /◆ Get the full Event Hub and apply/);
  assert.match(sheet, /Apply without the ◆ changes/);
  assert.match(sheet, /APPLY_FULL_HUB_COMES_WITH = 'Comes with Event Plus, Pro and Ultra\.'/);
  assert.doesNotMatch(sheet, /Unlock Pro and Apply|Apply without the Pro effects/, 'the retired Apply words are back');
});

test('Look › Music offers "Upload your own song ◆" — the shipped upload, no second store', () => {
  const panel = read('app/dashboard/[eventId]/website/editor/_components/media-panels.tsx');
  assert.match(panel, /MAKER_UPLOAD_SONG_LABEL = 'Upload your own song ◆'/);
  assert.match(panel, /MAKER_UPLOAD_SONG_HINT = 'MP3 or M4A from your phone or computer'/);
  assert.equal((panel.match(/name="bg_music_url"/g) ?? []).length, 1, 'a second song store was added');
});

test('Pages shows the built-in pages — Before they come in, and Me · Live · Camera say what they do (20 Nov "MAKER · WAY BACK + BUILT-IN GUEST PAGES")', () => {
  const pages = read(`${L}/maker-pages-sheet.tsx`);
  for (const name of ['Login · the door', 'Plus-one welcome', 'Waiting for you to accept']) assert.ok(pages.includes(`name: '${name}'`), `${name} is not listed`);
  assert.match(pages, /aria-label="Before they come in" data-maker-pages-before=""/);
  for (const k of ['me', 'live', 'camera']) assert.match(pages, new RegExp(`\\b${k}: '[^']+'`), `${k} does not say what it does`);
  // 🔎 The canvas is read FRESH as Pages opens — a stale reading said "Nothing on this page yet" over a full Home.
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const openPages = \(\) => \{\s*const fresh = readPresent\(frameSel\);\s*setPresent\(fresh\);/);
  assert.match(tools, /scenes: \(rsvpOpen \? makerPartsTappable\(RSVP_STAGE_KEY, p\.key, fresh\) : tappableWith\(p\.key, fresh\)\)/);
});

test('Full screen has one way back per door — no second history entry of its own (Back is the shell’s `useBackCloses`)', () => {
  const parts = read(`${L}/stages-studio-parts.tsx`);
  assert.doesNotMatch(parts, /history\.pushState|snMakerEditor/, 'the risen editor pushes a second history entry beside the shell’s');
  assert.match(parts, /window\.addEventListener\(MAKER_EDITOR_CLOSE_EVENT, ask\);/);
  assert.match(read(`${L}/maker-shell.tsx`), /useBackCloses\(studioOn && !printsPage && !wide,/);
});
