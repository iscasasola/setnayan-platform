import type { LoveStoryChapter } from '@/lib/love-story-moments';

/**
 * THE PANEL ASKS, THE PAGE OPENS (owner 2026-09-27: *"align this to what I see
 * on the editing part"*).
 *
 * The Maker's Love Story panel lists the page's chapters and moments, but it is
 * not a second editor. A tap in the panel asks the PAGE (the scrapbook beside
 * it) to open its own moment sheet — the one `MomentSheet` that already posts
 * to `loveStoryMomentAction`. The page answers by calling `preventDefault()`,
 * so the panel knows whether anything opened and never fails silently.
 *
 * When the page is not mounted yet (the panel was reached from a scene), the
 * ask is QUEUED and the Maker opens Love Story's page; the sheet that matches
 * takes the ask when it mounts (`takeQueuedOpen`).
 *
 * Pure DOM — no React, no server imports — so both client files share it.
 */
export const LOVE_STORY_OPEN_EVENT = 'setnayan:love-story-open';

/** `add` = the page's "Add a moment"; anything else = a moment's id. */
export type LoveStoryOpenAsk = { target: string; chapter?: LoveStoryChapter };

/** Ask the page to open a sheet. True when a sheet answered. */
export function askThePageToOpen(ask: LoveStoryOpenAsk): boolean {
  if (typeof window === 'undefined') return false;
  const ev = new CustomEvent<LoveStoryOpenAsk>(LOVE_STORY_OPEN_EVENT, { detail: ask, cancelable: true });
  return !window.dispatchEvent(ev);
}

const QUEUE_MS = 15_000;
let queued: (LoveStoryOpenAsk & { at: number }) | null = null;

/** Hold an ask until the page's sheet mounts. */
export function queueOpen(ask: LoveStoryOpenAsk): void {
  queued = { ...ask, at: Date.now() };
}

/** The queued ask for this sheet, taken once — or null. Stale asks are dropped. */
export function takeQueuedOpen(target: string): LoveStoryOpenAsk | null {
  if (!queued) return null;
  if (Date.now() - queued.at > QUEUE_MS) {
    queued = null;
    return null;
  }
  if (queued.target !== target) return null;
  const { at: _at, ...ask } = queued;
  queued = null;
  return ask;
}
