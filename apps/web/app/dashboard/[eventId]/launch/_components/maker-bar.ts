import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { TourKey } from '@/lib/tours';
import { RSVP_STAGE_KEY, RSVP_STAGE_LABEL } from '@/lib/rsvp-stage-shared';
import type { MakerDevice } from './maker-context';

/**
 * THE EVENT HUB MAKER'S BAR — the one list, pure, so a test can hold it.
 *
 * Owner-final (2026-09-28, DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES
 * IN DETAILS; THE TOP MENU IS THE FOUR STAGES + DETAILS"), verbatim: *"B.
 * maximize this concept so it is easier to find everything to populate the
 * event hub"*:
 *
 *     Save the Date · Invitation · On the Day · Post Event │ Details
 *
 * — nothing else. Logo, Hero, Reveal, Love Story and RSVP were pages of their
 * own here (the 2026-09-25 bar); they are items of Details now, and an old
 * `?tool=<page>` lands on its item (`lib/maker-details-items.ts`
 * `movedPageItem`). Prints & Tickets folded in on 2026-09-28 the same way.
 *
 * The stages' words are NOT typed here — they are `PUBLIC_STAGE_LABELS` in
 * `PUBLIC_STAGE_ORDER`, the one stage vocabulary (owner 2026-09-24). A second
 * spelling of "Invitation" in this file is how two vocabularies came back.
 *
 * `kind` says what pressing the item DOES, and every item does something:
 *   · 'stage' — switches the canvas to that stage of the live page;
 *   · 'tool'  — opens Details, the page every made-once thing lives in.
 *
 * ⛔ NOTHING HERE PROMISES A LATER BUILD (2026-09-28, before the Apple check —
 * App Review rejects "coming soon"). The old `'next'` kind and the
 * `MAKER_COMING_NEXT` notes ("… is coming in the next build") are gone: a
 * control that is not built is not drawn. `lib/the-maker-promises-nothing.test.ts`
 * holds it.
 */

export type MakerBarGroup = 'made-once' | 'stages';

/**
 * The made-once home of every line of wording (owner 2026-09-25: *"the other
 * lines like the opening message and the thank you message on the egifts must
 * have a place along the Logo, Hero, Reveal, Love Story"*). PROVISIONAL name —
 * the owner may rename it, so it lives in this one constant.
 */
export const MAKER_DETAILS_LABEL = 'Details';

export type MakerBarItem =
  | { key: 'details'; label: string; group: 'made-once'; kind: 'tool' }
  /** 🗳 The RSVP stage — a stage of the bar, but a page of the Maker (not a
   *  lifecycle phase: `rsvp` is the INVITATION's phase key), so pressing it
   *  opens its own three parts (`maker-rsvp-stage.tsx`) like Details does. */
  | { key: typeof RSVP_STAGE_KEY; label: string; group: 'stages'; kind: 'tool' }
  | { key: LifecyclePhase; label: string; group: 'stages'; kind: 'stage' };

export const MAKER_BAR: readonly MakerBarItem[] = [
  // The stages of the one link, in the order it lives through them — with the
  // RSVP stage between Save the Date and the Invitation (owner 2026-09-30, the
  // re-plan's top nav: "Save the Date · RSVP · Invitation · The Day · Post Event")…
  ...PUBLIC_STAGE_ORDER.flatMap((phase) => [
    { key: phase, label: PUBLIC_STAGE_LABELS[phase], group: 'stages', kind: 'stage' } as const,
    ...(phase === 'save_the_date'
      ? [{ key: RSVP_STAGE_KEY, label: RSVP_STAGE_LABEL, group: 'stages', kind: 'tool' } as const]
      : []),
  ]),
  // …then Details, where everything made once lives (Option B).
  { key: 'details', label: MAKER_DETAILS_LABEL, group: 'made-once', kind: 'tool' },
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

export function isStagePhase(value: unknown): value is LifecyclePhase {
  return typeof value === 'string' && (PUBLIC_STAGE_ORDER as readonly string[]).includes(value);
}

/**
 * ▾ THE COMPACT BAR IS ONE PICKER (owner 2026-09-27, on "● Invitation ▾" +
 * "Logo ▾": *"combine them in 1 dropdown"*; DECISION_LOG "THE COMPACT MAKER
 * BAR IS ONE PICKER, NOT TWO"). Pure, so a test holds what the couple sees:
 *
 *   · the button names where they ARE — Details when it is open, else the stage;
 *   · the list is ONE FLAT LIST in `MAKER_BAR`'s own order and words — Save the
 *     Date · Invitation · On the Day · Post Event · Details (DECISION_LOG
 *     "OPTION B …": *"the place menu is … — nothing else"*; the Stages / Pages
 *     headings went with the pages). Stages keep the live-today dot;
 *   · a viewer Details is not for (a coordinator) sees it, saying why it is
 *     shut — in the event type's own word for its host (`theHost`).
 *
 * Every key is a `MAKER_BAR` key, and `makerPlaceItem` hands back THAT item, so
 * a pick runs the same `onPress` the full row's button does — never a second
 * meaning.
 */
export type MakerPlaceOption = {
  key: MakerBarItem['key'];
  label: string;
  dot?: boolean;
  disabledNote?: string;
};

export function makerPlacePick(input: {
  stage: LifecyclePhase;
  liveStage: LifecyclePhase | null;
  /** The key of the page open in the Maker, or null when none is. */
  openTool: string | null;
  hasWork: boolean;
  /** Who Details is for, in the event type's own words (`EventWords.theHost` —
   *  "the couple", "the host", "the family"); never a typed noun here. */
  theHost?: string;
}): { value: string; options: MakerPlaceOption[] } {
  const open = MAKER_BAR.find((i) => i.kind === 'tool' && i.key === input.openTool) ?? null;
  return {
    value: open?.key ?? input.stage,
    options: MAKER_BAR.map((i) =>
      i.kind === 'stage'
        ? { key: i.key, label: i.label, ...(input.liveStage === i.key ? { dot: true } : {}) }
        : { key: i.key, label: i.label, ...(input.hasWork ? {} : { disabledNote: `only ${input.theHost ?? 'the host'} can open this` }) },
    ),
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
