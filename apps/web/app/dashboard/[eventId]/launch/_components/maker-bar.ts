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
import { paidMarkLabel } from '@/lib/paid-mark';
import type { MakerDevice } from './maker-context';

/**
 * THE MAKER IN 4 — THE TOOLBAR, as the approved design draws it
 * (`prototypes/maker_in_four_2026-09-30_fable.html`; DECISION_LOG "THE MAKER IN
 * 4 IS A DIRECTION, NOT A COUNT" — the test is that a first-time host
 * understands what to do; FIRST_TIMER_TEST_2026-10-02 fix 4, task H2 "Hard"),
 * as rearranged on 2026-10-04 (PR-0 of the Maker rearrangement; owner, verbatim:
 * *"that can be a preview icon?"* and *"apply icon · undo icon · exit icon"*):
 *
 *     ‹ Exit · Page ▾ · Look · Event Details · ↶ Undo · 👁 Preview · ✓ Apply (n)
 *
 * Every bar button is a 44 × 44 icon with its name. ⋯ is gone: its rows moved —
 * See as · Phone / Desktop · Both · Scenes · Play this scene · Preview the
 * stage into 👁 Preview's menu; Add a scene · Reset this stage · Prints ·
 * Restore · the address · who can view · About the Maker into Page ▾
 * (`makerPageActions`). Held on the RENDER by `the-toolbar-is-the-maker-in-four.test.ts`.
 *
 *   · 'undo' and 'apply' are the draft bar's (`hub-draft-bar.tsx`), mounted in
 *     the shell's `applySlot`; 'preview' is the shell's, drawn between them
 *     through the Maker's context (`MakerState.previewMenu`).
 *   · Apply's first tap opens the Apply sheet; only its labelled Apply publishes.
 */
/* 🗂 ONE "Event Details" button (owner 2026-10-06, DECISION_LOG "EVENT DETAILS IS
   REBUILT: ONE BUTTON…"): the separate Look chip is gone — its items head the
   Event Details list (the Look group). */
export const MAKER_TOOLBAR = ['exit', 'page', 'details', 'undo', 'preview', 'apply'] as const;
export type MakerToolbarItem = (typeof MAKER_TOOLBAR)[number];

/**
 * 🧭 THE NEW MAKER'S TOP NAV — a PHONE's, behind `makerStagesStudioEnabled`
 * (owner 2026-10-06: *"studio, will have the same top nav, but a different
 * approach on the 10 studio pages"*; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md`
 * PR 1, prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`):
 *
 *     ✕ Exit · Stages | Studio · ↺ Undo · ✓ Apply (n)
 *
 * `side` is ONE `ISegmented` (sections = one segmented control, INTERACTION_RULES
 * §8). No Page ▾, no Event Details, no 👁 Preview on this list — the stage ▾
 * lives in the lower third, Studio's tools on its home, and ▶ Play joins the
 * lower third in a later PR. A desktop keeps `MAKER_TOOLBAR` this round; with
 * the flag off every width does. Held by `lib/maker-stages-studio-ships-dark.test.ts`.
 */
export const MAKER_TOOLBAR_STAGES_STUDIO = ['exit', 'side', 'undo', 'apply'] as const;
export type MakerSide = 'stages' | 'studio';
export const MAKER_SIDE_LABEL: Record<MakerSide, string> = { stages: 'Stages', studio: 'Studio' };

/**
 * The Maker's door into the event's facts. "Your info" RETIRED as a name
 * (owner 2026-10-02, tracker answer d15: *"Event Details" everywhere*) — the
 * Maker and Event Home now say the same words for the same record.
 */
export const MAKER_DETAILS_LABEL = 'Event Details';
export const MAKER_LOOK_LABEL = 'Look';
export const MAKER_PRINTS_LABEL = 'Prints';
/** Page ▾'s own name — what it reads while Look, Event Details or Prints covers the stage. */
export const MAKER_PAGE_MENU_LABEL = 'Page';

/**
 * 🚪 TWO DOORS, ONE PAGE (one since 2026-10-06 on the bar). Event Details and
 * Prints (Settings › Prints / Page ▾ › Prints) each open the Maker's one Details
 * page (`maker-details.tsx`):
 *
 *   · Details — the whole list: Look · Story & plans · Your event · Prints;
 *   · Prints  — the same page, on the printed set (`isPrintsItem`).
 *
 * 'look' remains a way in (a tour opens the Look group) — never a highlight.
 */
export type MakerDoor = 'look' | 'details' | 'prints';

const LOOK_KEYS: readonly DetailsItemKey[] = [...(DETAILS_ITEM_GROUPS.find((g) => g.group === 'look')?.keys ?? []), 'theme'];
const EVENT_KEYS: readonly DetailsItemKey[] = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')?.keys ?? [];

