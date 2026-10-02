import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { TourKey } from '@/lib/tours';
import { RSVP_STAGE_KEY, RSVP_STAGE_LABEL } from '@/lib/rsvp-stage-shared';
import {
  DETAILS_FIRST_ITEM,
  DETAILS_FIRST_PRINT,
  DETAILS_ITEM_GROUPS,
  isPrintsItem,
  type DetailsItemKey,
} from '@/lib/maker-details-items';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import type { MakerDevice } from './maker-context';

/**
 * THE MAKER IN 4 — THE TOOLBAR, as the approved design draws it
 * (`prototypes/maker_in_four_2026-09-30_fable.html`; DECISION_LOG "THE MAKER IN
 * 4 IS A DIRECTION, NOT A COUNT" — the test is that a first-time host
 * understands what to do; FIRST_TIMER_TEST_2026-10-02 fix 4, task H2 "Hard"):
 *
 *     Exit · Page ▾ · Look · Details · Undo · Phone/Desktop · Apply · ⋯
 *
 * Everything else lives under ⋯ or inside Page ▾. The stages are no longer a
 * row of their own: Page ▾ lists them, each with its guest pages. This list is
 * what the shell draws, in this order, and nothing else — held on the RENDER by
 * `the-toolbar-is-the-maker-in-four.test.ts`.
 *
 *   · 'undo' and 'apply' are the draft bar's (`hub-draft-bar.tsx`), mounted in
 *     the shell's `applySlot`; 'view' is the shell's, drawn between them through
 *     the Maker's context (`MakerState.viewToggle`).
 */
export const MAKER_TOOLBAR = ['exit', 'page', 'look', 'details', 'undo', 'view', 'apply', 'more'] as const;
export type MakerToolbarItem = (typeof MAKER_TOOLBAR)[number];

/**
 * The Maker's door into the event's facts. "Your info" RETIRED as a name
 * (owner 2026-10-02, tracker answer d15: *"Event Details" everywhere*) — the
 * Maker and Event Home now say the same words for the same record.
 */
export const MAKER_DETAILS_LABEL = 'Event Details';
export const MAKER_LOOK_LABEL = 'Look';
export const MAKER_PRINTS_LABEL = 'Prints';

/**
 * 🚪 THREE DOORS, ONE PAGE. Look, Details and Prints (⋯ › Prints) each open
 * the Maker's one Details page (`maker-details.tsx`), on their own part of it:
 *
 *   · Look    — the Look group (Theme · Mood Board · Logo · Hero · Reveal);
 *   · Prints  — the printed set (`isPrintsItem`);
 *   · Details — everything else: the event's facts, words, story and plans.
 *
 * Never a second page and never a second form: the door only says where it
 * opens. Exactly one of the three wears the highlight — the one whose part the
 * open item belongs to (`makerOpenTool`).
 */
export type MakerDoor = 'look' | 'details' | 'prints';

const LOOK_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.find((g) => g.group === 'look')?.keys ?? [];
const EVENT_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')?.keys ?? [];

/** Where a fresh press of Details opens: the first of the event's facts (the names). */
export const DETAILS_FACTS_FIRST: DetailsItemKey = EVENT_KEYS[0] ?? DETAILS_FIRST_ITEM;

export function isLookItem(key: unknown): boolean {
  return typeof key === 'string' && (LOOK_KEYS as readonly string[]).includes(key);
}

/** Which door's part an item of Details belongs to. */
export function makerDoorOf(item: string | null | undefined): MakerDoor {
  if (isPrintsItem(item)) return 'prints';
  if (isLookItem(item)) return 'look';
  return 'details';
}

/** 🖨 Prints opens on the print the couple is on, else the first print (an old `?tool=prints` address). */
export function makerPrintsDoor(detailsItem: DetailsItemKey | null | undefined): DetailsItemKey {
  return detailsItem && isPrintsItem(detailsItem) ? detailsItem : DETAILS_FIRST_PRINT;
}

/** 🎨 Look opens on the Look item the couple is on, else the Theme. */
export function makerLookDoor(detailsItem: DetailsItemKey | null | undefined): DetailsItemKey {
  return detailsItem && isLookItem(detailsItem) ? detailsItem : DETAILS_FIRST_ITEM;
}

