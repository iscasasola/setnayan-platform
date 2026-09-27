'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Eye, EyeOff, Lock, Palette, PanelsTopLeft, PencilLine, QrCode, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { QrActions } from '@/app/_components/qr-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase, WidgetType } from '@/lib/invitation-widgets';
import { REVEAL_STAGE_CHOICES } from '@/lib/reveal-stages';
import type { RowStatus } from './rail-rows';
import { unlockLabel } from './unlock-label';
import {
  MAKER_MORE_ROWS_ID,
  useMaker,
  type MakerSceneTab,
  type MakerSelection,
} from '../../../launch/_components/maker-context';
import { MAKER_COMING_NEXT, MAKER_DETAILS_LABEL } from '../../../launch/_components/maker-bar';
import { MAKER_PLAY_SCENE_EVENT } from '../../../launch/_components/maker-play-menu';
import { HubDraftField, HubSavesImmediately } from '../../_components/hub-draft-field';
import { SceneTemplatePicker } from './scene-template-picker';
import { CanvasStaysOnThePage, MakerRefusesToBeFramed } from './maker-canvas-guard';
import { swapsForDrop, MAKER_FIXED_SOURCE, type MakerStageList } from '@/lib/maker-scene-list';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import type { MakerNavigatorData, SceneMini } from './maker-navigator-data';
import { ScenePreview } from './scene-preview';
import { ElementSheet, type ElementDraftAction, type ElementPalette, type ElementTarget } from './element-sheet';
import { DetailsBoundField } from './details-bound-field';
import { detailsFactOfScene, sceneBoundText, type DetailsFact } from '@/lib/details-bound';
import { isWordsScene, tapOpensWords } from '@/lib/maker-scene-words';
import { CanvasWordsContext, type CanvasWords } from './canvas-words';
import { NO_CANVAS_HOLD, canvasKeepsItsPage, heldCanvasFor, holdCanvas, type CanvasHold } from './element-preview';
import { BufferedCanvasFrame } from './buffered-canvas-frame';
import { PickMenu } from './pick-menu';
import { INSPECTOR_DEFAULT_W, ToolsResizeHandle, clampToolsWidth, type ToolsResize } from './tools-resize';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { canvasDocument, readTileHead, snapshotSection } from './scene-snapshot';
import type { TileHead, TileSnapshot } from '@/lib/maker-tile-preview';
import { navigatorRows, navigatorTabs, parseNavigatorBar, tabOfTile, type NavigatorBarItem } from '@/lib/maker-navigator-tabs';
import {
  canvasKeyOfSelection,
  fixedOfKey,
  fixedScenePanel,
  selectionForCanvasKey,
  selectionForTile,
  tileIsSelected,
} from '@/lib/maker-selection';
import {
  HUB_ELEMENT_EXCLUDED_WIDGETS,
  HUB_ELEMENT_LABEL,
  HUB_HERO_ELEMENT_KEYS,
  HUB_SCENE_ELEMENT_KEYS,
  isHubElementKey,
  type HubElementKey,
} from '@/lib/element-style';
import { MakerPage, MakerPageFrame, MakerPageSwitch as PageSwitch } from '../../../launch/_components/maker-page';
import { isMakerPageKey, makerPageCanvasSrc, type MakerPageKey } from '@/lib/maker-made-once-pages';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { InspectorTabs } from './inspector-kit';
import { SCENE_TABS, SceneAnimateTab, SceneArrangeTab, SceneLayoutRow, SceneParts, type SceneTab } from './scene-inspector';
import { SceneBackgroundRow } from './scene-background-row';

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
 * own (`launch/_components/maker-made-once.tsx`), handed in as `madeOnce`; and
 * Love Story's own page, the scrapbook (Phase 7). Each opens as a PAGE in the
 * Maker's body (`MakerPage`), never over it.
 */
export type MadeOnceKey = 'logo' | 'hero' | 'reveal' | 'love-story';

const TOOL_ROWS: Record<string, string[]> = {
  hero: ['hero'],
  reveal: ['save-the-date'],
  'love-story': ['story'],
  'post-event': ['editorial'],
};

// 'main-background' first: it replaces the theme's own loop, the layer every
// other Main control sits on (Maker Phase 10). Absent in the store shell.
const MAIN_ROWS = ['main-background', 'colors', 'music', 'backdrop'];

/** The canvas's "Event Bar" switch (was "Guest bars"), remembered for this browser session. */
const GUEST_BARS_KEY = 'setnayan:maker-guest-bars';
const MORE_ROWS = ['go-live', 'visibility', 'launch-phase', 'open-browse'];

