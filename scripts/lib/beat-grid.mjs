// ============================================================================
// Shared beat-grid computation for the owned reel-music catalogue.
// ============================================================================
//
// Pure, side-effect-free helpers used by BOTH offline music scripts:
//   • scripts/analyze-beat-grids.mjs  — (re)compute grids for tracks already in
//     reel_music_tracks (or a manifest), print / --emit-migration them.
//   • scripts/ingest-owned-music.mjs  — upload owned MP3 masters to R2 and emit
//     an upsert migration (rows + grids) in one command.
//
// The `beat_grid` JSON shape stored in reel_music_tracks.beat_grid (JSONB) is:
//   { bpm, beats:number[] (sec), downbeats?:number[], source, analyzed_at }
// The render path consumes it (lib/guest-stories.ts → lib/reel-render.ts →
// lib/stories-templates.ts); a NULL grid is harmless (even-split fallback).
//
// DEPENDENCIES (devDependencies of apps/web — script-only, NOT bundled):
//   • music-tempo   — pure-JS tempo + beat detection (zero native deps).
//   • audio-decode  — pure-JS/WASM decoders (mp3/wav/flac/…); dynamically
//     imported so a missing optional codec never breaks `--help`.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// reel_music_tracks.bpm is `NOT NULL CHECK (bpm BETWEEN 40 AND 220)`. Fold an
// out-of-range tempo into the valid octave (music-tempo occasionally reports a
// half/double-time figure) so the row insert never trips the CHECK.
export function clampBpm(bpm) {
  let v = Number(bpm);
  if (!Number.isFinite(v) || v <= 0) return 120; // safe default
  while (v < 40) v *= 2;
  while (v > 220) v /= 2;
  return Math.round(v);
}

// --- audio decode → mono Float32 PCM + sampleRate ---------------------------
export async function decodeToMonoPcm(bytes) {
  // Dynamic import so callers' `--help` works even if the optional codec deps
  // aren't installed in a given checkout.
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

  // Normalise across audio-decode shapes: older builds returned a Web-Audio
  // AudioBuffer (getChannelData()/numberOfChannels/length); audio-decode >=3
  // returns a plain `{ channelData: Float32Array[], sampleRate }`. Support both.
  const sampleRate = audioBuffer.sampleRate;
  let channels;
  if (typeof audioBuffer.getChannelData === 'function') {
    const n = audioBuffer.numberOfChannels ?? 1;
    channels = Array.from({ length: n }, (_, ch) => audioBuffer.getChannelData(ch));
  } else if (Array.isArray(audioBuffer.channelData)) {
    channels = audioBuffer.channelData;
  } else {
    throw new Error('audio-decode returned an unrecognised buffer shape.');
  }
  if (!channels.length || !channels[0]?.length) {
    throw new Error('decoded audio has no samples.');
  }

  // Downmix to mono.
  const numberOfChannels = channels.length;
  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = channels[ch];
    for (let i = 0; i < length; i++) mono[i] += data[i] / numberOfChannels;
  }
  return { mono, sampleRate };
}

// --- beat detection ---------------------------------------------------------
export async function computeBeatGrid(bytes) {
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
export async function loadBytes(sourceUrl) {
  if (!sourceUrl) throw new Error('track has no source_url');
  if (/^https?:\/\//i.test(sourceUrl)) {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`fetch ${sourceUrl} → HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = resolve(process.cwd(), sourceUrl);
  return new Uint8Array(await readFile(path));
}
