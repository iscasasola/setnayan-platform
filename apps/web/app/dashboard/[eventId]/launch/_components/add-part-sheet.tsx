'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { listWithGates, partTakenOff } from '@/lib/maker-list-gates';
import { canvasSettleWatch, whenCanvasShowsIt, type CanvasSettle } from '@/lib/maker-settle';
import { SCENE_DRAG_WORDS, sceneMenuRows, sceneMovesAmong, type SceneHeld } from '@/lib/maker-scene-drag';
import { makerStagesPageOf, makerStagesPages } from '@/lib/maker-stage-filing';
import { shownHubTab } from '@/app/[slug]/_components/hub-tab-dom';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { usePopupBehind } from '@/lib/use-popup-behind';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { RSVP_CARD_ATTR, RSVP_CARD_GROUPS } from '@/app/[slug]/_components/rsvp-canvas-parts';
import { Explain } from '@/app/_components/explain';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { isCustomSectionType } from '@/lib/custom-sections';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { MAKER_PARTS, makerPartStepHeldWhy, makerPartStepWhy, makerRevealEdges, makerStageIsFixedPages, type MakerPartKey, type MakerStageKey } from '@/lib/maker-parts';
import { heldByEntourage } from '@/lib/stage-scenes';
import {
  makerDropDelta,
  makerOwnScenesLeft,
  makerOwnScenesLine,
  makerPartCanvasOn,
  makerPartLabelOn,
  makerPartOfCanvas,
  makerPartOffers,
  makerPostEventMoveDraft,
  makerPostEventSceneOf,
  makerRemoveWords,
  type MakerPartAddPath,
  type MakerPartOffer,
} from '@/lib/maker-part-groups';
import { postEventRun, postEventShow, type PostEventDraft } from '@/lib/post-event-draft';
import { stageTakesOwnScenes, swapsForDrop, type MakerTile } from '@/lib/maker-scene-list';
import type { RevealStage } from '@/lib/reveal-stages';
import { PART_EDGE_ROOM, STAGE_SHEET_ROW, partFrameEdges } from '@/lib/maker-stage-room';
import { SceneTemplatePicker } from '../../website/editor/_components/scene-template-picker';
import { MakerSheet } from './stages-studio-parts';
import { PLACE_ORDER_FIELD, PLACE_STAGE_FIELD, ownScenePlaceOrder } from '@/lib/own-scene-place';
import { MakerRevealStageContext } from './maker-reveal';
import { stageStill } from './stage-panel/store';
import { MAKER_PART_OPS_EVENT, type MakerPartOps, type MakerPartRaw } from './maker-part-ops';
import type { SceneDragSubject } from './scene-canvas-drag';
import { heldSaveWatch, useSceneDrag } from './scene-drag';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { useMaker } from './maker-context';

/**
 * ＋ ↕ 🗑 🎭 THE PARTS OF A PAGE — ADD, MOVE, TAKE OFF; AND THE REVEAL AS A PART
 * (the new Maker's Stages side, behind `makerStagesStudioEnabled`; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 3; the approved
 * prototype's `paintPage` edges, `openAddScene`, `partsHTML`, `askRemove` and the
 * grip drag). Loaded with the lazy Stages panel (`stage-tools.tsx`), never with
 * the Maker.
 *
 *   ＋   on the picked part's top and bottom edge → "Add above / below <part>"
 *        → the parts NOT on this page, grouped (`lib/maker-part-groups.ts`),
 *        then "A scene of your own ◆ · n of 6 left" → the SHIPPED template
 *        picker (`scene-template-picker.tsx`).
 *   ✋   HOLD THE SCENE ON THE PAGE AND DRAG IT (owner 2026-10-11: *"what if we
 *        drag the scene on the preview instead of having this"* · *"our build is
 *        the drag by scene"*; `scene-drag.tsx`, `scene-canvas-drag.ts`,
 *        `lib/maker-scene-drag.ts`) → ONE order write (the work area's own move,
 *        `lib/maker-reorder.ts`; Post Event: its run). It was the toolbar's Edit ›
 *        ↑ Earlier · ↓ Later (2026-10-09), and a grip on the frame before that.
 *   🗑   DROP IT ON THE BIN: the eye (its words stay in Studio; the line under the
 *        tools says "<Scene> removed" beside Undo) — or, for a scene of their own,
 *        "Delete this scene?" (the shipped Remove for good), the ONLY confirm in
 *        the Maker. It was Edit › Remove.
 *   ▾    FOR WHOEVER CANNOT DRAG: the picked part's name tag opens Move up ·
 *        Move down · Remove — the same writes.
 *
 * 🚫 THE FRAME'S ONLY CONTROLS (owner 2026-10-09: *"on preview screen, you only
 * select"*; 2026-10-11: the tag's menu): its outline, its name tag, and ＋.
 *
 * 🔑 EVERY WRITE IS THE WORK AREA'S OWN (`maker-part-ops.ts`): the eye, the move,
 * Remove for good, "+ Add a scene", Post Event's switch and run. Opening any of
 * this writes nothing.
 */

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';
/** The Reveal part's key on the page (it has no canvas section of its own). */
export const REVEAL_STUB = 'reveal:part';

/** To the canvas on screen (the stage's shown frame). */
function postToCanvas(message: unknown) {
  document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentWindow?.postMessage(message, window.location.origin);
}

