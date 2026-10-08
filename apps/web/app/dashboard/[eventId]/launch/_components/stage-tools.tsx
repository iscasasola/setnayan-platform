'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PillThumb } from '@/app/_components/pill-selector';
import { createPortal } from 'react-dom';
import { Brush, Diamond, FileText, PencilLine, Play, Square, Store } from 'lucide-react';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { RSVP_STAGE_SCENES, type RsvpStageScene } from '@/lib/rsvp-stage';
import {
  MAKER_PARTS,
  MAKER_PART_TOOLS,
  MAKER_PART_TOOL_LABEL,
  makerPartOfTap,
  makerPartQuietRow,
  makerPartSource,
  makerPartsOnPage,
  makerStepPart,
  type MakerPartKey,
  type MakerPartTool,
  type MakerStageKey,
} from '@/lib/maker-parts';
import {
  SP_GRAB,
  STAGE_GUEST_TAB,
  STAGE_ICON_BUTTON,
  STAGE_ICON_FACE,
  STAGE_PANEL_MS,
  STAGE_PANEL_REST_PX,
  STAGE_PANEL_VARS,
  STAGE_PART_TILE,
  STAGE_ROW,
  STAGE_TOOL_BUTTON,
  STAGE_TOOL_DIVIDER,
  STAGE_TOOL_FACE,
  STAGE_TOOL_PILL,
  stagePanelOpenPx,
} from '@/lib/maker-stage-room';
import { MAKER_LT_SIZE_KEY, MAKER_LT_TAP_PX } from '@/lib/maker-lt-size';
import { fixedOfKey, fixedScenePanel } from '@/lib/maker-selection';
import { makerPartStudioDoor, makerStagePickedAttr, makerStageMayType } from '@/lib/maker-parts';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { showHubTab, shownHubTab } from '@/app/[slug]/_components/hub-tab-dom';
import { setStagePanelNow, setStageRevealColours, useStageRevealLook, type StageQuiet } from './stage-panel/store';
import { revealStubHtml } from './stage-panel/reveal-picture';
import type { StudioTileKey } from '@/lib/studio-tiles';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { MAKER_OPEN_PART_EVENT, MAKER_STAGE_PICK_EVENT, MAKER_STAGE_TOOL_EVENT, useMaker } from './maker-context';
import { makerPagePick, makerPageValue, makerStageLabel } from './maker-bar';
import { StageItemMenu, type StagePageOption } from './stage-item-menu';
/* ＋ ↕ 🗑 🎭 PR 3 — the part's edges, the ＋ sheet, the one confirm, the Reveal part (same lazy chunk). */
import { PartEdits, RevealPartTools, RevealPlay, makerPartTopOnScreen, revealStageOf } from './add-part-sheet';
import { partsInPageOrder } from '@/lib/maker-part-step';
import { CameraPartTools, StagePlayStatus } from './details-lazy';

import { makerPartLabelOn, makerPartOfCanvas, makerPartsWithAdded } from '@/lib/maker-part-groups';
import { filedOnCanvas, firstMarkerOnPage, makerStagesPages } from '@/lib/maker-stage-filing';

/**
 * 🎬 THE STAGES PANEL — the new Maker's lower third on the Stages side (owner
 * 2026-10-06, verbatim: *"swiping will proceed to the next element. with the
 * different tools Style | Text | Animate · Style are the presets, background ·
 * Text Font, Color, Size · Animate Build In - Action - Build Out · Swiping right
 * will go to the next element. Tapping on the screen will forward it to that
 * element. Changing text will be on the editing screen"*; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 2; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` — `S`, `tpill`,
 * `strip`, `paint()`). Behind `makerStagesStudioEnabled`, on a phone; loaded
 * lazily (`details-lazy.tsx`), so the shipped Maker's first load carries none.
 *
 *   ROW      [ stage ▾ ] · [ Style | Text | Animate ] · ▶   (× once a part is open)
 *   STRIP    nothing picked: "You're editing · Invitation › Details" and the
 *            page's parts (`lib/maker-parts.ts`), one tile each
 *   OPEN     a part tapped — on the page or in the strip — rises the panel to
 *            HALF the screen (~240 ms) with the SHIPPED tools for it: Style =
 *            the scene's Format (its styles as a carousel, its background) and
 *            Arrange, Text = Font · Colour · Size, Animate = Build in · Action ·
 *            Build out. × or a tap on nothing folds it.
 *   SWIPE    across the panel: the next / previous part, on into the next page.
 *   ▶        the part picked, or — nothing picked — the whole stage, scene by
 *            scene; the toolbars slide away and one tap stops it.
 *   TYPING   the words of a plain-text part are typed ON THE PAGE: the panel
 *            slides away, the keyboard takes the bottom half, Done brings it back
 *            (the shipped `type-in-place.tsx` bar; one draft value with Studio ›
 *            Info — `the-typing-door-is-the-info-door.test.ts`).
 *   TAB BAR  the guest's own tab bar, drawn at the foot of the page preview —
 *            a tap there changes page as a guest would.
 *
 * 🔑 A TILE TAP IS A PAGE TAP. A part's tile asks the work area exactly what a
 * tap on that part of the page asks (`{ t: 'edit', key, el }` — the canvas's own
 * message, `editor-bridge.tsx`), so the selection, the tools and the page's
 * outline are the shipped ones, from either door. Style | Text | Animate asks the
 * work area to show that tool (`MAKER_STAGE_TOOL_EVENT`).
 *
 * 🔒 NOTHING HERE WRITES. Every change is the shipped tools' own draft save,
 * shown at once, counted on ✓, published at Apply.
 */

/** Where Style's quiet row last took the couple — the panel picks the same part when they come back (‹). */
let resumeAt: { stage: MakerStageKey; page: string | null; part: MakerPartKey } | null = null;
/** 🧭 The tab that was on screen when this panel last stood — it is put back when the couple returns from Studio
 *  (the panel is not mounted there, and an edit made there reloads the canvas onto its first tab). */
let lastTab: { of: string; stage: LifecyclePhase; tab: string } | null = null;

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** The canvas keys the stage's page drew (its section markers) — what a tile can reach. */
function readPresent(): Set<string> {
  const out = new Set<string>();
  try {
    const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    doc?.querySelectorAll('[data-maker-section]').forEach((m) => {
      const k = m.getAttribute('data-maker-section');
      if (!k) return;
      out.add(k);
      /* …and the parts that section drew (`canvas|el`), so a part it did not draw is never a tile. */
      if (k === 'f:hero') findMakerSection(doc, k)?.querySelectorAll('[data-el]').forEach((p) => out.add(`${k}|${p.getAttribute('data-el')}`));
    });
    if (doc?.getElementById('site-entourage')) out.add('f:entourage');
    if (doc?.getElementById('site-story')) out.add('f:story');
  } catch {
    /* a canvas we cannot read offers no tiles — never a tile that does nothing */
  }
  return out;
}

