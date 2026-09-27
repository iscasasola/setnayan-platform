import { resolveMoments } from '@/lib/love-story-moments';

/**
 * THE LOVE STORY ROW'S CHIP — WHAT IS ACTUALLY WRITTEN (owner 2026-09-27).
 *
 * It read "Written" whenever `events.love_story` was any object at all, while
 * the page beside it said "0 moments": an emptied story (`moments: []`), or a
 * save of blank answers, is still an object. The chip now counts what the page
 * counts — `resolveMoments`, the one reader the scrapbook and the guest page
 * use — and falls back to the words only when a real answer is there.
 *
 * Pure (no `'use client'`), so the server page may CALL it (`rail-rows.ts`
 * explains why that matters). Returns the `RowStatus` shape.
 */
const WORD_KEYS = [
  'how_we_met',
  'met_year',
  'together_since',
  'spark',
  'spark_why',
  'obstacle',
  'obstacle_kept',
  'proposal',
  'proposal_feel',
  'proposal_year',
  'proposal_setting',
] as const;

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Did the couple answer ANY of the story's questions (words, little things, timeline)? */
export function loveStoryWordsWritten(story: unknown): boolean {
  if (!story || typeof story !== 'object' || Array.isArray(story)) return false;
  const s = story as Record<string, unknown>;
  if (WORD_KEYS.some((k) => filled(s[k]))) return true;
  const anchors = s.anchors;
  if (anchors && typeof anchors === 'object' && Object.values(anchors as object).some(filled)) return true;
  return Array.isArray(s.milestones) && s.milestones.some((m) => !!m && typeof m === 'object' && filled((m as { title?: unknown }).title));
}

export function loveStoryRowStatus(story: unknown): { label: string; filled: boolean } {
  const n = resolveMoments(story).length;
  if (n > 0) return { label: `${n} ${n === 1 ? 'moment' : 'moments'}`, filled: true };
  if (loveStoryWordsWritten(story)) return { label: 'Words only', filled: true };
  return { label: 'Not started', filled: false };
}
