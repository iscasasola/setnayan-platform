'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { isCustomSectionType } from '@/lib/custom-sections';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { makerPageCanvasSrc } from '@/lib/maker-made-once-pages';
import { MAKER_PARTS, makerDropSlot, makerRevealEdges, type MakerPartKey, type MakerStageKey } from '@/lib/maker-parts';
import {
  makerDropDelta,
  makerOwnScenesLeft,
  makerOwnScenesLine,
  makerPartCanvasOn,
  makerPartLabelOn,
  makerPartOffers,
  makerPostEventMoveDraft,
  makerPostEventSceneOf,
  makerRemoveWords,
  type MakerPartAddPath,
} from '@/lib/maker-part-groups';
import { postEventRun, postEventShow, type PostEventDraft } from '@/lib/post-event-draft';
import { stageTakesOwnScenes, swapsForDrop, type MakerTile } from '@/lib/maker-scene-list';
import type { RevealStage } from '@/lib/reveal-stages';
import { STAGE_SHEET_ROW, partFrameEdges } from '@/lib/maker-stage-room';
import { SceneTemplatePicker } from '../../website/editor/_components/scene-template-picker';
import { MakerSheet } from './stages-studio-parts';
import { PLACE_ORDER_FIELD, PLACE_STAGE_FIELD, ownScenePlaceOrder } from '@/lib/own-scene-place';
import { MakerRevealStageContext } from './maker-reveal';
import { MAKER_PART_OPS_EVENT, type MakerPartOps, type MakerPartRaw } from './maker-part-ops';
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
 *   grip drag the picked part up or down → ONE order write (the work area's
 *        own move, `lib/maker-reorder.ts`; Post Event: its run).
 *   🗑   "Remove from this page?" (the eye — its words stay in Studio) or, for a
 *        scene of their own, "Delete this scene?" (the shipped Remove for good)
 *        — the ONLY confirm in the Maker.
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
    list: raw.list,
    fullOrder: raw.fullOrder,
    afterLastShown: raw.afterLastShown,
    scenes: raw.scenes,
    move: raw.move,
    eye: (id) => {
      const sc = byId.get(id);
      if (sc) raw.eyeWrite(sc);
    },
    removers: raw.sceneRemovers,
    postEvent: nav && nav !== 'unreadable' ? nav.arrangement : null,
    draftAction: raw.elementEditing?.draftAction ?? null,
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

/** The Reveal part drawn at the top of the page in Stages, or null (`stage-tools.tsx`). */
function readRevealPart(): Element | null {
  try {
    return document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument?.querySelector('[data-maker-reveal-part]') ?? null;
  } catch {
    return null;
  }
}

