#!/usr/bin/env node
// ============================================================================
// Owned reel-music ingest — one command to land a Suno/owned MP3 batch.
// ============================================================================
//
// Turns a folder of Setnayan-OWNED audio masters (e.g. a Suno Premier batch,
// downloaded + owned outright — NEVER major-label) into:
//   1. R2 objects under  setnayan-media/reel-music/<slug>.<ext>, and
//   2. an idempotent migration that UPSERTs reel_music_tracks rows
//      (track_slug, display_name, bpm, source_url, is_premium, is_active,
//      beat_grid) — so the free Guest Stories render path (lib/guest-stories.ts
//      pickMusic) has owned, beat-snapped tracks to render over.
//
// PROD-SAFE BY CONSTRUCTION: like scripts/analyze-beat-grids.mjs, this NEVER
// writes the prod DB directly. R2 upload is fine (object storage, not the DB);
// the row + beat-grid changes reach prod through the emitted migration:
//   file → PR → CI → `supabase db push`.
// The migration is UPSERT-only and idempotent (re-running re-sets the same
// rows), so a re-ingest is safe.
//
// USAGE
//   # full run — compute beat grids, upload masters to R2, emit the migration:
//   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
//     node scripts/ingest-owned-music.mjs --dir ./suno-batch --emit-migration
//
//   # dry run — compute grids + print the plan, NO R2 upload, NO creds needed:
//   node scripts/ingest-owned-music.mjs --dir ./suno-batch --dry-run
//
//   # with per-file display names / premium flags:
//   node scripts/ingest-owned-music.mjs --dir ./suno-batch \
//     --manifest ./tracks.json --emit-migration
//
// --manifest is an optional JSON array of overrides keyed by file basename:
//   [{ "file": "first-dance.mp3", "slug": "first-dance",
//      "display_name": "First Dance", "is_premium": false }, …]
// Anything omitted is derived from the filename (slug = kebab-cased basename,
// display_name = title-cased basename, is_premium = false).
//
// DEPENDENCIES (devDependencies of apps/web — run from apps/web, or after a
// `pnpm install` there): music-tempo, audio-decode, @aws-sdk/client-s3. All are
// dynamically imported so `--help` works in any checkout.
//
// See scripts/README.beat-grids.md for the sibling analyzer + the beat shape.
// ============================================================================

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeBeatGrid, clampBpm } from './lib/beat-grid.mjs';

const BUCKET = 'setnayan-media';
const KEY_PREFIX = 'reel-music';
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac']);
const CONTENT_TYPE = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
};

function parseArgs(argv) {
  const args = {
    dir: null,
    manifest: null,
    out: null,
    emitMigration: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--emit-migration') args.emitMigration = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    `\ningest-owned-music — upload owned audio masters to R2 + emit a reel_music_tracks upsert migration.\n\n` +
      `USAGE\n` +
      `  node scripts/ingest-owned-music.mjs --dir <folder> [options]\n\n` +
      `OPTIONS\n` +
      `  --dir <folder>      Folder of owned audio masters (.mp3/.wav/.m4a/.flac/.ogg/.aac). Required.\n` +
      `  --manifest <file>   Optional JSON [{ file, slug, display_name, is_premium }] overrides.\n` +
      `  --emit-migration    Write an idempotent reel_music_tracks UPSERT migration (rows + grids).\n` +
      `  --dry-run           Compute grids + print the plan; NO R2 upload, NO creds required.\n` +
      `  --out <file>        Also write the computed rows to a JSON file.\n` +
      `  --help              This help.\n\n` +
      `ENV (for the real upload; not needed with --dry-run)\n` +
      `  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n\n` +
      `Owned audio only (Suno/commissioned). Never major-label. Prod DB is never written directly —\n` +
      `the emitted migration lands the rows via PR → CI → \`supabase db push\`.\n\n`,
  );
}

// slug = kebab-cased basename (no ext); display = title-cased.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
function titleize(name) {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadManifest(file) {
  if (!file) return new Map();
  const raw = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('manifest must be a JSON array');
  const byFile = new Map();
  for (const e of raw) if (e?.file) byFile.set(e.file, e);
  return byFile;
}

// Lazily build an S3 client pointed at R2 (dynamic import so --help/--dry-run
// don't require the SDK). Mirrors apps/web/lib/r2.ts's endpoint + creds.
async function makeR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY to upload, ' +
        'or pass --dry-run to skip the upload.',
    );
  }
  let S3Client, PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'));
  } catch (e) {
    throw new Error(
      '@aws-sdk/client-s3 is not installed. Run this from apps/web (it is a ' +
        'dependency there) or `pnpm install` there. Underlying: ' +
        (e?.message ?? e),
    );
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, PutObjectCommand };
}

