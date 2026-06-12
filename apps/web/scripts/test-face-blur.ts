// Test suite — lib/face-blur.ts (Salamisim P2 FaceBlock baker).
//
// Standalone tsx + node:assert (repo pattern — no test runner). Covers the
// pure geometry, REAL tiled detection on committed fixtures (the model runs
// in-process on the tfjs CPU backend, same as production), the bake output
// (faces measurably blurred into the pixels), and the fail-closed contract.
//
// Run: pnpm exec tsx scripts/test-face-blur.ts

import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';
import {
  iou,
  dedupeBoxes,
  tileRects,
  expandBox,
  detectFacesTiled,
  bakeWallSafeJpeg,
  WALL_SAFE_MAX_EDGE,
  type FaceBox,
} from '../lib/face-blur';

let passed = 0;
function ok(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

const FIXTURES = path.join(process.cwd(), 'scripts', 'fixtures');

async function main() {
  console.log('face-blur · pure geometry');

  await ok('iou: identical boxes = 1, disjoint = 0', () => {
    const a: FaceBox = { x: 0, y: 0, w: 10, h: 10 };
    assert.equal(iou(a, a), 1);
    assert.equal(iou(a, { x: 20, y: 20, w: 5, h: 5 }), 0);
  });

  await ok('iou: half-overlap is between 0 and 1', () => {
    const v = iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 });
    assert.ok(v > 0.3 && v < 0.4, `expected ~1/3, got ${v}`);
  });

  await ok('dedupeBoxes: merges same-face boxes across tiles, keeps distinct', () => {
    const merged = dedupeBoxes([
      { x: 100, y: 100, w: 50, h: 50 },
      { x: 103, y: 98, w: 52, h: 52 }, // same face from another tile
      { x: 400, y: 100, w: 50, h: 50 }, // different face
    ]);
    assert.equal(merged.length, 2);
    // largest-first greedy: the 52px box wins over the 50px duplicate
    assert.ok(merged.some((b) => b.w === 52));
  });

  await ok('tileRects: full frame + 4 corner quadrants, all inside bounds', () => {
    const tiles = tileRects(1000, 800);
    assert.equal(tiles.length, 5);
    assert.deepEqual(tiles[0], { x: 0, y: 0, w: 1000, h: 800 });
    for (const t of tiles) {
      assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000 && t.y + t.h <= 800);
    }
    // the quadrants overlap across the center (62% > 50%)
    assert.ok(tiles[1]!.w + 0 > 500 && tiles[2]!.x < 500);
  });

  await ok('expandBox: grows around center, clamps at image edges, never empty', () => {
    const grown = expandBox({ x: 100, y: 100, w: 50, h: 50 }, 1000, 1000);
    assert.ok(grown.w > 50 && grown.h > 50);
    assert.ok(grown.x < 100 && grown.y < 100);
    const corner = expandBox({ x: 0, y: 0, w: 40, h: 40 }, 1000, 1000);
    assert.equal(corner.x, 0);
    assert.equal(corner.y, 0);
    const edge = expandBox({ x: 980, y: 980, w: 30, h: 30 }, 1000, 1000);
    assert.ok(edge.x + edge.w <= 1000 && edge.y + edge.h <= 1000);
    assert.ok(edge.w >= 1 && edge.h >= 1);
  });

  console.log('face-blur · real detection (committed model, CPU backend)');

  const groupFile = path.join(FIXTURES, 'face-group.jpg');
  const noneFile = path.join(FIXTURES, 'face-none.jpg');

  const groupRaw = await sharp(groupFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const groupFaces = await detectFacesTiled(
    groupRaw.data,
    groupRaw.info.width,
    groupRaw.info.height,
  );

  await ok('group fixture: tiled sweep finds all 5 frontal faces', () => {
    assert.ok(
      groupFaces.length >= 5,
      `expected ≥5 faces (spike baseline), got ${groupFaces.length}`,
    );
  });

  await ok('decor fixture: at most a stray false positive (fail-SAFE direction)', async () => {
    // The tiled sweep is tuned for RECALL — on this busy tablescape it boxes
    // the brass candlestick once (verified by eye). That is the correct
    // trade for a privacy gate: a blurred candlestick costs aesthetics, a
    // missed face breaks the FaceBlock promise. Guard the rate, not zero.
    const raw = await sharp(noneFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const faces = await detectFacesTiled(raw.data, raw.info.width, raw.info.height);
    assert.ok(faces.length <= 1, `false-positive rate regressed: ${faces.length} boxes`);
  });

  console.log('face-blur · bake output');

  const groupBytes = new Uint8Array(await sharp(groupFile).toBuffer());
  const bake = await bakeWallSafeJpeg(groupBytes);

  await ok('bake: derivative is a fresh JPEG within the wall edge cap', () => {
    assert.ok(bake.facesFound >= 5, `facesFound=${bake.facesFound}`);
    assert.ok(bake.jpeg.length > 10_000);
    assert.ok(bake.width <= WALL_SAFE_MAX_EDGE && bake.height <= WALL_SAFE_MAX_EDGE);
  });

  await ok('bake: faces are measurably blurred INTO the pixels', async () => {
    // Sharpness proxy: stddev of the luminance after a high-pass (laplacian-
    // ish) — compare the same face region in the original vs the bake. A
    // Gaussian-blurred region loses nearly all high-frequency energy.
    const face = groupFaces[0]!;
    const sx = bake.width / groupRaw.info.width;
    const region = {
      left: Math.max(0, Math.round(face.x * sx)),
      top: Math.max(0, Math.round(face.y * sx)),
      width: Math.max(8, Math.round(face.w * sx)),
      height: Math.max(8, Math.round(face.h * sx)),
    };
    const resizedOriginal = await sharp(groupFile)
      .resize(bake.width, bake.height, { fit: 'fill' })
      .toBuffer();
    const sharpness = async (buf: Buffer) => {
      // sharp's .stats() ignores pipeline ops (extract included) — the crop
      // must be MATERIALIZED first, then measured. Plain luminance stdev is
      // a sufficient texture proxy (a Gaussian-blurred face goes near-flat).
      const crop = await sharp(buf).extract(region).greyscale().toBuffer();
      const stats = await sharp(crop).stats();
      return stats.channels[0]!.stdev;
    };
    const before = await sharpness(resizedOriginal);
    const after = await sharpness(bake.jpeg);
    assert.ok(
      after < before * 0.5,
      `face region not blurred enough: texture ${before.toFixed(1)} → ${after.toFixed(1)}`,
    );
  });

  await ok('bake: (near-)zero-face image still yields a fresh derivative (provenance)', async () => {
    const bytes = new Uint8Array(await sharp(noneFile).toBuffer());
    const result = await bakeWallSafeJpeg(bytes);
    assert.ok(result.facesFound <= 1, `facesFound=${result.facesFound}`);
    assert.ok(result.jpeg.length > 10_000);
  });

  await ok('fail-closed: undecodable bytes THROW (caller withholds)', async () => {
    await assert.rejects(() => bakeWallSafeJpeg(new Uint8Array([1, 2, 3, 4, 5])));
  });

  console.log(`\n${passed} tests passed`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
