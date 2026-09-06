/**
 * BLOCKY KIT IS THE THIRD AVATAR — owner 2026-09-06: "build blocky kit".
 * The articulated rig drawn with rounded boxes: same skeleton, same poses,
 * same seat bake, same look fields — the style IS the part table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { RIG_STYLES, defaultHeritageConfig, validateHeritageConfig, resolveHeritageConfig, heritageFigureSpec } from './heritage-config';
import { resolveGuestAvatar } from './guest-avatar';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('blocky is a rig style: validates, resolves, and selects the blocky part table on the spec', () => {
  assert.deepEqual([...RIG_STYLES], ['heritage', 'blocky']);
  const b = { ...defaultHeritageConfig('b'), style: 'blocky' as const };
  assert.deepEqual(validateHeritageConfig(b), []);
  assert.equal(resolveHeritageConfig('b', b).style, 'blocky', 'a valid blocky row stays blocky');
  assert.equal(resolveHeritageConfig('b', { style: 'blocky', hairStyle: 99 }).style, 'blocky', 'repair keeps the style');
  assert.equal(resolveHeritageConfig('b', { style: 'cubist' }).style, 'heritage', 'an unknown rig style is not a rig style at all');
  assert.equal(heritageFigureSpec('b', b, '').kit, 'blocky');
  assert.equal(heritageFigureSpec('h', defaultHeritageConfig('h'), '').kit, 'round');
  const ga = resolveGuestAvatar(b, 'b', true);
  assert.equal(ga?.style, 'blocky');
});

test('the rig mounts EVERY part through the table — no capsule const left hard-wired in JSX', () => {
  const f = read('app/_components/plan3d/kit/figure.tsx');
  assert.match(f, /const G: RigParts = spec\.kit === 'blocky' \? BLOCKY_PARTS : ROUND_PARTS;/);
  const viaTable = f.match(/geometry=\{G\.(arm|leg|head|joint|hip|shoe|torso)\}/g) ?? [];
  assert.equal(viaTable.length, 13, 'hip · 2 legs · 4 joints · shoe · torso · 2 arms · head · hand (dressed only)');
  for (const hard of ['ARM_GEO', 'LEG_GEO', 'HEAD_GEO', 'JOINT_GEO', 'HIP_GEO', 'SHOE_GEO', 'MANNEQUIN_TORSO_GEO']) {
    assert.doesNotMatch(f, new RegExp(`geometry=\\{${hard}\\}`), `${hard} must reach JSX only through the table`);
  }
  // the round table is the mannequin's own consts, in full
  assert.match(f, /export const ROUND_PARTS: RigParts = \{\s*arm: ARM_GEO,\s*leg: LEG_GEO,\s*head: HEAD_GEO,\s*joint: JOINT_GEO,\s*hip: HIP_GEO,\s*shoe: SHOE_GEO,\s*torso: MANNEQUIN_TORSO_GEO,\s*\}/);
});

test('the blocky table has every part, as rounded boxes, at the round parts\' bounds', () => {
  const b = read('app/_components/plan3d/kit/blocky-parts.ts');
  assert.match(b, /import \{ RoundedBoxGeometry \} from 'three\/examples\/jsm\/geometries\/RoundedBoxGeometry\.js'/);
  for (const key of ['arm', 'leg', 'head', 'joint', 'hip', 'shoe', 'torso']) {
    assert.match(b, new RegExp(`^\\s+${key}: box\\(`, 'm'), `${key} present`);
  }
  assert.match(b, /joint: box\(2, 2, 2, /, 'the joint is a UNIT box — the rig scales it by the ball radius');
  assert.match(b, /torso: box\(0\.34, 0\.56, 0\.26, 0\.06, 0\.27\)/, 'the torso sits where the capsule torso sits');
});

test('every reader treats any rig style alike — the seat, the remote, the viewer, the maker', () => {
  const walk = read('app/[slug]/venue/_components/guest-venue-3d.tsx');
  assert.match(walk, /look=\{selfAvatar && selfAvatar\.style !== 'chibi' \? selfAvatar\.config : null\}/);
  assert.match(walk, /return ga && ga\.style !== 'chibi' \? ga\.config : null;/);
  assert.doesNotMatch(walk, /style === 'heritage'/, 'no reader singles out heritage any more');
  const remotes = read('app/_components/plan3d/plan3d-remote-players.tsx');
  assert.match(remotes, /avatar && avatar\.style !== 'chibi'\s*\? heritageFigureSpec\(player\.id, avatar\.config, player\.color\)/);
  const maker = read('app/[slug]/avatar/_components/avatar-maker.tsx');
  assert.match(maker, /<Chip on=\{style === 'blocky'\} onClick=\{\(\) => pickStyle\('blocky'\)\}>Blocky<\/Chip>/);
  assert.match(maker, /style: style === 'blocky' \? 'blocky' : 'heritage'/, 'the saved rig config carries which rig style it is');
  assert.match(maker, /const activeConfig = style === 'chibi' \? cfg : rigConfig;/);
});