const sqlLit = (s) => String(s).replace(/'/g, "''");

// Allocate a collision-safe migration via scripts/new-migration.mjs (same path
// the analyzer uses) and write an idempotent UPSERT block.
async function emitMigration(rows) {
  if (!rows.length) {
    console.error('· --emit-migration: no rows — nothing to emit.');
    return;
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const allocator = resolve(scriptDir, 'new-migration.mjs');
  const out = execSync(
    `node ${JSON.stringify(allocator)} "ingest owned reel music"`,
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const m = /supabase\/migrations\/(\S+\.sql)/.exec(out);
  if (!m) throw new Error(`could not parse the allocated path from new-migration.mjs:\n${out}`);
  const rel = m[1];
  const migPath = resolve(repoRoot, 'supabase', 'migrations', rel);

  const lines = [
    '-- ingest owned reel music',
    '-- Generated by scripts/ingest-owned-music.mjs --emit-migration.',
    '-- Owned audio masters (uploaded to R2 at setnayan-media/reel-music/) wired',
    '-- into reel_music_tracks so free Guest Stories render over owned, beat-snapped',
    '-- tracks. PROD PATH: rows reach prod via this migration (PR → CI → db push).',
    '-- Idempotent UPSERT: re-running re-sets the same rows.',
    '',
    'BEGIN;',
    '',
  ];
  for (const r of rows) {
    const grid = sqlLit(JSON.stringify(r.beat_grid));
    lines.push(
      `INSERT INTO public.reel_music_tracks`,
      `  (track_slug, display_name, bpm, source_url, is_premium, is_active, beat_grid)`,
      `VALUES`,
      `  ('${sqlLit(r.track_slug)}', '${sqlLit(r.display_name)}', ${r.bpm}, ` +
        `'${sqlLit(r.source_url)}', ${r.is_premium ? 'TRUE' : 'FALSE'}, TRUE, '${grid}'::jsonb)`,
      `ON CONFLICT (track_slug) DO UPDATE SET`,
      `  display_name = EXCLUDED.display_name,`,
      `  bpm          = EXCLUDED.bpm,`,
      `  source_url   = EXCLUDED.source_url,`,
      `  is_premium   = EXCLUDED.is_premium,`,
      `  is_active    = EXCLUDED.is_active,`,
      `  beat_grid    = EXCLUDED.beat_grid;`,
      '',
    );
  }
  lines.push('COMMIT;', '');
  await writeFile(migPath, lines.join('\n'));
  console.error(
    `\n→ wrote migration supabase/migrations/${rel} (${rows.length} track${rows.length === 1 ? '' : 's'}).`,
  );
  console.error('  Review it, commit on a branch, open a PR; CI + `supabase db push` apply it to prod.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.dir) {
    console.error('Missing --dir <folder>. Run with --help for usage.');
    process.exit(1);
  }

  const dirPath = resolve(process.cwd(), args.dir);
  const entries = await readdir(dirPath).catch((e) => {
    throw new Error(`cannot read --dir ${dirPath}: ${e?.message ?? e}`);
  });
  const files = entries
    .filter((f) => AUDIO_EXTS.has(extname(f).toLowerCase()))
    .sort();
  if (!files.length) {
    console.error(`No audio files (${[...AUDIO_EXTS].join(', ')}) in ${dirPath}.`);
    process.exit(1);
  }

  const overrides = await loadManifest(args.manifest);

  let r2 = null;
  if (!args.dryRun) r2 = await makeR2();

  const rows = [];
  const seen = new Set();
  let ok = 0;
  let skipped = 0;
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const base = basename(file, extname(file));
    const ov = overrides.get(file) ?? {};
    const slug = slugify(ov.slug ?? base);
    if (!slug) {
      console.error(`· skip ${file} — empty slug`);
      skipped++;
      continue;
    }
    if (seen.has(slug)) {
      console.error(`· skip ${file} — duplicate slug "${slug}"`);
      skipped++;
      continue;
    }
    const displayName = ov.display_name ?? titleize(base);
    const isPremium = Boolean(ov.is_premium);
    const key = `${KEY_PREFIX}/${slug}${ext}`;
    const sourceUrl = `r2://${BUCKET}/${key}`;
    try {
      process.stderr.write(`· ${file} → ${slug} … `);
      const bytes = await readFile(resolve(dirPath, file));
      const grid = await computeBeatGrid(new Uint8Array(bytes));
      const bpm = clampBpm(grid.bpm);
      if (!args.dryRun) {
        await r2.client.send(
          new r2.PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: bytes,
            ContentType: CONTENT_TYPE[ext] ?? 'application/octet-stream',
          }),
        );
      }
      rows.push({
        track_slug: slug,
        display_name: displayName,
        bpm,
        source_url: sourceUrl,
        is_premium: isPremium,
        beat_grid: grid,
      });
      seen.add(slug);
      ok++;
      process.stderr.write(
        `bpm=${bpm} beats=${grid.beats.length}${args.dryRun ? ' (dry-run, not uploaded)' : ' uploaded'}\n`,
      );
    } catch (e) {
      console.error(`\n  ! ${file}: ${e?.message ?? e}`);
      skipped++;
    }
  }

  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);
    await writeFile(outPath, JSON.stringify(rows, null, 2));
    console.error(`\n→ wrote ${rows.length} row(s) to ${outPath}`);
  }

  if (args.emitMigration) await emitMigration(rows);

  const sink = args.dryRun
    ? ' (dry-run — no upload, no migration)'
    : args.emitMigration
      ? ' (uploaded to R2 + migration emitted)'
      : ' (uploaded to R2; pass --emit-migration to wire the rows)';
  console.error(`\nDone. ingested=${ok} skipped=${skipped}${sink}.`);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});
