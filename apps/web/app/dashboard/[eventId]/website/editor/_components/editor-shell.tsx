'use client';

import { MakerHalfSheet } from '../../../launch/_components/maker-sheet';
import { makerSectionInView } from '@/app/[slug]/_components/maker-section-find';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ELEMENT_SHEET_CLOSED, elementSheetStep, type ElementSheetEvent, type ElementSheetState } from '@/lib/element-sheet-state';
import { Eye, EyeOff, Lock, Palette, PanelsTopLeft, PencilLine, QrCode } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { QrActions } from '@/app/_components/qr-actions';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase, WidgetType } from '@/lib/invitation-widgets';
import type { RowStatus } from './rail-rows';
import { unlockLabel } from './unlock-label';
import {
  MAKER_MORE_ROWS_ID,
  MAKER_OPEN_PART_EVENT,
  useMaker,
  type MakerSceneTab,
  type MakerSelection,
} from '../../../launch/_components/maker-context';
import { MAKER_PLAY_SCENE_EVENT } from '../../../launch/_components/maker-play-menu';
import { isMakerShellPage, type MakerShellPage } from '../../../launch/_components/maker-bar';
import { HubDraftField } from '../../_components/hub-draft-field';
import { SceneTemplatePicker } from './scene-template-picker';
import { CanvasStaysOnThePage, MakerRefusesToBeFramed } from './maker-canvas-guard';
import { swapsForDrop, stageTakesOwnScenes, MAKER_FIXED_SOURCE, type MakerStageList } from '@/lib/maker-scene-list';
import { keysLeavingWith } from '@/lib/invitation-welcome';
import type { MakerNavigatorData, SceneMini } from './maker-navigator-data';
import { ScenePreview } from './scene-preview';
import type { ElementDraftAction, ElementPalette, ElementTarget } from './element-sheet';
import { detailsItemForSection, detailsItemForTap } from '@/lib/maker-details-selection';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import { LOOK_ROW_OF, isLookRow } from '@/lib/maker-look-sections';
import { DetailsFactSceneContext } from '../../../launch/_components/details-tap';
import { askScheduleFocus } from '../../../schedule/_components/schedule-focus';
import { detailsFactOfScene, sceneBoundText, type DetailsFact } from '@/lib/details-bound';
import { isWordsScene, tapOpensWords } from '@/lib/maker-scene-words';
import { CanvasWordsContext, type CanvasWords } from './canvas-words';
import {
  NO_CANVAS_HOLD,
  canvasKeepsItsPage,
  canvasOrderOf,
  heldCanvasFor,
  holdCanvas,
  holdChange,
  orderWithout,
  sceneDrawEffect,
  type CanvasHold,
} from './element-preview';
import { HUB_DRAFT_BAR_FIELD, makerNeedsRender, makerSave, requestMakerRefresh, MAKER_UNHELD_WRITE_EVENT } from '@/lib/maker-refresh';
import { draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import { announceMakerSave } from '@/lib/maker-save-status';
import { movedOrder, optimisticStageList, sameOrder, stageOrderPatch } from '@/lib/maker-reorder';

const REORDER_FAILED = 'That move could not be saved. Your scenes are back where they were — please try again.';
const GATE_FAILED = 'That could not be saved. The scene is back as it was — please try again.';
import { preloadMakerFonts, preloadMakerImages, whenIdle } from '@/lib/maker-preload';
import { BufferedCanvasFrame, warmCanvasBudget, type CanvasFrame } from './buffered-canvas-frame';
import { MAKER_CANVAS_POST_EVENT, MAKER_CANVAS_STALE_EVENT } from '@/lib/maker-live-preview';
import { bothLayout, scaledFrame, usePaneSize } from './both-view';
import { INSPECTOR_DEFAULT_W, ToolsResizeHandle, clampToolsWidth, type ToolsResize } from './tools-resize';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubFontKey } from '@/lib/hub-fonts';
import { canvasDocument, readTileHead, snapshotSection } from './scene-snapshot';
import type { TileHead, TileSnapshot } from '@/lib/maker-tile-preview';
import { navigatorRows, navigatorTabs, parseNavigatorBar, tabOfTile, type NavigatorBarItem } from '@/lib/maker-navigator-tabs';
import { makerGuestPages, ME_NOT_ON_CANVAS, type MakerGuestPage } from '@/lib/maker-guest-pages';
import { SEE_AS, SEE_AS_EDITING, SEE_AS_PARAM, seeAsDrawsMe, seeAsLabel, seeAsOf } from '@/lib/see-as';
import { PickMenu } from './pick-menu';
import {
  canvasKeyOfSelection,
  fixedOfKey,
  fixedScenePanel,
  selectionForCanvasKey,
  selectionForTile,
  tileIsSelected,
  MAKER_FIXED_TICKET,
} from '@/lib/maker-selection';
import { PASS_CARD_DESIGNS, PASS_CARD_DESIGN_LABEL, PASS_CARD_WORDS, type PassCardDesign } from '@/lib/pass-card';
import { makerTicketSrc } from '@/lib/pass-design-save';
import { TicketPlaceholder } from '@/app/_components/ticket-placeholder';
import {
  HUB_ELEMENT_EXCLUDED_WIDGETS,
  HUB_ELEMENT_LABEL,
  HUB_HERO_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_KEYS,
  heroPartsFor,
  isHubElementKey,
  type HubElementKey,
} from '@/lib/element-style';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { InspectorTabs } from './inspector-kit';
import { SCENE_TABS, SceneAnimateTab, SceneArrangeTab, SceneLayoutRow, SceneParts, type SceneTab } from './scene-inspector';
import { FixedSceneStyleRow, PaletteLookCanvasRow, PostEventScenePanel, PostEventWordsField, SceneStyleCanvasRow } from './scene-styles-lazy';
import { postEventStatusWord, postEventTileLabel, postEventTileNote, type PostEventTile } from './post-event-tile-words';
import { isFixedStyleScene, type FixedSceneStyles } from '@/lib/fixed-scene-styles';
import { postEventSetElements } from '@/lib/post-event-draft';
import { postEventElementScope, postEventSceneOfScope, postEventWordParts } from '@/lib/post-event-styles';
import type { SceneUpload } from './scene-background-row';
/* ⚡ A scene's background row loads when a scene is edited — never with the Maker (`details-lazy.tsx`). */
import { DetailsBoundField, ElementSheet, PassCardDesignPicker, SceneBackgroundRow, TypeBar } from '../../../launch/_components/details-lazy';
import { IntoLowerThird } from '../../../launch/_components/maker-lower-third';
import { readTypeStart, type SceneTypeWords, type TypeStart } from '@/lib/hub-part-words';
import type { NameParts, NameStyle } from '@/lib/name-style';
import { MAKER_STRIP_PHONE } from '@/lib/maker-phone-room';
import { floatOpenTips } from '@/lib/float-open-tips';

/**
 * THE MAKER'S WORK AREA — navigator · canvas · inspector (Event Hub Maker,
 * Phase 1). The editor page builds every panel on the server with its OWN
 * bound action and hands them here as elements; this component only decides
 * which one is showing. It never owns a write path.
 *
 * ── THE NAVIGATOR ────────────────────────────────────────────────────────
 * One numbered thumbnail per section of the page (`invitation_widgets`), in
 * `display_order`, with "Main" pinned on top. The EYE (lower-right) is the
 * section's visibility; the transition between two scenes is marked between
 * them. Drag a scene to move it (or long-press / right-click → Move up · Move
 * down · Hide). It resizes by its edge and collapses from the toolbar.
 *
 * 🔑 EVERY WRITE IS A FORM POST TO AN ACTION THAT ALREADY SHIPS —
 * `toggleWidgetVisibility`, `setSectionMode`, `moveWidgetUp/Down` — with a
 * `return_to` back to this page, and `draft=1` (`HubDraftField`), so each one
 * lands in the DRAFT (Maker Phase 2): guests see nothing until Apply. The
 * scenes this component is handed are the draft laid over the live rows
 * (`website/editor/page.tsx`), so the eye and the order read what was drafted. A drag of N places is N single swaps, CHAINED
 * through the address (`?chain=`): each post redirects here carrying the rest,
 * and this component fires the next on arrival. So a move is the same write a
 * couple could make by hand, one step at a time, and a refused step stops the
 * chain rather than skipping ahead.
 *
 * 👁 WHAT THE EYE MEANS, MEASURED — not assumed. The guest page has two gates:
 * `is_visible` (the default render path) and `mode` (open browsing, where
 * `hidden`/`shown` override and `auto` falls back to `is_visible`). An eye that
 * wrote only one of them would hide a scene on one path and leave it showing on
 * the other. So hiding a `shown` scene sets `mode` back first AND THEN
 * `is_visible`, and showing a `hidden` one does the reverse — both gates agree
 * after every press.
 */

/*
  ══ 2026-09-25 · THIS FILE IS NOW THE EVENT HUB MAKER'S WORK AREA ══
  It held `EditorShell` — the two-pane rail + preview. The Maker replaced that
  shell (Phase 1 of EVENT_HUB_MAKER_BUILD_PLAN), and what the rail did is
  PORTED here, not dropped: the rows and their chips (the ⋯ sheet), the live
  preview (the canvas), scan-to-view, and the one Pro CTA. The row types stay
  exported from this path because the editor page and its guards name it.

  🔴 `done()`/`todo()` are NOT here and are not re-exported — see
  `rail-rows.ts`. This file is `'use client'`; the server page CALLING a client
  export returned a 500 for the whole editor (production 2026-09-23).
*/

export type RailRow = {
  key: string;
  label: string;
  blurb?: string;
  href: string;
  status?: RowStatus;
  /** Which preview section this row points at (EditorBridge SECTION_IDS key). */
  anchor?: string;
  /** Website Pro item — gold tag; `locked` adds the lock affordance. */
  pro?: boolean;
  locked?: boolean;
  /** The inline panel — rendered by the SERVER page with the feature's own
   *  bound server action; this client file only decides where it shows. */
  panel?: React.ReactNode;
};

export type RailGroup = {
  key: string;
  title: string;
  hint?: string;
  rows: RailRow[];
};

export type MakerScene = {
  id: string;
  type: string;
  label: string;
  mode: 'auto' | 'shown' | 'hidden';
  isVisible: boolean;
  hasContent: boolean;
  /** Scroll · Scrub · Auto — the transition INTO the next scene. */
  transitionLabel: string;
};

export type MakerRowPanel = {
  label: string;
  blurb?: string;
  anchor?: string;
  /** The row's own claim — filled or not. The chip's colour follows it. */
  status?: RowStatus;
  node: ReactNode;
};

type FormAction = (formData: FormData) => void | Promise<void>;

/** Which content panel a section is written in. Absent = written elsewhere. */
const NO_TYPE_HERE: readonly SceneTypeWords[] = [];

const CONTENT_ROW_FOR_TYPE: Record<string, string> = {
  hero: 'hero',
  event_details: 'details',
  schedule: 'details',
  venue_map: 'details',
  countdown: 'details',
  dress_code: 'dress-code',
  photo_moments: 'photo-moments',
  special_message: 'special-message',
  what_to_bring: 'what-to-bring',
  our_photos: 'gallery',
  our_love_story: 'story',
};

/**
 * The made-once group (Phase 6) — Logo · Hero · Reveal — each a workspace of its
 * own (`launch/_components/maker-made-once.tsx`), handed in as `madeOnce` and
 * registered into Details (part 3). Love Story's page, the scrapbook, is Details
 * › Story & plans › Love Story, built by the launch page (part 2b).
 */
export type MadeOnceKey = 'logo' | 'hero' | 'reveal' | 'reveal-options';

const TOOL_ROWS: Record<string, string[]> = {
  hero: ['hero'],
  reveal: ['save-the-date'],
  'post-event': ['editorial'],
};

// 🎨 The 🎨 button's panel: the song and the invitation backdrop. The Main
// background, the font and the colours MOVED into Look (owner 2026-10-02,
// tracker f40 — `lib/maker-look-sections.ts`); an old `?open=` naming one of
// them opens Look (`isLookRow`).
const MAIN_ROWS = ['music', 'backdrop'];

/** The canvas's "Event Bar" switch (was "Guest bars"), remembered for this browser session. */
const GUEST_BARS_KEY = 'setnayan:maker-guest-bars';
const MORE_ROWS = ['go-live', 'visibility', 'launch-phase', 'open-browse'];

