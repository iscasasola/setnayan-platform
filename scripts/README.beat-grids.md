# `analyze-beat-grids.mjs` — offline beat-grid analyzer (Stories+SDE P0)

One-time / ad-hoc offline job that computes a **`beat_grid`** for each Setnayan
music track and (optionally) writes it back to the nullable
`reel_music_tracks.beat_grid` JSONB column (column added by migration
`20270307940821_add_beat_grid_to_patiktok_music_tracks.sql`; the table was
renamed from `patiktok_music_tracks` → `reel_music_tracks` on 2026-06-29).

This is **inert groundwork** for beat-aware Stories/SDE rendering. Nothing in the
app reads `beat_grid` yet — that lands in a later phase. By default the script
only **prints** the grids; it never touches prod unless you explicitly pass
`--write` against a non-prod Supabase.

## What a `beat_grid` looks like

```json
{
  "bpm": 108,
  "beats": [0.55, 1.10, 1.66, 2.21],
  "downbeats": [0.55, 2.77],
  "source": "music-tempo",
  "analyzed_at": "2026-06-28T00:00:00.000Z"
}
```

- `bpm` + `beats` (seconds, ascending) are always present.
- `downbeats` is optional (inferred as every 4th beat under a 4/4 assumption).
- `NULL` in the DB → consumers fall back to the legacy even time-split.

## Dependencies

Script-only **devDependencies of `apps/web`** (NOT bundled into the web build —
`scripts/` is never imported by app code):

- [`music-tempo`](https://www.npmjs.com/package/music-tempo) — pure-JS tempo +
  beat detection, zero native deps.
- [`audio-decode`](https://www.npmjs.com/package/audio-decode) — pure-JS/WASM
  decoders (mp3/wav/flac/…), dynamically imported.

Install once: `pnpm install` (run from repo root or `apps/web`).

## How to run

Run it **manually** — it is not wired into CI or any build step.

### A) From a local manifest (recommended for P0 — no DB needed)

Create a manifest of the tracks you want to analyze:

```json
[
  { "track_slug": "br_quartet_sunset", "source_url": "./samples/br_quartet_sunset.mp3" },
  { "track_slug": "pop_summer_glow",   "source_url": "https://r2.example/pop_summer_glow.mp3" }
]
```

`source_url` may be a **local file path** or an **http(s) URL**. Then:

```bash
# print the grids to stdout
node scripts/analyze-beat-grids.mjs --manifest ./tracks.json

# or write them to a local JSON file
node scripts/analyze-beat-grids.mjs --manifest ./tracks.json --out ./grids.json
```

### B) Pull rows from a NON-PROD Supabase and print (no write)

```bash
SUPABASE_URL=https://<staging-or-test>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  node scripts/analyze-beat-grids.mjs
```

### C) Write grids back (NON-PROD only)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/analyze-beat-grids.mjs --write
```

The script **refuses to `--write`** when `SUPABASE_URL` contains the known prod
project ref (override the guarded ref via `BEAT_GRIDS_PROD_REF` only if you know
what you're doing). Reads are always allowed; only writes are gated.

> Note: most seeded catalogue rows currently have `source_url = NULL` (the Suno
> Premier masters aren't ingested yet) — those are **skipped** with a message.
> Point the script at real audio (manifest or ingested URLs) when the catalogue
> lands.

## Flags

| Flag | Effect |
|---|---|
| `--manifest <file>` | Read `{track_slug, source_url}[]` from a local JSON file (skips the DB). |
| `--out <file>` | Write the `{track_slug: beat_grid}` map to a local JSON file. |
| `--write` | Update `reel_music_tracks.beat_grid` in the DB (non-prod only). |
| `--limit <n>` | Cap how many tracks are analyzed. |
| `--help` | Usage. |
