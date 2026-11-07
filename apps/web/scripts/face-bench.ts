// face-bench.ts — run the shipped face model over a LABELLED folder of photos and count what each line would do.
//
// ⚖ Owner 2026-11-05, DECISION_LOG "FACE MATCHING: MAKE IT FIND EVERY PHOTO OF A PERSON — APPROVED, IN SLICES,
// MEASURED FIRST", slice (1). It changes nothing: it prints counts. 0.50 / 0.60 (lib/face-match-core.ts) stay
// where they are until a run of this on real event photos is cited in the DECISION_LOG.
//
// Usage (from apps/web):
//   pnpm face:bench -- --dir ~/face-bench/volunteers
//   pnpm face:bench -- --dir <folder> --selfies 1          # one selfie frame per person (today's enrolment)
//   pnpm face:bench -- --dir <folder> --max-side 0         # full resolution, as a phone hands it to the detector
//   pnpm face:bench -- --dir <folder> --json ~/out.json    # also write the counts + every pair's distance
//
// The folder:   <dir>/<person>/selfie*.jpg   ← enrolment (match is against the closest selfie)
//               <dir>/<person>/<any>.jpg     ← an event photo that person IS in. Put a group photo in every
//                                              person's folder (copies are joined by content hash).
//
// Flags:  --from 0.30 --to 0.70 --step 0.05   auto lines to try (the shipped 0.50 is always included)
//         --suggest 0.60                      the suggest line for every row (default: the shipped line)
//         --max-side 1024                     decode size; default = the server rescan's (lib/face-embed-server.ts)
//         --models <dir>                      weights; default = the @vladmandic/face-api@1.7.15 package's own,
//                                             the same files scripts/host-face-models.mjs puts on R2
//
// 🔒 PHOTOS OF PEOPLE NEVER GO IN THIS REPO. The script refuses a --dir or --json inside the git checkout. It keeps
// no descriptor: vectors live in memory for the run; the JSON holds distances and file names only.
//
// Same pipeline as the server embedder: EXIF-rotate → fit inside max-side → RGB → SSD MobileNet v1 with its
// DEFAULT options (minConfidence 0.5, maxResults 100 — `SsdMobilenetv1Options.ts`) → 68 landmarks → dlib 128-d.
// Selfies use detectSingleFace, as the phone's `embedSingleFace` does.

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import {
  benchPairs,
  benchReport,
  formatBenchReport,
  planBenchLayout,
  sweepLines,
  BENCH_SERVER_MAX_SIDE,
  type BenchEnrolment,
  type BenchFile,
  type BenchPhoto,
} from '../lib/face-bench-core';
import { FACE_SUGGEST_MAX_DISTANCE } from '../lib/face-match-core';