export function MakerWork({
  eventId,
  publicLandingUrl,
  scenes,
  navigator,
  scenePanels,
  rows,
  themes,
  themeHref,
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
    videoChoice: { ref: string; url: string } | null;
    mediaHref: string;
    hubTheme: string;
    openBrowse: boolean;
    hideLocked: boolean;
    lookLock: ReactNode;
    /** Two people at the centre — the hero has a Joiner to style. */
    twoPeople: boolean;
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
  addScene?: { action: FormAction; returnTo: string } | { note: string } | null;
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
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  themeHref: string;
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [navWidth, setNavWidth] = useState(168);
  /* The tools column's width, beside the navigator's (owner 2026-09-27:
     "navigation is resizable, so does the editing tool on the right"). */
  const [toolsWidth, setToolsWidth] = useState(INSPECTOR_DEFAULT_W);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moreHost, setMoreHost] = useState<HTMLElement | null>(null);

  const stage = maker?.stage ?? 'rsvp';
  const selection = maker?.selection ?? null;
  const select = maker?.select;
  /* 🔤 The element being edited — a tap ON a part in the canvas. Its own sheet
     takes the inspector's place; choosing anything in the navigator closes it. */
  const [elementTarget, setElementTarget] = useState<ElementTarget | null>(null);
  const elementRef = useRef<ElementTarget | null>(null);
  elementRef.current = elementTarget;
  const elementEditingOn = Boolean(elementEditing);
  const selectionKey = canvasKeyOfSelection(selection, scenes);
  useEffect(() => {
    if (elementRef.current && elementRef.current.key !== selectionKey) setElementTarget(null);
  }, [selectionKey, stage]);

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
  useEffect(() => {
    const next = maker?.renderStamp ?? '';
    if (canvasKeepsItsPage(canvasHold.current, serverCanvasesRef.current ?? {}, Date.now())) return;
    canvasHold.current = NO_CANVAS_HOLD;
    setCanvasStamp(next);
  }, [maker?.renderStamp]);
  /** A write that is not an element choice: the next render reloads the canvas. */
  const releaseCanvas = () => {
    canvasHold.current = NO_CANVAS_HOLD;
  };
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
  useEffect(() => {
    if (seeded.current || !select) return;
    seeded.current = true;
    if (initialScene && scenes.some((s) => s.id === initialScene)) {
      select({ kind: 'scene', id: initialScene });
    } else if (initialOpenRow && rows[initialOpenRow]) {
      select(
        MAIN_ROWS.includes(initialOpenRow) ? { kind: 'main' } : { kind: 'row', key: initialOpenRow },
      );
    }
  }, [initialScene, initialOpenRow, scenes, rows, select]);

  useEffect(() => {
    setMoreHost(document.getElementById(MAKER_MORE_ROWS_ID));
  }, []);

  /* ── the preview ─────────────────────────────────────────────────────── */
  /* 🖼 The canvas is ONLY the page (`isEditorCanvas` on the guest page). The
     "Event Bar" switch at its lower right puts the GUEST header and tab bar
     back (`&bars=1`) so the couple can check nothing sits under them — never
     the host's own chrome. Owner 2026-09-25: *"add a switch to show or hide"*. */
  const [guestBars, setGuestBars] = useState(false);
  /* The made-once pages' own switches: Love Story's scrapbook ⇄ the story as
     guests meet it, and which chosen stage the Reveal page plays on. */
  const [storyGuestView, setStoryGuestView] = useState(false);
  const [revealPreview, setRevealPreview] = useState<LifecyclePhase | null>(null);
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
  const previewSrc = publicLandingUrl
    ? `${publicLandingUrl}?phase=${stage}&editor=1${guestBars ? '&bars=1' : ''}`
    : null;
  /* VIEW AS (toolbar) re-points the canvas at a role's own door; otherwise the
     host's editing preview, which shows the draft. */
  const canvasSrc = maker?.viewAsHref ?? previewSrc;
  const scrollPreviewTo = useCallback((anchor?: string) => {
    if (!anchor) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'setnayan-editor', t: 'scrollTo', key: anchor },
      window.location.origin,
    );
  }, []);

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
  const postWords = (key: string, text: string) =>
    frameRef.current?.contentWindow?.postMessage({ source: 'setnayan-editor', t: 'words', key, text }, window.location.origin);
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
        frameRef.current?.contentWindow?.postMessage(
          { source: 'setnayan-editor', t: 'markEl', key: data.key, el: null },
          window.location.origin,
        );
        return;
      }
      if (picked) {
        select?.(picked);
        const widgetType = data.key === 'f:hero' ? 'hero' : data.key.startsWith('w:') ? data.key.slice(2) : null;
        const el = data.el;
        setElementTarget((prev) =>
          isHubElementKey(el) && elementEditingOn && widgetType
            ? // The same part tapped again keeps the text selected in it (✍ runs).
              { key: data.key!, widgetType, el, range: prev && prev.key === data.key && prev.el === el ? prev.range : null }
            : null,
        );
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
        | { source?: string; t?: string; key?: string | null; el?: unknown; start?: unknown; end?: unknown; of?: unknown; text?: unknown }
        | null;
      if (!d || d.source !== 'setnayan-site' || d.t !== 'select') return;
      if (!d.key || !isHubElementKey(d.el) || !elementEditingOn) {
        setElementTarget((prev) => (prev ? { ...prev, range: null } : prev));
        return;
      }
      const key = d.key;
      const el = d.el;
      if (typeof d.start !== 'number' || typeof d.end !== 'number' || typeof d.of !== 'string' || typeof d.text !== 'string') return;
      const range = { start: d.start, end: d.end, of: d.of, text: d.text };
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
  }, [rows, scenes, select, elementEditingOn]);

  /* 🖼 THE TILES' PREVIEWS (owner 2026-09-26: *"the navigator preview must
     really show the preview"*). Each tile shows a static copy of its section
     out of this canvas (`lib/maker-tile-preview.ts`). They are re-taken
     whenever the canvas is new — it announces itself with `ready` after an
     edit, an Apply, a stage change or View as — and whenever it changes width
     (Desktop ⇄ Phone, a resized window). One pass reads every shown section
     once; `performance.measure('maker-tile-snapshots')` records its cost. */
  const [tileHead, setTileHead] = useState<TileHead | null>(null);
  const [tileSnaps, setTileSnaps] = useState<Record<string, TileSnapshot>>({});
  const [navList, setNavList] = useState<HTMLOListElement | null>(null);
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
      JSON.stringify([prev.htmlAttrs, prev.bodyAttrs]) === JSON.stringify([head.htmlAttrs, head.bodyAttrs])
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
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source && event.source === loadingCanvas.current) return;
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
  }, [scheduleSnapshots, stage, shownFrameKey, maker?.viewAsHref]);

  /* ▶ "Play this scene" (the toolbar's ▶ menu) — played IN PLACE in the
     canvas: the bridge replays the selected section's entrance where it sits. */
  useEffect(() => {
    const onPlay = () => {
      /* The Reveal's page IS the opening: playing it again is loading it again. */
      if (selection?.kind === 'tool' && selection.key === 'reveal') {
        try {
          frameRef.current?.contentWindow?.location.reload();
        } catch {
          /* a frame we cannot reach is left as it is */
        }
        return;
      }
      const key = canvasKeyOfSelection(selection, scenes);
      if (!key) return;
      frameRef.current?.contentWindow?.postMessage(
        { source: 'setnayan-editor', t: 'play', key },
        window.location.origin,
      );
    };
    window.addEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
    return () => window.removeEventListener(MAKER_PLAY_SCENE_EVENT, onPlay);
  }, [selection, scenes]);

  /* ── the one hidden form every navigator write goes through ────────────── */
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const back = (sceneId: string, rest?: string) => {
    const q = new URLSearchParams({ stage, scene: sceneId });
    if (rest) q.set('chain', rest);
    return `/dashboard/${eventId}/launch?${q.toString()}`;
  };
  const post = (
    which: 'toggle' | 'mode' | 'up' | 'down',
    fields: Record<string, string>,
  ) => {
    const form = formRef.current;
    if (!form || pending) return;
    releaseCanvas();
    for (const [name, val] of Object.entries(fields)) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = val;
    }
    setPending(true);
    /* A refused write redirects nowhere new; never leave the controls locked. */
    window.setTimeout(() => setPending(false), 10_000);
    (form.querySelector(`button[data-op="${which}"]`) as HTMLButtonElement | null)?.click();
  };

  const eyeWrite = (scene: MakerScene) => {
    const showing = sceneShowing(scene);
    if (showing && scene.mode === 'shown') {
      post('mode', { widget_id: scene.id, next_mode: 'hidden', return_to: back(scene.id, `vis.${scene.id}.0`) });
    } else if (!showing && scene.mode === 'hidden') {
      post('mode', { widget_id: scene.id, next_mode: 'auto', return_to: back(scene.id, `vis.${scene.id}.1`) });
    } else {
      post('toggle', {
        widget_id: scene.id,
        widget_type: scene.type,
        next_visible: scene.isVisible ? '0' : '1',
        return_to: back(scene.id),
      });
    }
  };

  const move = (id: string, delta: number) => {
    if (delta === 0) return;
    const dir = delta < 0 ? 'up' : 'down';
    const n = Math.abs(delta);
    post(dir, { widget_id: id, return_to: back(id, n > 1 ? `${dir}.${id}.${n - 1}` : undefined) });
  };

  /* The rest of a chain, fired once per arrival. */
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!chain || fired.current === chain) return;
    fired.current = chain;
    const [op, id, arg] = chain.split('.');
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !op) return;
    if (op === 'vis') {
      const want = arg === '1';
      if (scene.isVisible === want) return;
      post('toggle', { widget_id: id!, widget_type: scene.type, next_visible: want ? '1' : '0', return_to: back(id!) });
    } else if (op === 'up' || op === 'down') {
      const n = Number(arg);
      if (!Number.isFinite(n) || n < 1 || n > 40) return;
      post(op, { widget_id: id!, return_to: back(id!, n > 1 ? `${op}.${id}.${n - 1}` : undefined) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per chain value
  }, [chain]);

  /* A new server render means the write landed — unlock the controls. */
  useEffect(() => {
    setPending(false);
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
  const device = maker?.device ?? 'desktop';
  const selectedScene = selection?.kind === 'scene' ? scenes.find((s) => s.id === selection.id) ?? null : null;

  /* 🧭 THE STAGE'S LIST — the canvas's own order (`lib/maker-scene-list.ts`). */
  const { stageLists, fullOrders, minis, tint } = navigator;
  const list = stageLists[stage];
  /* ↕ The STAGE's whole list — what a move on this stage swaps in. */
  const fullOrder = fullOrders[stage];
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const shownSceneIds = list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
  /* "After the last scene on this stage" in the FULL order — the row that
     follows it (a hidden or off-stage one), or the end. */
  const lastShown = shownSceneIds[shownSceneIds.length - 1];
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
  const activeTab = tabs ? (tabs.find((t) => t.key === tabKey) ?? tabs.find((t) => !t.leaves) ?? null) : null;
  const selectedTabKey = tabs && selectedTile ? (tabOfTile(tabs, selectedTile.key)?.key ?? null) : null;
  /* A scene picked on the canvas may sit under another tab — follow it there. */
  useEffect(() => {
    if (selectedTabKey) setTabKey(selectedTabKey);
  }, [selectedTabKey]);

  /* 🧰 THE SCENE INSPECTOR'S TABS — Format · Animate · Arrange · Content
     (Keynote rebuild, 2026-09-27; approved prototype frame A). Built here, where
     the stage's list, the canvases, the canvas frame and the navigator's own
     draft form (`post` / `move` / `eyeWrite`) live; the Inspector only lays
     them out. The Transition tab is folded into Animate (owner, answer 4). */
  const canvasOf = (type: string): HubSectionCanvas =>
    heldCanvasFor(canvasHold.current, type, Date.now()) ?? elementEditing?.canvases[type] ?? {};
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
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
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
              ownsPro={ownsPro}
              mediaHref={sceneFormat.mediaHref}
              hubTheme={sceneFormat.hubTheme as never}
              onPreview={(message) => {
                /* ⚡ The background is on the canvas now; the save's reload confirms it. */
                releaseCanvas();
                postToCanvas(message);
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
          lookLock={sceneFormat?.lookLock}
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
          onMode={(m) => post('mode', { widget_id: id, next_mode: m, return_to: back(id) })}
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
            <SceneParts
              keys={partsKeys}
              onElement={openPart}
              proMark={sceneFormat?.hideLocked && !ownsPro ? null : ownsPro ? 'unlocked' : 'locked'}
            />
          ) : null}
        </>
      ),
    };
  })();
  /** 🔤 The part sheet's Part ▾: this scene's parts (the hero's has a Joiner only for two people). */
  const heroParts = HUB_HERO_ELEMENT_KEYS.filter((k) => k !== 'joiner' || sceneFormat?.twoPeople !== false);
  /* 🧭 EVERY scene of the stage, in canvas order, the tabs as headers between
     the groups (`navigatorRows`) — never a tab that hides the rest. */
  const navRows = navigatorRows(tabs, list.shown.map((t) => t.key));
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

  /* ══ A MADE-ONCE ITEM IS A PAGE ══════════════════════════════════════════
     Owner 2026-09-25: *"we do not want a pop up for details, logo, hero, reveal
     and love story. we want their actual page to be on the body of the editor
     similar to the different stages."* Picking one swaps the navigator, canvas
     and inspector for that item's own page (`MakerPage`); its controls sit
     where the inspector sits. Details is the shell's (it is built by the
     launch page), the other four are here. */
  const pageKey = madeOncePageKey(selection, madeOnce);
  const revealStage = revealPreview && revealStages.includes(revealPreview) ? revealPreview : (revealStages[0] ?? null);
  const pageSrc = pageKey
    ? makerPageCanvasSrc(publicLandingUrl, pageKey, stage, { guestView: storyGuestView, revealStage })
    : null;
  const pageFrameKey = `${pageKey}:${pageSrc}:${maker.renderStamp}`;
  const pageFrame = (title: string) =>
    pageSrc && publicLandingUrl ? (
      <>
        <MakerPageFrame src={pageSrc} title={title} device={device} frameKey={pageFrameKey} frameRef={frameRef} />
        <CanvasStaysOnThePage
          frameRef={frameRef}
          pagePath={publicLandingUrl}
          resetKey={pageFrameKey}
          stageLabel={title}
          onBack={() => {
            const f = frameRef.current;
            const src = f?.getAttribute('src');
            if (f && src) f.src = src;
          }}
        />
      </>
    ) : (
      <p className="m-auto max-w-sm px-4 text-center text-sm text-ink/70" data-maker-page-no-address="">
        Set your Event Hub address in {MAKER_DETAILS_LABEL} to see your page here.
      </p>
    );
  const pageView = pageKey ? (
    <MakerPage
      pageKey={pageKey}
      page={
        pageKey === 'logo' ? (
          madeOnce?.logo
        ) : pageKey === 'love-story' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <PageSwitch
              label="Show your Love Story"
              value={storyGuestView ? 'guests' : 'yours'}
              onChange={(v) => setStoryGuestView(v === 'guests')}
              options={[
                ['yours', 'Your story'],
                ['guests', 'As guests see it'],
              ]}
            />
            {storyGuestView || !madeOnce?.['love-story'] ? (
              pageFrame(`Your Love Story on ${PUBLIC_STAGE_LABELS.rsvp}`)
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6" data-maker-love-story-book="">
                {madeOnce['love-story']}
              </div>
            )}
          </div>
        ) : pageKey === 'reveal' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {revealStages.length > 1 ? (
              <PageSwitch
                label="Play it on"
                value={revealStage ?? 'save_the_date'}
                onChange={(v) => setRevealPreview(v as LifecyclePhase)}
                options={REVEAL_STAGE_CHOICES.filter((s) => revealStages.includes(s)).map((s) => [s, PUBLIC_STAGE_LABELS[s]] as const)}
              />
            ) : null}
            {pageFrame(`Your reveal — ${PUBLIC_STAGE_LABELS[revealStage ?? 'save_the_date']}`)}
          </div>
        ) : (
          pageFrame(`Your hero — ${PUBLIC_STAGE_LABELS[stage === 'rsvp' || stage === 'event' ? stage : 'rsvp']}`)
        )
      }
      controls={
        pageKey === 'logo' ? null : pageKey === 'love-story' ? (
          <LoveStoryControls rows={rows} />
        ) : pageKey === 'hero' ? (
          /* ONE SCENE — the hero (owner 2026-09-25: "hero is a 1 scene page that
             create a scene for your hero"): its photo or card, and — once the
             Main background ships (Maker P10, `main-background`, stored on the
             hero row) — the clip or photo behind every scene, made here. */
          <>
            {madeOnce?.hero}
            {rows['main-background'] ? <RowBlock row={rows['main-background']} /> : null}
          </>
        ) : (
          madeOnce?.[pageKey]
        )
      }
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* 🪞 The Maker never draws inside a frame of itself. */}
      <MakerRefusesToBeFramed />
      {/* No navigator under a made-once page (owner 2026-09-25: *"logo and hero
          and reveal and love story has no navigation since it is just full
          create your logo"*) — and none under Details, which the shell draws
          over this area: the navigator belongs to the four stages only. */}
      {pageView ?? (selection?.kind === 'tool' && isShellPage(selection.key) ? null : <>
      {/* ══ 2 · THE NAVIGATOR ══ */}
      <nav
        aria-label="Scenes"
        style={{ ['--maker-nav-w' as string]: `${navWidth}px` }}
        className={`relative order-2 shrink-0 bg-cream/80 lg:order-1 lg:w-[var(--maker-nav-w)] ${
          navOpen ? '' : 'lg:hidden'
        }`}
      >
        {/* 🧭 THE DESKTOP COLUMN NEVER SCROLLS SIDEWAYS (owner's page, 2026-09-27:
            after "Edit Our love story" the column slid left and clipped every
            label). The cause was measured, not guessed: each closed ⓘ bubble is
            an 18rem box, so a 168px column held 314px of scrollable width, and
            `overflow-x: hidden` still lets focus and scrollIntoView scroll it.
            The bubbles are held to the column's own width here. */}
        <ol ref={setNavList} className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:py-4 lg:[&_.sn-tip]:max-w-[calc(var(--maker-nav-w)-2rem)]">
          {/* 🧭 THE STAGE'S MENU — the tabs a guest sees on this stage, never a
              generic "Main". Each lists its own scenes; a tab that opens a page of
              its own (Camera, Join, Watch) says so. The look behind every scene
              (theme, colours, music, backdrop) is the palette button. */}
          {/* 🧭 THE STAGE'S MENU AS ONE CONTROL (owner 2026-09-27, on the pill row
              that wrapped to 140px in the 168px column: *"this should be a tap
              to show option to pick or a drop down"*). It shows the group in
              view ("Home ▾"); picking a tab JUMPS the navigator and the canvas to
              that group — never a filter, never a stage change. One line at the
              narrowest column, the palette beside it. */}
          <li className="flex min-w-0 shrink-0 items-center gap-1 self-center lg:mb-3 lg:self-stretch" data-maker-tabs="">
            {tabs ? (
              <PickMenu
                label="This stage's menu"
                dataAttr="data-maker-tab-pick"
                value={activeTab?.key ?? null}
                options={tabs.map((t) => ({
                  key: t.key,
                  label: t.label,
                  ...(t.leaves ? { disabledNote: 'opens its own page' } : {}),
                }))}
                onPick={(key) => {
                  const t = tabs.find((x) => x.key === key);
                  if (!t || t.leaves) return;
                  setTabKey(t.key);
                  scrollPreviewTo(t.key);
                  navList
                    ?.querySelector(`[data-maker-group="${CSS.escape(t.key)}"]`)
                    ?.scrollIntoView({ block: 'start', inline: 'start', behavior: 'smooth' });
                }}
                className="flex-1"
              />
            ) : null}
            <button
              type="button"
              onClick={() => select?.({ kind: 'main' })}
              aria-pressed={selection?.kind === 'main'}
              aria-label="Theme, colours and music — behind every scene"
              title="Theme, colours and music — behind every scene"
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
          {activeTab?.leaves ? (
            <li className="shrink-0 self-center px-2 text-[11.5px] text-ink/65 lg:self-stretch" data-maker-tab-leaves="">
              <InfoTip className="min-w-0 max-w-full" label={`${activeTab.label} opens its own page`} align="start">
                On this stage, “{activeTab.label}” takes a guest to a page of its own, so there are no scenes to arrange
                here. Pick another tab to see its scenes.
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
                        device === 'phone' ? 'aspect-[9/19.5] w-16 lg:w-[46%]' : 'aspect-[16/10] w-28 lg:w-full'
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
                      data-maker-scene={tile.kind === 'scene' ? tile.type : undefined}
                      data-maker-fixed={tile.kind === 'fixed' ? tile.fixed : undefined}
                      data-maker-post-event={tile.kind === 'post-event' ? tile.scene : undefined}
                      data-maker-status={tile.kind === 'post-event' ? (tile.hidden ? 'hidden' : tile.status) : undefined}
                      aria-pressed={on}
                      aria-label={
                        tile.kind === 'post-event'
                          ? postEventTileLabel(tile)
                          : `${tile.label}${tile.kind === 'fixed' ? (MAKER_FIXED_SOURCE[tile.fixed] ? ' (always here on this stage · comes from your guest list)' : ' (always here on this stage)') : showing ? '' : ' (hidden from guests)'}`
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
                        {MAKER_FIXED_SOURCE[tile.fixed] ? (
                          <span className="mt-1.5 block">
                            {MAKER_FIXED_SOURCE[tile.fixed]!.text}{' '}
                            <Link
                              href={`/dashboard/${eventId}/${MAKER_FIXED_SOURCE[tile.fixed]!.page}`}
                              className="font-semibold underline underline-offset-2"
                            >
                              {MAKER_FIXED_SOURCE[tile.fixed]!.link} →
                            </Link>
                          </span>
                        ) : null}
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
            {addScene && 'action' in addScene ? (
              /* 🎬 "+" opens the 25 templates, headed with the stage being
                 edited and drawn in the view being edited (owner 2026-09-24). */
              <div className="pl-4">
                <SceneTemplatePicker
                  overlay
                  action={addScene.action}
                  hidden={{ event_id: eventId, return_to: addScene.returnTo }}
                  stageLabel={stage === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS.rsvp}` : PUBLIC_STAGE_LABELS[stage]}
                  heading="Add a scene to"
                  triggerLabel="+ Add a scene"
                  initialView={maker?.device === 'phone' ? 'phone' : 'desktop'}
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

      {/* ══ 3 · THE CANVAS — the real page, one stage at a time ══ */}
      {/* A labelled <section>, not a second <main>: the event layout owns the
          one landmark (`couple-screens-keep-the-shell.test.ts`). */}
      <section
        aria-label="Preview"
        data-maker-stage={stage}
        className="relative order-1 flex min-h-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-2 pb-2 pt-2 lg:order-2 lg:px-6 lg:pb-5 lg:pt-4"
      >
        {canvasSrc ? (
          /* 🪞 Double-buffered (`buffered-canvas-frame.tsx`): a new render loads
             behind the page the couple is looking at and swaps in when ready —
             no blank screen, no reload from the top, after any Maker write. */
          <BufferedCanvasFrame
            frameKey={`${stage}:${canvasStamp}:${maker.viewAsHref ?? ''}`}
            group={`${stage}:${maker.viewAsHref ?? ''}`}
            src={canvasSrc}
            title={`Your Event Hub — ${PUBLIC_STAGE_LABELS[stage]}`}
            frameRef={frameRef}
            loadingRef={loadingCanvas}
            anchorKey={() => selectedKeyRef.current}
            onShown={setShownFrameKey}
            onSwapped={onCanvasSwapped}
            className={`min-h-0 w-full flex-1 rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] transition-[max-width] duration-sn-elem ease-sn ${
              device === 'phone' ? 'max-w-[430px]' : 'max-w-none'
            }`}
          />
        ) : (
          <p className="max-w-sm text-center text-sm text-ink/70">
            Set your Event Hub address (⋯ in the toolbar) to see your page here.
          </p>
        )}
        {/* 🖼 "Event Bar" (owner 2026-09-26: *"rename it to Event Bar"*) — the
            stage's OWN guest header and tab bar over the slide in view. The lower
            right of the canvas, BELOW the page and
            never over it. */}
        {publicLandingUrl ? (
          <div className="flex w-full shrink-0 items-center justify-end gap-1 pt-1.5">
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
            <InfoTip label="Event Bar" align="end" labelClassName="text-[12px] font-semibold text-ink/70">
              See this stage&rsquo;s own top and bottom bars, as guests see them, over the slide you are editing.
            </InfoTip>
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

      {/* ══ 4 · THE INSPECTOR — only when something is selected ══ */}
      {elementTarget && elementEditing ? (
        <ElementSheet
          eventId={eventId}
          target={elementTarget}
          canvas={
            heldCanvasFor(canvasHold.current, elementTarget.widgetType, Date.now()) ??
            elementEditing.canvases[elementTarget.widgetType] ??
            {}
          }
          palette={elementEditing.palette}
          ownsPro={ownsPro}
          draftAction={elementEditing.draftAction}
          resize={toolsResize}
          parts={elementTarget.widgetType === 'hero' ? heroParts : HUB_SCENE_ELEMENT_KEYS}
          onPart={(el) => {
            frameRef.current?.contentWindow?.postMessage(
              { source: 'setnayan-editor', t: 'markEl', key: elementTarget.key, el },
              window.location.origin,
            );
            setElementTarget({ key: elementTarget.key, widgetType: elementTarget.widgetType, el });
          }}
          sceneLabel={
            elementTarget.widgetType === 'hero' ? 'Names & date' : (scenes.find((sc) => sc.type === elementTarget.widgetType)?.label ?? undefined)
          }
          onOpenHero={elementTarget.widgetType === 'hero' ? () => select?.({ kind: 'tool', key: 'hero' }) : undefined}
          usedColours={usedColours}
          onPreview={(message) => {
            frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
            // The navigator's tiles are pictures of the canvas — re-take them.
            scheduleSnapshots(600);
          }}
          onSaving={(widgetType, canvas) => {
            canvasHold.current = holdCanvas(canvasHold.current, elementEditing.canvases, widgetType, canvas, Date.now());
          }}
          onPlay={() =>
            frameRef.current?.contentWindow?.postMessage(
              { source: 'setnayan-editor', t: 'playEl', key: elementTarget.key, el: elementTarget.el },
              window.location.origin,
            )
          }
          onClose={() => {
            frameRef.current?.contentWindow?.postMessage(
              { source: 'setnayan-editor', t: 'markEl', key: elementTarget.key, el: null },
              window.location.origin,
            );
            setElementTarget(null);
          }}
        />
      ) : selection ? (
        <CanvasWordsContext.Provider value={canvasWords}>
        <Inspector
          selection={selection}
          contentBound={(() => {
            if (!selectedScene || !elementEditing || !detailsBound) return null;
            if (detailsBound.ownWords.includes(selectedScene.type)) return null;
            const sceneCanvas = elementEditing.canvases[selectedScene.type] ?? {};
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
                  if (choice === 'use-details' || text.trim().length === 0) {
                    releaseCanvas();
                    return;
                  }
                  const type = selectedScene.type;
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
                  const shown = heldCanvasFor(canvasHold.current, type, now) ?? elementEditing.canvases[type] ?? {};
                  canvasHold.current = holdCanvas(
                    canvasHold.current,
                    elementEditing.canvases,
                    type,
                    patch.widgets?.[type as WidgetType]?.canvas ?? shown,
                    now,
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
          postEventWrittenAt={navigator.postEvent && navigator.postEvent !== 'unreadable' ? navigator.postEvent.generatedAt : null}
          scene={selectedScene}
          scenePanel={selectedScene ? scenePanels[selectedScene.id] : null}
          sceneTabs={sceneTabs}
          rows={rows}
          themes={themes}
          themeHref={themeHref}
          eventId={eventId}
          madeOnce={madeOnce}
          showMotionTabs={ownsPro || !maker.storeShell}
          onClose={() => select?.(null)}
          onTab={(tab) => selectedScene && select?.({ kind: 'scene', id: selectedScene.id, tab })}
          onOpenTool={(key) => select?.({ kind: 'tool', key })}
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
      </>)}

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
function isShellPage(key: string): key is 'details' | 'rsvp-page' {
  return key === 'details' || key === 'rsvp-page';
}

function madeOncePageKey(
  selection: MakerSelection,
  madeOnce: Partial<Record<MadeOnceKey, ReactNode>> | null,
): Exclude<MakerPageKey, 'details' | 'rsvp-page'> | null {
  if (selection?.kind !== 'tool' || !isMakerPageKey(selection.key) || isShellPage(selection.key)) return null;
  if (selection.key === 'love-story') return 'love-story';
  return madeOnce?.[selection.key] ? selection.key : null;
}


/** Love Story's controls, beside its page: the page's five chapters, each with
 *  its moments and its questions (the Story row, with its own bound action —
 *  `our-story/_components/love-story-chapters-panel.tsx`). */
function LoveStoryControls({ rows }: { rows: Record<string, MakerRowPanel> }) {
  const keys = (TOOL_ROWS['love-story'] ?? []).filter((k) => rows[k]);
  return (
    <section className="flex flex-col gap-3" data-made-once="love-story">
      <p className="px-1 text-[13.5px] text-ink/75">
        <InfoTip label="The same chapters as your page." ariaLabel="About your chapters" align="start">
          Each moment is a scene on your {PUBLIC_STAGE_LABELS.rsvp}. Tap one to edit it on the page. A year is enough, and
          five stories in your words are free. The answers under each chapter feed your story&rsquo;s paragraph.
        </InfoTip>
      </p>
      {keys.map((k) => (
        <RowBlock key={k} row={rows[k]!} />
      ))}
    </section>
  );
}

/* ── 📖 POST EVENT TILES (Maker Phase 8) ─────────────────────────────────── */
type PostEventTile = Extract<MakerStageList['shown'][number], { kind: 'post-event' }>;

/** The one word on the tile — what filled it, or why guests do not meet it. */
function postEventStatusWord(tile: PostEventTile): string {
  if (tile.status === 'skipped') return 'Skipped';
  if (tile.status === 'optional') return 'Optional';
  if (tile.hidden) return 'Hidden';
  return 'Auto';
}

function postEventTileLabel(tile: PostEventTile): string {
  if (tile.status === 'skipped') return `${tile.label} (skipped — ${tile.note ?? 'nothing to show yet'})`;
  if (tile.status === 'optional') return `${tile.label} (optional — ${tile.note ?? 'not chosen'})`;
  if (tile.hidden) return `${tile.label} (hidden from guests)`;
  return `${tile.label} (written for you)`;
}

/** The ⓘ under the tile: the template, and what filled it or why it is skipped. */
function postEventTileNote(tile: PostEventTile): string {
  const tpl = tile.template ? `${tile.template} · ${SCENE_TEMPLATES[tile.template]?.name ?? ''}` : 'Its own part of the page';
  const what = tile.status === 'auto' ? `Filled from: ${tile.source}` : (tile.note ?? '');
  const open = tile.open ? ' A tap opens it full screen; Back returns to the same place.' : '';
  return `${tpl}. ${what}.${open}`;
}



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
 * umbrella unlock — one CTA for all ten Pro items (`WEBSITE_PRO_ITEMS`) — shown
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
            <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} text="Event Hub Pro" size="md" tone="current" />
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
 * 🔤 THE SCENE'S PARTS, EACH A BUTTON — the same element sheet a tap on the
 * part in the canvas opens (font · colour · size · animation, #6019).
 */
function ElementButtons({
  keys,
  onElement,
}: {
  keys: readonly HubElementKey[];
  onElement: (el: HubElementKey) => void;
}) {
  return (
    <div className="px-1 pt-1" data-maker-element-buttons="">
      <p className="text-[12px] font-semibold text-ink/60">
        <InfoTip label="Style a part" align="start">
          Its own font, colour, size and animation — or tap the part on the page.
        </InfoTip>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            data-maker-element={k}
            onClick={() => onElement(k)}
            className="sn-press inline-flex min-h-10 items-center rounded-full bg-ink/5 px-3.5 text-[13px] font-semibold text-ink/80 transition-colors duration-300 ease-in-out hover:bg-ink/10"
          >
            {HUB_ELEMENT_LABEL[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Inspector({
  selection,
  sceneTabs = null,
  contentBound = null,
  postEventTile = null,
  postEventWrittenAt = null,
  scene,
  scenePanel,
  rows,
  themes,
  themeHref,
  eventId,
  madeOnce,
  showMotionTabs,
  onClose,
  onTab,
  onOpenTool,
  onElement,
  resize,
}: {
  /** The tools column's width and its drag handle (desktop). */
  resize: ToolsResize;
  /** 🧰 The scene's Format · Animate · Arrange tabs, and what Content adds (its own words, its parts). */
  sceneTabs?: { format: ReactNode; animate: ReactNode; arrange: ReactNode; contentExtra: ReactNode; ownScene: boolean } | null;
  /** 🔗 A scene bound to a Details fact: its Content is this field, which asks
   *  "everywhere or just here" (`details-bound-field.tsx`). */
  contentBound?: ReactNode;
  /** Open a fixed scene's workspace (Hero, Reveal, Love Story, Post Event). */
  onOpenTool: (key: 'hero' | 'reveal' | 'love-story' | 'post-event' | 'rsvp-page') => void;
  /** 🔤 Open one element's sheet (font · colour · size · animation) — null where not offered. */
  onElement: ((el: HubElementKey) => void) | null;
  madeOnce: Partial<Record<MadeOnceKey, ReactNode>> | null;
  selection: NonNullable<MakerSelection>;
  /** 📖 The selected Post Event scene's tile (Maker Phase 8). */
  postEventTile?: PostEventTile | null;
  /** When the story was written — shown as the scene's "Auto · written …". */
  postEventWrittenAt?: string | null;
  scene: MakerScene | null;
  scenePanel: ReactNode;
  rows: Record<string, MakerRowPanel>;
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  themeHref: string;
  eventId: string;
  showMotionTabs: boolean;
  onClose: () => void;
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
        ? 'Main · behind every scene'
        : selection.kind === 'tool'
          ? { logo: 'Logo', hero: 'Hero', reveal: 'Reveal', 'love-story': 'Love Story', 'post-event': 'Post Event', prints: 'Prints & Tickets', details: 'Details', 'rsvp-page': 'RSVP' }[selection.key]
          : fixedOfKey(selection.key)
            ? fixedScenePanel(fixedOfKey(selection.key)!).label
            : (rows[selection.key]?.label ?? 'Edit');

  const tabs = SCENE_TABS.filter((t) => showMotionTabs || t.key !== 'animate');
  const contentRow = scene ? CONTENT_ROW_FOR_TYPE[scene.type] : undefined;

  let body: ReactNode = null;
  if (selection.kind === 'post-event') {
    /*
      📖 A SCENE THE MAKER WROTE (Phase 8). It says what it is, what filled it
      — or why it is skipped — and where it is changed. Showing, hiding and
      the order of these scenes live in the story workroom until that desk
      moves into the Maker (the story's `sections` / `sectionOrder` are the one
      source for both, so the two can never disagree).
    */
    const t = postEventTile;
    body = t ? (
      <section className="space-y-3 px-1" data-maker-post-event-panel={t.scene}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/60">
          {postEventStatusWord(t)}
          {t.status === 'auto' && postEventWrittenAt
            ? ` · written ${new Date(postEventWrittenAt).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
            : ''}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-ink/60">Template</dt>
          <dd className="text-ink">
            {t.template ? `${t.template} · ${SCENE_TEMPLATES[t.template]?.name ?? ''}` : 'Its own part of the page'}
          </dd>
          <dt className="text-ink/60">{t.status === 'auto' ? 'Filled from' : 'Why'}</dt>
          <dd className="text-ink">{t.status === 'auto' ? t.source : t.note}</dd>
          {t.open ? (
            <>
              <dt className="text-ink/60">On the page</dt>
              <dd className="text-ink">A preview in the flow; a tap opens it full screen, and Back returns to it.</dd>
            </>
          ) : null}
          {t.pinned ? (
            <>
              <dt className="text-ink/60">Place</dt>
              <dd className="text-ink">Fixed — the story always {t.scene === 'cover' ? 'opens' : 'closes'} here.</dd>
            </>
          ) : null}
        </dl>
        {t.status === 'skipped' ? (
          <p className="text-[13px] text-ink/70">
            Nothing is shown to guests here — never an empty box. It appears on its own when something arrives.
          </p>
        ) : null}
        <Link
          href={`/dashboard/${eventId}/story`}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          Show, hide or reorder in your story workroom
          <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
        {(TOOL_ROWS['post-event'] ?? []).filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </section>
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
       it is, its workspace as a button when it has one, or in one line where
       its content comes from; and for the names and date, its parts to style. */
    const fixed = fixedOfKey(selection.key)!;
    const f = fixedScenePanel(fixed);
    body = (
      <section className="space-y-3 px-1" data-maker-fixed-panel={fixed}>
        <p className="text-[13px] text-ink/75">{f.line}</p>
        {f.tool && f.button ? (
          <button
            type="button"
            data-maker-open-editor={f.tool}
            onClick={() => onOpenTool(f.tool!)}
            className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-cream transition-colors duration-300 ease-in-out hover:bg-ink/90"
          >
            <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} />
            {f.button}
          </button>
        ) : null}
        {f.source ? (
          <p className="text-[13px] text-ink/75">
            {f.source.text}{' '}
            <Link href={`/dashboard/${eventId}/${f.source.page}`} className="font-semibold underline underline-offset-2">
              {f.source.link} →
            </Link>
          </p>
        ) : null}
        {fixed === 'hero' && onElement ? <ElementButtons keys={HUB_HERO_ELEMENT_KEYS} onElement={onElement} /> : null}
      </section>
    );
  } else if (selection.kind === 'main') {
    body = (
      <>
        <ThemePanel themes={themes} href={themeHref} />
        {MAIN_ROWS.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
      </>
    );
  } else {
    /* Logo · Hero · Reveal · Love Story open as PAGES (`madeOncePageKey`); the
       inspector keeps only Post Event's tool and a workspace that did not load
       (the hero then falls back to its row). */
    const keys = selection.kind === 'tool' ? (TOOL_ROWS[selection.key] ?? []) : [selection.key];
    const note =
      selection.kind === 'tool' && selection.key === 'hero'
        ? MAKER_COMING_NEXT[selection.key]
        : null;
    body = (
      <>
        {keys.filter((k) => rows[k]).map((k) => (
          <RowBlock key={k} row={rows[k]!} />
        ))}
        {keys.every((k) => !rows[k]) ? (
          <p className="px-1 text-[13px] text-ink/70">Nothing to set here for this event.</p>
        ) : null}
        {note ? (
          <p className="px-1 text-[12px] text-ink/60">
            <InfoTip label="Coming next" align="start">
              {note}
            </InfoTip>
          </p>
        ) : null}
      </>
    );
  }

  return (
    <aside
      aria-label="Inspector"
      style={{ ['--maker-tools-w' as string]: `${resize.width}px` }}
      className="sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col rounded-t-3xl lg:relative lg:z-auto lg:order-3 lg:max-h-none lg:w-[var(--maker-tools-w)] lg:shrink-0 lg:rounded-none"
    >
      <ToolsResizeHandle onPointerDown={resize.onPointerDown} />
      <div className="flex items-center gap-2 px-4 pt-3">
        <p className="min-w-0 flex-1 truncate font-serif text-lg text-ink">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the inspector"
          className="sn-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      {selection.kind === 'scene' ? (
        /* 🧰 Format · Animate · Arrange · Content — the inspector's own tab row,
           their ONE home (never the top bar: "repeated. just place it on the sidebar"). */
        <InspectorTabs tabs={tabs} value={tab} onChange={onTab} label="Edit this scene" />
      ) : null}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6 pt-3">
        {body}
        {selection.kind === 'scene' && tab === 'content' ? sceneTabs?.contentExtra : null}
      </div>
    </aside>
  );
}

/**
 * THE THEME PANEL — a placeholder that reads the theme registry as it stands.
 * The whole-hub picker (ten themes) is Phase 3's; until it lands this names the
 * themes that ship, marks the couple's, and opens the picker that already
 * writes `events.invite_theme`.
 */
function ThemePanel({
  themes,
  href,
}: {
  themes: Array<{ id: string; name: string; ready: boolean; current: boolean }>;
  href: string;
}) {
  const ready = themes.filter((t) => t.ready);
  return (
    <section className="rounded-md bg-white/70 px-3 py-3" data-maker-theme-panel="">
      <p className="text-[14px] font-semibold text-ink">Theme</p>
      <p className="mt-0.5 text-[12.5px] text-ink/65">Pick a theme and the whole Event Hub is dressed.</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {ready.map((t) => (
          <li
            key={t.id}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
              t.current ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/75'
            }`}
          >
            {t.name}
            {t.current ? ' · yours' : ''}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="sn-press mt-3 inline-flex min-h-10 items-center gap-1 rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink hover:bg-ink/10"
      >
        Choose your theme
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
      {/* `events.invite_theme` is painted by the guest layout, which cannot see
          the host's draft — so the picker writes live, and says so here. */}
      <HubSavesImmediately className="ml-2" />
      <p className="mt-2 text-[12px] text-ink/60">
        <InfoTip label="Coming next" align="start">
          All ten themes, each dressing every stage at once, arrive in the next build.
        </InfoTip>
      </p>
    </section>
  );
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
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pick = async (next: 'film' | 'photos') => {
    if (busy || next === lead) return;
    setBusy(true);
    setFailed(false);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ widgets: { our_photos: { std_lead: next } } }));
    const res = await draftAction(eventId, fd).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else setFailed(true);
  };
  return (
    <>
      <div role="radiogroup" aria-label="What opens your Save the Date" className="inline-flex rounded-full bg-white/70 p-0.5">
        {(['film', 'photos'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={lead === option}
            disabled={busy}
            onClick={() => void pick(option)}
            className={`sn-press inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold transition-colors duration-sn-control ease-sn ${
              lead === option ? 'bg-ink text-cream' : 'text-ink/75 hover:text-ink'
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