export function MakerWork({
  eventId,
  publicLandingUrl,
  scenes: scenesProp,
  navigator,
  scenePanels,
  rows,
  ownsPro,
  initialScene = null,
  initialOpenRow = null,
  chain = null,
  toggleAction,
  setModeAction,
  moveUpAction,
  moveDownAction,
  proUnlockHref,
  proPriceLabel,
  showProCta,
  addScene = null,
  postEventPresets = null,
  sceneFacts = null,
  madeOnce = null,
  revealStages = ['save_the_date'],
  elementEditing = null,
  detailsBound = null,
  sceneRemovers = {},
  sceneFormat = null,
}: {
  /** 🧰 A couple's own scene's confirm-first Remove (server form), by scene id — under Arrange. */
  sceneRemovers?: Record<string, ReactNode>;
  /**
   * 🧰 THE SCENE INSPECTOR'S FORMAT TAB (Keynote rebuild, 2026-09-27): the
   * background choices' inputs — the couple's palette, uploads and theme — and
   * Animate's one lock. Null = the tabs fall back to saying why they are empty.
   */
  sceneFormat?: {
    colorChoices: readonly string[];
    photoChoices: readonly { ref: string; url: string }[];
    videoChoice: { ref: string; url: string; poster?: string | null } | null;
    /** The scenes' own in-place uploads (their `scene-background` folder), signed. */
    sceneUploads?: readonly SceneUpload[];
    /** 💾 `events.couple_media_bytes`, settled — the 100 MB meter beside Upload media. */
    mediaUsedBytes?: number;
    mediaHref: string;
    hubTheme: string;
    openBrowse: boolean;
    hideLocked: boolean;
    /** Two people at the centre — the hero has a Joiner to style. */
    twoPeople: boolean;
    /** 🎨 The event type — a scene's styles adapt to it (`lib/scene-styles.ts`). */
    eventType?: string | null;
    /**
     * The hero is the invitation card (no hero photo, not the solemn register)
     * — it draws the line, time and link; otherwise the venue. Absent = every
     * part is listed.
     */
    heroCard?: boolean;
    /** A hero photo/video — its cover plate draws the Photo caption. Absent = listed. */
    heroPhoto?: boolean;
    /** 🎨 The five fixed parts' style picks, live with the draft laid on (`lib/fixed-scene-styles.ts`). */
    fixedStyles?: FixedSceneStyles;
    /** ✍ The hero names' Wording ▾ — the event's Name style and one of the couple's own names to show it in. */
    names?: { style: NameStyle; person: NameParts | null };
    /** 🎫 The guest's Ticket style — the drafted one when the draft holds it, else live (`print_details.pass_design`). */
    ticketStyle?: PassCardDesign;
  } | null;
  /**
   * 🔗 DETAILS IS THE SOURCE (owner 2026-09-25) — Details' values (drafted over
   * live) for the scenes bound to them, the scenes whose words are still their
   * own from before binding (their Content stays as it was), and the first-visit
   * tour. A bound scene's Content tab asks "everywhere or just here"
   * (`details-bound-field.tsx`); null = not offered.
   */
  detailsBound?: {
    values: Record<DetailsFact, string | null>;
    ownWords: readonly string[];
    tour?: ReactNode;
    /** ✍ AP-11's starting point for the message box, and its hint (never saved by itself). */
    startingPoint?: string | null;
    startingHint?: string;
  } | null;
  /**
   * 🔤 PER-ELEMENT EDITING (owner 2026-09-27: *"we want the font color size and
   * animation"*) — every scene's canvas as the canvas draws it (the draft over
   * live), by widget type, and the theme's colours for the swatches. A tap ON an
   * element opens its sheet (`element-sheet.tsx`); null = not offered here.
   */
  elementEditing?: {
    canvases: Record<string, HubSectionCanvas>;
    palette: ElementPalette;
    /** `hubDraftAction` — the one draft door; every choice is a draft save. */
    draftAction: ElementDraftAction;
    /** 🔤 The faces the Event Hub renders now (`hubFontsInUse`) — the font dropdowns' "In use". */
    fontsInUse?: readonly HubFontKey[];
    /**
     * ✍ TAP ANY TEXT, ON EVERY SCENE (`lib/scene-type-words.ts`): the scene words
     * a tap types in, with the words each draws now (the draft over live) —
     * told to every canvas that loads — and each scene of their own's words, the
     * half a typed heading or body carries along.
     */
    typeHere?: readonly SceneTypeWords[];
    ownWords?: Readonly<Record<string, { title: string; body: string }>>;
  } | null;
  /** Where the couple has the reveal play (drafted over live, `lib/reveal-stages.ts`)
   *  — the Reveal page previews the first of them. */
  revealStages?: readonly LifecyclePhase[];
  /** Logo · Hero · Reveal — the made-once workspaces (Phase 6), and Love Story's
   *  own page (the scrapbook). Server-rendered; each opens as a page in the body.
   *  An absent key falls back to the inspector row the tool used to open. */
  madeOnce?: Partial<Record<MadeOnceKey, ReactNode>> | null;
  /** The event's names, monogram and days to go, for the built-on template tiles. */
  sceneFacts?: { names?: string | null; monogram?: string | null; days?: number | null } | null;
  /**
   * "+ ADD A SCENE" — the 25 templates (Event Hub Maker Phase 5). The action
   * (`addCustomSection`) and where it lands; null when a scene cannot be added
   * here (not Pro, all six in use, or the store shell) — the `note` form then
   * says why, in the same place, instead of a button that would be refused.
   */
  addScene?:
    | {
        action: FormAction;
        returnTo: string;
        /** The first-visit tour (`MiniTour`), server-rendered and handed down; mounts when the sheet opens. */
        tour?: ReactNode;
        /** 💎 No Event Hub Pro: the scene is tried free and Apply asks — the ＋ wears ◆ PRO. */
        tried?: boolean;
      }
    | { note: string }
    | null;
  /**
   * 🎞 POST EVENT'S "+" — its twelve presets (`lib/post-event-presets.ts`),
   * posted to the SAME `addCustomSection` draft door with `post_event_preset`.
   * Offered to every couple (Pro is asked for at Apply — E3), null in the store
   * shell. `used` = their own scenes across every stage (six, shared — E5).
   */
  postEventPresets?: { action: FormAction; returnTo: string; used: number; ownsPro: boolean; storeShell: boolean } | null;
  proUnlockHref: string;
  /** The live catalogue price, formatted — null when unread (never remembered). */
  proPriceLabel: string | null;
  /** False once they own Pro, and always in the store shell. */
  showProCta: boolean;
  eventId: string;
  publicLandingUrl: string | null;
  scenes: MakerScene[];
  /** 🧭 Per stage, what the canvas draws and in what order — see `maker-navigator-data.ts`. */
  navigator: MakerNavigatorData;
  scenePanels: Record<string, ReactNode>;
  rows: Record<string, MakerRowPanel>;
  ownsPro: boolean;
  initialScene?: string | null;
  initialOpenRow?: string | null;
  chain?: string | null;
  toggleAction: FormAction;
  setModeAction: FormAction;
  moveUpAction: FormAction;
  moveDownAction: FormAction;
}) {
  const maker = useMaker();
  /* 👁 A SCENE SHOWN OR TAKEN OFF IS SHOWN AS SUCH AT ONCE (owner 2026-09-29:
     *"make sure 100% that there is no slow response on the maker"*). The eye and
     Auto · Hidden are drawn here the moment they are pressed; the server's
     render takes over as soon as it agrees (or the pick is put back if the save
     is refused). `gateWrite` below. */
  const [gates, setGates] = useState<Record<string, Pick<MakerScene, 'mode' | 'isVisible'>>>({});
  const scenes = useMemo(
    () => (Object.keys(gates).length === 0 ? scenesProp : scenesProp.map((sc) => (gates[sc.id] ? { ...sc, ...gates[sc.id] } : sc))),
    [scenesProp, gates],
  );
  useEffect(() => {
    setGates((g) => {
      let changed = false;
      const next = { ...g };
      for (const sc of scenesProp) {
        const o = g[sc.id];
        if (o && o.mode === sc.mode && o.isVisible === sc.isVisible) {
          delete next[sc.id];
          changed = true;
        }
      }
      return changed ? next : g;
    });
  }, [scenesProp]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  /* 🔥 A PICK THE BRIDGE DRAWS GOES TO EVERY STAGE THE MAKER HOLDS WARM — the
     shown canvas and the stages loaded behind it (`buffered-canvas-frame.tsx`),
     so switching stage after a pick shows the pick, not the page from before
     it. A warm frame that could not take it is reloaded by the buffer. */
  const canvasBroadcast = useRef<((message: unknown) => void) | null>(null);
  /** The stage's last scene on the canvas (set each render) — where an added scene lands. */
  const lastSceneKeyRef = useRef<string | null>(null);
  /* 🖥📱 THE "BOTH" VIEW's phone pane (`both-view.ts`) — ONE more buffered
     frame of the same address, mounted only while Both is on. Everything the
     bridge draws reaches it through the same broadcast, below. */
  const bothFrameRef = useRef<HTMLIFrameElement | null>(null);
  const bothLoading = useRef<Window | null>(null);
  const bothBackground = useRef<Set<Window>>(new Set());
  const bothBroadcast = useRef<((message: unknown) => void) | null>(null);
  const broadcastToCanvasRef = useRef<(message: unknown) => void>(() => {});
  const broadcastToCanvas = (message: unknown) => {
    if (canvasBroadcast.current) canvasBroadcast.current(message);
    else frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    bothBroadcast.current?.(message);
  };
  /** To the stage canvas SHOWN — and, in Both, the phone pane shown beside it —
   *  except the frame a message came from (a tap already drew itself there). */
  const postToShownCanvases = useCallback((message: unknown, except: MessageEventSource | null = null) => {
    for (const f of [frameRef.current, bothFrameRef.current]) {
      const w = f?.contentWindow;
      if (w && w !== except) w.postMessage(message, window.location.origin);
    }
  }, []);
  broadcastToCanvasRef.current = broadcastToCanvas;
  const [navWidth, setNavWidth] = useState(168);
  /* The tools column's width, beside the navigator's (owner 2026-09-27:
     "navigation is resizable, so does the editing tool on the right"). */
  const [toolsWidth, setToolsWidth] = useState(INSPECTOR_DEFAULT_W);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moreHost, setMoreHost] = useState<HTMLElement | null>(null);
  /* ＋ ADD A SCENE — one sheet, two doors: the toolbar's ＋ (the shell draws it
     from what is registered below) and "+ Add a scene" at the end of the
     navigator. Both open this. */
  const [addOpen, setAddOpen] = useState(false);

  const stage = maker?.stage ?? 'rsvp';
  const selection = maker?.selection ?? null;
  const select = maker?.select;
  /* ▁ The selection now, for a canvas tap: another scene keeps the sheet's section (its tab). */
  const selectionNow = useRef(selection);
  selectionNow.current = selection;
  /* 🔤 The element being edited — a tap ON a part in the canvas. Its own sheet
     takes the inspector's place; choosing anything in the navigator closes it. */
  /* 📱 …held as ONE small state — the part, whether the sheet is folded to its
     bar on a phone, and its section (Text · Motion · Arrange) — whose every
     transition is `elementSheetStep` (owner 2026-10-04: a tap outside the part
     folds the sheet; a tap on another part switches it, same section). */
  const [sheet, sheetDo] = useReducer(
    (st: ElementSheetState<ElementTarget>, ev: ElementSheetEvent<ElementTarget>) => elementSheetStep(st, ev),
    ELEMENT_SHEET_CLOSED as ElementSheetState<ElementTarget>,
  );
  const elementTarget = sheet.target;
  const setElementTarget = useCallback(
    (next: ElementTarget | null | ((prev: ElementTarget | null) => ElementTarget | null)) => sheetDo({ t: 'set', target: next }),
    [],
  );
  const elementRef = useRef<ElementTarget | null>(null);
  elementRef.current = elementTarget;
  const elementEditingOn = Boolean(elementEditing);
  const elementEditingRef = useRef(elementEditingOn);
  elementEditingRef.current = elementEditingOn;
  const selectionKey = canvasKeyOfSelection(selection, scenes);
  useEffect(() => {
    if (elementRef.current && elementRef.current.key !== selectionKey) setElementTarget(null);
  }, [selectionKey, stage, setElementTarget]);
  /* ✍ TAP-TO-TYPE (Maker core part 2): the tap that began typing on the
     canvas. Only the tap is kept here — the bar (`type-in-place.tsx`, loaded
     with the Details pieces) hears every keystroke itself, so a letter never
     re-renders the Maker. A tap on a part's words closes that part's sheet;
     on a desktop it selects the scene too (on a phone nothing rises over the
     keyboard). */
  const [typeStart, setTypeStart] = useState<TypeStart | null>(null);
  /** 🧰 This typing's rows sit inside the part's tools (a phone), never floating. */
  const [typeInline, setTypeInline] = useState(false);
  const typeRef = useRef<TypeStart | null>(null);
  typeRef.current = typeStart;
  useEffect(() => {
    const onType = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === 'setnayan-site' && d.t === 'edit') setTypeStart(null);
      const start = readTypeStart(event.data, event.source, Date.now());
      if (!start) return;
      /* 🧰 A PHONE: ONE tap on a part opens ITS tools in the lower third — the
         navigator folds left, Text · Motion · Arrange — and the words are still
         typed right there on the page (owner 2026-10-05, the lower third
         approved). The type bar's rows sit inside the Text tools; nothing floats. */
      if (window.innerWidth < 1024 && elementEditingRef.current && isHubElementKey(start.el)) {
        sheetDo({ t: 'tapPart', target: { key: start.key, widgetType: start.key === 'f:hero' ? 'hero' : start.key.slice(2), el: start.el, range: null } });
        sheetDo({ t: 'section', section: 'text' });
        setTypeInline(true);
        setTypeStart(start);
        return;
      }
      setElementTarget(null);
      if (window.innerWidth >= 1024) {
        const picked = selectionForCanvasKey(start.key, scenes);
        if (picked) select?.(picked);
      }
      setTypeInline(false);
      setTypeStart(start);
    };
    window.addEventListener('message', onType);
    return () => window.removeEventListener('message', onType);
  }, [scenes, select, setElementTarget]);
  const endTyping = () => {
    (typeStart?.source as Window | null)?.postMessage({ source: 'setnayan-editor', t: 'typeStop' }, window.location.origin);
    setTypeStart(null);
  };
  /* 🧰 …and on a phone the typing lives as long as THAT part's tools: × , a tap
     off the part, ‹ › to another part or a tile ends it too. */
  const endTypingRef = useRef(endTyping);
  endTypingRef.current = endTyping;
  useEffect(() => {
    const t = typeRef.current;
    if (!t || window.innerWidth >= 1024) return;
    if (!elementTarget || elementTarget.key !== t.key || elementTarget.el !== t.el) endTypingRef.current();
  }, [elementTarget]);
  /* The Text tools' slot the phone's type rows are drawn into (`TypeBar` `inline`). */
  const [typeSlot, setTypeSlot] = useState<HTMLElement | null>(null);
  /* 📱 THE PAGE GOES BACK WHEN THE LAST EDIT CLOSES (`canvas-bring-up.ts`). A
     part brought up for the keyboard or its sheet is put back by ONE rule, here,
     whichever way the edit ends — Done, ✕, Escape, a tap outside, a tile, Page ▾,
     a stage switch: when NEITHER the type bar NOR the part's sheet is open any
     more, every canvas (warm ones too) is told to `settle`. Style ▾ closes the
     bar and opens the sheet in one render, so it never settles in between —
     nothing is timed. When a TAP ON THE CANVAS ended it (a fact, a scene's words,
     the folded sheet's second tap), that tap's place wins: `forget`. */
  const editingOpen = typeStart !== null || elementTarget !== null;
  const wasEditing = useRef(false);
  const endedByCanvasTap = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editingOpen) {
      broadcastToCanvasRef.current({ source: 'setnayan-editor', t: 'settle', ...(endedByCanvasTap.current ? { forget: true } : {}) });
    }
    wasEditing.current = editingOpen;
    endedByCanvasTap.current = false;
  }, [editingOpen, typeStart, elementTarget, sheet]);
  /* ✍ …ON EVERY SCENE (`lib/scene-type-words.ts`): each canvas that loads is
     told which scene words a tap types in, and says back which it found, by
     stage. Where the caret really reaches, that scene's words box steps aside
     (`typedHereOn`) — one place per setting, never two. */
  const typeHereParts = elementEditing?.typeHere ?? NO_TYPE_HERE;
  const typeHereRef = useRef(typeHereParts);
  typeHereRef.current = typeHereParts;
  const [typedHere, setTypedHere] = useState<Readonly<Record<string, readonly string[]>>>({});
  useEffect(() => {
    const onTypeHere = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { source?: unknown; t?: unknown; phase?: unknown; found?: unknown } | null;
      if (d?.source !== 'setnayan-site') return;
      if (d.t === 'ready') {
        (event.source as Window | null)?.postMessage(
          { source: 'setnayan-editor', t: 'typeHere', parts: typeHereRef.current },
          window.location.origin,
        );
      } else if (d.t === 'typeHereFound' && Array.isArray(d.found)) {
        const phase = typeof d.phase === 'string' ? d.phase : '';
        const found = d.found.filter((f): f is string => typeof f === 'string');
        setTypedHere((prev) => (prev[phase]?.join('\n') === found.join('\n') ? prev : { ...prev, [phase]: found }));
      }
    };
    window.addEventListener('message', onTypeHere);
    return () => window.removeEventListener('message', onTypeHere);
  }, []);
  /* A render with other words (Apply, Undo, a box's save): every frame hears them again. */
  const typeHereFp = JSON.stringify(typeHereParts);
  const typeHereSent = useRef(typeHereFp);
  useEffect(() => {
    if (typeHereSent.current === typeHereFp) return;
    typeHereSent.current = typeHereFp;
    broadcastToCanvasRef.current({ source: 'setnayan-editor', t: 'typeHere', parts: typeHereRef.current });
  }, [typeHereFp]);
  const typedHereOn = (key: string, field: string) => (typedHere[stage] ?? []).includes(`${key}|${field}`);
  /* 💎 The Apply sheet's "Go to" a part's own font or motion (owner 2026-09-28):
     the toolbar selects the scene, then asks for the part's sheet here. */
  useEffect(() => {
    const onOpenPart = (e: Event) => {
      const d = (e as CustomEvent<{ key?: unknown; widgetType?: unknown; el?: unknown }>).detail;
      if (d && typeof d.key === 'string' && typeof d.widgetType === 'string' && isHubElementKey(d.el)) {
        setElementTarget({ key: d.key, widgetType: d.widgetType, el: d.el });
      }
    };
    window.addEventListener(MAKER_OPEN_PART_EVENT, onOpenPart);
    return () => window.removeEventListener(MAKER_OPEN_PART_EVENT, onOpenPart);
  }, [setElementTarget]);

  /* ⚡ THE CANVAS HOLD (`element-preview.ts`). The canvas iframe is keyed on
     `canvasStamp`, not on every server render's `renderStamp`: an element
     choice is already ON the canvas (the bridge's `elStyle`), so the render its
     save triggers must not reload a page that already shows it. Every other
     render — a scene order, a background, Undo, Restore, a render after the
     hold lapsed — moves `canvasStamp` and reloads the canvas exactly as before. */
  const [canvasStamp, setCanvasStamp] = useState(maker?.renderStamp ?? '');
  const canvasHold = useRef<CanvasHold>(NO_CANVAS_HOLD);
  const serverCanvases = elementEditing?.canvases;
  const serverCanvasesRef = useRef(serverCanvases);
  serverCanvasesRef.current = serverCanvases;
  /* 🧭 …and WHICH scenes each stage's canvas draws, in order — the other half
     of what the canvas shows (`canvasOrderOf`). Every hold carries it (owner
     2026-09-28: every pick the bridge already drew keeps the page; a render
     that drew other scenes still reloads). */
  const canvasOrder = canvasOrderOf(navigator.stageLists);
  /* 🎨 Post Event scenes drawn in a style → the style, resolved on the server
     (`maker-navigator-data.ts`), so the Maker never loads the style registry. */
  const peStyles = navigator.postEvent && navigator.postEvent !== 'unreadable' ? navigator.postEvent.styles : null;
  const canvasOrderRef = useRef(canvasOrder);
  canvasOrderRef.current = canvasOrder;
  /** Every scene's canvas as the canvas iframe draws it: the render's, with the
   *  Maker's own copy over it (`lib/maker-draft-store.ts`) — what a hold starts from. */
  const drawnCanvases = (): Record<string, HubSectionCanvas> => {
    const server = serverCanvasesRef.current ?? {};
    return Object.fromEntries(Object.keys(server).map((t) => [t, draftedCanvasOr(t, server[t])]));
  };
  useEffect(() => {
    const next = maker?.renderStamp ?? '';
    if (canvasKeepsItsPage(canvasHold.current, serverCanvasesRef.current ?? {}, Date.now(), canvasOrderRef.current)) return;
    canvasHold.current = NO_CANVAS_HOLD;
    setCanvasStamp(next);
  }, [maker?.renderStamp]);
  /** A write the bridge did not draw: the next render reloads the canvas — and
   *  a held save in the same burst must still bring that render
   *  (`makerNeedsRender`: a held save owes none on its own). */
  const releaseCanvas = () => {
    canvasHold.current = NO_CANVAS_HOLD;
    makerNeedsRender();
  };
  /* 🔓 EVERY OTHER WRITE RELEASES THE HOLD. A Maker form (the shell's submit
     listener) and every draft save not drawn by the bridge (`makerSave` without
     `held`) announce themselves — otherwise a colour or wording save landing
     inside a hold, with the canvases unchanged, would be absorbed and the
     canvas would keep a page that no longer matches the draft. */
  useEffect(() => {
    const release = () => {
      canvasHold.current = NO_CANVAS_HOLD;
    };
    window.addEventListener(MAKER_UNHELD_WRITE_EVENT, release);
    return () => window.removeEventListener(MAKER_UNHELD_WRITE_EVENT, release);
  }, []);
  /* The sheet closed: its last save's refresh may still land (a few seconds),
     then the hold ends — a later write elsewhere must reload the canvas. */
  useEffect(() => {
    if (elementTarget) return;
    const hold = canvasHold.current;
    if (hold.shows) canvasHold.current = { ...hold, until: Math.min(hold.until, Date.now() + 4_000) };
  }, [elementTarget]);

  /* The first selection comes from the address (a save lands back here with
     `?scene=` or `?open=`). After that the shell's state owns it. */
  const seeded = useRef(false);
  const setMakerItem = maker?.setDetailsItem;
  useEffect(() => {
    if (seeded.current || !select) return;
    seeded.current = true;
    if (initialScene && scenes.some((s) => s.id === initialScene)) {
      select({ kind: 'scene', id: initialScene });
    } else if (initialOpenRow && rows[initialOpenRow]) {
      if (isLookRow(initialOpenRow)) {
        setMakerItem?.('theme');
        select({ kind: 'tool', key: 'details' });
        return;
      }
      select(
        MAIN_ROWS.includes(initialOpenRow) ? { kind: 'main' } : { kind: 'row', key: initialOpenRow },
      );
    }
  }, [initialScene, initialOpenRow, scenes, rows, select, setMakerItem]);

  useEffect(() => {
    setMoreHost(document.getElementById(MAKER_MORE_ROWS_ID));
  }, []);

  /* ＋ ADD A SCENE — the shell's ＋ (desktop) and More ▾ row (phone) cannot know
     whether a scene may be added here, so the work area REGISTERS the answer
     (`MakerAddScene`, `maker-context.tsx`): ready opens the sheet below; refused
     carries the note (padlocked when it is Event Hub Pro); null where the
     navigator offers nothing either (the store shell, a stage without scenes
     of their own — `stageTakesOwnScenes`). */
  const setAddScene = maker?.setAddScene;
  useEffect(() => {
    if (!setAddScene) return;
    if (stage === 'editorial' && postEventPresets) {
      // 🎞 Post Event's own presets — ready for every couple (Pro at Apply).
      setAddScene({ kind: 'ready', open: () => setAddOpen(true), tried: !postEventPresets.ownsPro });
      return () => setAddScene(null);
    }
    if (!addScene || !stageTakesOwnScenes(stage)) {
      setAddScene(null);
      return;
    }
    setAddScene(
      'action' in addScene
        ? { kind: 'ready', open: () => setAddOpen(true), tried: addScene.tried === true }
        : { kind: 'refused', note: addScene.note },
    );
    return () => setAddScene(null);
  }, [setAddScene, addScene, postEventPresets, stage]);

  /* The scene just added is SELECTED once the render that carries it lands.
     A tile's post lands back on this very address (`lib/maker-stay.ts` — the
     shell stamps `return_to` + `maker_stay`), so nothing remounts and `?scene=`
     cannot seed it; instead the work area remembers which scenes it had when
     the tile was tapped and picks the one that appeared. */
  const scenesBeforeAdd = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = scenesBeforeAdd.current;
    if (!before || !select) return;
    // The scene whose type was not here at the tap — only the add can bring one
    // (nothing else inserts a row between the tap and the render).
    const added = scenes.find((s) => !before.has(s.type));
    if (!added) return;
    scenesBeforeAdd.current = null;
    setAdding(false);
    select({ kind: 'scene', id: added.id });
  }, [scenes, select]);
  /* ⚡ THE TAP IS ANSWERED AT ONCE (owner 2026-09-29, "no slow response on the
     maker"): the navigator says the scene is on its way the moment a tile is
     tapped, and lets go when the render the add brings lands (with the scene,
     which is then selected — or without it, when the add was refused). */
  const [adding, setAdding] = useState(false);
  const addingSince = useRef<string | null>(null);
  const stampForAdd = maker?.renderStamp ?? '';
  useEffect(() => {
    if (adding && addingSince.current !== stampForAdd) setAdding(false);
  }, [stampForAdd, adding]);
  const onPickTemplate = useCallback(
    () => {
      scenesBeforeAdd.current = new Set(scenes.map((s) => s.type));
      addingSince.current = stampForAdd;
      setAdding(true);
      setAddOpen(false);
      /* …and on the canvas, where it will land: after the stage's last scene. */
      const after = lastSceneKeyRef.current;
      if (after) broadcastToCanvasRef.current({ source: 'setnayan-editor', t: 'scenePlaceholder', key: after });
    },
    [scenes, stampForAdd],
  );

  /* ── the preview ─────────────────────────────────────────────────────── */
  /* 🖼 The canvas is ONLY the page (`isEditorCanvas` on the guest page). The
     "Event Bar" switch at its lower right puts the GUEST header and tab bar
     back (`&bars=1`) so the couple can check nothing sits under them — never
     the host's own chrome. Owner 2026-09-25: *"add a switch to show or hide"*. */
  const [guestBars, setGuestBars] = useState(false);
  /* 🎫 THE GUEST'S TICKET, DRAWN FOR REAL (owner 2026-10-05): with its scene
     selected the page shows the first coming guest's ticket in the look being
     edited — every Ticket style ▾ pick at once, before its draft save lands. */
  const ticketSaved: PassCardDesign = sceneFormat?.ticketStyle ?? PASS_CARD_DESIGNS[0];
  const [ticketShown, setTicketShown] = useState<PassCardDesign | null>(null);
  useEffect(() => setTicketShown(null), [ticketSaved]);
  const ticketDesign = ticketShown ?? ticketSaved;
  /* A ticket that could not be drawn SAYS so — never an empty page that reads like no ticket. */
  const [ticketFailed, setTicketFailed] = useState<PassCardDesign | null>(null);
  /* Each pick tries again — a failure is said for the look it happened to, never carried over. */
  useEffect(() => setTicketFailed(null), [ticketDesign]);
  const ticketOn = selection?.kind === 'row' && selection.key === `f:${MAKER_FIXED_TICKET}`;
  /** The ticket picture that has LOADED (its address) — until then a phone shows its placeholder. */
  const [ticketLoaded, setTicketLoaded] = useState<string | null>(null);
  /* 🎨 LOGO · HERO · REVEAL LIVE IN DETAILS (Details part 3, DECISION_LOG
     2026-09-28 "OPTION B — EVERYTHING MADE ONCE LIVES IN DETAILS"). This page
     still BUILDS them — every read and bound action they always had — and
     hands the same nodes to Details through the Maker (`MakerLookPages`,
     drawn by `launch/_components/details-look-pages.tsx`). Keyed on what
     they are, never on a render: the nodes come from the server and keep their
     identity until the next server render, so this runs once per render of the
     page, not once per click. */
  const setLookPages = maker?.setLookPages;
  /* 🎨 LOOK › BACKGROUND · FONT · COLOURS (owner 2026-10-02, tracker f40) —
     the rows this page always built, handed to Look as they are. */
  const backgroundNode = rows[LOOK_ROW_OF.background]?.node ?? null;
  const fontNode = rows[LOOK_ROW_OF.font]?.node ?? null;
  const coloursNode = rows[LOOK_ROW_OF.colours]?.node ?? null;
  const buttonsNode = rows[LOOK_ROW_OF.buttons]?.node ?? null;
  const hasDressCode = scenes.some((sc) => sc.type === 'dress_code');
  const revealStagesKey = revealStages.join();
  const twoPeopleOff = sceneFormat?.twoPeople === false;
  useEffect(() => {
    if (!setLookPages) return;
    setLookPages({
      logo: madeOnce?.logo ?? null,
      /* The Main background is no longer the hero's: it is Look › Background. */
      hero: madeOnce?.hero ?? null,
      reveal: madeOnce?.reveal ?? null,
      revealOptions: madeOnce?.['reveal-options'] ?? null,
      /* The hero's parts, edited by the same sheet a tap on the hero scene opens. */
      heroParts: elementEditing
        ? {
            keys: HUB_HERO_ELEMENT_KEYS.filter((k) => k !== 'joiner' || !twoPeopleOff),
            canvases: elementEditing.canvases,
            palette: elementEditing.palette,
            draftAction: elementEditing.draftAction,
            ownsPro,
          }
        : null,
      revealStages: revealStagesKey ? (revealStagesKey.split(',') as LifecyclePhase[]) : [],
      publicLandingUrl,
      fontsInUse: elementEditing?.fontsInUse ?? [],
      look: {
        background: backgroundNode,
        font: fontNode,
        colours: coloursNode,
        palette:
          elementEditing && hasDressCode ? (
            <PaletteLookCanvasRow
              eventId={eventId}
              canvas={draftedCanvasOr('dress_code', elementEditing.canvases['dress_code'])}
              eventType={sceneFormat?.eventType ?? null}
              draftAction={elementEditing.draftAction}
              colours={sceneFormat?.colorChoices ?? []}
            />
          ) : null,
        buttons: buttonsNode,
      },
    });
    // `sceneFormat` and `eventId` come with the same render as `elementEditing`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLookPages, madeOnce, backgroundNode, fontNode, coloursNode, buttonsNode, hasDressCode, revealStagesKey, publicLandingUrl, elementEditing, twoPeopleOff, ownsPro]);
  useEffect(() => () => setLookPages?.(null), [setLookPages]);
  useEffect(() => {
    try {
      setGuestBars(window.sessionStorage.getItem(GUEST_BARS_KEY) === '1');
    } catch {
      /* storage refused — the switch simply starts off */
    }
  }, []);
  const toggleGuestBars = () =>
    setGuestBars((on) => {
      const next = !on;
      try {
        window.sessionStorage.setItem(GUEST_BARS_KEY, next ? '1' : '0');
      } catch {
        /* not remembered, still applied */
      }
      return next;
    });
  /* 🖼 THE EVENT BAR IS SETTINGS' TILE ON A PHONE (owner 2026-10-05, "approve"):
     the switch no longer floats under the canvas there — it is registered with
     the Maker, and the lower third's Settings draws it. */
  const setEventBar = maker?.setEventBar;
  const toggleRef = useRef(toggleGuestBars);
  toggleRef.current = toggleGuestBars;
  useEffect(() => {
    setEventBar?.(publicLandingUrl ? { on: guestBars, toggle: () => toggleRef.current() } : null);
  }, [setEventBar, guestBars, publicLandingUrl]);
  useEffect(() => () => setEventBar?.(null), [setEventBar]);
  /* 👁 SEE AS ▾ (PR-10) — the SAME canvas address, drawn as a sample guest:
     `?as=<state>` (lib/see-as.ts `SEE_AS_PARAM`). The draft, the
     bridge and the stage are unchanged; only who the page is drawn for. */
  const seeAs = maker?.seeAs ?? null;
  const previewSrc = publicLandingUrl
    ? `${publicLandingUrl}?phase=${stage}&editor=1${guestBars ? '&bars=1' : ''}${seeAs ? `&${SEE_AS_PARAM}=${seeAs}` : ''}`
    : null;
  const canvasSrc = previewSrc;
  /* 🔥 LOAD EVERYTHING UP FRONT (owner 2026-09-28: *"is it possible to load
     everything so it runs smoothly?"*). The other three stages, as the host's
     editing canvas, loaded hidden behind this one once it is up and the tab is
     idle (`buffered-canvas-frame.tsx`) — nearest stage first — so a stage
     switch shows a page that is already loaded. Keyed exactly as the shown
     frame would be, so a switch finds its frame. None while "view as" is on,
     and none on a small-memory phone or a save-data connection
     (`warmCanvasBudget`, decided once the device is known). */
  const [warmBudget, setWarmBudget] = useState(0);
  useEffect(() => {
    const nav = window.navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    setWarmBudget(
      warmCanvasBudget({
        phone: window.matchMedia('(max-width: 767px), (pointer: coarse)').matches,
        deviceMemory: nav.deviceMemory ?? null,
        saveData: nav.connection?.saveData ?? null,
      }),
    );
  }, []);
  /* …and what a pick will need: every face in the Font dropdown and, for a
     couple who can pick one, their photos as backgrounds (`lib/maker-preload.ts`
     — the Maker's own document only, never a guest page). Same device gate. */
  /* Every couple may now pick media into the draft (owner 2026-09-28: Pro is
     asked for at Apply) — only the store shell's free couple is not offered it. */
  const photoUrlsKey =
    ownsPro || !sceneFormat?.hideLocked ? (sceneFormat?.photoChoices ?? []).map((p) => p.url).join('\n') : '';
  useEffect(() => {
    if (warmBudget === 0) return;
    return whenIdle(() => {
      preloadMakerFonts(document);
      if (photoUrlsKey) preloadMakerImages(photoUrlsKey.split('\n'));
    });
  }, [warmBudget, photoUrlsKey]);
  const warmStages: CanvasFrame[] =
    publicLandingUrl && !seeAs
      ? warmStageOrder(stage).map((s) => ({
          key: `${s}:${canvasStamp}:`,
          group: `${s}:`,
          src: `${publicLandingUrl}?phase=${s}&editor=1${guestBars ? '&bars=1' : ''}`,
        }))
      : [];
  const scrollPreviewTo = useCallback(
    (anchor?: string) => {
      if (!anchor) return;
      postToShownCanvases({ source: 'setnayan-editor', t: 'scrollTo', key: anchor });
    },
    [postToShownCanvases],
  );

  /* ✍ A SCENE'S WORDS, EDITED FROM THE SCENE (`canvas-words.tsx`). The Content
     box previews what is typed on the canvas (the bridge's `words`), and a tap
     on the scene's words focuses it. The last preview per scene is kept and
     sent again when the canvas reloads while the box is open. */
  const [wordsFocus, setWordsFocus] = useState<{ key: string; n: number } | null>(null);
  const wordsPending = useRef<Record<string, string>>({});
  const wordsInfo = useRef({ canvases: elementEditing?.canvases ?? {}, ownWords: detailsBound?.ownWords ?? [] });
  wordsInfo.current = { canvases: elementEditing?.canvases ?? {}, ownWords: detailsBound?.ownWords ?? [] };
  const openWordsOnTap = (key: string, el: unknown, empty: unknown) => {
    if (!key.startsWith('w:')) return false;
    const type = key.slice(2);
    const { canvases, ownWords } = wordsInfo.current;
    return tapOpensWords({ wordsScene: isWordsScene(type, canvases[type], ownWords), el, empty });
  };
  const postWords = (key: string, text: string) => broadcastToCanvas({ source: 'setnayan-editor', t: 'words', key, text });

  /* ✍ TAP A FACT, EDIT IT ON THE RIGHT (Details part 2b; DECISION_LOG "DETAILS
     IS THE ONE FILL-IN AREA; STAGES ARE LOOK AND MOTION; TAP IS A SHORTCUT").
     A fact on a stage — the special message, the love story's words — is
     edited by the Details item's OWN editor, handed down by the launch page
     (`maker.factEditors`, built once by `detailsFactEditors`): the very nodes
     Details draws, never a copy. A design word (a heading, a label) is not a
     fact and keeps its part sheet. `sceneKey` lets the editor show what is
     typed on that scene as it is typed. */
  const factEditors = maker?.factEditors ?? null;
  const factEditorsRef = useRef(factEditors);
  factEditorsRef.current = factEditors;
  /* 🗓 A tapped schedule MOMENT: the Schedule is a whole page (its rail and its
     inspector) — too big for this panel — so Details › Schedule opens with that
     moment selected (`schedule-focus.ts`). */
  const openDetailsItemRef = useRef(maker?.setDetailsItem);
  openDetailsItemRef.current = maker?.setDetailsItem;
  const factEditorFor = (item: DetailsItemKey, sceneKey: string | null): ReactNode => {
    const node = factEditors?.[item];
    if (!node) return null;
    return (
      <DetailsFactSceneContext.Provider value={sceneKey}>
        <section className="flex flex-col gap-2 px-1" data-maker-fact-editor={item}>
          <p className="text-[12.5px] text-ink/60">The same field as in Event Details — saved once, shown everywhere.</p>
          {node}
        </section>
      </DetailsFactSceneContext.Provider>
    );
  };
  /* ⚡ THE LOVE STORY AND THE PROGRAMME, FROM WHEREVER THEY ARE EDITED
     (`lib/maker-live-preview.ts`). An editor in Details holds no frame, so it
     posts a window event; here it reaches every frame this stage holds — the
     shown canvas, the Both pane, each warm stage. The newest message of each
     kind is kept and sent again to a frame that loads later (its render may
     predate a save still on its way). A change the bridge cannot draw marks
     the canvas stale once its save has landed: it loads again, double
     buffered, and the Maker itself is not re-rendered. */
  const livePreviews = useRef<Map<string, unknown>>(new Map());
  const staleSeq = useRef(0);
  useEffect(() => {
    const onPost = (e: Event) => {
      const message = (e as CustomEvent<unknown>).detail;
      if (!message || typeof message !== 'object') return;
      const m = message as { t?: unknown; moment?: { id?: unknown } };
      const slot = m.t === 'scheduleMoment' ? `schedule:${String(m.moment?.id ?? '')}` : String(m.t ?? '');
      livePreviews.current.set(slot, message);
      broadcastToCanvasRef.current(message);
    };
    const onStale = () => {
      staleSeq.current += 1;
      const n = staleSeq.current;
      setCanvasStamp((s) => `${s.split('~')[0]}~${n}`);
    };
    const onLiveReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { source?: string; t?: string } | null;
      if (!d || d.source !== 'setnayan-site' || d.t !== 'ready') return;
      const to = event.source as Window | null;
      for (const message of livePreviews.current.values()) to?.postMessage(message, window.location.origin);
    };
    window.addEventListener(MAKER_CANVAS_POST_EVENT, onPost);
    window.addEventListener(MAKER_CANVAS_STALE_EVENT, onStale);
    window.addEventListener('message', onLiveReady);
    return () => {
      window.removeEventListener(MAKER_CANVAS_POST_EVENT, onPost);
      window.removeEventListener(MAKER_CANVAS_STALE_EVENT, onStale);
      window.removeEventListener('message', onLiveReady);
    };
  }, []);
  /* A render (Apply, Undo, another write) brings the truth: what was kept to
     re-send is older than it. */
  useEffect(() => {
    livePreviews.current.clear();
  }, [maker?.renderStamp]);
  useEffect(() => {
    const onWordsReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { source?: string; t?: string } | null;
      if (!d || d.source !== 'setnayan-site' || d.t !== 'ready') return;
      /* To the frame that said ready — with the canvas double-buffered it is the
         one still loading behind the shown page, not yet `frameRef`. */
      const to = event.source as Window | null;
      for (const [key, text] of Object.entries(wordsPending.current)) {
        to?.postMessage({ source: 'setnayan-editor', t: 'words', key, text }, window.location.origin);
      }
    };
    window.addEventListener('message', onWordsReady);
    return () => window.removeEventListener('message', onWordsReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Preview → inspector: a section tapped on the page opens its panel. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string; key?: string; el?: unknown } | null;
      /* 📱 A tap on the canvas while an edit is open: if it ends the edit, the
         page stays where the tap put it (`settle` + `forget`, above). */
      if (data?.source === 'setnayan-site' && (data.t === 'edit' || data.t === 'tapOutside') && (elementRef.current || typeRef.current)) {
        endedByCanvasTap.current = true;
      }
      /* 🧰 THE PART'S TOOLS ON A PHONE ARE THE LOWER THIRD'S (owner 2026-10-05,
         "approve"): a tap on the canvas that hits no part CLOSES them — the
         navigator comes back — and the tap goes on to select what it hit. */
      const phoneSheet = window.innerWidth < 1024 && elementRef.current !== null;
      if (data?.source === 'setnayan-site' && phoneSheet && (data.t === 'tapOutside' || (data.t === 'edit' && !isHubElementKey(data.el)))) {
        const was = elementRef.current!;
        sheetDo({ t: 'close' });
        postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key: was.key, el: null });
      }
      if (!data || data.source !== 'setnayan-site' || data.t !== 'edit' || typeof data.key !== 'string') return;
      /* 🔤 A tap ON an element (the hero's names, a scene's heading) opens that
         element's sheet; its scene's panel stays as it was. */
      /* 🧭 ONE SELECTION (`lib/maker-selection.ts`): the canvas maps a tap exactly
         as the navigator maps a tile, so each side's highlight follows the other.
         A fixed scene opens its own panel beside the page — never a workspace
         that replaces the stage. */
      const picked = selectionForCanvasKey(data.key, scenes);
      /* ✍ THE MAKER IS THE EDITOR (owner 2026-09-27: "this is the editor, so we
         can edit here"): a tap on a words scene's words — or anywhere on it
         while it is empty — opens its Content with the box focused
         (`lib/maker-scene-words.ts`), not the style sheet. */
      if (picked?.kind === 'scene' && openWordsOnTap(data.key, data.el, (data as { empty?: unknown }).empty)) {
        setElementTarget(null);
        select?.({ ...picked, tab: 'content' });
        setWordsFocus({ key: data.key, n: Date.now() });
        // The words are what is edited, not the part the tap outlined.
        postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key: data.key, el: null });
        // 🖥📱 Both: the other pane brings the same scene into view.
        postToShownCanvases({ source: 'setnayan-editor', t: 'scrollTo', key: data.key }, event.source);
        return;
      }
      /* 🪪 THE COUPLE'S MARK OPENS THE LOGO MAKER, in place (owner 2026-10-05,
         live: "clicking the logo does not open the Logo Maker") — Details' Logo,
         its studio on the page and its panels in the tools (a phone's lower
         third, a desktop's right column). Its size and motion stay one ‹ › away
         from the other parts. Nothing is written by opening it. */
      if (data.key === 'f:hero' && data.el === 'mark' && select) {
        setElementTarget(null);
        postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key: data.key, el: null });
        // The made-once Logo is Details' item now: the shell moves the pick there (`movedSelection`).
        select({ kind: 'tool', key: 'logo' });
        return;
      }
      const moment = (data as { moment?: unknown }).moment;
      if (data.key === 'w:schedule' && typeof moment === 'string' && moment && openDetailsItemRef.current) {
        setElementTarget(null);
        openDetailsItemRef.current('schedule');
        select?.({ kind: 'tool', key: 'details' });
        askScheduleFocus(moment);
        return;
      }
      /* ✍ A FACT tapped (`detailsItemForTap`): its Details editor, on the right. */
      const tapped = detailsItemForTap(data.key, data.el);
      if (picked && tapped && factEditorsRef.current?.[tapped]) {
        setElementTarget(null);
        select?.(picked.kind === 'scene' ? { ...picked, tab: 'content' } : picked);
        frameRef.current?.contentWindow?.postMessage(
          { source: 'setnayan-editor', t: 'markEl', key: data.key, el: null },
          window.location.origin,
        );
        return;
      }
      if (picked) {
        /* ▁ Tap another scene → the sheet switches to it on the SAME section
           (owner 2026-10-04, "…the sheet switches to it in the same section"). */
        const now = selectionNow.current;
        select?.(picked.kind === 'scene' && now?.kind === 'scene' && now.tab ? { ...picked, tab: now.tab } : picked);
        /* 🖥📱 BOTH: A TAP IN EITHER PANE SELECTS THE SAME PART IN THE OTHER —
           outlined, and its scene brought into view. The pane tapped already
           drew its own outline (the bridge's `mark`), so it is skipped. */
        postToShownCanvases(
          { source: 'setnayan-editor', t: 'markEl', key: data.key, el: typeof data.el === 'string' ? data.el : null },
          event.source,
        );
        postToShownCanvases({ source: 'setnayan-editor', t: 'scrollTo', key: data.key }, event.source);
        /* 🎞 A Post Event scene drawn in its style: its parts are its own
           (`pe_<scene>`), saved into the story's looks, never a section row. */
        const peScene = data.key.startsWith('p:') ? data.key.slice(2) : null;
        const widgetType =
          data.key === 'f:hero'
            ? 'hero'
            : data.key.startsWith('w:')
              ? data.key.slice(2)
              : peScene && peStyles?.[peScene]
                ? postEventElementScope(peScene)
                : null;
        const el = data.el;
        /* 📱 Another part switches the sheet to it, on the same section; the same
           part changes nothing (its selected text is kept — ✍ runs). */
        if (isHubElementKey(el) && elementEditingOn && widgetType) sheetDo({ t: 'tapPart', target: { key: data.key, widgetType, el, range: null } });
        else setElementTarget(null);
        return;
      }
      setElementTarget(null);
      const match = Object.entries(rows).find(([, r]) => r.anchor === data.key);
      if (match) select?.({ kind: 'row', key: match[0] });
    };
    window.addEventListener('message', onMessage);
    /* ✍ A selection inside a part's text (`selectionInPart` in the bridge): the
       sheet's font · colour · size then apply to just that range. A cleared
       selection drops the range — the choice styles the whole part again. */
    const onSelect = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as
        | {
            source?: string;
            t?: string;
            key?: string | null;
            el?: unknown;
            start?: unknown;
            end?: unknown;
            of?: unknown;
            text?: unknown;
            whole?: unknown;
          }
        | null;
      if (!d || d.source !== 'setnayan-site' || d.t !== 'select') return;
      if (!d.key || !isHubElementKey(d.el) || !elementEditingOn) {
        setElementTarget((prev) => (prev ? { ...prev, range: null } : prev));
        return;
      }
      const key = d.key;
      const el = d.el;
      if (typeof d.start !== 'number' || typeof d.end !== 'number' || typeof d.of !== 'string' || typeof d.text !== 'string') return;
      /* `whole` — the part's text as drawn now — lets its older runs ADAPT onto it. */
      const range = { start: d.start, end: d.end, of: d.of, text: d.text, ...(typeof d.whole === 'string' ? { was: d.whole } : {}) };
      const widgetType = key === 'f:hero' ? 'hero' : key.startsWith('w:') ? key.slice(2) : null;
      if (!widgetType) return;
      const picked = selectionForCanvasKey(key, scenes);
      if (picked) select?.(picked);
      setElementTarget({ key, widgetType, el, range });
    };
    window.addEventListener('message', onSelect);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('message', onSelect);
    };
  }, [rows, scenes, select, elementEditingOn, postToShownCanvases, setElementTarget]);

  /* 🖼 THE TILES' PREVIEWS (owner 2026-09-26: *"the navigator preview must
     really show the preview"*). Each tile shows a static copy of its section
     out of this canvas (`lib/maker-tile-preview.ts`). They are re-taken
     whenever the canvas is new — it announces itself with `ready` after an
     edit, an Apply, a stage change or View as — and whenever it changes width
     (Desktop ⇄ Phone, a resized window). One pass reads every shown section
     once; `performance.measure('maker-tile-snapshots')` records its cost. */
  const [tileHead, setTileHead] = useState<TileHead | null>(null);
  const [tileSnaps, setTileSnaps] = useState<Record<string, TileSnapshot>>({});
  const [navList, setNavList] = useState<HTMLElement | null>(null);
  /* 🧰 ON A PHONE THE SCENES ARE THE LOWER THIRD'S NAVIGATOR (owner 2026-10-05,
     "approve"): the Maker hands its slot (`ltNav`) and the tiles are drawn
     there, after the stage's pages; the lower third's row is then the strip's
     scroller. A desktop keeps its column. */
  const ltNav = maker?.ltNav ?? null;
  useEffect(() => {
    if (ltNav) setNavList(ltNav.parentElement);
  }, [ltNav]);
  /** [tile key, the canvas marker its section sits behind], per shown tile. */
  const tileKeysRef = useRef<ReadonlyArray<readonly [string, string]>>([]);
  const snapTimer = useRef<number | null>(null);
  const takeSnapshots = useCallback(() => {
    const doc = canvasDocument(frameRef.current);
    if (!doc) return;
    const t0 = performance.now();
    const head = readTileHead(doc);
    const next: Record<string, TileSnapshot> = {};
    for (const [key, marker] of tileKeysRef.current) {
      const snap = snapshotSection(doc, marker);
      if (snap) next[key] = snap;
    }
    try {
      performance.measure('maker-tile-snapshots', { start: t0, end: performance.now() });
    } catch {
      /* an older browser without measure options — the pass still ran */
    }
    setTileHead((prev) =>
      prev && prev.styles.join('') === head.styles.join('') &&
      JSON.stringify([prev.htmlAttrs, prev.bodyAttrs, prev.grounds]) === JSON.stringify([head.htmlAttrs, head.bodyAttrs, head.grounds])
        ? prev
        : head,
    );
    // Keep the SAME object for a section that did not change, so its tile keeps
    // its document instead of reloading it.
    setTileSnaps((prev) => {
      const merged: Record<string, TileSnapshot> = {};
      let changed = Object.keys(prev).length !== Object.keys(next).length;
      for (const [k, v] of Object.entries(next)) {
        const old = prev[k];
        const same =
          old && old.section === v.section && old.frameWidth === v.frameWidth &&
          JSON.stringify(old.chain) === JSON.stringify(v.chain);
        merged[k] = same ? old : v;
        if (!same) changed = true;
      }
      return changed ? merged : prev;
    });
  }, []);
  const scheduleSnapshots = useCallback(
    (ms: number) => {
      if (snapTimer.current) window.clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        snapTimer.current = null;
        takeSnapshots();
      }, ms);
    },
    [takeSnapshots],
  );
  useEffect(() => () => {
    if (snapTimer.current) window.clearTimeout(snapTimer.current);
  }, []);

  /* ✍ The words context the Content boxes read (`canvas-words.tsx`). A preview
     is on the canvas at once; the navigator's tiles are pictures of the canvas,
     so they are re-taken shortly after. */
  const canvasWords = useMemo<CanvasWords>(
    () => ({
      preview: (key, text) => {
        wordsPending.current[key] = text;
        postWords(key, text);
        scheduleSnapshots(600);
      },
      release: (key, saved) => {
        if (!(key in wordsPending.current)) return;
        delete wordsPending.current[key];
        postWords(key, saved);
        scheduleSnapshots(600);
      },
      focus: wordsFocus,
      focused: (n) => setWordsFocus((f) => (f && f.n === n ? null : f)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wordsFocus, scheduleSnapshots],
  );

  /* A canvas that is READY: re-take the previews, and bring the scene being
     edited back into view — a reload (the Event Bar switch among them) must
     not drop the couple back at the top of the page. */
  const selectedKeyRef = useRef<string | null>(null);
  /* 🧭 THE NAVIGATOR'S TABS ARE THE STAGE'S EVENT BAR (owner 2026-09-26, on the
     old "Main" tile: *"this depends on what menu they are looking at."*). The
     canvas hands over the bar it drew (`data-maker-bar`), and choosing a tab
     lists that tab's scenes in page order (`lib/maker-navigator-tabs.ts`). */
  const [canvasBar, setCanvasBar] = useState<NavigatorBarItem[] | null>(null);
  const [tabKey, setTabKey] = useState<string | null>(null);
  /* 🪞 The double-buffered canvas (`buffered-canvas-frame.tsx`): the window of
     a frame still loading behind the page — its `ready` is the buffer's to
     handle (it swaps and carries the scroll), so it is skipped here. */
  const loadingCanvas = useRef<Window | null>(null);
  /** Every canvas frame NOT shown — loading or warm (`buffered-canvas-frame.tsx`). */
  const backgroundCanvases = useRef<Set<Window>>(new Set());
  const [shownFrameKey, setShownFrameKey] = useState('');
  /** A buffered swap: the page kept its place, so only re-read and re-mark. */
  const onCanvasSwapped = (ready: unknown) => {
    scheduleSnapshots(700);
    const bar = (ready as { bar?: unknown } | null)?.bar;
    if (bar !== undefined) setCanvasBar(parseNavigatorBar(bar));
    const target = elementRef.current;
    if (target) {
      frameRef.current?.contentWindow?.postMessage(
        { source: 'setnayan-editor', t: 'markEl', key: target.key, el: target.el },
        window.location.origin,
      );
    }
  };
  /* 🖥📱 THE PHONE PANE (Both) is told what the canvas is told when it comes up
     or swaps: the scene being edited back in view (a first load only — a
     buffered swap carried its scroll) and the part being edited outlined. Its
     `ready` is its own: the tiles and the Event Bar stay read from the canvas. */
  const [shownBothKey, setShownBothKey] = useState('');
  const reMarkBoth = useCallback((scroll: boolean) => {
    const w = bothFrameRef.current?.contentWindow;
    if (!w) return;
    const key = selectedKeyRef.current;
    if (scroll && key) w.postMessage({ source: 'setnayan-editor', t: 'scrollTo', key }, window.location.origin);
    const target = elementRef.current;
    if (target) w.postMessage({ source: 'setnayan-editor', t: 'markEl', key: target.key, el: target.el }, window.location.origin);
  }, []);
  useEffect(() => {
    const onBothReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const w = bothFrameRef.current?.contentWindow;
      if (!w || event.source !== w) return;
      const data = event.data as { source?: string; t?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'ready') return;
      reMarkBoth(true);
    };
    window.addEventListener('message', onBothReady);
    return () => window.removeEventListener('message', onBothReady);
  }, [reMarkBoth]);
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source && event.source === loadingCanvas.current) return;
      // 🔥 …nor a warm stage loaded behind the canvas: its `ready` is not this page's.
      if (event.source && backgroundCanvases.current.has(event.source as Window)) return;
      // …nor a made-once page's own frame, now that the stage stays mounted beside it.
      if (event.source && event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { source?: string; t?: string; bar?: unknown } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'ready') return;
      scheduleSnapshots(700);
      // 🧭 The stage's Event Bar, as this canvas drew it — the navigator's tabs.
      setCanvasBar(parseNavigatorBar(data.bar));
      const key = selectedKeyRef.current;
      if (key) {
        frameRef.current?.contentWindow?.postMessage(
          { source: 'setnayan-editor', t: 'scrollTo', key },
          window.location.origin,
        );
      }
      // 🔤 The element being edited is outlined again in the fresh canvas.
      const target = elementRef.current;
      if (target) {
        frameRef.current?.contentWindow?.postMessage(
          { source: 'setnayan-editor', t: 'markEl', key: target.key, el: target.el },
          window.location.origin,
        );
      }
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [scheduleSnapshots]);

  /* A new stage has its own bar: forget the tab until its canvas says. */
  useEffect(() => {
    setCanvasBar(null);
    setTabKey(null);
  }, [stage]);

  /* Desktop ⇄ Phone and window resizes change the canvas's width. */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      scheduleSnapshots(450);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleSnapshots, stage, shownFrameKey, seeAs]);

  /* ▶ "Play this scene" (the toolbar's ▶ menu) — played IN PLACE in the
     canvas: the bridge replays the selected section's entrance where it sits. */
  useEffect(() => {
    const onPlay = () => {
      /* The stage's canvas. (The Hero and the Reveal play in their frame inside
         Details — `details-look-pages.tsx`.) */
      const key = canvasKeyOfSelection(selection, scenes);
      if (!key) return;
      const play = { source: 'setnayan-editor', t: 'play', key };
      // 🖥📱 It plays in the canvas AND, in Both, the phone pane.
      postToShownCanvases(play);
    };
    window.addEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
    return () => window.removeEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
  }, [selection, scenes, postToShownCanvases]);

  /* ── the one hidden form every navigator write goes through ────────────── */
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  /** The guard, as a ref — a chain step fired from the render effect must not
      read the `pending` of the render before it. */
  const pendingRef = useRef(false);
  /* ↕ A move's optimistic order, until the render its save brings lands. */
  const [orderOverride, setOrderOverride] = useState<{ stage: LifecyclePhase; order: string[] } | null>(null);
  const reorderInFlight = useRef(0);
  const reorderQueue = useRef<Promise<unknown>>(Promise.resolve());
  /** The render stamp when the last move's save landed — any LATER render is the truth. */
  const reorderLandedAt = useRef<string | null>(null);
  const renderStampNow = maker?.renderStamp ?? '';
  const renderStampRef = useRef(renderStampNow);
  renderStampRef.current = renderStampNow;
  useEffect(() => {
    if (!orderOverride) return;
    const server = navigator.fullOrders[orderOverride.stage];
    const landed = reorderLandedAt.current;
    /* The server has drawn it — or a render arrived after the last move landed. */
    if (sameOrder(server, orderOverride.order) || (reorderInFlight.current === 0 && landed !== null && landed !== renderStampNow)) {
      reorderLandedAt.current = null;
      setOrderOverride(null);
    }
  }, [navigator.fullOrders, orderOverride, renderStampNow]);
  const back = (sceneId: string, rest?: string) => {
    const q = new URLSearchParams({ stage, scene: sceneId });
    if (rest) q.set('chain', rest);
    return `/dashboard/${eventId}/launch?${q.toString()}`;
  };
  /* 🧷 THE REST OF A DRAG OR AN EYE PRESS, HELD HERE — not in the address. A
     Maker save now lands back on the address the couple is already on
     (`lib/maker-stay.ts`, so the Maker is never remounted), which means
     `?chain=` never arrives; the remaining steps wait here and fire once, on
     the render the step brings (below). `back()` still writes them into
     `return_to` for a browser without the shell's listener. */
  const pendingChain = useRef<string | null>(null);
  /* 🙈 TAKING A SCENE OFF THE PAGE IS INSTANT. The bridge hides it on the canvas
     now (`sceneShow`), and the hold expects the render without it on any stage
     (`orderWithout` — a hidden scene moves to every stage's fold), so that
     render keeps the page. Putting one BACK cannot be drawn by the bridge (the
     page never drew it), so that write reloads, double-buffered, as before. */
  const hideOnCanvas = (scene: MakerScene) => {
    /* 🏠 The dress code takes the guest's look on Welcome with it (`keysLeavingWith`). */
    const keys = keysLeavingWith(`w:${scene.type}`);
    for (const key of keys) broadcastToCanvas({ source: 'setnayan-editor', t: 'sceneShow', key, shown: false });
    canvasHold.current = holdChange(
      canvasHold.current,
      { canvases: drawnCanvases(), order: canvasOrderRef.current },
      { order: (o) => keys.reduce(orderWithout, o) },
      Date.now(),
    );
    scheduleSnapshots(400);
  };
  /** How one eye / Auto·Shown·Hidden write reaches the canvas (`sceneDrawEffect`). */
  const drawHow = (scene: MakerScene, after: Partial<Pick<MakerScene, 'mode' | 'isVisible'>>) => {
    const effect = sceneDrawEffect(
      scene,
      { mode: after.mode ?? scene.mode, isVisible: after.isVisible ?? scene.isVisible },
      sceneFormat?.openBrowse,
    );
    return effect === 'hide' ? { hide: scene } : effect === 'none' ? { still: true } : {};
  };
  const post = (
    which: 'toggle' | 'mode' | 'up' | 'down',
    fields: Record<string, string>,
    how: { rest?: string; hide?: MakerScene; still?: boolean } = {},
  ) => {
    const form = formRef.current;
    if (!form || pendingRef.current) return;
    if (how.hide) hideOnCanvas(how.hide);
    else if (how.still) {
      /* Nothing the canvas draws changes (Hidden with open browsing off — the
         page reads the eye alone): the render keeps the page as it is. */
      canvasHold.current = holdChange(
        canvasHold.current,
        { canvases: drawnCanvases(), order: canvasOrderRef.current },
        {},
        Date.now(),
      );
    } else releaseCanvas();
    // The shell's submit listener leaves a held write's hold alone.
    form.dataset.makerHeld = how.hide || how.still ? '1' : '';
    pendingChain.current = how.rest ?? null;
    for (const [name, val] of Object.entries(fields)) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = val;
    }
    pendingRef.current = true;
    setPending(true);
    /* A refused write redirects nowhere new; never leave the controls locked. */
    window.setTimeout(() => {
      pendingRef.current = false;
      setPending(false);
    }, 10_000);
    (form.querySelector(`button[data-op="${which}"]`) as HTMLButtonElement | null)?.click();
  };

  /* 👁 ONE SAVE THROUGH `makerSave`, NEVER THE FORM (measured 2026-09-29: the
     form's post redirects back to the Maker, and that redirect REMOUNTED the
     whole Maker — twice — so the canvas and every warm stage loaded again from
     nothing, blank, after a hide that was already instant). The eye and Auto ·
     Hidden write the draft directly: the navigator shows the new state now, a
     scene taken off is hidden on the canvas by the bridge and held, and one put
     back reloads the canvas double-buffered. "Shown" still posts the form — the
     server refuses Shown for a scene with nothing in it, and only it can say so. */
  const gateWrite = (scene: MakerScene, after: Partial<Pick<MakerScene, 'mode' | 'isVisible'>>): boolean => {
    if (!elementEditing) return false;
    const next = { mode: after.mode ?? scene.mode, isVisible: after.isVisible ?? scene.isVisible };
    if (next.mode === 'shown' && scene.mode !== 'shown') return false;
    const widget: { mode?: MakerScene['mode']; is_visible?: boolean } = {};
    if (next.mode !== scene.mode) widget.mode = next.mode;
    if (next.isVisible !== scene.isVisible) widget.is_visible = next.isVisible;
    if (Object.keys(widget).length === 0) return true;
    const how = drawHow(scene, next);
    if (how.hide) hideOnCanvas(how.hide);
    else if (how.still) {
      canvasHold.current = holdChange(
        canvasHold.current,
        { canvases: drawnCanvases(), order: canvasOrderRef.current },
        {},
        Date.now(),
      );
    } else releaseCanvas();
    const held = Boolean(how.hide || how.still);
    setGates((g) => ({ ...g, [scene.id]: next }));
    const draftAction = elementEditing.draftAction;
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ widgets: { [scene.type]: widget } }));
    /* ⚡ A hide the bridge drew brings no render — the Apply count comes back with the save. */
    if (held) fd.set(HUB_DRAFT_BAR_FIELD, '1');
    /* Serialised with the moves: each carries its own scene's whole gate. */
    reorderQueue.current = reorderQueue.current
      .then(() => makerSave(() => draftAction(eventId, fd), requestMakerRefresh, { held }))
      .catch(() => ({ ok: false as const, intent: 'save' as const, error: GATE_FAILED }))
      .then((res) => {
        if (res.ok) return;
        /* ↩ Refused: the scene is put back as it was — on the canvas too. */
        setGates((g) => {
          const rest = { ...g };
          delete rest[scene.id];
          return rest;
        });
        if (how.hide) broadcastToCanvas({ source: 'setnayan-editor', t: 'sceneShow', key: `w:${scene.type}`, shown: true });
        releaseCanvas();
        announceMakerSave({ state: 'error', text: res.error || GATE_FAILED });
      });
    return true;
  };

  /* Each write is drawn as the PAGE reads it (`drawHow`): a scene taken off is
     hidden now and held; one put back reloads. */
  const eyeWrite = (scene: MakerScene) => {
    const showing = sceneShowing(scene);
    if (showing && scene.mode === 'shown') {
      if (gateWrite(scene, { mode: 'hidden', isVisible: false })) return;
      const rest = `vis.${scene.id}.0`;
      post('mode', { widget_id: scene.id, next_mode: 'hidden', return_to: back(scene.id, rest) }, { rest, ...drawHow(scene, { mode: 'hidden' }) });
    } else if (!showing && scene.mode === 'hidden') {
      if (gateWrite(scene, { mode: 'auto', isVisible: true })) return;
      const rest = `vis.${scene.id}.1`;
      post('mode', { widget_id: scene.id, next_mode: 'auto', return_to: back(scene.id, rest) }, { rest, ...drawHow(scene, { mode: 'auto' }) });
    } else {
      if (gateWrite(scene, { isVisible: !scene.isVisible })) return;
      post(
        'toggle',
        {
          widget_id: scene.id,
          widget_type: scene.type,
          next_visible: scene.isVisible ? '0' : '1',
          return_to: back(scene.id),
        },
        drawHow(scene, { isVisible: !scene.isVisible }),
      );
    }
  };
  /** Auto · Shown · Hidden. */
  const modeWrite = (scene: MakerScene, next: MakerScene['mode']) => {
    if (gateWrite(scene, { mode: next })) return;
    post('mode', { widget_id: scene.id, next_mode: next, return_to: back(scene.id) }, drawHow(scene, { mode: next }));
  };

  const move = (id: string, delta: number) => {
    if (delta === 0) return;
    /* ↕ ONE SAVE, AND THE LIST MOVES NOW (`lib/maker-reorder.ts`). The whole
       stage's order goes to the draft in one `makerSave`; the navigator shows it
       at once and nothing locks. Only without the draft action (or a row whose
       type is unknown here) does it fall back to the chain of moves below. */
    const order = movedOrder(fullOrder, id, delta);
    const patch = order && elementEditing ? stageOrderPatch(order, (x) => sceneById.get(x)?.type, stage) : null;
    if (order && patch && elementEditing) {
      releaseCanvas();
      setOrderOverride({ stage, order });
      reorderInFlight.current += 1;
      announceMakerSave({ state: 'saving' });
      const draftAction = elementEditing.draftAction;
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      /* Serialised: each save carries the WHOLE order, so the last one decides. */
      reorderQueue.current = reorderQueue.current
        .then(() => makerSave(() => draftAction(eventId, fd), requestMakerRefresh))
        .catch(() => ({ ok: false as const, intent: 'save' as const, error: REORDER_FAILED }))
        .then((res) => {
          reorderInFlight.current -= 1;
          if (res.ok) {
            if (reorderInFlight.current === 0) reorderLandedAt.current = renderStampRef.current;
            announceMakerSave({ state: 'saved' });
            return;
          }
          /* ↩ Refused: the list goes back to what is saved, and the toolbar says so. */
          setOrderOverride(null);
          announceMakerSave({ state: 'error', text: res.error || REORDER_FAILED });
        });
      return;
    }
    const dir = delta < 0 ? 'up' : 'down';
    const n = Math.abs(delta);
    const rest = n > 1 ? `${dir}.${id}.${n - 1}` : undefined;
    post(dir, { widget_id: id, return_to: back(id, rest) }, { rest });
  };

  /** One step of a chain — from the shell's own hold (`pendingChain`) or a deep link's `?chain=`. */
  const runChain = (step: string) => {
    const [op, id, arg] = step.split('.');
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !op) return;
    if (op === 'vis') {
      const want = arg === '1';
      if (scene.isVisible === want) return;
      // Hiding's second half — off the canvas already (open browsing), or now (the eye alone).
      post(
        'toggle',
        { widget_id: id!, widget_type: scene.type, next_visible: want ? '1' : '0', return_to: back(id!) },
        drawHow(scene, { isVisible: want }),
      );
    } else if (op === 'up' || op === 'down') {
      const n = Number(arg);
      if (!Number.isFinite(n) || n < 1 || n > 40) return;
      const rest = n > 1 ? `${op}.${id}.${n - 1}` : undefined;
      post(op, { widget_id: id!, return_to: back(id!, rest) }, { rest });
    }
  };

  /* The rest of a chain from a deep link's address, fired once per arrival. */
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!chain || fired.current === chain) return;
    fired.current = chain;
    runChain(chain);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per chain value
  }, [chain]);

  /* A new server render means the write landed — unlock the controls, and fire
     the next step of a chain the shell is holding. */
  useEffect(() => {
    pendingRef.current = false;
    setPending(false);
    const step = pendingChain.current;
    pendingChain.current = null;
    if (step) runChain(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per render
  }, [maker?.renderStamp]);

  /* ── resize the navigator by its edge ─────────────────────────────────── */
  const startResize = (e: React.PointerEvent) => {
    const x0 = e.clientX;
    const w0 = navWidth;
    const onMove = (ev: PointerEvent) => setNavWidth(Math.max(112, Math.min(320, w0 + ev.clientX - x0)));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ── resize the tools column by its LEFT edge — the navigator's pattern,
        mirrored. The canvas keeps at least CANVAS_MIN_W; desktop only. ──── */
  const startToolsResize = (e: React.PointerEvent) => {
    const x0 = e.clientX;
    const w0 = toolsWidth;
    const onMove = (ev: PointerEvent) =>
      setToolsWidth(clampToolsWidth(w0 - (ev.clientX - x0), window.innerWidth, navWidth));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const toolsResize = { width: toolsWidth, onPointerDown: startToolsResize };

  const navOpen = maker?.navOpen ?? true;
  const view = maker?.device ?? 'desktop';
  /* 🖥📱 Both (`both-view.ts`): the canvas is the desktop, the phone pane
     beside it. The ROW is measured while Both is picked, and the PAIR is
     scaled to fit it (`bothLayout`) — the room left by the scenes list and the
     inspector, whichever are open, re-measured as they open, close or are
     dragged. Too little room to read either frame draws Desktop instead (the
     pick kept), and says so under the canvas. */
  const bothRowRef = useRef<HTMLDivElement>(null);
  const bothRow = usePaneSize(bothRowRef, view === 'both');
  const bothFit = view === 'both' && bothRow ? bothLayout(bothRow.width, bothRow.height) : null;
  const both = bothFit !== null;
  const bothTooNarrow = view === 'both' && bothRow !== null && bothFit === null;
  /** The CANVAS's own device — the tiles, the made-once pages and the canvas
   *  follow it. In Both that is the desktop (the tiles are pictures of it). */
  const device: 'desktop' | 'phone' = view === 'phone' ? 'phone' : 'desktop';
  const selectedScene = selection?.kind === 'scene' ? scenes.find((s) => s.id === selection.id) ?? null : null;

  /* 🧭 THE STAGE'S LIST — the canvas's own order (`lib/maker-scene-list.ts`). */
  const { stageLists, fullOrders, minis, tint } = navigator;
  /* ↕ A drop the server has not drawn yet is shown AS DROPPED (`lib/maker-reorder.ts`). */
  const override = orderOverride && orderOverride.stage === stage ? orderOverride.order : null;
  const list = optimisticStageList(stageLists[stage], override);
  /* 🎟 THE TICKET IS ASKED FOR BEFORE IT IS SHOWN (owner 2026-10-05: ~8 s of an
     empty page). The server draws it on demand, so on a phone the picture is
     requested once the stage that holds the Guest's ticket scene is on screen —
     the Maker opened on it, or the stage picked — quietly, after the page's
     own load; the scene then reads it from the browser's cache (60 s, then
     stale-while-revalidate). One ask per picture per visit. */
  const ticketInStage = list.shown.some((t) => t.kind === 'fixed' && t.fixed === MAKER_FIXED_TICKET);
  const ticketAsked = useRef(new Set<string>());
  useEffect(() => {
    if (!ticketInStage || !canvasSrc || window.innerWidth >= 1024) return;
    const src = makerTicketSrc(eventId, ticketDesign);
    if (ticketAsked.current.has(src)) return;
    const id = window.setTimeout(() => {
      ticketAsked.current.add(src);
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    }, 1200);
    return () => window.clearTimeout(id);
  }, [ticketInStage, canvasSrc, eventId, ticketDesign]);
  /* ↕ The STAGE's whole list — what a move on this stage swaps in. */
  const fullOrder = override ?? fullOrders[stage];
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const shownSceneIds = list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
  /* "After the last scene on this stage" in the FULL order — the row that
     follows it (a hidden or off-stage one), or the end. */
  const lastShown = shownSceneIds[shownSceneIds.length - 1];
  const lastShownType = lastShown ? sceneById.get(lastShown)?.type : undefined;
  lastSceneKeyRef.current = lastShownType ? `w:${lastShownType}` : null;
  const afterLastShown = lastShown ? (fullOrder[fullOrder.indexOf(lastShown) + 1] ?? null) : null;
  /* Each tile's canvas marker: its own key, or a Post Event scene's anchor. */
  const markerOf = (t: (typeof list.shown)[number]): string | null => (t.kind === 'post-event' ? t.anchor : t.key);
  tileKeysRef.current = list.shown.flatMap((t) => {
    const marker = markerOf(t);
    return marker ? [[t.key, marker] as const] : [];
  });
  const selectedTile = list.shown.find((t) => tileIsSelected(t, selection));
  selectedKeyRef.current = selectedTile ? markerOf(selectedTile) : null;
  const tabs = canvasBar ? navigatorTabs(canvasBar, list.shown.map((t) => t.key)) : null;
  const selectedTabKey = tabs && selectedTile ? (tabOfTile(tabs, selectedTile.key)?.key ?? null) : null;
  /* A scene picked on the canvas may sit under another tab — follow it there. */
  useEffect(() => {
    if (selectedTabKey) setTabKey(selectedTabKey);
  }, [selectedTabKey]);
  /* 📄 PAGE ▾ — the navigator's one dropdown is the guest's own pages on this
     stage, in the guest bar's own words (owner 2026-09-30, `lib/maker-guest-pages.ts`).
     Each page knows the scenes under it; none is hidden. */
  const guestPages = makerGuestPages(stage, list.shown.map((t) => t.key), navigator.hasStory);
  const shownPage = guestPages.find((p) => p.key === tabKey) ?? guestPages.find((p) => !p.leaves) ?? null;
  const selectedPageKey = selectedTile ? (guestPages.find((p) => p.tiles.includes(selectedTile.key))?.key ?? null) : null;
  useEffect(() => {
    if (selectedPageKey) setTabKey(selectedPageKey);
  }, [selectedPageKey]);

  /* 🧰 THE SCENE INSPECTOR'S TABS — Format · Animate · Arrange · Content
     (Keynote rebuild, 2026-09-27; approved prototype frame A). Built here, where
     the stage's list, the canvases, the canvas frame and the navigator's own
     draft form (`post` / `move` / `eyeWrite`) live; the Inspector only lays
     them out. The Transition tab is folded into Animate (owner, answer 4). */
  /* ⚡ The Maker's own copy while it is newer than the render (`lib/maker-draft-store.ts`):
     a pick the bridge drew brings no render any more, so the render's canvases
     can be older than what this Maker wrote. */
  const canvasOf = (type: string): HubSectionCanvas => draftedCanvasOr(type, elementEditing?.canvases[type]);
  /** "Every scene" = THIS stage's scenes (owner, answer 6), with their canvases. */
  const stageScenes = shownSceneIds.flatMap((id) => {
    const sc = sceneById.get(id);
    return sc ? [{ type: sc.type, canvas: canvasOf(sc.type) }] : [];
  });
  /** The colours this Event Hub already uses — the synced half of "Saved colours". */
  const usedColours = (() => {
    const out = new Set<string>();
    for (const c of Object.values(elementEditing?.canvases ?? {})) {
      if (c.color) out.add(c.color);
      for (const st of Object.values(c.elements ?? {})) {
        if (st?.color) out.add(st.color.slice(0, 7));
        for (const r of st?.runs ?? []) if (r.color) out.add(r.color.slice(0, 7));
      }
    }
    return [...out].slice(0, 15);
  })();
  const postToCanvas = (message: unknown) => {
    broadcastToCanvas(message);
    scheduleSnapshots(600);
  };
  const sceneTabs = (() => {
    if (!selectedScene) return null;
    const id = selectedScene.id;
    const type = selectedScene.type;
    const at = shownSceneIds.indexOf(id);
    const canvas = canvasOf(type);
    const partsKeys = HUB_ELEMENT_EXCLUDED_WIDGETS.includes(type) ? [] : HUB_SCENE_ELEMENT_KEYS;
    /** A couple's own scene — the page hands a Remove for exactly those. */
    const ownScene = id in sceneRemovers;
    const openPart = (el: HubElementKey) => setElementTarget({ key: `w:${type}`, widgetType: type, el });
    return {
      format:
        elementEditing && sceneFormat ? (
          <>
            {/* 🎨 Style — one dropdown, free; drawn only where the registry
                offers this scene a choice on this stage. */}
            <SceneStyleCanvasRow
              key={`style-${type}`}
              eventId={eventId}
              widgetType={type}
              canvas={canvas}
              stage={stage}
              eventType={sceneFormat.eventType ?? null}
              draftAction={elementEditing.draftAction}
            />
            <SceneBackgroundRow
              key={type}
              eventId={eventId}
              widgetType={type}
              canvas={canvas}
              stageScenes={stageScenes}
              stageLabel={PUBLIC_STAGE_LABELS[stage]}
              draftAction={elementEditing.draftAction}
              themeColours={sceneFormat.colorChoices}
              usedColours={usedColours}
              photoChoices={sceneFormat.photoChoices}
              videoChoice={sceneFormat.videoChoice}
              sceneUploads={sceneFormat.sceneUploads}
              mediaUsedBytes={sceneFormat.mediaUsedBytes}
              ownsPro={ownsPro}
              storeShell={sceneFormat.hideLocked}
              hubTheme={sceneFormat.hubTheme as never}
              onPreview={(message) => {
                /* ⚡ The background is on the canvas now — laid by the server's own
                   functions (`scene-bg-preview-message.ts`), so the render the save
                   brings is held (`onSaving` below), never reloaded. */
                postToCanvas(message);
              }}
              onSaving={(canvases, redrawsBox) => {
                /* 🖼 A pick that changes who draws the box — a widget's own card
                   on or off (`backgroundPickRedrawsBox`) — is NOT on the canvas:
                   the bridge paints the frame, never the card (owner 2026-09-28,
                   "No background" on the Countdown kept its pink card). Release,
                   so the save's render reloads the canvas, buffered, as before. */
                if (redrawsBox) {
                  releaseCanvas();
                  return;
                }
                canvasHold.current = holdChange(
                  canvasHold.current,
                  { canvases: drawnCanvases(), order: canvasOrder },
                  { canvases },
                  Date.now(),
                );
              }}
            />
            {ownScene ? (
              <SceneLayoutRow eventId={eventId} widgetType={type} canvas={canvas} draftAction={elementEditing.draftAction} />
            ) : null}
          </>
        ) : null,
      animate: elementEditing ? (
        <SceneAnimateTab
          key={type}
          eventId={eventId}
          widgetType={type}
          canvas={canvas}
          draftAction={elementEditing.draftAction}
          ownsPro={ownsPro}
          hideLocked={sceneFormat?.hideLocked ?? false}
          isLast={at === shownSceneIds.length - 1}
          onPreview={() => window.dispatchEvent(new Event(MAKER_PLAY_SCENE_EVENT))}
        />
      ) : null,
      arrange: (
        <SceneArrangeTab
          mode={selectedScene.mode}
          isVisible={selectedScene.isVisible}
          hasContent={selectedScene.hasContent}
          openBrowse={sceneFormat?.openBrowse ?? true}
          pending={pending}
          onMode={(m) => modeWrite(selectedScene, m)}
          onEye={() => eyeWrite(selectedScene)}
          canUp={at > 0}
          canDown={at >= 0 && at < shownSceneIds.length - 1}
          onUp={() => move(id, swapsForDrop(fullOrder, id, shownSceneIds[at - 1] ?? null))}
          onDown={() => move(id, swapsForDrop(fullOrder, id, shownSceneIds[at + 2] ?? afterLastShown))}
          removeForm={sceneRemovers[id]}
        />
      ),
      ownScene,
      contentExtra: (
        <>
          {ownScene ? scenePanels[id] : null}
          {elementEditing && partsKeys.length > 0 ? (
            <SceneParts keys={partsKeys} onElement={openPart} />
          ) : null}
        </>
      ),
    };
  })();
  /** 🔤 The part sheet's Part ▾: the parts this hero draws (a Joiner only for two people; the card's
   *  line · time · link, or the plain masthead's venue — `heroPartsFor`). */
  const heroParts = heroPartsFor(sceneFormat?.heroCard, sceneFormat?.twoPeople, sceneFormat?.heroPhoto);
  /* 🧭 EVERY scene of the stage, in canvas order, the tabs as headers between
     the groups (`navigatorRows`) — never a tab that hides the rest. */
  const navRows = navigatorRows(tabs, list.shown.map((t) => t.key));
  /* 📄 A page pick JUMPS — the navigator to that page's first scene, the canvas
     to it — in the Maker alone: one message to the loaded canvas, no reload.
     Me and a page that leaves have no scenes here; the navigator's top says so. */
  const jumpToPage = (page: MakerGuestPage) => {
    const key = page.key;
    setTabKey(key);
    const first = page.tiles[0];
    if (!first) {
      navList?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      // 👤 Me, drawn for a See as sample guest (PR-10): the canvas goes to it.
      if (key === 'me' && seeAsDrawsMe(seeAs)) scrollPreviewTo('me');
      return;
    }
    scrollPreviewTo(first);
    (
      navList?.querySelector(`[data-maker-group="${CSS.escape(key)}"]`) ??
      navList?.querySelector(`[data-maker-tile="${CSS.escape(first)}"]`)
      /* 🎞 A phone's strip scrolls SIDEWAYS only (`MAKER_STRIP_PHONE`): never
         `block: 'start'` there — it slid every tile up under the strip's top. */
    )?.scrollIntoView({ block: window.innerWidth < 1024 ? 'nearest' : 'start', inline: 'start', behavior: 'smooth' });
  };
  /* 📄 PAGE ▾ LIVES IN THE TOOLBAR NOW (the Maker in 4, 2026-10-02 — design
     frame D: "This replaces the stage tabs in today's top bar and the navigator
     column"). This work area knows the stage's pages and the scenes under each,
     so it REPORTS them to the shell (`MakerState.guestPages`) — the page it
     shows included — and answers the toolbar's pick (`pageJump`) with the same
     `jumpToPage` the navigator's dropdown ran. A pick on another stage waits
     for THAT stage's canvas to hand over its bar (a new `canvasBar`), so it
     never scrolls the old stage's frame. */
  const setGuestPagesCtx = maker?.setGuestPages;
  const shownPageKey = shownPage?.key ?? null;
  const pagesRef = useRef(guestPages);
  pagesRef.current = guestPages;
  /* 📍 PAGE ▾ NAMES THE PAGE ON SCREEN (owner, live phone test 2026-10-02:
     the canvas showed RSVP while Page ▾ said "Invitation › Welcome"). As the
     couple scrolls the canvas, the page holding the section in view becomes
     the shown page (`makerSectionInView`, a line a third of the way down). */
  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    let raf = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        try {
          const key = makerSectionInView(win.document, win.innerHeight / 3);
          const page = key ? pagesRef.current.find((p) => p.tiles.includes(key)) : undefined;
          if (page) setTabKey((k) => (k === page.key ? k : page.key));
        } catch {
          /* a frame we cannot read keeps the page it was given */
        }
      });
    };
    win.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      win.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(raf);
    };
  }, [shownFrameKey]);
  /* What a page IS for the bar — re-reported only when one of these changes. */
  const pagesSig = guestPages.map((p) => `${p.key}|${p.label}|${p.leaves}|${p.tiles.length}`).join(' ');
  useEffect(() => {
    if (!setGuestPagesCtx) return;
    setGuestPagesCtx({
      stage,
      hasStory: navigator.hasStory,
      shown: shownPageKey,
      // A page of this one with no scenes says so (Me, and a page that leaves, are pickable).
      pages: pagesRef.current.map((p) => ({
        key: p.key,
        label: p.label,
        ...(!p.leaves && p.key !== 'me' && p.tiles.length === 0 ? { empty: true } : {}),
      })),
    });
  }, [setGuestPagesCtx, stage, navigator.hasStory, shownPageKey, pagesSig]);
  useEffect(() => () => setGuestPagesCtx?.(null), [setGuestPagesCtx]);
  const pageJump = maker?.pageJump ?? null;
  const clearPageJump = maker?.clearPageJump;
  const jumpRef = useRef(jumpToPage);
  jumpRef.current = jumpToPage;
  const jumpWaits = useRef<{ n: number; bar: unknown } | null>(null);
  useEffect(() => {
    if (!pageJump || pageJump.stage !== stage) return;
    if (jumpWaits.current?.n !== pageJump.n) jumpWaits.current = { n: pageJump.n, bar: pageJump.sameStage ? null : canvasBar };
    /* 📄 A page of THIS stage jumps now — its canvas is already loaded, and a
       canvas that draws no bar (the menu off, the lab's stand-in) handed none to
       wait for: the tile did nothing (owner, live 2026-10-05). Another stage
       waits for ITS canvas's bar. */
    if (!pageJump.sameStage && (!canvasBar || canvasBar === jumpWaits.current.bar)) return;
    const page = pagesRef.current.find((p) => p.key === pageJump.key);
    clearPageJump?.();
    if (page) jumpRef.current(page);
  }, [pageJump, stage, canvasBar, clearPageJump]);
  /* 📱 The strip's open (i) notes float on the viewport (`lib/float-open-tips.ts`):
     the strip cannot scroll on Y (`MAKER_STRIP_PHONE`), so a note inside it was clipped. */
  useEffect(() => (navList ? floatOpenTips(navList, window) : undefined), [navList]);
  /* …and the navigator keeps the selected tile in view, whichever side picked it. */
  const selectedTileKey = selectedTile?.key ?? null;
  useEffect(() => {
    if (!selectedTileKey || !navList) return;
    navList
      .querySelector(`[data-maker-tile="${CSS.escape(selectedTileKey)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedTileKey, navList]);

  if (!maker) {
    return (
      <p className="p-6 text-sm text-ink/70">
        This part of the Event Hub Maker opens inside it —{' '}
        <Link href={`/dashboard/${eventId}/launch`} className="underline underline-offset-2">
          open the Event Hub Maker
        </Link>
        .
      </p>
    );
  }

  const moreRows = MORE_ROWS.filter((k) => rows[k]);

  /* ══ NO MADE-ONCE PAGE IS DRAWN HERE ANY MORE ═══════════════════════════
     Owner 2026-09-25: *"we do not want a pop up for details, logo, hero, reveal
     and love story. we want their actual page to be on the body of the editor
     similar to the different stages."* Since Details parts 2b and 3 every one
     of them is an item OF Details (Logo · Hero · Reveal registered above; Love
     Story and RSVP built by the launch page), which the shell draws over this
     area — the stage stays loaded underneath. */
  const workHidden = selection?.kind === 'tool' && isShellPage(selection.key);
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* 🪞 The Maker never draws inside a frame of itself. */}
      <MakerRefusesToBeFramed />
      {/* No navigator under a made-once page (owner 2026-09-25: *"logo and hero
          and reveal and love story has no navigation since it is just full
          create your logo"*) — and none under Details, which the shell draws
          over this area: the navigator belongs to the four stages only. */}
      {/* 🔥 THE STAGE STAYS LOADED UNDER A PAGE (owner 2026-09-28: *"load
          everything so it runs smoothly"*). Opening Hero, Logo, Reveal, Love
          Story, Details or RSVP used to UNMOUNT the navigator and the canvas, so
          coming back loaded the stage — and every warm stage — from nothing.
          Now they are hidden, never removed: back from a page is instant. */}
      <div className={workHidden ? 'hidden' : 'contents'} data-maker-work-area="">
      {/* Only the CANVAS is kept under a page — the navigator and the inspector
          belong to the four stages and are not drawn while a page is open. */}
      {workHidden ? null : (<>
      {/* ══ 2 · THE NAVIGATOR ══ */}
      <nav
        aria-label="Scenes"
        style={{ ['--maker-nav-w' as string]: `${navWidth}px` }}
        /* A phone's scenes are the lower third's (`IntoLowerThird` below) — the column is a desktop's. */
        className={`relative order-2 shrink-0 bg-cream/80 max-lg:hidden lg:order-1 lg:w-[var(--maker-nav-w)] ${
          navOpen ? '' : 'lg:hidden'
        }`}
      >
        {/* 🧭 THE DESKTOP COLUMN NEVER SCROLLS SIDEWAYS (owner's page, 2026-09-27:
            after "Edit Our love story" the column slid left and clipped every
            label). The cause was measured, not guessed: each closed ⓘ bubble is
            an 18rem box, so a 168px column held 314px of scrollable width, and
            `overflow-x: hidden` still lets focus and scrollIntoView scroll it.
            The bubbles are held to the column's own width here. */}
        <ol ref={ltNav ? undefined : setNavList} className={`${MAKER_STRIP_PHONE} flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:py-4 lg:[&_.sn-tip]:max-w-[calc(var(--maker-nav-w)-2rem)]`}>
          <IntoLowerThird to={ltNav}>
          {/* 🧭 THE STAGE'S MENU — the tabs a guest sees on this stage, never a
              generic "Main". Each lists its own scenes; a tab that opens a page of
              its own (Camera, Join, Watch) says so. The look behind every scene
              (music, backdrop) is the palette button; theme, background, font
              and colours are the toolbar's Look (2026-10-02). */}
          {/* 🧭 THE STAGE'S MENU AS ONE CONTROL (owner 2026-09-27, on the pill row
              that wrapped to 140px in the 168px column: *"this should be a tap
              to show option to pick or a drop down"*). It shows the group in
              view ("Home ▾"); picking a tab JUMPS the navigator and the canvas to
              that group — never a filter, never a stage change. One line at the
              narrowest column, the palette beside it. */}
          {/* 📄 …AND IT IS THE GUEST'S PAGES (owner 2026-09-30, pointing at the
              guest bar: *"there should be Home, Details, Story, Me on top
              dropdown"*). "Page ▾" offers exactly the pages the guest's bar
              offers on this stage, in its words (`lib/maker-guest-pages.ts`
              asks `resolveSiteNav`, the bar's own function) and with its icons. */}
          <li className="flex min-w-0 shrink-0 items-center gap-1 self-center lg:mb-3 lg:self-stretch" data-maker-tabs="">
            <button
              type="button"
              onClick={() => select?.({ kind: 'main' })}
              aria-pressed={selection?.kind === 'main'}
              aria-label="Music and the invitation backdrop"
              title="Music and the invitation backdrop"
              className={`sn-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-sn-control ease-sn ${
                selection?.kind === 'main' ? 'bg-ink text-cream' : 'bg-white/70 text-ink/75 hover:bg-white'
              }`}
            >
              <Palette aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </li>
          {stage === 'save_the_date' && navigator.stdLead && elementEditing ? (
            <li className="flex shrink-0 flex-col items-start gap-1 self-center lg:mb-3 lg:self-stretch" data-maker-std-lead="">
              <StdLeadSwitch
                eventId={eventId}
                lead={navigator.stdLead}
                draftAction={(id, fd) => {
                  releaseCanvas();
                  return elementEditing.draftAction(id, fd);
                }}
              />
            </li>
          ) : null}
          {/* 👤 Me with a See as guest picked is ON the canvas (PR-10) — no note. */}
          {shownPage?.key === 'me' && !seeAsDrawsMe(seeAs) ? (
            <li className="shrink-0 self-center px-2 text-[11.5px] text-ink/65 lg:mb-2 lg:self-stretch" data-maker-page-me="">
              <InfoTip className="min-w-0 max-w-full" label={ME_NOT_ON_CANVAS.label} align="start">
                {ME_NOT_ON_CANVAS.body}
              </InfoTip>
            </li>
          ) : null}
          {shownPage?.leaves ? (
            <li className="shrink-0 self-center px-2 text-[11.5px] text-ink/65 lg:self-stretch" data-maker-tab-leaves="">
              <InfoTip className="min-w-0 max-w-full" label={`${shownPage.label} opens its own page`} align="start">
                On this stage, “{shownPage.label}” takes a guest to a page of its own, so there are no scenes to arrange
                here, and it can’t be shown on this canvas yet. Pick another page to see its scenes.
              </InfoTip>
            </li>
          ) : null}
          {/* 📖 POST EVENT (Phase 8): when the story was written — or, said
              plainly, that its scenes could not be read (the story itself is
              untouched; the one tile stands in for it). */}
          {stage === 'editorial' && navigator.postEvent ? (
            <li className="shrink-0 self-center px-1 text-[11px] font-semibold text-ink/60 lg:mb-2 lg:self-stretch" data-maker-post-event-state="">
              {navigator.postEvent === 'unreadable' ? (
                <InfoTip className="min-w-0 max-w-full" label="Scenes unavailable" align="start">
                  Your story’s scenes could not be read just now. The story itself is unchanged — open the Maker
                  again in a moment.
                </InfoTip>
              ) : !navigator.postEvent.dayHappened ? (
                /* 🕰 Before the day — the same scenes, waiting (owner 2026-09-25). */
                <InfoTip className="min-w-0 max-w-full" label="Before the day · scenes wait" align="start">
                  Post Event is its own scenes, and each one is here already. The ones marked Not yet fill themselves
                  from your day once it has happened — until then your guests never meet an empty box. Pick each
                  scene’s style, hide the ones you do not want and move them earlier or later.
                </InfoTip>
              ) : (
                <InfoTip className="min-w-0 max-w-full"
                  label={`Auto · written ${new Date(navigator.postEvent.generatedAt).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
                  align="start"
                >
                  After your day, the Event Hub Maker wrote every scene below from what happened — nothing was typed.
                  A scene with nothing in it is skipped, never shown empty. The written story is free.
                </InfoTip>
              )}
            </li>
          ) : null}
          {/* 🧭 THE STAGE'S OWN LIST — what the canvas draws, in the order it
              draws it (`lib/maker-scene-list.ts`, asked of the page's own
              plan). Fixed sections are locked; the rest drag. */}
          {list.shown.map((tile, i) => {
            const header = navRows[i]?.header ?? null;
            const scene = tile.kind === 'scene' ? (sceneById.get(tile.widgetId) ?? null) : null;
            const on = tileIsSelected(tile, selection);
            const showing = scene ? sceneShowing(scene) : tile.kind === 'post-event' ? tile.drawn : true;
            const next = list.shown[i + 1];
            /* ↕ Every scene drags within its stage (owner 2026-09-27). */
            const canDrag = tile.kind === 'scene' && !pending;
            return (
              <Fragment key={tile.key}>
              {header ? (
                <li
                  data-maker-group={header.key}
                  className="shrink-0 self-center px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/50 lg:mb-1 lg:mt-3 lg:self-stretch lg:px-4"
                >
                  {header.label}
                </li>
              ) : null}
              <li
                data-maker-tile={tile.key}
                className="relative shrink-0"
                onDragOver={(e) => {
                  if (!dragId || tile.kind !== 'scene') return;
                  e.preventDefault();
                  setDropAt(tile.widgetId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId || tile.kind !== 'scene') return;
                  const from = dragId;
                  setDragId(null);
                  setDropAt(null);
                  move(from, swapsForDrop(fullOrder, from, tile.widgetId));
                }}
              >
                {tile.kind === 'scene' && dropAt === tile.widgetId && dragId && dragId !== tile.widgetId ? (
                  <span aria-hidden className="absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-terracotta lg:left-4" />
                ) : null}
                <div
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (tile.kind !== 'scene') return;
                    setDragId(tile.widgetId);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropAt(null);
                  }}
                  onContextMenu={(e) => {
                    if (tile.kind !== 'scene') return;
                    e.preventDefault();
                    setMenuFor(tile.widgetId);
                  }}
                  className="relative flex items-start gap-1.5 lg:py-1"
                >
                  <span aria-hidden className="w-3 pt-1 text-right font-mono text-[10px] font-bold text-ink/50">
                    {tile.kind === 'post-event' ? (tile.position ?? '—') : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* The tile takes the DEVICE'S shape — a landscape page on
                        Desktop, a tall phone on Phone — and the eye sits on it. */}
                    <div
                      className={`relative ${
                        /* 📱 In the lower third every tile is one size (96 × 104) — the row never scrolls down. */
                        device === 'phone' ? 'max-lg:h-[104px] max-lg:w-24 lg:aspect-[9/19.5] lg:w-[46%]' : 'max-lg:h-[104px] max-lg:w-24 lg:aspect-[16/10] lg:w-full'
                      }`}
                    >
                    {/* 🖼 WHAT THE TILE SHOWS — the section as the canvas drew it
                        (`ScenePreview`), over its words-only card, which stays
                        underneath as the stand-in until the copy has drawn (or
                        for a section the canvas does not draw). */}
                    <span
                      aria-hidden
                      className={`absolute inset-0 block overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_12px_28px_-18px_rgba(30,26,18,.45)] transition-opacity duration-sn-control ease-sn ${
                        showing ? '' : 'opacity-50'
                      }`}
                    >
                      <SceneMiniature mini={minis[tile.key]} fallback={tile.label} tint={tint} device={device} />
                      <ScenePreview
                        head={tileHead}
                        snapshot={tileSnaps[tile.key] ?? null}
                        device={device}
                        observeRoot={navList}
                      />
                    </span>
                    <button
                      type="button"
                      /* 🧰 A tile of the lower third's navigator — ‹ › step scene to scene. */
                      data-lt-tile={tile.key}
                      data-lt-group="scenes"
                      data-maker-scene={tile.kind === 'scene' ? tile.type : undefined}
                      data-maker-fixed={tile.kind === 'fixed' ? tile.fixed : undefined}
                      data-maker-post-event={tile.kind === 'post-event' ? tile.scene : undefined}
                      data-maker-status={tile.kind === 'post-event' ? (tile.hidden ? 'hidden' : tile.status) : undefined}
                      aria-pressed={on}
                      aria-label={
                        tile.kind === 'post-event'
                          ? postEventTileLabel(tile)
                          : `${tile.label}${tile.kind === 'fixed' ? (MAKER_FIXED_SOURCE[tile.fixed] ? ` (always here on this stage · comes from ${MAKER_FIXED_SOURCE[tile.fixed]!.from})` : ' (always here on this stage)') : showing ? '' : ' (hidden from guests)'}`
                      }
                      onClick={() => {
                        select?.(selectionForTile(tile));
                        /* ✍ A words scene's tile opens its words, focused
                           (`lib/maker-scene-words.ts`) — the same selection,
                           on its Content tab. */
                        if (
                          tile.kind === 'scene' &&
                          isWordsScene(tile.type, elementEditing?.canvases[tile.type], detailsBound?.ownWords ?? [])
                        ) {
                          select?.({ kind: 'scene', id: tile.widgetId, tab: 'content' });
                          setWordsFocus({ key: tile.key, n: Date.now() });
                        }
                        scrollPreviewTo(tile.kind === 'post-event' ? (tile.anchor ?? undefined) : tile.key);
                      }}
                      onPointerDown={(e) => {
                        if (e.pointerType !== 'touch' || tile.kind !== 'scene') return;
                        const t = window.setTimeout(() => setMenuFor(tile.widgetId), 550);
                        const clear = () => window.clearTimeout(t);
                        e.currentTarget.addEventListener('pointerup', clear, { once: true });
                        e.currentTarget.addEventListener('pointerleave', clear, { once: true });
                      }}
                      className={`sn-press absolute inset-0 block h-full w-full rounded-md bg-transparent outline outline-2 outline-offset-2 transition-[outline-color] duration-sn-control ease-sn ${canDrag ? 'cursor-grab' : 'cursor-pointer'} ${on ? 'outline-terracotta' : 'outline-transparent'}`}
                    >
                      {tile.kind === 'fixed' || (tile.kind === 'post-event' && tile.pinned) ? (
                        <span className="absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-ink/70 shadow-sm">
                          <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
                        </span>
                      ) : null}
                      {tile.kind === 'post-event' ? (
                        /* 📖 What filled it, said on the tile: Auto · Skipped · Hidden · Optional. */
                        <span
                          className={`absolute bottom-1 right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm ${
                            tile.drawn ? 'bg-white/90 text-ink/70' : 'bg-ink/80 text-cream'
                          }`}
                        >
                          {postEventStatusWord(tile)}
                        </span>
                      ) : null}
                    </button>
                      {scene ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eyeWrite(scene)}
                          aria-label={showing ? `Hide ${tile.label} from guests` : `Show ${tile.label} to guests`}
                          title={
                            scene.mode === 'auto' && showing
                              ? 'Showing (Auto) · tap to hide from guests'
                              : showing
                                ? 'Showing · tap to hide from guests'
                                : 'Hidden · tap to show to guests'
                          }
                          className={`sn-press absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors duration-sn-control ease-sn hover:text-ink disabled:opacity-40 ${
                            showing ? (scene.mode === 'auto' ? 'text-ink/55' : 'text-ink') : 'text-terracotta'
                          }`}
                        >
                          {showing ? (
                            <Eye aria-hidden className="h-4 w-4" strokeWidth={scene.mode === 'auto' ? 1.5 : 2.25} />
                          ) : (
                            <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
                          )}
                        </button>
                      ) : null}
                    </div>
                    {tile.kind === 'fixed' ? (
                      <InfoTip className="min-w-0 max-w-full" label={tile.label} align="start" labelClassName="min-w-0 line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight text-ink/70">
                        {tile.why}
                        {/* Where it comes from — said, never a link out of the Maker (owner 2026-10-05). */}
                        {MAKER_FIXED_SOURCE[tile.fixed] ? <span className="mt-1.5 block">{MAKER_FIXED_SOURCE[tile.fixed]!.text}</span> : null}
                      </InfoTip>
                    ) : tile.kind === 'post-event' ? (
                      <InfoTip className="min-w-0 max-w-full"
                        label={tile.label}
                        align="start"
                        labelClassName={`line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight ${showing ? 'text-ink/75' : 'text-ink/45'}`}
                      >
                        {postEventTileNote(tile)}
                      </InfoTip>
                    ) : (
                      <span className={`line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight ${showing ? 'text-ink/75' : 'text-ink/45'}`}>
                        {tile.label}
                        {/* 🧩 Empty: drawn in the Maker so it can be filled; guests do not see it yet. */}
                        {tile.kind === 'scene' && tile.empty ? (
                          <span className="block text-[10px] font-medium italic text-ink/50" data-maker-tile-empty="">
                            Empty · tap to fill
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                  {scene && menuFor === scene.id ? (
                    <SceneMenu
                      onClose={() => setMenuFor(null)}
                      canUp={shownSceneIds.indexOf(scene.id) > 0}
                      canDown={shownSceneIds.indexOf(scene.id) < shownSceneIds.length - 1}
                      showing={showing}
                      onUp={() => {
                        const k = shownSceneIds.indexOf(scene.id);
                        move(scene.id, swapsForDrop(fullOrder, scene.id, shownSceneIds[k - 1] ?? null));
                      }}
                      onDown={() => {
                        const k = shownSceneIds.indexOf(scene.id);
                        move(scene.id, swapsForDrop(fullOrder, scene.id, shownSceneIds[k + 2] ?? afterLastShown));
                      }}
                      onEye={() => eyeWrite(scene)}
                    />
                  ) : null}
                </div>
                {scene && next?.kind === 'scene' ? (
                  <button
                    type="button"
                    onClick={() => select?.({ kind: 'scene', id: scene.id, tab: 'animate' })}
                    title="The transition into the next scene"
                    className="sn-press mx-auto hidden h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink lg:ml-5 lg:flex"
                  >
                    {scene.transitionLabel}
                  </button>
                ) : null}
              </li>
              </Fragment>
            );
          })}
          {/* 🗂 THE FOLD — every section this stage does not draw, with why. */}
          {list.folded.length > 0 ? (
            <li className="shrink-0 self-start lg:mt-3 lg:self-stretch" data-maker-fold="">
              <details className="group rounded-md bg-white/50 px-2 py-1.5">
                <summary className="cursor-pointer list-none text-[11px] font-semibold text-ink/60 hover:text-ink">
                  Not shown on {PUBLIC_STAGE_LABELS[stage]} ({list.folded.length})
                </summary>
                <ul className="mt-1.5 space-y-1">
                  {list.folded.map((f) => {
                    const scene = f.widgetId ? (sceneById.get(f.widgetId) ?? null) : null;
                    return (
                      <li key={f.key} data-maker-folded={f.key} className="flex items-center gap-1 text-[11.5px] text-ink/70">
                        <span className="min-w-0 flex-1">
                          <InfoTip className="min-w-0 max-w-full" label={f.label} align="start" labelClassName="min-w-0 truncate">
                            {f.reason}
                          </InfoTip>
                        </span>
                        {scene ? (
                          <>
                            <button
                              type="button"
                              onClick={() => select?.({ kind: 'scene', id: scene.id })}
                              aria-label={`Edit ${f.label}`}
                              className="sn-press inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
                            >
                              <PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            {f.hiddenByCouple ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => eyeWrite(scene)}
                                aria-label={`Show ${f.label} to guests`}
                                className="sn-press inline-flex h-7 w-7 items-center justify-center rounded-full text-terracotta hover:bg-ink/5 disabled:opacity-40"
                              >
                                <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          ) : null}
          <li
            className="shrink-0 self-center lg:mt-2 lg:self-stretch"
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId) return;
              const from = dragId;
              setDragId(null);
              setDropAt(null);
              move(from, swapsForDrop(fullOrder, from, afterLastShown));
            }}
          >
            {adding ? (
              <p role="status" data-maker-adding-scene="" className="animate-pulse pl-4 text-[11px] font-medium text-ink/70">
                Adding your scene…
              </p>
            ) : null}
            {stage === 'editorial' && postEventPresets ? (
              /* 🎞 POST EVENT'S OWN "+" (owner 2026-09-25) — its twelve
                 presets, not the 25 templates; each ◆ Pro, each placed in the
                 draft at once (try-then-pay: Apply asks for Pro). */
              <div className="pl-4">
                <SceneTemplatePicker
                  overlay
                  draft
                  open={addOpen}
                  onOpenChange={setAddOpen}
                  onPick={onPickTemplate}
                  action={postEventPresets.action}
                  hidden={{ event_id: eventId, return_to: postEventPresets.returnTo }}
                  stageLabel={PUBLIC_STAGE_LABELS.editorial}
                  heading="Add a scene ·"
                  triggerLabel="+ Add a scene"
                  initialView={maker?.device === 'phone' ? 'phone' : 'desktop'}
                  presets={{ used: postEventPresets.used, ownsPro: postEventPresets.ownsPro, storeShell: postEventPresets.storeShell }}
                />
              </div>
            ) : !stageTakesOwnScenes(stage) ? null : addScene && 'action' in addScene ? (
              /* 🎬 "+" opens the 25 templates, headed with the stage being
                 edited and drawn in the view being edited (owner 2026-09-24).
                 💾 A tile ADDS INTO THE DRAFT (`draft`): the scene is on the
                 canvas and here at once, and guests meet it at Apply. */
              <div className="pl-4">
                <SceneTemplatePicker
                  overlay
                  draft
                  open={addOpen}
                  onOpenChange={setAddOpen}
                  onPick={onPickTemplate}
                  tour={addScene.tour ?? null}
                  action={addScene.action}
                  hidden={{ event_id: eventId, return_to: addScene.returnTo }}
                  stageLabel={stage === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS.rsvp}` : PUBLIC_STAGE_LABELS[stage]}
                  heading="Add a scene to"
                  triggerLabel="+ Add a scene"
                  initialView={view}
                  facts={sceneFacts}
                />
              </div>
            ) : addScene && 'note' in addScene ? (
              <span className="flex items-center gap-1 pl-4 text-[11px] text-ink/60">
                <InfoTip className="min-w-0 max-w-full" label="New scene" align="start">
                  {addScene.note}
                </InfoTip>
              </span>
            ) : null}
          </li>
          </IntoLowerThird>
        </ol>
        {/* the edge you drag to make the navigator wider or narrower */}
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the scenes"
          onPointerDown={startResize}
          className="absolute inset-y-0 right-0 hidden w-1.5 cursor-col-resize hover:bg-terracotta/30 lg:block"
        />
      </nav>

      </>)}
      {/* ══ 3 · THE CANVAS — the real page, one stage at a time ══ */}
      {/* A labelled <section>, not a second <main>: the event layout owns the
          one landmark (`couple-screens-keep-the-shell.test.ts`). */}
      <section
        aria-label="Preview"
        data-maker-stage={stage}
        className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-2 pb-2 pt-2 lg:order-2 lg:px-6 lg:pb-5 lg:pt-4"
      >
        {/* 👁 SEE AS ▾ (PR-10, owner 2026-10-04; prototype screen 12). On a desktop
            the ONE dropdown above the preview; on a phone the same pick is a row
            of 👁 Preview (maker-shell.tsx `data-maker-see-as-rows`), and the page
            wears a small tag saying whose eyes it is drawn with. Only where the
            canvas is the page — nothing to see as otherwise. */}
        {canvasSrc && maker?.setSeeAs ? (
          <div className="mb-2 hidden w-full shrink-0 items-center lg:flex" data-maker-see-as="">
            <PickMenu
              label="See as"
              dataAttr="data-maker-see-as-menu"
              value={seeAs ?? SEE_AS_EDITING.key}
              buttonText={`See as · ${seeAsLabel(seeAs)}`}
              options={[
                { key: SEE_AS_EDITING.key, label: SEE_AS_EDITING.label },
                ...SEE_AS.map((o) => (o.note ? { key: o.key, label: o.label, hint: o.note } : { key: o.key, label: o.label })),
              ]}
              onPick={(key) => maker.setSeeAs?.(seeAsOf(key))}
              compact
            />
          </div>
        ) : null}
        {canvasSrc && seeAs ? (
          <p
            data-maker-see-as-tag=""
            className="mb-1.5 self-start rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-terracotta-700 ring-1 ring-terracotta/40 lg:hidden"
          >
            See as · {seeAsLabel(seeAs)}
          </p>
        ) : null}
        {canvasSrc ? (
          /* 🖥📱 One row: the canvas, and — in Both — the phone pane beside it.
             ⚠ The canvas keeps its PLACE in the tree in every view: moving an
             iframe in the document reloads it (and its warm stages), so Both
             only re-sizes the canvas's own box and appends the phone after it. */
          <div
            ref={bothRowRef}
            data-maker-both={both ? '' : undefined}
            className={`flex min-h-0 min-w-0 w-full flex-1 justify-center ${both ? 'items-center' : 'items-stretch'}`}
            style={bothFit ? { gap: bothFit.gap } : undefined}
          >
          <div
            data-maker-both-desktop={both ? '' : undefined}
            style={bothFit ? { width: bothFit.desktop.boxWidth, height: bothFit.desktop.boxHeight } : undefined}
            className={
              both
                ? 'relative shrink-0 overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)]'
                : 'flex min-h-0 min-w-0 flex-1 justify-center'
            }
          >
          {/* 🪞 Double-buffered (`buffered-canvas-frame.tsx`): a new render loads
             behind the page the couple is looking at and swaps in when ready —
             no blank screen, no reload from the top, after any Maker write. */}
          <BufferedCanvasFrame
            frameKey={`${stage}:${canvasStamp}:${maker.seeAs ?? ''}`}
            group={`${stage}:${maker.seeAs ?? ''}`}
            src={canvasSrc}
            title={`Your Event Hub — ${PUBLIC_STAGE_LABELS[stage]}`}
            frameRef={frameRef}
            loadingRef={loadingCanvas}
            backgroundRef={backgroundCanvases}
            broadcastRef={canvasBroadcast}
            warm={warmStages}
            warmMax={warmBudget}
            warmGen={maker.renderStamp}
            anchorKey={() => selectedKeyRef.current}
            onShown={setShownFrameKey}
            onSwapped={onCanvasSwapped}
            style={bothFit ? scaledFrame(bothFit.desktop) : undefined}
            className={
              both
                ? 'bg-white'
                : `min-h-0 w-full flex-1 rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] transition-[max-width] duration-sn-elem ease-sn ${
                    device === 'phone' ? 'max-w-[430px]' : 'max-w-none'
                  }`
            }
          />
          </div>
          {both ? (
            /* 📱 THE PHONE PANE — the same address, keyed on the same held
               stamp as the canvas (so a held pick never reloads it either),
               reached by the same broadcast. No warm stages of its own. */
            <div
              data-maker-both-phone=""
              className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)]"
              style={bothFit ? { width: bothFit.phone.boxWidth, height: bothFit.phone.boxHeight } : undefined}
            >
              <BufferedCanvasFrame
                frameKey={`${stage}:${canvasStamp}:${maker.seeAs ?? ''}`}
                group={`${stage}:${maker.seeAs ?? ''}`}
                src={canvasSrc}
                title={`Your Event Hub on a phone — ${PUBLIC_STAGE_LABELS[stage]}`}
                frameRef={bothFrameRef}
                loadingRef={bothLoading}
                backgroundRef={bothBackground}
                broadcastRef={bothBroadcast}
                anchorKey={() => selectedKeyRef.current}
                onShown={setShownBothKey}
                onSwapped={() => reMarkBoth(false)}
                style={bothFit ? scaledFrame(bothFit.phone) : undefined}
                className="bg-white"
              />
              {publicLandingUrl ? (
                <CanvasStaysOnThePage
                  frameRef={bothFrameRef}
                  pagePath={publicLandingUrl}
                  resetKey={shownBothKey}
                  stageLabel={PUBLIC_STAGE_LABELS[stage]}
                  onBack={() => {
                    const f = bothFrameRef.current;
                    const src = f?.getAttribute('src');
                    if (f && src) f.src = src;
                  }}
                />
              ) : null}
            </div>
          ) : null}
          </div>
        ) : (
          <p className="max-w-sm text-center text-sm text-ink/70">
            Set your Event Hub address (⋯ in the toolbar) to see your page here.
          </p>
        )}
        {/* 🎫 The Guest's ticket scene: the REAL ticket on the page — the first
            coming guest's name and QR (`pass_guest=first`), in the look the
            Ticket style ▾ below holds. The canvas stays loaded underneath. */}
        {ticketOn && canvasSrc ? (
          <div
            data-maker-ticket-view={ticketDesign}
            /* A phone sizes the ticket by whichever side binds (`cq*` units), so its box is always 3:4. */
            className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-cream p-4 max-lg:[container-type:size]"
          >
            {ticketFailed === ticketDesign ? (
              <p role="alert" data-maker-ticket-failed="" className="m-auto max-w-xs px-4 text-center text-sm text-terracotta-700">
                The ticket could not be drawn just now. Nothing was changed — please try again in a moment.
              </p>
            ) : (
              /* 🎟 NEVER BLANK WHITE (owner 2026-10-05, live at 375: ~8 s of an
                 empty page before the ticket drew). On a phone the ticket's own
                 3:4 shape — a QR mark — holds the page at once, UNDER the
                 picture, which fades in once it has LOADED (the guest card's
                 placeholder, one component). The desktop draws as it did. */
              <span data-maker-ticket-box="" className="relative aspect-[3/4] w-[min(100cqw,75cqh)] lg:contents">
                <span className="lg:hidden">
                  <TicketPlaceholder name={null} waiting={ticketLoaded !== makerTicketSrc(eventId, ticketDesign)} size="stage" />
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- a same-origin SVG from our print route */}
                <img
                  key={ticketDesign}
                  ref={(img) => {
                    // A picture already in the cache can finish before onLoad is attached.
                    if (img?.complete && img.naturalWidth > 0) setTicketLoaded(img.getAttribute('src'));
                  }}
                  src={makerTicketSrc(eventId, ticketDesign)}
                  alt={`${PASS_CARD_DESIGN_LABEL[ticketDesign]} ${PASS_CARD_WORDS.noun}`}
                  onLoad={(e) => setTicketLoaded(e.currentTarget.getAttribute('src'))}
                  onError={() => setTicketFailed(ticketDesign)}
                  data-maker-ticket-img={ticketLoaded === makerTicketSrc(eventId, ticketDesign) ? 'loaded' : 'loading'}
                  className={`absolute inset-0 h-full w-full rounded-md bg-white object-contain shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] transition-opacity duration-300 motion-reduce:transition-none lg:static lg:h-auto lg:max-h-[calc(100%-2rem)] lg:w-auto lg:max-w-full lg:opacity-100 ${
                    ticketLoaded === makerTicketSrc(eventId, ticketDesign) ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </span>
            )}
          </div>
        ) : null}
        {/* 🖥📱 Both was picked but the room cannot hold two readable frames —
            Desktop is drawn, and the couple is told why the phone is gone. */}
        {bothTooNarrow ? (
          <p data-maker-both-too-narrow="" className="w-full shrink-0 pt-1.5 text-center text-[11px] text-ink/60">
            Not enough room for Both — showing Desktop. Close the scenes list or the inspector, or widen the window.
          </p>
        ) : null}
        {/* 🖼 "Event Bar" (owner 2026-09-26: *"rename it to Event Bar"*) — the
            stage's OWN guest header and tab bar over the slide in view. The lower
            right of the canvas, BELOW the page and
            never over it. */}
        {publicLandingUrl ? (
          /* A desktop's — on a phone it is Settings' Event Bar tile (registered above). */
          <div className="flex w-full shrink-0 items-center justify-end gap-1 pt-1.5 max-lg:hidden">
            <button
              type="button"
              role="switch"
              aria-checked={guestBars}
              aria-label="Event Bar"
              data-maker-guest-bars={guestBars ? 'on' : 'off'}
              onClick={toggleGuestBars}
              className={`sn-press inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-sn-control ease-sn ${
                guestBars ? 'bg-ink text-cream' : 'bg-white/80 text-ink/70 hover:bg-white hover:text-ink'
              }`}
            >
              <PanelsTopLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
            {/* 🚫 NO (i) NOTE (owner 2026-10-05): its bubble floated, unbacked, over
                the scene tiles and could not be closed from the page. The switch's
                own visible word says what it is. */}
            <span aria-hidden data-maker-guest-bars-label="" className="text-[12px] font-semibold text-ink/70">
              Event Bar
            </span>
          </div>
        ) : null}
        {/* 🪞 The canvas only ever shows the couple's page. A link that leads
            anywhere else (a dashboard route, the Maker itself) is covered, not
            drawn — see `maker-canvas-guard.tsx`. */}
        {publicLandingUrl ? (
          <CanvasStaysOnThePage
            frameRef={frameRef}
            pagePath={publicLandingUrl}
            resetKey={shownFrameKey}
            stageLabel={PUBLIC_STAGE_LABELS[stage]}
            onBack={() => {
              const f = frameRef.current;
              const src = f?.getAttribute('src');
              if (f && src) f.src = src;
            }}
          />
        ) : null}
      </section>

      {/* ✍ The type bar over the words being typed (tap-to-type). */}
      {typeStart && elementEditing && !workHidden ? (
        <TypeBar
          key={typeStart.n}
          eventId={eventId}
          start={typeStart}
          heroCanvas={elementEditing.canvases.hero ?? {}}
          /* ✍ A scene's words (not the hero's): that scene's canvas, for its part's Hide. */
          sceneCanvas={typeStart.field ? (elementEditing.canvases[typeStart.key.slice(2)] ?? {}) : undefined}
          ownWords={typeStart.field ? (elementEditing.ownWords?.[typeStart.key.slice(2)] ?? null) : null}
          draftAction={elementEditing.draftAction}
          twoPeople={sceneFormat?.twoPeople !== false}
          names={sceneFormat?.names ?? null}
          frames={() => [frameRef.current, bothFrameRef.current]}
          post={postToShownCanvases}
          broadcast={broadcastToCanvas}
          onSaving={(widgetType, canvas) => {
            canvasHold.current = holdCanvas(canvasHold.current, drawnCanvases(), widgetType, canvas, Date.now(), canvasOrder);
            scheduleSnapshots(600);
          }}
          onClose={endTyping}
          inline={typeInline ? { slot: typeSlot } : null}
          onStyle={() => {
            const { key, el } = typeStart;
            endTyping();
            if (isHubElementKey(el)) {
              setElementTarget({ key, widgetType: key === 'f:hero' ? 'hero' : key.slice(2), el });
              postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key, el });
            }
          }}
        />
      ) : null}
      {/* ══ 4 · THE INSPECTOR — only when something is selected ══ */}
      {workHidden ? null : elementTarget && elementEditing ? (
        <ElementSheet
          eventId={eventId}
          target={elementTarget}
          /* The RENDER's canvas — the sheet lays the Maker's own copy over it
             (`draftedCanvasOr`), which is what keeps a pick from building on it. */
          canvas={elementEditing.canvases[elementTarget.widgetType] ?? {}}
          palette={elementEditing.palette}
          ownsPro={ownsPro}
          hideLocked={maker.storeShell}
          draftAction={elementEditing.draftAction}
          resize={toolsResize}
          parts={elementTarget.widgetType === 'hero' ? heroParts : HUB_SCENE_ELEMENT_KEYS}
          /* 🎞 A Post Event scene's part: saved into the story's looks, and its
             own words edited right here (no "Edit in … ↗"). */
          {...(() => {
            /* 🧰 A phone typing this part: the type rows' place, at the top of its Text tools. */
            const typeRows = typeInline && typeStart ? <div ref={setTypeSlot} data-type-slot="" /> : null;
            const peScene = postEventSceneOfScope(elementTarget.widgetType);
            const pe = navigator.postEvent && navigator.postEvent !== 'unreadable' ? navigator.postEvent : null;
            if (!peScene || !pe) return typeRows ? { wordsSlot: typeRows } : {};
            // 🎨 The style it is drawn in, resolved on the server (`postEvent.styles`).
            const drawn = pe.styles[peScene] ?? null;
            const words = drawn ? postEventWordParts(peScene, drawn) : [];
            const el = elementTarget.el;
            return {
              saveCanvasWith: (next: HubSectionCanvas) => {
                const patch = postEventSetElements(pe.arrangement, peScene, next.elements ?? null);
                const fd = new FormData();
                fd.set('intent', 'save');
                fd.set('patch', JSON.stringify({ editorial: patch ?? {} }));
                return elementEditing.draftAction(eventId, fd);
              },
              wordsSlot:
                el === 'label' || el === 'heading' || el === 'body'
                  ? words.includes(el)
                    ? (
                        <PostEventWordsField
                          key={`${peScene}:${el}`}
                          eventId={eventId}
                          scene={peScene}
                          part={el}
                          arrangement={pe.arrangement}
                          draftAction={elementEditing.draftAction}
                        />
                      )
                    : null
                  : null,
            };
          })()}
          onPart={(el) => {
            postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key: elementTarget.key, el });
            setElementTarget({ key: elementTarget.key, widgetType: elementTarget.widgetType, el });
          }}
          sceneLabel={
            elementTarget.widgetType === 'hero'
              ? 'Names & date'
              : postEventSceneOfScope(elementTarget.widgetType)
                ? (list.shown.find((t) => t.kind === 'post-event' && postEventElementScope(t.scene) === elementTarget.widgetType)?.label ?? undefined)
                : (scenes.find((sc) => sc.type === elementTarget.widgetType)?.label ?? undefined)
          }
          /* ✋ No "Open the Hero editor" from a part (owner 2026-10-05): the names
             and date are made in place — `onOpenHero` is not handed in. */
          usedColours={usedColours}
          onPreview={(message) => {
            broadcastToCanvas(message);
            // The navigator's tiles are pictures of the canvas — re-take them.
            scheduleSnapshots(600);
          }}
          onSaving={(widgetType, canvas) => {
            canvasHold.current = holdCanvas(canvasHold.current, drawnCanvases(), widgetType, canvas, Date.now(), canvasOrder);
          }}
          onPlay={() =>
            postToShownCanvases({ source: 'setnayan-editor', t: 'playEl', key: elementTarget.key, el: elementTarget.el })
          }
          onClose={() => {
            postToShownCanvases({ source: 'setnayan-editor', t: 'markEl', key: elementTarget.key, el: null });
            sheetDo({ t: 'close' });
          }}
          section={sheet.section}
          onSection={(section) => sheetDo({ t: 'section', section })}
        />
      ) : selection ? (
        <CanvasWordsContext.Provider value={canvasWords}>
        <Inspector
          selection={selection}
          contentBound={(() => {
            if (!selectedScene) return null;
            /* ✍ A FACT'S SCENE: its Content IS the Details item's own editor
               (`maker.factEditors`, the very node Details draws — never a copy;
               DECISION_LOG "…TAP IS A SHORTCUT"). A scene the couple changed
               "just here" keeps the box that asked, so its ↺ is never lost. */
            const sceneKey = `w:${selectedScene.type}`;
            /* ✍ Words a tap types in on the page have ONE place: there. Their box
               steps aside while the canvas has them (`typedHereOn`); an empty
               scene, or words a style splits, keep the box. */
            const typedField =
              selectedScene.type === 'special_message' ? 'message' : selectedScene.type === 'what_to_bring' ? 'reminders' : null;
            if (typedField && typedHereOn(sceneKey, typedField)) {
              return (
                <p className="px-1 text-[13px] leading-relaxed text-ink/70" data-typed-here={typedField}>
                  {typedField === 'message'
                    ? 'Your message is typed right on the page — tap it there and type.'
                    : 'Your reminders are typed right on the page — tap them there and type.'}{' '}
                  Guests see the change when you press Apply.
                </p>
              );
            }
            const sceneCanvas: HubSectionCanvas = canvasOf(selectedScene.type);
            const ownWords = detailsBound?.ownWords.includes(selectedScene.type) ?? false;
            const boundItem: DetailsItemKey | null = ownWords
              ? null
              : detailsFactOfScene(selectedScene.type, sceneCanvas) === 'message'
                ? sceneCanvas.details?.message
                  ? null
                  : 'special-message'
                : detailsItemForSection(sceneKey);
            const shared = boundItem ? factEditorFor(boundItem, sceneKey) : null;
            if (shared) return shared;
            if (!elementEditing || !detailsBound) return null;
            if (ownWords) return null;
            const fact = detailsFactOfScene(selectedScene.type, sceneCanvas);
            return fact ? (
              <DetailsBoundField
                key={`${selectedScene.type}:${fact}`}
                eventId={eventId}
                widgetType={selectedScene.type as WidgetType}
                fact={fact}
                canvas={sceneCanvas}
                detailsValue={detailsBound.values[fact]}
                draftAction={elementEditing.draftAction}
                onOpenDetails={() => select?.({ kind: 'tool', key: 'details' })}
                onStyle={() => setElementTarget({ key: `w:${selectedScene.type}`, widgetType: selectedScene.type, el: 'body' })}
                onSaving={(patch, choice, text) => {
                  /* ⚡ A WORDS SAVE JOINS THE CANVAS HOLD (`element-preview.ts`):
                     the words are already on the page (the bridge's `words`), so
                     the render the save brings back keeps the page instead of
                     reloading it. "Use Details" and a cleared message reload —
                     the page must draw what it did not preview. */
                  const type = selectedScene.type;
                  const written = patch.widgets?.[type as WidgetType]?.canvas;
                  if (written) noteDraftedCanvas(type, written, elementEditing.canvases[type]);
                  if (choice === 'use-details' || text.trim().length === 0) {
                    releaseCanvas();
                    return;
                  }
                  /* "Everywhere" writes the Details fact itself, which this page
                     reads from the render — so that one burst still ends in ONE. */
                  if (choice === 'everywhere') makerNeedsRender();
                  const now = Date.now();
                  // "Everywhere" also changes every other scene still bound to Details.
                  const others =
                    choice === 'everywhere'
                      ? Object.entries(elementEditing.canvases)
                          .filter(([t]) => t !== type && !detailsBound.ownWords.includes(t))
                          .filter(([t, c]) => detailsFactOfScene(t, c) === 'message' && !c.details?.message)
                          .map(([t]) => t)
                      : [];
                  /* A scene the page drew EMPTY has no real look to preview in
                     unless it carries one (`MakerEmptyScene` `look` — the Special
                     message does); the page must redraw it, so it reloads. */
                  const drawnEmpty = (t: string) =>
                    !sceneBoundText('message', elementEditing.canvases[t], detailsBound.values.message).text;
                  if ([type, ...others].some((t) => t !== 'special_message' && drawnEmpty(t))) {
                    releaseCanvas();
                    return;
                  }
                  const shown = heldCanvasFor(canvasHold.current, type, now) ?? canvasOf(type);
                  canvasHold.current = holdCanvas(
                    canvasHold.current,
                    drawnCanvases(),
                    type,
                    patch.widgets?.[type as WidgetType]?.canvas ?? shown,
                    now,
                    canvasOrder,
                  );
                  for (const t of others) postWords(`w:${t}`, text);
                }}
                startingPoint={detailsBound.startingPoint ?? null}
                startingHint={detailsBound.startingHint}
                tour={detailsBound.tour}
              />
            ) : null;
          })()}
          postEventTile={
            selection.kind === 'post-event'
              ? ((list.shown.find((t) => t.kind === 'post-event' && t.scene === selection.scene) as PostEventTile | undefined) ?? null)
              : null
          }
          postEventPanel={(() => {
            if (selection.kind !== 'post-event') return null;
            const tile = list.shown.find((t) => t.kind === 'post-event' && t.scene === selection.scene) as PostEventTile | undefined;
            const pe = navigator.postEvent && navigator.postEvent !== 'unreadable' ? navigator.postEvent : null;
            if (!tile || !elementEditing) return null;
            return (
              <PostEventScenePanel
                key={tile.scene}
                eventId={eventId}
                tile={tile}
                arrangement={pe?.arrangement ?? null}
                writtenAt={pe?.generatedAt ?? null}
                dayHappened={pe?.dayHappened ?? true}
                eventType={sceneFormat?.eventType ?? null}
                sectionCanvases={elementEditing.canvases}
                draftAction={elementEditing.draftAction}
                onPart={
                  pe?.styles[tile.scene]
                    ? (el) => {
                        postToShownCanvases({
                          source: 'setnayan-editor',
                          t: 'markEl',
                          key: `p:${tile.anchor?.slice(2) ?? tile.scene}`,
                          el,
                        });
                        setElementTarget({ key: tile.anchor ?? `p:${tile.scene}`, widgetType: postEventElementScope(tile.scene), el });
                      }
                    : null
                }
              />
            );
          })()}
          fixedStylePanel={(() => {
            if (selection.kind !== 'row' || !elementEditing) return null;
            const fixed = fixedOfKey(selection.key);
            if (!fixed || !isFixedStyleScene(fixed)) return null;
            return (
              <FixedSceneStyleRow
                key={`${fixed}:${stage}`}
                eventId={eventId}
                scene={fixed}
                stage={stage}
                eventType={sceneFormat?.eventType ?? null}
                picked={sceneFormat?.fixedStyles?.[fixed] ?? null}
                draftAction={elementEditing.draftAction}
              />
            );
          })()}
          scene={selectedScene}
          scenePanel={selectedScene ? scenePanels[selectedScene.id] : null}
          sceneTabs={sceneTabs}
          rows={rows}
          eventId={eventId}
          madeOnce={madeOnce}
          showMotionTabs={ownsPro || !maker.storeShell}
          onClose={() => select?.(null)}
          onReveal={() => scrollPreviewTo(selectedKeyRef.current ?? undefined)}
          onTab={(tab) => selectedScene && select?.({ kind: 'scene', id: selectedScene.id, tab })}
          fixedFact={
            selection.kind === 'row' && selection.key.startsWith('f:')
              ? (() => {
                  const item = detailsItemForSection(selection.key);
                  return item ? factEditorFor(item, null) : null;
                })()
              : null
          }
          heroParts={heroParts}
          ticketPanel={
            ticketOn ? (
              <PassCardDesignPicker
                key={ticketSaved}
                eventId={eventId}
                saved={ticketSaved}
                preview={false}
                onShown={setTicketShown}
                previews={Object.fromEntries(PASS_CARD_DESIGNS.map((d) => [d, makerTicketSrc(eventId, d)])) as Record<PassCardDesign, string>}
              />
            ) : null
          }
          resize={toolsResize}
          onElement={
            elementEditing && selectionKey
              ? (el) =>
                  setElementTarget({
                    key: selectionKey,
                    widgetType: selectionKey === 'f:hero' ? 'hero' : selectionKey.slice(2),
                    el,
                  })
              : null
          }
        />
        </CanvasWordsContext.Provider>
      ) : null}
      </div>

      {/* The one form every navigator write goes through. 💾 It carries the
          draft field: the eye, Auto/Shown/Hidden and every drag step land in the
          draft, and guests see none of it until Apply. */}
      <form ref={formRef} hidden aria-hidden>
        <HubDraftField />
        <input type="hidden" name="event_id" value={eventId} readOnly />
        <input type="hidden" name="widget_id" defaultValue="" />
        <input type="hidden" name="widget_type" defaultValue="" />
        <input type="hidden" name="next_visible" defaultValue="" />
        <input type="hidden" name="next_mode" defaultValue="" />
        <input type="hidden" name="return_to" defaultValue="" />
        {/* ↕ A move arranges THIS stage only (`config_json.stage_order`). */}
        <input type="hidden" name="stage" value={stage} readOnly />
        <button type="submit" data-op="toggle" formAction={toggleAction} tabIndex={-1} />
        <button type="submit" data-op="mode" formAction={setModeAction} tabIndex={-1} />
        <button type="submit" data-op="up" formAction={moveUpAction} tabIndex={-1} />
        <button type="submit" data-op="down" formAction={moveDownAction} tabIndex={-1} />
      </form>

      {/* The address rows live in the ⋯ sheet, with the rest of "your Event Hub". */}
      {moreHost
        ? createPortal(
            <>
              {moreRows.map((key) => (
                <RowBlock key={key} row={rows[key]!} />
              ))}
              <MoreExtras
                liveHref={publicLandingUrl}
                proUnlockHref={proUnlockHref}
                proPriceLabel={proPriceLabel}
                showProCta={showProCta}
              />
            </>,
            moreHost,
          )
        : null}
    </div>
  );
}

