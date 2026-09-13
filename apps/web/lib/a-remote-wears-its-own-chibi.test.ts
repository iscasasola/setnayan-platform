/**
 * A REMOTE WEARS ITS OWN CHIBI — the walking half of "everyone sees your
 * avatar" (owner 2026-09-06 "build what is not done"). Seated guests got
 * their chibi in #5229 through the RPC; a guest CROSSING the room was still a
 * white mannequin to everyone, because presence carried name + colour only.
 *
 * Pins the wiring: the viewer's own config rides `channel.track` (presence,
 * so a late joiner sees it too); the roster carries it raw; the remote figure
 * resolves it through the ONE fallback rule and hops through the SAME pure
 * clip the viewer's own figure uses — without a second <ChibiBounce> in the
 * walk file, which `the-chibi-bounces-it-does-not-glide` pins to exactly one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('the hook tracks the avatar in presence — both track calls, and re-tracks when it changes', () => {
  const src = read('app/_components/plan3d/use-plan3d-room.ts');
  const tracks = src.match(/channel\.track\(\{[^}]*avatar: meRef\.current\?\.avatar \?\? null \}\)|ch\.track\(\{[^}]*avatar: meAvatar \}\)/g) ?? [];
  assert.equal(tracks.length, 2, 'the join-time track AND the re-track both carry the avatar');
  assert.match(src, /roster\.push\(\{ id, name: [^}]*avatar: meta\.avatar \?\? null \}\)/, 'the roster carries it');
  assert.match(src, /\}, \[meName, meColor, meAvatar\]\);/, 'a changed avatar re-tracks');
  assert.doesNotMatch(src, /event: 'greet', payload: \{[^}]*avatar/, 'presence, not the greet event — a late joiner must see it');
});

test('the walk hands its own resolved avatar to presence', () => {
  const src = read('app/[slug]/venue/_components/guest-venue-3d.tsx');
  assert.match(src, /color: colorFromId\(selfIdRef\.current\), avatar: selfAvatar\?\.config \?\? null \}/);
  assert.match(src, /\[eventId, selfName, selfAvatar\],/);
  assert.equal((src.match(/<ChibiBounce/g) ?? []).length, 1, 'still exactly one bouncing figure in the walk file');
});

test('a remote with an avatar is a chibi that hops through the pure clip; without one, the mannequin', () => {
  const src = read('app/_components/plan3d/plan3d-remote-players.tsx');
  assert.match(src, /resolveGuestAvatar\(player\.avatar, player\.id, guestAvatarsEnabled\(\)\)/, 'the ONE resolver');
  assert.match(src, /const \{ lift, scaleY, scaleXZ \} = chibiHop\(phaseRef\.current, hopAmp\.current\);/, 'the same hop as the viewer');
  assert.match(src, /const target = r\.pose === 'stand' \|\| r\.waving \? 0 : 1;/, 'no hop while standing or waving');
  assert.match(src, /<ChibiFigure id=\{player\.id\} config=\{avatar\.config\} castShadow=\{false\} \/>/);
  assert.match(src, /<meshBasicMaterial color=\{player\.color\}/, 'the presence colour still rings the floor');
  assert.match(src, /<Figure\s+spec=\{spec\}/, 'the mannequin path is untouched');
  assert.doesNotMatch(src, /ChibiBounce/, 'no second bounce wrapper anywhere');
});