/** The work area's raw values read into the edits' terms (here, lazy — never in the Maker's first load). */
export function partOpsOf(raw: MakerPartRaw): MakerPartOps {
  const { stage, addScene, postEventPresets: pe } = raw;
  const byId = new Map(raw.scenes.map((sc) => [sc.id, sc] as const));
  const nav = raw.navigator.postEvent;
  return {
    eventId: raw.eventId,
    stage,
    /* 🗑 The list as the work area's own scenes say it is: a scene taken off a moment ago (a held save — no render
       follows it) is one ＋ can bring back (`lib/maker-list-gates.ts`) — by the event-wide gates, and by the eye's
       own per-stage value (`hereOff`), which is what Remove writes now. */
    list: listWithGates(raw.list, raw.scenes, raw.hereOff),
    fullOrder: raw.fullOrder,
    afterLastShown: raw.afterLastShown,
    scenes: raw.scenes,
    move: raw.move,
    eye: (id) => {
      const sc = byId.get(id);
      if (sc) raw.eyeWrite(sc);
    },
    add: (id, delta) => {
      const sc = byId.get(id);
      if (sc) raw.addHere(sc, delta);
    },
    removers: raw.sceneRemovers,
    postEvent: nav && nav !== 'unreadable' ? nav.arrangement : null,
    draftAction: raw.elementEditing?.draftAction ?? null,
    heroCanvas: raw.elementEditing?.canvases.hero ?? null,
    ownWords: raw.elementEditing?.ownWords ?? null,
    canvases: raw.elementEditing?.canvases ?? null,
    palette: raw.elementEditing?.palette ?? null,
    /* "+ Add a scene" exactly as the navigator offers it (`editor-shell.tsx` `setAddScene`). */
    addOwn:
      stage === 'editorial' && pe
        ? { action: pe.action, returnTo: pe.returnTo, stageLabel: PUBLIC_STAGE_LABELS.editorial, heading: 'Add a scene ·', tried: !pe.ownsPro, presets: pe }
        : !stageTakesOwnScenes(stage) || !addScene
          ? null
          : 'action' in addScene
            ? {
                action: addScene.action,
                returnTo: addScene.returnTo,
                stageLabel: stage === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS.rsvp}` : PUBLIC_STAGE_LABELS[stage],
                heading: 'Add a scene to',
                tried: addScene.tried === true,
                tour: addScene.tour,
                facts: raw.sceneFacts ?? null,
              }
            : { note: addScene.note },
    onPickTemplate: raw.onPickTemplate,
  };
}

/** The work area's writes, now (synchronous: the work area answers inside the dispatch). */
export function askPartOps(): MakerPartOps | null {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  return got ? partOpsOf(got) : null;
}

/** The canvas keys the page DREW (a section with height), in page order — what is "on this page". */
export function readDrawnOrder(): string[] {
  const out: string[] = [];
  try {
    const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    doc?.querySelectorAll('[data-maker-section]').forEach((m) => {
      const k = m.getAttribute('data-maker-section');
      const sec = k ? findMakerSection(doc, k) : null;
      if (k && sec && sec.getBoundingClientRect().height > 0 && !out.includes(k)) out.push(k);
    });
  } catch {
    /* a canvas we cannot read draws nothing here */
  }
  return out;
}

/** A part's box on the SCREEN (the canvas is a same-origin frame; it may be drawn scaled). `frameSel`: the frame the
 *  part is drawn in — the stage's shown canvas, or the RSVP stage's own screen (`rsvpStageFrameSelector`). */
function partBox(canvas: string, el?: string | null, frameSel: string = SHOWN_FRAME): Box | null {
  const frame = document.querySelector<HTMLIFrameElement>(frameSel);
  const doc = frame?.contentDocument;
  if (!frame || !doc) return null;
  /* 🎭 The Reveal is drawn at the top of the page in Stages (`stage-tools.tsx` `drawRevealPart`). */
  let node: Element | null = canvas === REVEAL_STUB ? doc.querySelector('[data-maker-reveal-part]') : findMakerSection(doc, canvas);
  /* A part inside the section: the cover's (`data-el`), or a LINE of an RSVP section (`data-rsvp-line`). */
  /* …or a GROUP of an RSVP section's lines (`g:<id>` — its wrapper names itself, `data-rsvp-group`). */
  if (node && el) node = node.querySelector(el.startsWith('g:') ? `[data-rsvp-group="${CSS.escape(el.slice(2))}"]` : `[data-el="${CSS.escape(el)}"], [data-rsvp-line="${CSS.escape(el)}"]`) ?? node;
  /* 🃏 A reply screen's GROUP of lines is its card (`RSVP_CARD_GROUPS`): the frame goes round the card it sits in. */
  else if (node && (RSVP_CARD_GROUPS as readonly string[]).includes(canvas)) node = node.closest(`[${RSVP_CARD_ATTR}]`) ?? node;
  if (!node) return null;
  const fr = frame.getBoundingClientRect();
  const k = frame.clientWidth > 0 ? fr.width / frame.clientWidth : 1;
  const r = node.getBoundingClientRect();
  if (r.height <= 0) return null;
  const gap = (dir: -1 | 1): number | null => {
    const n = neighbourOf(node!, dir);
    if (!n) return null;
    const nr = n.getBoundingClientRect();
    return Math.max(0, (dir < 0 ? r.top - nr.bottom : nr.top - r.bottom) * k);
  };
  return { top: fr.top + r.top * k, left: fr.left + r.left * k, width: r.width * k, height: r.height * k, gapAbove: gap(-1), gapBelow: gap(1) };
}

/** Where a part sits on the screen (its top), or null when it is not drawn on the page now — ↑ ↓'s order. */
export function makerPartTopOnScreen(stage: MakerStageKey, key: MakerPartKey, frameSel?: string): number | null {
  const canvas = key === 'reveal' ? REVEAL_STUB : makerPartCanvasOn(stage, key);
  if (!canvas) return null;
  return partBox(canvas, MAKER_PARTS[key].el ?? null, frameSel)?.top ?? null;
}

/** The nearest DRAWN thing above (-1) or below (1) a node on the page — a sibling, or an ancestor's sibling. */
function neighbourOf(node: Element, dir: -1 | 1): Element | null {
  let cur: Element | null = node;
  while (cur && cur.tagName !== 'BODY') {
    let sib: Element | null = dir < 0 ? cur.previousElementSibling : cur.nextElementSibling;
    while (sib) {
      const sr = sib.getBoundingClientRect();
      if (sr.height > 0 && sr.width > 0) return sib;
      sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
    }
    cur = cur.parentElement;
  }
  return null;
}

/** The page's visible band: under the frame's top, above the guest's tab bar and the lower third. */
function visibleBand(frameSel: string = SHOWN_FRAME): { top: number; bottom: number } {
  const fr = document.querySelector<HTMLIFrameElement>(frameSel)?.getBoundingClientRect();
  const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
  /* The guest's tab bar is drawn over the foot of the page (`stage-tools.tsx`). */
  const bar = document.querySelector('[data-stage-guest-bar]')?.getBoundingClientRect();
  const top = fr ? fr.top : 0;
  const bottom = Math.min(fr ? fr.bottom : window.innerHeight, lt ? lt.top : window.innerHeight, bar && bar.height > 0 ? bar.top : window.innerHeight);
  return { top, bottom };
}

/** What the picked part is, for the edges: a scene the navigator moves, a Post Event scene, or a fixed part. */
type Movable =
  | { kind: 'scene'; id: string; own: boolean; type: string }
  | { kind: 'post-event'; scene: string; runKey: string | null; switchKey: string | null }
  | { kind: 'fixed' };

/** A part of the page as the steps and the drag name it: what it is, its canvas key, its name. */
type At = { mv: Movable; canvas: string | null; label: string };

/** …and what it is in the drag rules' terms (`lib/maker-scene-drag.ts`). */
function heldOf(mv: Movable): SceneHeld {
  return mv.kind === 'scene' ? { kind: 'scene', type: mv.type } : mv.kind === 'post-event' ? { kind: 'post-event', runKey: mv.runKey } : { kind: 'fixed' };
}

/** May a part of this kind be taken off · moved? One rule for the picked part and for a scene held on the page (the
 *  Reveal and every fixed part are `fixed`: never). */
function mayRemove(mv: Movable): boolean {
  return mv.kind === 'scene' || (mv.kind === 'post-event' && mv.switchKey !== null);
}
function mayMove(mv: Movable): boolean {
  return mv.kind === 'scene' || (mv.kind === 'post-event' && mv.runKey !== null);
}

function movableOf(ops: MakerPartOps | null, canvas: string | null): Movable {
  if (!ops || !canvas) return { kind: 'fixed' };
  const t = ops.list.shown.find((x) => x.key === canvas || (x.kind === 'post-event' && x.anchor === canvas));
  if (t?.kind === 'scene') return { kind: 'scene', id: t.widgetId, own: isCustomSectionType(t.type), type: t.type };
  if (t?.kind === 'post-event') return { kind: 'post-event', scene: t.scene, runKey: t.runKey, switchKey: t.switchKey };
  return { kind: 'fixed' };
}

/** ＋ The new scene's place, as the form sends it (`lib/own-scene-place.ts`) — only off a scene; anything else lands at the end. */
function ownPlaceFields(ops: MakerPartOps, mv: Movable, where: 'above' | 'below' | null): Record<string, string> {
  if (!where || mv.kind !== 'scene') return {};
  const order = ownScenePlaceOrder(ops.fullOrder, mv.id, where);
  return order ? { [PLACE_STAGE_FIELD]: ops.stage, [PLACE_ORDER_FIELD]: order.join(',') } : {};
}

type Box = { top: number; left: number; width: number; height: number; gapAbove?: number | null; gapBelow?: number | null };
/** A 44 px tap around each edge's small face (prototype `.addp` · `.grip` · `.delp`). */
/** How far outside the part its frame is drawn — half a 44 px tap, so a ＋ on the frame never covers the part. */
export const PART_PAD = 22;
const EDGE_BTN = 'sn-press pointer-events-auto absolute inline-flex h-11 w-11 items-center justify-center rounded-full';
/**
 * 🎯 THE FRAME AND ITS MARKS WEAR THE APP'S ACCENT (owner 2026-10-08: *"if we change our color to blue, it will be easy
 * to change the button colors"*; `INTERACTION_RULES.md` § 9 — the mark that says "you can tap this" is the accent).
 * One fill, one ink, both read from the token; nothing here writes a colour. (Remove is Edit's danger button now —
 * the button rule's `danger` tone.) Held by `lib/the-stages-panel-wears-the-accent.test.ts`.
 */
export const PART_ACCENT = 'bg-sn-accent text-sn-on-accent';
/** The outline: 2 px of the accent and its soft halo. */
export const PART_OUTLINE = 'absolute rounded-lg shadow-[0_0_0_2px_rgb(var(--sn-accent)),0_0_0_7px_rgb(var(--sn-accent)/.14)]';
/** The picked part's name tag. The lifted scene wears the same face on the page (`scene-canvas-drag.ts` `SCENE_TAG_FACE`,
 *  spelled out there for the page's own stylesheet — held equal by `lib/a-scene-is-dragged-on-the-page.test.ts`). */
const PART_TAG = `rounded-sm ${PART_ACCENT} px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase leading-[1.2] tracking-[0.14em]`;
const ADD_FACE = `inline-flex h-[26px] w-[26px] items-center justify-center rounded-full ${PART_ACCENT} font-sans text-[18px] font-semibold leading-none shadow-[0_0_0_3px_#fff,0_4px_10px_-4px_rgba(0,0,0,.4)]`;

/**
 * THE PICKED PART'S FRAME — its outline, its name, ＋ on its top and bottom. Drawn over
 * the canvas at the part's own place, following the page as it scrolls; kept
 * inside the visible band. `picked` null: nothing is drawn. Layered just over
 * the Maker shell (z-80) and under every sheet (the picker z-90, `MakerSheet` z-95).
 */
type PartEditsProps = {
  stage: MakerStageKey;
  picked: MakerPartKey | null;
  /** The frame the stage's page is drawn in, when it is not the shown canvas — the RSVP stage's own three screens
   *  (`rsvpStageFrameSelector`). The frame and its name tab are the same everywhere. */
  frame?: string;
  /**
   * 🧩 A LINE of the picked part (the RSVP stage: `rsvp-canvas-parts.ts` `RSVP_SECTION_LINES`) — the frame is drawn on
   * THAT line and wears its name; absent, the frame is the part's own (the group).
   */
  line?: { key: string; name: string } | null;
  /** 🃏 The frame's own word where the part's name is not it — "Card" for a reply screen's group of lines. */
  name?: string;
  /**
   * ＋ ON A FIXED PAGE'S LINE (the RSVP stage, owner's ruling 2026-10-09: "we already had the +" → "you removed it").
   * A reply page takes no SCENE — that is why ＋ is off on its parts — but a line of its card takes a line above or
   * below it. Given, the SAME ＋ is drawn on the picked line's frame, and a tap asks the stage (`onAdd`) instead of
   * opening the scenes' sheet. Absent: no ＋ on a fixed page, as before.
   */
  lineAdd?: { above: boolean; below: boolean; onAdd: (where: 'above' | 'below') => void } | null;
  /** A LINE of a fixed page that says its own reasons for its grey steps (the pass's Save button: "The Save button
   *  stays under the ticket."). Absent: the part's own (`makerPartStepWhy`). */
  lineWhy?: { earlier: string; later: string; remove: string } | null;
  /** ✋ The frame steps aside (a line of the RSVP stage is held to be moved, or lines are being picked for a group —
   *  the prototype draws no frame then). The part stays picked. */
  away?: boolean;
  /**
   * 🫥 THE PICKED PART IS NO LONGER ON THIS PAGE — the couple took it off (Remove a moment ago, a box unticked in
   * "What guests see", an Undo of its ＋). Whoever holds the selection lets go: the panel went on reading
   * "You're editing · Invitation › Welcome › Countdown" with a live Remove for a part the page no longer drew, and
   * that Remove would have put it BACK (the eye is a toggle) — the walk of 2026-10-11, M09.
   */
  onGone?: () => void;
  /**
   * 📄 ＋ A PART ANOTHER PAGE DRAWS: open that page (`onPage`, the tab row's own door), and — once it shows the part
   * — pick it there (`onPick`). Whoever holds the pages and the selection hands them; absent, the page stays.
   */
  onPage?: (page: string) => void;
  onPick?: (part: MakerPartKey) => void;
  /**
   * ✋ THE PAGE TAKES A HOLD NOW (`scene-drag.tsx`): the stage's own canvas is on show and nothing else has the
   * screen (not typing, playing or previewing). Absent / false: no scene lifts. Never on a fixed page (the RSVP
   * stage's screens — their lines have a drag of their own).
   */
  dragOn?: boolean;
  /** 🗑 The picked scene left the page with nothing of its kind to pick in its place — whoever holds the selection
   *  picks what an arrival would. */
  onRemoved?: () => void;
};

/**
 * ↑ ↓ 🗑 THE PICKED PART'S PLACE — the drag's own writes, handed out for the tag's menu and the keyboard (one order
 * write for a step; a scene of their own asks before it is deleted), so the drag and its fallback can never disagree.
 * It was the toolbar's Edit › ↑ Earlier · ↓ Later · Remove (owner 2026-10-09); the row left when the drag came
 * (owner 2026-10-11).
 */
export type PartEditsNow = {
  /** The frame, the bin, its sheets and its toast — drawn once, by whoever holds the hook. */
  node: ReactNode;
  /** One place up / down among the parts this page draws — null: nowhere to go, or a part that does not move. */
  earlier: (() => void) | null;
  later: (() => void) | null;
  /** Take it off (a scene of their own asks first) — null: a part that cannot be removed. */
  remove: (() => void) | null;
  /** "Delete" for a scene of their own (gone for good at Apply), "Remove" for any other. */
  removeWord: 'Remove' | 'Delete';
  /** The one plain line a grey step answers with — never a dead tap. */
  why: { earlier: string; later: string; remove: string };
  /** ⏳ The press still on its way to the page (`lib/maker-settle.ts`) — every step waits for it. */
  working: PartWorking | null;
  /** ✋ A scene is held on the page: the lower third slides away so the whole page shows (`scene-drag.tsx`). */
  held: boolean;
  /** The line under the tools — "Saving…", "<Scene> removed" · Undo, why a part keeps its place. Null: nothing to say. */
  status: ReactNode;
  /** …and which saying it is (a new number each time it speaks) — null with nothing to say. */
  statusKey: number | null;
  /** Say one line there (why a grey step did nothing). */
  say: (words: string) => void;
};

/** The presses still on their way to the page: a scene moved · taken off, a part brought back. */
export type PartWorking = 'move' | 'remove' | 'add';

/** What a step answers while another press is still on its way to the page. */
export const PART_WORKING_WHY = 'One moment — the page is catching up.';

export function PartEdits(props: PartEditsProps) {
  return usePartEdits(props).node;
}

export function usePartEdits({ stage, picked, frame, line = null, name, lineAdd = null, lineWhy = null, away = false, onGone, onPage, onPick, dragOn = false, onRemoved }: PartEditsProps): PartEditsNow {
  const isReveal = picked === 'reveal';
  const canvas = isReveal ? REVEAL_STUB : picked ? makerPartCanvasOn(stage, picked) : null;
  const el = picked ? (line?.key ?? MAKER_PARTS[picked].el ?? null) : null;
  const [box, setBox] = useState<Box | null>(null);
  const [adding, setAdding] = useState<'above' | 'below' | null>(null);
  /* 🗑 The scene of their own being asked about ("Delete this scene?") — the picked one, or one dropped on the bin. */
  const [removing, setRemoving] = useState<At | null>(null);
  /* ▾ The picked part's tag was pressed: Move up · Move down · Remove. */
  const [menu, setMenu] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  /* ＋ Which edge "A scene of your own" was asked from — it lands there (owner 2026-10-07). */
  const [ownWhere, setOwnWhere] = useState<'above' | 'below' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* What just happened, said at once ("Song added below") — the app's ONE toast (`PeekToast`: it peeks from the top
     and leaves by itself). `n` keys it, so a second message is a new toast, never the first one's words swapped. */
  const [toast, setToastNow] = useState<{ words: string; n: number } | null>(null);
  const setToast = useCallback((words: string) => setToastNow((t) => ({ words, n: (t?.n ?? 0) + 1 })), []);
  const [ops, setOps] = useState<MakerPartOps | null>(null);
  /* ⏳ ONE PRESS AT A TIME, AND NOTHING SAID BEFORE THE PAGE SHOWS IT (owner 2026-10-11, Message › Earlier: *"first
     press a pop up says it moved but didn't only moved on the second click"*). A move and a part brought back reach
     the canvas by a reload, seconds after the press on a real connection; the toast was up at the press and every
     step was live. `settle` holds the row busy from the press and says the words only once the page on screen is the
     new one (`lib/maker-settle.ts`). A write that was refused is said by the toolbar's own line; a page that never
     comes says nothing it cannot show. */
  const [working, setWorking] = useState<PartWorking | null>(null);
  const settle = (what: PartWorking, words: string, shown?: () => void) => {
    setWorking(what);
    void whenCanvasShowsIt().then((how) => {
      setWorking(null);
      if (how !== 'shown') return;
      shown?.();
      setToast(words);
    });
  };
  /* ✋ …and a scene moved (dropped, or stepped from its tag's menu): busy from the press until the page on screen is the
     new one — the caller is told how it ended, and says it on the line under the tools (never a toast: the scene is
     already where it was put). */
  const landed = (what: PartWorking, done: Promise<CanvasSettle> = whenCanvasShowsIt()): Promise<CanvasSettle> => {
    setWorking(what);
    return done.then((how) => {
      setWorking(null);
      return how;
    });
  };

  /* The part's box, every frame while it is picked (one rect read — the canvas scrolls under it). */
  useEffect(() => {
    if (!canvas) {
      setBox(null);
      return;
    }
    let raf = 0;
    let last = '';
    const tick = () => {
      const b = partBox(canvas, el, frame);
      const sig = b ? `${Math.round(b.top)}|${Math.round(b.left)}|${Math.round(b.width)}|${Math.round(b.height)}|${Math.round(b.gapAbove ?? -1)}|${Math.round(b.gapBelow ?? -1)}` : '';
      if (sig !== last) {
        last = sig;
        setBox(b);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [canvas, el, frame]);
  /* The work area's writes, read again whenever the part changes (and its render lands). */
  const renderStamp = useMaker()?.renderStamp;
  /* (`took`: a scene just taken off by a held save — no render follows it, so the list is asked for again here.) */
  const [took, setTook] = useState(0);
  useEffect(() => setOps(askPartOps()), [canvas, renderStamp, adding, removing, took]);

  /* 🫥 The work area's list folds the picked part as taken off by the couple (`listWithGates`): let go of it. */
  const gone = partTakenOff(ops, canvas);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  useEffect(() => {
    if (gone) onGoneRef.current?.();
  }, [gone, canvas]);

  const mv = isReveal ? ({ kind: 'fixed' } as Movable) : movableOf(ops, canvas);
  const ownScene = mv.kind === 'scene' && mv.own;
  const label = picked ? makerPartLabelOn(stage, picked) : '';
  /** The picked part, as the steps and the drag name a part (`At`). */
  const here: At = { mv, canvas, label };
  /* 🎭 THE REVEAL IS LOCKED FIRST (owner 2026-10-07: *"the move feature or add a slide above on reveal must be
     removed (for reveal only) because that should be its limitation"*): no grip, no ＋ above, no 🗑 — it hides per
     stage through Arrange › On this stage. Its ＋ below stays. `makerRevealEdges`. */
  const edgesOf = makerRevealEdges(isReveal);
  /* 🗳 …and the RSVP stage's three screens are FIXED pages (`makerStageIsFixedPages`): a part there has its frame,
     its name and ↑ ↓ ✕ — never ＋, a grip or 🗑 (nothing can be added to a reply page, and the ＋ sheet would offer
     the stage mounted underneath's hidden scenes). */
  const fixedPages = makerStageIsFixedPages(stage);
  const canRemove = edgesOf.remove && mayRemove(mv) && !fixedPages;
  const canMove = edgesOf.grip && mayMove(mv) && !fixedPages;

  /* ── 💾 the Post Event saves (its switch, its run) — the one draft door ── */
  /* `said`: the toast for a ＋ — null for a move or a remove, whose line under the tools says how it ended (the promise).
     Both reload the canvas, so the wait is for the page that shows it (`canvasSettleWatch`, read AT the press). */
  const saveEditorial = useCallback((draft: PostEventDraft, said: string | null, hide?: string): Promise<CanvasSettle> => {
    const o = askPartOps();
    if (!o?.draftAction) return Promise.resolve('failed');
    const watch = canvasSettleWatch();
    /* Drawn first: a scene taken off is gone from the page now (the bridge's `sceneShow`),
       and what happened is said at once; the draft save runs behind it. */
    if (hide) postToCanvas({ source: 'setnayan-editor', t: 'sceneShow', key: hide, shown: false });
    if (said) setToast(said);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ editorial: draft }));
    setError(null);
    /* ↩ Refused: what the bridge took off is put back — "nothing changed" must be true of the page too. */
    const refused = (why: string) => {
      if (hide) postToCanvas({ source: 'setnayan-editor', t: 'sceneShow', key: hide, shown: true });
      if (said) setError(why);
      watch.cancel();
    };
    void makerSave(() => o.draftAction!(o.eventId, fd), requestMakerRefresh)
      .then((r) => {
        if (!r.ok) refused(r.error);
      })
      .catch(() => refused('That change could not be saved. Please try again — nothing was lost.'));
    return watch.done;
  }, [setToast]);

  /* ── ↑ ↓ a step earlier / later ── */
  type MoveTarget = { key: string; id: string; mid: number; top: number; bottom: number };
  /** The parts a part can move among: the same kind, DRAWN on this page, top to bottom (never itself). */
  const moveTargets = (o: MakerPartOps, at: At = here): MoveTarget[] => {
    const targets: MoveTarget[] = [];
    /* 🚶 NEVER PAST THE ENTOURAGE (owner 2026-10-11: Earlier on What to bring saved a move the page could not show
       — "the do not work"). A scene the page draws after the entourage is not a neighbour of one before it
       (`sceneMovesAmong` → `stepChangesThePage`): the order would change and the page would not. The drag opens its
       gap among these same targets, so it can never open one across the Wedding March either. */
    for (const n of sceneMovesAmong(stage, o.list.shown, heldOf(at.mv), at.canvas)) {
      const b = partBox(n.key);
      if (!b) continue;
      targets.push({ key: n.key, id: n.id, mid: b.top + b.height / 2, top: b.top, bottom: b.top + b.height });
    }
    return targets.sort((a, b) => a.mid - b.mid);
  };
  /**
   * Land a part above / below `t` — ONE order write (the work area's own move; Post Event: its run). The promise is
   * how it ended, once the page on screen shows it; null: it already stands there — nothing is written.
   */
  const dropOn = (o: MakerPartOps, t: MoveTarget, where: 'above' | 'below', at: At = here): Promise<CanvasSettle> | null => {
    const { mv: m } = at;
    if (m.kind === 'scene') {
      const shown = o.list.shown.flatMap((x) => (x.kind === 'scene' ? [x.widgetId] : []));
      const delta = makerDropDelta({ fullOrder: o.fullOrder, shown, afterLastShown: o.afterLastShown, id: m.id, target: t.id, where });
      if (delta === 0) return null;
      o.move(m.id, delta);
      return landed('move');
    }
    if (m.kind === 'post-event' && m.runKey && o.postEvent) {
      const run = postEventRun(o.postEvent);
      const from = run.indexOf(m.runKey);
      let to = run.indexOf(t.id) + (where === 'below' ? 1 : 0);
      if (from < 0 || to < 0) return null;
      if (to > from) to -= 1;
      const draft = makerPostEventMoveDraft(o.postEvent, m.scene, to - from);
      return draft ? landed('move', saveEditorial(draft, null)) : null;
    }
    return null;
  };
  /* ── ↑ ↓ one place up / down (the tag's menu, the keyboard) — the neighbour the page DRAWS above / below it ── */
  const neighbour = (o: MakerPartOps, dir: -1 | 1): MoveTarget | null => {
    const me = canvas ? partBox(canvas, el, frame) : null;
    if (!me) return null;
    const mid = me.top + me.height / 2;
    const targets = moveTargets(o);
    const above = targets.filter((t) => t.mid < mid);
    return dir < 0 ? (above[above.length - 1] ?? null) : (targets[above.length] ?? null);
  };
  const stepMove = (dir: -1 | 1) => {
    const o = askPartOps();
    const t = o && canMove ? neighbour(o, dir) : null;
    const done = o && t ? dropOn(o, t, dir < 0 ? 'above' : 'below') : null;
    if (!done) return;
    /* It sits in its new place at once (the prototype's `moveBy`), slid there until the page the save brings draws it. */
    const section = canvas ? findMakerSection(document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument ?? document, canvas) : null;
    drag.run({ type: 'move', label, key: canvas }, done, (section ? drag.slide(section, dir) : null) ?? undefined);
  };

  /* ── ＋ add a part ── */
  /** ＋ pressed: the sheet opens — unless a press is still on its way to the page (one at a time). */
  const askAdd = (where: 'above' | 'below') => {
    if (working) return;
    setAdding(where);
  };
  const add = (key: MakerPartKey) => {
    const o = askPartOps();
    const where = adding;
    setAdding(null);
    if (!o || !where) return;
    const c = makerPartCanvasOn(stage, key);
    if (!c) return;
    if (c.startsWith('w:')) {
      const folded = o.list.folded.find((f) => f.key === c);
      if (!folded?.widgetId) return;
      /* 📄 A PART ANOTHER PAGE DRAWS (owner 2026-10-11): it is shown in its OWN place there — never placed against a
         part of the page it was added from — in one save; its page is opened at once, and once that page shows it,
         it is brought onto the screen, picked, and only then said: "Venue added on Details". */
      const away = otherPageOf(stage, c);
      if (away) {
        o.add(folded.widgetId, 0);
        onPage?.(away.key);
        settle('add', `${makerPartLabelOn(stage, key)} added on ${away.label}`, () => {
          bringOntoScreen(c);
          onPick?.(key);
        });
        return;
      }
      /* Where: above / below the picked scene in the stage's order. ITS PLACE AND ITS SHOWING ARE ONE SAVE (`o.add`
         — they were the move and then the eye: two Undo steps for one press, owner 2026-10-11). */
      let delta = 0;
      if (mv.kind === 'scene') {
        const shown = o.list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
        const before = where === 'above' ? mv.id : (shown[shown.indexOf(mv.id) + 1] ?? o.afterLastShown);
        delta = swapsForDrop(o.fullOrder, folded.widgetId, before === folded.widgetId ? null : before);
      }
      o.add(folded.widgetId, delta);
      /* Said as it landed: above / below the picked scene — or, off a fixed part, on this page (its own place). */
      const onHere = shownPageOf(stage);
      settle('add', `${makerPartLabelOn(stage, key)} added ${mv.kind === 'scene' ? where : onHere ? `on ${onHere.label}` : 'to this page'}`, () => bringOntoScreen(c));
      return;
    }
    const scene = makerPostEventSceneOf(stage, key);
    const tile = scene ? o.list.shown.find((t): t is Extract<MakerTile, { kind: 'post-event' }> => t.kind === 'post-event' && t.scene === scene) : null;
    if (!tile?.switchKey || !o.postEvent) return;
    let draft: PostEventDraft = postEventShow(o.postEvent, tile.switchKey as Parameters<typeof postEventShow>[1], true);
    if (mv.kind === 'post-event' && mv.runKey && tile.runKey) {
      const run = postEventRun(o.postEvent);
      const from = run.indexOf(tile.runKey);
      let to = run.indexOf(mv.runKey) + (where === 'below' ? 1 : 0);
      if (from >= 0 && to >= 0) {
        if (to > from) to -= 1;
        const moved = makerPostEventMoveDraft(o.postEvent, tile.scene, to - from);
        if (moved?.sectionOrder !== undefined) draft = { ...draft, sectionOrder: moved.sectionOrder };
      }
    }
    saveEditorial(draft, `${makerPartLabelOn(stage, key)} added ${where}`);
  };

  /* ── 🗑 take it off ── */
  /**
   * Off the page, by the bin or the tag's menu — today's Remove for that part: the same write, the same Undo step.
   * A scene of the couple's OWN is never taken silently: its "Delete this scene?" sheet opens ('asking' — the
   * shipped Remove for good). Any other goes at once and the line under the tools offers Undo; the promise is how
   * the save ended. Null: a part that stays.
   */
  const takeOff = (at: At = here): 'asking' | Promise<CanvasSettle> | null => {
    const o = askPartOps();
    if (!o || fixedPages || !mayRemove(at.mv)) return null;
    const { mv: m } = at;
    if (m.kind === 'scene' && m.own) {
      setRemoving(at);
      return 'asking';
    }
    if (m.kind === 'scene') {
      /* The eye: drawn at once by the bridge and held — no reload follows, so the wait is for the save itself. */
      const done = heldSaveWatch();
      o.eye(m.id);
      return landed('remove', done).then((how) => {
        if (how === 'shown') setTook((n) => n + 1);
        return how;
      });
    }
    if (m.kind === 'post-event' && m.switchKey && o.postEvent) {
      return landed('remove', saveEditorial(postEventShow(o.postEvent, m.switchKey as Parameters<typeof postEventShow>[1], false), null, at.canvas ?? undefined));
    }
    return null;
  };
  /** After a scene left the page: the next scene the page still draws is picked (the prototype's `removeScene`) — or what an arrival would pick. */
  const pickAfter = (gone: string | null) => {
    const o = askPartOps();
    const next = o?.list.shown.find((t) => t.kind === 'scene' && t.key !== gone && partBox(t.key) !== null);
    const part = next ? makerPartOfCanvas(stage, next.key) : null;
    if (part) onPick?.(part);
    else onRemoved?.();
  };
  const removeNow = () => {
    const done = takeOff();
    if (done && done !== 'asking') {
      drag.run({ type: 'remove', label, key: canvas }, done);
      pickAfter(canvas);
    }
  };

  /* ── ✋ a scene held on the page (`scene-drag.tsx`) ── */
  /** A part of this stage's page, by its canvas key — as the steps name the picked one. */
  const atKey = (o: MakerPartOps | null, key: string): At => {
    const part = key === REVEAL_STUB ? ('reveal' as MakerPartKey) : makerPartOfCanvas(stage, key);
    const tile = o?.list.shown.find((t) => t.key === key || (t.kind === 'post-event' && t.anchor === key));
    return { mv: key === REVEAL_STUB ? { kind: 'fixed' } : movableOf(o, key), canvas: key, label: part ? makerPartLabelOn(stage, part) : (tile?.label ?? 'This part') };
  };
  const drag = useSceneDrag({
    on: dragOn && !fixedPages && !frame,
    frameSel: SHOWN_FRAME,
    working: working !== null,
    sheetOpen: adding !== null || removing !== null || menu || ownOpen,
    /* What a press on this element would hold: the marked part under it, whether it moves, and — when it does — the
       parts it may land among, measured on the page (the same targets a step takes). */
    subject: (target, doc): SceneDragSubject | null => {
      const o = askPartOps();
      if (!o) return null;
      const reveal = target.closest<HTMLElement>('[data-maker-reveal-part]');
      if (reveal) return { key: REVEAL_STUB, el: reveal, label: atKey(o, REVEAL_STUB).label, movable: false, beside: [] };
      let hit: { key: string; el: HTMLElement } | null = null;
      const keys = [...Array.from(doc.querySelectorAll('[data-maker-section]')).map((m) => m.getAttribute('data-maker-section') ?? ''), 'f:entourage', 'f:story'];
      for (const k of keys) {
        const sec = k ? findMakerSection(doc, k) : null;
        if (sec && sec.contains(target) && (!hit || hit.el.contains(sec))) hit = { key: k, el: sec };
      }
      if (!hit) return null;
      const at = atKey(o, hit.key);
      if (!mayMove(at.mv)) return { key: hit.key, el: hit.el, label: at.label, movable: false, beside: [] };
      const mine = partBox(hit.key);
      const rows = [...moveTargets(o, at).map((t) => ({ key: t.key, top: t.top })), { key: hit.key, top: mine?.top ?? 0 }].sort((a, b) => a.top - b.top);
      const beside = rows.flatMap((r) => {
        const sec = r.key === hit!.key ? hit!.el : findMakerSection(doc, r.key);
        return sec ? [{ key: r.key, el: sec }] : [];
      });
      return { key: hit.key, el: hit.el, label: at.label, movable: true, beside };
    },
    /* A part that keeps its place says the step's own shipped reason; the Reveal, the prototype's line for it. */
    why: (s) => (s.key === REVEAL_STUB ? SCENE_DRAG_WORDS.revealWhy : makerPartStepWhy(s.label, false, false).earlier),
    busyWhy: PART_WORKING_WHY,
    /* Held or lifted, it is the picked part (the prototype's `pick` in `lift` and `nudge`) — picked AS A TAP PICKS:
       the page's own tap, on the part (the bridge then tells the Maker exactly what a finger's tap tells it, and the
       Maker moves the page for no pick the page itself made). And picked WHERE IT IS: the toolbar does not bring it
       to the middle of the page under the finger (`stageStill`). A part already picked is left alone. */
    pick: (s) => {
      if (s.key === canvas) return;
      stageStill.key = s.key === REVEAL_STUB ? null : s.key;
      const view = s.el.ownerDocument.defaultView;
      if (view) s.el.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, view }));
    },
    drop: (s, target, where) => {
      const o = askPartOps();
      const at = atKey(o, s.key);
      const t = o ? moveTargets(o, at).find((x) => x.key === target) : null;
      return o && t ? dropOn(o, t, where, at) : null;
    },
    remove: (s) => {
      const done = takeOff(atKey(askPartOps(), s.key));
      if (done && done !== 'asking') pickAfter(s.key);
      return done;
    },
    /* ↺ took a step of the drag's back and the page shows it: a scene put back is the picked part again. */
    undone: (step) => {
      const part = step.type === 'remove' && step.key ? makerPartOfCanvas(stage, step.key) : null;
      if (part) onPick?.(part);
    },
  });

  const band = typeof window === 'undefined' ? null : visibleBand(frame);
  const clampY = (y: number) => (band ? Math.max(band.top + PART_EDGE_ROOM, Math.min(band.bottom - PART_EDGE_ROOM, y)) : y);
  /* A ＋ sits ON the frame's edge or not at all: clamped into view it would land on the part's own content
     (owner: the lower ＋ sat on the pass's QR). Scroll the part, and its edge — and its ＋ — come back. */
  const onEdge = (y: number) => !band || (y >= band.top + PART_EDGE_ROOM && y <= band.bottom - PART_EDGE_ROOM);

  /* The toolbar's Edit row reads these (`PartEditsNow`); `box` re-renders this as the page settles, so they stay true. */
  const canStep = (dir: -1 | 1) => Boolean(typeof document !== 'undefined' && canMove && ops && box && neighbour(ops, dir));
  /** 🚶 The line for a step the ENTOURAGE holds — by name, in place of "already first / last" (which it is not). */
  const heldWhy = (): Partial<{ earlier: string; later: string }> => {
    if (!ops || !canMove || mv.kind !== 'scene') return {};
    const others = ops.list.shown.flatMap((t) => (t.kind === 'scene' && t.widgetId !== mv.id ? [t.type as string] : []));
    const held = heldByEntourage(stage, mv.type, others);
    /* Named as the Maker names that part on this stage ("Wedding March") — and only where the page draws one. */
    const drawsIt = ops.list.shown.some((t) => t.kind === 'fixed' && t.fixed === 'entourage');
    if (!held || !drawsIt) return {};
    const words = makerPartStepHeldWhy(label || 'This part', held, makerPartLabelOn(stage, 'march'));
    return held === 'after' ? (canStep(-1) ? {} : { earlier: words }) : canStep(1) ? {} : { later: words };
  };
  const now: Omit<PartEditsNow, 'node'> = {
    earlier: working ? null : canStep(-1) ? () => stepMove(-1) : null,
    later: working ? null : canStep(1) ? () => stepMove(1) : null,
    remove: working ? null : canRemove ? () => removeNow() : null,
    removeWord: ownScene ? 'Delete' : 'Remove',
    why: working ? { earlier: PART_WORKING_WHY, later: PART_WORKING_WHY, remove: PART_WORKING_WHY } : (lineWhy ?? { ...makerPartStepWhy(label || 'This part', canMove, canRemove), ...heldWhy() }),
    working,
    held: drag.held,
    status: drag.status,
    statusKey: drag.statusKey,
    say: drag.say,
  };
  if (typeof document === 'undefined') return { node: null, ...now };
  /* What just happened is said even once the part is let go (a move re-renders the page). */
  const edges = Boolean(picked && box) && !away;
  /* ✋ …and while a scene is held on the page the frame steps aside too: the lifted scene wears its own ring and its
     name there (`scene-canvas-drag.ts`). */
  const framed = edges && !drag.held;
  /* ▾ The name tag is the menu's door on a stage's page — never on a fixed page (the RSVP stage's lines move by their own hold). */
  const tagMenu = !fixedPages && !line;
  /* The prototype pads a picked part (`.el.on{padding-block:18px}`) so ＋ sits ON the frame, never over its words:
     the frame is drawn PART_PAD outside the part, and each 44 px tap lies wholly outside the part's box. */
  const fe = box ? partFrameEdges(box, box.gapAbove ?? null, box.gapBelow ?? null, PART_PAD) : null;
  const fr = box && fe ? { top: fe.top, left: box.left, width: box.width, height: fe.bottom - fe.top } : null;
  /* The prototype's chrome (`.el.on` · `.addp` · `.grip` · `.delp`): one outline with its soft halo and the part's
     name on its corner; ＋ 26 px on the middle of the top and bottom edges; the grip 30 × 22 on the right edge; 🗑 28 px
     on the top-right corner — each a 44 px tap around its face. Kept inside the screen. */
  const vw = typeof window === 'undefined' ? 375 : window.innerWidth;
  const at = (x: number, y: number) => ({ left: Math.max(0, Math.min(vw - 44, x - 22)), top: y - 22 });
  const tapAt = (x: number, y: number, h: number) => ({ ...at(x, y), top: y - h / 2, height: h, minHeight: 0 });
  const node = createPortal(
    <>
      {framed && box ? (
        <div
          data-part-edges={picked}
          className="pointer-events-none fixed inset-0 z-[86] lg:hidden"
          /* The frame lives ON the canvas: clipped to the page's visible band, never over the page tabs or the
             toolbar (owner 2026-10-07). */
          style={band ? { clipPath: `inset(${Math.max(0, band.top)}px 0 ${Math.max(0, window.innerHeight - band.bottom)}px 0)` } : undefined}
        >
          <div data-part-outline="" className={PART_OUTLINE} style={{ top: fr!.top, left: fr!.left, width: fr!.width, height: fr!.height }} />
          {tagMenu ? (
            /* ▾ THE NAME TAG IS THE DOOR FOR WHOEVER CANNOT DRAG (owner 2026-10-11, the approved prototype's `.lbl`):
               a tap opens Move up · Move down · Remove. Its face is where the tag always sat; the tap around it is
               as tall as the room the frame's edge has (the same room ＋ takes), never over the part's own words. */
            <button
              type="button"
              data-part-tag=""
              data-part-name=""
              aria-haspopup="menu"
              aria-label={SCENE_DRAG_WORDS.tag(name ?? label)}
              onClick={() => setMenu(true)}
              className="sn-press pointer-events-auto absolute z-[1] inline-flex min-w-11 items-start justify-start"
              style={{ top: clampY(fr!.top) - fe!.tapAbove / 2, left: Math.max(2, box.left - 2), height: fe!.tapAbove, paddingTop: Math.max(0, fe!.tapAbove / 2 - 11) }}
            >
              <span className={`inline-flex items-center gap-1.5 ${PART_TAG}`}>
                {name ?? label}
                <span aria-hidden className="h-0 w-0 border-x-4 border-t-[5px] border-x-transparent border-t-current opacity-85" />
              </span>
            </button>
          ) : (
            <span data-part-name="" className={`absolute z-[1] ${PART_TAG}`} style={{ top: clampY(fr!.top) - 11, left: Math.max(2, box.left - 2) }}>
              {line?.name ?? name ?? label}
            </span>
          )}
          {/* 🚫 NOTHING ELSE ON THE FRAME (owner 2026-10-09: "on preview screen, you only select" — the frame and its
              name say what is picked). ↑ ↓ ✕, the grip and 🗑 were here: a scene is moved by holding it on the page and
              removed by dropping it on the bin (owner 2026-10-11), its name tag is the door for whoever cannot drag,
              ↑ ↓ between parts is a swipe across the toolbar, and a tap on the page's ground lets go.
              ＋ STAYS FOR NOW: where a part is added is an OPEN owner question (`TOOLBAR-SPEC-2026-10-09.md` "Things
              with no home yet") — and it is the only way a removed part comes back. Never on a fixed page (the RSVP
              stage's screens, `makerStageIsFixedPages`). */}
          {fixedPages ? (
            lineAdd ? (
              /* The same ＋, on a LINE of a reply page: it adds a line (the stage's own sheet), never a scene. */
              <>
                {lineAdd.above ? (
                  <button type="button" aria-label={`Add above ${line?.name ?? name ?? label}`} data-part-add="above" onClick={() => lineAdd.onAdd('above')} className={EDGE_BTN} style={{ ...tapAt(box.left + box.width / 2, fr!.top, fe!.tapAbove), visibility: onEdge(fr!.top) ? undefined : 'hidden' }}>
                    <span className={ADD_FACE}>+</span>
                  </button>
                ) : null}
                {lineAdd.below && onEdge(fr!.top + fr!.height) ? (
                  <button type="button" aria-label={`Add below ${line?.name ?? name ?? label}`} data-part-add="below" onClick={() => lineAdd.onAdd('below')} className={EDGE_BTN} style={tapAt(box.left + box.width / 2, fr!.top + fr!.height, fe!.tapBelow)}>
                    <span className={ADD_FACE}>+</span>
                  </button>
                ) : null}
              </>
            ) : null
          ) : (
            <>
              {edgesOf.addAbove ? (
                <button type="button" aria-label={`Add above ${label}`} data-part-add="above" aria-busy={working === 'add' || undefined} onClick={() => askAdd('above')} className={EDGE_BTN} style={{ ...tapAt(box.left + box.width / 2, fr!.top, fe!.tapAbove), visibility: onEdge(fr!.top) ? undefined : 'hidden' }}>
                  <span className={ADD_FACE}>+</span>
                </button>
              ) : null}
              {edgesOf.addBelow && onEdge(fr!.top + fr!.height) ? (
                <button type="button" aria-label={`Add below ${label}`} data-part-add="below" aria-busy={working === 'add' || undefined} onClick={() => askAdd('below')} className={EDGE_BTN} style={tapAt(box.left + box.width / 2, fr!.top + fr!.height, fe!.tapBelow)}>
                  <span className={ADD_FACE}>+</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {toast && !error ? (
        <PeekToast key={toast.n} data="part" onGone={() => setToastNow((t) => (t?.n === toast.n ? null : t))}>
          {toast.words}
        </PeekToast>
      ) : null}
      {error ? (
        <p role="alert" data-part-error="" className="fixed inset-x-3 top-16 z-[87] rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-[rgb(var(--color-danger))] shadow lg:hidden">
          {error}
        </p>
      ) : null}
      {adding ? (
        <AddPartSheet
          stage={stage}
          where={adding}
          anchorLabel={label}
          placed={mv.kind === 'scene'}
          ops={ops}
          onAdd={add}
          onOwn={() => {
            setOwnWhere(adding);
            setAdding(null);
            setOwnOpen(true);
          }}
          onClose={() => setAdding(null)}
        />
      ) : null}
      {ownOpen && ops?.addOwn && 'action' in ops.addOwn ? (
        /* The SHIPPED picker — its trigger is the sheet's row, so its own button is not drawn — under the pop-up rule. */
        <OwnScenePicker onClose={() => setOwnOpen(false)}>
          <SceneTemplatePicker
            overlay
            draft
            open
            onOpenChange={(o) => setOwnOpen(o)}
            onPick={() => {
              setOwnOpen(false);
              ops.onPickTemplate();
            }}
            action={ops.addOwn.action}
            hidden={{ event_id: ops.eventId, return_to: ops.addOwn.returnTo, ...ownPlaceFields(ops, mv, ownWhere) }}
            stageLabel={ops.addOwn.stageLabel}
            heading={ops.addOwn.heading}
            triggerLabel="A scene of your own"
            initialView="phone"
            tour={ops.addOwn.tour ?? null}
            facts={ops.addOwn.facts ?? null}
            presets={ops.addOwn.presets ?? null}
          />
        </OwnScenePicker>
      ) : null}
      {drag.node}
      {menu && picked ? (
        <PartMenuSheet
          label={name ?? label}
          removeWord={now.removeWord}
          can={{ up: now.earlier !== null, down: now.later !== null, remove: now.remove !== null }}
          onStep={(step) => {
            setMenu(false);
            const go = step === 'up' ? now.earlier : step === 'down' ? now.later : now.remove;
            /* A grey row is never a dead tap: the line under the tools says why. */
            if (go) go();
            else drag.say(step === 'up' ? now.why.earlier : step === 'down' ? now.why.later : now.why.remove);
          }}
          onClose={() => setMenu(false)}
        />
      ) : null}
      {removing && removing.mv.kind === 'scene' ? (
        <RemovePartSheet label={removing.label} remover={ops?.removers[removing.mv.id] ?? askPartOps()?.removers[removing.mv.id] ?? null} onClose={() => setRemoving(null)} />
      ) : null}
    </>,
    document.body,
  );
  return { node, ...now };
}

/**
 * 🌑 "A SCENE OF YOUR OWN" FOLLOWS THE POP-UP RULE (owner 2026-10-08, `INTERACTION_RULES.md` § 9). The shipped
 * template picker sits in the lower third and, on a phone, left the page behind bright and live (`max-lg:bg-transparent`
 * — its file is in the Maker's first load, which has no room for more code). Here, in the lazy Stages chunk, the three
 * pieces are put AROUND it: the one dark (`.sn-popup-dark`) under the picker's own full-screen close button, every
 * other branch of the page out of reach, no scroll behind, Escape closes, Tab stays inside (`usePopupBehind`). The
 * picker itself is untouched. A pick is not tried on the page (it adds the scene and closes), so the dark is whole.
 */
function OwnScenePicker({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  usePopupBehind({ root, panel: root, onClose });
  return (
    <div ref={root} tabIndex={-1} className="focus:outline-none [&>div>button:first-child]:hidden" data-part-own-picker="">
      {/* Under the picker's own close button (z-90) and its box (z-91); over the page and the part's frame (z-86). */}
      <span aria-hidden data-part-own-picker-dark="" className="sn-popup-dark pointer-events-none fixed inset-0 z-[89]" />
      {children}
    </div>
  );
}

/**
 * ＋ THE ADDED PART IS BROUGHT ONTO THE SCREEN (owner 2026-10-11: "it did say venue added but i do not see it").
 * Added above or below the picked part it is on the page, and can still sit just past the edge of what a phone
 * shows — "added" said over a screen that looks the same. Once the page on show is the new one, it is scrolled to.
 */
function bringOntoScreen(canvasKey: string): void {
  const bring = () => {
    try {
      const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
      const marker = frame?.contentDocument?.querySelector(`[data-maker-section="${canvasKey}"]`);
      const part = marker?.nextElementSibling ?? marker;
      const view = frame?.contentWindow;
      if (!part || !view) return;
      const r = part.getBoundingClientRect();
      /* Already on the screen (some of it, in the upper part a phone shows above the tools): left where it is. */
      if (r.height > 0 && r.top < view.innerHeight * 0.6 && r.bottom > 40) return;
      /* At once — a gliding scroll was cut short by the page's own (a reload carries the old place over). */
      part.scrollIntoView({ block: 'center', behavior: 'auto' });
    } catch {
      /* a canvas that cannot be read keeps its place */
    }
  };
  bring();
  /* …and once the page has settled (the buffered canvas carries its scroll over a moment after the swap). */
  window.setTimeout(bring, 450);
  window.setTimeout(bring, 1100);
}

/** The page a tabbed canvas has ON SHOW, with the stage's pages as its tabs name them — null on a canvas drawn as one page (or unreadable). */
function readShownPage(stage: MakerStageKey): { stage: LifecyclePhase; pages: Array<{ key: string; label: string }>; shown: string } | null {
  try {
    const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    const shown = doc ? shownHubTab(doc) : null;
    if (!shown || !(LIFECYCLE_STAGES as readonly string[]).includes(stage)) return null;
    return { stage: stage as LifecyclePhase, pages: makerStagesPages(stage as LifecyclePhase).map((p) => ({ key: p.key, label: p.label })), shown };
  } catch {
    return null;
  }
}

/**
 * 📄 THE OTHER PAGE A PART IS DRAWN ON — null when it is the page on show (or the stage is one page). The canvas's own
 * filing (`makerStagesPageOf`), so what ＋ says and where the canvas draws it are one reading.
 */
/** The page on show, as its tab names it — null on a stage drawn as one page. */
function shownPageOf(stage: MakerStageKey): { key: string; label: string } | null {
  const here = readShownPage(stage);
  return here ? (here.pages.find((p) => p.key === here.shown) ?? null) : null;
}

function otherPageOf(stage: MakerStageKey, canvasKey: string): { key: string; label: string } | null {
  const here = readShownPage(stage);
  if (!here) return null;
  const key = makerStagesPageOf(here.stage, canvasKey, here.pages.map((p) => p.key));
  return key === here.shown ? null : (here.pages.find((p) => p.key === key) ?? null);
}
const LIFECYCLE_STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;

/** ＋ "Add above / below <part>" — the parts not on this page, grouped; then a scene of their own. */
function AddPartSheet({
  stage,
  where,
  anchorLabel,
  placed,
  ops,
  onAdd,
  onOwn,
  onClose,
}: {
  stage: MakerStageKey;
  where: 'above' | 'below';
  anchorLabel: string;
  /** The picked part is a SCENE, so a part of this page really lands above / below it. Off a fixed part (the
   *  Greeting, the cover) the added part takes its own place on the page — and nothing here says "above". */
  placed: boolean;
  ops: MakerPartOps | null;
  onAdd: (key: MakerPartKey) => void;
  onOwn: () => void;
  onClose: () => void;
}) {
  const drawn = new Set(readDrawnOrder());
  /* A scene the couple hid may still be drawn ghosted: it is NOT on the page. */
  for (const f of ops?.list.folded ?? []) if (f.hiddenByCouple) drawn.delete(f.key);
  /* 📄 ＋ OFFERS EVERYTHING THE STAGE CAN TAKE, AND SAYS WHERE EACH GOES (owner 2026-10-11, twice. First: ＋ below
     Message → Venue said "Venue added" and nothing appeared — he was on Welcome, and the canvas files the Venue on
     Details. Then, with parts of another page left out: "does not show the scenes to add"). A part another page
     draws is listed with that page's name on its row; pressing it adds it, opens that page and brings it onto the
     screen (`add`). */
  const groups = makerPartOffers({
    stage,
    present: drawn,
    pageOf: (canvasKey) => otherPageOf(stage, canvasKey),
    pathOf: (key, canvas): MakerPartAddPath => {
      if (!ops) return null;
      if (canvas.startsWith('w:')) {
        const f = ops.list.folded.find((x) => x.key === canvas);
        return f?.hiddenByCouple && f.widgetId ? { kind: 'add' } : null;
      }
      const scene = makerPostEventSceneOf(stage, key);
      const tile = scene ? ops.list.shown.find((t) => t.kind === 'post-event' && t.scene === scene) : null;
      if (!tile || tile.kind !== 'post-event') return null;
      if (tile.hidden && tile.switchKey) return { kind: 'add' };
      return tile.drawn ? null : { kind: 'waiting', note: tile.note ?? 'It shows once it has something in it.' };
    },
  });
  const own = ops?.addOwn ?? null;
  const used = own && 'action' in own && own.presets ? own.presets.used : (ops?.scenes.filter((s) => isCustomSectionType(s.type)).length ?? 0);
  const left = makerOwnScenesLeft(used);
  const proMark = own && 'action' in own && own.tried ? makerProMark({ owns: false, storeShell: false }) : null;
  /* 🏷 THE HEADER NEVER PROMISES A PLACE A PART WILL NOT GO. It names the place ("Add above Schedule") only while
     that is true of every row: the picked part is a scene, and every part offered is this page's. Otherwise it says
     "Add a part" and each row says its own place — another page's name; "above Schedule" for a part of this page
     when the picked part is a scene; this page's name when it is not (off the Greeting or the cover a part takes its
     OWN place on the page — "Message added above" was said of a Message drawn below the Countdown). */
  const mixed = groups.some((g) => g.parts.some((p) => p.onPage));
  const exact = placed && !mixed;
  const here = shownPageOf(stage);
  const placeOf = (p: MakerPartOffer) =>
    p.onPage ? `on ${p.onPage.label}` : exact ? null : placed ? `${where} ${anchorLabel}` : here ? `on ${here.label}` : null;
  return (
    <MakerSheet label={exact ? `Add ${where} ${anchorLabel}` : 'Add a part'} onClose={onClose}>
      <div className="flex flex-col pb-1" data-add-part-sheet={where}>
        {/* Nothing can be added to this STAGE at all — never said while another page's part could be. */}
        {groups.length === 0 ? <p className="px-3 py-2 text-[13.5px] text-ink/60">Every part is already on this page.</p> : null}
        {groups.map((g) => (
          <section key={g.label} data-add-part-group={g.label}>
            <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">{g.label}</p>
            <ul className="flex flex-col gap-0.5">
              {g.parts.map((p) => (
                <li key={p.key}>
                  {p.path.kind === 'add' ? (
                    <button type="button" data-add-part={p.key} onClick={() => onAdd(p.key)} className={STAGE_SHEET_ROW}>
                      <span className="min-w-0 flex-1 truncate">{p.label}</span>
                      {placeOf(p) ? (
                        <span data-add-part-place={p.onPage ? p.onPage.key : 'here'} className="shrink-0 text-[12.5px] font-medium text-ink/55">
                          {placeOf(p)}
                        </span>
                      ) : null}
                      <Plus aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2.4} />
                    </button>
                  ) : (
                    <div className={`${STAGE_SHEET_ROW} text-ink/45`} data-add-part-waiting={p.key}>
                      <span className="min-w-0 flex-1 truncate">{p.label}</span>
                      <Explain title={p.label}>{p.path.note}</Explain>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {own ? (
          <section data-add-part-own="">
            <p className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">
              A scene of your own
              {proMark ? <PaidMark state={proMark} label={paidMarkLabel(proMark, 'Event Hub Pro')} tone="auto" /> : null}
              <span className="font-semibold normal-case tracking-normal" data-own-left={left}>· {makerOwnScenesLine(used)}</span>
            </p>
            {'action' in own ? (
              <button type="button" disabled={left === 0} data-add-part-own-open="" onClick={onOwn} className={STAGE_SHEET_ROW}>
                <span className="min-w-0 flex-1 truncate">{left === 0 ? 'All six are in use' : 'Choose a template'}</span>
                {left === 0 ? null : <Plus aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2.4} />}
              </button>
            ) : (
              <p className="px-3 py-2 text-[13px] text-ink/60">{own.note}</p>
            )}
          </section>
        ) : null}
      </div>
    </MakerSheet>
  );
}

/**
 * ▾ MOVE UP · MOVE DOWN · REMOVE — the picked part's steps for whoever cannot drag (owner 2026-10-11; the approved
 * prototype's `#menu`, opened by the name tag). The Maker's one bottom sheet (`MakerSheet`, owner 2026-10-06: every
 * pop-up of the new Maker opens from the bottom, dark behind) with the prototype's three rows and their words. A
 * step the part cannot take is grey and still answers: the sheet closes and the line under the tools says why.
 */
const MENU_ICON = { up: ArrowUp, down: ArrowDown, remove: Trash2 } as const;
function PartMenuSheet({
  label,
  removeWord,
  can,
  onStep,
  onClose,
}: {
  label: string;
  removeWord: 'Remove' | 'Delete';
  can: { up: boolean; down: boolean; remove: boolean };
  onStep: (step: 'up' | 'down' | 'remove') => void;
  onClose: () => void;
}) {
  const rows = sceneMenuRows(can, removeWord);
  return (
    <MakerSheet label={label} onClose={onClose}>
      <ul className="flex flex-col gap-0.5 pb-1" data-part-menu="">
        {rows.map((r) => {
          const Icon = MENU_ICON[r.step];
          return (
            <li key={r.step}>
              <button
                type="button"
                data-part-menu-step={r.step}
                aria-disabled={r.on ? undefined : true}
                onClick={() => onStep(r.step)}
                className={`${STAGE_SHEET_ROW} ${r.on ? (r.danger ? '!text-[rgb(var(--color-danger))]' : '') : '!text-ink/40'}`}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate">{r.words}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </MakerSheet>
  );
}

/**
 * 🗑 THE ONE CONFIRM — "Delete this scene?", for a scene of the couple's OWN: the shipped Remove for good
 * (`sections-panel.tsx`), opened here so this sheet is the only question asked. Reached from the bin and from the
 * tag's Delete; it is never taken silently. (Any other part leaves at once — the eye, its words stay in Studio — and
 * the line under the tools offers Undo: `takeOff`.)
 */
function RemovePartSheet({ label, remover, onClose }: { label: string; remover: ReactNode; onClose: () => void }) {
  const w = makerRemoveWords(label, true);
  const ref = useRef<HTMLDivElement>(null);
  /* The shipped form is a disclosure; here the sheet IS the confirm, so it opens at once. */
  useEffect(() => {
    ref.current?.querySelectorAll('details').forEach((d) => (d.open = true));
  }, []);
  return (
    <MakerSheet label={w.title} onClose={onClose}>
      <div className="flex flex-col gap-2 px-3 pb-2" data-remove-part="delete">
        <p className="text-[14px] leading-snug text-ink/75">{w.body}</p>
        <div ref={ref} className="flex flex-col gap-2 [&_summary]:hidden [&_details]:m-0 [&_form>span]:hidden [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:text-[14px]">
          {remover ?? <p className="text-[13px] text-ink/60">This scene cannot be deleted here.</p>}
          <ActionButton tone="neutral" icon={Check} label="Keep it" onClick={onClose} className="!h-11 w-full" />
        </div>
      </div>
    </MakerSheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   🎭 THE REVEAL — the first part of Save the Date, Invitation › Welcome and
   The Day › Live
   ═══════════════════════════════════════════════════════════════════════════ */

/** The stages the Reveal is the first part of (Invitation is the `rsvp` lifecycle stage). */
export function revealStageOf(stage: MakerStageKey): RevealStage | null {
  return stage === 'save_the_date' || stage === 'rsvp' || stage === 'event' ? stage : null;
}

/**
 * The Reveal's tools: the SAME picker the work area registered
 * (`MakerLookPages.reveal`, `maker-made-once.tsx`), told which stage it is the
 * first part of — its kinds, Extras ▾ and Arrange › Hidden on this stage, with
 * its own draft saves (`maker-reveal.tsx`).
 */
export function RevealPartTools({ stage }: { stage: RevealStage }) {
  const node = useMaker()?.lookPages?.reveal ?? null;
  return (
    <div className="-mx-[10px] mt-2 flex min-h-0 flex-1 flex-col" data-reveal-part-tools={stage}>
      {node ? (
        <MakerRevealStageContext.Provider value={stage}>{node}</MakerRevealStageContext.Provider>
      ) : (
        <p className="px-1 py-3 text-[13px] text-ink/60">The reveal is opening…</p>
      )}
    </div>
  );
}

/**
 * ▶ THE REVEAL PLAYS — over the cover, once, as a guest meets it: the stage
 * PREVIEW (`?preview=draft`, `makerPageCanvasSrc` 'reveal') on the whole
 * screen; one tap closes it. Nothing is written.
 */
export function RevealPlay({ stage, onDone }: { stage: RevealStage; onDone: () => void }) {
  const url = useMaker()?.lookPages?.publicLandingUrl ?? null;
  const src = makerPageCanvasSrc(url, 'reveal', stage, { revealStage: stage });
  useEffect(() => {
    if (!src) onDone();
  }, [src, onDone]);
  if (!src || typeof document === 'undefined') return null;
  return createPortal(
    <div data-reveal-play={stage} className="fixed inset-0 z-[96] bg-black">
      <iframe title="The reveal" src={src} className="h-full w-full border-0" />
      <button
        type="button"
        aria-label="Stop"
        onClick={onDone}
        className="sn-press absolute right-3 top-[max(12px,env(safe-area-inset-top))] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink"
      >
        <X aria-hidden className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </div>,
    document.body,
  );
}