/**
 * The made-once item whose PAGE the body shows, or null (a stage, a scene, a
 * row). Logo · Hero · Reveal need their workspace; Love Story always has a page
 * (the scrapbook, or the story as guests see it). Details is the shell's.
 */
/** Details and RSVP are drawn by the SHELL (`maker-shell.tsx`) over this area. */
/** The other stages, nearest first (`PUBLIC_STAGE_ORDER`) — the order they are warmed in. */
function warmStageOrder(stage: LifecyclePhase): LifecyclePhase[] {
  const order: readonly LifecyclePhase[] = PUBLIC_STAGE_ORDER;
  const at = order.indexOf(stage);
  return order
    .filter((s) => s !== stage)
    .sort((a, b) => Math.abs(order.indexOf(a) - at) - Math.abs(order.indexOf(b) - at) || order.indexOf(a) - order.indexOf(b));
}

/** Event Details and the RSVP stage are drawn by the shell over this area (`MAKER_SHELL_PAGES`). */
function isShellPage(key: string): key is MakerShellPage {
  return isMakerShellPage(key);
}



/* ── 📖 POST EVENT TILES (Maker Phase 8) — their words live beside the scene
   panel (`post-event-scene-panel.tsx`), one place for both. ──────────── */



/**
 * A MINIATURE OF THE SECTION, in the device's proportions (owner 2026-09-25:
 * *"shouldnt mobile mode also have mobile preview on navigation"*). Drawn from
 * the section's own words and ground — no iframe per tile.
 */
