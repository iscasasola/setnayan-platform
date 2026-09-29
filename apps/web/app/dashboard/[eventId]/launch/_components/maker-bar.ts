import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { TOURS, type TourKey } from '@/lib/tours';
import type { MakerDevice } from './maker-context';

/**
 * THE EVENT HUB MAKER'S BAR — the one list, pure, so a test can hold it.
 *
 * Owner-final (DECISION_LOG 2026-09-24/25, `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`
 * Phase 1):
 *
 *     Details · Logo · Hero · Reveal · Love Story · RSVP │ Save the Date · Invitation · On the Day · Post Event │ Prints & Tickets
 *
 * Owner, FINAL order (2026-09-25, verbatim): *"DETAILS LOGO HERO REVEAL LOVE STORY / SAVE THE DATE
 * INVITATION ON THE DAY POST EVENT | PRINTS AND TICKETS"*. `MAKER_BAR` below is the one array.
 *
 * Three groups, two dividers. The middle group is the four stages of the ONE
 * public link and its words are NOT typed here — they are `PUBLIC_STAGE_LABELS`
 * in `PUBLIC_STAGE_ORDER`, the one stage vocabulary (owner 2026-09-24). A second
 * spelling of "Invitation" in this file is how two vocabularies came back.
 *
 * `kind` says what pressing the item DOES, and every item does something:
 *   · 'stage' — switches the canvas to that stage of the live page;
 *   · 'tool'  — opens a working panel that already ships (the Logo Maker door,
 *               the reveal panel, the hero photo, Our story).
 *
 * ⛔ NOTHING HERE PROMISES A LATER BUILD (2026-09-28, before the Apple check —
 * App Review rejects "coming soon"). The old `'next'` kind and the
 * `MAKER_COMING_NEXT` notes ("… is coming in the next build") are gone: a
 * control that is not built is not drawn. `lib/the-maker-promises-nothing.test.ts`
 * holds it.
 */

export type MakerBarGroup = 'made-once' | 'stages' | 'prints';

/**
 * The made-once home of every line of wording (owner 2026-09-25: *"the other
 * lines like the opening message and the thank you message on the egifts must
 * have a place along the Logo, Hero, Reveal, Love Story"*). PROVISIONAL name —
 * the owner may rename it, so it lives in this one constant.
 */
export const MAKER_DETAILS_LABEL = 'Details';

export type MakerBarItem =
  | { key: 'logo' | 'hero' | 'reveal' | 'love-story' | 'details' | 'rsvp-page'; label: string; group: 'made-once'; kind: 'tool' }
  | { key: LifecyclePhase; label: string; group: 'stages'; kind: 'stage' }
  | { key: 'prints'; label: string; group: 'prints'; kind: 'tool' };

export const MAKER_BAR: readonly MakerBarItem[] = [
  // Owner-final order: DETAILS first ("DETAILS LOGO HERO REVEAL LOVE STORY / …").
  { key: 'details', label: MAKER_DETAILS_LABEL, group: 'made-once', kind: 'tool' },
  { key: 'logo', label: 'Logo', group: 'made-once', kind: 'tool' },
  { key: 'hero', label: 'Hero', group: 'made-once', kind: 'tool' },
  { key: 'reveal', label: 'Reveal', group: 'made-once', kind: 'tool' },
  { key: 'love-story', label: 'Love Story', group: 'made-once', kind: 'tool' },
  // Guest pathway (owner 2026-09-27): "RSVP is its own made-once page in the
  // Maker bar (Details · Logo · Hero · Reveal · Love Story · RSVP)". Keyed
  // `rsvp-page` — `rsvp` is the Invitation stage's key, in the next group.
  { key: 'rsvp-page', label: 'RSVP', group: 'made-once', kind: 'tool' },
  ...PUBLIC_STAGE_ORDER.map(
    (phase) =>
      ({ key: phase, label: PUBLIC_STAGE_LABELS[phase], group: 'stages', kind: 'stage' }) as const,
  ),
  // Phase 9: opens the Prints & Tickets workspace (it said "coming next" until then).
  { key: 'prints', label: 'Prints & Tickets', group: 'prints', kind: 'tool' },
];

/**
 * The one note left from `MAKER_COMING_NEXT` — and it promises nothing: it says
 * what the snap grid does today. The hero's "one hero for every stage" was a
 * promise of a later build; it was removed 2026-09-28 rather than kept as a
 * "coming next" line. (The "Both" view went the same way that day, and came
 * back 2026-09-29 as a built view — `makerViewOptions` below.)
 */
