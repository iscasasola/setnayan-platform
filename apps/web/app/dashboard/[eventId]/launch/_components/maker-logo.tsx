'use client';

import { StudioColourField } from './studio-colour-field';
import { useMaker } from './maker-context';
import { LOGO_PANEL_PHONE } from '@/lib/logo-maker-layout';
import { makerSave } from '@/lib/maker-refresh';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ImagePlus,
  Layers,
  PenLine,
  Play,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { createLogoSaveGate } from '@/lib/maker-logo-save-gate';
import { announceMakerSave } from '@/lib/maker-save-status';
import type { MakerLogoOpening } from '@/lib/maker-logo-opening';
import type { HubFontKey } from '@/lib/hub-fonts';
import { FontPick } from '../../website/editor/_components/font-pick';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { logoFontOutlineUrl, outlineWords, pinLogoFaceWeight, type OtFace } from '@/lib/logo-fonts';
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
  LOGO_DURING_LABEL,
  LOGO_FRAME,
  LOGO_FRAME_KINDS,
  LOGO_FRAME_LABEL,
  LOGO_IN,
  LOGO_IN_LABEL,
  LOGO_LAYER_KIND_LABEL,
  LOGO_MAX_LAYERS,
  LOGO_OUT,
  LOGO_OUT_LABEL,
  LOGO_ROTATE_MAX,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  LOGO_WRITE_MAX_PTS,
  clampToFrame,
  composeLogoSvg,
  defaultMotion,
  defaultWriteWidth,
  effectiveIn,
  evenlyThinned,
  frameBody,
  frameToLayer,
  halfExtent,
  layerShapes,
  layerTransform,
  logoColourChoices,
  layerToFrame,
  layersFromSaved,
  logoInSeconds,
  metaOf,
  moveLayer,
  newLayerId,
  retimeLayers,
  reversedWrite,
  snapInFrame,
  snapSliderToCentre,
  tintParts,
  LOGO_PART_TINTS,
  svgAsLayerBody,
  writePathD,
  writePartPassages,
  type LogoFrameKind,
  type LogoLayer,
} from '@/lib/logo-layers';
import { logoParts, partCovers } from '@/lib/logo-parts-dom';
import { PaidMark } from '@/app/_components/paid-mark';
import { LayeredLogoPlayer } from '@/app/_components/layered-logo-player';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * 🅻 THE LOGO PAGE — A FULL-SCREEN LAYERED EDITOR, LIKE THE MAKER ITSELF (owner
 * 2026-09-27, DECISION_LOG "THE LOGO MAKER IS A FULL-SCREEN LAYERED EDITOR").
 * Owner, verbatim: *"remove these maximize the whole screen make the toolbar run
 * like the editor toolbar. on the left navigator is where they can add a letter,
 * word, text or image"* · *"on left they can add a text or upload an image, or
 * frame"* · *"i want to be able to upload my 2 layer image so each letter gets
 * its own animation. to make our exact logo"*.
 *
 *   · NO HEADER — the page is the body under the Maker's own toolbar; the draft
 *     status ("Saving…", "Saved to your draft", or the error in words) is in the
 *     toolbar's Apply area (`lib/maker-save-status.ts`).
 *   · LEFT: the layers, top of the stack first, and "+ Add": Text · Image ·
 *     Frame. Select, move up/down (the stack IS the drawing order), remove.
 *   · CENTRE: the logo's square frame. Drag a layer to move it — RAILS ON: it
 *     stays inside the frame and snaps to the centre and the edges.
 *   · RIGHT: the selected layer's own tools — its words and face, its image
 *     options, its frame, its colour, size and place, and its motion.
 *   · PHONE: the layers and the tools are sheets from the bottom, like the Maker.
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
 * couple's first own touch and saves only a logo that differs from it.
 */
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; text: string };