function SceneMiniature({
  mini,
  fallback,
  tint,
  device,
}: {
  mini: SceneMini | undefined;
  fallback: string;
  tint: MakerNavigatorData['tint'];
  device: 'desktop' | 'phone';
}) {
  const ground = mini?.ground ?? tint.canvas;
  const photo = mini?.photoUrl ?? null;
  return (
    <span
      aria-hidden
      className={`absolute inset-0 flex flex-col justify-center overflow-hidden text-left ${device === 'phone' ? 'px-1.5' : 'px-2'}`}
      style={{ background: ground, color: tint.ink }}
    >
      {photo ? (
        /* eslint-disable-next-line @next/next/no-img-element -- a signed thumbnail already made for this page */
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      ) : null}
      <span className="relative">
        {mini?.eyebrow ? (
          <span
            className="block truncate font-mono text-[6px] uppercase tracking-[0.18em]"
            style={{ color: tint.accent }}
          >
            {mini.eyebrow}
          </span>
        ) : null}
        <span className={`block font-serif leading-tight ${device === 'phone' ? 'line-clamp-3 text-[9px]' : 'line-clamp-2 text-[11px]'}`}>
          {mini?.title ?? fallback}
        </span>
        {mini?.line ? (
          <span className="mt-0.5 block truncate text-[7px] opacity-70">{mini.line}</span>
        ) : null}
      </span>
    </span>
  );
}

