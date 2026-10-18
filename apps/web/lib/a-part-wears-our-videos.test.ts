/**
 * a-part-wears-our-videos.test.ts — LOOK RESTUDY ROW 7: A PART'S OWN BACKGROUND OFFERS THE MAIN'S SOURCES.
 *
 * Owner-approved 2026-10-08 (BACKGROUND_RESTUDY_2026-10-08_fable.md § 2.4: "Its own opens the SAME Source ▾ + cards")
 * and locked 2026-10-09 (`Maker_Two_Bars_LOCKED_2026-10-09.md` § BACKGROUND row 1: *"The Event Hub's · Colour · Scene ◆
 * · Video ◆ · Upload ◆"*). "The Event Hub's" — the restudy's "Same as main", picking it is "Back to main" — and
 * Colour · Scene · Upload shipped with the toolbar; Video ◆ did not. Held here: the closed list of our loops, the
 * part's Source, the stored shape (a clip, as every part's clip), and Apply admitting exactly those refs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INVITE_THEMES } from './invite-themes';
import { hubMovingBackgroundIds, sanitizeHubCanvas } from './hub-canvas';
import { isThemeLoopRef, themeLoopChoices, themeLoopOf } from './theme-loop-refs';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const ROW = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');

test('1 · the closed list is exactly our loops and their stills — nothing else is "ours"', () => {
  const choices = themeLoopChoices();
  assert.deepEqual(choices.map((c) => c.id), hubMovingBackgroundIds(), 'the Video cards are not the moving backgrounds the Look offers');
  assert.ok(choices.length > 0, 'anti-vacuity: no loops');
  for (const c of choices) {
    assert.equal(c.loop, INVITE_THEMES[c.id].media?.loop);
    assert.equal(themeLoopOf(c.loop), c.id);
    assert.equal(themeLoopOf(c.poster), c.id);
  }
  for (const other of ['r2://setnayan-media/theme-backgrounds/2026-09-24/evil-loop.mp4', 'r2://setnayan-media/events/E/x.mp4', '', null, 42]) {
    assert.equal(isThemeLoopRef(other), false, `${String(other)} passed as one of ours`);
  }
});

test('2 · a part stores our loop as the clip it is — the shape the canvas already keeps', () => {
  const c = themeLoopChoices()[0]!;
  const canvas = sanitizeHubCanvas({ kind: 'snippet', media: c.loop, poster: c.poster });
  assert.equal(canvas.kind, 'snippet', 'the canvas drops our loop');
  assert.equal(canvas.media, c.loop);
  assert.equal(canvas.poster, c.poster, 'the loop keeps no still for guests');
});

test('3 · the part\'s Source offers Video ◆ between Scene and Upload, reads a stored loop back as Video, and puts a clip', () => {
  assert.match(ROW, /\(loops\.length > 0 \? \(\['scene', 'video', 'own'\] as const\) : \(\['scene', 'own'\] as const\)\)/, 'Video ◆ is not offered');
  assert.match(ROW, /themeLoopOf\(bg\.media\)\s*\? 'video'\s*: 'own'/, 'a stored loop reads as "Upload"');
  assert.match(ROW, /if \(source === 'video'\) \{\s*const l = loops\.find\(\(c\) => c\.loop === key\);\s*return l \? put\(clipBg\(l\.loop, l\.poster\), false\) : undefined;/);
  assert.match(read('app/dashboard/[eventId]/launch/_components/stage-panel/stage-background.tsx'), /export type StageBgSource = 'hub' \| 'colour' \| 'scene' \| 'video' \| 'own';/);
  // Every scene's mount hands the stills — the hero's AND a scene's.
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.equal((shell.match(/loopPosters=\{sceneFormat\.loopPosters\}/g) ?? []).length, 2, 'a scene mount has no Video cards');
});

test('4 · Apply admits our loops on a part — by the closed list, never a folder pattern', () => {
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /const sceneIsOwn = \(ref: string\) => ownRefs\.has\(ref\) \|\| ref\.startsWith\(ownScenePrefix\) \|\| isStdLibrarySrc\(ref\) \|\| isThemeLoopRef\(ref\);/);
  assert.doesNotMatch(apply, /theme-backgrounds\//, 'Apply admits a whole folder');
});
