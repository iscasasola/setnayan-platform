/**
 * HERITAGE IS THE SECOND AVATAR — owner 2026-09-06: "can we finish chibi and
 * heritage? just so there are now options". Source pins for the wiring: the
 * rig honours its own look fields only when a spec carries them; every reader
 * of a stored config dispatches through the ONE resolver; the writer validates
 * by style; the maker offers both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('the rig honours skinTone / hairStyle / hairColor — and ONLY when a spec carries them', () => {
  const f = read('app/_components/plan3d/kit/figure.tsx');
  assert.match(f, /const look = spec\.skinTone != null;/);
  assert.match(f, /const dressed = staff \|\| look;/);
  assert.match(f, /const headMat = look \? plainMaterial\(spec\.skinTone!\) : bodyMat;/);
  assert.match(f, /<mesh geometry=\{G\.head\} material=\{headMat\}/);
  assert.match(f, /\{look && spec\.hairStyle != null \? \(/);
  assert.match(f, /geometry=\{hairCapGeometry\(spec\.hairStyle, kit\)\}/);
  // the blob is untouched: a look-less spec still resolves every material to bodyMat
  assert.match(f, /const garmentMat = dressed \? outfitMaterial\(spec\.outfit, spec\.outfitColor\) : bodyMat;/);
});

test('every reader dispatches through resolveGuestAvatar; nobody feeds a stored row straight to the chibi resolver', () => {
  const walk = read('app/[slug]/venue/_components/guest-venue-3d.tsx');
  const remotes = read('app/_components/plan3d/plan3d-remote-players.tsx');
  const maker = read('app/[slug]/avatar/_components/avatar-maker.tsx');
  for (const [name, src] of [['walk', walk], ['remotes', remotes], ['maker', maker]] as const) {
    assert.match(src, /resolveGuestAvatar\(/, `${name} uses the one resolver`);
    assert.doesNotMatch(src, /selfFigureAvatar\(/, `${name} no longer calls the chibi-only rule directly`);
  }
  assert.match(walk, /resolveGuestAvatar\(scene\.you\?\.avatarConfig, 'guest-self', guestAvatarsEnabled\(\)\)/);
  assert.match(walk, /if \(!ga \|\| ga\.style !== 'chibi'\) continue;/, 'the chibi crowd takes chibis only');
  assert.match(walk, /return ga && ga\.style !== 'chibi' \? ga\.config : null;/, 'rig-style seats are individual dressed figures');
  assert.match(walk, /if \(!photoUrl && !heritageAt\) return null;/);
  assert.match(walk, /\? heritageFigureSpec\('guest-self', look, ''\)/, "the viewer's own heritage rides the blob path on a dressed spec");
  assert.match(remotes, /if \(avatar\?\.style === 'chibi'\) \{/);
  assert.match(remotes, /\? heritageFigureSpec\(player\.id, avatar\.config, player\.color\)/);
});

test('the writer validates by style and whitelists by style', () => {
  const a = read('app/[slug]/avatar-actions.ts');
  assert.match(a, /const problems = validateGuestAvatar\(config\);/);
  assert.match(a, /return canonicalGuestAvatar\(config\);/);
  assert.doesNotMatch(a, /validateChibiConfig\(/, 'the chibi-only gate is no longer the writer\'s gate');
});

test('the maker offers both styles, previews the active one, saves the active one', () => {
  const m = read('app/[slug]/avatar/_components/avatar-maker.tsx');
  assert.match(m, /<Chip on=\{style === 'chibi'\} onClick=\{\(\) => pickStyle\('chibi'\)\}>Chibi<\/Chip>/);
  assert.match(m, /<Chip on=\{style === 'heritage'\} onClick=\{\(\) => pickStyle\('heritage'\)\}>Heritage<\/Chip>/);
  assert.match(m, /<Figure spec=\{heritagePreview\} pose="stand" castShadow=\{false\} \/>/);
  assert.match(m, /saveMyAvatarAction\(eventId, slug, activeConfig\)/);
  assert.match(m, /const activeConfig = style === 'chibi' \? cfg : rigConfig;/);
  for (const row of ['HERITAGE_SKIN_TONES', 'HERITAGE_HAIR_STYLES', 'HERITAGE_HAIR_COLORS', 'HERITAGE_OUTFITS', 'HERITAGE_OUTFIT_COLORS']) {
    assert.match(m, new RegExp(`\\{${row}\\.map\\(`), `${row} is driven off the catalog`);
  }
});