const PAUSE_MS = 1500;

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
async function textShapes(text: string, key: HubFontKey, italic: boolean): Promise<{ body: string; w: number; h: number } | null> {
  const words = text.trim();
  if (!words) return null;
  const face = await loadFace(logoFontOutlineUrl(key, italic));
  pinLogoFaceWeight(face, key);
  const S = 200;
  const bb = outlineWords(face, words, 0, 0, S).getBoundingBox();
  if (!(bb.x2 > bb.x1) || !(bb.y2 > bb.y1)) return null;
  const d = outlineWords(face, words, -bb.x1, -bb.y1, S).toPathData(2);
  return { body: `<path d="${d}"/>`, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };
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
  /* 🧭 THE NEW MAKER'S THREE ADDITIONS ONLY (owner 2026-10-06, DECISION_LOG "THE LOGO MAKER IS THE
     SHIPPED LAYERED EDITOR"): Colour offers the five main colours · Rotate in Size and place · Out in
     Motion. Everything else is the shipped editor as it is — and with the new Maker off, all of it is. */
  const studioAdds = useMaker()?.stagesStudio === true ? { five: mainColours ?? [] } : null;
  const [layers, setLayers] = useState<LogoLayer[]>(() => openingLayers(opening));
  /* ✏ DIRECT EDIT (owner 2026-10-08, LOGO_MAKER_REPLOT L1): the editor opens with the TOP layer
     already picked — never "Pick a layer", never a disabled Edit. */
  const [selectedId, setSelectedId] = useState<string | null>(() => openingPick(layers));
  /* 🧰 UNFOLDED (L1): the two panels are this page's own, under the logo, ONE always open — they are
     never a Maker tool (`useMakerTool`) and never tiles in the lower third's navigator (`ltNav`),
     which folds away whenever a tool is open: that fold was the one-layer trap. */
  const [sheet, setSheet] = useState<'layers' | 'tools'>('tools');
  const [playKey, setPlayKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  /* ✍ The layer being traced, and the stroke so far (frame units). */
  const [writing, setWriting] = useState<string | null>(null);
  const [stroke, setStroke] = useState<Array<{ x: number; y: number }>>([]);
  /* The stroke as the pointer left it — read on release, because the render
     closure can be a few moves behind (the stroke's tail — a closing curl). */
  const strokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const composed = useMemo(() => composeLogoSvg(layers.filter((l) => l.body)), [layers]);
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
        fd.set('intent', 'save');
        fd.set(
          'patch',
          JSON.stringify({
            events: {
              monogram_custom_svg: svg,
              monogram_studio_config: {
                layers: layersRef.current.map(metaOf),
                ...(opening.anim ? { anim: opening.anim } : {}),
              },
            },
          }),
        );
        /* One refresh after the last save in flight (`lib/maker-refresh.ts`) —
           the toolbar's count reads the draft. The action used to re-render the
           whole Maker in its own response on EVERY autosave (`revalidatePath`),
           whether `refresh` was asked for or not; this is that render, once. */
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (r.ok) {
          gate.current.saved(svg);
          setSave({ kind: 'saved' });
          announceMakerSave({ state: 'saved' });
        } else {
          setSave({ kind: 'error', text: r.error });
          announceMakerSave({ state: 'error', text: r.error });
        }
      } catch {
        const text = 'Your logo could not be saved to your draft. Keep this open and try again.';
        setSave({ kind: 'error', text });
        announceMakerSave({ state: 'error', text });
      } finally {
        inFlight.current = false;
      }
    },
    [eventId, opening.anim, router],
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

  /* A real change saves after a short pause. */
  useEffect(() => {
    if (!composed || !ready || !gate.current.shouldSave(composed)) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), PAUSE_MS);
  }, [composed, ready, flush]);

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

  /* ── text layers: shapes from their words + face ── */
  const textKey = layers
    .filter((l) => l.kind === 'text')
    .map((l) => `${l.id}:${l.font}:${l.italic ? 'i' : ''}:${l.text}`)
    .join('|');
  useEffect(() => {
    let alive = true;
    for (const l of layersRef.current) {
      if (l.kind !== 'text') continue;
      const want = `${l.font}:${l.italic ? 'i' : ''}:${l.text}`;
      void textShapes(l.text ?? '', l.font ?? 'cardo', l.italic === true)
        .then((shape) => {
          if (!alive) return;
          setLayers((cur) =>
            cur.map((c) =>
              c.id === l.id && `${c.font}:${c.italic ? 'i' : ''}:${c.text}` === want
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

  const addLayer = (layer: LogoLayer) => {
    setLayers((cur) => (cur.length >= LOGO_MAX_LAYERS ? cur : retimeLayers([...cur, layer])));
    setSelectedId(layer.id);
    setSheet('tools');
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

  const remove = (id: string) => {
    const rest = layers.filter((l) => l.id !== id);
    setLayers((cur) => retimeLayers(cur.filter((l) => l.id !== id)));
    // The next layer down is picked — a page with layers always has one picked.
    setSelectedId(openingPick(rest));
    if (rest.length === 0) setSheet('layers');
  };

  /* ── dragging on the canvas (rails + snapping) ── */
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const toFrame = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
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
    const hit = (e.target as Element).closest('[data-logo-edit-layer]');
    const id = hit?.getAttribute('data-logo-edit-layer') ?? null;
    // A tap on the empty frame keeps the pick (L1: a layer stays picked; nothing to re-find).
    if (!id) return;
    setSelectedId(id);
    const p = toFrame(e);
    const l = layers.find((x) => x.id === id);
    if (!p || !l) return;
    drag.current = { id, dx: l.x - p.x, dy: l.y - p.y };
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
    const d = drag.current;
    if (!d) return;
    const p = toFrame(e);
    if (!p) return;
    setLayers((cur) =>
      cur.map((l) => (l.id === d.id ? { ...l, ...snapInFrame(l, p.x + d.dx, p.y + d.dy) } : l)),
    );
  };
  const onUp = () => {
    drag.current = null;
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
  const topFirst = layers.slice().reverse();
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

  return (
    <section
      ref={hostRef}
      className="relative flex min-h-0 flex-1 flex-col bg-cream lg:flex-row"
      data-made-once="logo"
      data-maker-logo-page=""
      data-logo-save={save.kind}
    >
      {/* ══ LEFT · THE LAYERS ══ */}
      <aside
        aria-label="Logo layers"
        data-logo-navigator=""
        data-phone-chrome="panel"
        className={`${sheet === 'layers' ? 'flex' : 'hidden'} sn-glass-bare flex-col ${LOGO_PANEL_PHONE} lg:static lg:z-auto lg:flex lg:max-h-none lg:w-64 lg:shrink-0 lg:rounded-none lg:border-r lg:border-ink/10`}
      >
        <SheetHead title="Layers" />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-3">
          {topFirst.length === 0 ? <p className="px-2 py-3 text-[13px] text-ink/60">Add text, an image or a frame.</p> : null}
          <ol className="flex flex-col gap-1" aria-label="Top of the stack first">
            {topFirst.map((l, idx) => {
              const on = l.id === selectedId;
              return (
                <li key={l.id} className={`flex items-center gap-1 rounded-md ${on ? 'bg-ink text-cream' : 'hover:bg-ink/5'}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    data-logo-layer-row={l.id}
                    onClick={() => {
                      setSelectedId(l.id);
                      setSheet('tools');
                    }}
                    className="sn-press flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left text-[13px] font-semibold"
                  >
                    <KindIcon kind={l.kind} />
                    <span className="min-w-0 truncate">{l.kind === 'text' && l.name === LOGO_LAYER_KIND_LABEL.text ? l.text || 'Text' : l.name}</span>
                  </button>
                  <IconBtn label={`Move ${l.name} up`} disabled={idx === 0} onClick={() => setLayers((c) => retimeLayers(moveLayer(c, l.id, 'up')))}>
                    <ChevronUp aria-hidden className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label={`Move ${l.name} down`}
                    disabled={idx === topFirst.length - 1}
                    onClick={() => setLayers((c) => retimeLayers(moveLayer(c, l.id, 'down')))}
                  >
                    <ChevronDown aria-hidden className="h-4 w-4" />
                  </IconBtn>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55">Add</p>
          <div className="grid grid-cols-3 gap-1 px-1" data-logo-add="">
            <AddBtn label="Text" onClick={addText} disabled={layers.length >= LOGO_MAX_LAYERS}>
              <Type aria-hidden className="h-4 w-4" />
            </AddBtn>
            <AddBtn label="Image" onClick={() => fileRef.current?.click()} disabled={layers.length >= LOGO_MAX_LAYERS || Boolean(busy)}>
              <ImagePlus aria-hidden className="h-4 w-4" />
            </AddBtn>
            <AddBtn label="Frame" onClick={addFrame} disabled={layers.length >= LOGO_MAX_LAYERS}>
              <CircleDashed aria-hidden className="h-4 w-4" />
            </AddBtn>
          </div>
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
          {busy ? <p className="px-2 text-[12px] text-ink/60">{busy}</p> : null}
          {problem ? (
            <p role="alert" className="px-2 text-[12px] text-terracotta-700">
              {problem}
            </p>
          ) : null}
        </div>
      </aside>

      {/* ══ CENTRE · THE LOGO'S FRAME ══ */}
      {/* 📱 On a phone the frame sits at the TOP, so the half-height sheets
          under it never cover the logo being edited. */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-start p-3 max-lg:[container-type:size] lg:justify-center lg:p-6">
        {/* The frame is SQUARE: as wide as the space allows, never taller than
            the space left under the Maker bar. */}
        {/* 📱 In the guided flow the logo is the step's picture above its half sheet:
            the frame fits the half above it, so the whole logo is seen as it changes. */}
        <div
          className="relative aspect-square w-full max-w-[min(100%,calc(100dvh-13rem))] max-lg:max-w-[min(100%,calc(100cqh-4.25rem))] max-lg:group-data-[details-mode=guided]/ws:max-w-[min(100%,calc(55dvh-8rem))]"
          data-logo-frame=""
        >
          {playing ? (
            <div className="absolute inset-0 rounded-md bg-white shadow-sm" data-logo-playing="">
              {composed ? <LayeredLogoPlayer key={playKey} svg={composed} /> : null}
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${LOGO_FRAME} ${LOGO_FRAME}`}
              role="img"
              aria-label="Your logo — drag a layer to move it"
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
                    className={writing ? '' : 'cursor-grab'}
                    opacity={writing && writing !== l.id ? 0.18 : 1}
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
              {selected && sel && !writing ? (
                <rect
                  x={selected.x - sel.hx}
                  y={selected.y - sel.hy}
                  width={sel.hx * 2}
                  height={sel.hy * 2}
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
              className="absolute inset-x-2 bottom-2 rounded-md bg-ink/85 px-3 py-2 text-center text-[13px] font-semibold text-cream"
              data-logo-writing=""
            >
              Trace the letter the way it is written — one stroke, starting where the pen starts.{' '}
              <button type="button" onClick={() => setWriting(null)} className="underline underline-offset-2">
                Cancel
              </button>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => (playing ? setPlaying(false) : play())}
            className="sn-press absolute right-2 top-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-cream shadow"
            data-logo-play=""
          >
            {playing ? <X aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
            {playing ? 'Edit' : 'Play'}
          </button>
        </div>
        {/* 📱 Phone: Layers | the picked layer — ONE row under the logo, both always reachable; the
            panel opens under it, in the page's flow (never fixed over the lower third, never folded). */}
        <div
          role="tablist"
          aria-label="Logo panels"
          data-logo-panels=""
          className="mt-2 flex w-full max-w-sm shrink-0 gap-1 rounded-full bg-ink/[0.05] p-1 ring-1 ring-ink/10 lg:hidden max-lg:group-data-[details-mode=guided]/ws:hidden"
        >
          {([
            { key: 'layers', label: 'Layers', icon: <Layers aria-hidden className="h-4 w-4" /> },
            {
              key: 'tools',
              label: selected ? (selected.kind === 'text' ? selected.text?.trim() || 'Text' : selected.name) : 'Layer',
              icon: <SlidersHorizontal aria-hidden className="h-4 w-4" />,
            },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              data-logo-panel-tab={t.key}
              aria-selected={sheet === t.key}
              disabled={t.key === 'tools' && !selected}
              onClick={() => setSheet(t.key)}
              className={`sn-press inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition-colors duration-sn-control ease-sn disabled:opacity-50 ${
                sheet === t.key ? 'bg-ink text-cream' : 'text-ink'
              }`}
            >
              {t.icon}
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ RIGHT · THE SELECTED LAYER'S TOOLS ══ */}
      <aside
        aria-label="Layer tools"
        data-logo-tools=""
        data-phone-chrome="panel"
        className={`${sheet === 'tools' ? 'flex' : 'hidden'} sn-glass-bare flex-col ${LOGO_PANEL_PHONE} lg:static lg:z-auto lg:flex lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-ink/10`}
      >
        <SheetHead title={selected ? (selected.kind === 'text' ? 'Text' : selected.name) : 'Layer'} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 pb-6 pt-1">
          {!selected ? (
            <p className="text-[13px] text-ink/60">Pick a layer on the left, or tap one on the logo.</p>
          ) : (
            <LayerTools
              eventId={eventId}
              layer={selected}
              motionMark={motionMark}
              studio={studioAdds}
              onWrite={() => startWriting(selected.id)}
              onChange={(patch) => update(selected.id, patch)}
              onRemove={() => remove(selected.id)}
            />
          )}
        </div>
      </aside>
    </section>
  );
}

/* ── the tools for one layer ─────────────────────────────────────────────── */

function LayerTools({
  eventId,
  layer,
  motionMark,
  studio = null,
  onWrite,
  onChange,
  onRemove,
}: {
  eventId: string;
  layer: LogoLayer;
  motionMark: PaidMarkState | null;
  /** 🧭 The new Maker: the five main colours, Rotate and Out. Null = the shipped editor, exactly. */
  studio?: { five: readonly string[] } | null;
  onWrite: () => void;
  onChange: (patch: Partial<LogoLayer>) => void;
  onRemove: () => void;
}) {
  return (
    <>
      {/* ✎ A layer's own name (owner 2026-09-28: *"we should be able to rename
          these layers so we can identify them easier"* — two uploads arrived as
          "monogram.005" and "monogram.006"). The navigator shows it. */}
      <Field label="Name">
        <input
          type="text"
          value={layer.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value.replace(/[<>"'`]/g, '') })}
          onBlur={() => {
            if (!layer.name.trim()) onChange({ name: LOGO_LAYER_KIND_LABEL[layer.kind] });
          }}
          placeholder={LOGO_LAYER_KIND_LABEL[layer.kind]}
          aria-label="Layer name"
          className="min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-[15px] text-ink"
          data-logo-layer-name=""
        />
      </Field>

      {layer.kind === 'text' ? (
        <Field label="Words">
          <input
            type="text"
            value={layer.text ?? ''}
            maxLength={40}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Add your text"
            className="min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-[15px] text-ink"
            data-logo-text-input=""
          />
          {/* 🅻 EVERY STAGE FONT, IN THE STAGES' OWN DROPDOWN (owner 2026-09-28:
              "on the logo. we need to show all fonts as well like in stages").
              ONE dropdown — `FontPick`, what a part's Font row is (owner
              2026-09-29: "the font across all event hub editor. can be one
              style") — each name drawn in its own face; `lib/logo-fonts.ts`
              says where each face's outlines are. A pick sets the upright
              face. No lead option: a text layer always has a face. */}
          <FontPick
            eventId={eventId}
            label="Typeface"
            dataAttr="data-logo-font"
            value={layer.font ?? 'cardo'}
            onPick={(key) => key && onChange({ font: key, italic: false })}
            className="mt-2 min-h-11 w-full justify-between border border-ink/15"
          />
        </Field>
      ) : null}

      {layer.kind === 'image' ? (
        <Field label="Image">
          <SwitchRow
            on={!layer.keepWhite}
            label="Remove white background"
            onFlip={() => onChange({ keepWhite: !layer.keepWhite ? true : undefined })}
          />
        </Field>
      ) : null}

      {layer.kind === 'frame' ? (
        <Field label="Frame">
          <div className="flex flex-wrap gap-1.5">
            {LOGO_FRAME_KINDS.map((k) => (
              <Chip
                key={k}
                on={layer.frame === k}
                label={LOGO_FRAME_LABEL[k]}
                onClick={() => onChange({ frame: k as LogoFrameKind, name: LOGO_FRAME_LABEL[k], ...frameBody(k) })}
              />
            ))}
          </div>
        </Field>
      ) : null}

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
              onPick={(c) => onChange({ color: c })}
              reset={layer.kind === 'image' && layer.color !== null ? { label: 'Its own colours', onReset: () => onChange({ color: null }) } : undefined}
            />
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-2">
          {layer.kind === 'image' ? (
            <Chip on={layer.color === null} label="Its own" onClick={() => onChange({ color: null })} />
          ) : null}
          {/* The shipped editor (no Studio): the logo inks, as before. */}
          {logoColourChoices(null, layer.color).map((c) => {
            const on = layer.color?.toUpperCase() === c.toUpperCase();
            return (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={on}
              onClick={() => onChange({ color: c })}
              className={`h-9 max-h-9 min-h-9 w-9 min-w-9 max-w-9 shrink-0 rounded-full border border-ink/20 ${on ? 'ring-2 ring-ink ring-offset-2 ring-offset-cream' : ''}`}
              style={{ background: c }}
            />
            );
          })}
        </div>
        )}
      </Field>

      <Field label="Size and place">
        <Slider label="Size" min={LOGO_SCALE_MIN} max={LOGO_SCALE_MAX} step={0.01} value={layer.scale} onChange={(v) => onChange({ scale: v })} />
        <Slider label="Across" min={0} max={LOGO_FRAME} step={1} value={layer.x} snapCentre onChange={(v) => onChange({ x: v })} />
        <Slider label="Up and down" min={0} max={LOGO_FRAME} step={1} value={layer.y} snapCentre onChange={(v) => onChange({ y: v })} />
        {studio ? (
          <Slider
            label={`Rotate ${layer.rotate ?? 0}°`}
            min={-LOGO_ROTATE_MAX}
            max={LOGO_ROTATE_MAX}
            step={1}
            value={layer.rotate ?? 0}
            snapCentre
            onChange={(v) => onChange({ rotate: Math.round(v) || undefined })}
          />
        ) : null}
        <button
          type="button"
          onClick={() => onChange({ x: LOGO_FRAME / 2, y: LOGO_FRAME / 2 })}
          className="sn-press mt-1 inline-flex min-h-10 items-center self-start rounded-full bg-ink/5 px-3 text-[12.5px] font-semibold text-ink"
        >
          Centre it
        </button>
      </Field>

      {layer.kind !== 'frame' ? (
        <Field label="How it's written">
          <button
            type="button"
            onClick={onWrite}
            className="sn-press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-ink px-4 text-[13px] font-semibold text-cream"
            data-logo-write=""
          >
            <PenLine aria-hidden className="h-4 w-4" />
            {layer.write ? 'Trace it again' : "Show how it's written"}
          </button>
          {layer.write ? (
            <p className="text-[12px] text-ink/70" data-logo-write-help="">
              Each part has its own colour. The numbers show the order they draw in, from <b>Start</b> to <b>End</b>.
            </p>
          ) : null}
          {/* No Brush slider: the reveal follows the nearest pen position
              (`writeRevealCells`), so there is no brush width to tune. Clear
              it and Draw on traces the letter's outline instead. */}
          {layer.write ? (
            <div className="flex flex-wrap gap-1.5">
              {/* A trace drawn from the wrong end flips round — no need to trace again. */}
              <button
                type="button"
                onClick={() => onChange({ write: reversedWrite(layer.write!) })}
                className="sn-press inline-flex min-h-10 items-center self-start rounded-full bg-ink/5 px-3 text-[12.5px] font-semibold text-ink"
                data-logo-write-reverse=""
              >
                Reverse it
              </button>
              <button
                type="button"
                onClick={() => onChange({ write: undefined })}
                className="sn-press inline-flex min-h-10 items-center self-start rounded-full bg-ink/5 px-3 text-[12.5px] font-semibold text-ink"
              >
                Clear it
              </button>
            </div>
          ) : null}
        </Field>
      ) : null}

      <Field
        label="Motion"
        mark={motionMark ? <PaidMark state={motionMark} label={paidMarkLabel(motionMark, 'the Animated Monogram')} size="xs" /> : null}
      >
        {/* ▾ In · During · Out are dropdowns, never chip rows (owner 2026-10-07 final
            fixes; "any set of choices is a dropdown"). Same saves as the chips had. */}
        <div className="flex min-h-11 items-center justify-between gap-3" data-logo-motion="in">
          <span className="text-[13px] font-semibold text-ink">In</span>
          <PickMenu
            label="In"
            value={effectiveIn(layer)}
            options={LOGO_IN.map((k): PickOption => ({ key: k, label: LOGO_IN_LABEL[k] }))}
            onPick={(k) => onChange({ motion: { ...layer.motion, in: k as (typeof LOGO_IN)[number] } })}
          />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3" data-logo-motion="during">
          <span className="text-[13px] font-semibold text-ink">During</span>
          <PickMenu
            label="During"
            value={layer.motion.during}
            options={LOGO_DURING.map((k): PickOption => ({ key: k, label: LOGO_DURING_LABEL[k] }))}
            onPick={(k) => onChange({ motion: { ...layer.motion, during: k as (typeof LOGO_DURING)[number] } })}
          />
        </div>
        {studio ? (
          <div className="flex min-h-11 items-center justify-between gap-3" data-logo-motion="out" data-logo-out="">
            <span className="text-[13px] font-semibold text-ink">Out</span>
            <PickMenu
              label="Out"
              value={layer.motion.out ?? 'none'}
              options={LOGO_OUT.map((k): PickOption => ({ key: k, label: LOGO_OUT_LABEL[k] }))}
              onPick={(k) => {
                const { out: _was, ...rest } = layer.motion;
                onChange({ motion: k === 'none' ? rest : { ...rest, out: k as Exclude<(typeof LOGO_OUT)[number], 'none'> } });
              }}
            />
          </div>
        ) : null}
        {layer.motion.in !== 'none' ? (
          <Slider
            label={`Speed — takes ${logoInSeconds(layer.motion).toFixed(1)}s`}
            min={LOGO_DUR_MIN}
            max={LOGO_DUR_MAX}
            step={LOGO_DUR_STEP}
            value={logoInSeconds(layer.motion)}
            onChange={(v) => onChange({ motion: { ...layer.motion, dur: Number(v.toFixed(1)) } })}
          />
        ) : null}
        <Slider
          label={`Starts after ${layer.motion.delay.toFixed(1)}s`}
          min={0}
          max={LOGO_DELAY_MAX}
          step={LOGO_DELAY_STEP}
          value={layer.motion.delay}
          onChange={(v) => onChange({ motion: { ...layer.motion, delay: Number(v.toFixed(1)) }, autoDelay: false })}
        />
      </Field>

      <button
        type="button"
        onClick={onRemove}
        className="sn-press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-terracotta-700 hover:bg-ink/10"
        data-logo-remove=""
      >
        <Trash2 aria-hidden className="h-4 w-4" /> Remove this layer
      </button>
    </>
  );
}

/* ── small parts ─────────────────────────────────────────────────────────── */

/** A panel's title — the desktop's; on a phone the lower third's column names the panel and closes it. */
function SheetHead({ title }: { title: string }) {
  return (
    <div className="hidden items-center gap-2 px-4 pb-2 pt-3 lg:flex">
      <p className="min-w-0 flex-1 truncate font-serif text-lg text-ink">{title}</p>
    </div>
  );
}

function KindIcon({ kind }: { kind: LogoLayer['kind'] }) {
  const cls = 'h-4 w-4 shrink-0';
  if (kind === 'text') return <Type aria-label={LOGO_LAYER_KIND_LABEL.text} className={cls} />;
  if (kind === 'frame') return <CircleDashed aria-label={LOGO_LAYER_KIND_LABEL.frame} className={cls} />;
  return <ImagePlus aria-label={LOGO_LAYER_KIND_LABEL.image} className={cls} />;
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="sn-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function AddBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-logo-add-kind={label.toLowerCase()}
      className="sn-press inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md bg-ink/5 text-[12px] font-semibold text-ink hover:bg-ink/10 disabled:opacity-40"
    >
      {children}
      {label}
    </button>
  );
}

function Field({ label, mark = null, children }: { label: string; mark?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        {label}
        {mark}
      </p>
      {children}
    </div>
  );
}

function Chip({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`sn-press inline-flex min-h-10 items-center rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-40 ${on ? 'bg-ink text-cream' : 'bg-ink/5 text-ink hover:bg-ink/10'}`}
    >
      {label}
    </button>
  );
}

function SwitchRow({ on, label, onFlip }: { on: boolean; label: string; onFlip: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onFlip}
      className="sn-press flex min-h-11 w-full items-center gap-3 rounded-md bg-white/70 px-3 text-left"
      data-logo-knockout=""
    >
      <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">{label}</span>
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full ${on ? 'bg-terracotta-700' : 'bg-ink/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

/**
 * A labelled range slider. `snapCentre` (the Across / Up and down sliders —
 * owner 2026-09-28: *"allow snap to center here"*): a small tick marks the
 * middle of the track, and a DRAG that comes within `LOGO_SLIDER_SNAP` of it
 * lands on the exact centre (`snapSliderToCentre`) with a light tap of haptics
 * where the phone has them. The arrow keys still step freely.
 */
function Slider({
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
  /* Only a pointer drag snaps; the keyboard's own step is left alone. */
  const dragging = useRef(false);
  const onCentre = useRef(false);
  const mid = (min + max) / 2;
  return (
    <label className="block">
      <span className="text-[12px] text-ink/70">{label}</span>
      <span className="relative block">
        {snapCentre ? (
          <span
            aria-hidden
            data-slider-centre=""
            className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/35"
          />
        ) : null}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onPointerDown={() => {
            dragging.current = true;
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onKeyDown={() => {
            dragging.current = false;
          }}
          onChange={(e) => {
            const raw = Number(e.target.value);
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
          className="relative min-h-11 w-full accent-terracotta-700"
          {...(snapCentre ? { 'data-slider-snaps': '' } : {})}
        />
      </span>
    </label>
  );
}
