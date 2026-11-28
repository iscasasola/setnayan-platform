/** 👗 gown stage — the frame governor (30 fps, 4 fps idle) and the scene table (three lights, no shadows). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_IDLE_AFTER_MS, createGownFrameGovernor } from './frame-governor';
import { GOWN_SCENES, GOWN_SCENE_IDS, gownSkyPixels } from './scenes';

/** Simulate a display at `hz` for `ms`, counting the frames the governor lets through. */
function frames(gov: ReturnType<typeof createGownFrameGovernor>, from: number, ms: number, hz = 60): number {
  let n = 0;
  for (let t = from; t < from + ms; t += 1000 / hz) if (gov.shouldDraw(t)) n++;
  return n;
}

test('a phone draws at about 30 fps, drops to 4 fps after 15 s without a touch, and a touch wakes it', () => {
  const gov = createGownFrameGovernor(true, 0);
  const awake = frames(gov, 0, 1000);
  assert.ok(awake >= 28 && awake <= 31, `awake: ${awake} frames in a second`);
  const idle = frames(gov, GOWN_IDLE_AFTER_MS + 1000, 1000);
  assert.ok(idle >= 3 && idle <= 5, `idle: ${idle} frames in a second`);
  gov.touch(GOWN_IDLE_AFTER_MS + 2000);
  assert.equal(gov.shouldDraw(GOWN_IDLE_AFTER_MS + 2000), true, 'the first frame after a touch draws at once');
  const woke = frames(gov, GOWN_IDLE_AFTER_MS + 2010, 1000);
  assert.ok(woke >= 28 && woke <= 31, `after a touch: ${woke}`);
});

test('never idle while something moves; a desktop draws every frame', () => {
  const gov = createGownFrameGovernor(true, 0);
  gov.setBusy(true);
  const moving = frames(gov, GOWN_IDLE_AFTER_MS + 1000, 1000);
  assert.ok(moving >= 28, `a pose blend after 15 s still draws at 30 fps (${moving})`);
  const desk = createGownFrameGovernor(false, 0);
  const all = frames(desk, 0, 1000);
  assert.ok(all >= 59 && all <= 61, `a desktop draws every frame (${all})`);
  assert.ok(frames(desk, GOWN_IDLE_AFTER_MS + 1000, 1000) <= 5, 'a desktop idles too');
});

test('six scenes, Studio first and neutral; every sky picture is finite', () => {
  assert.deepEqual([...GOWN_SCENE_IDS], ['studio', 'morning', 'afternoon', 'sunset', 'evening', 'indoor']);
  assert.equal(GOWN_SCENES.studio.label, 'Studio (true colour)');
  assert.equal(GOWN_SCENES.studio.sky3, null, 'Studio reflects the neutral room');
  for (const id of GOWN_SCENE_IDS.slice(1)) {
    const px = gownSkyPixels(id);
    assert.ok(px && px.length === 64 * 32 * 4, id);
  }
});

test('source guard: the stage has no shadow maps and no light beyond the scene table (sky, key, rim)', () => {
  const kit = join(__dirname, '../../app/_components/plan3d/kit');
  const files = [
    ...readdirSync(kit).filter((f) => f.startsWith('gown-')).map((f) => join(kit, f)),
    ...readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(__dirname, f)),
  ];
  assert.ok(files.some((f) => f.endsWith('gown-figure-3d.tsx')), 'the stage is checked');
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/castShadow|receiveShadow|shadowMap|shadows\b|ContactShadows|AccumulativeShadows|SoftShadows|ShadowMaterial/.test(src), `${f}: no shadows`);
    assert.ok(!/<(pointLight|spotLight|ambientLight|rectAreaLight)|new THREE\.(PointLight|SpotLight|AmbientLight|RectAreaLight)/.test(src), `${f}: no extra lights`);
    const lights = (src.match(/<(hemisphereLight|directionalLight)\b/g) ?? []).length;
    assert.ok(lights <= 3, `${f}: at most the scene table's three lights (${lights})`);
  }
});
