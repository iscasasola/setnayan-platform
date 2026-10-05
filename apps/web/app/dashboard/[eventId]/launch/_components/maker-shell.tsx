'use client';

import { PickMenu } from '../../website/editor/_components/pick-menu';
import { GUEST_PAGE_ICON } from '../../website/editor/_components/page-pick';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Check, ChevronLeft, Eye, List, Palette, X } from 'lucide-react';
import type { TourKey } from '@/lib/tours';
import type { TourSlideView } from '@/app/_components/tour-slide-view';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useIsDesktop } from '@/lib/use-responsive';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import {
  MAKER_DETAILS_LABEL,
  MAKER_LOOK_LABEL,
  MAKER_PRINTS_LABEL,
  MAKER_TOUR_KEY,
  isMakerDevice,
  isMakerShellPage,
  lookVisitTaker,
  isStagePhase,
  makerOpenTool,
  makerPageAction,
  makerPageActions,
  makerPageMenu,
  makerPagePick,
  makerPressDoor,
  makerShownDevice,
  makerViewOptions,
  makerViewToggle,
  type MakerDoor,
} from './maker-bar';
import {
  MakerContext,
  MAKER_MORE_ROWS_ID,
  type MakerAddScene,
  type MakerDevice,
  type MakerDraftDoor,
  type MakerGuestPagesReport,
  type MakerLookPages,
  type MakerPageJump,
  type MakerSelection,
  type MakerState,
} from './maker-context';
import { movedPageItem, type DetailsItemKey } from '@/lib/maker-details-items';
import { makerGuestPages } from '@/lib/maker-guest-pages';
import { SEE_AS, SEE_AS_EDITING, type SeeAs } from '@/lib/see-as';
import { MakerTour } from './maker-tour';
import { MAKER_PLAY_SCENE_EVENT, PreviewStageLink } from './maker-play-menu';
import { MAKER_OPEN_RESET_EVENT } from '../../website/_components/maker-open-reset';
import { MakerPage } from './maker-page';
import { registerLiveLoveStory } from './maker-tools';
import { MakerPreloadLine, useMakerPreload } from './maker-preload-line';
import dynamic from 'next/dynamic';

/**
 * ⚡ THE INSTANT LOVE STORY (`love-story-live.tsx`) — its scrapbook and its
 * words, loaded the first time Love Story is opened, in a chunk of its own
 * imported from HERE ONLY — unnamed on purpose: a chunk NAME is one more entry
 * in the runtime's name map (measured: the named version was 9 bytes over). This file is the launch page's
 * alone, so the chunk has one parent — and everything it builds on (the moment
 * sheet, the chapter list, the Maker's save queue) is already on that page.
 * Imported from anywhere else (Details' stand-ins are also the editor's and the
 * dev lab's), it would need those pieces listed in the webpack runtime every
 * page downloads — measured: +139 bytes over a shared bundle with none spare.
 * The Love Story page and Details' editor reach them through the context.
 * 🧰 Handed to the Maker's tool registry (`maker-tools.tsx`) so the idle
 * preload warms them with every other tool — the registry never imports them.
 */
const LiveLoveStoryBook = dynamic(() => import('../../website/our-story/_components/love-story-live').then((m) => m.LiveLoveStoryBook));
const LiveStoryPanel = dynamic(() => import('../../website/our-story/_components/love-story-live').then((m) => m.LiveStoryPanel));
registerLiveLoveStory(LiveLoveStoryBook, LiveStoryPanel);
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { MAKER_BAR_ICON, MAKER_BAR_PHONE } from '@/lib/maker-phone-room';
import { makerAddShowsOn } from '@/lib/maker-selection';
import { previewCarriesPlace } from '@/lib/maker-preview-way-back';
import { MAKER_STAY_FIELD, makerStayReturn } from '@/lib/maker-stay';
import { announceUnheldWrite } from '@/lib/maker-refresh';
import { VIEW_AS_FREE_LABEL } from '@/lib/view-as-free';
import { ViewAsFreeKeeper, ViewAsFreeStrip, useViewAsFreeToggle } from './view-as-free';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { ICON_PILL_EXIT, IconPill } from './icon-pill';
import { LOWER_THIRD_GLOBAL_ICON, MakerLowerThird, type LowerThirdPick, type LowerThirdTile } from './maker-lower-third';
import { MAKER_LT_HEIGHT, MAKER_LT_TOOL } from '@/lib/maker-phone-room';
import { MAKER_PAGE_STAGES, makerStageLabel } from './maker-bar';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { useMakerTool, type MakerEventBar, type MakerTool } from './maker-context';
import { Info, PanelsTopLeft, Printer, RotateCcw, Undo, Users } from 'lucide-react';

/**
 * THE EVENT HUB MAKER — the full-screen shell (Phase 1 of
 * `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`; drawing
 * `prototypes/event_hub_editor_FINAL_2026-09-24.html`).
 *
 * Four regions, and only four (owner 2026-09-24: *"a main editing screen, a
 * scrollable navigation, and editing tools each"* · *"we can opt to not have
 * the sidebar and top nav. we can have a button to exit editor"*):
 *
 *   1 · the toolbar — THE MAKER IN 4 (2026-10-02, `maker-bar.ts` `MAKER_TOOLBAR`;
 *       design `prototypes/maker_in_four_2026-09-30_fable.html`):
 *         ‹ Exit · Page ▾ · Look · Event Details · ↶ Undo · 👁 Preview · ✓ Apply
 *       (rearranged 2026-10-04 — icons, no ⋯). How the page is SEEN is a row
 *       of 👁 Preview; everything else is a part of Page ▾.
 *   2 · the navigator  ┐
 *   3 · the canvas     ├ the work area — `children`, built by the editor page
 *   4 · the inspector  ┘ with every panel and its own bound action
 *
 * 🔑 CHROMELESS WITHOUT A NEW PAGE. The event layout cannot skip its rail by
 * segment (a layout is handed `params`, never the path), so instead of a +1
 * route this shell covers the viewport: `fixed inset-0` above the rail, the
 * top bar and the phone's bottom nav, with the document scroll locked while it
 * is open. The menu key `launch` and its route are unchanged (owner 2026-09-25:
 * "label change only").
 *
 * ⛔ NO DEAD BUTTONS. Every bar item does something: Page ▾ moves the canvas,
 * Look and Details open the one Details page on their part, Undo and Apply act
 * on the draft — and a control with no build is not drawn at all (never a
 * "coming in the next build" line; App Review rejects "coming soon", 2026-09-28).
 *
 * 📱 PHONE FIRST, ONE STRUCTURE (owner 2026-09-25: *"99% of the viewers will use
 * the phone"*). The bar is ONE flex row on every width — on a phone (under `md`)
 * ‹ Exit · the stage · ↶ · 👁 · ✓N fit 375 px, every button a 44 px icon with
 * its name; Page ▾ · Look · Event Details are the bottom bar's
 * (`MAKER_BAR_PHONE`, lib/maker-phone-room.ts).
 *
 * 🧩 THE DRAFT BAR MOUNTS HERE, ONCE (`applySlot`,
 * `website/_components/hub-draft-bar.tsx`): it draws Undo and Apply, and the
 * shell's Preview menu between them (`MakerState.previewMenu`). One mount — so
 * one draft bar listens for Page ▾'s "Reset this stage…" (`maker-open-reset.ts`)
 * and registers Restore for Page ▾ (`MakerState.draft`).
 */
