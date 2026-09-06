/**
 * chibi-sit.test — a chibi in a chair, honestly placed and honestly batched.
 * Owner 2026-09-06 "build what is not done": the avatar a guest makes is now
 * seen by everyone else, seated. Pins the sit offset against the chair's own
 * constants, the batch contract (one batch per distinct buffer, bounded by
 * the catalog not the crowd), the paint parity with the individual figure,
 * the walk's split, and the RPC block that feeds it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { stripComments } from './strip-comments';
import { chibiSitOffset, chibiHemY, chibiSeatRoot, chibiCrowdBatches, CHIBI_SEAT_TOP_Y, CHIBI_SIT_FORWARD_M } from './chibi-sit';
import { CHIBI_HEAD_Y, CHIBI_OUTFIT_RECIPES, buildChibiGeometry, resolveChibiPaint } from './chibi-geometry';
import { resolveChibiConfig, effectiveChibiColors, type ChibiOutfit } from './chibi-config';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const OUTFITS = Object.keys(CHIBI_OUTFIT_RECIPES) as ChibiOutfit[];

test('the seat top is the chair\'s own constant, not a remembered number', () => {
  const chairs = readFileSync(join(ROOT, 'app/_components/plan3d/instanced-chairs.tsx'), 'utf8');
  const seatY = Number(/export const CHAIR_SEAT_Y = ([\d.]+);/.exec(chairs)![1]);
  const boxH = Number(/CHAIR_SEAT_GEO = new THREE\.BoxGeometry\([\d.]+, ([\d.]+), [\d.]+\)/.exec(chairs)![1]);
  assert.equal(CHIBI_SEAT_TOP_Y, seatY + boxH / 2);
  assert.ok(CHIBI_SIT_FORWARD_M > 0 && CHIBI_SIT_FORWARD_M < 0.21, 'legs dangle off the front edge, not past the seat');
});

test('hips to seat: the hem lands on the seat top for EVERY outfit, legs dangle below it', () => {
  for (const o of OUTFITS) {
    const off = chibiSitOffset(o);
    assert.ok(Math.abs(chibiHemY(o) + off.lift - CHIBI_SEAT_TOP_Y) < 1e-9, o);
    // shoes (y≈0.055 standing) end up BELOW the seat top — dangling, per the spec
    assert.ok(0.055 + off.lift < CHIBI_SEAT_TOP_Y, `${o}: shoes must hang below the seat`);
    assert.ok(off.lift > 0, `${o}: the figure rises onto the chair`);
  }
});

test('the figure root is seat × sit — a rotated seat carries the forward offset with it', () => {
  const seat = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(3, 0, -2);
  const root = chibiSeatRoot(seat, 'wedding');
  const p = new THREE.Vector3().setFromMatrixPosition(root);
  const off = chibiSitOffset('wedding');
  // local +z after a +90° yaw points along world +x
  assert.ok(Math.abs(p.x - (3 + off.forward)) < 1e-9);
  assert.ok(Math.abs(p.y - off.lift) < 1e-9);
  assert.ok(Math.abs(p.z - -2) < 1e-9);
});

test('batches: one per DISTINCT buffer, bounded by the catalog, never by the crowd', () => {
  const a = resolveChibiConfig('a', { v: 1, outfit: 'wedding', hairStyle: 'buns', bodyType: 'female' });
  const b = resolveChibiConfig('b', { v: 1, outfit: 'barong', hairStyle: 'short', bodyType: 'male' });
  const seatFor = (i: number) => new THREE.Matrix4().setPosition(i, 0, 0);
  const two = chibiCrowdBatches([{ matrix: seatFor(0), config: a }, { matrix: seatFor(1), config: b }]);
  const forty = chibiCrowdBatches(Array.from({ length: 40 }, (_, i) => ({ matrix: seatFor(i), config: i % 2 ? b : a })));
  assert.equal(forty.length, two.length, '40 guests of two variants cost the same batches as 2');
  assert.ok(forty.length <= 40, 'a whole room is a few dozen draws at most');
  const total = forty.reduce((n, x) => n + x.instances.length, 0);
  const partsPer = (c: typeof a) => { const g = buildChibiGeometry(c); return g.body.length + g.head.length; };
  assert.equal(total, 20 * partsPer(a) + 20 * partsPer(b), 'every part of every guest is drawn exactly once');
  // same key ⇒ same shared geometry object (the module caches)
  for (const batch of forty) {
    const g = [...new Set(forty.filter((x) => x.key === batch.key).map((x) => x.geometry))];
    assert.equal(g.length, 1, batch.key);
  }
});

test('paint parity: every instance colour is what the individual figure would paint', () => {
  const cfg = resolveChibiConfig('p', { v: 1, outfit: 'gown', hairStyle: 'buns', bodyType: 'female', colorMode: 'custom', outfitColor: '#336699', hairColor: '#221100' });
  const bundle = buildChibiGeometry(cfg);
  const colors = effectiveChibiColors(cfg);
  const batches = chibiCrowdBatches([{ matrix: new THREE.Matrix4(), config: cfg }]);
  for (const part of [...bundle.body, ...bundle.head]) {
    const batch = batches.find((b) => b.key === part.name)!;
    assert.equal(batch.instances[0]!.hex, resolveChibiPaint(part.paint, colors), part.name);
  }
  // head parts ride at CHIBI_HEAD_Y above the figure root
  const headBatch = batches.find((b) => b.key === 'head-skin')!;
  const bodyBatch = batches.find((b) => b.key.startsWith('body-'))!;
  const hy = new THREE.Vector3().setFromMatrixPosition(headBatch.instances[0]!.matrix).y;
  const by = new THREE.Vector3().setFromMatrixPosition(bodyBatch.instances[0]!.matrix).y;
  assert.ok(Math.abs(hy - by - CHIBI_HEAD_Y) < 1e-9);
});

test('the renderer: white materials, DoubleSide, one instancedMesh per batch, no per-frame work', () => {
  const src = read('app/_components/plan3d/kit/instanced-chibi-crowd.tsx');
  assert.match(src, /<meshStandardMaterial color="#ffffff" roughness=\{b\.roughness\} side=\{THREE\.DoubleSide\} \/>/);
  assert.match(src, /args=\{\[b\.geometry, undefined, b\.instances\.length\]\}/);
  assert.match(src, /mesh\.setColorAt\(i, _color\.set\(inst\.hex\)\)/);
  assert.doesNotMatch(src, /useFrame/, 'statically baked — the phone crowd budget');
  assert.doesNotMatch(src, /\.dispose\(/, 'shared geometry caches are never disposed');
});

test('the walk splits: avatar seats → chibi crowd, the rest → mannequins, only while the flag is on', () => {
  const src = read('app/[slug]/venue/_components/guest-venue-3d.tsx');
  assert.match(src, /if \(!guestAvatarsEnabled\(\)\) return \[\];/, 'flag off → no chibi seats');
  assert.match(src, /resolveGuestAvatar\(seatsWithAvatar\.get\(i\), `\$\{t\.id\}:\$\{i\}`, true\)/, 'the ONE resolver validates each config');
  assert.match(src, /if \(chibiSeatKeys\.has\(`\$\{t\.id\}:\$\{i\}`\)\) continue;/, 'the mannequin loop skips chibi seats — no doubles');
  assert.match(src, /<InstancedChibiCrowd seats=\{chibiSeats\} \/>/);
  assert.match(src, /<InstancedSeatedCrowd seats=\{crowdSeats\} quality="low" \/>/, 'the mannequin crowd stays');
  assert.match(src, /avatars\?: \{ table: string; seatNumber: number; config: unknown \}\[\];/);
});

test('the RPC ships seated avatars under the SAME gate as photos, only non-null, never invented', () => {
  const dir = join(ROOT, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_c6_venue_scene_seated_avatars.sql'))!;
  const sql = readFileSync(join(dir, file), 'utf8');
  assert.match(sql, /IF v_photo_vis = 'table' AND v_table_id IS NOT NULL THEN[\s\S]*?'config', g6\.avatar_config/);
  assert.match(sql, /ELSIF v_photo_vis = 'all' THEN[\s\S]*?'config', g6\.avatar_config/);
  assert.equal((sql.match(/AND g6\.avatar_config IS NOT NULL;/g) ?? []).length, 2, 'both branches list only guests who made one');
  assert.match(sql, /'avatars', v_avatars/, 'the return key');
  assert.match(sql, /v_avatars\s+JSONB := '\[\]'::jsonb;/, "'none' and no-token → an empty list, not a missing key");
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.public_venue_scene/, 'grants untouched — no new exposure');
  // the viewer's own block is still ungated (C5's rule survives)
  assert.match(sql, /'avatarConfig', \(SELECT g5\.avatar_config FROM public\.guests g5/);
});
