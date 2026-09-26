import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * THE MADE-ONCE ITEMS ARE PAGES, NOT POP-UPS (owner 2026-09-25, verbatim):
 * *"on event hub maker, we do not want a pop up for details, logo, hero, reveal
 * and love story. we want their actual page to be on the body of the editor
 * similar to the different stages."*
 *
 * So picking one of these five bar items swaps the Maker's body for that item's
 * own PAGE — the way a stage swaps in its guest page — and its controls sit
 * where a stage's controls sit (the side on a wide screen, a strip under the
 * page on a phone). No sheet, drawer or modal opens for any of them.
 *
 * Pure, so a test can hold what each one draws:
 *
 *   · Hero       — the guest page, where the hero leads it (the Invitation, or
 *                  On the Day when that is the stage being edited);
 *   · Reveal     — the stage the opening plays on (the couple picks them —
 *                  `lib/reveal-stages.ts`); it plays in place on load;
 *   · Love Story — the scrapbook (Our Love Story, the story's own page), with
 *                  the Invitation's story section one switch away;
 *   · Logo       — the logo studio itself (its canvas the body, its panel the side);
 *   · Details    — what the details feed: the address + QR and the printed cards.
 */
export const MAKER_PAGE_KEYS = ['details', 'logo', 'hero', 'reveal', 'love-story'] as const;
export type MakerPageKey = (typeof MAKER_PAGE_KEYS)[number];

export function isMakerPageKey(value: unknown): value is MakerPageKey {
  return typeof value === 'string' && (MAKER_PAGE_KEYS as readonly string[]).includes(value);
}

/** The words above each page's controls. */
export const MAKER_PAGE_TITLE: Record<MakerPageKey, string> = {
  details: 'Details',
  logo: 'Logo',
  hero: 'Hero',
  reveal: 'Reveal',
  'love-story': 'Love Story',
};

export type MakerPageOpts = {
  /** Love Story: the Invitation's story section instead of the scrapbook. */
  guestView?: boolean;
  /** Reveal: which of the couple's chosen stages to play it on. */
  revealStage?: LifecyclePhase | null;
};

/**
 * Which stage of the guest page an item draws when its page IS the guest page,
 * or null when its page is its own (the studio, the details, the scrapbook).
 * `guestView` asks for the Love Story as guests meet it (the switch on its page).
 */
export function makerPageStage(
  key: MakerPageKey,
  stage: LifecyclePhase,
  opts: MakerPageOpts = {},
): LifecyclePhase | null {
  switch (key) {
    case 'hero':
      // The hero leads the Invitation and On the Day. On the Save the Date the
      // film (and the opening) lead instead, and after the day the story's
      // cover does — so those two show the hero where it leads.
      return stage === 'rsvp' || stage === 'event' ? stage : 'rsvp';
    case 'reveal':
      // Where the couple has it play (Save the Date · Invitation · On the Day),
      // never after the day — the story's cover leads there.
      return opts.revealStage && opts.revealStage !== 'editorial' ? opts.revealStage : 'save_the_date';
    case 'love-story':
      // Each moment is a scene on the Invitation (Maker Phase 7).
      return opts.guestView ? 'rsvp' : null;
    case 'logo':
    case 'details':
      return null;
  }
}

/**
 * The address the page's canvas loads — the SAME host-only canvas door a stage
 * uses (`?editor=1`, verified on the guest page), plus the section to land on.
 * Null when the item's page is not the guest page, or there is no address yet.
 */
export function makerPageCanvasSrc(
  publicLandingUrl: string | null,
  key: MakerPageKey,
  stage: LifecyclePhase,
  opts: MakerPageOpts = {},
): string | null {
  const phase = makerPageStage(key, stage, opts);
  if (!publicLandingUrl || !phase) return null;
  const anchor = key === 'love-story' ? '#site-story' : '';
  return `${publicLandingUrl}?phase=${phase}&editor=1${anchor}`;
}