/** One stable empty set, so the context keeps its identity when none is handed in. */
const NO_FACT_EDITORS: Partial<Record<DetailsItemKey, ReactNode>> = {};

/** Look and Details — words a first-timer reads, on every width (design frames A and G). */
const MAKER_DOOR_BUTTON =
  'sn-press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold transition-colors duration-sn-control ease-sn';

export function MakerShell({
  eventId,
  slug,
  liveStage,
  initialStage,
  initialSelection = null,
  opensOnGuide = false,
  storeShell,
  tourSlides,
  firstVisit,
  completeTourAction,
  renderStamp,
  more,
  applySlot = null,
  details = null,
  rsvpStage = null,
  factEditors = NO_FACT_EDITORS,
  hasWork,
  viewAsFree = null,
  theHost = 'the host',
  postEventTour = null,
  children,
}: {
  /** Who the Maker's work is for, in the event type's words (`EventWords.theHost`). */
  theHost?: string;
  /** 👁 "View as a free couple" — internal (§10a) viewers only; null draws
   *  nothing. `on` is the server's reading of this request (`asViewed`). */
  viewAsFree?: { on: boolean } | null;
  eventId: string;
  slug: string | null;
  /** The stage guests meet today — Page ▾'s red dot. Null when unmeasured. */
  liveStage: LifecyclePhase | null;
  initialStage: LifecyclePhase;
  initialSelection?: MakerSelection;
  /**
   * 🪜 Details opened because this event is unfinished (its guided "What's
   * left", Details part 5) — NOT because the address named it. What the couple
   * last had open in this tab then wins, so a stage they went to stays theirs.
   */
  opensOnGuide?: boolean;
  storeShell: boolean;
  /** The tour's slides, drawn on the server (`maker-tour-slides.tsx`) — Page ▾ › About the Maker plays them. */
  tourSlides: TourSlideView[];
  /** Never toured here: a first visit shows ONE quiet line instead (the Maker in 4). */
  firstVisit: boolean;
  completeTourAction: (tourKey: TourKey) => Promise<void>;
  renderStamp: string;
  /** The "Your Event Hub" sheet (Page ▾ › the address · who can view): who and when, and the doors the controller kept. */
  more: ReactNode;
  /** Phase 2's draft bar — Undo · Apply (and Reset's confirm). */
  applySlot?: ReactNode;
  /** Details as a PAGE (Look, Details and Page ▾ › Prints): `page` is what the details feed —
   *  the address and its QR, and the printed cards they fill — and `controls`
   *  the fields (what the prints include, and every line of wording). */
  details?: { page: ReactNode; controls: ReactNode } | null;
  /** 🗳 The RSVP stage (Page ▾ › RSVP) — its scenes, canvas and
   *  controls, one lazy node built by the launch page; null = not offered. */
  rsvpStage?: ReactNode;
  /** ✍ The Details items' own editors a fact tapped on a stage opens
   *  (`detailsFactEditors`) — the SAME nodes Details draws. RSVP and Love Story
   *  moved into Details whole (part 2b); their pages are Details items now. */
  factEditors?: Partial<Record<DetailsItemKey, ReactNode>>;
  /** False when the work area is not the editor (a coordinator, or an event
   *  type with no Event Hub): the doors then have nothing to open. */
  hasWork: boolean;
  /** 📖 Post Event's own first-visit hint — mounted only once the couple is ON
   *  Post Event, never on opening the Maker (its last slide names Pro). */
  postEventTour?: ReactNode;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<LifecyclePhase>(initialStage);
  const [device, setDevice] = useState<MakerDevice>('desktop');
  /* 🖥📱 Both needs 1024 px (`makerViewOptions`); narrower, it is drawn as
     Desktop and the pick is kept (`makerShownDevice`). */
  const wide = useIsDesktop('lg');
  const shownDevice = makerShownDevice(device, wide);
  const [navOpen, setNavOpen] = useState(true);
  /* 🧭 A page that moved into Details (Logo · Hero · Reveal, part 3) opens
     Details on its item — from the address, from memory, or from a door in
     the Maker (`movedSelection`). */
  const [detailsItem, setDetailsItem] = useState<DetailsItemKey | null>(() => movedSelection(initialSelection).item);
  /* 📱 Each door press opens the item's editor sheet on a phone (`MakerState.detailsDoor`). */
  const [detailsDoor, setDetailsDoor] = useState(0);
  /* 🎨 Each time Look is opened — a door press, or Theme picked in the lower third. */
  const [lookVisit, setLookVisit] = useState(0);
  const takeLookVisit = useMemo(() => lookVisitTaker(), []);
  /* 🏷 The guided flow's one title while it is on screen (`MakerState.guideTitle`). */
  const [guideTitle, setGuideTitle] = useState<string | null>(null);
  const [selection, setSelection] = useState<MakerSelection>(() => movedSelection(initialSelection).selection);
  const [lookPages, setLookPages] = useState<MakerLookPages | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  /* 🧰 THE LOWER THIRD (phone): the tool open in it, its navigator's slot, the
     canvas's Event Bar as the work area registered it, and Settings picked. */
  const [tool, setTool] = useState<MakerTool | null>(null);
  const [ltSlot, setLtSlot] = useState<HTMLElement | null>(null);
  const [eventBar, setEventBar] = useState<MakerEventBar | null>(null);
  const [settingsOn, setSettingsOn] = useState(false);
  const phone = !wide;
  /* 🎓 About the Maker (Page ▾) replays the short tour — never on a first open. */
  const [tour, setTour] = useState(false);
  /* 👁 SEE AS ▾ (PR-10) — the canvas as a sample guest, or null for the couple's
     own editing canvas. Kept across stages (a guest is a guest on every stage);
     never written anywhere — not the draft, not the tab's memory. */
  const [seeAs, setSeeAs] = useState<SeeAs | null>(null);
  /* 📄 Page ▾ — what the work area reports, and the pick waiting for its stage. */
  const [guestPages, setGuestPages] = useState<MakerGuestPagesReport | null>(null);
  const [pageJump, setPageJump] = useState<MakerPageJump | null>(null);
  const clearPageJump = useCallback(() => setPageJump(null), []);
  /* ↺ Restore, as the draft bar registered it (Page ▾ › Restore). */
  const [draft, setDraft] = useState<MakerDraftDoor | null>(null);

  /*
    🪤 MEASURED IN THE BROWSER: EVERY SAVE REMOUNTS THIS SHELL. Each panel
    posts to an action that redirects back here with a new query (`?scene=`,
    `?saved=1`), and the App Router keys a page by its search params — so the
    whole Maker mounts fresh after each write, and the stage, the device and
    the open navigator all snapped back to their defaults. What the couple was
    looking at is kept for the tab in sessionStorage and put back on mount (a
    convenience only: every fact the Maker shows is re-read from the server).
    ✅ 2026-09-28: a Maker save no longer remounts it at all — the submit
    listener below lands every save on the address the couple is already on
    (`lib/maker-stay.ts`). The memory stays for a real reload and a fresh visit.
  */
  const memoryKey = `sn-maker:${eventId}`;
  const restored = useRef(false);
  /** The address named what to open — memory then never moves Details' item. */
  const addressNamed = useRef(initialSelection !== null && !opensOnGuide);
  const openedOnGuide = useRef(opensOnGuide);
  useEffect(() => {
    let saved: { stage?: string; device?: string; navOpen?: boolean; selection?: MakerSelection } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(memoryKey) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved && isStagePhase(saved.stage)) setStage(saved.stage);
    if (isMakerDevice(saved?.device)) setDevice(saved.device);
    else if (window.matchMedia('(max-width: 767px)').matches) setDevice('phone');
    if (typeof saved?.navOpen === 'boolean') setNavOpen(saved.navOpen);
    // An address that names what to open (a save's `?scene=`) wins over memory.
    if (openedOnGuide.current && saved && 'selection' in saved) {
      // 🪜 Opened on What's left by default: the tab's own last place wins — a stage included.
      const moved = movedSelection(saved.selection ?? null);
      setSelection(moved.selection);
      if (moved.item) setDetailsItem(moved.item);
    } else if (saved?.selection) {
      const moved = movedSelection(saved.selection);
      setSelection((cur) => cur ?? moved.selection);
      if (moved.item && !addressNamed.current) setDetailsItem((d) => d ?? moved.item);
    }
    restored.current = true;
  }, [memoryKey]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(memoryKey, JSON.stringify({ stage, device, navOpen, selection }));
    } catch {
      /* private mode / blocked storage: the Maker simply opens on its defaults */
    }
  }, [memoryKey, stage, device, navOpen, selection]);

  /* ⚡ THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT AFTER IT OPENS (owner 2026-10-02).
     No tool panel is in the Maker's first load; once the Maker has loaded and
     the phone is idle, every one (`MAKER_TOOLS`) is fetched and warmed, so the
     first tap on any tool draws it at once. Shown as a thin line under the top
     bar; nothing at all with Save-Data on. Only where there is work: a
     coordinator has no tools to open. */
  const preload = useMakerPreload(hasWork);

  /* The document under the Maker must not scroll behind it. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sn-maker-open');
    return () => root.classList.remove('sn-maker-open');
  }, []);

  /* 📱 THE KEYBOARD NEVER COVERS A FIELD (owner 2026-09-25: *"99% of the viewers
     will use the phone"*). A phone's on-screen keyboard shrinks the VISUAL
     viewport only, so a `fixed inset-0` shell kept its full height and the
     keyboard sat over the controls strip at its foot. While the keyboard is up
     (visual viewport shorter than the layout one, at scale 1 — never a pinch)
     the shell is sized to what is visible. */
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = shellRef.current;
    if (!vv || !el) return;
    const fit = () => {
      const keyboard = Math.abs(vv.scale - 1) < 0.01 && vv.height < window.innerHeight - 80;
      el.style.height = keyboard ? `${Math.round(vv.height)}px` : '';
      el.style.top = keyboard ? `${Math.round(vv.offsetTop)}px` : '';
      el.style.bottom = keyboard ? 'auto' : '';
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  /* 🧷 A MAKER SAVE NEVER REMOUNTS THE MAKER (owner 2026-09-28: *"a lot of
     times. it reloads the whole page. which shouldn't"*). Every Maker panel
     posts to an action that redirects to its `return_to` + `?saved=1`; a new
     query is a new page key, so the App Router swapped the whole Maker for the
     launch route's grid skeleton and mounted it fresh. Here, in the CAPTURE
     phase — before React reads the form into its action — a Maker form is
     pointed back at the address the couple is already on, verbatim
     (`lib/maker-stay.ts`). Nothing remounts; only the data changes. Every form
     is also announced as a write the canvas did not draw (its hold is
     dropped), unless the form says the bridge drew it (`data-maker-held`). */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const here = `${window.location.pathname}${window.location.search}`;
      const returnTo = form.querySelector<HTMLInputElement>('input[name="return_to"]');
      const next = makerStayReturn({
        eventId,
        here,
        returnTo: returnTo?.value ?? null,
        drafts: Boolean(form.querySelector(`input[name="${HUB_DRAFT_FIELD}"]`)),
        /* A React action form carries NO method attribute (a client-rendered
           one reads `form.method` as 'get'); only an explicit GET is a search. */
        method: form.getAttribute('method') ?? 'post',
      });
      if (next) {
        setHiddenField(form, 'return_to', next);
        setHiddenField(form, MAKER_STAY_FIELD, '1');
      }
      if ((form.getAttribute('method') ?? 'post').toLowerCase() !== 'get' && form.dataset.makerHeld !== '1') {
        announceUnheldWrite();
      }
    };
    el.addEventListener('submit', onSubmit, true);
    return () => el.removeEventListener('submit', onSubmit, true);
  }, [eventId]);

  /*
    👋 THE FIRST OPEN IS THE PAGE ITSELF (owner 2026-10-02, "SIMPLIFY FIRST, THEN
    TOUR"; FIRST_TIMER_TEST fix 6). No slides and no Pro pitch before the first
    tap — ONE quiet line on the canvas, gone at the couple's first touch, and
    that touch is what records the Maker's tour as seen. A tap inside the canvas
    lands in its frame, which blurs this window — that counts too. Pro is met
    where it is tried: a Pro thing tapped wears ◆ PRO, and Apply asks.
  */
  const [hint, setHint] = useState(firstVisit && hasWork);
  const recordedHint = useRef(false);
  useEffect(() => {
    if (!hint) return;
    const el = shellRef.current;
    const done = () => {
      setHint(false);
      if (!recordedHint.current) {
        recordedHint.current = true;
        completeTourAction(MAKER_TOUR_KEY).catch(() => {
          /* unrecorded: the line simply shows once more next time */
        });
      }
    };
    el?.addEventListener('pointerdown', done, true);
    window.addEventListener('blur', done);
    window.addEventListener('keydown', done);
    return () => {
      el?.removeEventListener('pointerdown', done, true);
      window.removeEventListener('blur', done);
      window.removeEventListener('keydown', done);
    };
  }, [hint, completeTourAction]);


  const select = useCallback((next: MakerSelection) => {
    const moved = movedSelection(next);
    if (moved.item) setDetailsItem(moved.item);
    setSelection(moved.selection);
  }, []);
  /* ＋ ADD A SCENE — registered by the work area (`MakerAddScene`); Page ▾'s row is
     drawn from it below. */
  const [addScene, setAddScene] = useState<MakerAddScene | null>(null);

  /* 👁 PREVIEW — the bar's eye (owner 2026-10-04, on the ⋯ beside Apply: *"that
     can be a preview icon?"*). One menu of how the page is SEEN: See as ·
     Phone / Desktop · Both · Scenes · Play this scene · Preview the stage
     (`previewRows`, below). Drawn by the draft bar between Undo and Apply
     (`MakerState.previewMenu`), or alone by a viewer with no draft. Its rows
     are read when it opens, so they are always this render's. */
  const previewMenu = (
    <ToolMenu label="Preview" tool="preview" align="end" icon={<Eye aria-hidden className="h-5 w-5" strokeWidth={1.75} />}>
      {(close) => previewRows(close)}
    </ToolMenu>
  );

  const openDoor = selection?.kind === 'tool' ? makerOpenTool(selection.key, detailsItem) : null;
  /* 🧰 THE LOWER THIRD'S PICK (phone) — one of the menu's two groups: a stage,
     or Theme · Settings · Details (Look · Event Details · Prints are those). */
  /* The door the open Details page is on IS its item's (`makerDoorOf`): a jump to
     another item (Look → the address) moves the pick with it. */
  const doorShown: MakerDoor | null =
    selection?.kind === 'tool' && selection.key === 'details' && (openDoor === 'look' || openDoor === 'details' || openDoor === 'prints')
      ? openDoor
      : null;
  const ltPick: LowerThirdPick =
    selection?.kind === 'tool' && selection.key === 'rsvp-stage'
      ? RSVP_STAGE_KEY
      : doorShown === 'look'
        ? 'theme'
        : doorShown === 'details'
          ? 'details'
          : doorShown === 'prints' || settingsOn
            ? 'settings'
            : stage;
  /* The navigator's slot is handed to the layer on screen — none for Settings'
     own rows (the lower third draws them), except Prints, whose pieces follow;
     none on a desktop (its columns). */
  const ltNav = phone && (ltPick !== 'settings' || doorShown === 'prints') ? ltSlot : null;
  /* Settings stays the pick only while nothing else is: a scene, a part or a
     stage picked (on the page or anywhere) leaves it. */
  useEffect(() => {
    if (selection && !(selection.kind === 'tool' && selection.key === 'details')) setSettingsOn(false);
  }, [selection]);
  useEffect(() => setSettingsOn(false), [stage]);
  /* The part on screen, as the layer on screen says it ("RSVP form", "Names"). */
  const [ltWhere, setLtWhere] = useState<string | null>(null);

  const value = useMemo<MakerState>(
    () => ({
      eventId,
      stage,
      setStage,
      device: shownDevice,
      navOpen,
      selection,
      select,
      moreOpen,
      renderStamp,
      storeShell,
      seeAs,
      setSeeAs,
      addScene,
      setAddScene,
      detailsItem,
      setDetailsItem,
      detailsDoor,
      lookVisit,
      takeLookVisit,
      guideTitle,
      setGuideTitle,
      lookPages,
      setLookPages,
      factEditors,
      liveLoveStoryBook: LiveLoveStoryBook as ComponentType<Record<string, unknown>>,
      liveStoryPanel: LiveStoryPanel as ComponentType<Record<string, unknown>>,
      guestPages,
      setGuestPages,
      pageJump,
      clearPageJump,
      previewMenu,
      draft,
      setDraft,
      tool,
      setTool,
      lowerThird: phone,
      ltNav,
      eventBar,
      setEventBar,
      setLtWhere,
    }),
    // `previewMenu` is a fresh node each render — its rows are read when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, stage, shownDevice, navOpen, selection, select, moreOpen, renderStamp, storeShell, seeAs, addScene, detailsItem, detailsDoor, lookVisit, guideTitle, lookPages, factEditors, guestPages, pageJump, clearPageJump, draft, tool, phone, ltNav, eventBar],
  );

  /* 🚪 LOOK · DETAILS · PAGE ▾ › PRINTS — three doors into the one Details page
     (`makerPressDoor`). Exactly one wears the highlight (`makerOpenTool`), and
     pressing the open one closes it: the page under it comes back. */
  const pressDoor = (key: MakerDoor) => {
    if (!hasWork) return;
    if (openDoor === key) {
      select(null);
      return;
    }
    setDetailsItem(makerPressDoor({ detailsItem }, key).detailsItem);
    if (key === 'look') setLookVisit((n) => n + 1);
    setDetailsDoor((n) => n + 1);
    select({ kind: 'tool', key: 'details' });
  };
  /* 🧰 The lower third opens Look or Event Details on its NAVIGATOR — the
     page and its parts as tiles; a tile opens its editor (owner 2026-10-05,
     frame 6: "one menu, then parts, then scenes"). The same door, no sheet yet. */
  const openDoorOnNavigator = (key: MakerDoor) => {
    if (!hasWork || openDoor === key) return;
    setDetailsItem(makerPressDoor({ detailsItem }, key).detailsItem);
    if (key === 'look') setLookVisit((n) => n + 1);
    select({ kind: 'tool', key: 'details' });
  };

  /* 📄 PAGE ▾ — the stages, each with its guest pages (`makerPageMenu`). The
     stage on screen lists what the work area reported (its empty pages say
     so); every other stage lists its guest bar's pages (`makerGuestPages`). */
  const hasStory = guestPages?.hasStory ?? true;
  const page = makerPageMenu({
    stage,
    rsvpOpen: selection?.kind === 'tool' && selection.key === 'rsvp-stage',
    liveStage,
    pagesOf: (s) =>
      guestPages?.stage === s ? guestPages.pages : makerGuestPages(s, [], hasStory).map((p) => ({ key: p.key, label: p.label })),
    shownPage: guestPages?.stage === stage ? guestPages.shown : null,
    hasWork,
    theHost,
    /* 📍 Look · Event Details · Prints cover the stage: Page ▾ names that page. */
    openPage: openDoor === 'look' ? MAKER_LOOK_LABEL : openDoor === 'details' ? MAKER_DETAILS_LABEL : openDoor === 'prints' ? MAKER_PRINTS_LABEL : null,
  });
  /* 📱 Frame G's top line names the stage — or the Maker page that covers it. */
  /* 🏷 In the guided flow: ONE title per stage (owner 2026-10-05) — the stage being walked, never Look/Event Details by turns. */
  const openStageWord = (openDoor === 'look' || openDoor === 'details') && guideTitle ? guideTitle : openDoor === 'look' ? MAKER_LOOK_LABEL : openDoor === 'details' ? MAKER_DETAILS_LABEL : openDoor === 'prints' ? MAKER_PRINTS_LABEL : openDoor === 'rsvp-stage' ? 'RSVP' : null;
  /* ＋ Add a scene is a STAGE tool — never on a page (owner 2026-09-28: *"cannot
     see the scenes. and it should only show on stages."*). */
  const stageAdd = makerAddShowsOn(selection) ? addScene : null;

  /* Each page wears the guest bar's own icon (`page-pick.tsx`), as it did in the navigator. */
  const pageOptions = makerPageActions(page.options.map((o) => {
    const pick = makerPagePick(o.key);
    const Icon = pick?.kind === 'page' ? GUEST_PAGE_ICON[pick.page as keyof typeof GUEST_PAGE_ICON] : undefined;
    return Icon ? { ...o, icon: <Icon className="h-4 w-4" strokeWidth={1.75} /> } : o;
  }), {
    stage,
    addScene: stageAdd?.kind === 'ready' ? { kind: 'ready', tried: stageAdd.tried === true } : stageAdd?.kind === 'refused' ? { kind: 'refused', note: stageAdd.note } : null,
    hasWork: hasWork && applySlot !== null,
    canRestore: draft ? draft.canRestore : null,
  });
  const pickPage = (key: string) => {
    /* 📄 A row that moved here from ⋯ (`makerPageActions`) runs its act. */
    const act = makerPageAction(key);
    if (act) {
      if (act === 'addScene') {
        if (stageAdd?.kind === 'ready') stageAdd.open();
      } else if (act === 'reset') window.dispatchEvent(new Event(MAKER_OPEN_RESET_EVENT));
      else if (act === 'prints') pressDoor('prints');
      else if (act === 'restore') {
        if (draft?.canRestore) draft.restore();
      } else if (act === 'about') setTour(true);
      else setMoreOpen(true);
      return;
    }
    const pick = makerPagePick(key);
    if (!pick) return;
    if (pick.kind === 'rsvp') {
      if (hasWork) select({ kind: 'tool', key: 'rsvp-stage' });
      return;
    }
    // A page closes any open door — the canvas is the page.
    if (selection?.kind === 'tool') select(null);
    setPageJump((j) => ({ stage: pick.stage, key: pick.page, n: (j?.n ?? 0) + 1, sameStage: pick.stage === stage }));
    setStage(pick.stage);
  };

  /* ══ 🧰 THE LOWER THIRD (phone) — the menu, the pick, the navigator ══
     (owner 2026-10-05, "approve": `maker_lower_third_interactive_2026-10-05_fable.html`). */
  const ltGlobal = [
    ...(hasWork ? [{ key: 'theme', label: 'Theme', icon: LOWER_THIRD_GLOBAL_ICON.theme }] : []),
    { key: 'settings', label: 'Settings', icon: LOWER_THIRD_GLOBAL_ICON.settings },
    ...(hasWork ? [{ key: 'details', label: 'Details', icon: LOWER_THIRD_GLOBAL_ICON.details }] : []),
  ];
  const ltStages = MAKER_PAGE_STAGES.filter((s) => hasWork || s !== RSVP_STAGE_KEY).map((s) => ({
    key: s,
    label: makerStageLabel(s),
    ...(s === liveStage ? { dot: true } : {}),
  }));
  const ltPickLabel = ltGlobal.find((g) => g.key === ltPick)?.label ?? makerStageLabel(ltPick as LifecyclePhase | typeof RSVP_STAGE_KEY);
  const onLtPick = (key: string) => {
    if (key === 'settings') {
      setSettingsOn(true);
      if (selection?.kind === 'tool') select(null);
      return;
    }
    setSettingsOn(false);
    if (key === 'theme') return openDoorOnNavigator('look');
    if (key === 'details') return openDoorOnNavigator('details');
    if (key === RSVP_STAGE_KEY) {
      if (hasWork) select({ kind: 'tool', key: 'rsvp-stage' });
      return;
    }
    if (isStagePhase(key)) {
      if (selection) select(null);
      setStage(key);
    }
  };
  /* The pick's own tiles: a stage's PAGES (the guest bar's, as Page ▾ listed
     them), or Settings' rows — the hub-wide switches and acts that lived in Page ▾. */
  const ltParts: LowerThirdTile[] =
    ltPick === 'settings'
      ? [
          ...(eventBar
            ? [{ key: 'event-bar', label: 'Event Bar', icon: <PanelsTopLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />, toggle: true, on: eventBar.on, onPick: eventBar.toggle }]
            : []),
          { key: 'who', label: 'Who can view', icon: <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />, on: moreOpen, onPick: () => setMoreOpen(true) },
          ...(hasWork
            ? [{ key: 'prints', label: MAKER_PRINTS_LABEL, icon: <Printer aria-hidden className="h-5 w-5" strokeWidth={1.75} />, on: openDoor === 'prints', onPick: () => openDoorOnNavigator('prints') }]
            : []),
          ...(draft
            ? [{
                key: 'restore',
                label: 'Restore what guests see',
                icon: <Undo aria-hidden className="h-5 w-5" strokeWidth={1.75} />,
                on: false,
                disabled: !draft.canRestore,
                note: draft.canRestore ? undefined : 'Guests already see this.',
                onPick: () => draft.canRestore && draft.restore(),
              }]
            : []),
          ...(hasWork && applySlot !== null
            ? [{ key: 'reset', label: 'Reset this stage…', icon: <RotateCcw aria-hidden className="h-5 w-5" strokeWidth={1.75} />, on: false, onPick: () => window.dispatchEvent(new Event(MAKER_OPEN_RESET_EVENT)) }]
            : []),
          { key: 'about', label: 'About the Maker', icon: <Info aria-hidden className="h-5 w-5" strokeWidth={1.75} />, on: tour, onPick: () => setTour(true) },
        ]
      : isStagePhase(ltPick)
        ? page.options
            .filter((o) => {
              const pk = makerPagePick(o.key);
              return pk?.kind === 'page' && pk.stage === stage;
            })
            .map((o) => ({
              key: o.key,
              label: o.label,
              on: o.key === page.value,
              disabled: Boolean(o.disabledNote),
              note: o.disabledNote,
              onPick: () => pickPage(o.key),
            }))
        : [];
  /* "Where you are": the part on screen — the page of a stage, or what the layer says. */
  const ltWhereWords = isStagePhase(ltPick) ? page.pageText : ltPick === 'settings' ? 'Your Event Hub' : (ltWhere ?? ltPickLabel);
  /* 🏷 THE TOP LINE — the screen you are on (owner 2026-10-05: "RSVP · RSVP
     form"): the pick and its part — the tool open, else the part on screen —
     or, in the guided flow, its one title (the stage being walked). */
  const screenLabel = (() => {
    const head = guideTitle && (openDoor === 'look' || openDoor === 'details') ? (openStageWord ?? ltPickLabel) : ltPickLabel;
    const part = tool?.name ?? ltWhereWords;
    return part && part !== head ? `${head} · ${part}` : head;
  })();

  /* ▶ The stage as guests meet it — page-only, with the host's DRAFT
     (`?preview=draft`, host-verified on the page; `app/[slug]/_lib/editor-canvas.ts`). */
  const playHref = slug ? `/${slug}?phase=${stage}&preview=draft` : null;
  /* ▶ Play this scene — a scene (or a fixed section) is selected, or the Hero /
     Reveal, which play in their frame inside Details (`details-look-pages.tsx`). */
  const sceneSelected =
    selection?.kind === 'scene' ||
    (selection?.kind === 'tool' && ['hero', 'reveal', 'post-event'].includes(selection.key)) ||
    (selection?.kind === 'tool' && selection.key === 'details' && (detailsItem === 'hero' || detailsItem === 'reveal'));
  const bothView = makerViewOptions(wide).find((o) => o.key === 'both') ?? null;

  /* 🎨 LOOK · 🗂 EVENT DETAILS — the desktop's top bar (on a phone: the lower
     third's Theme and Details, owner 2026-10-05). */
  const doors = (['look', 'details'] as const).map((door) => {
    const label = door === 'look' ? MAKER_LOOK_LABEL : MAKER_DETAILS_LABEL;
    const icon =
      door === 'look' ? (
        <Palette aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <List aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      );
    if (!hasWork) {
      return (
        <span key={door} className="hidden lg:inline-flex">
          <ShutDoor label={label} note={`Only ${theHost} can open this part of the Event Hub Maker.`} tool={door}>
            {icon}
            {label}
          </ShutDoor>
        </span>
      );
    }
    const on = openDoor === door;
    return (
      <button
        key={door}
        type="button"
        data-maker-tool={door}
        aria-pressed={on}
        onClick={() => pressDoor(door)}
        className={`${MAKER_DOOR_BUTTON} hidden lg:inline-flex ${on ? 'bg-ink text-cream' : 'bg-white/70 text-ink hover:bg-white'}`}
      >
        {icon}
        {label}
      </button>
    );
  });

  /* 👁 PREVIEW'S ROWS — how the page is SEEN (owner 2026-10-04): See as ·
     Phone / Desktop · Both · Scenes · Play this scene · Preview the stage. What
     ⋯ held besides moved to Page ▾ (`makerPageActions`) — nothing is lost
     (`the-toolbar-is-the-maker-in-four.test.ts`). */
  /* 👁 ON A SETUP SCREEN THE PREVIEW IS SEEN (owner 2026-10-05: the eye "did
     nothing" there). Event Details and the RSVP stage COVER the canvas, so a
     view picked under them changed a page nobody could see: a pick that changes
     how the page is seen (See as · Phone / Desktop · Both) also puts the stage
     back on screen, drawn that way. */
  const coveringPage = selection?.kind === 'tool' && isMakerShellPage(selection.key);
  const seeTheStage = () => {
    if (coveringPage) select(null);
  };
  const previewRows = (close: () => void) => (
        <>
          {/* 👁 SEE AS ▾ (PR-10, owner 2026-10-04 — it was "See it as…", a role's
              door): the canvas as a SAMPLE guest who hasn't replied, replied Yes,
              declined or is signed out (`SEE_AS`). On a phone these rows; on a
              desktop the same pick is the one dropdown above the preview
              (editor-shell.tsx `data-maker-see-as`), so each width has one. */}
          {hasWork ? (
            <div className="contents lg:hidden" data-maker-see-as-rows="">
              <MenuHeading>See as</MenuHeading>
              <MenuItem on={seeAs === null} onClick={() => { setSeeAs(null); seeTheStage(); close(); }}>
                {SEE_AS_EDITING.label}
              </MenuItem>
              {SEE_AS.map((s) => (
                <MenuItem key={s.key} on={seeAs === s.key} note={s.note ?? undefined} onClick={() => { setSeeAs(s.key); seeTheStage(); close(); }}>
                  {s.label}
                </MenuItem>
              ))}
            </div>
          ) : null}
          {/* 👁 Internal accounts only — see `view-as-free.tsx`. */}
          {viewAsFree ? <ViewAsFreeRow on={viewAsFree.on} close={close} /> : null}
          {/* 🖥📱 Phone / Desktop — one toggle (`makerViewToggle`). */}
          <MenuItem on={shownDevice === 'phone'} onClick={() => { setDevice(makerViewToggle(shownDevice)); seeTheStage(); close(); }}>
            <span data-maker-tool-row="view">{shownDevice === 'phone' ? 'Phone — tap for the desktop' : 'Show it on a phone'}</span>
          </MenuItem>
          {/* 🖥📱 Both — the phone and the desktop side by side, from 1024 px. */}
          {bothView ? (
            <MenuItem on={device === 'both'} onClick={() => { setDevice(device === 'both' ? 'desktop' : 'both'); seeTheStage(); close(); }}>
              Phone and desktop
            </MenuItem>
          ) : null}
          {/* ▤ The scenes column (a desktop column; on a phone it is the strip under the page). */}
          {hasWork ? (
            <MenuItem className="hidden lg:flex" on={navOpen} onClick={() => { setNavOpen((o) => !o); close(); }}>
              <span data-maker-tool-row="scenes">Scenes</span>
            </MenuItem>
          ) : null}
          {/* ▶ PLAY (owner 2026-09-25: *"play scene will play on the scene
              editor only. play stage will open a new page"*). */}
          {playHref ? (
            <>
              <MenuItem
                disabled={!sceneSelected}
                note={sceneSelected ? undefined : 'Tap a scene first.'}
                onClick={() => {
                  close();
                  window.dispatchEvent(new Event(MAKER_PLAY_SCENE_EVENT));
                }}
              >
                Play this scene
              </MenuItem>
              <PreviewStageLink
                href={previewCarriesPlace(playHref, selection)}
                stageLabel={PUBLIC_STAGE_LABELS[stage]}
                storeShell={storeShell}
                className={MENU_ITEM}
                onPicked={close}
              />
            </>
          ) : null}
        </>
  );

  return (
    <MakerContext.Provider value={value}>
      {/* An inline <style>, not a CSS import: unit tests load these modules.
          ① The scroll lock. ② 🪤 MEASURED IN THE BROWSER: the layout's
          `.sn-vt-page` carries `view-transition-name`, which makes it a
          STACKING CONTEXT — so this shell's z-index was trapped inside it and
          the app's sticky top bar (z-20, outside it) painted over the Maker's
          toolbar. While the Maker is on the page that name is dropped, so
          `fixed inset-0 z-[80]` really is above the rail, the top bar and the
          bottom nav. `:has()` applies it from the first server paint; the
          class is the fallback once hydrated. */}
      <style>
        {'html.sn-maker-open,html.sn-maker-open body,html:has([data-maker-shell]),html:has([data-maker-shell]) body{overflow:hidden}' +
          'html.sn-maker-open .sn-vt-page,.sn-vt-page:has([data-maker-shell]){view-transition-name:none}'}
      </style>
      <div
        ref={shellRef}
        /* 📱 Sized to the VISIBLE screen (owner 2026-10-02, in a mobile browser:
           Safari's and Chrome's own bars take a lot of it) — `100dvh`, never
           `100vh`/`inset-0`'s full height; the keyboard is `visualViewport`'s
           (the effect above). Held by lib/the-maker-keeps-the-page-on-a-phone.test.ts. */
        className="fixed inset-x-0 top-0 z-[80] flex h-[100dvh] flex-col bg-cream text-ink"
        data-maker-shell=""
        /* 🧰 The lower third's height — every phone tool is sized from it (`MAKER_LT_TOOL`). */
        style={{ ['--maker-lt-h' as string]: MAKER_LT_HEIGHT }}
        aria-label="Event Hub Maker"
        role="region"
      >
        {/* ══ 1 · THE TOOLBAR ══ (`MAKER_TOOLBAR`, maker-bar.ts; rearranged 2026-10-04)
              ‹ Exit · Page ▾ · Look · Event Details · ↶ Undo · 👁 Preview · ✓ Apply
            ONE flex row on every width (owner 2026-10-02: on a phone the bar
            wrapped and Apply dropped to a second row) — on a phone each item
            declares its width (`MAKER_BAR_PHONE`). ⛔ Nothing else sits here:
            the stages, Add a scene, Reset, Prints, Restore, the address, who
            can view and About are Page ▾'s; See as · Phone / Desktop ·
            Both · Scenes · Play are 👁 Preview's. Format · Animate · Arrange live only as the
            inspector's own tabs (owner: *"repeated. just place it on the
            sidebar instead of the top bar?"*). */}
        <header
          data-maker-toolbar=""
          /* 📱 On a phone: ‹ Exit · the stage you are on · ↶ · 👁 · ✓N — one row
             of 44 px icons (`MAKER_BAR_PHONE`, lib/maker-phone-room.ts); Page ▾ ·
             Look · Event Details are the bottom bar's. A status says itself OVER
             the canvas there. */
          data-phone-chrome="bar"
          data-phone-chrome-name="the toolbar"
          className="sn-glass-bare relative z-20 flex shrink-0 flex-nowrap items-center gap-x-1 px-2 py-1 max-lg:h-[52px] lg:gap-1.5 lg:px-2.5"
        >
          {/* ✕ EXIT — red, its OWN pill (owner 2026-10-05: *"exit on the left side is
              red with an X icon"* — "‹" read as back one step); the draft is kept. */}
          <IconPill tone="exit">
            <Link
              href={`/dashboard/${eventId}`}
              aria-label="Exit"
              title="Exit — your draft is kept"
              data-maker-tool="exit"
              data-bar-item="Exit"
              className={`${ICON_PILL_EXIT} ${MAKER_BAR_PHONE.exit}`}
            >
              <X aria-hidden className="h-5 w-5 lg:hidden" strokeWidth={2.4} />
              {/* 🖥 A desktop keeps its ‹ this round. */}
              <ChevronLeft aria-hidden className="hidden h-6 w-6 lg:block" strokeWidth={2} />
            </Link>
          </IconPill>

          {/* 📱 THE SCREEN YOU ARE ON (owner 2026-10-05: "RSVP · When yes") — the
              stage and its page ("Invitation · Welcome"), or the Maker page that
              covers it; one line that truncates. */}
          <p
            data-bar-item="Stage"
            data-bar-fill=""
            data-maker-screen-label=""
            className={`min-w-0 flex-1 truncate px-1 text-[13.5px] font-semibold text-ink lg:hidden ${MAKER_BAR_PHONE.stage}`}
          >
            {screenLabel}
          </p>

          {/* 📄 PAGE ▾ — ONE dropdown: the stages, each with its guest pages. A
              desktop's; on a phone the lower third's menu and navigator are. */}
          <div className={`flex min-w-0 flex-1 lg:max-w-[20rem] lg:flex-none ${MAKER_BAR_PHONE.pageTop}`} data-maker-tool="page">
            <PickMenu
              label="Page"
              dataAttr="data-maker-page-menu"
              value={page.value}
              buttonText={page.buttonText}
              options={pageOptions}
              onPick={pickPage}
              className="w-full lg:w-auto"
            />
          </div>

          {/* 🎨 LOOK · 🗂 DETAILS — the two doors a first-timer needs, in words.
              On a desktop here; on a phone they are the lower third's Theme and Details. */}
          {doors}

          {/* The desktop's gap between the doors and the draft (a phone has no room for one). */}
          <i aria-hidden className="hidden flex-1 lg:block" />

          {/* 💾 ↶ UNDO · 👁 PREVIEW · ✓ APPLY — the draft bar (`applySlot`), mounted
              once, draws the Preview menu between its two (owner 2026-10-04).
              Its root is `display: contents`, so each is an item of THIS row. */}
          {applySlot ? (
            <div className="contents" data-maker-apply-slot="">
              {applySlot}
            </div>
          ) : (
            <IconPill label="Preview">{previewMenu}</IconPill>
          )}
          {/* ➖ The tools' download, as a thin line along the bar's foot (owner 2026-10-02). */}
          <MakerPreloadLine progress={preload} />
        </header>

        {/* 👁 While the switch is on it is SAID, on every width, until stopped. */}
        {viewAsFree?.on ? <ViewAsFreeStrip /> : null}
        {/* ⏱ The switch ends when the Maker does (unmount · pagehide). */}
        {viewAsFree?.on ? <ViewAsFreeKeeper /> : null}

        {/* ══ 2 · 3 · 4 · THE WORK AREA ══ */}
        <div className="relative min-h-0 flex-1">
          {children}
          {/* 👋 The first open's one quiet line — never a dialog, never a tap target. */}
          {hint ? (
            <p
              role="status"
              data-maker-first-hint=""
              className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] font-semibold text-ink/75 shadow-sm ring-1 ring-ink/10"
            >
              Tap anything to change it
            </p>
          ) : null}
          {/* 🖼 DETAILS IS A PAGE (owner 2026-09-25: *"we do not want a pop up for
              details, logo, hero, reveal and love story"*): what the details
              feed is the body, the fields sit where a stage's controls sit. It
              covers the work area — the editor keeps its state underneath — as
              a page in the body, never a dialog. Look, Details and Page ▾ › Prints
              all open THIS one page, on their own part. */}
          {hasWork && selection?.kind === 'tool' && selection.key === 'details' ? (
            <div className="absolute inset-0 z-30 flex bg-cream" data-maker-details-layer="">
              <MakerPage
                pageKey="details"
                page={
                  details?.page ?? (
                    /* A read that failed is SAID, never an empty page. */
                    <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700">
                      Your details could not be loaded just now. Nothing was changed — please reopen this in a moment.
                    </p>
                  )
                }
                controls={details?.controls ?? null}
              />
            </div>
          ) : null}
          {/* 🗳 THE RSVP STAGE — Page ▾ › RSVP (owner 2026-09-30 re-plan), drawn
              like Details: it covers the work area, the editor keeps its state
              underneath. Picking another page puts that stage back. */}
          {hasWork && selection?.kind === 'tool' && selection.key === 'rsvp-stage' ? (
            <div className="absolute inset-0 z-30 flex bg-cream" data-maker-rsvp-layer="">
              {rsvpStage ?? (
                <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700">
                  Your RSVP could not be loaded just now. Nothing was changed — please reopen this in a moment.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* ══ 🧰 THE LOWER THIRD ══ (phone) — where you are · the navigator; a tool
            open folds them into the left column and takes the rest. It REPLACES
            the bottom bar (Page ▾ · Look · Event Details) and the canvas's
            floating Event Bar switch (owner 2026-10-05, "approve"). */}
        <MakerLowerThird
          pick={ltPick}
          pickLabel={ltPickLabel}
          where={ltWhereWords}
          global={ltGlobal}
          stages={ltStages}
          onPick={onLtPick}
          parts={ltParts}
          tool={phone ? tool : null}
          setNav={setLtSlot}
          stepTiles={ltNav !== null}
        />

        {/* ══ YOUR EVENT HUB · THE SHEET ══ (Page ▾ › the address · who can view) Kept mounted (hidden when shut) so the work area
            can portal the address rows into it. */}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
          <div id={MAKER_MORE_ROWS_ID} className="flex flex-col gap-2" />
          {more}
        </MoreSheet>

        {/* 📖 Post Event's own hint — only once the couple is on Post Event, and
            never over the first open's line. */}
        {stage === 'editorial' && !hint ? postEventTour : null}

        {tour ? (
          <MakerTour
            slides={tourSlides}
            record={false}
            completeAction={completeTourAction}
            onClose={() => setTour(false)}
            onStart={() => {
              setTour(false);
              // 🎨 The tour ends on Look — theme, background, font and colours (2026-10-02).
              if (hasWork) pressDoor('look');
            }}
          />
        ) : null}
      </div>
    </MakerContext.Provider>
  );
}

/**
 * A door that is shut to this viewer (a coordinator: Look and Details are the
 * couple's) — pressing it says why, in one line, in the same glass bubble the
 * house `(i)` uses (`.sn-tip`). Never a dead button.
 */
export function ShutDoor({
  label,
  note,
  tool,
  children,
}: {
  label: string;
  note: string;
  /** The toolbar item this door is (`data-maker-tool`, `MAKER_TOOLBAR`). */
  tool: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  /* Placed against the VIEWPORT, not the button's box: a bar that wraps or
     scrolls would clip anything that hangs below it — a dead button again. */
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 32);
    setAt({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)), width });
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-label={label}
        data-maker-tool={tool}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
        className={`${MAKER_DOOR_BUTTON} bg-white/50 text-ink/60 hover:bg-white/70`}
      >
        {children}
      </button>
      <span
        role="status"
        hidden={!open || !at}
        style={at ? { position: 'fixed', top: at.top, left: at.left, width: at.width } : undefined}
        className="z-50"
      >
        <span className="sn-tip-body sn-glass-bare block">{note}</span>
      </span>
    </span>
  );
}