/** The first of the event's facts (the names) — the Your event form's first field. */
export const DETAILS_FACTS_FIRST: DetailsItemKey = EVENT_KEYS[0] ?? DETAILS_FIRST_ITEM;

export function isLookItem(key: unknown): boolean {
  return typeof key === 'string' && (LOOK_KEYS as readonly string[]).includes(key);
}

/**
 * Which door's part an item of Details belongs to. Since 2026-10-06 there is no
 * Look door of its own: a Look item is Event Details' (its first group). The
 * 'look' door survives only as a way IN (a tour's last slide opens the Look
 * group) — it is never the door an item is on.
 */
export function makerDoorOf(item: string | null | undefined): MakerDoor {
  if (isPrintsItem(item)) return 'prints';
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
 * 🗂 Event Details opens on the item the couple is on — but never on a print
 * (those are Prints'), else on the list's first row (Background).
 */
export function makerDetailsDoor(detailsItem: DetailsItemKey | null | undefined): DetailsItemKey {
  return detailsItem && makerDoorOf(detailsItem) === 'details' ? detailsItem : DETAILS_FIRST_ITEM;
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

/**
 * 🧱 THE PAGES THE SHELL DRAWS OVER THE WORK AREA — Event Details (Look · Event
 * Details · Prints) and the RSVP stage (Page ▾ › RSVP · Reply), each a layer of
 * `maker-shell.tsx` that covers the stage. Under one of them the work area
 * (`editor-shell.tsx`) draws NOTHING of its own — no navigator, no scene sheet,
 * no part sheet: a stage's sheet is `fixed` to the screen, so it is not covered
 * by the layer and would lie over the bottom bar (live dead end, 2026-10-04: on
 * the RSVP stage an empty "RSVP" scene sheet covered Page ▾ · Look · Event
 * Details, and there was no way to another stage). A new layer in the shell
 * joins this list — `lib/a-sheet-never-covers-the-bottom-bar.test.ts` reads
 * the shell's layers and fails one that is missing.
 */
export const MAKER_SHELL_PAGES = ['details', 'rsvp-stage'] as const;
export type MakerShellPage = (typeof MAKER_SHELL_PAGES)[number];

/** Is this tool one the shell draws over the work area? */
export function isMakerShellPage(key: string): key is MakerShellPage {
  return (MAKER_SHELL_PAGES as readonly string[]).includes(key);
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
  /**
   * 📍 A page of the Maker covers the stage (Look · Event Details · Prints): its
   * name. Page ▾ then never names the stage hidden under it (owner, live phone
   * test 2026-10-02: on a page that was not Welcome, the bar said "Invitation ›
   * Welcome") — and never that page either: Look and Event Details are buttons
   * of the same bar, so the bar read "Event Details ▾ · Look · Event Details"
   * (seen live at 375 px, maria-and-jose, 2026-10-04). It reads its own name,
   * "Page" (`MAKER_PAGE_MENU_LABEL`). Null = the stage's own page is on screen.
   * `no-two-bar-buttons-share-a-label.test.ts` holds it.
   */
  openPage?: string | null;
}): {
  value: string;
  buttonText: string;
  /** 📱 The page alone ("Welcome") — the phone's bottom-bar Page ▾ (frame G: "Page / Welcome ▾"); its top bar names the stage. */
  pageText: string;
  options: PickOption[];
} {
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
    return { value: RSVP_STAGE_KEY, buttonText: `${RSVP_STAGE_LABEL} › ${MAKER_RSVP_PAGE_LABEL}`, pageText: MAKER_RSVP_PAGE_LABEL, options };
  }
  // No stage page is ticked: the page on screen is not one of them — and the
  // button that opened it already says its name, so Page ▾ says its own.
  if (input.openPage) return { value: '', buttonText: MAKER_PAGE_MENU_LABEL, pageText: MAKER_PAGE_MENU_LABEL, options };
  const own = options.filter((o) => o.key.startsWith(makerPageValue(input.stage, '')));
  const shown =
    (input.shownPage !== null ? own.find((o) => o.key === makerPageValue(input.stage, input.shownPage!)) : undefined) ??
    own.find((o) => !o.disabledNote) ??
    own[0];
  const stageLabel = PUBLIC_STAGE_LABELS[input.stage];
  return {
    value: shown?.key ?? makerPageValue(input.stage, ''),
    buttonText: shown && shown.label !== stageLabel ? `${stageLabel} › ${shown.label}` : stageLabel,
    pageText: shown?.label ?? stageLabel,
    options,
  };
}

/**
 * 📄 PAGE ▾ ALSO HOLDS WHAT ⋯ HELD (owner 2026-10-04: the bar's ⋯ became 👁
 * Preview — *"that can be a preview icon?"*). Nothing is lost; each row moved
 * to where it belongs:
 *
 *   · the stage on screen gains, at the end of its pages, "＋ Add a scene" (a
 *     STAGE tool — never on a page) and "Reset this stage…" (a confirm, never
 *     one tap — `hub-draft-bar.tsx` asks);
 *   · after Post Event, a "Your Event Hub" line: Prints · Restore · the
 *     address · who can view · About the Maker (the address and who can view
 *     move to Event Details in a later PR).
 *
 * An action row is never the value of Page ▾: its key starts `do:` and a pick
 * runs it (`makerPageAction`). Pure, so a test holds the list.
 */
export const MAKER_PAGE_ACTIONS = {
  addScene: 'do:add-scene',
  reset: 'do:reset',
  prints: 'do:prints',
  restore: 'do:restore',
  address: 'do:address',
  who: 'do:who',
  about: 'do:about',
} as const;
export type MakerPageAction = keyof typeof MAKER_PAGE_ACTIONS;

/** The "Your Event Hub" line of Page ▾. */
export const MAKER_PAGE_HUB_GROUP = 'Your Event Hub';

export function makerPageAction(key: string): MakerPageAction | null {
  for (const [name, k] of Object.entries(MAKER_PAGE_ACTIONS)) if (k === key) return name as MakerPageAction;
  return null;
}

export function makerPageActions(
  options: readonly PickOption[],
  input: {
    stage: LifecyclePhase;
    /** ＋ Add a scene, as the work area registered it — null where it is not offered (a page, not a stage). */
    addScene: { kind: 'ready'; tried: boolean } | { kind: 'refused'; note: string } | null;
    /** The viewer has a draft to reset, restore and print from (the host). */
    hasWork: boolean;
    /** ↺ Restore: there is something to restore (the draft differs from live) — null when no draft bar answers. */
    canRestore: boolean | null;
  },
): PickOption[] {
  const out = [...options];
  const group = makerStageLabel(input.stage);
  const stageRows: PickOption[] = [];
  if (input.addScene?.kind === 'ready') {
    stageRows.push({
      key: MAKER_PAGE_ACTIONS.addScene,
      label: '＋ Add a scene',
      group,
      // ◆ PRO for a couple trying it — usable now, asked for at Apply (never a padlock).
      ...(input.addScene.tried ? { trail: { text: '◆ PRO', tone: 'muted' as const, label: paidMarkLabel('try', 'Event Hub Pro') } } : {}),
    });
  } else if (input.addScene?.kind === 'refused') {
    stageRows.push({ key: MAKER_PAGE_ACTIONS.addScene, label: '＋ Add a scene', group, disabledNote: input.addScene.note });
  }
  if (input.hasWork) stageRows.push({ key: MAKER_PAGE_ACTIONS.reset, label: 'Reset this stage…', group });
  // At the end of the stage's own pages (consecutive options share one heading).
  let at = -1;
  out.forEach((o, i) => {
    if (o.group === group && o.key.startsWith(makerPageValue(input.stage, ''))) at = i;
  });
  if (at >= 0) out.splice(at + 1, 0, ...stageRows);
  else out.push(...stageRows);
  const hub = MAKER_PAGE_HUB_GROUP;
  if (input.hasWork) out.push({ key: MAKER_PAGE_ACTIONS.prints, label: MAKER_PRINTS_LABEL, group: hub });
  if (input.canRestore !== null) {
    out.push({
      key: MAKER_PAGE_ACTIONS.restore,
      label: 'Restore what guests see',
      group: hub,
      ...(input.canRestore ? {} : { disabledNote: 'Guests already see this.' }),
    });
  }
  out.push(
    { key: MAKER_PAGE_ACTIONS.address, label: 'Your Event Hub address', group: hub },
    { key: MAKER_PAGE_ACTIONS.who, label: 'Who can view', group: hub },
    { key: MAKER_PAGE_ACTIONS.about, label: 'About the Maker', group: hub },
  );
  return out;
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
 * 📱 THE MAKER IN 4 (2026-10-02): ONE toggle, Phone — on is the phone, off
 * the desktop (`makerViewToggle`); since 2026-10-04 it is a row of 👁 Preview's
 * menu, with Both beside it, offered from this same list.
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

/**
 * 🎨 EACH OPENING OF LOOK IS ANSWERED ONCE (owner 2026-10-05: Look opens the Look
 * tools, never the guided flow's stage list). The Maker counts the openings
 * (`lookVisit`); Event Details asks this taker whether a count is new before it
 * leaves the flow — so a later mount of Details (through the Details door, or a
 * jump) never replays an old Look visit. Pure, so a test holds it.
 */
export function lookVisitTaker(): (n: number) => boolean {
  let taken = 0;
  return (n) => {
    if (n <= taken) return false;
    taken = n;
    return true;
  };
}
