/**
 * the-cover-scene-has-its-own-animate.test.ts — 🎭 COVER SCENE › STYLE IS THE OPENING, 🎬 ITS ANIMATE IS ONE ENTRANCE
 * (owner-approved 2026-10-16, DECISION_LOG "APPROVED — THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…";
 * prototype `cover_scene_edit_animate_2026-10-16.html`; "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆").
 *
 *   (1) THE GROUP HAS ALL FOUR TOOLS — Edit (its lines), Style (the Opening), Background, Animate (one entrance).
 *   (2) THE ENTRANCE REACHES EVERY WORD WITH NO BUILD IN OF ITS OWN, AND NONE THAT HAS ONE — stored ONCE on the hero
 *       row (`canvas.entrance`), resolved at read time; at most three beats (the shipped Delay steps); the RSVP button
 *       enters last; Still lays nothing; nothing stored = the theme's own. "Reset to the cover's entrance" takes a
 *       word's own Build in off. The entrance is motion: Pro at Apply.
 *   (3) THE REVEAL TILE IS DRAWN NOWHERE — no page lists it before the Cover Scene, the toolbar paints no tile, the
 *       stub is gone; the cover's corner names the opening instead, and Style mounts the shipped picker.
 *   (4) ▶ ON THE COVER: the closed veil with none of the words, the unveil, every line in its beat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAKER_COVER_SCENE, MAKER_PART_TOOLS, MAKER_STAGE_PAGES, makerPartToolWorks } from './maker-parts';
import {
  COVER_ENTRANCES,
  coverEntranceBeats,
  resolveCoverEntrance,
  sanitizeCoverEntrance,
  withoutOwnEntrance,
} from './cover-entrance';
import { sanitizeHubCanvas } from './hub-canvas';
import { HUB_CANVAS_LOOK_KEYS } from './hub-look-pro';
import type { HubElementStyles, HubHeroElementKey } from './element-style';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TOOLS = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
const WORDS: HubHeroElementKey[] = ['eyebrow', 'mark', 'names', 'line', 'date', 'time', 'venue', 'link', 'rsvp'];

test('(1) the Cover Scene has all four tools', () => {
  assert.deepEqual(MAKER_PART_TOOLS.filter((t) => makerPartToolWorks(MAKER_COVER_SCENE, t)), [...MAKER_PART_TOOLS], 'a Cover Scene tool is grey');
  assert.match(TOOLS, /const coverStyle = open && picked === MAKER_COVER_SCENE && !rsvpOpen && shownTool === 'style' && revealStage !== null;/);
  assert.match(TOOLS, /hidden=\{!\(\(open && revealOpen && !editOn\) \|\| coverStyle\)\}[^>]*>\s*<RevealPartTools stage=\{revealStage\} \/>/, 'Style does not mount the shipped Opening picker');
  assert.match(TOOLS, /\{coverAnimate \? \(\s*<CoverAnimate/, 'Animate does not mount the cover’s one entrance');
  assert.match(TOOLS, /data-stage-cover-rows=\{coverStyle \|\| coverAnimate \? '' : undefined\}/, 'the group’s own rows are not marked');
  assert.match(TOOLS, /'\[data-maker-shell\]:has\(\[data-stage-tools\]\[data-stage-cover-rows\]\) \[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}'/, 'the work area’s rows are not stood aside for the group’s own');
});

test('(2) the entrance reaches every word with no Build in of its own, and none that has one', () => {
  const own: HubElementStyles = { names: { motion: { in: { fade: true, blur: true }, delay: 'long' } }, date: { color: '#123456', motion: { during: 'shimmer' } } };
  for (const e of COVER_ENTRANCES) {
    if (e.key === 'theme' || e.key === 'still') continue;
    const stored = sanitizeCoverEntrance({ key: e.key, speed: 'gentle' })!;
    const out = resolveCoverEntrance(stored, own)!;
    assert.deepEqual(out.names, own.names, `${e.key}: a word with its own Build in was overwritten`);
    assert.ok(out.date?.motion?.in, `${e.key}: a word with no Build in of its own was not reached`);
    assert.equal(out.date?.motion?.during, 'shimmer', `${e.key}: the word’s own Action was lost`);
    assert.equal(out.date?.color, '#123456', `${e.key}: the word’s own look was lost`);
    for (const k of WORDS) if (k !== 'names') assert.ok(out[k]?.motion?.in, `${e.key}: ${k} is not reached`);
    assert.equal(out.rsvp?.motion?.delay, 'long', `${e.key}: the RSVP button does not enter last`);
    assert.equal(out.date?.motion?.speed, 'gentle', `${e.key}: Movement does not reach the words`);
    const beats = coverEntranceBeats(stored, null, WORDS.map((k) => ({ key: k, label: k })));
    assert.ok(beats.length >= 1 && beats.length <= 3, `${e.key}: ${beats.length} beats — the Delay has three steps`);
  }
  assert.equal(resolveCoverEntrance(null, own), own, 'nothing stored is not the theme’s own');
  assert.equal(resolveCoverEntrance({ key: 'still' }, own), own, 'Still lays an entrance');
  // Stored once, on the hero row; a speed only beside an entrance that moves; an invention dropped.
  assert.deepEqual(sanitizeHubCanvas({ entrance: { key: 'top', speed: 'fast' } }).entrance, { key: 'top', speed: 'fast' });
  assert.deepEqual(sanitizeHubCanvas({ entrance: { key: 'still', speed: 'fast' } }).entrance, { key: 'still' });
  assert.equal(sanitizeHubCanvas({ entrance: { key: 'spin' } }).entrance, undefined);
  // ↺ Reset: the word's own Build in (its beat and speed with it) off; its Action stays.
  const reset = withoutOwnEntrance({ names: { motion: { in: { fade: true }, delay: 'short', speed: 'fast', during: 'drift' } } }, ['names']);
  assert.deepEqual(reset?.names?.motion, { during: 'drift' });
  assert.ok((HUB_CANVAS_LOOK_KEYS as readonly string[]).includes('entrance'), 'the entrance is not Pro at Apply');
  // The page lays it; the canvas's instant preview lays it the same way.
  assert.match(read('app/[slug]/_components/site-body.tsx'), /elements: resolveCoverEntrance\(heroCanvas\.entrance, heroCanvas\.elements\),\s*still: coverEntranceIsStill\(heroCanvas\.entrance\),/);
  assert.match(read('app/dashboard/[eventId]/website/editor/_components/element-preview.ts'), /key === 'f:hero' \? resolveCoverEntrance\(next\.entrance, next\.elements\)/);
  // A word says it follows the cover, and has the one door back.
  const sheet = read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx');
  assert.match(sheet, /`Follows the cover’s entrance — \$\{follow\.name\}\.`/);
  assert.match(sheet, /label: 'Reset to the cover’s entrance ›', onPress: \(\) => commit\(withoutOwnEntrance\(/);
});

test('(3) the Reveal tile is drawn nowhere — the cover’s corner names the opening', async () => {
  for (const [stage, pages] of Object.entries(MAKER_STAGE_PAGES)) {
    for (const [page, parts] of Object.entries(pages as Record<string, readonly string[]>)) {
      assert.ok(!parts.includes('reveal'), `${stage} › ${page} still lists the Reveal tile`);
    }
  }
  assert.doesNotMatch(TOOLS, /setAttribute\('data-maker-reveal-part'/, 'the toolbar still paints the Reveal tile into the canvas');
  const picture = read('app/dashboard/[eventId]/launch/_components/stage-panel/reveal-picture.tsx');
  assert.doesNotMatch(picture, /revealStubHtml|Opens once, over the cover/, 'the tile’s drawing is back');
  assert.match(read('app/globals.css'), /html\[data-maker-guest\] \[data-maker-opening-tag\] \{ display: none !important; \}/);
  assert.ok(existsSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-panel/reveal-picture.tsx')));
  const { coverOpeningTag } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/reveal-picture');
  assert.equal(coverOpeningTag('veil-sheer'), 'Sheer veil ◆ opens over it');
  assert.equal(coverOpeningTag('none'), 'No opening');
  assert.match(TOOLS, /tag\.textContent = coverOpeningTag\(revealLook\.kind\);/);
});

test('(4) ▶ on the cover: the closed veil with none of the words, the unveil, every line in its beat', () => {
  const play = read('app/[slug]/_components/play-sequence.ts');
  assert.match(play, /export function playCover\(header: HTMLElement, veil: boolean/);
  assert.match(play, /const lines = Array\.from\(header\.querySelectorAll<HTMLElement>\('\[data-cover-line\]'\)\);/, '▶ does not play every cover line');
  assert.match(play, /for \(const n of lines\) n\.style\.setProperty\('opacity', '0'\);/, 'a word shows behind the played veil');
  assert.match(TOOLS, /if \(picked === MAKER_COVER_SCENE && !rsvpOpen\) \{[\s\S]{0,200}t: 'playCover', key: 'f:hero', veil: revealStage !== null && revealLook\.kind !== 'none'/);
  assert.match(read('app/[slug]/_components/editor-bridge.tsx'), /seqStop = playCover\(header, \(data as \{ veil\?: unknown \}\)\.veil === true,/);
});
