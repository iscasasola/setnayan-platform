'use client';

import { StudioColourField } from './studio-colour-field';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FORM_PICK_CLASS, FormRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { Explain } from '@/app/_components/explain';
import { PillSelector } from '@/app/_components/pill-selector';
import { Slider as TemplateSlider } from '@/app/_components/slider';
import { GuestConfirmActions, GuestPopup } from '../../guests/_components/guest-popup';
import { plainRefusal } from '../../guests/_components/plain-refusal';
import { logoDraftFields, LOGO_NOT_SAVED } from '@/lib/studio-logo-saves';
import { useMaker } from './maker-context';
import { LOGO_PANEL_PHONE } from '@/lib/logo-maker-layout';
import { makerSave } from '@/lib/maker-refresh';
import { STAGE_PANEL_VARS } from '@/lib/maker-stage-room';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Copy, Crosshair, Eye, EyeOff, Lock, LockOpen, Palette, PenLine, Play, RotateCcw, Scissors, Square, Trash2, X } from 'lucide-react';
import { createLogoSaveGate } from '@/lib/maker-logo-save-gate';
import { announceMakerSave } from '@/lib/maker-save-status';
import type { MakerLogoOpening } from '@/lib/maker-logo-opening';
import type { HubFontKey } from '@/lib/hub-fonts';
import { FontPick } from '../../website/editor/_components/font-pick';
import type { PickOption } from '../../website/editor/_components/pick-menu';
import { letterRun, logoFontOutlineUrl, outlineWords, pinLogoFaceWeight, type OtFace } from '@/lib/logo-fonts';
import { fileToMarkSvg } from '@/lib/monogram-studio/upload';
import { paidMarkLabel, type PaidMarkState } from '@/lib/paid-mark';
import {
  LOGO_DEFAULT_INK,
  LOGO_DELAY_MAX,
  LOGO_DUR_MAX,
  LOGO_DUR_MIN,
  LOGO_DUR_STEP,
  LOGO_DELAY_STEP,
  LOGO_DURING,
  LOGO_FRAME,
  LOGO_FRAME_KINDS,
  LOGO_IN,
  LOGO_MAX_LAYERS,
  LOGO_OUT,
  LOGO_ROTATE_MAX,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  LOGO_SPACING_MAX,
  LOGO_SPACING_MIN,
  LOGO_WRITE_MAX_PTS,
  defaultMotion,
  evenlyThinned,
  logoInSeconds,
  type LogoFrameKind,
  type LogoLayer,
} from '@/lib/logo-layers';
import {
  LOGO_DURING_LABEL,
  LOGO_FRAME_LABEL,
  LOGO_LAYER_KIND_LABEL,
  LOGO_IN_LABEL,
  LOGO_LOOKS,
  LOGO_LOOK_LABEL,
  LOGO_OUT_LABEL,
  clampToFrame,
  composeLogoSvg,
  defaultWriteWidth,
  duplicateLayer,
  effectiveIn,
  frameBody,
  frameToLayer,
  halfExtent,
  layerShapes,
  layerTransform,
  logoColourChoices,
  layerToFrame,
  layersFromSaved,
  metaOf,
  moveLayerTo,
  newLayerId,
  retimeLayers,
  reversedWrite,
  snapInFrame,
  snapSliderToCentre,
  splitIntoLetters,
  tintParts,
  LOGO_PART_TINTS,
  svgAsLayerBody,
  writePathD,
  writePartPassages,
  type LogoGlyphCut,
  type LogoLook,
} from '@/lib/logo-layers-edit';
import { LOGO_ORNAMENT_KINDS, LOGO_ORNAMENT_LABEL, ornamentBody, ornamentOf, swapOrnament, type LogoOrnamentKind } from '@/lib/logo-ornaments';
import { logoParts, partCovers } from '@/lib/logo-parts-dom';
import { PaidMark } from '@/app/_components/paid-mark';
import { LayeredLogoPlayer } from '@/app/_components/layered-logo-player';
import { useLogoActions } from './logo-actions-context';
import { LogoAddLayer, LogoLayerCards, cardName, type LayerCardAction, type LogoAddKind } from './logo-layer-cards';
import { StyleCards } from './stage-panel/style-carousel';

/**
 * 🅻 THE LOGO PAGE — A FULL-SCREEN LAYERED EDITOR, LIKE THE MAKER ITSELF (owner
 * 2026-09-27, DECISION_LOG "THE LOGO MAKER IS A FULL-SCREEN LAYERED EDITOR"),
 * REPLOTTED AS STAGES ARE (owner 2026-10-08, `LOGO_MAKER_REPLOT_2026-10-08_fable.md`,
 * approved *"approve add ornament"*): *"Workspace. Layers and tools. that is it.
 * Tools allow character (if text) and animation … the layers above it replace the
 * eventbar and add a carousel for adding layers"*.
 *
 *   · NO HEADER — the page is the body under the Maker's own toolbar; the draft
 *     status ("Saving…", "Saved to your draft", or the error in words) is in the
 *     toolbar's Apply area (`lib/maker-save-status.ts`).
 *   · WORKSPACE: the logo's square frame. The picked layer wears a dashed frame
 *     and nothing else (owner 08 Oct: the four chips are "not needed anymore";
 *     the Play on the logo went too — "there is a play button under"). ONE
 *     finger drags it (RAILS ON: it stays inside the frame and snaps to the
 *     centre and the edges); TWO fingers pinch it bigger or smaller and twist
 *     it round (owner 08 Oct: *"when we pinch and twist, the sliders auto adjust
 *     with it too"*) — the same values the sliders hold, so each moves the other.
 *   · LAYERS CAROUSEL (L2, `logo-layer-cards.tsx`): one card per layer, top of
 *     the stack first, where the event bar was; hold and drag to reorder; the
 *     picked card's ⋯ = Hide · Lock · Duplicate · Delete; the last card adds.
 *     A desk draws the same cards as the left column.
 *   · TOOLS (L3): `[Character | Style | Animate] · ▶ · ⓘ` over the open tool.
 *     Character (a text layer only): Words · Font · Size · Spacing · Colour ·
 *     Split into letters. Style: Looks · the kind's own control · Colour ·
 *     Size · Across · Up / down · Rotate · Hide · Lock · Duplicate · Delete.
 *     Animate: Build in · Action · Build out over the shipped motion.
 *
 * ✍ "SHOW HOW IT'S WRITTEN" (owner 2026-09-27, of his C: *"it loops to the left
 * goes up makes the c and ends with a curl"*): on an image or text layer the
 * couple traces the letter once, in writing order, with a finger or the mouse.
 * That centreline is the layer's writing path; "Draw on" reveals the real
 * letterform in the order the pen reaches it. Without one, Draw on traces the
 * letter's own outline and inks it in — a new layer's default (owner
 * 2026-09-28: *"logo animation lost its trace effect"*).
 *
 * An uploaded image is traced to vector in the browser (the repo's own tracer,
 * `fileToMarkSvg`) — black ink on white comes back as shapes and the white is
 * gone. Two uploads made on the same canvas fill the frame the same way, so they
 * land exactly on top of each other with no positioning.
 *
 * 🛑 NEVER SAVES ON OPEN (#6023): the save gate takes the logo as it stood at the
 * couple's first own touch and saves only a logo that differs from it. A drag or
 * a pinch is ONE change: nothing is sent while a finger is down, so ↺ Undo takes
 * the whole gesture back in one step.
 */
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; text: string };
type LogoTool = 'character' | 'style' | 'animate';
type LogoPhase = 'in' | 'action' | 'out';

const PAUSE_MS = 1500;
/** A twist within this many degrees of upright lands upright (the sliders' centre snap, for the fingers). */
const TWIST_SNAP_DEG = 4;

/* ── text → shapes (the stages' own faces, as outlines — lib/logo-fonts.ts) ── */