export const MAKER_SNAP_NOTE =
  'The snap grid is on: every scene keeps its template’s arrangement, so it reflows on a phone.';

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

/**
 * ▾ THE COMPACT BAR IS ONE PICKER (owner 2026-09-27, on "● Invitation ▾" +
 * "Logo ▾": *"combine them in 1 dropdown"*; DECISION_LOG "THE COMPACT MAKER
 * BAR IS ONE PICKER, NOT TWO"). Pure, so a test holds what the couple sees:
 *
 *   · the button names where they ARE — the open page, else the stage;
 *   · the list is two labelled groups, Stages then Pages, in `MAKER_BAR`'s own
 *     words; Stages keep the live-today dot;
 *   · Prints & Tickets stays under Pages, where the old Pages picker listed it,
 *     so collapsing the bar never hides a door;
 *   · a viewer who is not the couple sees the pages, each saying why it is shut.
 *
 * Every key is a `MAKER_BAR` key, and `makerPlaceItem` hands back THAT item, so
 * a pick runs the same `onPress` the full row's button does — never a second
 * meaning.
 */
export const MAKER_PLACE_GROUPS = { stages: 'Stages', pages: 'Pages' } as const;

export type MakerPlaceOption = {
  key: MakerBarItem['key'];
  label: string;
  group: (typeof MAKER_PLACE_GROUPS)[keyof typeof MAKER_PLACE_GROUPS];
  dot?: boolean;
  disabledNote?: string;
};

export function makerPlacePick(input: {
  stage: LifecyclePhase;
  liveStage: LifecyclePhase | null;
  /** The key of the page open in the Maker, or null when none is. */
  openTool: string | null;
  hasWork: boolean;
}): { value: string; options: MakerPlaceOption[] } {
  const tools = MAKER_BAR.filter((i) => i.kind === 'tool');
  const open = tools.find((i) => i.key === input.openTool) ?? null;
  return {
    value: open?.key ?? input.stage,
    options: [
      ...MAKER_BAR.filter((i) => i.kind === 'stage').map((i) => ({
        key: i.key,
        label: i.label,
        group: MAKER_PLACE_GROUPS.stages,
        ...(input.liveStage === i.key ? { dot: true } : {}),
      })),
      ...tools.map((i) => ({
        key: i.key,
        label: i.label,
        group: MAKER_PLACE_GROUPS.pages,
        ...(input.hasWork ? {} : { disabledNote: 'only the couple can open this' }),
      })),
    ],
  };
}

/** The `MAKER_BAR` item a pick names — null for an unknown key, or for a page
 *  a viewer who is not the couple cannot open. */
export function makerPlaceItem(key: string, hasWork: boolean): MakerBarItem | null {
  const item = MAKER_BAR.find((i) => i.key === key) ?? null;
  if (!item) return null;
  return item.kind === 'stage' || hasWork ? item : null;
}

/**
 * 🖥📱 VIEW ▾ — Desktop · Phone · Both (DECISION_LOG 2026-09-28, "THE MAKER'S
 * TOOLBARS ARE BUILT AFTER KEYNOTE + PAGES": *"View ▾ (Desktop · Phone ·
 * Both)"*). Both draws the phone (390 px) and the desktop (1280 px, scaled to
 * fit) side by side, from the same draft (`editor-shell.tsx`, `data-maker-both`).
 *
 * It needs room for two pages, so it is offered only at 1024 px and wider
 * (`lg`, the app's own mobile↔desktop switch). Pure, so a test holds both rules.
 */
/* = `BREAKPOINTS.lg` (`lib/use-responsive.ts`) — typed, not imported: that
   module is 'use client' and this one is read by the launch page's server tree. */
export const MAKER_BOTH_MIN_WIDTH = 1024;

export function makerViewOptions(wide: boolean): ReadonlyArray<{ key: MakerDevice; label: string }> {
  return [
    { key: 'desktop', label: 'Desktop' },
    { key: 'phone', label: 'Phone' },
    ...(wide ? [{ key: 'both' as const, label: 'Both' }] : []),
  ];
}

/**
 * What the canvas SHOWS for the view picked: Both on a window narrower than
 * 1024 px is drawn as Desktop — the pick is kept, so widening the window
 * brings Both back. Never a second pane on a narrow screen.
 */
export function makerShownDevice(picked: MakerDevice, wide: boolean): MakerDevice {
  return picked === 'both' && !wide ? 'desktop' : picked;
}

/** A remembered view (sessionStorage) — only a real one is put back. */
export function isMakerDevice(value: unknown): value is MakerDevice {
  return value === 'desktop' || value === 'phone' || value === 'both';
}
