#!/usr/bin/env node
// ============================================================================
// Stories+SDE P0 — offline beat-grid analyzer for the Patiktok music catalogue.
// ============================================================================
//
// ONE-TIME / ad-hoc offline job. Given the seeded `patiktok_music_tracks`
// (their `source_url`s) OR a local JSON manifest of tracks, it decodes each
// audio file to mono PCM, detects the tempo + beat onsets with `music-tempo`,
// and emits a `beat_grid` JSON object per track (the shape stored in the new
// nullable `patiktok_music_tracks.beat_grid` JSONB column — see migration
// 20270307940821_add_beat_grid_to_patiktok_music_tracks.sql).
//
// THIS SCRIPT IS INERT GROUNDWORK. By default it ONLY PRINTS the computed
// grids (or writes them to a local --out file). It NEVER writes prod unless you
// explicitly pass `--write` AND a non-prod Supabase URL. Run it manually:
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
// DEPENDENCIES (devDependencies of apps/web — script-only, NOT bundled):
//   • music-tempo   — pure-JS tempo + beat detection (zero native deps).
//   • audio-decode  — pure-JS/WASM decoders (mp3/wav/flac/…); dynamically
//     imported so a missing optional codec never breaks `--help`.
//   • @supabase/supabase-js — only used when reading/writing the DB.
//
// See scripts/README.beat-grids.md for the full how-to.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Refuse to WRITE to the known prod project ref. (Reads are harmless; writes
// are gated. Mirrors the guard in scripts/seed-demo-vendors.ts.)
const PROD_PROJECT_REF = process.env.BEAT_GRIDS_PROD_REF ?? 'njrupjnvkjkitfctetvi';

function parseArgs(argv) {
  const args = { write: false, manifest: null, out: null, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') args.write = true;
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
analyze-beat-grids — compute beat_grid JSON for patiktok_music_tracks (offline).

USAGE
  node scripts/analyze-beat-grids.mjs [--manifest <file.json>] [--out <file.json>]
                                      [--write] [--limit <n>]

SOURCES (pick one)
  --manifest <file>   Local JSON array of { track_slug, source_url } (or a path/
                      url to a local audio file). No DB needed. RECOMMENDED P0.
  (default)           Read active rows from Supabase using SUPABASE_URL +
                      SUPABASE_SERVICE_ROLE_KEY env vars.

OUTPUT
  (default)           Print a { track_slug: beat_grid } map to stdout.
  --out <file>        Also write that map to <file> (local JSON).
  --write             Write each beat_grid back to patiktok_music_tracks.
                      Refuses the prod project ref "${PROD_PROJECT_REF}".

beat_grid shape: { bpm, beats:number[] (sec), downbeats?:number[], source, analyzed_at }
`);
}

// --- audio decode → mono Float32 PCM + sampleRate ---------------------------
async function decodeToMonoPcm(bytes) {
  // Dynamic import so `--help` works even if the optional codec deps aren't
  // installed in a given checkout.
  let decode;
  try {
    ({ default: decode } = await import('audio-decode'));
  } catch (e) {
    throw new Error(
      'audio-decode is not installed. Run `pnpm install` in apps/web (it is a ' +
        'devDependency there), or run this script from apps/web. ' +
        `Underlying error: ${e?.message ?? e}`,
    );
  }
  const audioBuffer = await decode(bytes);
  const { numberOfChannels, sampleRate, length } = audioBuffer;
  // Downmix to mono.
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numberOfChannels;
  }
  return { mono, sampleRate };
}

// --- beat detection ---------------------------------------------------------
async function computeBeatGrid(bytes) {
  const { default: MusicTempo } = await import('music-tempo');
  const { mono } = await decodeToMonoPcm(bytes);
  // music-tempo wants a plain Array of samples.
  const mt = new MusicTempo(Array.from(mono));
  const bpm = Number(mt.tempo);
  // mt.beats is an array of beat times in SECONDS.
  const beats = (mt.beats ?? [])
    .map((b) => Math.round(Number(b) * 1000) / 1000)
    .filter((b) => Number.isFinite(b) && b >= 0)
    .sort((a, b) => a - b);
  if (!beats.length) throw new Error('music-tempo found no beats.');
  // Infer downbeats as every 4th beat (4/4 assumption) when we have enough.
  const downbeats = beats.length >= 4 ? beats.filter((_, i) => i % 4 === 0) : undefined;
  return {
    bpm: Number.isFinite(bpm) ? Math.round(bpm) : 0,
    beats,
    ...(downbeats ? { downbeats } : {}),
    source: 'music-tempo',
    analyzed_at: new Date().toISOString(),
  };
}

// --- fetch source bytes (local path OR http(s) url) -------------------------
async function loadBytes(sourceUrl) {
  if (!sourceUrl) throw new Error('track has no source_url');
  if (/^https?:\/\//i.test(sourceUrl)) {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`fetch ${sourceUrl} → HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = resolve(process.cwd(), sourceUrl);
  return new Uint8Array(await readFile(path));
}

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
    .from('patiktok_music_tracks')
    .select('track_slug, source_url, is_active')
    .eq('is_active', true)
    .limit(Number.isFinite(limit) ? limit : 1000);
  if (error) throw new Error(`DB read failed: ${error.message}`);
  return data ?? [];
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
          .from('patiktok_music_tracks')
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
  } else {
    process.stdout.write(JSON.stringify(grids, null, 2) + '\n');
  }
  console.error(`\nDone. analyzed=${ok} skipped=${skipped}${args.write ? ' (written to DB)' : ' (no DB write)'}.`);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});

// Silence "unused" for the guard import path on checkouts without the file.
void existsSync;
