#!/usr/bin/env node
// ============================================================================
// Stories+SDE P0 — offline beat-grid analyzer for the Patiktok music catalogue.
// ============================================================================
//
// ONE-TIME / ad-hoc offline job. Given the seeded `reel_music_tracks`
// (their `source_url`s) OR a local JSON manifest of tracks, it decodes each
// audio file to mono PCM, detects the tempo + beat onsets with `music-tempo`,
// and emits a `beat_grid` JSON object per track (the shape stored in the
// nullable `reel_music_tracks.beat_grid` JSONB column — added by migration
// 20270307940821_add_beat_grid_to_patiktok_music_tracks.sql, table since
// renamed to reel_music_tracks 2026-06-29).
//
// The render path DOES consume beat_grid (lib/guest-stories.ts pickMusic →
// lib/reel-render.ts → lib/stories-templates.ts; NULL grid → even-split
// fallback). A NULL grid is harmless (reels still render, just not beat-snapped)
// — so this job is the "make cuts land on the beat" upgrade, run once the owned
// masters are ingested. By default it ONLY PRINTS the computed grids (or writes
// a local --out file). It NEVER writes prod directly. Run it manually:
//
//   # from a local manifest of {track_slug, source_url} (recommended for P0):
//   node scripts/analyze-beat-grids.mjs --manifest ./tracks.json --out ./grids.json
//
//   # or pull rows from a NON-PROD Supabase, print grids (no write):
//   SUPABASE_URL=https://<staging>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role> \
//     node scripts/analyze-beat-grids.mjs
//
//   # write grids back (NON-PROD only; refuses the known prod ref):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/analyze-beat-grids.mjs --write
//
//   # PROD PATH — never a direct write: emit an idempotent migration instead.
//   # Reads (incl. prod) are fine; --emit-migration reuses the new-migration.mjs
//   # allocator → a CI-safe migration that lands the grids via PR → db push:
//   node scripts/analyze-beat-grids.mjs --manifest ./tracks.json --emit-migration
//
// DEPENDENCIES (devDependencies of apps/web — script-only, NOT bundled):
//   • music-tempo   — pure-JS tempo + beat detection (zero native deps).
//   • audio-decode  — pure-JS/WASM decoders (mp3/wav/flac/…); dynamically
//     imported so a missing optional codec never breaks `--help`.
//   • @supabase/supabase-js — only used when reading/writing the DB.
//
// See scripts/README.beat-grids.md for the full how-to.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Beat-grid computation is shared with scripts/ingest-owned-music.mjs so the two
// scripts can never drift on the algorithm or the stored JSON shape.
import { computeBeatGrid, loadBytes } from './lib/beat-grid.mjs';

// Refuse to WRITE to the known prod project ref. (Reads are harmless; writes
// are gated. Mirrors the guard in scripts/seed-demo-vendors.ts.)
const PROD_PROJECT_REF = process.env.BEAT_GRIDS_PROD_REF ?? 'njrupjnvkjkitfctetvi';

