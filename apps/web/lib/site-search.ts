import 'server-only';

import { loadPublishedShowcases } from '@/lib/showcase-db';
import { loadFeaturedChapters } from '@/lib/storytellers';
import type { PublicSearchNoun } from '@/lib/public-search-nouns';
import {
  IN_CODE_READ_NOUNS,
  MARKETPLACE_NOUN,
  normalizedPhrase,
  rankReads,
  scoreDocument,
  searchInCodeReads,
  searchTokens,
  type ReadHit,
} from '@/lib/site-search-core';

// ============================================================================
// SITE SEARCH — the IO half: published stories, plus the composed entry point.
// ============================================================================
//
// The matching itself and every in-code corpus live in `site-search-core.ts`,
// which carries the full account of why this exists. This module adds the one
// source that needs the database and composes the answer.
//
// ⚠ THE SPLIT IS NOT TIDINESS. `server-only` is not an installed package here,
// so any module declaring it dies with MODULE_NOT_FOUND the moment a unit test
// imports it — which is why the shipped precedent (`review-fraud-screener.ts`
// beside `review-fraud-scoring.ts`) keeps the pure half separate and tests
// that. Move the matching back into this file and it stops being tested.
//
// 🔒 THE MARKETPLACE QUERY IS NOT TOUCHED. `suppliers` is resolved by
// /explore's own vendor query exactly as before; nothing here can change which
// vendors match, or their order.

export type { ReadHit } from '@/lib/site-search-core';
export {
  MARKETPLACE_NOUN,
  searchTokens,
  scoreDocument,
} from '@/lib/site-search-core';

/** The noun this module's own source discharges. */
const STORY_NOUN: Exclude<PublicSearchNoun, 'suppliers'> = 'stories';

/**
 * Every noun resolved outside the marketplace query — the in-code corpora plus
 * this module's stories. Derived from both halves, so deleting either one
 * removes its noun here rather than leaving a promise with nothing behind it.
 */
export const READ_SOURCE_NOUNS: ReadonlyArray<Exclude<PublicSearchNoun, 'suppliers'>> =
  Array.from(new Set([...IN_CODE_READ_NOUNS, STORY_NOUN]));

/**
 * Published stories — consented editorials and owner-featured chapters, the
 * same already-public pools /realstories reads.
 *
 * 🔒 THIS ADDS NO ACCESS. Both loaders apply their own public gate (consent,
 * not-deleted, published, featured); this calls them and filters what they
 * return. Nothing unpublished, unconsented or unfeatured can enter a result,
 * because nothing unpublished ever leaves those loaders.
 *
 * A curated SAMPLE is labelled as one, exactly as it is on /realstories —
 * quietly passing a sample off as somebody's real wedding is the one way this
 * section could mislead a reader.
 */
async function storyHits(tokens: string[], phrase: string): Promise<ReadHit[]> {
  const [showcases, chapters] = await Promise.allSettled([
    loadPublishedShowcases(24),
    loadFeaturedChapters(24),
  ]);
  const out: ReadHit[] = [];

  if (showcases.status === 'fulfilled') {
    for (const s of showcases.value) {
      const where = [s.city, s.dateLabel].filter(Boolean).join(' · ');
      const score = scoreDocument(s.coupleNames, where, tokens, phrase);
      if (score > 0) {
        out.push({
          noun: STORY_NOUN,
          tag: s.isSample ? 'Story · Sample' : 'Story',
          href: s.href,
          title: s.coupleNames,
          blurb: where || 'A story published on Setnayan',
          score,
        });
      }
    }
  }

  if (chapters.status === 'fulfilled') {
    for (const c of chapters.value) {
      const score = scoreDocument(c.title, `${c.ownerName} ${c.kindLabel}`, tokens, phrase);
      if (score > 0) {
        out.push({
          noun: STORY_NOUN,
          tag: `Story · ${c.kindLabel}`,
          href: c.href,
          title: c.title,
          blurb: `A chapter by ${c.ownerName}`,
          score,
        });
      }
    }
  }

  return out;
}

/**
 * Search everything the marketplace query cannot reach.
 *
 * Returns [] for an empty or one-character query — a box nobody has typed into
 * must not print a list, and /explore is browsed by category far more often
 * than it is searched.
 *
 * ⚠ FAIL-SOFT ON THE STORY READ, NOT ON THE WHOLE ANSWER. The guide corpus
 * lives in code and cannot fail; the story pools are database reads. A DB
 * hiccup must cost the stories, never the 108 guides and help pages that were
 * the reason for building this.
 */
export async function searchReads(query: string, limit = 8): Promise<ReadHit[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];

  const inCode = searchInCodeReads(query);
  let stories: ReadHit[] = [];
  try {
    stories = await storyHits(tokens, normalizedPhrase(query));
  } catch {
    stories = [];
  }

  return rankReads([...stories, ...inCode], limit);
}