/**
 * ▾ THE BAR'S ONE MENU — 👁 Preview (2026-10-04; it was ⋯). A 44 px icon named by its label; the list opens under it, stays
 * on screen (placed against the viewport, like `ComingNext`), and closes on a
 * pick, a click outside and Escape. `children` is handed `close`.
 */
function ToolMenu({
  label,
  tool,
  icon,
  align = 'start',
  children,
}: {
  label: string;
  tool: string;
  icon: ReactNode;
  align?: 'start' | 'end';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const oneOpenId = useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-maker-tool={tool}
        data-bar-item={label}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) {
            const width = Math.min(260, window.innerWidth - 16);
            const left = align === 'end' ? r.right - width : r.left;
            setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
          }
          setOpen((o) => !o);
        }}
        className={`${MAKER_BAR_ICON} ${MAKER_BAR_PHONE.preview}`}
      >
        {icon}
      </button>
      {open && at ? (
        <span
          role="menu"
          aria-label={label}
          data-maker-tool-menu={tool}
          style={{ position: 'fixed', top: at.top, left: at.left, width: Math.min(260, typeof window === 'undefined' ? 260 : window.innerWidth - 16) }}
          className="z-50 flex max-h-[70dvh] flex-col overflow-y-auto rounded-xl bg-white p-1 ring-1 ring-ink/10 shadow-[0_24px_48px_-20px_rgba(30,26,18,.45)]"
        >
          <OneOpenScope id={oneOpenId}>{children(close)}</OneOpenScope>
        </span>
      ) : null}
    </span>
  );
}

