/**
 * play-plays-a-fixed-block.test.ts — ▶ ON A FIXED BLOCK PLAYS THE BLOCK (the merged copy's walk, 2026-10-11, M12).
 *
 * The Day › Gallery › Photos of you › Animate › Fade, then ▶: the button read Stop for ~30 ms and nothing moved.
 * A fixed block (the March, E-Gifts, the details, Happening now, Find your seat, the pass, Photos of you) has no scene
 * frame — its Animate is its OWN part-motion, written by `blockLooksCss` on the element right after its mark, with a
 * part's keyframes (`el-in-*` · `el-during-*` · `el-out-*`). The canvas's ▶ (`editor-bridge.tsx` `playSeq`) read every
 * part-less target as a SCENE — `--hub-in-kf`, a variable only a scene's frame carries — so for a block it always found
 * "Build in: none". This is the real canvas's bridge: every couple's Maker, not the lab.
 *
 *   1. the bridge finds a block's own element — at the section, or inside it (the lab wraps its stand-ins);
 *   2. its selector IS `blockSelector`'s, for every block (the bridge says the two attribute names outright so a
 *      guest's bundle never loads the block-looks module);
 *   3. `playSeq` plays a block as a PART (`isScene` false), a framed scene as a scene, a picked part as itself;
 *   4. a block's motion really is a part's keyframes — what `playSequence` reads for a part.
 *
 * WHAT THIS CANNOT SEE: a browser. That the block visibly moves is walked on the lab (`hub-walk/merged-fixes`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BLOCK_LOOK_BLOCKS, BLOCK_MARK_ATTR, blockLooksCss, blockSelector, readBlockLooks } from './block-looks';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const BRIDGE = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/editor-bridge.tsx'), 'utf8'));
const SELECTOR = /export const BLOCK_PART_SELECTOR = '([^']+)';/.exec(BRIDGE)?.[1] ?? '';

test('1 · the bridge finds the block’s own element: the section itself, or the one inside it', () => {
  assert.match(BRIDGE, /export function blockPartOf\(section: Pick<HTMLElement, 'matches' \| 'querySelector'>\): HTMLElement \| null \{\s*return section\.matches\(BLOCK_PART_SELECTOR\) \? \(section as HTMLElement\) : section\.querySelector<HTMLElement>\(BLOCK_PART_SELECTOR\);\s*\}/);
});

test('2 · its selector is the block-looks module’s own, for every block', () => {
  assert.ok(SELECTOR, 'the bridge has no selector for a block’s element');
  assert.equal(BLOCK_MARK_ATTR, 'data-block-mark');
  for (const block of BLOCK_LOOK_BLOCKS) {
    assert.equal(blockSelector(block), SELECTOR.split('[data-block-mark]').join(`[${BLOCK_MARK_ATTR}="${block}"]`), `the bridge would not find the ${block} block`);
  }
  /* …and the bridge still does not load the module for a guest (only on the Maker's own message). */
  assert.doesNotMatch(BRIDGE, /^import [^\n]*from '@\/lib\/block-looks';/m);
});

test('3 · ▶ plays a block as a PART, a framed scene as a scene, a picked part as itself', () => {
  const seq = BRIDGE.slice(BRIDGE.indexOf("if (data.t === 'playSeq')"), BRIDGE.indexOf("if (data.t === 'playEl')"));
  assert.ok(seq.length > 200, 'anti-vacuity: the playSeq handler was not found');
  assert.match(seq, /const frame = part \? null : \(sceneFrameOf\(el as never\) as unknown as HTMLElement \| null\);/);
  assert.match(seq, /const block = part \|\| frame \? null : blockPartOf\(el\);/);
  assert.match(seq, /const target = part \?\? frame \?\? block \?\? el;/);
  assert.match(seq, /playSequence\(\s*target,\s*!part && !block,/, 'a block is read as a scene again — "Build in: none"');
});

test('4 · a block’s Animate IS a part’s keyframes — what the play reads for a part', () => {
  const css = blockLooksCss(readBlockLooks({ block_looks: { photos_of_you: { motion: { in: { fade: true } } }, gifts: { motion: { in: { blur: true }, during: 'drift' } } } }));
  assert.match(css, /el-in-/, 'a block’s Build in is no longer a part’s keyframe');
  assert.match(css, /el-during-/, 'a block’s Action is no longer a part’s keyframe');
  assert.doesNotMatch(css, /--hub-in-kf/, 'a block now carries a scene’s variable — re-read how ▶ plays it');
  /* The play reads exactly those names off the part. */
  const play = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/play-sequence.ts'), 'utf8'));
  assert.match(play, /const inKf = isScene \? cs\.getPropertyValue\('--hub-in-kf'\)\.trim\(\) : kfOf\(target, \/\^el-in-\/\);/);
});