/**
 * 🗂 Details opens on the item the couple is on — but never on a print or a
 * Look item (those are Prints' and Look's), else on the first fact.
 */
export function makerDetailsDoor(detailsItem: DetailsItemKey | null | undefined): DetailsItemKey {
  return detailsItem && makerDoorOf(detailsItem) === 'details' ? detailsItem : DETAILS_FACTS_FIRST;
}

/** THE PRESS of Look, Details or Prints — one reducer, so the shell and its test run the same code. */
export function makerPressDoor(
  state: { detailsItem: DetailsItemKey | null },
  key: MakerDoor,
): { detailsItem: DetailsItemKey; selectedTool: 'details' } {
  const detailsItem =
    key === 'prints'
      ? makerPrintsDoor(state.detailsItem)
      : key === 'look'
        ? makerLookDoor(state.detailsItem)
        : makerDetailsDoor(state.detailsItem);
  return { detailsItem, selectedTool: 'details' };
}

/**
 * The door the open page IS — Look, Details or Prints while the Details page
 * is open (by the item it is on), else the open tool's own key, else null.
 */
export function makerOpenTool(openTool: string | null, detailsItem: string | null | undefined): string | null {
  return openTool === 'details' ? makerDoorOf(detailsItem) : openTool;
}

export const MAKER_TOUR_KEY: TourKey = 'customer_event_hub_maker_v1';

/* The tour's SLIDES are built on the server — `maker-tour-slides.tsx`, never
   here: this file is imported by the client shell, and importing `lib/tours.ts`
   from it put every tour's words in the Maker's first load (the diet,
   2026-10-01). 🛡 lib/tours-stay-on-the-server.test.ts. */

export function isStagePhase(value: unknown): value is LifecyclePhase {
  return typeof value === 'string' && (PUBLIC_STAGE_ORDER as readonly string[]).includes(value);
}

/**
 * 📄 PAGE ▾ — THE ONE DROPDOWN FOR WHERE YOU ARE (design frame D): the stage,
 * then that stage's guest pages under it, in the guest bar's own words —
 *
 *     Save the Date · RSVP · Invitation · On the Day · Post Event
 *
 * each a labelled group of its pages (`makerGuestPages`, the guest bar's own
 * `resolveSiteNav`; never a word typed here). The RSVP stage is a page of the
 * Maker, not a lifecycle phase, so its group holds its one page, the reply.
 * The stage words are `PUBLIC_STAGE_LABELS` — the one stage vocabulary — so
 * "On the Day" stays "On the Day" until that vocabulary changes.
 *
 * A pick JUMPS to the page (the canvas and the scenes column go there); it
 * never filters. Pure, so a test holds the list and the button's words.
 */
export type MakerPageStage = LifecyclePhase | typeof RSVP_STAGE_KEY;

/** Page ▾'s stages, in the order the one link lives through them — RSVP between Save the Date and the Invitation. */
export const MAKER_PAGE_STAGES: readonly MakerPageStage[] = PUBLIC_STAGE_ORDER.flatMap((p) =>
  p === 'save_the_date' ? [p, RSVP_STAGE_KEY] : [p],
);

export function makerStageLabel(stage: MakerPageStage): string {
  return stage === RSVP_STAGE_KEY ? RSVP_STAGE_LABEL : PUBLIC_STAGE_LABELS[stage];
}

/** The RSVP stage's one page — the reply the guest fills in (design frame D: "Reply · the questions"). */
export const MAKER_RSVP_PAGE_LABEL = 'Reply';

/** One guest page, as Page ▾ lists it. */
export type MakerPageEntry = {
  key: string;
  label: string;
  /** Nothing of the couple's to arrange on it here (no scene sits under it). */
  empty?: boolean;
};

const PAGE_SEP = ':';

export function makerPageValue(stage: LifecyclePhase, page: string): string {
  return `${stage}${PAGE_SEP}${page}`;
}

