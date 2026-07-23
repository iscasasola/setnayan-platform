/**
 * lib/guest-stories-media-set.ts — the PURE assembly seam for the Guest Story
 * PICKER media set (photos + clips), split out from lib/guest-stories.ts so it
 * carries NO server-only deps (no Supabase admin client, no R2 presign) and
 * unit-tests under `tsx --test`, mirroring lib/guest-stories-photo-set.ts.
 *
 * The picker relaxes the photos-only auto-reel: the guest freely picks up to
 * STORY_MAX_PHOTOS items, ANY MIX of their own tagged photos + clips (owner
 * 2026-07-23 — supersedes the 2026-05-09 "max 5 guest + 5 couple clips" split).
 *
 * CLIP HARD LINE (geo): a clip enters the set ONLY through its compressed,
 * geo-stripped `clip_web_r2_key` web copy. A clip without a web copy is
 * EXCLUDED — never fall back to the geo-bearing `r2_object_key` original
 * (that is also why resolvePlayRef is NOT used here: its raw fallback is
 * correct for owned play surfaces, wrong for a downloadable outbound render).
 */

import { VIDEO_KEY_RE } from './guest-stories-photo-set';

/** One tagged media row the DB read resolved, keyed by tag-feed source_id. */
export type StoryMediaEntry = {
  kind: 'photo' | 'clip';
  /**
   * The RENDER source ref: a still image ref for a photo; the geo-stripped
   * clip web copy (`clip_web_r2_key`) for a clip. For clips this MUST be the
   * web copy — the assembler drops any clip whose renderKey is missing.
   */
  renderKey: string | null;
  /** A still ref for the picker grid thumb (clip → thumb ?? poster). */
  stillKey: string | null;
  /** Stored clip duration (seconds), when known. Null for photos / unknown. */
  durationSec: number | null;
  /** Normalized dominant-face center for Tier-2 auto-reframe (photos only). */
  subjectCenter?: { x: number; y: number } | null;
};

export type StoryMediaAsset = {
  id: string;
  kind: 'photo' | 'clip';
  renderKey: string;
  stillKey: string | null;
  durationSec: number | null;
  subjectCenter: { x: number; y: number } | null;
};

/**
 * Given the ordered (newest-first) tag feed and the resolved entries, build the
 * ordered pickable media list:
 *   • photo → needs a renderKey that is NOT a video container (same
 *     belt-and-suspenders guard as the auto photo set);
 *   • clip  → needs a renderKey (the geo-stripped web copy) — a clip without
 *     one falls out entirely (NEVER substituted with the raw original).
 */
export function assembleStoryMediaSet(
  tags: { source_id: string }[],
  entryById: Map<string, StoryMediaEntry>,
): StoryMediaAsset[] {
  const out: StoryMediaAsset[] = [];
  for (const t of tags) {
    const entry = entryById.get(t.source_id);
    if (!entry || !entry.renderKey) continue;
    if (entry.kind === 'photo' && VIDEO_KEY_RE.test(entry.renderKey)) continue;
    out.push({
      id: t.source_id,
      kind: entry.kind,
      renderKey: entry.renderKey,
      stillKey: entry.stillKey ?? null,
      durationSec:
        typeof entry.durationSec === 'number' && entry.durationSec > 0
          ? entry.durationSec
          : null,
      subjectCenter: entry.subjectCenter ?? null,
    });
  }
  return out;
}

/**
 * Pure selection-state helper for the picker UI: can the current pick render,
 * and can more items still be added? One code path for the button-disable, the
 * counter and the tests.
 */
export function storySelectionState(
  selectedCount: number,
  limits: { min: number; max: number },
): { canRender: boolean; canAddMore: boolean } {
  return {
    canRender: selectedCount >= limits.min && selectedCount <= limits.max,
    canAddMore: selectedCount < limits.max,
  };
}
