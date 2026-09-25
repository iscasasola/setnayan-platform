/**
 * upload-theme-loops-to-r2.ts — put the nine theme loops and their stills on the
 * PUBLIC media bucket, at exactly the keys `lib/invite-themes.ts` names.
 *
 * Event Hub Maker Phase 3 (build plan D11): the loops go to `setnayan-media`
 * (served from its r2.dev URL, egress free) — never to `public/`, because Vercel
 * bandwidth is the bill. "Uploaded once by admin."
 *
 * ── WHAT IT UPLOADS ─────────────────────────────────────────────────────────
 * For every Pro theme in the registry, its `media.loop` and `media.poster` refs
 * (`r2://setnayan-media/theme-backgrounds/2026-09-24/<slug>-loop.mp4` / `-poster.jpg`),
 * read from the corpus asset folder:
 *   ~/Documents/Claude/Projects/Setnayan/assets/theme-backgrounds-2026-09-24/
 * The KEYS COME FROM THE REGISTRY, not from a list here, so a theme added there
 * is uploaded by the same command and a key can never drift from what the page
 * requests. The two duplicate files in that folder
 * (`ballroom-velvet-chandeliers-*` = `luxe-*`, `modern-b-*` = `modern-*`) and
 * the alternate `modern-a-*` are not named by any theme and are not uploaded.
 *
 * `Cache-Control: public, max-age=31536000, immutable` — the keys are dated, so
 * a re-cut loop gets a new folder, never an overwrite a browser would not see.
 *
 * ── HOW TO RUN (owner / admin — needs the real R2 write keys) ────────────────
 *   cd apps/web
 *   set -a; source .env.local; set +a        # R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   npx tsx scripts/upload-theme-loops-to-r2.ts            # dry run: prints every key + size
 *   npx tsx scripts/upload-theme-loops-to-r2.ts --apply    # uploads
 *
 * Verify afterwards (no credentials needed — the bucket is public):
 *   curl -sI https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/theme-backgrounds/2026-09-24/luxe-loop.mp4
 *
 * Until it has run, every Pro theme still renders — on its plain canvas colour
 * with the same scrim, fully readable — just without the moving background.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { HUB_THEMES, themeMediaKey } from '../lib/invite-themes';

const SOURCE = path.join(os.homedir(), 'Documents/Claude/Projects/Setnayan/assets/theme-backgrounds-2026-09-24');
const BUCKET = 'setnayan-media';
const APPLY = process.argv.includes('--apply');

type Job = { key: string; file: string; type: string; bytes: number };

const jobs: Job[] = [];
const missing: string[] = [];
for (const theme of HUB_THEMES) {
  if (!theme.media) continue;
  for (const ref of [theme.media.loop, theme.media.poster]) {
    const key = themeMediaKey(ref);
    if (!key) throw new Error(`${theme.id}: ${ref} is not a public-bucket ref`);
    const file = path.join(SOURCE, path.basename(key));
    if (!fs.existsSync(file)) {
      missing.push(`${theme.id}: ${file}`);
      continue;
    }
    jobs.push({
      key,
      file,
      type: key.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
      bytes: fs.statSync(file).size,
    });
  }
}

if (missing.length > 0) {
  console.error(`FAILED: ${missing.length} source file(s) missing:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const total = jobs.reduce((n, j) => n + j.bytes, 0);
for (const j of jobs) console.log(`${(j.bytes / 1e6).toFixed(2).padStart(6)} MB  ${j.type.padEnd(10)}  ${BUCKET}/${j.key}`);
console.log(`${jobs.length} files, ${(total / 1e6).toFixed(1)} MB total`);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to upload.');
  process.exit(0);
}

for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const) {
  if (!process.env[key]) {
    console.error(`FAILED: ${key} is not set. Source the real .env.local before running this.`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main(): Promise<void> {
  for (const j of jobs) {
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: j.key,
        Body: fs.readFileSync(j.file),
        ContentType: j.type,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`uploaded ${j.key}`);
  }
  console.log('done');
}

main().catch((err: unknown) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