/** Is this scene on the guest page right now? Both gates, the way the page reads them. */
export function sceneShowing(scene: Pick<MakerScene, 'mode' | 'isVisible'>): boolean {
  if (scene.mode === 'hidden') return false;
  if (scene.mode === 'shown') return true;
  return scene.isVisible;
}

function SceneMenu({
  onClose,
  canUp,
  canDown,
  showing,
  onUp,
  onDown,
  onEye,
}: {
  onClose: () => void;
  canUp: boolean;
  canDown: boolean;
  showing: boolean;
  onUp: () => void;
  onDown: () => void;
  onEye: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item =
    'sn-press block w-full rounded-md px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-ink/5 disabled:opacity-40';
  return (
    <div ref={ref} role="menu" className="sn-glass-bare absolute left-4 top-full z-30 mt-1 w-40 rounded-md p-1">
      <button type="button" role="menuitem" disabled={!canUp} className={item} onClick={() => { onClose(); onUp(); }}>
        Move up
      </button>
      <button type="button" role="menuitem" disabled={!canDown} className={item} onClick={() => { onClose(); onDown(); }}>
        Move down
      </button>
      <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onEye(); }}>
        {showing ? 'Hide from guests' : 'Show to guests'}
      </button>
    </div>
  );
}

function RowBlock({ row }: { row: MakerRowPanel }) {
  return (
    <section className="rounded-md bg-white/70">
      <header className="flex items-start gap-2 px-3 pt-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{row.label}</span>
          {row.blurb ? <span className="block text-[12.5px] text-ink/65">{row.blurb}</span> : null}
        </span>
        {/* 🔑 The chip colours on the row's own CLAIM, never on its wording —
            "Private", "0 showing" and "No schedule" once painted success-green
            (`a-chip-tells-the-truth-about-empty.test.ts`). */}
        {row.status ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              row.status.filled
                ? 'bg-success-100 text-success-800'
                : 'bg-ink/5 text-ink/65'
            }`}
          >
            {row.status.label}
          </span>
        ) : null}
      </header>
      {row.node}
    </section>
  );
}

/**
 * Scan-to-view and the one Pro CTA — the rail's topbar and foot, ported into
 * the Maker's ⋯ sheet. The QR is the master event QR `/api/website/qr` already
 * serves, with the one control strip every link-QR carries. The CTA is the
 * umbrella unlock — one CTA for all nine Pro items (`WEBSITE_PRO_ITEMS`) — shown
 * only while they do not own it, and never in the store shell.
 */
function MoreExtras({
  liveHref,
  proUnlockHref,
  proPriceLabel,
  showProCta,
}: {
  liveHref: string | null;
  proUnlockHref: string;
  proPriceLabel: string | null;
  showProCta: boolean;
}) {
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  useEffect(() => {
    setLiveUrl(liveHref ? new URL(liveHref, window.location.origin).toString() : null);
  }, [liveHref]);
  return (
    <>
      {liveHref ? (
        <section className="rounded-md bg-white/70 px-3 py-3">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <QrCode aria-hidden className="h-4 w-4" strokeWidth={2} /> Scan to view
          </p>
          <p className="text-[12.5px] text-ink/65">Point a phone camera here to open your Event Hub.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin PNG from our QR route */}
          <img
            src={`/api/website/qr${liveHref}`}
            alt="QR code that opens your live Event Hub"
            width={168}
            height={168}
            className="mt-2 h-auto w-40 rounded-md"
          />
          {liveUrl ? (
            <QrActions
              url={liveUrl}
              download={{ href: `/api/website/qr${liveHref}`, filename: 'setnayan-event-qr.png' }}
              className="mt-2 flex flex-wrap gap-1.5"
            />
          ) : null}
        </section>
      ) : null}
      {showProCta ? (
        <section className="rounded-md bg-ink px-4 py-3.5 text-cream">
          <p className="text-[13px] font-semibold text-cream">
            <PaidMark state="try" label={paidMarkLabel('try', 'Event Hub Pro')} text="Event Hub Pro" size="md" tone="current" />
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-cream/80">
            One unlock for every stage — the look, the reveal, your own photos and film, music and the
            animated logo.
          </p>
          <Link
            href={proUnlockHref}
            className="sn-press mt-2.5 inline-flex min-h-10 items-center rounded-full bg-amber-400 px-4 text-[13px] font-semibold text-ink hover:bg-amber-300"
          >
            {unlockLabel(proPriceLabel)}
          </Link>
        </section>
      ) : null}
    </>
  );
}

/**
 * 🔤 THE SCENE'S PARTS — ONE dropdown (owner 2026-10-05: the row of eight pills
 * is a set of choices, and a set of choices is a dropdown). A pick opens the
 * same part sheet a tap on the part on the page opens (font · colour · size ·
 * animation, #6019) — the page itself is the other way in.
 */
function ElementButtons({
  keys,
  onElement,
}: {
  keys: readonly HubElementKey[];
  onElement: (el: HubElementKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1" data-maker-element-buttons="">
      <span className="text-[13px] font-semibold text-ink">Part</span>
      <PickMenu
        label="Part"
        dataAttr="data-maker-element-pick"
        value={null}
        buttonText="Pick a part"
        options={keys.map((k) => ({ key: k, label: HUB_ELEMENT_LABEL[k] }))}
        onPick={(k) => onElement(k as HubElementKey)}
      />
    </div>
  );
}

function Inspector({
  selection,
  sceneTabs = null,
  contentBound = null,
  postEventTile = null,
  postEventPanel = null,
  fixedStylePanel = null,
  scene,
  scenePanel,
  rows,
  eventId,
  madeOnce,
  showMotionTabs,
  onClose,
  onReveal,
  onTab,
  onElement,
  fixedFact = null,
  ticketPanel = null,
  heroParts = HUB_HERO_ELEMENT_KEYS,
  resize,
}: {
  /** 🎫 The Guest's ticket scene's ONE control — Ticket style ▾ (the ticket itself is drawn on the page). */
  ticketPanel?: ReactNode;
  /** ✍ A fixed scene whose words are a Details fact (the story): that item's own editor. */
  fixedFact?: ReactNode;
  /** 🔤 The parts this hero draws (`heroPartsFor`) — its "Style a part" buttons. */
  heroParts?: readonly HubElementKey[];
  /** The tools column's width and its drag handle (desktop). */
  resize: ToolsResize;
  /** 🧰 The scene's Format · Animate · Arrange tabs, and what Content adds (its own words, its parts). */
  sceneTabs?: { format: ReactNode; animate: ReactNode; arrange: ReactNode; contentExtra: ReactNode; ownScene: boolean } | null;
  /** 🔗 A scene bound to a Details fact: its Content is this field, which asks
   *  "everywhere or just here" (`details-bound-field.tsx`). */
  contentBound?: ReactNode;
  /** 🔤 Open one element's sheet (font · colour · size · animation) — null where not offered. */
  onElement: ((el: HubElementKey) => void) | null;
  madeOnce: Partial<Record<MadeOnceKey, ReactNode>> | null;
  selection: NonNullable<MakerSelection>;
  /** 📖 The selected Post Event scene's tile (Maker Phase 8). */
  postEventTile?: PostEventTile | null;
  /** 🎞 The selected Post Event scene's own panel (`post-event-scene-panel.tsx`). */
  postEventPanel?: ReactNode;
  /** 🎨 A fixed part's Style row (the entourage and the day's own parts) — its Format, Style only. */
  fixedStylePanel?: ReactNode;
  scene: MakerScene | null;
  scenePanel: ReactNode;
  rows: Record<string, MakerRowPanel>;
  eventId: string;
  showMotionTabs: boolean;
  onClose: () => void;
  /** 📱 Bring what is edited into view above the half sheet (the canvas's own scroll). */
  onReveal?: () => void;
  onTab: (tab: MakerSceneTab) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  /* The old Transition tab (a saved address, a navigator chip) now opens Animate — answer 4, "fold it". */
  const asked: MakerSceneTab = selection.kind === 'scene' ? (selection.tab ?? 'format') : 'format';
  const tab: SceneTab = asked === 'transition' ? 'animate' : asked;

  /* A new tab starts at its top. */
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [selection, tab]);

  const title =
    selection.kind === 'scene'
      ? (scene?.label ?? 'Scene')
      : selection.kind === 'post-event'
        ? (postEventTile?.label ?? 'Post Event')
      : selection.kind === 'main'
        ? 'Music and backdrop'
        : selection.kind === 'tool'
          ? { logo: 'Logo', hero: 'Hero', reveal: 'Reveal', 'love-story': 'Love Story', 'post-event': 'Post Event', details: 'Event Details', 'rsvp-page': 'RSVP', 'rsvp-stage': 'RSVP' }[selection.key]
          : fixedOfKey(selection.key)
            ? fixedScenePanel(fixedOfKey(selection.key)!).label
            : (rows[selection.key]?.label ?? 'Edit');

  const tabs = SCENE_TABS.filter((t) => showMotionTabs || t.key !== 'animate');
  const contentRow = scene ? CONTENT_ROW_FOR_TYPE[scene.type] : undefined;

  let body: ReactNode = null;
  if (selection.kind === 'post-event') {
    /*
      📖 ONE POST EVENT SCENE (Phase 8 → owner 2026-09-25, "POST EVENT IS MANY
      SMALL SCENES"; 2026-09-29, "EVERY STYLE OF EVERY SCENE SHIPS"). Its own
      panel: Style · Shown · Order · its parts · what fills it. Every control
      saves to the DRAFT (`post-event-scene-panel.tsx`), built on the story's
      own keys, so the workroom and the Maker can never disagree about one
      fact — and nothing here sends the couple anywhere else.
    */
    const t = postEventTile;
    body = t ? (
      <>
        {postEventPanel}
        {(TOOL_ROWS['post-event'] ?? []).filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </>
    ) : (
      <p className="px-1 text-[13px] text-ink/70">This scene is not on this stage.</p>
    );
  } else if (selection.kind === 'scene') {
    body =
      tab === 'content' ? (
        /* The hero scene's words and photo ARE the one hero (Phase 6): made
           once, in the Hero workspace — not a second, live-writing copy. A
           couple's own scene's words, and every scene's parts, follow below
           (`sceneTabs.contentExtra`). */
        contentBound ? (
          contentBound
        ) : scene?.type === 'hero' && madeOnce?.hero ? (
          madeOnce.hero
        ) : contentRow && rows[contentRow] ? (
          <RowBlock row={rows[contentRow]!} />
        ) : sceneTabs?.ownScene ? null : (
          <p className="px-1 text-[13px] text-ink/70">
            This scene is written for you from your event — your guest list, your schedule and your replies —
            so there is nothing to type here.
          </p>
        )
      ) : sceneTabs ? (
        (sceneTabs[tab] ?? <p className="px-1 text-[13px] text-ink/70">This scene has no settings of its own.</p>)
      ) : (
        <>
          {scenePanel ?? <p className="px-1 text-[13px] text-ink/70">This scene has no settings of its own.</p>}
          {onElement && scene && !HUB_ELEMENT_EXCLUDED_WIDGETS.includes(scene.type) ? (
            <ElementButtons keys={HUB_SCENE_ELEMENT_KEYS} onElement={onElement} />
          ) : null}
        </>
      );
  } else if (selection.kind === 'row' && fixedOfKey(selection.key)) {
    /* 🔒 A FIXED SCENE'S PANEL (`lib/maker-selection.ts`) — never blank: what
       it is, its editor IN the panel when it has one (owner 2026-10-05: "each
       scene and setting must be there and not links"), or in one line where
       its content comes from; and for the names and date, its parts to style. */
    const fixed = fixedOfKey(selection.key)!;
    const f = fixedScenePanel(fixed);
    /* The editor it is made in, right here: the Reveal's controls, Post Event's
       rows. (The love story and the RSVP arrive as their Details fact, `fixedFact`.) */
    const toolHere: ReactNode =
      f.tool === 'reveal'
        ? (madeOnce?.reveal ?? null)
        : f.tool === 'post-event'
          ? (TOOL_ROWS['post-event'] ?? []).filter((k) => rows[k]).map((k) => <RowBlock key={k} row={rows[k]!} />)
          : null;
    body = (
      <section className="space-y-3 px-1" data-maker-fixed-panel={fixed}>
        {/* 🎨 Its Style first — the same one row every scene wears. */}
        {fixedStylePanel}
        {/* 🎫 The Guest's ticket: its Ticket style ▾ and nothing to read. */}
        {fixed === MAKER_FIXED_TICKET && ticketPanel ? ticketPanel : null}
        {fixedFact || toolHere || !f.line || (fixed === MAKER_FIXED_TICKET && ticketPanel) ? null : <p className="text-[13px] text-ink/75">{f.line}</p>}
        {fixedFact}
        {fixedFact ? null : toolHere}
        {/* Where its content comes from — SAID, never a link out of the Maker. */}
        {f.source && !(fixed === MAKER_FIXED_TICKET && ticketPanel) ? (
          <p className="text-[13px] text-ink/75" data-maker-fixed-source={fixed}>
            {f.source.text}
          </p>
        ) : null}
        {fixed === 'hero' && onElement ? <ElementButtons keys={heroParts} onElement={onElement} /> : null}
      </section>
    );
  } else if (selection.kind === 'main') {
    body = (
      <>
        {MAIN_ROWS.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </>
    );
  } else {
    /* Logo · Hero · Reveal · Love Story are items of Details (drawn by the shell); the
       inspector keeps only Post Event's tool and a workspace that did not load
       (the hero then falls back to its row). */
    const keys = selection.kind === 'tool' ? (TOOL_ROWS[selection.key] ?? []) : [selection.key];
    body = (
      <>
        {keys.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
        {keys.every((k) => !rows[k]) ? (
          <p className="px-1 text-[13px] text-ink/70">Nothing to set here for this event.</p>
        ) : null}
      </>
    );
  }

  /* ▁ THE HALF SHEET (PR-0, owner 2026-10-04): on a phone the scene's sheet rests
     at half the screen over a LIVE page — the scene in view above it, a tap on
     another scene switches it, a tap on nothing folds it to a slim bar, Peek
     hides it while held (`MakerHalfSheet`; its moves are the part sheet’s reducer, lib/element-sheet-state.ts). The
     desktop's panel beside the page is unchanged. */
  const sectionWord = selection.kind === 'scene' ? (tabs.find((t) => t.key === tab)?.label ?? null) : null;
  return (
    <MakerHalfSheet
      label="Inspector"
      title={title}
      target={makerSelectionKey(selection)}
      section={sectionWord}
      closeLabel="Close the inspector"
      onClose={onClose}
      onReveal={onReveal}
      style={{ ['--maker-tools-w' as string]: `${resize.width}px` }}
      desktopClassName="lg:relative lg:z-auto lg:order-3 lg:h-auto lg:w-[var(--maker-tools-w)] lg:shrink-0 lg:rounded-none"
      beforeGrip={<ToolsResizeHandle onPointerDown={resize.onPointerDown} />}
    >
      {selection.kind === 'scene' ? (
        /* 🧰 Format · Animate · Arrange · Content — the inspector's own tab row,
           their ONE home (never the top bar: "repeated. just place it on the sidebar"). */
        <InspectorTabs tabs={tabs} value={tab} onChange={onTab} label="Edit this scene" />
      ) : null}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6 pt-3">
        {body}
        {selection.kind === 'scene' && tab === 'content' ? sceneTabs?.contentExtra : null}
      </div>
    </MakerHalfSheet>
  );
}

/** ▁ One key per selected thing — a new key switches the half sheet to it (its tab is the sheet's section, not its target). */
function makerSelectionKey(selection: NonNullable<MakerSelection>): string {
  switch (selection.kind) {
    case 'scene':
      return `scene:${selection.id}`;
    case 'post-event':
      return `post-event:${selection.scene}`;
    case 'main':
      return 'main';
    default:
      return `${selection.kind}:${selection.key}`;
  }
}

/**
 * 🎞 SAVE THE DATE: FILM · PHOTOS (owner 2026-09-27, "Couple picks Film or
 * Photos"). One switch; the pick is kept on the gallery's row
 * (`config_json.std_lead`) through the draft like every other Maker edit, so
 * guests see it at Apply. Its own component: it is the only part of the
 * navigator that needs the router (to redraw after a draft save).
 */
function StdLeadSwitch({
  eventId,
  lead,
  draftAction,
}: {
  eventId: string;
  lead: 'film' | 'photos';
  draftAction: ElementDraftAction;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  /* ⚡ The pick is shown at once (owner 2026-09-29, "no slow response on the
     maker"); the server's `lead` takes over when its render lands, and a
     refused save puts it back. Never locked while a save is on its way. */
  const [picked, setPicked] = useState<'film' | 'photos' | null>(null);
  useEffect(() => setPicked(null), [lead]);
  const shown = picked ?? lead;
  const pick = async (next: 'film' | 'photos') => {
    if (next === shown) return;
    setPicked(next);
    setFailed(false);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ widgets: { our_photos: { std_lead: next } } }));
    const res = await makerSave(() => draftAction(eventId, fd), () => router.refresh()).catch(() => null);
    if (!res?.ok) {
      setPicked((p) => (p === next ? null : p));
      setFailed(true);
    }
  };
  return (
    <>
      <div role="radiogroup" aria-label="What opens your Save the Date" className="inline-flex rounded-full bg-white/70 p-0.5">
        {(['film', 'photos'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={shown === option}
            onClick={() => void pick(option)}
            className={`sn-press inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold transition-colors duration-sn-control ease-sn ${
              shown === option ? 'bg-ink text-cream' : 'text-ink/75 hover:text-ink'
            }`}
          >
            {option === 'film' ? 'Film' : 'Photos'}
          </button>
        ))}
      </div>
      {failed ? (
        <span role="alert" className="px-1 text-[11px] text-terracotta">That did not save. Try again.</span>
      ) : null}
    </>
  );
}