type Face = OtFace;
const faces = new Map<string, Promise<Face>>();
function loadFace(url: string): Promise<Face> {
  let p = faces.get(url);
  if (!p) {
    p = (async () => {
      const [mod, buf] = await Promise.all([
        import('opentype.js'),
        fetch(url).then((r) => {
          if (!r.ok) throw new Error('font');
          return r.arrayBuffer();
        }),
      ]);
      const ot = ((mod as { parse?: unknown }).parse ? mod : (mod as { default: unknown }).default) as {
        parse: (b: ArrayBuffer) => Face;
      };
      return ot.parse(buf);
    })();
    p.catch(() => faces.delete(url));
    faces.set(url, p);
  }
  return p;
}
async function textShapes(text: string, key: HubFontKey, italic: boolean, spacing = 0): Promise<{ body: string; w: number; h: number } | null> {
  const words = text.trim();
  if (!words) return null;
  const face = await loadFace(logoFontOutlineUrl(key, italic));
  pinLogoFaceWeight(face, key);
  const S = 200;
  const bb = outlineWords(face, words, 0, 0, S, spacing).getBoundingBox();
  if (!(bb.x2 > bb.x1) || !(bb.y2 > bb.y1)) return null;
  const d = outlineWords(face, words, -bb.x1, -bb.y1, S, spacing).toPathData(2);
  return { body: `<path d="${d}"/>`, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };
}

/**
 * ✂ The word cut into its letters, as the face sets it (L4): each letter's own outline in its own box, and where that
 * box's middle sits in the WORD's box — the same box `textShapes` draws the word in.
 */
async function letterCuts(l: LogoLayer): Promise<{ word: { w: number; h: number }; cuts: LogoGlyphCut[] } | null> {
  const words = (l.text ?? '').trim();
  const key = l.font ?? 'cardo';
  const face = await loadFace(logoFontOutlineUrl(key, l.italic === true));
  pinLogoFaceWeight(face, key);
  const S = 200;
  const bb = outlineWords(face, words, 0, 0, S, l.spacing ?? 0).getBoundingBox();
  if (!(bb.x2 > bb.x1) || !(bb.y2 > bb.y1)) return null;
  const cuts: LogoGlyphCut[] = [];
  for (const g of letterRun(face, words, 0, 0, S, l.spacing ?? 0)) {
    const b = g.path.getBoundingBox();
    if (!g.ch.trim() || !(b.x2 > b.x1) || !(b.y2 > b.y1)) continue;
    const own = await textShapes(g.ch, key, l.italic === true);
    if (!own) continue;
    cuts.push({ ch: g.ch, ...own, cx: (b.x1 + b.x2) / 2 - bb.x1, cy: (b.y1 + b.y2) / 2 - bb.y1 });
  }
  return { word: { w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 }, cuts };
}

/* ── the opening, as layers ─────────────────────────────────────────────── */

function openingLayers(o: MakerLogoOpening): LogoLayer[] {
  if (o.source === 'layers') return layersFromSaved(o.layers, o.svg);
  if ((o.source === 'mark' || o.source === 'upload') && o.svg) {
    const b = svgAsLayerBody(o.svg);
    if (b) {
      return [
        {
          // A FIXED id: this runs on the server render and again in the browser,
          // and a random one would differ between them.
          id: 'yourlogo',
          kind: 'image',
          name: o.source === 'mark' ? 'Your logo' : 'Your uploaded logo',
          x: LOGO_FRAME / 2,
          y: LOGO_FRAME / 2,
          scale: 1,
          color: null,
          motion: defaultMotion(0),
          autoDelay: true,
          ...b,
        },
      ];
    }
  }
  // Nothing yet: the couple's own initials, set once the face has loaded.
  return [
    {
      id: 'initials',
      kind: 'text',
      name: 'Initials',
      x: LOGO_FRAME / 2,
      y: LOGO_FRAME / 2,
      scale: 0.7,
      color: LOGO_DEFAULT_INK,
      motion: defaultMotion(0),
      autoDelay: true,
      text: o.names,
      // The logo's first face, as it has always been: Cardo Italic.
      font: 'cardo',
      italic: true,
      body: '',
      w: 1,
      h: 1,
    },
  ];
}

/** The layer the editor opens on: the TOP of the stack (the last drawn), or none when there are none. */
function openingPick(layers: readonly LogoLayer[]): string | null {
  return layers[layers.length - 1]?.id ?? null;
}

/** The tool a layer opens on: its words for a text layer (Character), its look for every other (Style). */
function toolFor(layer: Pick<LogoLayer, 'kind'> | null | undefined): LogoTool {
  return layer?.kind === 'text' ? 'character' : 'style';
}

/** ⓘ One plain card per tool (the prototype's words). */
const TOOL_HELP: Record<LogoTool, string> = {
  character: 'Words, font, size and spacing of this text. Split it to animate each letter on its own.',
  style: 'How the layer looks and where it sits. Hide keeps it in the list but off the logo; Lock stops accidental moves.',
  animate: 'Build in = how it arrives · Action = what it does while shown · Build out = how it leaves. ▶ plays the picked layer.',
};

