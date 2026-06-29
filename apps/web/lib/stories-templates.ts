/**
 * Stories P0 — beat-aware template manifest scaffold.
 *
 * PURE DATA + TYPES. No rendering, no DOM, no DB, no network. This module is
 * INERT groundwork: it defines the shape of a beat-aware Stories template and
 * the rules that a later phase's renderer will follow, plus the helpers that
 * turn a track's `beat_grid` (the JSONB column on `reel_music_tracks`,
 * added by migration 20270307940821_add_beat_grid_to_patiktok_music_tracks.sql;
 * table renamed from patiktok_music_tracks → reel_music_tracks 2026-06-29) into
 * a sequence of clip/photo SLOTS snapped to beats.
 *
 * It is intentionally decoupled from the existing client render engine
 * (`reel-render.ts`), which still does an even time-split today. Nothing
 * imports this yet — P1 (Stories surface) and P2 (beat-aware render) will.
 *
 * HARD PRODUCT CONSTRAINTS honored here (CLAUDE.md "Hard product constraints"):
 *   • 5-second hard cap on video clips — `CLIP_MAX_SEC = 5`. A slot that holds
 *     a guest/couple CLIP is never longer than 5s, even if the beat spacing
 *     would allow more.
 *   • Personal Reels are 1–30s — `STORIES_DURATION` covers the 30s template.
 *   • Photo slots snap to beats: a PHOTO slot's boundaries land on beat onsets
 *     so cuts hit the rhythm. (CLIP slots also start on a beat but are capped
 *     at 5s, so a long beat gap leaves a clip shorter than the gap.)
 *
 * No prices live here — Stories pricing is admin-catalog managed.
 */

import type { CameraMove } from './stories-camera-move';

// ---------------------------------------------------------------------------
// Beat grid — mirrors the reel_music_tracks.beat_grid JSONB shape
// ---------------------------------------------------------------------------

/**
 * The shape stored in `reel_music_tracks.beat_grid` (JSONB, nullable).
 * Produced offline by `scripts/analyze-beat-grids.mjs`. All times in SECONDS
 * from t=0. `beats` is ascending; `downbeats` (optional) is a subset marking
 * bar starts. NULL in the DB → consumers fall back to an even time-split.
 */
export type BeatGrid = {
  /** Detected tempo, beats per minute. */
  bpm: number;
  /** Ascending beat onset timestamps, in seconds from the start of the track. */
  beats: number[];
  /** Optional bar-start beats (a subset of `beats`). */
  downbeats?: number[];
  /** Analyzer provenance, e.g. "music-tempo". */
  source?: string;
  /** ISO-8601 timestamp the grid was computed. */
  analyzed_at?: string;
};

// ---------------------------------------------------------------------------
// Locked rules
// ---------------------------------------------------------------------------

/** 5-second hard cap on any CLIP slot (CLAUDE.md hard constraint). */
export const CLIP_MAX_SEC = 5;

/** Personal Reels render at 9:16 (1080×1920). Mirrors reel-render.ts. */
export const STORIES_ASPECT = { width: 1080, height: 1920 } as const;

/** A slot either shows a still PHOTO or plays a guest/couple CLIP. */
export type SlotMediaKind = 'photo' | 'clip';

/**
 * One beat-defined segment of a Stories template. Times are RELATIVE to the
 * reel start (seconds). A later phase fills `mediaRef` from the couple's picks;
 * the scaffold only describes the timing skeleton.
 */
export type StorySlot = {
  /** Reel-relative start time, seconds (lands on a beat onset). */
  startSec: number;
  /** Reel-relative end time, seconds. For clips, `end - start ≤ CLIP_MAX_SEC`. */
  endSec: number;
  /** Whether this slot wants a still photo or a moving clip. */
  kind: SlotMediaKind;
  /** Does this slot's start land on a downbeat (bar start)? Hint for emphasis. */
  onDownbeat: boolean;
  /**
   * Optional virtual camera move for a `photo` slot (§16.9) — push-in / pan /
   * roll / orbit-feel that makes a still read as filmed. Deterministic, ₱0 per
   * render. Omitted = no move (legacy behavior). When unset, the builder/preview
   * may fall back to `defaultCameraMove(slotIndex)` from `stories-camera-move`.
   */
  cameraMove?: CameraMove;
};

// ---------------------------------------------------------------------------
// Template manifest
// ---------------------------------------------------------------------------

export type StoriesTemplateCategory = 'stories';

/**
 * A beat-aware template manifest. Pure data — a later renderer consumes it.
 *
 * The slot PATTERN is declared as a repeating sequence of "every N beats, cut"
 * intentions plus per-position media-kind preferences. The concrete `StorySlot`
 * boundaries are derived at build time from a real `BeatGrid` via
 * `buildSlotsFromBeatGrid` (so the same template adapts to any track's tempo).
 */
export type StoriesTemplate = {
  slug: string;
  name: string;
  category: StoriesTemplateCategory;
  /** Target reel length in seconds (1–30 per the Personal Reel constraint). */
  durationSec: number;
  /** Short blurb for the picker UI. */
  vibe: string;
  /** 4 hex colors — same convention as patiktok templates ([bg, a1, a2, dark]). */
  palette: [string, string, string, string];
  /**
   * How many beats between cuts. 1 = cut on every beat (frenetic), 2 = every
   * other beat, 4 = once per bar (calm). The renderer snaps slot edges to the
   * Nth beat using this stride.
   */
  beatsPerCut: number;
  /**
   * Per-slot media-kind preference, applied round-robin across the derived
   * slots. e.g. `['photo','photo','clip']` → photo, photo, clip, photo, …
   * CLIP slots are still hard-capped at 5s regardless of beat spacing.
   */
  mediaPattern: SlotMediaKind[];
};