/** The page each drawn part sits on, as the canvas filed it — `{}` on a canvas that is one page (or unreadable). */
function readFiled(): Record<string, string> {
  try {
    const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    return doc ? filedOnCanvas(doc) : {};
  } catch {
    return {};
  }
}

/** The tab the stage's canvas has on screen NOW, read off the page itself — null: one page, another stage's frame, or unreadable. */
function readCanvasTab(stage: LifecyclePhase): string | null {
  try {
    const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
    const doc = frame?.contentDocument;
    if (!frame || !doc || new URL(frame.src, window.location.href).searchParams.get('phase') !== stage) return null;
    return shownHubTab(doc);
  } catch {
    return null;
  }
}

/** Show `tab` on a canvas that just (re)loaded — its place untouched. False: that page is not there to show. */
function putTabBack(canvas: Window, tab: string): boolean {
  try {
    return showHubTab(canvas.document, tab);
  } catch {
    return false;
  }
}

/** The canvas frame a message came from, when it is one of `stage`'s (shown, or loading behind it) — else null. */
function stageCanvasOf(source: MessageEventSource | null, stage: LifecyclePhase): Window | null {
  if (!source) return null;
  for (const f of Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]'))) {
    if (f.contentWindow !== source) continue;
    try {
      return new URL(f.src, window.location.href).searchParams.get('phase') === stage ? f.contentWindow : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** To the canvas on screen (the stage's shown frame). */
function postToCanvas(message: unknown) {
  document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentWindow?.postMessage(message, window.location.origin);
}

export function StageTools({
  stage,
  rsvpOpen,
  options,
  value,
  onPickPage,
  onOpenStudio,
  suppliersHref,
  onPx,
}: {
  /** The lifecycle stage on screen. */
  stage: LifecyclePhase;
  /** The RSVP stage is open (its own three screens). */
  rsvpOpen: boolean;
  /** Every stage's pages — the shell's own Page ▾ options (`makerPageMenu`). */
  options: readonly StagePageOption[];
  /** The page on screen, as Page ▾ keys it. */
  value: string;
  /** The shell's Page ▾ door (`pickPage`). */
  onPickPage: (key: string) => void;
  /** Open a Studio tool in place — Style's quiet row (‹ in the top nav returns). `from`: the part it was opened for. */
  onOpenStudio: (key: StudioTileKey, from?: { label: string; focus: string | null }) => void;
  /** Suppliers, where the date and the venue are set. */
  suppliersHref: string;
  /** The panel's height (px) — null: the lower third's resting height. */
  onPx: (px: number | null) => void;
}) {
  const maker = useMaker();
  const openTool = maker?.tool ?? null;
  const stageKey: MakerStageKey = rsvpOpen ? RSVP_STAGE_KEY : stage;
  const [screen, setScreen] = useState<RsvpStageScene>('form');
  const [tool, setTool] = useState<MakerPartTool>('style');
  const [picked, setPicked] = useState<MakerPartKey | null>(null);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** ▶ The picked part's sequence as the canvas plays it: the phase now, and what it has none of (`play-sequence.ts`). */
  const [seq, setSeq] = useState<{ phase: string; skipped: string[] } | null>(null);
  /* What it had none of stays said a moment after it rests, then goes. */
  useEffect(() => {
    if (playing || !seq) return;
    const id = window.setTimeout(() => setSeq(null), 3500);
    return () => window.clearTimeout(id);
  }, [playing, seq]);
  const [present, setPresent] = useState<Set<string>>(() => new Set());
  /** The page each drawn part is on, as the canvas filed it (`[data-hub-tab]`) — the canvas is the one truth. */
  const [filed, setFiled] = useState<Record<string, string>>({});
  /** 🧭 The tab the canvas has ON SCREEN, as the canvas said it (its `ready` and every switch) — never guessed. */
  /* `suppliersHref` names the event: another event's Maker never opens on this one's last page. */
  const [canvasTab, setCanvasTab] = useState<{ stage: LifecyclePhase; tab: string } | null>(lastTab?.of === suppliersHref ? lastTab : null);
  lastTab = canvasTab ? { of: suppliersHref, stage: canvasTab.stage, tab: canvasTab.tab } : null;
  const tabRef = useRef(canvasTab);
  tabRef.current = canvasTab;
  const rootRef = useRef<HTMLDivElement>(null);

  /* ── where we are ── */
  /* 🧭 THE STAGE'S PAGES ARE THE CANVAS'S PAGES — one list (`makerStagesPages`, which the canvas groups by too):
     every page it names is a tab here, whether or not a scene of the couple's sits on it yet (its page is drawn
     all the same), and a stage the canvas draws as ONE page has no tabs at all. The words and the pick are still
     the shell's own Page ▾ options — a page the event's bar drops (no Love Story) is dropped here with it. */
  const pages = useMemo(() => {
    if (rsvpOpen) return RSVP_STAGE_SCENES.map((s) => ({ key: s.key as string, label: s.label, option: RSVP_STAGE_KEY as string }));
    const own = new Set(makerStagesPages(stage).map((p) => p.key));
    return options.flatMap((o) => {
      const pk = makerPagePick(o.key);
      return pk?.kind === 'page' && pk.stage === stage && own.has(pk.page) ? [{ key: pk.page, label: o.label, option: o.key }] : [];
    });
  }, [options, rsvpOpen, stage]);
  const shownPage = (() => {
    if (rsvpOpen) return screen;
    const has = (k: string | null | undefined): k is string => Boolean(k) && pages.some((p) => p.key === k);
    /* The canvas's own word first (owner 08 Oct: on Me the label read "Welcome" — the shell's page follows the
       scroll and the selection, the canvas knows the tab it shows); the shell's page until the canvas has said. */
    if (canvasTab?.stage === stage && has(canvasTab.tab)) return canvasTab.tab;
    const pk = makerPagePick(value);
    return pk?.kind === 'page' && pk.stage === stage && has(pk.page) ? pk.page : (pages[0]?.key ?? null);
  })();
  /* 🎭 The Reveal leads Save the Date, Invitation › Welcome and The Day › Live — never drawn
     on the editing canvas (it plays over the cover), so its tile is the page map's own. ＋ A
     part the couple ADDED is a tile of the page it was added to (`makerPartsWithAdded`). */
  const revealStage = rsvpOpen ? null : revealStageOf(stage);
  const tappableOn = useCallback(
    (page: string | null): MakerPartKey[] => {
      const drawnHere = makerPartsWithAdded({ stage, page, pages: pages.map((p) => p.key), drawn: [...present], filed });
      const withReveal = revealStage && page && makerPartsOnPage(stage, page)[0] === 'reveal' ? (['reveal', ...drawnHere] as MakerPartKey[]) : drawnHere;
      /* 🎛 The Camera is never drawn on the editing page (`the-maker-canvas-draws-no-camera`) — on its own page its
         tile is the page map's, and its tools are this panel's own (`CameraPartTools`). */
      return page && makerPartsOnPage(stage, page).includes('camera') && !withReveal.includes('camera') ? [...withReveal, 'camera'] : withReveal;
    },
    [filed, pages, present, revealStage, stage],
  );
  const parts = useMemo(
    () => (rsvpOpen ? [...makerPartsOnPage(RSVP_STAGE_KEY, screen)] : tappableOn(shownPage)),
    [rsvpOpen, screen, shownPage, tappableOn],
  );
  const pageLabel = pages.find((p) => p.key === shownPage)?.label ?? null;

  /* The canvas's sections, read again whenever a canvas says it is ready, or the page moves. */
  useEffect(() => {
    const read = () => {
      setPresent(readPresent());
      setFiled(readFiled());
    };
    read();
    /* 🧭 …and the tab it has on screen, off the page itself: this panel may mount after the canvas said `ready`
       (it is lazy), and a stage warmed behind the canvas is shown without saying it again. */
    const tab = readCanvasTab(stage);
    const was = tabRef.current;
    /* The canvas reloaded while this panel was away (Studio): the page the couple left is put back. */
    const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentWindow;
    const putBack = Boolean(tab && was?.stage === stage && was.tab !== tab && frame && putTabBack(frame, was.tab));
    if (tab && !putBack) setCanvasTab((c) => (c?.stage === stage && c.tab === tab ? c : { stage, tab }));
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === 'setnayan-site' && d.t === 'ready') window.setTimeout(read, 60);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [stage, shownPage]);

  /* 🧭 THE TAB ON SCREEN IS THE CANVAS'S TO SAY. It says it when it loads (`ready`) and after every switch
     (`hubTab`). A canvas that RELOADS comes back on its first tab: the tab that was on screen is put back at once
     (`putTabBack`), so a reload never moves the couple off the page they were editing, nor off their place on it
     (the Maker carries the scroll over right after). */
  useEffect(() => {
    const onTab = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown; tab?: unknown } | null;
      if (d?.source !== 'setnayan-site' || typeof d.tab !== 'string' || !d.tab) return;
      /* Only THIS stage's canvas — the one on screen, or its reload loading behind it; never a warm stage's. */
      const from = stageCanvasOf(e.source, stage);
      if (!from) return;
      if (d.t === 'hubTab') setCanvasTab({ stage, tab: d.tab });
      else if (d.t === 'ready') {
        const was = tabRef.current;
        /* The page that was on screen is put back NOW, on the fresh page's own document — before the buffered
           swap carries the scroll over (a task later), so the place is measured against the right page. A page
           that could not be put back is never named as if it were on screen. */
        if (was?.stage === stage && was.tab !== d.tab && putTabBack(from, was.tab)) return;
        setCanvasTab({ stage, tab: d.tab });
      }
    };
    window.addEventListener('message', onTab);
    return () => window.removeEventListener('message', onTab);
  }, [stage]);
  /** Open one of this stage's pages: the canvas swaps to it now, and the shell's Page ▾ is told (its own door). */
  const goToPage = useCallback(
    (key: string, option: string) => {
      postToCanvas({ source: 'setnayan-editor', t: 'hubTab', key: '', tab: key });
      onPickPage(option);
    },
    [onPickPage],
  );

  /* ── the panel's height: half the screen while a part's tools are open ── */
  /* 🎭 The Reveal's tools are this panel's own (no work-area tool opens for it). */
  const revealOpen = picked === 'reveal' && revealStage !== null;
  /* 🎛 …and so are the Camera's (its three looks, owner 2026-10-06/07). */
  const cameraOpen = picked === 'camera' && !rsvpOpen;
  /** A part whose only tool is Style (the pass is a guest's own card: no words or motion of its own to set). */
  const styleOnly = revealOpen || cameraOpen || rsvpOpen || picked === 'pass';
  const [revealPlaying, setRevealPlaying] = useState(false);
  const open = (openTool !== null || revealOpen || cameraOpen) && !typing && !playing;
  /* ↕ THE PANEL'S HEIGHT (prototype `.lt`, owner 2026-10-06 "the toolbar is half the screen"):
     a part picked → half the screen (or the size this phone last dragged it to, remembered as a
     share — the shipped `MAKER_LT_SIZE_KEY`); nothing picked → the grab and the one row (62 px),
     so the page runs right down to it with no gap; ▶ playing → away. The grab drags between. */
  const [ltNow, setLtNow] = useState<number>(STAGE_PANEL_REST_PX);
  /* A tool tapped with nothing picked: the panel rises with "Tap a part of the page" and the page's parts
     (prototype `.nosel`) — it never picks one by itself (M5). */
  const [toolOnly, setToolOnly] = useState(false);
  useEffect(() => {
    if (open) setToolOnly(false);
  }, [open]);
  const setHeight = useCallback(
    (px: number) => {
      setLtNow(px);
      onPx(px);
    },
    [onPx],
  );
  useEffect(() => {
    /* ▶ playing, or ⌨ typing (the keyboard takes the bottom half — prototype `.phone.typing .lt{display:none}`): away, no gap. */
    if (playing || typing) {
      onPx(0);
      return;
    }
    if (!open && !toolOnly) return setHeight(STAGE_PANEL_REST_PX);
    const half = stagePanelOpenPx(window.innerHeight);
    let px = half;
    try {
      const share = Number(window.localStorage.getItem(MAKER_LT_SIZE_KEY));
      if (Number.isFinite(share) && share > 0 && share <= 0.5) px = Math.round(Math.max(STAGE_PANEL_REST_PX, Math.min(half, share * window.innerHeight)));
    } catch {
      /* private mode: half the screen */
    }
    setHeight(px);
  }, [open, toolOnly, playing, typing, onPx, setHeight]);
  useEffect(() => () => onPx(null), [onPx]);
  /* 🎯 THE PICKED PART IN THE MIDDLE of the page left above the panel (prototype `centrePicked`: "making
     sure they see what element they are editing") — once the panel has risen; a part taller than that
     band lines up with its top. The canvas is a same-origin frame, scrolled here directly. */
  const pickedKey = picked ? MAKER_PARTS[picked].canvas : null;
  const pickedEl = picked ? (MAKER_PARTS[picked].el ?? null) : null;
  useEffect(() => {
    if (!open || !pickedKey || rsvpOpen) return;
    /* Once the panel has risen — and again after the page under it settles (a page jump scrolls the canvas). */
    const t = window.setTimeout(() => centrePart(pickedKey, pickedEl), STAGE_PANEL_MS + 40);
    const t2 = window.setTimeout(() => centrePart(pickedKey, pickedEl), STAGE_PANEL_MS + 900);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, pickedKey, pickedEl, rsvpOpen, ltNow, shownPage]);
  /* Its tools closed (×, a tap on nothing): nothing is picked. */
  useEffect(() => {
    if (openTool !== null) return;
    /* One tool handing over to another (the part's sheet → the scene's) is not a close —
       nor is the Reveal, whose tools are this panel's own. */
    const t = window.setTimeout(() => setPicked((p) => (p === 'reveal' || p === 'camera' ? p : null)), 400);
    return () => window.clearTimeout(t);
  }, [openTool]);

  /* ── asking the work area ── */
  const askTool = useCallback((t: MakerPartTool, k: MakerPartKey | null) => {
    /* After the work area has drawn the pick (two frames: its state, then its render). */
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        /* Text and Animate are a PART's own: one part of a bigger section (the names, the date)
           opens its own sheet — the shipped door the Apply sheet's "Go to" uses. */
        const def = k ? MAKER_PARTS[k] : null;
        if (t !== 'style' && def?.canvas && def.el && !rsvpOpenRef.current) {
          window.dispatchEvent(
            new CustomEvent(MAKER_OPEN_PART_EVENT, { detail: { key: def.canvas, widgetType: def.canvas === 'f:hero' ? 'hero' : def.canvas.slice(2), el: def.el } }),
          );
        }
        window.dispatchEvent(new CustomEvent(MAKER_STAGE_TOOL_EVENT, { detail: t }));
      }),
    );
  }, []);
  const openToolRef = useRef(openTool);
  openToolRef.current = openTool;
  const rsvpOpenRef = useRef(rsvpOpen);
  rsvpOpenRef.current = rsvpOpen;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const pickPart = useCallback(
    (k: MakerPartKey) => {
      setPicked(k);
      if (k === 'reveal' || k === 'camera') {
        /* 🎭 🎛 Its tools are drawn here; whatever the work area had open folds. */
        openToolRef.current?.close();
        return;
      }
      if (rsvpOpen) {
        /* The RSVP stage's screens carry their own controls (`maker-rsvp-stage.tsx`). */
        document.querySelector<HTMLElement>(`[data-rsvp-stage-scene-tile="${screen}"]`)?.click();
        return;
      }
      const def = MAKER_PARTS[k];
      if (!def.canvas) return;
      /* 🔑 The canvas's own message — the same selection a tap on the page makes. */
      window.postMessage({ source: 'setnayan-site', t: 'edit', key: def.canvas, ...(def.el ? { el: def.el } : {}) }, window.location.origin);
      askTool(toolRef.current, k);
    },
    [askTool, rsvpOpen, screen],
  );

  /* ── ↑ ↓ ✕ — the part above / below, and let go (owner 2026-10-07) ── */
  const deselect = useCallback(() => {
    setPicked(null);
    openToolRef.current?.close();
  }, []);
  const deselectRef = useRef(deselect);
  deselectRef.current = deselect;
  /** The page's parts in their VISUAL order (measured on the canvas) — the order ↑ ↓ and the swipe walk. */
  const ordered = useCallback(() => partsInPageOrder(parts, (k) => makerPartTopOnScreen(stageKey, k)), [parts, stageKey]);
  const placeOf = picked ? ordered().indexOf(picked) : -1;
  const isFirstPage = pages.findIndex((p) => p.key === shownPage) <= 0;
  const isLastPage = pages.findIndex((p) => p.key === shownPage) >= pages.length - 1;
  /* A part tapped ON THE PAGE: the panel follows it (the work area has already opened its tools). */
  const where = useRef({ stageKey, shownPage });
  where.current = { stageKey, shownPage };
  useEffect(() => {
    const onCanvas = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source === window) return;
      const d = e.data as { source?: unknown; t?: unknown; key?: unknown; el?: unknown; phase?: unknown } | null;
      if (d?.source !== 'setnayan-site') return;
      if (d.t === 'edit' && typeof d.key === 'string') {
        const k =
          makerPartOfTap(where.current.stageKey, where.current.shownPage, d.key, typeof d.el === 'string' ? d.el : null) ??
          makerPartOfCanvas(where.current.stageKey, d.key);
        setPicked(k);
        askTool(toolRef.current, k);
      } else if (d.t === 'type' && d.phase === 'start') {
        /* ⌨ Only the picked part's words type (the work area takes a first tap's caret back). */
        const attr = document.querySelector('[data-maker-shell]')?.getAttribute('data-stage-picked') ?? null;
        if (makerStageMayType(attr, typeof d.key === 'string' ? d.key : '', typeof d.el === 'string' ? d.el : null)) setTyping(true);
      }
      else if (d.t === 'playDone') setPlaying(false);
      /* A tap on the page's ground, between parts: let the picked part go (owner 2026-10-07). */
      else if (d.t === 'tapOutside') deselectRef.current();
      else if (d.t === 'playSeq' && typeof d.phase === 'string') {
        const skipped = Array.isArray((d as { skipped?: unknown }).skipped)
          ? ((d as { skipped: unknown[] }).skipped.filter((x) => typeof x === 'string') as string[]).slice(0, 3)
          : [];
        setSeq({ phase: d.phase, skipped });
        if (d.phase === 'rest') setPlaying(false);
      }
    };
    window.addEventListener('message', onCanvas);
    return () => window.removeEventListener('message', onCanvas);
  }, [askTool]);

  /* ⌨ A FIRST tap on a part's words (the work area took the caret back): the part is picked. */
  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ key?: unknown; el?: unknown }>).detail;
      if (!d || typeof d.key !== 'string') return;
      const el = typeof d.el === 'string' ? d.el : null;
      const k = makerPartOfTap(where.current.stageKey, where.current.shownPage, d.key, el) ?? makerPartOfCanvas(where.current.stageKey, d.key);
      if (k) return pickPart(k);
      /* A part the map does not name: the canvas's own selection, all the same. */
      window.postMessage({ source: 'setnayan-site', t: 'edit', key: d.key, ...(el ? { el } : {}) }, window.location.origin);
    };
    window.addEventListener(MAKER_STAGE_PICK_EVENT, onPick);
    return () => window.removeEventListener(MAKER_STAGE_PICK_EVENT, onPick);
  }, [pickPart]);
  /* 🔑 Which part is picked, on the shell — the work area reads it before it lets a tap type. */
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-maker-shell]');
    const attr = open ? makerStagePickedAttr(picked) : null;
    if (attr) shell?.setAttribute('data-stage-picked', attr);
    else shell?.removeAttribute('data-stage-picked');
    return () => shell?.removeAttribute('data-stage-picked');
  }, [open, picked]);

  /* ⌨ Done brings the panel back ON THE SAME PART (prototype `endTyping`): the part typed in is picked again. */
  const typedPart = useRef<MakerPartKey | null>(null);
  const wasTyping = useRef(false);
  useEffect(() => {
    if (typing && !wasTyping.current) typedPart.current = picked;
    if (!typing && wasTyping.current && typedPart.current) {
      const k = typedPart.current;
      typedPart.current = null;
      window.setTimeout(() => pickPart(k), 60);
    }
    wasTyping.current = typing;
  }, [typing, picked, pickPart]);

  /* ⌨️ Typing on the page: the panel is away until the words' bar is gone (Done). */
  useEffect(() => {
    if (!typing) return;
    const gone = () => !document.querySelector('[data-type-bar]');
    const first = window.setTimeout(() => gone() && setTyping(false), 900);
    const mo = new MutationObserver(() => {
      if (gone()) setTyping(false);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(first);
      mo.disconnect();
    };
  }, [typing]);

  /* ‹ Back from a Studio tool Style's quiet row opened: the same stage and part. */
  useEffect(() => {
    const r = resumeAt;
    if (!r || r.stage !== stageKey || r.page !== shownPage || !parts.includes(r.part)) return;
    resumeAt = null;
    pickPart(r.part);
  }, [parts, pickPart, shownPage, stageKey]);

  /* ── ⟷ swipe: the next / previous part, on into the next page ── */
  const pendingStep = useRef<1 | -1 | null>(null);
  const step = useCallback(
    (dir: 1 | -1) => {
      /* The page the picked part is ON — the canvas may have scrolled the page the bar names. */
      const home =
        picked && !parts.includes(picked) && !rsvpOpen
          ? (pages.find((p) => tappableOn(p.key).includes(picked))?.key ?? shownPage)
          : shownPage;
      /* ↑ ↓ and the swipe walk the page in the order it is DRAWN (owner 2026-10-07: "the next element under it"). */
      const drawnHere = home === shownPage ? ordered() : [];
      const here = home === shownPage ? (drawnHere.length ? drawnHere : parts) : tappableOn(home);
      const r = makerStepPart({ parts: here, at: picked, pages: pages.map((p) => p.key), page: home, dir });
      if (!r) return;
      if (r.part) return pickPart(r.part);
      pendingStep.current = dir;
      if (rsvpOpen) {
        setScreen(r.page as RsvpStageScene);
        document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${r.page}"]`)?.click();
      } else goToPage(r.page, makerPageValue(stage, r.page));
    },
    [goToPage, ordered, pages, parts, pickPart, picked, rsvpOpen, shownPage, stage, tappableOn],
  );
  /* The next page is on screen and its parts are read: pick its first (or, going back, its last). */
  useEffect(() => {
    const dir = pendingStep.current;
    if (dir === null || parts.length === 0) return;
    pendingStep.current = null;
    pickPart(dir === 1 ? parts[0]! : parts[parts.length - 1]!);
  }, [parts, pickPart]);
  const stepRef = useRef(step);
  stepRef.current = step;
  /* ⌨ ↑ / ↓ step, Esc lets go — never while typing into a field or on the page. */
  useEffect(() => {
    if (!picked || typing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        step(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Escape') deselect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picked, typing, step, deselect]);

  useEffect(() => {
    let from: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const inPanel = t?.closest?.('[data-stage-tools], [data-phone-chrome="panel"]');
      const skip = t?.closest?.('input, textarea, select, [role="slider"], [data-style-carousel], [data-stage-strip], [data-maker-sheet], [aria-expanded="true"]');
      from = inPanel && !skip ? { x: e.clientX, y: e.clientY } : null;
    };
    const up = (e: PointerEvent) => {
      const f = from;
      from = null;
      if (!f) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      /* The prototype's rule: a clear sideways move — right = the next part. */
      if (Math.abs(dx) > 44 && Math.abs(dx) > 1.6 * Math.abs(dy)) stepRef.current(dx > 0 ? 1 : -1);
    };
    const cancel = () => {
      from = null;
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
  }, []);

  /* ── ▶ play ── */
  const stopPlay = useCallback(() => {
    postToCanvas({ source: 'setnayan-editor', t: 'playStop' });
    setPlaying(false);
  }, []);
  const play = () => {
    if (playing) return stopPlay();
    /* 🎭 ▶ on the Reveal: it plays over the cover, once, as a guest meets it. */
    if (picked === 'reveal' && revealStage) return setRevealPlaying(true);
    /* 🎛 The Camera has nothing to play — its look is a still. */
    if (picked === 'camera') return;
    const def = picked ? MAKER_PARTS[picked] : null;
    /* ▶ A picked part plays its WHOLE life on the canvas — Build in · Action · Build out · rest (owner: "i cannot
       see the build out and action"); the canvas tells each phase back (`playSeq`). */
    if (def?.canvas) {
      setSeq(null);
      postToCanvas({ source: 'setnayan-editor', t: 'playSeq', key: def.canvas, ...(def.el ? { el: def.el } : {}) });
      setPlaying(true);
      return;
    }
    postToCanvas({ source: 'setnayan-editor', t: 'playStage' });
    setPlaying(true);
  };
  /* While the stage plays, one tap anywhere in the Maker stops it (a tap on the page is the canvas's own). */
  useEffect(() => {
    if (!playing) return;
    const shell = document.querySelector<HTMLElement>('[data-maker-shell]');
    shell?.setAttribute('data-stage-playing', '');
    /* The tap that stops is ONLY a stop — its click never reaches what lay under it. */
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const tap = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', swallow, true), 600);
      stopPlay();
    };
    document.addEventListener('pointerdown', tap, true);
    return () => {
      shell?.removeAttribute('data-stage-playing');
      document.removeEventListener('pointerdown', tap, true);
    };
  }, [playing, stopPlay]);


  /* ── 🎭 THE PAGE IN STAGES: the Reveal drawn as the first part, one outline only ──
     The Reveal plays over the cover for guests, so the editing page never drew it — in Stages it is drawn
     where it sits, the first part (prototype `.el[data-el=reveal]`: the chosen opening in the event's
     colours over "Opens once, over the cover"), and a tap on it picks it. The canvas's own gold `mark()`
     outline is put away — the panel's outline is the one highlight (DECISION_LOG 2026-10-07 rule 2). */
  const revealLook = useStageRevealLook();
  const pickRef = useRef(pickPart);
  pickRef.current = pickPart;
  const revealLeadsHere = Boolean(revealStage && !rsvpOpen && shownPage && makerPartsOnPage(stage, shownPage)[0] === 'reveal');
  useEffect(() => {
    const paint = () => {
      try {
        const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
        if (!doc?.body) return;
        if (!doc.getElementById('sn-stage-canvas-css')) {
          const css = doc.createElement('style');
          css.id = 'sn-stage-canvas-css';
          css.textContent = '[data-setnayan-editor-bound],[data-setnayan-editor-bound] *{outline:none!important}[data-maker-reveal-part]{cursor:pointer}';
          doc.head.appendChild(css);
        }
        /* The event's colours, as the page wears them (the names · the eyebrow · the page). */
        const ink = getComputedStyle(doc.querySelector('[data-el="names"]') ?? doc.body).color;
        const accent = getComputedStyle(doc.querySelector('[data-el="eyebrow"]') ?? doc.body).color;
        const bodyBg = getComputedStyle(doc.body).backgroundColor;
        const neutral = !bodyBg || bodyBg === 'rgba(0, 0, 0, 0)' ? '#F7F2EC' : bodyBg;
        setStageRevealColours({ dominant: ink, supporting: `color-mix(in srgb, ${ink} 30%, white)`, accent, neutral });
        let part = doc.querySelector<HTMLElement>('[data-maker-reveal-part]');
        if (!revealLeadsHere) {
          part?.remove();
          return;
        }
        /* 🎭 The Reveal is the FIRST thing on its page (DECISION_LOG 2026-10-06) — before every marked part, the
           day's "Happening now" card included, and on the tab that is SHOWN (a tabbed canvas hides the others). */
        const first = firstMarkerOnPage(doc, shownPage);
        if (part && first && part.nextElementSibling !== first) {
          part.remove();
          part = null;
        }
        if (!part) {
          if (!first?.parentElement) return;
          part = doc.createElement('section');
          part.setAttribute('data-maker-reveal-part', '');
          part.setAttribute('aria-label', 'Reveal');
          part.style.cssText = 'padding:18px 14px 14px;margin:6px 14px;border-radius:var(--m-r-md,14px);text-align:center';
          part.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pickRef.current('reveal');
          });
          first.parentElement.insertBefore(part, first);
        }
        const mute = getComputedStyle(doc.body).color;
        part.innerHTML = revealStubHtml(revealLook.kind, revealLook.colours, ink, mute);
      } catch {
        /* a canvas we cannot reach draws no Reveal part — its tile still picks it */
      }
    };
    paint();
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === 'setnayan-site' && d.t === 'ready') window.setTimeout(paint, 80);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [revealLeadsHere, revealLook.kind, revealLook.colours, shownPage]);

  /* ── Style › Look's quiet bar and the part's own words behind ⓘ, said to the panel under the row ── */
  const canvasOfPick = picked ? MAKER_PARTS[picked].canvas : null;
  const fixedHere = canvasOfPick ? fixedOfKey(canvasOfPick) : null;
  useEffect(() => {
    /* The RSVP stage's screens are the RSVP tool's: its one quiet bar is "Edit the RSVP · Studio ›". */
    const q = rsvpOpen ? makerPartQuietRow('rsvp') : picked && picked !== 'reveal' ? makerPartQuietRow(picked) : null;
    let quiet: StageQuiet | null = null;
    if (q) {
      if ('suppliers' in q.to) quiet = { kind: 'suppliers', words: q.words, small: 'Suppliers ›', href: suppliersHref };
      else {
        const to = q.to.studio;
        const typed = picked ? makerPartSource(picked).kind === 'info' : false;
        quiet = {
          kind: to === 'info' ? 'info' : 'studio',
          words: q.words,
          small: to === 'info' ? (typed ? 'or tap the words ›' : 'Info ›') : 'Studio ›',
          open: () => {
            resumeAt = picked ? { stage: stageKey, page: shownPage, part: picked } : null;
            /* 🎯 The exact field (`makerPartStudioDoor`), and where to come back to — "Done · back to Names". */
            const door = picked ? makerPartStudioDoor(picked) : null;
            onOpenStudio((to === 'info' ? 'info' : to) as StudioTileKey, {
              label: picked ? makerPartLabelOn(stageKey, picked) : 'the part',
              focus: door?.focus ?? null,
            });
          },
        };
      }
    }
    const f = fixedHere ? fixedScenePanel(fixedHere) : null;
    const about = f ? [f.line, f.source?.text].filter(Boolean).join(' ') || null : null;
    setStagePanelNow({ picked, quiet, about });
  }, [picked, rsvpOpen, suppliersHref, stageKey, shownPage, onOpenStudio, fixedHere]);
  useEffect(() => () => setStagePanelNow({ picked: null, quiet: null, about: null }), []);

  const pickTool = (t: MakerPartTool) => {
    setTool(t);
    if (picked === 'reveal') return;
    if (!picked || !open) return setToolOnly(true);
    askTool(t, picked);
  };
  const away = typing || playing;
  const shellEl = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-maker-shell]');
  /* Dragged down to the row alone, an open part's tools fold away (prototype `.lt.min`). */
  const folded = ltNow < STAGE_PANEL_REST_PX + 60;

  /* ── ↕ THE GRAB (prototype `.grab`) — the shipped drag, tap and memory (`lib/maker-lt-size.ts`) ── */
  const grabFrom = useRef<{ y: number; h: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const clampLt = (px: number) => Math.round(Math.max(STAGE_PANEL_REST_PX, Math.min(stagePanelOpenPx(window.innerHeight), px)));
  const keepLt = (px: number) => {
    setHeight(px);
    if (px > STAGE_PANEL_REST_PX + 60) {
      try {
        window.localStorage.setItem(MAKER_LT_SIZE_KEY, String(px / window.innerHeight));
      } catch {
        /* blocked storage: not remembered */
      }
    }
  };

  return (
    <div
      ref={rootRef}
      data-stage-tools=""
      data-stage-open={open ? '' : undefined}
      data-stage-folded={folded ? '' : undefined}
      aria-hidden={away || undefined}
      className={`flex min-h-0 flex-1 flex-col px-[10px] transition-transform ease-out motion-reduce:transition-none ${away ? 'pointer-events-none translate-y-[110%]' : ''}`}
      style={{ transitionDuration: `${STAGE_PANEL_MS}ms` }}
    >
      {/* One rule set, drawn only while this panel is (phone only): the prototype's colours, the lower
          third as its `.lt` (page-coloured, no frame, full width), and the open tool flush under the row. */}
      <style>
        {`html:has([data-stage-tools]){${STAGE_PANEL_VARS}}` +
          '@media (max-width:1023.98px){' +
          '[data-maker-lower-third]:has(>[data-stage-tools])>:not([data-stage-tools]){display:none}' +
          '[data-maker-lower-third]:has(>[data-stage-tools]){transition:height 240ms cubic-bezier(.16,1,.3,1);background:var(--sp-page)!important;border-top:1px solid var(--sp-line)!important;padding:0!important;gap:0!important;box-shadow:none!important}' +
          '[data-maker-shell]:has([data-stage-tools]) [data-phone-chrome="panel"]{left:0!important;right:0!important;bottom:env(safe-area-inset-bottom)!important;height:calc(var(--maker-lt-h) - 67px)!important;outline:none!important;border-radius:0!important;box-shadow:none!important;background:var(--sp-page)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important}' +
          '[data-maker-shell]:has([data-stage-folded]) [data-phone-chrome="panel"]{opacity:0;pointer-events:none}' +
          '[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transform:translateY(-110%);transition:transform 240ms ease-out}' +
          '.sp-range{-webkit-appearance:none;appearance:none}.sp-range::-webkit-slider-runnable-track{height:4px;border-radius:var(--m-r-xs);background:linear-gradient(90deg,var(--sp-cta) var(--p,50%),#D9D3C8 var(--p,50%))}' +
          '.sp-range::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-12px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}' +
          '.sp-range::-moz-range-track{height:4px;border-radius:var(--m-r-xs);background:#D9D3C8}.sp-range::-moz-range-progress{height:4px;background:var(--sp-cta)}.sp-range::-moz-range-thumb{width:28px;height:28px;border:0;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}' +
          '}@media (prefers-reduced-motion:reduce){[data-maker-lower-third]:has(>[data-stage-tools]),[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transition:none}}'}
      </style>

      {/* ══ ▶ WHAT IS PLAYING — Build in · Action · Build out, the one now in bold, and any phase the part has none of
          named ("Build out: none"), so a blank never reads as a fault. Shown over the page while it plays. ══ */}
      {seq && (playing || seq.skipped.length > 0) ? <StagePlayStatus phase={seq.phase} skipped={seq.skipped} /> : null}

      {/* ══ ↕ THE GRAB — 44 × 5 in a 14 px strip; the tap reaches 15 px above and below ══ */}
      <button
        type="button"
        aria-label="Resize the tools — drag, or tap"
        data-stage-grab=""
        className={`-mx-[10px] ${SP_GRAB}`}
        onPointerDown={(e) => {
          grabFrom.current = { y: e.clientY, h: ltNow };
          setGrabbing(true);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const f = grabFrom.current;
          if (f && Math.abs(e.clientY - f.y) >= MAKER_LT_TAP_PX) setHeight(clampLt(f.h + (f.y - e.clientY)));
        }}
        onPointerUp={(e) => {
          const f = grabFrom.current;
          grabFrom.current = null;
          setGrabbing(false);
          if (!f) return;
          const half = stagePanelOpenPx(window.innerHeight);
          if (Math.abs(e.clientY - f.y) < MAKER_LT_TAP_PX) keepLt(ltNow >= (STAGE_PANEL_REST_PX + half) / 2 ? STAGE_PANEL_REST_PX : half);
          else keepLt(clampLt(f.h + (f.y - e.clientY)));
        }}
        onPointerCancel={() => {
          grabFrom.current = null;
          setGrabbing(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          keepLt(clampLt(ltNow + (e.key === 'ArrowUp' ? 40 : -40)));
        }}
      >
        <span aria-hidden className={`h-[5px] rounded-sm transition-[width,background-color] duration-150 ${grabbing ? 'w-14 bg-[var(--sp-gold)]' : 'w-11 bg-[var(--sp-line2)]'}`} />
      </button>

      {/* ══ THE ROW — [ stage ▾ ] · [ Style | Text | Animate ] · ▶ ══ */}
      <div className={STAGE_ROW} data-stage-row="">
        <StageItemMenu
          options={options}
          stage={stageKey}
          page={rsvpOpen ? null : shownPage}
          rsvpScreen={screen}
          onPick={onPickPage}
          onRsvpScreen={(s) => {
            setScreen(s);
            /* The RSVP stage draws its three screens itself; ask it for this one once it is up. */
            window.setTimeout(() => document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${s}"]`)?.click(), 60);
          }}
        />
        {(
          <span role="group" aria-label="Edit with" className={STAGE_TOOL_PILL} data-stage-tpill="">
            {/* 🎚 ONE thumb that TRAVELS from tool to tool (owner 2026-10-08: "apply the same pill selector") — the app's
                thumb, in the selector's one terracotta, lying on the picked tool's 46 × 38 face (`data-seg-face`). The
                tools and the hairlines are the track's DIRECT children, so the thumb can find the picked one and a
                hairline can tell it sits beside it. */}
            <PillThumb />
            {MAKER_PART_TOOLS.map((t, i) => (
              <Fragment key={t}>
                {i > 0 ? <span aria-hidden data-stage-tool-divider="" className={STAGE_TOOL_DIVIDER} /> : null}
                <button
                  type="button"
                  aria-pressed={open && (styleOnly ? t === 'style' : tool === t)}
                  /* The Reveal, the Camera, the Digital pass and the RSVP stage's three screens have no Text or Animate saves of their own. */
                  disabled={styleOnly && t !== 'style'}
                  aria-label={MAKER_PART_TOOL_LABEL[t]}
                  title={MAKER_PART_TOOL_LABEL[t]}
                  data-stage-tool={t}
                  onClick={() => pickTool(t)}
                  className={STAGE_TOOL_BUTTON}
                >
                  <span data-seg-face="" className={STAGE_TOOL_FACE}>
                    {t === 'style' ? (
                      <Brush aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                    ) : t === 'text' ? (
                      <em className="font-serif text-[17px] font-semibold not-italic leading-none">Aa</em>
                    ) : (
                      <Diamond aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
                    )}
                  </span>
                </button>
              </Fragment>
            ))}
          </span>
        )}
        <button type="button" aria-label={playing ? 'Stop' : picked ? 'Play this part' : 'Play the stage as guests see it'} data-stage-play="" onClick={play} className={STAGE_ICON_BUTTON}>
          <span className={STAGE_ICON_FACE}>
            {playing ? <Square aria-hidden className="h-4 w-4" strokeWidth={2.2} /> : <Play aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />}
          </span>
        </button>
      </div>

      {/* ══ NOTHING PICKED, DRAGGED TALLER — "Tap a part of the page", and the page's parts (prototype `.nosel`) ══ */}
      {open || folded ? null : (
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2" data-stage-nosel="">
          <p className="flex h-9 shrink-0 items-center gap-2 px-1.5 text-[13px] font-semibold text-[var(--sp-ink2)]">
            Tap a part of the page — {MAKER_PART_TOOL_LABEL[tool]} will act on it
          </p>
          <div role="group" aria-label="Parts of this page" data-stage-strip="" className="flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {parts.map((k) => {
              const src = makerPartSource(k);
              const tag = src.kind === 'info' ? 'Info' : src.kind === 'studio' ? 'Studio' : src.kind === 'supplier' ? 'Suppliers' : null;
              return (
                <button key={k} type="button" aria-pressed={picked === k} data-stage-part={k} onClick={() => pickPart(k)} className={STAGE_PART_TILE}>
                  <span aria-hidden className="flex flex-1 items-center justify-center border-b border-[var(--sp-line)] bg-white p-1.5 text-[var(--sp-gold)]">
                    {src.kind === 'studio' ? <PencilLine className="h-5 w-5" strokeWidth={2} /> : src.kind === 'info' ? <FileText className="h-5 w-5" strokeWidth={2} /> : src.kind === 'supplier' ? <Store className="h-5 w-5" strokeWidth={2} /> : <Brush className="h-5 w-5" strokeWidth={2} />}
                  </span>
                  <span className="block truncate px-1 pt-1.5 text-[12.5px] font-medium text-[var(--sp-ink2)]">{makerPartLabelOn(stageKey, k)}</span>
                  <span className="block h-[15px] truncate px-1 pb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--sp-gold)]">{tag ?? ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ 🎭 THE REVEAL'S TOOLS — its kinds, Extras ▾, Arrange › Hidden on this stage ══ */}
      {open && revealOpen && revealStage ? <RevealPartTools stage={revealStage} /> : revealLeadsHere && revealStage ? (
        /* Mounted unseen while another part is picked, so the page's Reveal draws the opening chosen. */
        <div hidden>
          <RevealPartTools stage={revealStage} />
        </div>
      ) : null}
      {/* ══ 🎛 THE CAMERA'S TOOLS — Style › Look: Classic · Your brand · Challenges ══ */}
      {open && cameraOpen ? <CameraPartTools /> : null}
      {revealPlaying && revealStage ? <RevealPlay stage={revealStage} onDone={() => setRevealPlaying(false)} /> : null}
      {/* ══ ＋ ↕ 🗑 — on the picked part's edges, over the page ══ */}
      <PartEdits
        stage={stageKey}
        picked={open && !rsvpOpen && !cameraOpen ? picked : null}
        onPrev={placeOf > 0 || (placeOf === 0 && !isFirstPage) ? () => step(-1) : null}
        onNext={placeOf >= 0 && (placeOf < ordered().length - 1 || !isLastPage) ? () => step(1) : null}
        onClose={deselect}
      />

      {/* ══ THE GUEST'S TAB BAR, at the foot of the page preview — "You're editing · Invitation › Welcome" over it ══ */}
      {shellEl && !away
        ? createPortal(
            <nav
              aria-label="The guest's pages"
              data-stage-guest-bar=""
              className="absolute inset-x-0 z-[25] border-t border-[var(--sp-line)] bg-white lg:hidden"
              /* It rides the panel's rise and fall (the same 240 ms), never across it. */
              style={{ bottom: 'calc(var(--maker-lt-h) + env(safe-area-inset-bottom))', transition: `bottom ${STAGE_PANEL_MS}ms cubic-bezier(.16,1,.3,1)` }}
            >
              <p
                data-stage-caption=""
                className="flex h-[18px] items-center justify-center border-b border-[var(--sp-gold-soft)] bg-[var(--sp-gold-wash)] text-[8.5px] font-bold uppercase tracking-[0.14em] text-[var(--sp-mute)]"
              >
                You’re editing ·<b className="ml-1 text-[var(--sp-ink2)]">{makerStageLabel(stageKey as never)}{pageLabel && pages.length > 1 ? ` › ${pageLabel}` : ''}</b>
              </p>
              {pages.length > 1 ? (
                <div className="flex h-11 items-stretch px-1">
                  {pages.map((p) => {
                    const here = p.key === shownPage;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        aria-current={here ? 'page' : undefined}
                        data-stage-guest-tab={p.key}
                        onClick={() => {
                          if (here) return;
                          if (rsvpOpen) {
                            setScreen(p.key as RsvpStageScene);
                            document.querySelector<HTMLElement>(`[data-rsvp-stage-scene="${p.key}"]`)?.click();
                          } else {
                            /* Another page: the picked part is let go (the owner: "the picked part clears") — and its
                               tools with it, as ✕ does: the panel never keeps the look options of a part on the page
                               before (measured on the preview, 08 Oct). */
                            deselect();
                            goToPage(p.key, p.option);
                          }
                        }}
                        className={STAGE_GUEST_TAB}
                      >
                        {here ? <span aria-hidden className="absolute inset-x-2.5 top-0 h-[2.5px] rounded-sm bg-[var(--sp-ink)]" /> : null}
                        <span className="max-w-full truncate">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </nav>,
            shellEl,
          )
        : null}
    </div>
  );
}

/**
 * 🎯 Bring a part to the MIDDLE of the page band left above the guest bar (prototype
 * `centrePicked`): `top + h/2 − band/2`; a part taller than the band lines up with its
 * top. The canvas is the stage's shown, same-origin frame; it gets the room below to
 * centre its last part too (its own `padding-bottom`, set once).
 */
function centrePart(key: string, el: string | null) {
  try {
    const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!frame || !doc || !win) return;
    let node: Element | null = findMakerSection(doc, key);
    if (node && el) node = node.querySelector(`[data-el="${CSS.escape(el)}"]`) ?? node;
    if (!node) return;
    const fr = frame.getBoundingClientRect();
    const k = frame.clientWidth > 0 ? fr.width / frame.clientWidth : 1;
    const bar = document.querySelector('[data-stage-guest-bar]')?.getBoundingClientRect();
    const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
    const bottom = Math.min(fr.bottom, bar && bar.height > 0 ? bar.top : Infinity, lt ? lt.top : Infinity);
    const band = (bottom - fr.top) / k;
    if (band <= 40) return;
    doc.body.style.paddingBottom = `${Math.round(band / 2)}px`;
    const r = node.getBoundingClientRect();
    const dy = r.height >= band - 24 ? r.top - 12 : r.top + r.height / 2 - band / 2;
    /* An absolute target — a scroll still gliding from the last pick cannot add to it. */
    if (Math.abs(dy) > 2) win.scrollTo({ top: Math.max(0, win.scrollY + dy), behavior: 'smooth' });
  } catch {
    /* a frame we cannot reach keeps its own scroll */
  }
}