export function MakerLogoDoor({
  eventId,
  opening,
  motionMark,
  mainColours = null,
}: {
  eventId: string;
  opening: MakerLogoOpening;
  /** The paid mark on Motion (plays for guests with the Animated Monogram), or null. */
  motionMark: PaidMarkState | null;
  /** 🎨 The five main colours (Dominant … Accent 2) — Colour offers them in the new Maker. */
  mainColours?: readonly string[] | null;
}) {
  const router = useRouter();
  const { hubDraftAction } = useLogoActions();
  /* 🧭 THE NEW MAKER'S ADDITIONS (owner 2026-10-06, DECISION_LOG "THE LOGO MAKER IS THE SHIPPED LAYERED EDITOR"):
     Colour offers the five main colours · Rotate (slider and twist) · Build out. With the new Maker off, the shipped
     editor's set. */
  const studioAdds = useMaker()?.stagesStudio === true ? { five: mainColours ?? [] } : null;
  const [layers, setLayers] = useState<LogoLayer[]>(() => openingLayers(opening));
  /* ✏ DIRECT EDIT (owner 2026-10-08, LOGO_MAKER_REPLOT L1): the editor opens with the TOP layer
     already picked — never "Pick a layer", never a disabled Edit. */
  const [selectedId, setSelectedId] = useState<string | null>(() => openingPick(layers));
  /* 🧰 UNFOLDED (L1): the panel is this page's own, under the carousel — never a Maker tool (`useMakerTool`) and
     never tiles in the lower third's navigator (`ltNav`), which folds away whenever a tool is open: that fold was the
     one-layer trap. It shows the picked layer's tools, or the Add list (L2). */
  const [sheet, setSheet] = useState<'tools' | 'add'>('tools');
  const [tool, setTool] = useState<LogoTool>(() => toolFor(layers[layers.length - 1]));
  const [phase, setPhase] = useState<LogoPhase>('in');
  const [playKey, setPlayKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  /* 🧾 The layer the card's ⋯ asked to delete — asked once in the centred box. */
  const [askDelete, setAskDelete] = useState<string | null>(null);
  /* ✍ The layer being traced, and the stroke so far (frame units). */
  const [writing, setWriting] = useState<string | null>(null);
  const [stroke, setStroke] = useState<Array<{ x: number; y: number }>>([]);
  /* The stroke as the pointer left it — read on release, because the render
     closure can be a few moves behind (the stroke's tail — a closing curl). */
  const strokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const composed = useMemo(() => composeLogoSvg(layers.filter((l) => l.body)), [layers]);
  /* ▶ THE PICKED LAYER PLAYS (the prototype's `play()`): its Build in (after its own Starts after) → Action → Build out,
     every other layer held still where it is. */
  const playSvg = useMemo(
    () =>
      playing
        ? composeLogoSvg(layers.filter((l) => l.body).map((l) => (l.id === selectedId ? l : { ...l, motion: { in: 'none', during: 'still', delay: 0 } })))
        : null,
    [playing, layers, selectedId],
  );
  /* Text layers wait for their face; until every layer has its shapes the logo
     is not "as it stands", so no touch can take a baseline from it. */
  const ready = layers.every((l) => Boolean(l.body));

  /* ── the save gate (#6023) ── */
  const gate = useRef(createLogoSaveGate());
  const composedRef = useRef(composed);
  composedRef.current = composed;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const hostRef = useRef<HTMLElement>(null);
  /* ✋ A finger (or the mouse) is down on the logo — a drag, a pinch, a twist. Nothing is sent until it lifts. */
  const holding = useRef(false);

  const flush = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const svg = composedRef.current;
      if (!svg || !readyRef.current) return;
      if (!gate.current.shouldSave(svg) || inFlight.current) return;
      inFlight.current = true;
      setSave({ kind: 'saving' });
      announceMakerSave({ state: 'saving' });
      try {
        const fd = new FormData();
        for (const [k, v] of Object.entries(logoDraftFields({ svg, layers: layersRef.current.map(metaOf), anim: opening.anim }))) fd.set(k, v);
        /* One refresh after the last save in flight (`lib/maker-refresh.ts`) —
           the toolbar's count reads the draft. The action used to re-render the
           whole Maker in its own response on EVERY autosave (`revalidatePath`),
           whether `refresh` was asked for or not; this is that render, once. */
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (r.ok) {
          gate.current.saved(svg);
          setSave({ kind: 'saved' });
          announceMakerSave({ state: 'saved' });
        } else {
          /* A host never reads database words: the page says one plain sentence of its own (`plainRefusal`). */
          const text = plainRefusal(r.error, LOGO_NOT_SAVED);
          setSave({ kind: 'error', text });
          announceMakerSave({ state: 'error', text });
        }
      } catch {
        const text = LOGO_NOT_SAVED;
        setSave({ kind: 'error', text });
        announceMakerSave({ state: 'error', text });
      } finally {
        inFlight.current = false;
      }
    },
    [eventId, opening.anim, router, hubDraftAction],
  );

  /* The couple reaching for the page — their own pointer, key or typing, caught
     BEFORE the edit lands — records the logo as it stood (`isTrusted`: a
     script-made event is not the couple). */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onReach = (e: Event) => {
      if (!e.isTrusted || !readyRef.current) return;
      gate.current.touch(composedRef.current);
    };
    const REACH = ['pointerdown', 'keydown', 'beforeinput'] as const;
    for (const t of REACH) host.addEventListener(t, onReach, true);
    return () => {
      for (const t of REACH) host.removeEventListener(t, onReach, true);
    };
  }, []);

  /* A real change saves after a short pause — never while a finger is still on the logo. */
  const later = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const tick = () => {
      // A finger went down on the logo since: wait for it to lift — the gesture is sent whole.
      if (holding.current) timer.current = window.setTimeout(tick, PAUSE_MS);
      else void flush();
    };
    timer.current = window.setTimeout(tick, PAUSE_MS);
  }, [flush]);
  useEffect(() => {
    if (holding.current) return;
    if (!composed || !ready || !gate.current.shouldSave(composed)) return;
    later();
  }, [composed, ready, later]);

  /* Leaving — the tab hidden, the page closed, another bar item picked —
     saves first. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onLeave = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      void flush({ refresh: true });
    };
  }, [flush]);

  /* ── text layers: shapes from their words + face (+ spacing) ── */
  const textKey = layers
    .filter((l) => l.kind === 'text')
    .map((l) => `${l.id}:${l.font}:${l.italic ? 'i' : ''}:${l.spacing ?? 0}:${l.text}`)
    .join('|');
  useEffect(() => {
    let alive = true;
    for (const l of layersRef.current) {
      if (l.kind !== 'text') continue;
      const want = `${l.font}:${l.italic ? 'i' : ''}:${l.spacing ?? 0}:${l.text}`;
      void textShapes(l.text ?? '', l.font ?? 'cardo', l.italic === true, l.spacing ?? 0)
        .then((shape) => {
          if (!alive) return;
          setLayers((cur) =>
            cur.map((c) =>
              c.id === l.id && `${c.font}:${c.italic ? 'i' : ''}:${c.spacing ?? 0}:${c.text}` === want
                ? shape
                  ? { ...c, ...shape }
                  : { ...c, body: '<path d=""/>', w: 1, h: 1 }
                : c,
            ),
          );
        })
        .catch(() => {
          if (alive) setProblem('That typeface could not be loaded just now — please try again.');
        });
    }
    return () => {
      alive = false;
    };
  }, [textKey]);

  /* ── edits ── */
  const update = (id: string, patch: Partial<LogoLayer>) =>
    setLayers((cur) =>
      cur.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        // RAILS: a new size or place never leaves the frame.
        const p = clampToFrame(next, next.x, next.y);
        return { ...next, ...p };
      }),
    );

  /** Pick a layer: its tools open (Character only for a text layer — never a tool the layer does not have). */
  const pick = (id: string) => {
    setSelectedId(id);
    setSheet('tools');
    const l = layersRef.current.find((x) => x.id === id);
    if (tool === 'character' && l?.kind !== 'text') setTool('style');
  };

  const addLayer = (layer: LogoLayer) => {
    setLayers((cur) => (cur.length >= LOGO_MAX_LAYERS ? cur : retimeLayers([...cur, layer])));
    setSelectedId(layer.id);
    setSheet('tools');
    setTool(toolFor(layer));
  };

  const addText = () => {
    const i = layers.length;
    addLayer({
      id: newLayerId(),
      kind: 'text',
      name: 'Text',
      x: LOGO_FRAME / 2,
      y: LOGO_FRAME / 2,
      scale: 0.6,
      color: LOGO_DEFAULT_INK,
      motion: defaultMotion(i),
      autoDelay: true,
      text: opening.names,
      // The logo's first face, as it has always been: Cardo Italic.
      font: 'cardo',
      italic: true,
      body: '',
      w: 1,
      h: 1,
    });
  };

  const addFrame = () => {
    const i = layers.length;
    addLayer({
      id: newLayerId(),
      kind: 'frame',
      name: LOGO_FRAME_LABEL.ring,
      x: LOGO_FRAME / 2,
      y: LOGO_FRAME / 2,
      scale: 1,
      color: '#C5A059',
      motion: { ...defaultMotion(i), in: 'fade' },
      autoDelay: true,
      frame: 'ring',
      ...frameBody('ring'),
    });
  };

  /* ❦ L5 (owner 2026-10-08 "approve add ornament"): the prototype's new ornament — the flourish, in the frame's gold,
     small and above the centre, Drawing on after the layer below it. Its colour, size, place, turn and motion are any
     layer's; which ornament it is lives in its shapes (`ornamentOf`). */
  const addOrnament = () => {
    const i = layers.length;
    addLayer({
      id: newLayerId(),
      kind: 'ornament',
      name: LOGO_ORNAMENT_LABEL.flourish,
      x: LOGO_FRAME / 2,
      y: LOGO_FRAME * 0.2,
      scale: 0.4,
      color: '#C5A059',
      motion: defaultMotion(i),
      autoDelay: true,
      ...ornamentBody('flourish'),
    });
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setBusy('Reading your image…');
    const res = await fileToMarkSvg(file);
    setBusy(null);
    if (!res.ok) {
      setProblem(res.error);
      return;
    }
    const shape = svgAsLayerBody(res.svg);
    if (!shape) {
      setProblem('We couldn’t find a mark in that image — a dark mark on a light background works best.');
      return;
    }
    const i = layersRef.current.length;
    addLayer({
      id: newLayerId(),
      kind: 'image',
      name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'Image',
      x: LOGO_FRAME / 2,
      y: LOGO_FRAME / 2,
      scale: 1,
      color: null,
      motion: defaultMotion(i),
      autoDelay: true,
      ...shape,
    });
  };

  const onAdd = (kind: LogoAddKind) => {
    if (kind === 'text') addText();
    else if (kind === 'frame') addFrame();
    else if (kind === 'ornament') addOrnament();
    else fileRef.current?.click();
  };

  const remove = (id: string) => {
    const rest = layers.filter((l) => l.id !== id);
    setLayers((cur) => retimeLayers(cur.filter((l) => l.id !== id)));
    // The next layer down is picked — a page with layers always has one picked.
    setSelectedId(openingPick(rest));
    if (rest.length === 0) setSheet('add');
    else if (tool === 'character' && rest[rest.length - 1]?.kind !== 'text') setTool('style');
  };

  /** 🙈 🔒 ⧉ — the picked layer's own actions (the card's ⋯ and Style's row are the same four). */
  const act = (id: string, action: LayerCardAction) => {
    const l = layersRef.current.find((x) => x.id === id);
    if (!l) return;
    if (action === 'hide') update(id, { hidden: l.hidden ? undefined : true });
    else if (action === 'lock') update(id, { locked: l.locked ? undefined : true });
    else if (action === 'delete') setAskDelete(id);
    else {
      const copyId = newLayerId();
      const next = duplicateLayer(layersRef.current, id, copyId);
      if (next === layersRef.current) return;
      setLayers(retimeLayers(next));
      setSelectedId(copyId);
    }
  };

  /** ✂ Split into letters (L4) — the word's face cuts it; each letter lands where it stood. */
  const split = async (id: string) => {
    const l = layersRef.current.find((x) => x.id === id);
    if (!l || l.kind !== 'text') return;
    const count = Array.from((l.text ?? '').trim()).filter((c) => c.trim()).length;
    if (count < 2) return;
    if (layersRef.current.length - 1 + count > LOGO_MAX_LAYERS) {
      setProblem(`A logo holds ${LOGO_MAX_LAYERS} layers — splitting these words would make ${layersRef.current.length - 1 + count}.`);
      return;
    }
    setProblem(null);
    setBusy('Splitting into letters…');
    try {
      const cut = await letterCuts(l);
      const now = layersRef.current;
      const at = now.findIndex((x) => x.id === id);
      const next = cut ? splitIntoLetters(now, id, cut.word, cut.cuts, () => newLayerId()) : now;
      if (next === now || at < 0) {
        setProblem('Those words could not be split just now — please try again.');
        return;
      }
      setLayers(next);
      setSelectedId(next[at]?.id ?? openingPick(next));
    } catch {
      setProblem('That typeface could not be loaded just now — please try again.');
    } finally {
      setBusy(null);
    }
  };

  /* ── on the logo: one finger moves the picked layer, two pinch and twist it (rails + snapping) ── */
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ id: string; d0: number; a0: number; s0: number; r0: number } | null>(null);
  const toFrame = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const span = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? { d: Math.hypot(b.x - a.x, b.y - a.y), a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI } : null;
  };
  const letGo = () => {
    if (!holding.current) return;
    holding.current = false;
    // The gesture is over: it is one change, sent once after the pause.
    if (composedRef.current && readyRef.current && gate.current.shouldSave(composedRef.current)) later();
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (writing) {
      const p = toFrame(e);
      if (!p) return;
      strokeRef.current = [p];
      setStroke([p]);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    /* ✌ The second finger: pinch and twist the PICKED layer (wherever the fingers are) — unless it is locked. */
    if (fingers.current.size === 2) {
      const l = layersRef.current.find((x) => x.id === selectedId);
      const s = span();
      drag.current = null;
      if (l && !l.locked && s && s.d > 0) {
        pinch.current = { id: l.id, d0: s.d, a0: s.a, s0: l.scale, r0: l.rotate ?? 0 };
        holding.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    const hit = (e.target as Element).closest('[data-logo-edit-layer]');
    const id = hit?.getAttribute('data-logo-edit-layer') ?? null;
    // A tap on the empty frame keeps the pick (L1: a layer stays picked; nothing to re-find).
    if (!id) return;
    pick(id);
    const p = toFrame(e);
    const l = layers.find((x) => x.id === id);
    // 🔒 A locked layer is picked, never moved.
    if (!p || !l || l.locked) return;
    drag.current = { id, dx: l.x - p.x, dy: l.y - p.y };
    holding.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (writing) {
      if (!e.buttons && e.pointerType === 'mouse') return;
      const p = toFrame(e);
      if (!p) return;
      const cur = strokeRef.current;
      const last = cur[cur.length - 1];
      // one point every few frame units — enough for a smooth path, never thousands
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 4) {
        strokeRef.current = [...cur, p];
        setStroke(strokeRef.current);
      }
      return;
    }
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = pinch.current;
    if (g) {
      const s = span();
      if (!s) return;
      const scale = Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, Number(((g.s0 * s.d) / g.d0).toFixed(3))));
      /* ↻ The twist — only where Rotate is offered (the new Maker); upright within a few degrees. */
      let turn = g.r0 + (s.a - g.a0);
      turn = ((((turn + 180) % 360) + 360) % 360) - 180;
      const rotate = Math.abs(turn) < TWIST_SNAP_DEG ? 0 : Math.round(turn);
      update(g.id, studioAdds ? { scale, rotate: rotate || undefined } : { scale });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = toFrame(e);
    if (!p) return;
    setLayers((cur) =>
      cur.map((l) => (l.id === d.id ? { ...l, ...snapInFrame(l, p.x + d.dx, p.y + d.dy) } : l)),
    );
  };
  const onUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) fingers.current.delete(e.pointerId);
    else fingers.current.clear();
    if (pinch.current && fingers.current.size < 2) {
      pinch.current = null;
      fingers.current.clear();
    }
    drag.current = null;
    if (fingers.current.size === 0) letGo();
    if (!writing) return;
    const l = layersRef.current.find((x) => x.id === writing);
    const traced = strokeRef.current;
    strokeRef.current = [];
    if (l && traced.length >= 2) {
      // Thinned evenly to what the file keeps — a long, slow trace keeps its END.
      const pts = evenlyThinned(traced, LOGO_WRITE_MAX_PTS).map((p) => frameToLayer(l, p.x, p.y));
      update(l.id, {
        write: { w: l.write?.w ?? defaultWriteWidth(l.w, l.h), pts },
        motion: { ...l.motion, in: 'draw' },
      });
    }
    setWriting(null);
    setStroke([]);
  };
  const startWriting = (id: string) => {
    setWriting(id);
    strokeRef.current = [];
    setStroke([]);
    setPlaying(false);
  };

  const play = () => {
    setPlaying(true);
    setPlayKey((k) => k + 1);
  };

  /* ── render ── */
  const sel = selected ? halfExtent(selected) : null;

  /* 🔢 THE PARTS AND THE PEN (owner 2026-09-28: *"the flow should have started
     on the top of the C. maybe highlight or identify each part to detect its
     start and end point of the trace?"*). While tracing, and while a traced
     layer is selected, each gap-separated part wears its own colour, and the
     trace shows where it STARTS, where it ENDS, and the order the parts draw
     in — the same parts and the same test the player uses
     (`lib/logo-parts-dom.ts`), so what is numbered here is what guests see. */
  const partsLayerId = playing ? null : (writing ?? (selected && selected.kind !== 'frame' && selected.write ? selected.id : null));
  const partsLayer = layers.find((l) => l.id === partsLayerId) ?? null;
  const [passages, setPassages] = useState<Array<{ order: number; x: number; y: number; tint: string }>>([]);
  useEffect(() => {
    setPassages([]);
    const g = partsLayerId ? svgRef.current?.querySelector<SVGGElement>(`[data-logo-edit-layer="${partsLayerId}"]`) : null;
    if (!g || !partsLayer) return;
    const parts = logoParts(g);
    if (!writing && partsLayer.write) {
      const covers = partCovers(g, parts, Math.max(partsLayer.w, partsLayer.h) * 0.02);
      const found = writePartPassages(partsLayer.write, parts.length, covers);
      setPassages(
        found.flatMap((p, k) =>
          p ? [{ order: p.order, ...layerToFrame(partsLayer, p.start.x, p.start.y), tint: LOGO_PART_TINTS[k % LOGO_PART_TINTS.length] as string }] : [],
        ),
      );
    }
  }, [partsLayerId, partsLayer, writing]);
  const writeEnds =
    partsLayer?.write && !writing
      ? {
          start: layerToFrame(partsLayer, partsLayer.write.pts[0]!.x, partsLayer.write.pts[0]!.y),
          end: layerToFrame(partsLayer, partsLayer.write.pts[partsLayer.write.pts.length - 1]!.x, partsLayer.write.pts[partsLayer.write.pts.length - 1]!.y),
        }
      : null;

  const isText = selected?.kind === 'text';
  const shownTool: LogoTool = tool === 'character' && !isText ? 'style' : tool;
  const askDeleteLayer = askDelete ? (layers.find((l) => l.id === askDelete) ?? null) : null;

  return (
    <section
      ref={hostRef}
      className="relative flex min-h-0 flex-1 flex-col bg-cream lg:flex-row"
      data-made-once="logo"
      data-maker-logo-page=""
      data-logo-save={save.kind}
    >
      {/* ══ THE LAYERS CAROUSEL — a phone's strip under the logo (where the event bar was), a desk's left column ══ */}
      <aside
        aria-label="Logo layers"
        data-logo-navigator=""
        data-logo-cards-strip=""
        className="mt-2 flex h-[74px] w-full shrink-0 flex-col max-lg:order-1 max-lg:group-data-[details-mode=guided]/ws:hidden lg:mt-0 lg:h-auto lg:w-64 lg:border-r lg:border-ink/10"
      >
        <SheetHead title="Layers" />
        <LogoLayerCards
          layers={layers}
          selectedId={selectedId}
          onPick={pick}
          onMoveTo={(id, to) => setLayers((c) => retimeLayers(moveLayerTo(c, id, to)))}
          onAction={act}
          onAdd={() => setSheet((s) => (s === 'add' && layers.length > 0 ? 'tools' : 'add'))}
          addOn={sheet === 'add'}
          addDisabled={layers.length >= LOGO_MAX_LAYERS}
        />
      </aside>

      {/* ══ THE WORKSPACE · THE LOGO'S FRAME ══ */}
      {/* 📱 On a phone the frame sits at the TOP, so the carousel and the tools
          under it never cover the logo being edited. */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-start p-3 max-lg:[container-type:size] lg:justify-center lg:p-6">
        {/* The frame is SQUARE: as wide as the space allows, never taller than
            the space left under the Maker bar. */}
        {/* 📱 In the guided flow the logo is the step's picture above its half sheet:
            the frame fits the half above it, so the whole logo is seen as it changes. */}
        <div
          className="relative aspect-square w-full max-w-[min(100%,calc(100dvh-13rem))] max-lg:max-w-[min(100%,calc(100cqh-1.5rem))] max-lg:group-data-[details-mode=guided]/ws:max-w-[min(100%,calc(55dvh-8rem))]"
          data-logo-frame=""
        >
          {playing ? (
            <div className="absolute inset-0 rounded-md bg-white shadow-sm" data-logo-playing="">
              {playSvg ? <LayeredLogoPlayer key={playKey} svg={playSvg} /> : null}
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${LOGO_FRAME} ${LOGO_FRAME}`}
              role="img"
              aria-label="Your logo — drag a layer to move it; pinch and twist the picked layer"
              data-logo-canvas=""
              /* `overflow-hidden`: nothing is drawn past the frame — the logo guests
                 get is cut at the same edge, so the studio never shows more. */
              className="absolute inset-0 h-full w-full touch-none select-none overflow-hidden rounded-md bg-white shadow-sm"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* The frame's guides: its centre lines, faint — an editing aid only:
                  guests never see them, so the guided flow's picture of the logo
                  does not draw them either (owner 2026-10-05). */}
              <path
                d={`M${LOGO_FRAME / 2} 0V${LOGO_FRAME}M0 ${LOGO_FRAME / 2}H${LOGO_FRAME}`}
                stroke="#00000010"
                strokeWidth={2}
                data-logo-guides=""
                className="group-data-[details-mode=guided]/ws:hidden"
              />
              {layers.map((l) =>
                l.body ? (
                  <g
                    key={l.id}
                    data-logo-edit-layer={l.id}
                    transform={layerTransform(l)}
                    className={writing || l.locked ? '' : 'cursor-grab'}
                    /* 🙈 A hidden layer stays pickable here, faint — guests never see it. */
                    opacity={writing && writing !== l.id ? 0.18 : l.hidden ? 0.18 : 1}
                    dangerouslySetInnerHTML={{ __html: l.id === partsLayerId ? tintParts(layerShapes(l)) : layerShapes(l) }}
                  />
                ) : null,
              )}
              {/* ✍ How the selected layer is written, faintly — and, while
                  tracing, the stroke so far. */}
              {selected?.write && !writing ? (
                <path
                  d={writePathD({ w: 0, pts: selected.write.pts.map((q) => layerToFrame(selected, q.x, q.y)) })}
                  fill="none"
                  stroke="#C5A059"
                  strokeOpacity={0.55}
                  strokeWidth={4}
                  strokeDasharray="2 10"
                  strokeLinecap="round"
                  pointerEvents="none"
                  data-logo-write-path=""
                />
              ) : null}
              {/* 🔢 Each part's number where the pen first reaches it, and the
                  trace's Start and End. */}
              {passages.map((p) => (
                <g key={p.order} pointerEvents="none" data-logo-part-order={p.order}>
                  <circle cx={p.x} cy={p.y} r={17} fill="#FFFFFF" stroke={p.tint} strokeWidth={4} />
                  <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill={p.tint}>
                    {p.order}
                  </text>
                </g>
              ))}
              {writeEnds ? (
                <g pointerEvents="none" data-logo-write-ends="">
                  <circle cx={writeEnds.end.x} cy={writeEnds.end.y} r={11} fill="#FFFFFF" stroke="#1E2229" strokeWidth={4} />
                  <text x={writeEnds.end.x} y={writeEnds.end.y - 20} textAnchor="middle" fontSize={22} fontWeight={700} fill="#1E2229">
                    End
                  </text>
                  <circle cx={writeEnds.start.x} cy={writeEnds.start.y} r={13} fill="#1E7A4C" stroke="#FFFFFF" strokeWidth={4} />
                  <text x={writeEnds.start.x} y={writeEnds.start.y - 22} textAnchor="middle" fontSize={22} fontWeight={700} fill="#1E7A4C">
                    Start
                  </text>
                </g>
              ) : null}
              {writing && stroke.length > 1 ? (
                <path
                  d={writePathD({ w: 0, pts: stroke })}
                  fill="none"
                  stroke="#C5A059"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : null}
              {/* The picked layer's dashed frame — and nothing else on it (owner 08 Oct: the chips are "not needed anymore"). */}
              {selected && sel && !writing ? (
                <rect
                  x={selected.x - sel.hx}
                  y={selected.y - sel.hy}
                  width={sel.hx * 2}
                  height={sel.hy * 2}
                  transform={selected.rotate ? `rotate(${selected.rotate} ${selected.x} ${selected.y})` : undefined}
                  fill="none"
                  stroke="#C5A059"
                  strokeWidth={3}
                  strokeDasharray="10 8"
                  pointerEvents="none"
                  data-logo-selection=""
                />
              ) : null}
            </svg>
          )}
          {writing ? (
            <p
              role="status"
              className="absolute inset-x-2 bottom-2 flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 text-center text-[13px] font-semibold text-ink shadow ring-1 ring-ink/10"
              data-logo-writing=""
            >
              Trace the letter the way it is written — one stroke, starting where the pen starts.
              <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setWriting(null)} />
            </p>
          ) : null}
        </div>
      </div>

      {/* ══ THE TOOLS — [Character | Style | Animate] · ▶ · ⓘ over the open tool (or the Add list) ══ */}
      <aside
        aria-label="Layer tools"
        data-logo-tools=""
        data-phone-chrome="panel"
        className={`flex sn-glass-bare flex-col ${LOGO_PANEL_PHONE} lg:static lg:z-auto lg:flex lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-ink/10`}
      >
        <SheetHead title={sheet === 'add' || !selected ? 'Add a layer' : cardName(selected)} />
        {sheet === 'tools' && selected ? (
          <div data-logo-tools-row="" className="flex h-[52px] shrink-0 items-center gap-1.5 px-3">
            <span className="min-w-0 flex-1">
              <PillSelector<LogoTool>
                label="Logo tools"
                data="logo-tools"
                value={shownTool}
                onPick={(k) => setTool(k)}
                options={[
                  ...(isText ? [{ key: 'character' as const, label: 'Character' }] : []),
                  { key: 'style' as const, label: 'Style' },
                  { key: 'animate' as const, label: 'Animate' },
                ]}
              />
            </span>
            <span className="shrink-0" data-logo-play="">
              <ActionButton
                tone="neutral"
                iconOnly
                icon={playing ? Square : Play}
                label={playing ? 'Stop' : 'Play'}
                onClick={() => (playing ? setPlaying(false) : play())}
              />
            </span>
            <Explain title={shownTool === 'character' ? 'Character' : shownTool === 'style' ? 'Style' : 'Animate'} data="logo-tool">
              {TOOL_HELP[shownTool]}
            </Explain>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 pb-6 pt-1">
          {sheet === 'add' || !selected ? (
            <LogoAddLayer disabled={layers.length >= LOGO_MAX_LAYERS || Boolean(busy)} onAdd={onAdd}>
              {busy ? <p className="px-2 text-[12px] text-ink/60">{busy}</p> : null}
              {problem ? (
                <p role="alert" className="px-2 text-[12px] font-semibold text-danger-700">
                  {problem}
                </p>
              ) : null}
            </LogoAddLayer>
          ) : (
            <>
              {busy ? <p className="text-[12px] text-ink/60">{busy}</p> : null}
              {problem ? (
                <p role="alert" className="text-[12px] font-semibold text-danger-700">
                  {problem}
                </p>
              ) : null}
              <LayerTools
                eventId={eventId}
                layer={selected}
                tool={shownTool}
                phase={phase}
                onPhase={setPhase}
                motionMark={motionMark}
                studio={studioAdds}
                onWrite={() => startWriting(selected.id)}
                onChange={(patch) => update(selected.id, patch)}
                onRemove={() => remove(selected.id)}
                onAct={(a) => act(selected.id, a)}
                onSplit={() => void split(selected.id)}
                splitting={Boolean(busy)}
              />
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
            className="sr-only"
            aria-label="Upload an image layer"
            onChange={(e) => {
              void addImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </aside>
      {askDeleteLayer ? (
        <RemoveLayerConfirm
          name={askDeleteLayer.name}
          onKeep={() => setAskDelete(null)}
          onRemove={() => {
            setAskDelete(null);
            remove(askDeleteLayer.id);
          }}
        />
      ) : null}
    </section>
  );
}

/* ── the tools for one layer ─────────────────────────────────────────────── */

/** The Stages panel's own neutrals, so the shipped Style cards (`StyleCards`) draw here as they do on a stage. */
const STAGE_VARS_STYLE = Object.fromEntries(
  STAGE_PANEL_VARS.split(';')
    .filter(Boolean)
    .map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]),
) as CSSProperties;

export function LayerTools({
  eventId,
  layer,
  tool,
  phase = 'in',
  onPhase = () => {},
  motionMark,
  studio = null,
  onWrite,
  onChange,
  onRemove,
  onAct = () => {},
  onSplit = () => {},
  splitting = false,
}: {
  eventId: string;
  layer: LogoLayer;
  /** The open tool. Character is a text layer's only. */
  tool: LogoTool;
  phase?: LogoPhase;
  onPhase?: (p: LogoPhase) => void;
  motionMark: PaidMarkState | null;
  /** 🧭 The new Maker: the five main colours, Rotate and Build out. Null = the shipped editor's set. */
  studio?: { five: readonly string[] } | null;
  onWrite: () => void;
  onChange: (patch: Partial<LogoLayer>) => void;
  onRemove: () => void;
  onAct?: (action: Exclude<LayerCardAction, 'delete'>) => void;
  onSplit?: () => void;
  splitting?: boolean;
}) {
  const [askRemove, setAskRemove] = useState(false);
  const colour = <LayerColour layer={layer} studio={studio} onChange={onChange} />;
  const size = <LogoSlider label="Size" min={LOGO_SCALE_MIN} max={LOGO_SCALE_MAX} step={0.01} value={layer.scale} onChange={(v) => onChange({ scale: v })} />;

  if (tool === 'character' && layer.kind === 'text') {
    const letters = Array.from((layer.text ?? '').trim()).filter((c) => c.trim()).length;
    return (
      <>
        {/* 🧩 The typed answers are Form rows (tap the pill, type, tap out or Enter keeps it; ✕ leaves it as it was). */}
        <FormRows data="logo-layer">
          <TypedRow
            key={`words:${layer.id}`}
            name="Words"
            value={layer.text ?? ''}
            empty="Add your text"
            placeholder="Add your text"
            maxLength={40}
            pillAttrs={{ 'data-logo-text-input': '' }}
            onKeep={(t) => {
              onChange({ text: t });
              return { ok: true };
            }}
          />
          {/* 🅻 EVERY STAGE FONT, IN THE STAGES' OWN DROPDOWN (owner 2026-09-28:
              "on the logo. we need to show all fonts as well like in stages").
              ONE dropdown — `FontPick`, what a part's Font row is (owner
              2026-09-29: "the font across all event hub editor. can be one
              style") — each name drawn in its own face; `lib/logo-fonts.ts`
              says where each face's outlines are. A pick sets the upright
              face. No lead option: a text layer always has a face. */}
          <FormRow name="Font">
            <FontPick
              eventId={eventId}
              label="Font"
              dataAttr="data-logo-font"
              value={layer.font ?? 'cardo'}
              onPick={(key) => key && onChange({ font: key, italic: false })}
              className={`${FORM_PICK_CLASS} w-[200px]`}
            />
          </FormRow>
        </FormRows>
        <Field label="Size and spacing">
          {size}
          <span data-logo-spacing="">
            <LogoSlider
              label={`Spacing ${layer.spacing ?? 0}`}
              min={LOGO_SPACING_MIN}
              max={LOGO_SPACING_MAX}
              step={1}
              value={layer.spacing ?? 0}
              onChange={(v) => onChange({ spacing: Math.round(v) || undefined })}
            />
          </span>
        </Field>
        {colour}
        {/* ✂ Each letter its own layer — and its own animation (owner 2026-09-27). */}
        <span className="self-start" data-logo-split="">
          <ActionButton
            tone="neutral"
            icon={Scissors}
            label="Split into letters — each letter gets its own animation"
            disabled={letters < 2 || splitting}
            onClick={onSplit}
          />
        </span>
      </>
    );
  }

  if (tool === 'animate') {
    const outs = studio !== null;
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <PillSelector<LogoPhase>
              label="Animate"
              data="logo-phase"
              value={phase === 'out' && !outs ? 'in' : phase}
              onPick={(k) => onPhase(k)}
              options={[
                { key: 'in', label: 'Build in' },
                { key: 'action', label: 'Action' },
                ...(outs ? [{ key: 'out' as const, label: 'Build out' }] : []),
              ]}
            />
          </span>
          {motionMark ? <PaidMark state={motionMark} label={paidMarkLabel(motionMark, 'the Animated Monogram')} size="xs" /> : null}
        </div>
        {/* ▾ How · Does are dropdowns, never chip rows (owner 2026-10-07 final fixes; "any set of choices is a
            dropdown"). Same saves as Motion's In · During · Out had. */}
        {phase === 'action' ? (
          <FormRows data="logo-motion">
            <ChosenRow
              name="Does"
              value={layer.motion.during}
              options={LOGO_DURING.map((k): PickOption => ({ key: k, label: LOGO_DURING_LABEL[k] }))}
              onPick={(k) => onChange({ motion: { ...layer.motion, during: k as (typeof LOGO_DURING)[number] } })}
              attrs={{ 'data-logo-motion': 'during' }}
            />
          </FormRows>
        ) : phase === 'out' && outs ? (
          <FormRows data="logo-motion">
            <ChosenRow
              name="How"
              value={layer.motion.out ?? 'none'}
              options={LOGO_OUT.map((k): PickOption => ({ key: k, label: LOGO_OUT_LABEL[k] }))}
              onPick={(k) => {
                const { out: _was, ...rest } = layer.motion;
                onChange({ motion: k === 'none' ? rest : { ...rest, out: k as Exclude<(typeof LOGO_OUT)[number], 'none'> } });
              }}
              attrs={{ 'data-logo-motion': 'out', 'data-logo-out': '' }}
            />
          </FormRows>
        ) : (
          <>
            <FormRows data="logo-motion">
              <ChosenRow
                name="How"
                value={effectiveIn(layer)}
                options={LOGO_IN.map((k): PickOption => ({ key: k, label: LOGO_IN_LABEL[k] }))}
                onPick={(k) => onChange({ motion: { ...layer.motion, in: k as (typeof LOGO_IN)[number] } })}
                attrs={{ 'data-logo-motion': 'in' }}
              />
            </FormRows>
            {layer.kind !== 'frame' ? (
              <Field label="How it's written" explain={layer.write ? 'Each part has its own colour. The numbers show the order they draw in, from Start to End.' : null}>
                <span className="self-start" data-logo-write="">
                  <ActionButton tone="neutral" icon={PenLine} label={layer.write ? 'Trace it again' : "Show how it's written"} onClick={onWrite} />
                </span>
                {/* No Brush slider: the reveal follows the nearest pen position
                    (`writeRevealCells`), so there is no brush width to tune. Clear
                    it and Draw on traces the letter's outline instead. */}
                {layer.write ? (
                  <div className="flex flex-wrap gap-1.5">
                    {/* A trace drawn from the wrong end flips round — no need to trace again. */}
                    <span data-logo-write-reverse="">
                      <ActionButton tone="neutral" icon={RotateCcw} label="Reverse it" onClick={() => onChange({ write: reversedWrite(layer.write!) })} />
                    </span>
                    <ActionButton tone="neutral" icon={X} label="Clear it" onClick={() => onChange({ write: undefined })} />
                  </div>
                ) : null}
              </Field>
            ) : null}
            <LogoSlider
              label={`Starts after ${layer.motion.delay.toFixed(1)}s`}
              min={0}
              max={LOGO_DELAY_MAX}
              step={LOGO_DELAY_STEP}
              value={layer.motion.delay}
              onChange={(v) => onChange({ motion: { ...layer.motion, delay: Number(v.toFixed(1)) }, autoDelay: false })}
            />
            {layer.motion.in !== 'none' ? (
              <LogoSlider
                label={`Takes ${logoInSeconds(layer.motion).toFixed(1)}s`}
                min={LOGO_DUR_MIN}
                max={LOGO_DUR_MAX}
                step={LOGO_DUR_STEP}
                value={logoInSeconds(layer.motion)}
                onChange={(v) => onChange({ motion: { ...layer.motion, dur: Number(v.toFixed(1)) } })}
              />
            ) : null}
          </>
        )}
      </>
    );
  }

  /* STYLE — any layer. */
  const look: LogoLook = layer.kind === 'text' ? (layer.look ?? 'solid') : 'solid';
  return (
    <>
      {layer.kind === 'text' ? (
        /* 🎠 Looks as picture cards — the Stages' own Style cards, each the layer drawn in that look. */
        <div data-logo-looks="" className="flex h-[132px] shrink-0 flex-col [--sp-rg:4px]" style={STAGE_VARS_STYLE}>
          <StyleCards
            label="Look"
            data="logo-look"
            options={LOGO_LOOKS.map((k) => ({ id: k, name: LOGO_LOOK_LABEL[k] }))}
            value={look}
            onPick={(id) => onChange({ look: id === 'solid' ? undefined : (id as Exclude<LogoLook, 'solid'>) })}
            pending={false}
            canvasKey={null}
            sceneType="logo"
            picture={(id) =>
              layer.body ? (
                <svg
                  viewBox={`0 0 ${Math.max(1, layer.w)} ${Math.max(1, layer.h)}`}
                  className="absolute inset-0 h-full w-full overflow-visible p-2"
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: layerShapes({ ...layer, look: id === 'solid' ? undefined : (id as Exclude<LogoLook, 'solid'>) }) }}
                />
              ) : null
            }
          />
        </div>
      ) : null}
      {/* The kind's own control first, as the prototype's Style opens (Frame ▾ · White). */}
      {layer.kind !== 'text' ? (
        <FormRows data="logo-kind">
        {layer.kind === 'image' ? (
          <SwitchRow
            name="Remove white background"
            on={!layer.keepWhite}
            onChange={() => onChange({ keepWhite: !layer.keepWhite ? true : undefined })}
            attrs={{ 'data-logo-knockout': '' }}
          />
        ) : null}
        {layer.kind === 'frame' ? (
          <ChosenRow
            name="Frame"
            value={layer.frame ?? null}
            options={LOGO_FRAME_KINDS.map((k) => ({ key: k, label: LOGO_FRAME_LABEL[k] }))}
            onPick={(k) => onChange({ frame: k as LogoFrameKind, name: LOGO_FRAME_LABEL[k as LogoFrameKind], ...frameBody(k as LogoFrameKind) })}
            dataAttr="data-logo-frame-pick"
          />
        ) : null}
        {layer.kind === 'ornament' ? (
          <ChosenRow
            name="Ornament"
            value={ornamentOf(layer.body)}
            options={LOGO_ORNAMENT_KINDS.map((k) => ({ key: k, label: LOGO_ORNAMENT_LABEL[k] }))}
            onPick={(k) => onChange(swapOrnament(layer, k as LogoOrnamentKind))}
            dataAttr="data-logo-ornament-pick"
          />
        ) : null}
        </FormRows>
      ) : null}

      {colour}

      <Field label="Size and place">
        {size}
        <LogoSlider label="Across" min={0} max={LOGO_FRAME} step={1} value={layer.x} snapCentre onChange={(v) => onChange({ x: v })} />
        <LogoSlider label="Up and down" min={0} max={LOGO_FRAME} step={1} value={layer.y} snapCentre onChange={(v) => onChange({ y: v })} />
        {studio ? (
          <LogoSlider
            label={`Rotate ${layer.rotate ?? 0}°`}
            min={-LOGO_ROTATE_MAX}
            max={LOGO_ROTATE_MAX}
            step={1}
            value={layer.rotate ?? 0}
            snapCentre
            onChange={(v) => onChange({ rotate: Math.round(v) || undefined })}
          />
        ) : null}
        <span className="self-start">
          <ActionButton tone="neutral" icon={Crosshair} label="Centre it" onClick={() => onChange({ x: LOGO_FRAME / 2, y: LOGO_FRAME / 2 })} />
        </span>
      </Field>

      {/* ✎ A layer's own name (owner 2026-09-28: *"we should be able to rename
          these layers so we can identify them easier"* — two uploads arrived as
          "monogram.005" and "monogram.006"). The carousel's card shows it.
          🧩 On the templates (2026-10-09): the typed answer is a Form row, kept ONCE. */}
      <FormRows data="logo-layer">
        <TypedRow
          key={`name:${layer.id}`}
          name="Name"
          value={layer.name}
          maxLength={40}
          placeholder={LOGO_LAYER_KIND_LABEL[layer.kind]}
          clean={(t) => t.replace(/[<>"'`]/g, '')}
          pillAttrs={{ 'data-logo-layer-name': '' }}
          onKeep={(t) => {
            /* A name left empty goes back to the kind's own word, as it did when the box was left. */
            onChange({ name: t.trim() ? t : LOGO_LAYER_KIND_LABEL[layer.kind] });
            return { ok: true };
          }}
        />
      </FormRows>

      {/* 🙈 🔒 ⧉ ✕ — the same four as the picked card's ⋯. Taking a layer off asks once (the centred confirm box). */}
      <div className="flex flex-wrap gap-1.5" data-logo-layer-acts="">
        <span data-logo-act="hide">
          <ActionButton tone="neutral" icon={layer.hidden ? Eye : EyeOff} label={layer.hidden ? 'Show' : 'Hide'} aria-pressed={layer.hidden === true} onClick={() => onAct('hide')} />
        </span>
        <span data-logo-act="lock">
          <ActionButton tone="neutral" icon={layer.locked ? Lock : LockOpen} label={layer.locked ? 'Locked' : 'Lock'} aria-pressed={layer.locked === true} onClick={() => onAct('lock')} />
        </span>
        <span data-logo-act="duplicate">
          <ActionButton tone="neutral" icon={Copy} label="Duplicate" onClick={() => onAct('duplicate')} />
        </span>
        <span data-logo-remove="">
          <ActionButton tone="danger" icon={Trash2} label="Delete" onClick={() => setAskRemove(true)} />
        </span>
      </div>
      {askRemove ? <RemoveLayerConfirm name={layer.name} onKeep={() => setAskRemove(false)} onRemove={() => { setAskRemove(false); onRemove(); }} /> : null}
    </>
  );
}