/** A part's box on the SCREEN (the canvas is a same-origin frame; it may be drawn scaled). */
function partBox(canvas: string, el?: string | null): Box | null {
  const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
  const doc = frame?.contentDocument;
  if (!frame || !doc) return null;
  /* 🎭 The Reveal is drawn at the top of the page in Stages (`stage-tools.tsx` `drawRevealPart`). */
  let node: Element | null = canvas === REVEAL_STUB ? doc.querySelector('[data-maker-reveal-part]') : findMakerSection(doc, canvas);
  if (node && el) node = node.querySelector(`[data-el="${CSS.escape(el)}"]`) ?? node;
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
export function makerPartTopOnScreen(stage: MakerStageKey, key: MakerPartKey): number | null {
  const canvas = key === 'reveal' ? REVEAL_STUB : makerPartCanvasOn(stage, key);
  if (!canvas) return null;
  return partBox(canvas, MAKER_PARTS[key].el ?? null)?.top ?? null;
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
function visibleBand(): { top: number; bottom: number } {
  const fr = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.getBoundingClientRect();
  const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
  /* The guest's tab bar is drawn over the foot of the page (`stage-tools.tsx`). */
  const bar = document.querySelector('[data-stage-guest-bar]')?.getBoundingClientRect();
  const top = fr ? fr.top : 0;
  const bottom = Math.min(fr ? fr.bottom : window.innerHeight, lt ? lt.top : window.innerHeight, bar && bar.height > 0 ? bar.top : window.innerHeight);
  return { top, bottom };
}

/** What the picked part is, for the edges: a scene the navigator moves, a Post Event scene, or a fixed part. */
type Movable =
  | { kind: 'scene'; id: string; own: boolean }
  | { kind: 'post-event'; scene: string; runKey: string | null; switchKey: string | null }
  | { kind: 'fixed' };

function movableOf(ops: MakerPartOps | null, canvas: string | null): Movable {
  if (!ops || !canvas) return { kind: 'fixed' };
  const t = ops.list.shown.find((x) => x.key === canvas || (x.kind === 'post-event' && x.anchor === canvas));
  if (t?.kind === 'scene') return { kind: 'scene', id: t.widgetId, own: isCustomSectionType(t.type) };
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
/** ↑ ↓ ✕ — a 32 px tap (the owner's floor for these), its 24 px face in the frame's orange. */
const CHIP_BTN = 'sn-press pointer-events-auto absolute inline-flex !h-8 !min-h-0 w-8 items-center justify-center rounded-full';
const CHIP_FACE = 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#C24E25] text-white shadow-[0_0_0_2px_#fff]';
const ADD_FACE =
  'inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#C24E25] font-sans text-[18px] font-semibold leading-none text-white shadow-[0_0_0_3px_#fff,0_4px_10px_-4px_rgba(0,0,0,.4)]';

/**
 * THE PICKED PART'S EDGES — ＋ on its top and bottom, the grip, 🗑. Drawn over
 * the canvas at the part's own place, following the page as it scrolls; kept
 * inside the visible band. `picked` null: nothing is drawn. Layered just over
 * the Maker shell (z-80) and under every sheet (the picker z-90, `MakerSheet` z-95).
 */
export function PartEdits({
  stage,
  picked,
  onPrev = null,
  onNext = null,
  onClose = null,
}: {
  stage: MakerStageKey;
  picked: MakerPartKey | null;
  /** ↑ / ↓ the part above / below (null: nowhere to go — its chip is not drawn) · ✕ let it go (owner 2026-10-07). */
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  onClose?: (() => void) | null;
}) {
  const isReveal = picked === 'reveal';
  const canvas = isReveal ? REVEAL_STUB : picked ? makerPartCanvasOn(stage, picked) : null;
  const el = picked ? (MAKER_PARTS[picked].el ?? null) : null;
  const [box, setBox] = useState<Box | null>(null);
  const [adding, setAdding] = useState<'above' | 'below' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  /* ＋ Which edge "A scene of your own" was asked from — it lands there (owner 2026-10-07). */
  const [ownWhere, setOwnWhere] = useState<'above' | 'below' | null>(null);
  const [drag, setDrag] = useState<{ dy: number; line: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* The prototype's toast — what just happened, said at once ("Song added below"). */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);
  const [ops, setOps] = useState<MakerPartOps | null>(null);

  /* The part's box, every frame while it is picked (one rect read — the canvas scrolls under it). */
  useEffect(() => {
    if (!canvas) {
      setBox(null);
      return;
    }
    let raf = 0;
    let last = '';
    const tick = () => {
      const b = partBox(canvas, el);
      const sig = b ? `${Math.round(b.top)}|${Math.round(b.left)}|${Math.round(b.width)}|${Math.round(b.height)}|${Math.round(b.gapAbove ?? -1)}|${Math.round(b.gapBelow ?? -1)}` : '';
      if (sig !== last) {
        last = sig;
        setBox(b);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [canvas, el]);
  /* The work area's writes, read again whenever the part changes (and its render lands). */
  const renderStamp = useMaker()?.renderStamp;
  useEffect(() => setOps(askPartOps()), [canvas, renderStamp, adding, removing]);

  const mv = isReveal ? ({ kind: 'fixed' } as Movable) : movableOf(ops, canvas);
  const ownScene = mv.kind === 'scene' && mv.own;
  /* 🎭 THE REVEAL IS LOCKED FIRST (owner 2026-10-07: *"the move feature or add a slide above on reveal must be
     removed (for reveal only) because that should be its limitation"*): no grip, no ＋ above, no 🗑 — it hides per
     stage through Arrange › On this stage. Its ＋ below stays. `makerRevealEdges`. */
  const edgesOf = makerRevealEdges(isReveal);
  const canRemove = edgesOf.remove && (mv.kind === 'scene' || (mv.kind === 'post-event' && mv.switchKey !== null));
  const canMove = edgesOf.grip && (mv.kind === 'scene' || (mv.kind === 'post-event' && mv.runKey !== null));
  const label = picked ? makerPartLabelOn(stage, picked) : '';

  /* ── 💾 the Post Event saves (its switch, its run) — the one draft door ── */
  const saveEditorial = useCallback((draft: PostEventDraft, said: string, hide?: string) => {
    const o = askPartOps();
    if (!o?.draftAction) return;
    /* Drawn first: a scene taken off is gone from the page now (the bridge's `sceneShow`),
       and what happened is said at once; the draft save runs behind it. */
    if (hide) postToCanvas({ source: 'setnayan-editor', t: 'sceneShow', key: hide, shown: false });
    setToast(said);
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ editorial: draft }));
    setError(null);
    makerSave(() => o.draftAction!(o.eventId, fd), requestMakerRefresh)
      .then((r) => {
        if (!r.ok) setError(r.error);
      })
      .catch(() => setError('That change could not be saved. Please try again — nothing was lost.'));
  }, []);

  /* ── ↕ the grip ── */
  const dragRef = useRef<{ y0: number; targets: Array<{ key: string; id: string; mid: number; top: number; bottom: number }> } | null>(null);
  const targetAt = (d: typeof dragRef.current, y: number) => {
    if (!d || d.targets.length === 0) return null;
    for (const t of d.targets) if (y < t.mid) return { t, where: 'above' as const };
    return { t: d.targets[d.targets.length - 1]!, where: 'below' as const };
  };
  const onGripDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const o = askPartOps();
    if (!o || !canMove || !canvas) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks — the drag still follows the button's own events */
    }
    const targets: Array<{ key: string; id: string; mid: number; top: number; bottom: number }> = [];
    for (const t of o.list.shown) {
      const key = t.kind === 'post-event' ? t.anchor : t.key;
      if (!key || key === canvas) continue;
      if (mv.kind === 'scene' && t.kind !== 'scene') continue;
      if (mv.kind === 'post-event' && (t.kind !== 'post-event' || !t.runKey || t.runKey === mv.runKey)) continue;
      const b = partBox(key);
      if (!b) continue;
      targets.push({ key, id: t.kind === 'scene' ? t.widgetId : t.kind === 'post-event' ? (t.runKey ?? t.scene) : key, mid: b.top + b.height / 2, top: b.top, bottom: b.top + b.height });
    }
    targets.sort((a, b) => a.mid - b.mid);
    dragRef.current = { y0: e.clientY, targets };
    setDrag({ dy: 0, line: null });
  };
  const onGripMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const at = targetAt(d, e.clientY);
    setDrag({ dy: e.clientY - d.y0, line: at ? (at.where === 'above' ? at.t.top : at.t.bottom) : null });
  };
  const onGripUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || Math.abs(e.clientY - d.y0) < 8) return;
    const at = targetAt(d, e.clientY);
    const o = askPartOps();
    if (!at || !o) return;
    /* 🎭 Nothing lands above the Reveal: slot 0 (above it) becomes slot 1 — above the page's first other part. */
    const revealLeads = readRevealPart() !== null;
    const slot = makerDropSlot(revealLeads ? d.targets.indexOf(at.t) + (at.where === 'below' ? 2 : 1) : d.targets.indexOf(at.t) + (at.where === 'below' ? 1 : 0), revealLeads);
    const dropAt = revealLeads && slot === 1 && d.targets[0] ? { t: d.targets[0], where: 'above' as const } : at;
    if (mv.kind === 'scene') {
      const shown = o.list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
      const delta = makerDropDelta({ fullOrder: o.fullOrder, shown, afterLastShown: o.afterLastShown, id: mv.id, target: dropAt.t.id, where: dropAt.where });
      if (delta !== 0) {
        setToast(`${label} moved`);
        o.move(mv.id, delta);
      }
    } else if (mv.kind === 'post-event' && mv.runKey && o.postEvent) {
      const run = postEventRun(o.postEvent);
      const from = run.indexOf(mv.runKey);
      let to = run.indexOf(dropAt.t.id) + (dropAt.where === 'below' ? 1 : 0);
      if (from < 0 || to < 0) return;
      if (to > from) to -= 1;
      const draft = makerPostEventMoveDraft(o.postEvent, mv.scene, to - from);
      if (draft) saveEditorial(draft, `${label} moved`);
    }
  };

  /* ── ＋ add a part ── */
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
      /* Where: above / below the picked scene in the stage's order — the work area's one-save move. */
      if (mv.kind === 'scene') {
        const shown = o.list.shown.flatMap((t) => (t.kind === 'scene' ? [t.widgetId] : []));
        const before = where === 'above' ? mv.id : (shown[shown.indexOf(mv.id) + 1] ?? o.afterLastShown);
        const delta = swapsForDrop(o.fullOrder, folded.widgetId, before === folded.widgetId ? null : before);
        if (delta !== 0) o.move(folded.widgetId, delta);
      }
      setToast(`${makerPartLabelOn(stage, key)} added ${where}`);
      o.eye(folded.widgetId);
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

  /* ── 🗑 take it off (after the one confirm) ── */
  const removeYes = () => {
    const o = askPartOps();
    setRemoving(false);
    if (!o) return;
    if (mv.kind === 'scene' && !mv.own) {
      setToast(`${label} removed from this page`);
      o.eye(mv.id);
    } else if (mv.kind === 'post-event' && mv.switchKey && o.postEvent) {
      saveEditorial(postEventShow(o.postEvent, mv.switchKey as Parameters<typeof postEventShow>[1], false), `${label} removed from this page`, canvas ?? undefined);
    }
  };

  const band = typeof window === 'undefined' ? null : visibleBand();
  const clampY = (y: number) => (band ? Math.max(band.top + 26, Math.min(band.bottom - 26, y)) : y);
  /* A ＋ sits ON the frame's edge or not at all: clamped into view it would land on the part's own content
     (owner: the lower ＋ sat on the pass's QR). Scroll the part, and its edge — and its ＋ — come back. */
  const onEdge = (y: number) => !band || (y >= band.top + 26 && y <= band.bottom - 26);

  if (typeof document === 'undefined') return null;
  /* What just happened is said even once the part is let go (a move re-renders the page). */
  const edges = Boolean(picked && box);
  /* The prototype pads a picked part (`.el.on{padding-block:18px}`) so ＋ sits ON the frame, never over its words:
     the frame is drawn PART_PAD outside the part, and each 44 px tap lies wholly outside the part's box. */
  const fe = box ? partFrameEdges(box, box.gapAbove ?? null, box.gapBelow ?? null, PART_PAD) : null;
  const fr = box && fe ? { top: fe.top, left: box.left, width: box.width, height: fe.bottom - fe.top } : null;
  /* The prototype's chrome (`.el.on` · `.addp` · `.grip` · `.delp`): one outline with its soft halo and the part's
     name on its corner; ＋ 26 px on the middle of the top and bottom edges; the grip 30 × 22 on the right edge; 🗑 28 px
     on the top-right corner — each a 44 px tap around its face. Kept inside the screen. */
  const vw = typeof window === 'undefined' ? 375 : window.innerWidth;
  const at = (x: number, y: number) => ({ left: Math.max(0, Math.min(vw - 44, x - 22)), top: y - 22 });
  /** A control on a frame edge whose tap is only as tall as the gap there (`partFrameEdges`). */
  const chipAt = (x: number, y: number) => ({ left: Math.max(0, Math.min(vw - 32, x - 16)), top: y - 16 });
  const tapAt = (x: number, y: number, h: number) => ({ ...at(x, y), top: y - h / 2, height: h, minHeight: 0 });
  return createPortal(
    <>
      {edges && box ? (
        <div
          aria-hidden={drag ? true : undefined}
          data-part-edges={picked}
          className="pointer-events-none fixed inset-0 z-[86] lg:hidden"
          /* The frame lives ON the canvas: clipped to the page's visible band, never over the "You're editing"
             strip, the page tabs or the panel (owner 2026-10-07). */
          style={band ? { clipPath: `inset(${Math.max(0, band.top)}px 0 ${Math.max(0, window.innerHeight - band.bottom)}px 0)` } : undefined}
        >
          <div
            data-part-outline=""
            className="absolute rounded-lg shadow-[0_0_0_2px_#C24E25,0_0_0_7px_rgba(194,78,37,.14)]"
            style={{ top: fr!.top, left: fr!.left, width: fr!.width, height: fr!.height, transform: drag ? `translateY(${drag.dy}px)` : undefined }}
          />
          {drag ? null : (
            <span
              data-part-name=""
              className="absolute z-[1] rounded-sm bg-[#C24E25] px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-white"
              style={{ top: clampY(fr!.top) - 11, left: Math.max(2, box.left - 2) + (onPrev ? 30 : 0) }}
            >
              {label}
            </span>
          )}
          {drag?.line != null ? <div className="absolute h-1 rounded-full bg-[#C24E25]" style={{ top: drag.line - 2, left: box.left, width: box.width }} /> : null}
          {drag ? null : (
            <>
              {edgesOf.addAbove ? (
                <button type="button" aria-label={`Add above ${label}`} data-part-add="above" onClick={() => setAdding('above')} className={EDGE_BTN} style={{ ...tapAt(box.left + box.width / 2, fr!.top, fe!.tapAbove), visibility: onEdge(fr!.top) ? undefined : 'hidden' }}>
                  <span className={ADD_FACE}>+</span>
                </button>
              ) : null}
              {onEdge(fr!.top + fr!.height) ? (
                <button type="button" aria-label={`Add below ${label}`} data-part-add="below" onClick={() => setAdding('below')} className={EDGE_BTN} style={tapAt(box.left + box.width / 2, fr!.top + fr!.height, fe!.tapBelow)}>
                  <span className={ADD_FACE}>+</span>
                </button>
              ) : null}
              {/* ↑ upper-left · ↓ lower-left · ✕ lower-right (owner 2026-10-07, verbatim: "upper left of the highlight is
                  go to the element above · lower left of the highlight is to go to the next element under · lower
                  right is deselect"). Each a 32 px tap on the frame's corner, a face in the frame's own orange. */}
              {onPrev && onEdge(fr!.top) ? (
                <button type="button" aria-label="Previous part" data-part-step="prev" onClick={onPrev} className={CHIP_BTN} style={chipAt(box.left + 2, fr!.top)}>
                  <span className={CHIP_FACE}>
                    <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>
              ) : null}
              {onNext && onEdge(fr!.top + fr!.height) ? (
                <button type="button" aria-label="Next part" data-part-step="next" onClick={onNext} className={CHIP_BTN} style={chipAt(box.left + 2, fr!.top + fr!.height)}>
                  <span className={CHIP_FACE}>
                    <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>
              ) : null}
              {onClose && onEdge(fr!.top + fr!.height) ? (
                <button type="button" aria-label={`Let go of ${label}`} data-part-deselect="" onClick={onClose} className={CHIP_BTN} style={chipAt(box.left + box.width - 2, fr!.top + fr!.height)}>
                  <span className={CHIP_FACE}>
                    <X aria-hidden className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>
              ) : null}
              {canRemove ? (
                <button
                  type="button"
                  aria-label={ownScene ? `Delete ${label}` : `Remove ${label} from this page`}
                  data-part-remove=""
                  onClick={() => setRemoving(true)}
                  className={EDGE_BTN}
                  style={at(box.left + box.width - 6, clampY(fr!.top))}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-[#B3261E] bg-white text-[#B3261E] shadow-[0_2px_6px_-2px_rgba(0,0,0,.3)]">
                    <Trash2 aria-hidden className="h-[15px] w-[15px]" strokeWidth={2} />
                  </span>
                </button>
              ) : null}
            </>
          )}
          {canMove ? (
            <button
              type="button"
              aria-label={`Drag to move ${label}`}
              data-part-grip=""
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
              }}
              className={`${EDGE_BTN} touch-none`}
              style={{ ...at(box.left + box.width - 5, clampY(box.top + box.height / 2)), transform: drag ? `translateY(${drag.dy}px)` : undefined }}
            >
              <span className="inline-flex h-[22px] w-[30px] items-center justify-center rounded-md bg-[#C24E25] text-white shadow-[0_0_0_3px_#fff]">
                <GripVertical aria-hidden className="h-4 w-4" strokeWidth={2.4} />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
      {toast && !error ? (
        <p role="status" data-part-toast="" className="pointer-events-none fixed inset-x-3 top-16 z-[87] mx-auto w-fit max-w-[calc(100%-24px)] truncate rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-cream shadow lg:hidden">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="fixed inset-x-3 top-16 z-[87] rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-terracotta-700 shadow lg:hidden">
          {error}
        </p>
      ) : null}
      {adding ? (
        <AddPartSheet
          stage={stage}
          where={adding}
          anchorLabel={label}
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
        /* The SHIPPED picker — its trigger is the sheet's row, so its own button is not drawn. */
        <div className="[&>div>button:first-child]:hidden" data-part-own-picker="">
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
        </div>
      ) : null}
      {removing ? (
        <RemovePartSheet
          label={label}
          own={ownScene}
          remover={ownScene && mv.kind === 'scene' ? (ops?.removers[mv.id] ?? null) : null}
          onYes={removeYes}
          onClose={() => setRemoving(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}

/** ＋ "Add above / below <part>" — the parts not on this page, grouped; then a scene of their own. */
function AddPartSheet({
  stage,
  where,
  anchorLabel,
  ops,
  onAdd,
  onOwn,
  onClose,
}: {
  stage: MakerStageKey;
  where: 'above' | 'below';
  anchorLabel: string;
  ops: MakerPartOps | null;
  onAdd: (key: MakerPartKey) => void;
  onOwn: () => void;
  onClose: () => void;
}) {
  const drawn = new Set(readDrawnOrder());
  /* A scene the couple hid may still be drawn ghosted: it is NOT on the page. */
  for (const f of ops?.list.folded ?? []) if (f.hiddenByCouple) drawn.delete(f.key);
  const groups = makerPartOffers({
    stage,
    present: drawn,
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
  return (
    <MakerSheet label={`Add ${where} ${anchorLabel}`} onClose={onClose}>
      <div className="flex flex-col pb-1" data-add-part-sheet={where}>
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
                      <Plus aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.4} />
                    </button>
                  ) : (
                    <div className={`${STAGE_SHEET_ROW} text-ink/45`} data-add-part-waiting={p.key}>
                      <span className="min-w-0 flex-1 truncate">{p.label}</span>
                      <InfoTip label="" ariaLabel={`About ${p.label}`} align="end">
                        {p.path.note}
                      </InfoTip>
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
                {left === 0 ? null : <Plus aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.4} />}
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
 * 🗑 THE ONE CONFIRM. A part of the page: "Remove from this page?" — the eye;
 * its words stay in Studio and ＋ brings it back. A scene of their own: "Delete
 * this scene?" — the shipped Remove for good (`sections-panel.tsx`), opened here
 * so this sheet is the only question asked.
 */
function RemovePartSheet({
  label,
  own,
  remover,
  onYes,
  onClose,
}: {
  label: string;
  own: boolean;
  remover: ReactNode;
  onYes: () => void;
  onClose: () => void;
}) {
  const w = makerRemoveWords(label, own);
  const ref = useRef<HTMLDivElement>(null);
  /* The shipped form is a disclosure; here the sheet IS the confirm, so it opens at once. */
  useEffect(() => {
    ref.current?.querySelectorAll('details').forEach((d) => (d.open = true));
  }, []);
  return (
    <MakerSheet label={w.title} onClose={onClose}>
      <div className="flex flex-col gap-2 px-3 pb-2" data-remove-part={own ? 'delete' : 'remove'}>
        <p className="text-[14px] leading-snug text-ink/75">{w.body}</p>
        {own ? (
          <div ref={ref} className="flex flex-col gap-2 [&_summary]:hidden [&_details]:m-0 [&_form>span]:hidden [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:text-[14px]">
            {remover ?? <p className="text-[13px] text-ink/60">This scene cannot be deleted here.</p>}
            <button type="button" onClick={onClose} className="sn-press h-11 rounded-full bg-ink/[0.06] text-[14px] font-semibold text-ink">
              Keep it
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="sn-press h-11 flex-1 rounded-full bg-ink/[0.06] text-[14px] font-semibold text-ink">
              Keep it
            </button>
            <button type="button" data-remove-part-yes="" onClick={onYes} className="sn-press h-11 flex-1 rounded-full bg-danger-600 text-[14px] font-semibold text-white">
              {w.yes}
            </button>
          </div>
        )}
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
