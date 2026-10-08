'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PillThumb } from '@/app/_components/pill-selector';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { createPortal } from 'react-dom';
import { Check, Play, Reply, Square, X, type LucideIcon } from 'lucide-react';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { RSVP_STAGE_SCENES, isRsvpStageScene, type RsvpStageScene } from '@/lib/rsvp-stage';
import {
  MAKER_PARTS,
  MAKER_PART_TOOLS,
  MAKER_PART_TOOL_LABEL,
  makerPartOfTap,
  makerPartQuietRow,
  makerPartSource,
  makerPartToolWhy,
  makerPartToolWorks,
  makerPartsOnPage,
  makerPartsTappable,
  makerStepPart,
  makerWorkTool,
  type MakerPartKey,
  type MakerPartTool,
  type MakerStageKey,
} from '@/lib/maker-parts';
import {
  STAGE_BAR_FOOT_CSS,
  STAGE_BAR_GRID_CSS,
  STAGE_BAR_HANDLE,
  STAGE_BAR_LINE,
  STAGE_BAR_ROW_VARS,
  STAGE_GUEST_TAB,
  STAGE_ICON_BUTTON,
  STAGE_ICON_FACE,
  STAGE_PANEL_MS,
  STAGE_PANEL_VARS,
  STAGE_ROW,
  STAGE_TOOL_BUTTON,
  STAGE_TOOL_INSET,
  STAGE_TOOL_PILL,
  stageBarPx,
} from '@/lib/maker-stage-room';
import { fixedOfKey, fixedScenePanel } from '@/lib/maker-selection';
import { makerPartStudioDoor, makerStagePickedAttr, makerStageMayType } from '@/lib/maker-parts';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { showHubTab, shownHubTab } from '@/app/[slug]/_components/hub-tab-dom';
import {
  RSVP_GROUND_MESSAGE,
  RSVP_PICKED_MESSAGE,
  RSVP_PICK_MESSAGE,
  RSVP_STAGE_ASK_EVENT,
  RSVP_STAGE_BAR_SLOT,
  RSVP_STAGE_SCENE_EVENT,
  RSVP_TYPING_MESSAGE,
  rsvpStageFrameSelector,
} from '@/app/[slug]/_components/rsvp-canvas-parts';
import { setStagePanelNow, setStageRevealColours, setStageTool, useStageRevealLook, type StageQuiet } from './stage-panel/store';
import { StageEdit } from './stage-panel/stage-edit';
import { revealStubHtml } from './stage-panel/reveal-picture';
import type { StudioTileKey } from '@/lib/studio-tiles';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { MAKER_OPEN_PART_EVENT, MAKER_STAGE_PICK_EVENT, MAKER_STAGE_TOOL_EVENT, useMaker } from './maker-context';
import { makerPagePick, makerPageValue, makerStageLabel } from './maker-bar';
import type { StagePageOption } from './stage-item-menu';
/* ＋ ↕ 🗑 🎭 PR 3 — the part's edges, the ＋ sheet, the one confirm, the Reveal part (same lazy chunk). */
import { RevealPartTools, RevealPlay, makerPartTopOnScreen, revealStageOf, usePartEdits } from './add-part-sheet';
import { partsInPageOrder } from '@/lib/maker-part-step';
import { CameraPartTools, StagePlayStatus } from './details-lazy';

import { makerPartLabelOn, makerPartOfCanvas, makerPartsWithAdded } from '@/lib/maker-part-groups';
import { filedOnCanvas, firstMarkerOnPage, makerStagesPages } from '@/lib/maker-stage-filing';