/** 🎨 A layer's colour — in the new Maker the Mood Board's ONE colour sheet, else the shipped inks. */
function LayerColour({ layer, studio, onChange }: { layer: LogoLayer; studio: { five: readonly string[] } | null; onChange: (patch: Partial<LogoLayer>) => void }) {
  return (
    <Field label="Colour">
      {studio ? (
        /* 🎨 The new Maker: the Mood Board's ONE colour sheet (owner 2026-10-08) — the five first,
           then what goes with them, the photos, the swatches, Custom. "Its own" stays for a picture. */
        <div className="flex flex-col" data-logo-colour="studio">
          <StudioColourField
            data="logo"
            name="Colour"
            job={layer.kind === 'image' && layer.color === null ? 'Its own colours' : 'This part of your logo'}
            value={layer.color ?? LOGO_DEFAULT_INK}
            palette={studio.five}
            slots
            onPick={(c) => onChange({ color: c })}
            reset={layer.kind === 'image' && layer.color !== null ? { label: 'Its own colours', onReset: () => onChange({ color: null }) } : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {layer.kind === 'image' ? (
            <ActionButton tone="neutral" icon={Palette} label="Its own" aria-pressed={layer.color === null} onClick={() => onChange({ color: null })} />
          ) : null}
          {/* The shipped editor (no Studio): the logo inks, as before — colour circles (kind 21), the couple's own colours. */}
          {logoColourChoices(null, layer.color).map((c) => {
            const on = layer.color?.toUpperCase() === c.toUpperCase();
            return (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={on}
                data-logo-ink={c}
                onClick={() => onChange({ color: c })}
                className={`h-9 max-h-9 min-h-9 w-9 min-w-9 max-w-9 shrink-0 rounded-full border border-ink/20 ${on ? 'ring-2 ring-sn-accent ring-offset-2 ring-offset-cream' : ''}`}
                style={{ background: c }}
              />
            );
          })}
        </div>
      )}
    </Field>
  );
}

/* ── small parts ─────────────────────────────────────────────────────────── */

/** A column's title — the desktop's; on a phone the carousel and the tools row say where you are. */
function SheetHead({ title }: { title: string }) {
  return (
    <div className="hidden items-center gap-2 px-4 pb-2 pt-3 lg:flex">
      <p className="min-w-0 flex-1 truncate font-serif text-lg text-ink">{title}</p>
    </div>
  );
}

function Field({ label, mark = null, explain = null, children }: { label: string; mark?: ReactNode; explain?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        {label}
        {mark}
        {explain ? (
          <Explain title={label} className="-my-3">
            {explain}
          </Explain>
        ) : null}
      </p>
      {children}
    </div>
  );
}

/** 🧾 Taking a layer off asks once — the approved centred confirm box; a tap on the dark is "keep", never the removal. */
function RemoveLayerConfirm({ name, onKeep, onRemove }: { name: string; onKeep: () => void; onRemove: () => void }) {
  const titleId = useId();
  return (
    <GuestPopup kind="confirm" onClose={onKeep} labelledById={titleId}>
      <div className="space-y-3" data-logo-remove-confirm="">
        <h2 id={titleId} className="font-display text-xl text-ink">
          Remove “{name}”?
        </h2>
        <p className="text-sm leading-relaxed text-ink/70">It comes off your logo. This can’t be undone.</p>
        <GuestConfirmActions
          keep={<ActionButton tone="neutral" icon={X} label="Keep" onClick={onKeep} />}
          go={
            <div data-logo-remove-go="">
              <ActionButton tone="danger" main icon={Trash2} label="Remove" onClick={onRemove} />
            </div>
          }
        />
      </div>
    </GuestPopup>
  );
}

/**
 * A labelled slider — the Counter & slider template's own range (`app/_components/slider.tsx`), with the Logo's one extra:
 * `snapCentre` (the Across / Up and down / Rotate sliders — owner 2026-09-28: *"allow snap to center here"*): a small tick marks the
 * middle of the track, and a DRAG that comes within `LOGO_SLIDER_SNAP` of it lands on the exact centre (`snapSliderToCentre`) with a
 * light tap of haptics where the phone has them. The arrow keys still step freely. A drag is told by the pointer going down on the
 * slider's own box, so the template needs no knob of its own for it.
 */
function LogoSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  snapCentre = false,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  snapCentre?: boolean;
}) {
  const dragging = useRef(false);
  const onCentre = useRef(false);
  const mid = (min + max) / 2;
  return (
    <div
      className="block"
      onPointerDownCapture={() => {
        dragging.current = true;
      }}
      onPointerUpCapture={() => {
        dragging.current = false;
      }}
      onPointerCancelCapture={() => {
        dragging.current = false;
      }}
      onKeyDownCapture={() => {
        dragging.current = false;
      }}
    >
      <span className="text-[12px] text-ink/70">{label}</span>
      <span className="relative block">
        {snapCentre ? (
          <span aria-hidden data-slider-centre="" className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/35" />
        ) : null}
        <TemplateSlider
          label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          data={snapCentre ? 'logo-snaps' : 'logo'}
          onChange={(raw) => {
            if (!snapCentre || !dragging.current) {
              onChange(raw);
              return;
            }
            const next = snapSliderToCentre(raw, min, max);
            const landed = next === mid;
            // One tap as it lands — not one per pixel while it sits there.
            if (landed && !onCentre.current && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            onCentre.current = landed;
            onChange(next);
          }}
        />
      </span>
    </div>
  );
}
