import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { TOURS, type TourKey } from '@/lib/tours';

/**
 * THE EVENT HUB MAKER'S BAR — the one list, pure, so a test can hold it.
 *
 * Owner-final (DECISION_LOG 2026-09-24/25, `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`
 * Phase 1):
 *
 *     Logo · Hero · Reveal · Love Story │ Save the Date · Invitation · On the Day · Post Event │ Prints & Tickets
 *
 * Three groups, two dividers. The middle group is the four stages of the ONE
 * public link and its words are NOT typed here — they are `PUBLIC_STAGE_LABELS`
 * in `PUBLIC_STAGE_ORDER`, the one stage vocabulary (owner 2026-09-24). A second
 * spelling of "Invitation" in this file is how two vocabularies came back.
 *
 * `kind` says what pressing the item DOES, and every item does something:
 *   · 'stage' — switches the canvas to that stage of the live page;
 *   · 'tool'  — opens a working panel that already ships (the Logo Maker door,
 *               the reveal panel, the hero photo, Our story);
 *   · 'next'  — has no build yet, and opens ONE line saying it is coming in the
 *               next build. Never a dead button (owner rule for this build).
 */

export type MakerBarGroup = 'made-once' | 'stages' | 'prints';

export type MakerBarItem =
  | { key: 'logo' | 'hero' | 'reveal' | 'love-story'; label: string; group: 'made-once'; kind: 'tool' }
  | { key: LifecyclePhase; label: string; group: 'stages'; kind: 'stage' }
  | { key: 'prints'; label: string; group: 'prints'; kind: 'next' };

export const MAKER_BAR: readonly MakerBarItem[] = [
  { key: 'logo', label: 'Logo', group: 'made-once', kind: 'tool' },
  { key: 'hero', label: 'Hero', group: 'made-once', kind: 'tool' },
  { key: 'reveal', label: 'Reveal', group: 'made-once', kind: 'tool' },
  { key: 'love-story', label: 'Love Story', group: 'made-once', kind: 'tool' },
  ...PUBLIC_STAGE_ORDER.map(
    (phase) =>
      ({ key: phase, label: PUBLIC_STAGE_LABELS[phase], group: 'stages', kind: 'stage' }) as const,
  ),
  { key: 'prints', label: 'Prints & Tickets', group: 'prints', kind: 'next' },
];

/** What a 'next' item — or a tool whose full build is a later phase — says. */
export const MAKER_COMING_NEXT: Record<'prints' | 'hero' | 'love-story' | 'logo' | 'add' | 'snap' | 'both', string> = {
  prints: 'Themed invitations, tickets and posters are coming in the next build.',
  hero: 'One hero for every stage and the poster is coming in the next build — for now this sets the photo at the top.',
  'love-story': 'Scene templates for each Love Story moment arrive with the next build — for now each moment shows as a words-and-photo scene.',
  logo: 'The Logo Maker moves inside the Event Hub Maker in the next build — for now it opens in its own page.',
  add: 'New scenes from the 25 templates are coming in the next build.',
  snap: 'The snap grid arrives with scene templates in the next build.',
  both: 'Desktop and phone side by side is coming in the next build — switch between them for now.',
};

export const MAKER_TOUR_KEY: TourKey = 'customer_event_hub_maker_v1';

/**
 * The tour slides this viewer is shown — pure, so a test can hold both rules.
 *
 *   · In the app-store shell a slide that SELLS is dropped outright (App Review
 *     3.1.1: no digital price and no paid pitch inside the app).
 *   · Elsewhere its `{price}` token becomes " — ₱X, once" from the live
 *     catalogue, or nothing at all when the catalogue did not answer. A
 *     remembered number is never printed.
 */
export function makerTourSlides(input: { storeShell: boolean; priceLabel: string | null }) {
  return TOURS[MAKER_TOUR_KEY].slides
    .filter((s) => !(input.storeShell && s.sells))
    .map((s) => ({
      ...s,
      body: s.body.replace('{price}', input.priceLabel ? ` &mdash; ${input.priceLabel}, once` : ''),
    }));
}

export function isStagePhase(value: unknown): value is LifecyclePhase {
  return typeof value === 'string' && (PUBLIC_STAGE_ORDER as readonly string[]).includes(value);
}