/**
 * 🎬 THE STAGES TOOLBAR — the new Maker's bottom bar on the Stages side, on a phone (owner 2026-10-09, the approved
 * clickable prototype `public/review/studio-head-prototype.html`; `TOOLBAR-SPEC-2026-10-09.md`, every quote his).
 * Behind `makerStagesStudioEnabled`; loaded lazily (`details-lazy.tsx`), so the shipped Maker's first load carries none.
 *
 *   SHAPE    ONE FIXED HEIGHT (*"330 px it is"*), its top CURVED (*"make the upper part of the bottom toolbar
 *            curve"*), top to bottom (`lib/maker-stage-room.ts` `stageBarPx`):
 *              the handle                                         14   (drawn — nothing is dragged or folded)
 *              YOU'RE EDITING · INVITATION › DETAILS › VENUE      20   (*"but this above your editing"*)
 *              [ Edit | Style | Background | Animate ]  ▶         52   (*"so it is just Edit | Style | Background |
 *                                                                       Animate"* — words only, as wide as their words)
 *              FOUR ROWS                                          48-px rows, 6 apart (44 / 4 on a short phone)
 *              the room under the last row                        the phone's safe area, never under 10
 *   ROWS     *"the rule is always start from the top"*: a tool fills from row 1, its empty rows are at the bottom,
 *            and nothing scrolls up and down. Edit's rows are this file's own (`stage-panel/stage-edit.tsx`); Style,
 *            Background and Animate are the work area's, laid over the same four rows (`[data-phone-chrome="panel"]`).
 *   GONE     the stage ▾ (the top bar's Stages ▾ opens `StageItemMenu` — *"means we can remove this"*), "Tap a part
 *            of the page" and the row of part tiles (*"these are not the tools"*), the drag and the fold.
 *   SWIPE    across the toolbar: the next / previous part, on into the next page.
 *   ▶        the part picked, or — nothing picked — the whole stage, scene by scene; the toolbars slide away and
 *            one tap stops it.
 *   TYPING   the words of a plain-text part are typed ON THE PAGE: the toolbar slides away, the keyboard takes the
 *            bottom half, Done brings it back (the shipped `type-in-place.tsx` bar; one draft value with Studio ›
 *            Info — `the-typing-door-is-the-info-door.test.ts`).
 *   TAB BAR  the guest's own tab bar stays a BAR under the page preview (*"that is the bottom nav of the actual
 *            event hub"*) — a tap there changes page as a guest would.
 *
 * 🔑 A PICK IS A PAGE TAP. The toolbar asks the work area exactly what a tap on that part of the page asks
 * (`{ t: 'edit', key, el }` — the canvas's own message, `editor-bridge.tsx`), so the selection, the tools and the
 * page's outline are the shipped ones. The selector asks the work area for the tool's body
 * (`MAKER_STAGE_TOOL_EVENT`, `makerWorkTool`) and says which of the four is on (`setStageTool`).
 *
 * 🔒 NOTHING HERE WRITES. Every change is the shipped tools' own draft save, shown at once, counted on ✓,
 * published at Apply.
 */

/** 📐 The phone's own safe area at the foot of the screen (`env(safe-area-inset-bottom)`), in px — measured, never guessed. */
function safeBottomPx(): number {
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return Number.isFinite(h) && h > 0 ? h : 0;
  } catch {
    return 0;
  }
}

/** Where Style's quiet row last took the couple — the panel picks the same part when they come back (‹). */
let resumeAt: { stage: MakerStageKey; page: string | null; part: MakerPartKey } | null = null;
/** 🧭 The tab that was on screen when this panel last stood — it is put back when the couple returns from Studio
 *  (the panel is not mounted there, and an edit made there reloads the canvas onto its first tab). */
let lastTab: { of: string; stage: LifecyclePhase; tab: string } | null = null;

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/* ── 🗳 THE RSVP STAGE: three screens, each its own frame (`maker-rsvp-stage.tsx`), each piece a part ──────────── */

/** The page tabs' icons — the prototype's `PICON` (i-reply · i-check · i-x). */
const RSVP_TAB_ICON: Record<RsvpStageScene, LucideIcon> = { form: Reply, thanks: Check, decline: X };

/**
 * A part's ONE door on the RSVP stage is where its content really lives FOR THESE SCREENS: the couple's mark, their
 * names, the date and the place keep their own (Logo · Info · Suppliers); the form and the two notes are the RSVP
 * tool's. The rest — each guest's own name, their ticket, the door's fixed words — has no door: its name, and ⓘ.
 */
const RSVP_OWN_DOOR: readonly MakerPartKey[] = ['logo', 'names', 'date', 'place'];
const RSVP_TOOL_PARTS: readonly MakerPartKey[] = ['rsvp', 'yesnote', 'nonote'];
function rsvpQuietRow(picked: MakerPartKey | null): ReturnType<typeof makerPartQuietRow> {
  if (!picked || RSVP_TOOL_PARTS.includes(picked)) return makerPartQuietRow('rsvp');
  return RSVP_OWN_DOOR.includes(picked) ? makerPartQuietRow(picked) : null;
}
/** ⓘ What a piece of the reply pages is, where nothing else says (host-only words, never a guest's). */
const RSVP_PART_ABOUT: Partial<Record<MakerPartKey, string>> = {
  ename: 'Every reply page opens with these words.',
  heroline: 'Your invitation line. You type it on the Invitation’s Welcome page.',
};

/** Ask the RSVP stage: show that screen · open (or fold) the picked part's tools. */
function askRsvpStage(detail: { scene?: RsvpStageScene; controls?: boolean }) {
  window.dispatchEvent(new CustomEvent(RSVP_STAGE_ASK_EVENT, { detail }));
}