function parseArgs(argv) {
  const args = { write: false, emitMigration: false, manifest: null, out: null, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') args.write = true;
    else if (a === '--emit-migration') args.emitMigration = true;
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
analyze-beat-grids — compute beat_grid JSON for reel_music_tracks (offline).

USAGE
  node scripts/analyze-beat-grids.mjs [--manifest <file.json>] [--out <file.json>]
                                      [--write | --emit-migration] [--limit <n>]

SOURCES (pick one)
  --manifest <file>   Local JSON array of { track_slug, source_url } (or a path/
                      url to a local audio file). No DB needed. RECOMMENDED P0.
  (default)           Read active rows from Supabase using SUPABASE_URL +
                      SUPABASE_SERVICE_ROLE_KEY env vars.

OUTPUT
  (default)           Print a { track_slug: beat_grid } map to stdout.
  --out <file>        Also write that map to <file> (local JSON).
  --write             Write each beat_grid back to reel_music_tracks.
                      Refuses the prod project ref "${PROD_PROJECT_REF}".
  --emit-migration    PROD PATH (never a direct write): allocate a CI-safe
                      migration (via new-migration.mjs) of idempotent
                      reel_music_tracks.beat_grid UPDATEs. Land it via PR → db push.

beat_grid shape: { bpm, beats:number[] (sec), downbeats?:number[], source, analyzed_at }
`);
}

// Audio decode + beat detection + source-bytes loading now live in the shared
// scripts/lib/beat-grid.mjs module (imported above).

// --- track sources ----------------------------------------------------------
async function tracksFromManifest(file) {
  const raw = JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8'));
  if (!Array.isArray(raw)) throw new Error('manifest must be a JSON array');
  return raw
    .map((t) => ({ track_slug: t.track_slug ?? t.slug, source_url: t.source_url ?? t.url }))
    .filter((t) => t.track_slug);
}

async function makeSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to read/write the DB, or ' +
        'pass --manifest <file> to skip the DB entirely.',
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return { client: createClient(url, key, { auth: { persistSession: false } }), url };
}

async function tracksFromDb(client, limit) {
  const { data, error } = await client
    .from('reel_music_tracks')
    .select('track_slug, source_url, is_active')
    .eq('is_active', true)
    .limit(Number.isFinite(limit) ? limit : 1000);
  if (error) throw new Error(`DB read failed: ${error.message}`);
  return data ?? [];
}

// --- prod path: emit an idempotent migration (no direct prod write) ---------
// Reuses scripts/new-migration.mjs so the file gets a collision-safe, never-
// round prefix that passes the CI "migration timestamp guard". The body is pure
// UPDATEs (idempotent; a track missing in prod matches 0 rows and is skipped).
const sqlLit = (s) => String(s).replace(/'/g, "''");

async function emitMigration(grids) {
  const slugs = Object.keys(grids);
  if (!slugs.length) {
    console.error('· --emit-migration: no grids computed — nothing to emit.');
    return;
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const allocator = resolve(scriptDir, 'new-migration.mjs');
  // new-migration.mjs prints "✓ Created supabase/migrations/<prefix>_<slug>.sql".
  const out = execSync(`node ${JSON.stringify(allocator)} "populate reel music beat grids"`, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const m = /supabase\/migrations\/(\S+\.sql)/.exec(out);
  if (!m) throw new Error(`could not parse the allocated path from new-migration.mjs:\n${out}`);
  const rel = m[1];
  const migPath = resolve(repoRoot, 'supabase', 'migrations', rel);

  const lines = [
    '-- populate reel music beat grids',
    '-- Generated by scripts/analyze-beat-grids.mjs --emit-migration.',
    '-- PROD PATH: the analyzer refuses --write to prod, so beat grids reach prod',
    '-- through this migration (file → PR → CI → `supabase db push`).',
    '-- Idempotent: UPDATE-only; re-applying just re-sets the same grids, and a',
    '-- track not present in prod matches 0 rows (silently skipped).',
    '',
    'BEGIN;',
    '',
  ];
  for (const slug of slugs) {
    const json = sqlLit(JSON.stringify(grids[slug]));
    lines.push(
      `UPDATE public.reel_music_tracks SET beat_grid = '${json}'::jsonb WHERE track_slug = '${sqlLit(slug)}';`,
    );
  }
  lines.push('', 'COMMIT;', '');
  await writeFile(migPath, lines.join('\n'));
  console.error(
    `\n→ wrote migration supabase/migrations/${rel} (${slugs.length} track grid${slugs.length === 1 ? '' : 's'}).`,
  );
  console.error('  Review it, commit on a branch, open a PR; CI + `supabase db push` apply it to prod.');
}

// --- main -------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  let supa = null;
  let tracks = [];
  if (args.manifest) {
    tracks = await tracksFromManifest(args.manifest);
  } else {
    supa = await makeSupabase();
    if (args.write && supa.url.includes(PROD_PROJECT_REF)) {
      console.error(
        `\nREFUSING TO --write: SUPABASE_URL points at the prod ref "${PROD_PROJECT_REF}".\n` +
          'Run against a test/staging project, or drop --write to only print grids.\n',
      );
      process.exit(1);
    }
    tracks = await tracksFromDb(supa.client, args.limit);
  }

  if (Number.isFinite(args.limit)) tracks = tracks.slice(0, args.limit);
  if (!tracks.length) {
    console.error('No tracks to analyze.');
    process.exit(1);
  }

  const grids = {};
  let ok = 0;
  let skipped = 0;
  for (const t of tracks) {
    if (!t.source_url) {
      console.error(`· skip ${t.track_slug} — no source_url (catalogue not ingested yet)`);
      skipped++;
      continue;
    }
    try {
      process.stderr.write(`· analyzing ${t.track_slug} … `);
      const bytes = await loadBytes(t.source_url);
      const grid = await computeBeatGrid(bytes);
      grids[t.track_slug] = grid;
      ok++;
      process.stderr.write(`bpm=${grid.bpm} beats=${grid.beats.length}\n`);
      if (args.write && supa) {
        const { error } = await supa.client
          .from('reel_music_tracks')
          .update({ beat_grid: grid })
          .eq('track_slug', t.track_slug);
        if (error) console.error(`  ! write failed for ${t.track_slug}: ${error.message}`);
      }
    } catch (e) {
      console.error(`\n  ! ${t.track_slug}: ${e?.message ?? e}`);
      skipped++;
    }
  }

  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);
    await writeFile(outPath, JSON.stringify(grids, null, 2));
    console.error(`\n→ wrote ${ok} grid(s) to ${outPath}`);
  } else if (!args.emitMigration) {
    process.stdout.write(JSON.stringify(grids, null, 2) + '\n');
  }

  if (args.emitMigration) await emitMigration(grids);

  const sink = args.write ? ' (written to DB)' : args.emitMigration ? ' (migration emitted)' : ' (no DB write)';
  console.error(`\nDone. analyzed=${ok} skipped=${skipped}${sink}.`);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});

// Silence "unused" for the guard import path on checkouts without the file.
void existsSync;
