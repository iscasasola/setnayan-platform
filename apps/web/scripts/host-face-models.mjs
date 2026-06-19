#!/usr/bin/env node
// host-face-models.mjs — one-shot activation of Papic face auto-tagging.
//
// Downloads the validated face-api.js model set + library from the public CDN,
// uploads all of it to the PUBLIC R2 media bucket under `face-models/`, then
// prints (or, with --activate, runs) the Vercel step that flips the feature on.
// The face model is self-hosted on R2 so `next build` never bundles the heavy
// lib (the #1258 OOM); see lib/face-embed.ts + OWNER_ACTIONS.md.
//
// Reads R2 credentials from the environment AT RUNTIME (never stored or logged):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_MEDIA
//   R2_PUBLIC_URL  — the bucket's public host (e.g. https://media.setnayan.com)
// These are "Sensitive" in Vercel (not readable via `vercel env pull`), so grab
// them from your Cloudflare R2 dashboard for the one run.
//
// Usage (from apps/web):
//   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
//   R2_BUCKET_MEDIA=… R2_PUBLIC_URL=… node scripts/host-face-models.mjs [--activate]
//   # or: pnpm host:face-models -- --activate
//
// Flags:
//   (default)      host the files on R2, then print the exact Vercel commands.
//   --activate     ALSO set NEXT_PUBLIC_FACE_MODEL_URL in Vercel prod + redeploy
//                  (i.e. turn biometric auto-tagging ON — see the validation note).
//   --upload-only  host the files and stop (don't even print the Vercel step).
//
// Idempotent: re-running re-uploads the same keys. To turn the feature OFF,
// `vercel env rm NEXT_PUBLIC_FACE_MODEL_URL production` + redeploy — no data touched.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

const CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15';
const NETS = ['ssd_mobilenetv1', 'face_landmark_68', 'face_recognition'];
const PREFIX = 'face-models';

const args = new Set(process.argv.slice(2));
const ACTIVATE = args.has('--activate');
const UPLOAD_ONLY = args.has('--upload-only');

// ── env ──
const need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_MEDIA'];
const missing = need.filter((n) => !process.env[n]);
if (missing.length) {
  console.error(`✗ Missing required env: ${missing.join(', ')}`);
  console.error('  Grab these from your Cloudflare R2 dashboard and re-run.');
  process.exit(1);
}
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_MEDIA,
  R2_PUBLIC_URL,
} = process.env;
if (!R2_PUBLIC_URL) {
  console.warn('⚠ R2_PUBLIC_URL not set — I will host the files but can\'t print the exact model URL.');
}

const contentType = (f) =>
  extname(f) === '.json' ? 'application/json'
  : extname(f) === '.js' ? 'application/javascript'
  : 'application/octet-stream';

async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed (${r.status}) ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// ── 1) resolve the exact file set (parse each manifest for its weight shards) ──
console.log('Resolving model files from the CDN…');
const files = new Map(); // name -> Buffer
files.set('face-api.js', await download(`${CDN}/dist/face-api.js`));
for (const net of NETS) {
  const manName = `${net}_model-weights_manifest.json`;
  const manBuf = await download(`${CDN}/model/${manName}`);
  files.set(manName, manBuf);
  const manifest = JSON.parse(manBuf.toString('utf8'));
  const paths = [...new Set(manifest.flatMap((g) => g.paths))];
  for (const p of paths) files.set(p, await download(`${CDN}/model/${p}`));
}
const totalMB = ([...files.values()].reduce((a, b) => a + b.length, 0) / 1e6).toFixed(1);
console.log(`  ✓ ${files.size} files (${totalMB} MB)`);

// ── 2) upload to the public media bucket under face-models/ ──
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
console.log(`Uploading → r2://${R2_BUCKET_MEDIA}/${PREFIX}/`);
for (const [name, Body] of files) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_MEDIA,
    Key: `${PREFIX}/${name}`,
    Body,
    ContentType: contentType(name),
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`  ✓ ${PREFIX}/${name}  [${contentType(name)}]`);
}

const modelUrl = R2_PUBLIC_URL
  ? `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${PREFIX}`
  : `<your-R2-public-host>/${PREFIX}`;
console.log(`\n✓ Model hosted.  NEXT_PUBLIC_FACE_MODEL_URL = ${modelUrl}`);

// ── 3) activation ──
if (UPLOAD_ONLY) {
  console.log('\n(--upload-only) Files are hosted; the feature stays DORMANT until the env var is set.');
  process.exit(0);
}

if (ACTIVATE) {
  if (!R2_PUBLIC_URL) {
    console.error('\n✗ --activate needs R2_PUBLIC_URL to know the model URL. Set it and re-run, or activate manually below.');
  } else {
    console.log('\nActivating in Vercel (production)…');
    // Make it idempotent: drop any existing value first (ignore "not found").
    spawnSync('vercel', ['env', 'rm', 'NEXT_PUBLIC_FACE_MODEL_URL', 'production', '--yes'],
      { stdio: ['ignore', 'inherit', 'ignore'] });
    const add = spawnSync('vercel', ['env', 'add', 'NEXT_PUBLIC_FACE_MODEL_URL', 'production'],
      { input: `${modelUrl}\n`, stdio: ['pipe', 'inherit', 'inherit'] });
    if (add.status !== 0) {
      console.error('  ⚠ `vercel env add` failed (not logged in / project not linked?). Set it manually below.');
    } else {
      const dep = spawnSync('vercel', ['--prod'], { stdio: 'inherit' });
      if (dep.status !== 0) console.error('  ⚠ `vercel --prod` failed — redeploy manually.');
      else console.log('\n✓ Env var set + redeploy triggered.');
    }
  }
}

console.log(`
${ACTIVATE ? '' : `TO ACTIVATE (turns biometric auto-tagging ON):
    vercel env add NEXT_PUBLIC_FACE_MODEL_URL production   # value: ${modelUrl}
    vercel --prod
`}
  • Validate on a REAL device first: one selfie + two photos — confirm same-person
    matches and different-person doesn't. (Calibration lives in lib/face-match-core.ts.)
  • Turn OFF instantly, no data touched:
    vercel env rm NEXT_PUBLIC_FACE_MODEL_URL production && vercel --prod
`);