/** One row of 👁 Preview — a menu item, or the Preview link drawn as one. */
const MENU_ITEM =
  'sn-press flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] text-ink transition-colors duration-sn-control ease-sn hover:bg-ink/5 lg:min-h-9';

function MenuItem({
  on,
  disabled = false,
  note,
  onClick,
  className = '',
  children,
}: {
  /** A radio item that is the current choice (a tick). */
  on?: boolean;
  disabled?: boolean;
  /** Why it is off, or what it will be — said on the item, never a dead row. */
  note?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={on === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={on === undefined ? undefined : on}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`${MENU_ITEM} ${disabled ? 'cursor-default text-ink/45 hover:bg-transparent' : ''} ${on ? 'font-semibold' : ''} ${className}`}
    >
      <span className="min-w-0 flex-1">
        {children}
        {note ? <small className="block text-[11px] font-normal text-ink/50">{note}</small> : null}
      </span>
      {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.4} /> : null}
    </button>
  );
}

/** Set (or add) one hidden field on a form, before React reads it. */
function setHiddenField(form: HTMLFormElement, name: string, value: string) {
  const existing = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (existing) {
    existing.value = value;
    return;
  }
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/** 👁 The "View as a free couple" row — its own component so the router hook
 *  it needs mounts only for an internal viewer, inside the open menu. */
function ViewAsFreeRow({ on, close }: { on: boolean; close: () => void }) {
  const setViewAsFree = useViewAsFreeToggle();
  return (
    <MenuItem on={on} onClick={() => { close(); setViewAsFree(!on); }}>
      <span data-maker-view-as-free-row="">{VIEW_AS_FREE_LABEL}</span>
    </MenuItem>
  );
}

function MenuHeading({ children }: { children: ReactNode }) {
  return <span className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">{children}</span>;
}

function MoreSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  /* On a desktop it is a side sheet that says aria-modal, so it manages focus:
     in, trapped, restored, Esc closes (the house `useModalA11y`,
     `modal-a11y-adoption.test.ts`). On a phone it is a tool of the lower third
     — not modal: the column beside it names it and closes it. */
  const sheetRef = useRef<HTMLElement>(null);
  const wide = useIsDesktop('lg');
  useModalA11y({ open: open && wide, onClose, containerRef: sheetRef });
  /* 🧰 On a phone it is a TOOL of the lower third (Settings › Who can view) —
     the column names it and closes it; nothing opens over the page. */
  useMakerTool(open, { key: 'more', name: 'Your Event Hub', close: onClose });
  return (
    <div hidden={!open} className="lg:absolute lg:inset-0 lg:z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        /* The dimmed page behind the desktop's side sheet — a desktop's only. */
        className="hidden h-full w-full cursor-default bg-ink/25 backdrop-blur-[2px] lg:absolute lg:inset-0 lg:block"
      />
      <aside
        ref={sheetRef}
        hidden={!open}
        /* A dialog on every width; modal (its focus trap) on a desktop only. */
        role="dialog"
        aria-modal={wide ? true : undefined}
        aria-label="Your Event Hub"
        data-phone-chrome="panel"
        className={`overflow-y-auto bg-cream p-3 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[min(560px,92vw)] lg:p-6 ${MAKER_LT_TOOL}`}
      >
        <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
          <p className="font-serif text-xl text-ink">Your Event Hub</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

/**
 * 🧭 A selection of a page that moved into Details (DECISION_LOG 2026-09-28
 * "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS") is Details, open on that
 * page's item — so every door that still says `{ kind: 'tool', key: 'hero' }`
 * (a scene's "Open the hero", an old address, the tab's memory) lands there.
 * A page whose item has not landed yet (`movedPageItem` → null) opens as before.
 */
function movedSelection(next: MakerSelection): { selection: MakerSelection; item: DetailsItemKey | null } {
  const item = next?.kind === 'tool' ? movedPageItem(next.key) : null;
  return item ? { selection: { kind: 'tool', key: 'details' }, item } : { selection: next, item: null };
}