/** The canvas keys the stage's page drew (its section markers) — what a tile can reach. */
function readPresent(frameSel: string = SHOWN_FRAME): Set<string> {
  const out = new Set<string>();
  try {
    const doc = document.querySelector<HTMLIFrameElement>(frameSel)?.contentDocument;
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
  /** The toolbar's height (px, less the phone's safe area — the lower third adds that itself) — null: the lower third's own. */
  onPx: (px: number | null) => void;
}) {
  const maker = useMaker();
  const openTool = maker?.tool ?? null;
  const stageKey: MakerStageKey = rsvpOpen ? RSVP_STAGE_KEY : stage;
  const [screen, setScreen] = useState<RsvpStageScene>('form');
  const [tool, setTool] = useState<MakerPartTool>('edit');
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
    /* 🗳 The RSVP stage's screens go by ONE word each, on the tab and in the label over it: Form · When yes · When no. */
    if (rsvpOpen) return RSVP_STAGE_SCENES.map((s) => ({ key: s.key as string, label: s.tab, tab: s.tab, option: RSVP_STAGE_KEY as string }));
    const own = new Set(makerStagesPages(stage).map((p) => p.key));
    return options.flatMap((o) => {
      const pk = makerPagePick(o.key);
      return pk?.kind === 'page' && pk.stage === stage && own.has(pk.page) ? [{ key: pk.page, label: o.label, tab: o.label, option: o.key }] : [];
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
  /** 🗳 The frame the stage's page is drawn in: the shown canvas — or, on the RSVP stage, the screen on show. */
  const frameSel = rsvpOpen ? rsvpStageFrameSelector(screen) : SHOWN_FRAME;
  /* 🗳 The RSVP stage's parts are the ones its screen DREW (its markers, and the masthead's named parts) — never a
     tile for a piece the page did not draw (no venue yet, no invitation line). */
  const parts = useMemo(
    () => (rsvpOpen ? makerPartsTappable(RSVP_STAGE_KEY, screen, present) : tappableOn(shownPage)),
    [present, rsvpOpen, screen, shownPage, tappableOn],
  );
  const pageLabel = pages.find((p) => p.key === shownPage)?.label ?? null;

  /* The canvas's sections, read again whenever a canvas says it is ready, or the page moves. */
  useEffect(() => {
    const read = () => {
      setPresent(readPresent(frameSel));
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
      /* …or an RSVP screen says it is up (`rsvpReady`): its parts are named by then. */
      if (d?.source === 'setnayan-site' && (d.t === 'ready' || d.t === 'rsvpReady')) window.setTimeout(read, 60);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [stage, shownPage, frameSel]);

  /* 🗳 THE RSVP SCREEN ON SHOW IS THE STAGE'S TO SAY (`RSVP_STAGE_SCENE_EVENT`) — the label and the tab under-
     line follow the canvas, never a guess (the rule every Stages tab keeps). `wanted`: a screen asked for before
     the stage was up is asked for again once it says where it is. */
  const wanted = useRef<RsvpStageScene | null>(null);
  /** 🧭 The slot at the foot of the RSVP stage's own column, where its tab row stands (`RSVP_STAGE_BAR_SLOT`). */
  const [rsvpBarSlot, setRsvpBarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!rsvpOpen) return setRsvpBarSlot(null);
    const findSlot = () => setRsvpBarSlot(document.querySelector<HTMLElement>(`[${RSVP_STAGE_BAR_SLOT}]`));
    findSlot();
    const now = document.querySelector('[data-rsvp-stage]')?.getAttribute('data-rsvp-stage');
    if (isRsvpStageScene(now)) {
      /* A screen asked for on the way in (the stage menu's "When yes") is asked for now that the stage is up. */
      if (wanted.current && wanted.current !== now) askRsvpStage({ scene: wanted.current });
      else setScreen(now);
    }
    const onScene = (e: Event) => {
      const s = (e as CustomEvent<unknown>).detail;
      if (!isRsvpStageScene(s)) return;
      /* The stage is up (it says so as it mounts): its slot is there to stand the tab row in. */
      findSlot();
      const w = wanted.current;
      wanted.current = null;
      if (w && w !== s) return askRsvpStage({ scene: w });
      setScreen(s);
      /* Its parts are read off the frame now on show (a kept frame says `rsvpReady` only once). */
      window.setTimeout(() => setPresent(readPresent(rsvpStageFrameSelector(s))), 60);
    };
    window.addEventListener(RSVP_STAGE_SCENE_EVENT, onScene);
    return () => window.removeEventListener(RSVP_STAGE_SCENE_EVENT, onScene);
  }, [rsvpOpen]);
  /** Open one of the RSVP stage's three screens — from its top (the stage tells its frame, `rsvpTop`). */
  const goToScreen = useCallback((s: RsvpStageScene) => {
    wanted.current = s;
    setScreen(s);
    askRsvpStage({ scene: s });
  }, []);

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
  /* 📐 THE TOOLBAR IS ONE HEIGHT (owner 2026-10-09: *"330 px it is"* — `stageBarPx`): the same with a part picked
     or none, never dragged, never folded. ▶ playing or ⌨ typing: away, no gap. The lower third adds the phone's
     safe area to what it is told, so it is told the rest. */
  useEffect(() => {
    if (playing || typing) {
      onPx(0);
      return;
    }
    const say = () => {
      const safe = safeBottomPx();
      onPx(stageBarPx(window.innerHeight, safe) - safe);
    };
    say();
    window.addEventListener('resize', say);
    return () => window.removeEventListener('resize', say);
  }, [playing, typing, onPx]);
  useEffect(() => () => onPx(null), [onPx]);
  /* 🎯 THE PICKED PART IN THE MIDDLE of the page left above the panel (prototype `centrePicked`: "making
     sure they see what element they are editing") — once the panel has risen; a part taller than that
     band lines up with its top. The canvas is a same-origin frame, scrolled here directly. */
  const pickedKey = picked ? MAKER_PARTS[picked].canvas : null;
  const pickedEl = picked ? (MAKER_PARTS[picked].el ?? null) : null;
  useEffect(() => {
    if (!open || !pickedKey) return;
    /* Once its tools are up — and again after the page under it settles (a page jump scrolls the canvas). */
    const t = window.setTimeout(() => centrePart(pickedKey, pickedEl, frameSel), STAGE_PANEL_MS + 40);
    const t2 = window.setTimeout(() => centrePart(pickedKey, pickedEl, frameSel), STAGE_PANEL_MS + 900);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, pickedKey, pickedEl, frameSel, shownPage]);
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
        /* Edit, Style and Background are all read off the scene's Format; Animate is the part's own (`makerWorkTool`). */
        const work = makerWorkTool(t);
        if (work !== 'style' && def?.canvas && def.el && !rsvpOpenRef.current) {
          window.dispatchEvent(
            new CustomEvent(MAKER_OPEN_PART_EVENT, { detail: { key: def.canvas, widgetType: def.canvas === 'f:hero' ? 'hero' : def.canvas.slice(2), el: def.el } }),
          );
        }
        window.dispatchEvent(new CustomEvent(MAKER_STAGE_TOOL_EVENT, { detail: work }));
      }),
    );
  }, []);
  const openToolRef = useRef(openTool);
  openToolRef.current = openTool;
  const rsvpOpenRef = useRef(rsvpOpen);
  rsvpOpenRef.current = rsvpOpen;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  /** The tool to open on a part: the one last used — or Edit, the first, where that one has nothing to set there (it
   *  is remembered all the same, and comes back on the next part that has it). */
  const toolFor = useCallback((k: MakerPartKey | null): MakerPartTool => (k && !makerPartToolWorks(k, toolRef.current) ? 'edit' : toolRef.current), []);
  const pickPart = useCallback(
    (k: MakerPartKey) => {
      setPicked(k);
      if (k === 'reveal' || k === 'camera') {
        /* 🎭 🎛 Its tools are drawn here; whatever the work area had open folds. */
        openToolRef.current?.close();
        return;
      }
      if (rsvpOpen) {
        /* The RSVP stage's screens carry their own tools (`maker-rsvp-stage.tsx`): they open for the part picked.
           ⚠ Never the `edit` below — the work area stays mounted under this stage and would take the selection. */
        askRsvpStage({ controls: true });
        return;
      }
      const def = MAKER_PARTS[k];
      if (!def.canvas) return;
      /* 🔑 The canvas's own message — the same selection a tap on the page makes. It carries `stagePick`: this panel
         hears its OWN message back in the very task the work area hears it (`onCanvas` below) and asks for the tool
         only then. Asked from here, two frames on, the ask could run BEFORE the message was delivered — the work area
         then opened the part's sheet on Text under a pressed Style pill (measured on the Maker lab, 2026-10-09:
         the tool was asked for at 487 ms, the pick arrived at 488 ms; Names and Logo, every time). */
      window.postMessage({ source: 'setnayan-site', t: 'edit', key: def.canvas, ...(def.el ? { el: def.el } : {}), stagePick: k }, window.location.origin);
    },
    [rsvpOpen],
  );
  const pickPartRef = useRef(pickPart);
  pickPartRef.current = pickPart;

  /* ── ↑ ↓ ✕ — the part above / below, and let go (owner 2026-10-07) ── */
  const deselect = useCallback(() => {
    setPicked(null);
    openToolRef.current?.close();
  }, []);
  const deselectRef = useRef(deselect);
  deselectRef.current = deselect;
  /** The page's parts in their VISUAL order (measured on the canvas) — the order ↑ ↓ and the swipe walk. */
  const ordered = useCallback(() => partsInPageOrder(parts, (k) => makerPartTopOnScreen(stageKey, k, frameSel)), [frameSel, parts, stageKey]);
  const placeOf = picked ? ordered().indexOf(picked) : -1;
  const isFirstPage = pages.findIndex((p) => p.key === shownPage) <= 0;
  const isLastPage = pages.findIndex((p) => p.key === shownPage) >= pages.length - 1;
  /* A part tapped ON THE PAGE: the panel follows it (the work area has already opened its tools). */
  const where = useRef({ stageKey, shownPage });
  where.current = { stageKey, shownPage };
  useEffect(() => {
    const onCanvas = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown; key?: unknown; el?: unknown; phase?: unknown; stagePick?: unknown } | null;
      if (d?.source !== 'setnayan-site') return;
      if (e.source === window) {
        /* This panel's own pick, heard back (`pickPart`): the work area has the selection now — ask for the tool. */
        if (d.t === 'edit' && typeof d.stagePick === 'string' && d.stagePick in MAKER_PARTS) {
          const k = d.stagePick as MakerPartKey;
          askTool(toolFor(k), k);
        }
        return;
      }
      if (d.t === 'edit' && typeof d.key === 'string') {
        const k =
          makerPartOfTap(where.current.stageKey, where.current.shownPage, d.key, typeof d.el === 'string' ? d.el : null) ??
          makerPartOfCanvas(where.current.stageKey, d.key);
        setPicked(k);
        askTool(toolFor(k), k);
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
      /* 🗳 THE RSVP STAGE'S SCREENS (`rsvp-canvas-bridge.tsx`) — their own messages, so the work area mounted under
         the stage never hears a tap there as one of its own (`rsvp-canvas-parts.ts`). A tap PICKS the part under it
         (the same map a tap on any stage's page reads); a tap on the ground lets it go; a second tap on the picked
         part's words types them on the page — the panel steps aside until Done. */
      else if (where.current.stageKey !== RSVP_STAGE_KEY) return;
      else if (d.t === RSVP_PICK_MESSAGE && typeof d.key === 'string') {
        const k = makerPartOfTap(RSVP_STAGE_KEY, where.current.shownPage, d.key, typeof d.el === 'string' ? d.el : null);
        if (k) pickPartRef.current(k);
        else deselectRef.current();
      } else if (d.t === RSVP_GROUND_MESSAGE) deselectRef.current();
      else if (d.t === RSVP_TYPING_MESSAGE && d.phase === 'start') setTyping(true);
      else if (d.t === 'rsvpReady') sendRsvpPickedRef.current();
    };
    window.addEventListener('message', onCanvas);
    return () => window.removeEventListener('message', onCanvas);
  }, [askTool, toolFor]);

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
  /* 🗳 …and the RSVP stage's screens are told which part is picked: a tap on ITS words types them there
     (`makerStageMayType`, asked on the page in the tap itself — a phone raises its keyboard only then). */
  const sendRsvpPicked = useCallback(() => {
    const now = document.querySelector('[data-maker-shell]')?.getAttribute('data-stage-picked') ?? null;
    document.querySelectorAll<HTMLIFrameElement>('iframe[data-rsvp-stage-frame]').forEach((f) => {
      f.contentWindow?.postMessage({ source: 'setnayan-editor', t: RSVP_PICKED_MESSAGE, picked: now }, window.location.origin);
    });
  }, []);
  const sendRsvpPickedRef = useRef(sendRsvpPicked);
  sendRsvpPickedRef.current = sendRsvpPicked;
  useEffect(() => {
    if (rsvpOpen) sendRsvpPicked();
  }, [rsvpOpen, open, picked, sendRsvpPicked]);

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
      if (rsvpOpen) goToScreen(r.page as RsvpStageScene);
      else goToPage(r.page, makerPageValue(stage, r.page));
    },
    [goToPage, goToScreen, ordered, pages, parts, pickPart, picked, rsvpOpen, shownPage, stage, tappableOn],
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
      const skip = t?.closest?.('input, textarea, select, [role="slider"], [data-style-carousel], [data-maker-sheet], [aria-expanded="true"]');
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
    if (def?.canvas && !rsvpOpen) {
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
    const q = rsvpOpen ? rsvpQuietRow(picked) : picked && picked !== 'reveal' ? makerPartQuietRow(picked) : null;
    let quiet: StageQuiet | null = null;
    if (q) {
      if ('suppliers' in q.to) quiet = { kind: 'suppliers', words: q.words, href: suppliersHref };
      else {
        const to = q.to.studio;
        /* (On the RSVP stage only the form's and the notes' own words are typed on the page — never the masthead's.) */
        const typed = picked && !rsvpOpen ? makerPartSource(picked).kind === 'info' : false;
        quiet = {
          kind: to === 'info' ? 'info' : 'studio',
          /* One button, one line (the button rule: icon + word, no "›" tail). A part whose words are typed on the
             page still says so — the prototype's "or tap the words". */
          words: to === 'info' && typed ? `${q.words} · or tap the words` : q.words,
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
    const about = (f ? [f.line, f.source?.text].filter(Boolean).join(' ') || null : null) ?? (rsvpOpen && picked ? (RSVP_PART_ABOUT[picked] ?? null) : null);
    setStagePanelNow({ picked, quiet, about });
  }, [picked, rsvpOpen, suppliersHref, stageKey, shownPage, onOpenStudio, fixedHere]);
  useEffect(() => () => setStagePanelNow({ picked: null, quiet: null, about: null }), []);

  /* 🚫 A TOOL WITH NOTHING TO SET ON THE PICKED PART (`makerPartToolWorks`): grey, `aria-disabled`, and a tap says
     one line why. Edit and Style are every part's. The Reveal, the Camera, the pass and the RSVP pages have no
     Background or Animate; nor has any part with no save for it (E-Gifts, What to wear …). With nothing picked every
     tool is live — the rows under it are empty until a part is. */
  const toolWorks = (t: MakerPartTool) => !picked || t === 'edit' || t === 'style' || (!styleOnly && makerPartToolWorks(picked, t));
  /** The tool the rows are showing: the remembered one, or Edit — the first — where that one has nothing here. */
  const shownTool: MakerPartTool = toolWorks(tool) ? tool : 'edit';
  /* …said to the work area's body under the selector (`StageStyle` shows that tool's part of the scene's Format). */
  useEffect(() => setStageTool(shownTool), [shownTool]);
  const [why, setWhy] = useState<{ words: string; n: number } | null>(null);
  const pickTool = (t: MakerPartTool) => {
    if (!toolWorks(t)) return setWhy((w) => ({ words: makerPartToolWhy(picked, t), n: (w?.n ?? 0) + 1 }));
    setTool(t);
    /* Nothing picked: the tool is remembered for the next part. The Reveal's body is this toolbar's own. */
    if (!picked || picked === 'reveal') return;
    /* Edit, Style and Background share ONE body in the work area — it is asked again only for another one, or when
       nothing of it is up (a part's Animate folded it). */
    if (open && makerWorkTool(t) === makerWorkTool(shownTool)) return;
    askTool(t, picked);
  };
  const away = typing || playing;
  /* 🧷 THE FIRST RENDER IN THE BROWSER IS THE SERVER'S. The guest bar is drawn into the Maker's shell, and the shell
     was looked up WHILE RENDERING — nothing on the server, the element in the browser — so the browser's first render
     held a <nav> the server's HTML did not, and React refused the server's panel and rebuilt it. The shell is now
     found once the panel is on the page (before the browser paints, so the bar never arrives a frame late). */
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setShellEl(document.querySelector<HTMLElement>('[data-maker-shell]')), []);
  /** Where the tab row is drawn: over the foot of the stage's canvas — or, on the RSVP stage, in that stage's own
   *  column (never the shell there: the RSVP layer would cover it). */
  const guestBarHost = rsvpOpen ? rsvpBarSlot : shellEl;
  /* ── ↑ ↓ 🗑 the picked part's frame over the page — and its place, for Edit's last row (`usePartEdits`) ── */
  const edits = usePartEdits({
    stage: stageKey,
    picked: open && !cameraOpen ? picked : null,
    frame: rsvpOpen ? frameSel : undefined,
    onPrev: placeOf > 0 || (placeOf === 0 && !isFirstPage) ? () => step(-1) : null,
    onNext: placeOf >= 0 && (placeOf < ordered().length - 1 || !isLastPage) ? () => step(1) : null,
    onClose: deselect,
  });
  /** Edit's rows are this toolbar's own; every other tool's are the work area's (or the Reveal's / the Camera's). */
  const editOn = picked !== null && shownTool === 'edit';
  /** "You're editing · Stage › Page › Part" — the page only where the stage has several, the part once one is picked. */
  const editingTrail = [makerStageLabel(stageKey as never), pageLabel && pages.length > 1 ? pageLabel : null, picked ? makerPartLabelOn(stageKey, picked) : null]
    .filter(Boolean)
    .join(' › ');

  return (
    <div
      ref={rootRef}
      data-stage-tools=""
      data-stage-open={open ? '' : undefined}
      data-stage-tool-now={shownTool}
      aria-hidden={away || undefined}
      className={`flex min-h-0 flex-1 flex-col rounded-t-2xl border-t border-[var(--sp-line2)] bg-[var(--sp-page)] px-[10px] transition-transform ease-out motion-reduce:transition-none ${away ? 'pointer-events-none translate-y-[110%]' : ''}`}
      style={{ transitionDuration: `${STAGE_PANEL_MS}ms` }}
    >
      {/* One rule set, drawn only while this toolbar is (phone only): the prototype's colours and the frame's two
          measures (`--sp-rh` a row, `--sp-rg` a gap); the lower third as the toolbar's own ground — paper behind its
          curved corners, the guest bar's white, so the curve reads as the toolbar's own; and the work area's tool
          laid over exactly the FOUR ROWS: as tall as they are, standing on the room kept under the last row. On
          Edit the rows are this toolbar's own and the work area's tool waits under them, out of sight. */}
      <style>
        {`html:has([data-stage-tools]){${STAGE_PANEL_VARS}}` +
          STAGE_BAR_ROW_VARS +
          '@media (max-width:1023.98px){' +
          '[data-maker-lower-third]:has(>[data-stage-tools])>:not([data-stage-tools]){display:none}' +
          '[data-maker-lower-third]:has(>[data-stage-tools]){transition:height 240ms cubic-bezier(.16,1,.3,1);background:var(--sp-paper)!important;border-top:0!important;padding:0!important;gap:0!important;box-shadow:none!important}' +
          `[data-maker-shell]:has([data-stage-tools]) [data-phone-chrome="panel"]{left:0!important;right:0!important;bottom:${STAGE_BAR_FOOT_CSS}!important;height:${STAGE_BAR_GRID_CSS}!important;outline:none!important;border-radius:0!important;box-shadow:none!important;background:var(--sp-page)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important}` +
          '[data-maker-shell]:has([data-stage-tool-now="edit"]) [data-phone-chrome="panel"]{visibility:hidden;pointer-events:none}' +
          '[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transform:translateY(-110%);transition:transform 240ms ease-out}' +
          '}@media (prefers-reduced-motion:reduce){[data-maker-lower-third]:has(>[data-stage-tools]),[data-maker-shell][data-stage-playing] [data-phone-chrome="bar"]{transition:none}}'}
      </style>

      {/* ══ ▶ WHAT IS PLAYING — Build in · Action · Build out, the one now in bold, and any phase the part has none of
          named ("Build out: none"), so a blank never reads as a fault. Shown over the page while it plays. ══ */}
      {seq && (playing || seq.skipped.length > 0) ? <StagePlayStatus phase={seq.phase} skipped={seq.skipped} /> : null}
      {/* ══ 🚫 WHY A GREY TOOL DID NOTHING — one line, the app's toast, gone by itself ══ */}
      {why ? (
        <PeekToast key={why.n} tone="note" data="tool-why" onGone={() => setWhy((w) => (w?.n === why.n ? null : w))}>
          {why.words}
        </PeekToast>
      ) : null}

      {/* ══ THE HANDLE — the prototype's 40 × 4 pill in a 14 px strip. Drawn: the toolbar is one height. ══ */}
      <div aria-hidden data-stage-handle="" className={STAGE_BAR_HANDLE}>
        <span className="h-1 w-10 rounded-full bg-[var(--sp-line2)]" />
      </div>

      {/* ══ YOU'RE EDITING · STAGE › PAGE › PART — under the handle, over the selector ══ */}
      <p data-stage-caption="" className={STAGE_BAR_LINE}>
        You’re editing · <b className="font-semibold text-[var(--sp-ink)]">{editingTrail}</b>
      </p>

      {/* ══ THE SELECTOR — [ Edit | Style | Background | Animate ] · ▶ ══ */}
      <div className={STAGE_ROW} data-stage-row="">
        <span role="group" aria-label="Edit with" className={STAGE_TOOL_PILL} data-stage-tpill="">
          {/* 🎚 ONE thumb that TRAVELS from tool to tool (owner 2026-10-08: "apply the same pill selector") — the app's
              thumb, in the selector's one accent, lying 3 px inside the picked tool's box and as wide as its word. The
              tools are the track's DIRECT children, so the thumb can find the picked one. */}
          <PillThumb />
          {MAKER_PART_TOOLS.map((t) => (
            <button
              key={t}
              type="button"
              /* The thumb rests on the tool whose rows are on screen — never on one with nothing to set here. */
              aria-pressed={shownTool === t}
              /* Grey, and it still hears a tap — the tap says why (`pickTool`). Never `disabled`: that is a dead tap. */
              aria-disabled={toolWorks(t) ? undefined : true}
              data-stage-tool={t}
              data-seg-inset={STAGE_TOOL_INSET}
              onClick={() => pickTool(t)}
              className={STAGE_TOOL_BUTTON}
            >
              {MAKER_PART_TOOL_LABEL[t]}
            </button>
          ))}
        </span>
        <button type="button" aria-label={playing ? 'Stop' : picked ? 'Play this part' : 'Play the stage as guests see it'} data-stage-play="" onClick={play} className={STAGE_ICON_BUTTON}>
          <span className={STAGE_ICON_FACE}>
            {playing ? <Square aria-hidden className="h-4 w-4" strokeWidth={2.2} /> : <Play aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />}
          </span>
        </button>
      </div>

      {/* ══ THE FOUR ROWS — Edit's are drawn here; the work area's tool lies over this same box for the other three.
          Nothing picked: empty (the prototype's `drawStrip` with no part). ══ */}
      <div data-stage-rows="" className="flex min-h-0 flex-1 flex-col [&>*]:!mt-0">
        {editOn ? <StageEdit earlier={edits.earlier} later={edits.later} remove={edits.remove} removeWord={edits.removeWord} /> : null}
        {/* ══ 🎭 THE REVEAL'S TOOLS — its kinds, Extras ▾ — under Style. Mounted unseen while another part (or Edit)
            is on, so the page's Reveal draws the opening chosen. ══ */}
        {revealStage && (revealOpen || revealLeadsHere) ? (
          <div data-stage-reveal-tools="" hidden={!(open && revealOpen && !editOn)} className={open && revealOpen && !editOn ? 'flex min-h-0 flex-1 flex-col' : undefined}>
            <RevealPartTools stage={revealStage} />
          </div>
        ) : null}
        {/* ══ 🎛 THE CAMERA'S TOOLS — Style: Classic · Your brand · Challenges ══ */}
        {open && cameraOpen && !editOn ? <CameraPartTools /> : null}
      </div>
      {revealPlaying && revealStage ? <RevealPlay stage={revealStage} onDone={() => setRevealPlaying(false)} /> : null}
      {/* ══ The picked part's frame over the page, its sheets and its toast ══ */}
      {edits.node}

      {/* ══ THE GUEST'S TAB BAR, a bar at the foot of the page preview (owner 2026-10-09: "that is the bottom nav of
          the actual event hub") — only where the stage has pages. "You're editing" left it for the toolbar's own line. ══ */}
      {/* 🗳 On the RSVP stage it stands IN the stage's own column, under its screens (`RSVP_STAGE_BAR_SLOT`): that
          stage is a layer over the work area, and a row drawn over the work area's foot was UNDER it — no finger
          could reach Form · When yes · When no (measured on the preview, 08 Oct). In flow there, the screens end
          above it at every height of the panel. */}
      {guestBarHost && !away
        ? createPortal(
            <nav
              aria-label="The guest's pages"
              data-stage-guest-bar=""
              /* A stage that is one page has no bar (its one line, "You're editing", is the toolbar's now). */
              hidden={pages.length <= 1}
              className={rsvpOpen ? 'relative border-t border-[var(--sp-line)] bg-white lg:hidden' : 'absolute inset-x-0 z-[25] border-t border-[var(--sp-line)] bg-white lg:hidden'}
              /* It rides the toolbar's slide away and back (the same 240 ms), never across it. */
              style={rsvpOpen ? undefined : { bottom: 'calc(var(--maker-lt-h) + env(safe-area-inset-bottom))', transition: `bottom ${STAGE_PANEL_MS}ms cubic-bezier(.16,1,.3,1)` }}
            >
              {
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
                            /* 🗳 The RSVP stage's three screens are pages too: the picked part is let go, then the
                               screen opens — from its top (`goToScreen`). */
                            deselect();
                            goToScreen(p.key as RsvpStageScene);
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
                        {rsvpTabIcon(rsvpOpen, p.key)}
                        <span className="max-w-full truncate">{p.tab}</span>
                      </button>
                    );
                  })}
                </div>
              }
            </nav>,
            guestBarHost,
          )
        : null}
    </div>
  );
}

/** 🗳 The RSVP stage's page tabs carry the prototype's icons (`PICON`): reply · check · x. */
function rsvpTabIcon(rsvpOpen: boolean, key: string) {
  if (!rsvpOpen || !isRsvpStageScene(key)) return null;
  const Icon = RSVP_TAB_ICON[key];
  return <Icon aria-hidden data-stage-guest-tab-icon={key} className="mr-1 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />;
}

/**
 * 🎯 Bring a part to the MIDDLE of the page band left above the guest bar (prototype
 * `centrePicked`): `top + h/2 − band/2`; a part taller than the band lines up with its
 * top. The canvas is the stage's shown, same-origin frame; it gets the room below to
 * centre its last part too (its own `padding-bottom`, set once).
 */
function centrePart(key: string, el: string | null, frameSel: string = SHOWN_FRAME) {
  try {
    const frame = document.querySelector<HTMLIFrameElement>(frameSel);
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