/** What a Page ▾ pick names — the RSVP stage, or a stage's page — or null for an unknown key. */
export function makerPagePick(
  key: string,
): { kind: 'rsvp' } | { kind: 'page'; stage: LifecyclePhase; page: string } | null {
  if (key === RSVP_STAGE_KEY) return { kind: 'rsvp' };
  const at = key.indexOf(PAGE_SEP);
  if (at < 0) return null;
  const stage = key.slice(0, at);
  return isStagePhase(stage) ? { kind: 'page', stage, page: key.slice(at + 1) } : null;
}

export function makerPageMenu(input: {
  stage: LifecyclePhase;
  /** The RSVP stage is the open page. */
  rsvpOpen: boolean;
  /** The stage guests meet today — its first page wears the "live today" dot. */
  liveStage: LifecyclePhase | null;
  /** Each lifecycle stage's guest pages, in the guest bar's words and order. */
  pagesOf: (stage: LifecyclePhase) => readonly MakerPageEntry[];
  /** The page the canvas shows on `stage`, or null before it has said. */
  shownPage: string | null;
  /** False for a viewer the RSVP stage is not for (a coordinator). */
  hasWork: boolean;
  /** Who it is for, in the event type's own word (`EventWords.theHost`). */
  theHost?: string;
}): { value: string; buttonText: string; options: PickOption[] } {
  const options: PickOption[] = [];
  for (const s of MAKER_PAGE_STAGES) {
    const group = makerStageLabel(s);
    if (s === RSVP_STAGE_KEY) {
      options.push({
        key: RSVP_STAGE_KEY,
        label: MAKER_RSVP_PAGE_LABEL,
        group,
        ...(input.hasWork ? {} : { disabledNote: `only ${input.theHost ?? 'the host'} can open this` }),
      });
      continue;
    }
    const pages = input.pagesOf(s);
    const list: readonly MakerPageEntry[] = pages.length ? pages : [{ key: '', label: group }];
    list.forEach((p, i) =>
      options.push({
        key: makerPageValue(s, p.key),
        label: p.label,
        group,
        ...(i === 0 && input.liveStage === s ? { dot: true } : {}),
        ...(p.empty ? { disabledNote: 'nothing to arrange yet' } : {}),
      }),
    );
  }
  if (input.rsvpOpen) {
    return { value: RSVP_STAGE_KEY, buttonText: `${RSVP_STAGE_LABEL} › ${MAKER_RSVP_PAGE_LABEL}`, options };
  }
  const own = options.filter((o) => o.key.startsWith(makerPageValue(input.stage, '')));
  const shown =
    (input.shownPage !== null ? own.find((o) => o.key === makerPageValue(input.stage, input.shownPage!)) : undefined) ??
    own.find((o) => !o.disabledNote) ??
    own[0];
  const stageLabel = PUBLIC_STAGE_LABELS[input.stage];
  return {
    value: shown?.key ?? makerPageValue(input.stage, ''),
    buttonText: shown && shown.label !== stageLabel ? `${stageLabel} › ${shown.label}` : stageLabel,
    options,
  };
}

/**
 * 🖥📱 VIEW ▾ — Desktop · Phone · Both (DECISION_LOG 2026-09-28, "THE MAKER'S
 * TOOLBARS ARE BUILT AFTER KEYNOTE + PAGES": *"View ▾ (Desktop · Phone ·
 * Both)"*). Both draws the phone (390 px) and the desktop (1280 px, scaled to
 * fit) side by side, from the same draft (`editor-shell.tsx`, `data-maker-both`).
 *
 * It needs room for two pages, so it is offered only at 1024 px and wider
 * (`lg`, the app's own mobile↔desktop switch). Pure, so a test holds both rules.
 *
 * 📱 THE MAKER IN 4 (2026-10-02): the bar carries ONE button, Phone — pressed
 * is the phone, unpressed the desktop (`makerViewToggle`). Both is a row
 * under ⋯, offered from this same list.
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

/** The bar's Phone button: on the phone it goes back to the desktop; anywhere else (Both included) it shows the phone. */
export function makerViewToggle(shown: MakerDevice): MakerDevice {
  return shown === 'phone' ? 'desktop' : 'phone';
}

/** A remembered view (sessionStorage) — only a real one is put back. */
export function isMakerDevice(value: unknown): value is MakerDevice {
  return value === 'desktop' || value === 'phone' || value === 'both';
}
