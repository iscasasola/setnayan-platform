'use client';

/**
 * story-light.tsx — the page moves from morning to night as you read it.
 *
 * `01_The_Story.md` §1 (The light) · `08` step 2.2 · ported from
 * `prototypes/story.html`'s `paint()`.
 *
 * It renders NOTHING. Its whole job is to write three CSS custom properties on
 * the story's wrapper as the reader moves, and every colour in the tree already
 * resolves through them (`tailwind.config.ts`: `rgb(var(--color-*) / <alpha>)`)
 * — the shipped re-skin mechanism `buildSitePaletteVars` uses for the couple's
 * website, pointed at the story.
 *
 * ── IT IS NOT THE ONE WHO WATCHES THE SCROLL ───────────────────────────────
 * The clock owns the only scroll loop on this page and publishes where the
 * reader is (`lib/story-reader-position.ts`). A second loop here would mean two
 * answers to one question and two lots of layout per frame on a 16,000px page.
 *
 * ── THE PAGE IS ALREADY RIGHT BEFORE THIS RUNS ─────────────────────────────
 * The wrapper is server-rendered carrying the opening stage's colours inline,
 * so with JavaScript off, in a screenshot, and to a crawler the story is a
 * legible printed page that simply does not change as you scroll. This
 * component only takes over the changing.
 *
 * ── `prefers-reduced-motion` IS HONOURED IN THE SCRIPT, NOT ONLY THE SHEET ──
 * Under it there is no crossfade at all: the light SNAPS to the stage of the
 * entry being read. The colour still follows the reader — that is content, not
 * decoration, and freezing the page at dawn would be telling somebody with
 * vestibular sensitivity a different story than everyone else gets.
 */

import { useEffect } from 'react';

import { subscribeReaderPosition } from '@/lib/story-reader-position';
import {
  AFTER_STAGE,
  ROAD_STAGE,
  paintStage,
  type StageColours,
  type StageIndex,
} from '@/lib/story-light';

/** Read the stage an entry declares, falling back to the road's. */
function stageOf(el: HTMLElement | null, fallback: StageIndex): StageIndex {
  if (!el) return fallback;
  const n = Number(el.dataset.storyStage);
  return Number.isInteger(n) && n >= 0 && n <= AFTER_STAGE ? (n as StageIndex) : fallback;
}

export function StoryLight({ stages }: { stages: StageColours[] }): null {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-story-light]');
    if (!root || stages.length === 0) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = (a: StageIndex, b: StageIndex, f: number) => {
      const from = stages[a] ?? stages[0]!;
      const to = stages[b] ?? from;
      const vars = paintStage(from, to, calm.matches ? 0 : f);
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    };

    const unsubscribe = subscribeReaderPosition((pos) => {
      /*
        On the cover, above every entry: the road's light. Not a blank slate —
        the story opens in the colour of the months before the day, which is
        what the first thing a reader meets should be.
      */
      if (!pos.entry) {
        apply(ROAD_STAGE, ROAD_STAGE, 0);
        return;
      }
      const here = stageOf(pos.entry, ROAD_STAGE);
      const there = stageOf(pos.next, here);
      // A fade only exists between two DIFFERENT stages. Inside one stage the
      // ground is constant, which is what makes the crossings read as changes.
      apply(here, there, there === here ? 0 : pos.progress);
    });

    return () => {
      unsubscribe();
    };
  }, [stages]);

  return null;
}