type Box = { x: number; y: number; width: number; height: number };
type Det = { descriptor: Float32Array; detection: { box: Box; score: number } };
type Tensor3D = { dispose(): void };
type FaceApiNode = {
  tf: {
    setBackend(name: string): Promise<boolean>;
    ready(): Promise<void>;
    getBackend(): string;
    tensor3d(values: Uint8Array, shape: [number, number, number], dtype: 'int32'): Tensor3D;
  };
  nets: Record<'ssdMobilenetv1' | 'faceLandmark68Net' | 'faceRecognitionNet', { loadFromDisk(dir: string): Promise<void> }>;
  detectAllFaces(input: Tensor3D): { withFaceLandmarks(): { withFaceDescriptors(): Promise<Det[]> } };
  detectSingleFace(input: Tensor3D): { withFaceLandmarks(): { withFaceDescriptor(): Promise<Det | undefined> } };
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function num(name: string, fallback: number): number {
  const v = arg(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number, got "${v}"`);
  return n;
}

function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(process.env.HOME ?? '', p.slice(2)) : p;
}

function repoRoot(): string | null {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function insideRepo(p: string, root: string | null): boolean {
  if (!root) return false;
  const rel = path.relative(root, path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Every file up to three folders deep (deeper ones are reported as skipped by the layout). */
function listFiles(dir: string): BenchFile[] {
  const out: BenchFile[] = [];
  const walk = (abs: string, rel: string, depth: number) => {
    for (const name of readdirSync(abs)) {
      const a = path.join(abs, name);
      const r = rel ? `${rel}/${name}` : name;
      const st = statSync(a);
      if (st.isDirectory()) {
        if (depth < 3) walk(a, r, depth + 1);
      } else if (st.isFile()) {
        out.push({ relPath: r, hash: createHash('sha256').update(readFileSync(a)).digest('hex') });
      }
    }
  };
  walk(dir, '', 0);
  return out;
}

async function loadModel(modelsDir: string): Promise<FaceApiNode> {
  const require = createRequire(import.meta.url);
  const api = require('@vladmandic/face-api/dist/face-api.node-wasm.js') as FaceApiNode;
  try {
    await api.tf.setBackend('wasm');
    await api.tf.ready();
  } catch {
    await api.tf.setBackend('cpu');
    await api.tf.ready();
  }
  await api.nets.ssdMobilenetv1.loadFromDisk(modelsDir);
  await api.nets.faceLandmark68Net.loadFromDisk(modelsDir);
  await api.nets.faceRecognitionNet.loadFromDisk(modelsDir);
  return api;
}

/** Decode the way lib/face-embed-server.ts does. null = not a 3-channel image (the server reads no face there either). */
async function decode(api: FaceApiNode, file: string, maxSide: number) {
  let img = sharp(readFileSync(file)).rotate();
  if (maxSide > 0) img = img.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) return null;
  return { tensor: api.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32'), width: info.width, height: info.height };
}

async function main() {
  const dirArg = arg('dir');
  if (!dirArg) {
    console.error('usage: pnpm face:bench -- --dir <folder of <person>/<photo>.jpg> [--selfies N] [--max-side 1024] [--json out.json]');
    process.exit(2);
  }
  const dir = path.resolve(expandHome(dirArg));
  const jsonOut = arg('json') ? path.resolve(expandHome(arg('json') as string)) : null;
  const root = repoRoot();
  if (insideRepo(dir, root) || (jsonOut && insideRepo(jsonOut, root))) {
    console.error(`refused: photos of people and their results stay OUT of the repo (${root}). Use a folder elsewhere.`);
    process.exit(2);
  }
  const maxSide = num('max-side', BENCH_SERVER_MAX_SIDE);
  const maxSelfies = arg('selfies') ? Math.max(1, Math.floor(num('selfies', 1))) : undefined;
  const suggestLine = num('suggest', FACE_SUGGEST_MAX_DISTANCE);
  const lines = sweepLines(num('from', 0.3), num('to', 0.7), num('step', 0.05));
  const modelsDir = path.resolve(
    expandHome(arg('models') ?? path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model')),
  );

  const layout = planBenchLayout(listFiles(dir), { maxSelfies });
  console.error(`bench: ${layout.selfies.size} people with selfies · ${layout.photos.length} photos · ${layout.skipped.length} skipped`);
  for (const s of layout.skipped) console.error(`  skipped ${s.relPath} — ${s.why}`);

  const api = await loadModel(modelsDir);
  console.error(`bench: model loaded from ${modelsDir} on ${api.tf.getBackend()} · decode max side ${maxSide || 'full'}`);

  const enrolments: BenchEnrolment[] = [];
  for (const [person, files] of [...layout.selfies].sort((a, b) => a[0].localeCompare(b[0]))) {
    const vectors: number[][] = [];
    for (const rel of files) {
      const img = await decode(api, path.join(dir, rel), maxSide);
      if (!img) continue;
      try {
        const det = await api.detectSingleFace(img.tensor).withFaceLandmarks().withFaceDescriptor();
        if (det) vectors.push(Array.from(det.descriptor));
        else console.error(`  no face read in selfie ${rel}`);
      } finally {
        img.tensor.dispose();
      }
    }
    enrolments.push({ person, vectors });
  }

  const photos: BenchPhoto[] = [];
  let unreadable = 0;
  let ms = 0;
  for (const p of layout.photos) {
    const img = await decode(api, path.join(dir, p.paths[0] as string), maxSide);
    if (!img) {
      unreadable += 1;
      photos.push({ ...p, width: 0, height: 0, faces: [] });
      continue;
    }
    try {
      const t0 = performance.now();
      const dets = await api.detectAllFaces(img.tensor).withFaceLandmarks().withFaceDescriptors();
      ms += performance.now() - t0;
      photos.push({
        ...p,
        width: img.width,
        height: img.height,
        // face-api's Box keeps its numbers behind getters, so `{ ...box }` would copy nothing — read each one.
        faces: dets.map((d) => {
          const b = d.detection.box;
          return { vector: Array.from(d.descriptor), box: { x: b.x, y: b.y, width: b.width, height: b.height }, score: d.detection.score };
        }),
      });
    } finally {
      img.tensor.dispose();
    }
  }

  const report = benchReport({ photos, enrolments, autoLines: lines, suggestLine });
  console.log(formatBenchReport(report));
  const read = photos.length - unreadable;
  console.log(`\ntime: ${read ? (ms / read).toFixed(0) : '—'} ms per photo (detect + describe, ${api.tf.getBackend()})`);
  if (unreadable) console.log(`⚠ ${unreadable} photo(s) were not 3-channel RGB — the server reads no face there either`);
  if (layout.selfieAlsoPhoto.length) console.log(`⚠ left out as event photos (same bytes as a selfie): ${layout.selfieAlsoPhoto.join(', ')}`);

  if (jsonOut) {
    const byKey = new Map(photos.map((p) => [p.key, p.paths]));
    const pairs = benchPairs(photos, enrolments).map((p) => ({
      photo: byKey.get(p.photoKey)?.[0] ?? p.photoKey,
      person: p.person,
      present: p.present,
      distance: Number.isFinite(p.distance) ? Number(p.distance.toFixed(4)) : null,
      closestFaceDetectorPx: p.closestFace ? Number(p.closestFace.detectorPx.toFixed(1)) : null,
    }));
    writeFileSync(jsonOut, JSON.stringify({ settings: { maxSide, maxSelfies: maxSelfies ?? null, suggestLine }, report, pairs }, null, 2));
    console.error(`bench: wrote ${jsonOut} (distances and file names only — no face descriptor)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