/** The 30s Stories template the task requires (at least one). */
export const STORIES_DURATION = 30;

// ---------------------------------------------------------------------------
// Guest Stories (free tier) client-safe constants
// ---------------------------------------------------------------------------
// These live here (a pure, no-server-import module) so the client surface can
// import them without pulling in the server-only data reader (lib/guest-stories
// → lib/uploads → 'server-only').

/** Minimum tagged photos before a guest can make a Story. */
export const STORY_MIN_PHOTOS = 3;
/** Photos pulled for a 30s reel — ~3–4s each. Capped to keep the render light. */
export const STORY_MAX_PHOTOS = 10;
/** Slug of the default Stories template (the free 30s montage). */
export const DEFAULT_STORY_TEMPLATE = 'golden-hour-stories-30';

export const STORIES_TEMPLATES: readonly [StoriesTemplate, ...StoriesTemplate[]] = [
  {
    slug: 'golden-hour-stories-30',
    name: 'Golden Hour',
    category: 'stories',
    durationSec: STORIES_DURATION,
    vibe: 'Warm cream + gold — beat-cut montage that opens on a downbeat.',
    palette: ['#FAF7F2', '#C9A14B', '#E2B873', '#3A2A1C'],
    // Cut once per bar's-worth feel but with a clip every third slot.
    beatsPerCut: 2,
    mediaPattern: ['photo', 'photo', 'clip'],
  },
  {
    slug: 'midnight-fast-cut-30',
    name: 'Midnight Fast-Cut',
    category: 'stories',
    durationSec: STORIES_DURATION,
    vibe: 'Black + gold — high-energy hype cut, cut on every beat.',
    palette: ['#0F0F0F', '#C9A14B', '#FAF7F2', '#3A2A1C'],
    beatsPerCut: 1,
    mediaPattern: ['clip', 'photo'],
  },
];

export function findStoriesTemplate(slug: string): StoriesTemplate | null {
  return STORIES_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Beat → slot derivation (pure)
// ---------------------------------------------------------------------------

/**
 * Derive the slot timeline for a template against a real beat grid.
 *
 * Walks the beats with the template's `beatsPerCut` stride, emitting one slot
 * per stride boundary until the template duration is filled. Photo slots may
 * span the full beat-gap; CLIP slots are clamped to `CLIP_MAX_SEC`. A slot's
 * `onDownbeat` is true when its start coincides with a `downbeats` entry.
 *
 * Pure + deterministic so P1/P2 can unit-test and preview without rendering.
 *
 * @param template The chosen Stories template.
 * @param grid     The track's beat grid (from `reel_music_tracks.beat_grid`).
 * @returns        Ordered, non-overlapping slots covering [0, durationSec].
 */
export function buildSlotsFromBeatGrid(
  template: StoriesTemplate,
  grid: BeatGrid,
): StorySlot[] {
  const beats = [...grid.beats].filter((b) => Number.isFinite(b) && b >= 0).sort((a, b) => a - b);
  if (beats.length < 2) {
    // Degenerate grid — fall back to an even split (the legacy behavior).
    return evenSplitSlots(template);
  }

  const downbeats = new Set((grid.downbeats ?? []).map((d) => round3(d)));
  const stride = Math.max(1, Math.round(template.beatsPerCut));
  const total = template.durationSec;

  // Re-base the grid so the first usable beat is t=0 of the reel.
  const t0 = beats[0]!;
  const rel = beats.map((b) => b - t0).filter((b) => b <= total + 1e-6);

  const slots: StorySlot[] = [];
  let patternIdx = 0;
  for (let i = 0; i + stride < rel.length; i += stride) {
    const start = rel[i]!;
    const nextBeat = rel[i + stride]!;
    if (start >= total) break;
    const kind = template.mediaPattern[patternIdx % template.mediaPattern.length]!;
    let end = Math.min(nextBeat, total);
    if (kind === 'clip') end = Math.min(end, start + CLIP_MAX_SEC);
    if (end - start < 1e-3) continue; // skip zero-length
    slots.push({
      startSec: round3(start),
      endSec: round3(end),
      kind,
      onDownbeat: downbeats.has(round3(beats[i]!)),
    });
    patternIdx++;
  }

  // Tail-fill to the full duration if the grid ran out before `total`.
  const last = slots[slots.length - 1];
  if (slots.length === 0) return evenSplitSlots(template);
  if (last && last.endSec < total - 1e-3) {
    const kind = template.mediaPattern[patternIdx % template.mediaPattern.length]!;
    let end = total;
    if (kind === 'clip') end = Math.min(end, last.endSec + CLIP_MAX_SEC);
    slots.push({ startSec: last.endSec, endSec: round3(end), kind, onDownbeat: false });
  }
  return slots;
}

/**
 * Fallback timeline when no (usable) beat grid exists: even split across a
 * sensible slot count, with clips capped at 5s. Matches the legacy even
 * time-split philosophy so behavior never regresses when `beat_grid` is NULL.
 */
export function evenSplitSlots(template: StoriesTemplate): StorySlot[] {
  // Aim for ~CLIP_MAX_SEC-ish slots so clips never need clamping artificially.
  const count = Math.max(1, Math.round(template.durationSec / CLIP_MAX_SEC));
  const slotLen = template.durationSec / count;
  const slots: StorySlot[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * slotLen;
    const kind = template.mediaPattern[i % template.mediaPattern.length]!;
    let end = Math.min(template.durationSec, start + slotLen);
    if (kind === 'clip') end = Math.min(end, start + CLIP_MAX_SEC);
    slots.push({ startSec: round3(start), endSec: round3(end), kind, onDownbeat: i === 0 });
  }
  return slots;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
