'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Eye, EyeOff, Lock, Palette, PanelsTopLeft, PencilLine, QrCode, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { QrActions } from '@/app/_components/qr-actions';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
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
import { swapsForDrop, MAKER_FIXED_TOOL, MAKER_FIXED_SOURCE, type MakerFixedKey, type MakerStageList } from '@/lib/maker-scene-list';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import type { MakerNavigatorData, SceneMini } from './maker-navigator-data';
import { ScenePreview } from './scene-preview';
import { canvasDocument, readTileHead, snapshotSection } from './scene-snapshot';
import type { TileHead, TileSnapshot } from '@/lib/maker-tile-preview';
import { navigatorTabs, parseNavigatorBar, tabOfTile, type NavigatorBarItem } from '@/lib/maker-navigator-tabs';
import { MakerPage, MakerPageFrame } from '../../../launch/_components/maker-page';
import { isMakerPageKey, makerPageCanvasSrc, type MakerPageKey } from '@/lib/maker-made-once-pages';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';

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
}: {
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moreHost, setMoreHost] = useState<HTMLElement | null>(null);

  const stage = maker?.stage ?? 'rsvp';
  const selection = maker?.selection ?? null;
  const select = maker?.select;

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

  /* Preview → inspector: a section tapped on the page opens its panel. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-site' || data.t !== 'edit' || typeof data.key !== 'string') return;
      /* 🧭 A section tapped on the canvas selects its navigator tile. */
      if (data.key.startsWith('w:')) {
        const type = data.key.slice(2);
        const scene = scenes.find((s) => s.type === type);
        if (scene) select?.({ kind: 'scene', id: scene.id });
        return;
      }
      if (data.key.startsWith('p:')) {
        select?.({ kind: 'post-event', scene: data.key.slice(2) });
        return;
      }
      if (data.key.startsWith('f:')) {
        const tool = FIXED_TOOL[data.key.slice(2) as MakerFixedKey];
        if (tool) select?.({ kind: 'tool', key: tool });
        return;
      }
      const match = Object.entries(rows).find(([, r]) => r.anchor === data.key);
      if (match) select?.({ kind: 'row', key: match[0] });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [rows, scenes, select]);

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
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
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
  }, [scheduleSnapshots, stage, maker?.renderStamp, maker?.viewAsHref]);

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
      const key =
        selection?.kind === 'scene'
          ? (() => {
              const s = scenes.find((x) => x.id === selection.id);
              return s ? `w:${s.type}` : null;
            })()
          : selection?.kind === 'tool'
            ? (Object.entries(FIXED_TOOL).find(([, t]) => t === selection.key)?.[0] ?? null)
            : null;
      if (!key) return;
      const k = key.startsWith('w:') ? key : `f:${key}`;
      frameRef.current?.contentWindow?.postMessage(
        { source: 'setnayan-editor', t: 'play', key: k },
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

  const navOpen = maker?.navOpen ?? true;
  const device = maker?.device ?? 'desktop';
  const selectedScene = selection?.kind === 'scene' ? scenes.find((s) => s.id === selection.id) ?? null : null;

  /* 🧭 THE STAGE'S LIST — the canvas's own order (`lib/maker-scene-list.ts`). */
  const { stageLists, fullOrder, minis, tint } = navigator;
  const list = stageLists[stage];
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
  const selectedTile = list.shown.find((t) =>
    t.kind === 'scene'
      ? selectedScene?.id === t.widgetId
      : t.kind === 'post-event'
        ? selection?.kind === 'post-event' && selection.scene === t.scene
        : selection?.kind === 'tool' && selection.key === FIXED_TOOL[t.fixed],
  );
  selectedKeyRef.current = selectedTile ? markerOf(selectedTile) : null;
  const tabs = canvasBar ? navigatorTabs(canvasBar, list.shown.map((t) => t.key)) : null;
  const activeTab = tabs ? (tabs.find((t) => t.key === tabKey) ?? tabs.find((t) => !t.leaves) ?? null) : null;
  const selectedTabKey = tabs && selectedTile ? (tabOfTile(tabs, selectedTile.key)?.key ?? null) : null;
  /* A scene picked on the canvas may sit under another tab — follow it there. */
  useEffect(() => {
    if (selectedTabKey) setTabKey(selectedTabKey);
  }, [selectedTabKey]);

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
      onClose={() => select?.(null)}
      closeLabel={`Back to ${PUBLIC_STAGE_LABELS[stage]}`}
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
      {pageView ?? (selection?.kind === 'tool' && selection.key === 'details' ? null : <>
      {/* ══ 2 · THE NAVIGATOR ══ */}
      <nav
        aria-label="Scenes"
        style={{ ['--maker-nav-w' as string]: `${navWidth}px` }}
        className={`relative order-2 shrink-0 bg-cream/80 lg:order-1 lg:w-[var(--maker-nav-w)] ${
          navOpen ? '' : 'lg:hidden'
        }`}
      >
        <ol ref={setNavList} className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:py-4">
          {/* 🧭 THE STAGE'S MENU — the tabs a guest sees on this stage, never a
              generic "Main". Each lists its own scenes; a tab that opens a page of
              its own (Camera, Join, Watch) says so. The look behind every scene
              (theme, colours, music, backdrop) is the palette button. */}
          <li className="shrink-0 self-center lg:mb-3 lg:self-stretch" data-maker-tabs="">
            <div role="tablist" aria-label="This stage's menu" className="flex items-center gap-1 lg:flex-wrap">
              {tabs
                ? tabs.map((t) => {
                    const on = activeTab?.key === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        data-maker-tab={t.key}
                        onClick={() => {
                          setTabKey(t.key);
                          if (!t.leaves) scrollPreviewTo(t.key);
                        }}
                        className={`sn-press inline-flex min-h-11 items-center rounded-full px-3 text-[12px] font-semibold transition-colors duration-sn-control ease-sn ${
                          on ? 'bg-ink text-cream' : 'bg-white/70 text-ink/75 hover:bg-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })
                : null}
              <button
                type="button"
                onClick={() => select?.({ kind: 'main' })}
                aria-pressed={selection?.kind === 'main'}
                aria-label="Theme, colours and music — behind every scene"
                title="Theme, colours and music — behind every scene"
                className={`sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-sn-control ease-sn ${
                  selection?.kind === 'main' ? 'bg-ink text-cream' : 'bg-white/70 text-ink/75 hover:bg-white'
                }`}
              >
                <Palette aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </li>
          {activeTab?.leaves ? (
            <li className="shrink-0 self-center px-2 text-[11.5px] text-ink/65 lg:self-stretch" data-maker-tab-leaves="">
              <InfoTip label={`${activeTab.label} opens its own page`} align="start">
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
                <InfoTip label="Scenes unavailable" align="start">
                  Your story’s scenes could not be read just now. The story itself is unchanged — open the Maker
                  again in a moment.
                </InfoTip>
              ) : (
                <InfoTip
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
            if (activeTab && !activeTab.tiles.includes(tile.key)) return null;
            const scene = tile.kind === 'scene' ? (sceneById.get(tile.widgetId) ?? null) : null;
            const on =
              tile.kind === 'scene'
                ? selectedScene?.id === tile.widgetId
                : tile.kind === 'post-event'
                  ? selection?.kind === 'post-event' && selection.scene === tile.scene
                  : selection?.kind === 'tool' && selection.key === FIXED_TOOL[tile.fixed];
            const showing = scene ? sceneShowing(scene) : tile.kind === 'post-event' ? tile.drawn : true;
            const next = list.shown[i + 1];
            const canDrag = tile.kind === 'scene' && !pending && !list.orderIsAutomatic;
            return (
              <li
                key={tile.key}
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
                        if (tile.kind === 'post-event') {
                          select?.({ kind: 'post-event', scene: tile.scene });
                          scrollPreviewTo(tile.anchor ?? undefined);
                          return;
                        }
                        if (tile.kind === 'scene') select?.({ kind: 'scene', id: tile.widgetId });
                        else if (FIXED_TOOL[tile.fixed]) select?.({ kind: 'tool', key: FIXED_TOOL[tile.fixed]! });
                        scrollPreviewTo(tile.key);
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
                      <InfoTip label={tile.label} align="start" labelClassName="line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight text-ink/70">
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
                      <InfoTip
                        label={tile.label}
                        align="start"
                        labelClassName={`line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight ${showing ? 'text-ink/75' : 'text-ink/45'}`}
                      >
                        {postEventTileNote(tile)}
                      </InfoTip>
                    ) : (
                      <span className={`line-clamp-2 break-words pt-1 text-[11px] font-semibold leading-tight ${showing ? 'text-ink/75' : 'text-ink/45'}`}>
                        {tile.label}
                      </span>
                    )}
                  </div>
                  {scene && menuFor === scene.id ? (
                    <SceneMenu
                      onClose={() => setMenuFor(null)}
                      canUp={shownSceneIds.indexOf(scene.id) > 0 && !list.orderIsAutomatic}
                      canDown={shownSceneIds.indexOf(scene.id) < shownSceneIds.length - 1 && !list.orderIsAutomatic}
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
                    onClick={() => select?.({ kind: 'scene', id: scene.id, tab: 'transition' })}
                    title="The transition into the next scene"
                    className="sn-press mx-auto hidden h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink lg:ml-5 lg:flex"
                  >
                    {scene.transitionLabel}
                  </button>
                ) : null}
              </li>
            );
          })}
          {list.orderIsAutomatic ? (
            <li className="shrink-0 self-center px-4 text-[11px] text-ink/60 lg:mt-2 lg:self-stretch">
              <InfoTip label="Order set for you" align="start">
                Open browsing arranges the sections by kind, so dragging cannot change what guests see.
              </InfoTip>
            </li>
          ) : null}
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
                          <InfoTip label={f.label} align="start" labelClassName="truncate">
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
                <InfoTip label="New scene" align="start">
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
          <iframe
            ref={frameRef}
            key={`${stage}:${maker.renderStamp}:${maker.viewAsHref ?? ''}`}
            src={canvasSrc}
            title={`Your Event Hub — ${PUBLIC_STAGE_LABELS[stage]}`}
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
            resetKey={`${stage}:${maker.renderStamp}:${maker.viewAsHref ?? ''}`}
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
      {selection ? (
        <Inspector
          selection={selection}
          postEventTile={
            selection.kind === 'post-event'
              ? ((list.shown.find((t) => t.kind === 'post-event' && t.scene === selection.scene) as PostEventTile | undefined) ?? null)
              : null
          }
          postEventWrittenAt={navigator.postEvent && navigator.postEvent !== 'unreadable' ? navigator.postEvent.generatedAt : null}
          scene={selectedScene}
          scenePanel={selectedScene ? scenePanels[selectedScene.id] : null}
          rows={rows}
          themes={themes}
          themeHref={themeHref}
          eventId={eventId}
          madeOnce={madeOnce}
          showMotionTabs={ownsPro || !maker.storeShell}
          onClose={() => select?.(null)}
          onTab={(tab) => selectedScene && select?.({ kind: 'scene', id: selectedScene.id, tab })}
        />
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
function madeOncePageKey(
  selection: MakerSelection,
  madeOnce: Partial<Record<MadeOnceKey, ReactNode>> | null,
): Exclude<MakerPageKey, 'details'> | null {
  if (selection?.kind !== 'tool' || !isMakerPageKey(selection.key) || selection.key === 'details') return null;
  if (selection.key === 'love-story') return 'love-story';
  return madeOnce?.[selection.key] ? selection.key : null;
}

/** A two- or three-way switch at the top of a made-once page (not a tab bar:
 *  both sides are the same page, shown two ways). */
function PageSwitch({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 justify-center px-2 pt-2" data-maker-page-switch="">
      <div className="flex items-center rounded-full bg-ink/5 p-0.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`sn-press inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors duration-sn-control ease-sn ${
              value === v ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Love Story's controls, beside its page: the words the Invitation weaves into
 *  its story paragraph (the editor's own Story row, with its own bound action). */
function LoveStoryControls({ rows }: { rows: Record<string, MakerRowPanel> }) {
  const keys = (TOOL_ROWS['love-story'] ?? []).filter((k) => rows[k]);
  return (
    <section className="flex flex-col gap-3" data-made-once="love-story">
      <p className="px-1 text-[13.5px] text-ink/75">
        Your moments, each one a scene on your {PUBLIC_STAGE_LABELS.rsvp}. Add and arrange them on the page; a year is
        enough, and five stories in your words are free.
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

/** Which toolbar tool a fixed section opens (none for the entourage). */
const FIXED_TOOL = MAKER_FIXED_TOOL;


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

const TABS: Array<{ key: MakerSceneTab; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'animate', label: 'Animate' },
  { key: 'transition', label: 'Transition' },
  { key: 'content', label: 'Content' },
];

function Inspector({
  selection,
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
}: {
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
  const tab: MakerSceneTab = selection.kind === 'scene' ? (selection.tab ?? 'format') : 'format';

  /* Format · Animate · Transition are the three parts of ONE panel (the
     section's own controls); a tab brings its part into view. */
  useEffect(() => {
    if (selection.kind !== 'scene' || tab === 'content' || tab === 'format') {
      bodyRef.current?.scrollTo({ top: 0 });
      return;
    }
    const target = bodyRef.current?.querySelector(`[data-maker-part="${tab}"]`);
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [selection, tab]);

  const title =
    selection.kind === 'scene'
      ? (scene?.label ?? 'Scene')
      : selection.kind === 'post-event'
        ? (postEventTile?.label ?? 'Post Event')
      : selection.kind === 'main'
        ? 'Main · behind every scene'
        : selection.kind === 'tool'
          ? { logo: 'Logo', hero: 'Hero', reveal: 'Reveal', 'love-story': 'Love Story', 'post-event': 'Post Event', prints: 'Prints & Tickets', details: 'Details' }[selection.key]
          : (rows[selection.key]?.label ?? 'Edit');

  const tabs = TABS.filter((t) => showMotionTabs || (t.key !== 'animate' && t.key !== 'transition'));
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
           once, in the Hero workspace — not a second, live-writing copy. */
        scene?.type === 'hero' && madeOnce?.hero ? (
          madeOnce.hero
        ) : contentRow && rows[contentRow] ? (
          <RowBlock row={rows[contentRow]!} />
        ) : (
          <p className="px-1 text-[13px] text-ink/70">
            This scene is written for you from your event — your guest list, your schedule and your replies —
            so there is nothing to type here.
          </p>
        )
      ) : (
        scenePanel ?? <p className="px-1 text-[13px] text-ink/70">This scene has no settings of its own.</p>
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
      className="sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col rounded-t-3xl lg:static lg:z-auto lg:order-3 lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-none"
    >
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
        <div role="tablist" aria-label="Edit this scene" className="flex gap-0.5 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={`sn-press min-h-9 flex-1 whitespace-nowrap rounded-md px-1 text-[12.5px] font-semibold transition-colors duration-sn-control ease-sn ${
                tab === t.key ? 'bg-ink text-cream' : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6 pt-3">
        {body}
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
