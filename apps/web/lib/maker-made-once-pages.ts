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
/*
 *   · RSVP       — the guest's RSVP, as a guest meets it (owner 2026-09-27:
 *                  *"RSVP is its own made-once page in the Maker bar"*): the
 *                  Invitation's reply opened on the sample seat-holder (the
 *                  FABRICATED guest of `lib/simulated-guest-preview.ts` — no
 *                  real guest ever flows into it), with the RSVP settings
 *                  beside it. Keyed `rsvp-page`, never `rsvp`: `rsvp` is the
 *                  Invitation STAGE's own key, and one bar holds both.
 */
export const MAKER_PAGE_KEYS = ['details', 'logo', 'hero', 'reveal', 'love-story', 'rsvp-page'] as const;
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
  'rsvp-page': 'RSVP',
};

export type MakerPageOpts = {
  /** Love Story: the Invitation's story section instead of the scrapbook. */
  guestView?: boolean;
  /** Reveal: which of the couple's chosen stages to play it on. */
  revealStage?: LifecyclePhase | null;
  /**
   * RSVP: which half of the reply the canvas shows (the switch on its page,
   * "The questions" · "After they reply"). Absent = the questions — the part
   * every "What do you ask your guests?" switch visibly changes.
   */
  rsvpView?: 'questions' | 'replied';
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
    case 'rsvp-page':
      // The reply lives on the Invitation, whichever stage is being edited.
      return 'rsvp';
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
  // 🗳 The RSVP page: the Invitation as the SAMPLE seat-holder (`as=replied`,
  // host-verified on the guest page — a stranger's `?as=` is ignored), with the
  // reply sheet open (`#your-details`, rsvp-sheet.tsx). The canvas door
  // (`editor=1`) wears the couple's DRAFT, so a switch shows before Apply.
  // 🗳 "The questions" (the default, owner 2026-09-27: the canvas must follow
  // what the couple asks): the key-holder's own RSVP page, drawn for a SAMPLE
  // guest who has not replied — host-verified on that page, and it wears the
  // couple's DRAFT, so every switch shows before Apply.
  if (key === 'rsvp-page' && opts.rsvpView !== 'replied') return `${publicLandingUrl}/invite/reply?editor=1`;
  if (key === 'rsvp-page') return `${publicLandingUrl}?phase=${phase}&editor=1&as=replied#your-details`;
  const anchor = key === 'love-story' ? '#site-story' : '';
  // 🎬 The Reveal's page must PLAY the opening, and only the stage preview
  // (`?preview=draft`) does — the editing canvas (`?editor=1`) skips it by
  // design (owner 2026-09-26: *"that role is for the preview stage"*).
  if (key === 'reveal') return `${publicLandingUrl}?phase=${phase}&preview=draft`;
  // 🖼 The Hero page is the hero ALONE (owner 2026-09-27) — not the day, the
  // place, the story or the host note under it. `only=hero` is honoured by the
  // host canvas only (`canvasOnlyScene`, app/[slug]/_lib/editor-canvas.ts).
  if (key === 'hero') return `${publicLandingUrl}?phase=${phase}&editor=1&only=hero`;
  return `${publicLandingUrl}?phase=${phase}&editor=1${anchor}`;
}
