'use client';

/**
 * Kwento scrapbook page maker (owner 2026-10-03).
 *
 * The one-photo Kwento Decorator grown to a PAGE: several photos in frames,
 * people cut out of them as stickers (tapped, on the device), paper or a photo
 * behind, washi tape, stickers and words. One component for both doors:
 *
 *   • a guest, from /papic/decorate?make=scrapbook — the photos they are in;
 *   • the couple, from the Papic studio — the whole event gallery.
 *
 * Owner ruling, option A: as many pages as anyone likes, and keeping one on
 * the phone is free; SAVING a page to the gallery goes through the door a
 * single photo uses and counts like one (`lib/scrapbook/scrapbook-save.ts`).
 *
 * The page is drawn on ONE canvas by `lib/scrapbook/scrapbook-draw.ts`, the
 * same code that bakes the export, so what is arranged is what is saved. The
 * page lives in a ref, not React state: a drag repaints the canvas sixty times
 * a second and must not re-render the controls (the Maker's "never slow" rule).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  ImagePlus,
  Loader2,
  Scissors,
  Shuffle,
  Sparkles,
  Type,
  Undo2,
} from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import {
  EDGES,
  FRAMES,
  LETTERINGS,
  PAGE_SHAPES,
  PAGE_W,
  PAPERS,
  STICKERS,
  TAPES,
  WORD_COLORS,
  clamp,
  handlePoint,
  hitTest,
  pageHeight,
  readGesture,
  reshape,
  scatterPhotos,
  turnAndResize,
  unionMasks,
  type Mask,
  type PageShape,
  type PaperId,
  type ScrapLayer,
  type ScrapPage,
  type TapeId,
} from '@/lib/scrapbook/scrapbook-layout';
import {
  TileCache,
  exportPage,
  loadLetterings,
  loadPhoto,
  makeCanvas,
  paintBackground,
  paintLayers,
  paintPaper,
  paintSelection,
  tapeStrip,
  toCanvas,
  type Sources,
} from '@/lib/scrapbook/scrapbook-draw';
import { CUT_WORK_PX, cutFromMask, findSubject, loadCutout } from '@/lib/scrapbook/scrapbook-cutout';
import { saveCouplePage, saveGuestPage, type SaveOutcome, type SaveTarget } from '@/lib/scrapbook/scrapbook-save';
import { shareBlobToDevice } from '@/lib/save-to-device';
import { useModalA11y } from '@/lib/use-modal-a11y';

export type ScrapbookPhoto = { id: string; url: string; thumbUrl: string | null };

type Props = {
  eventName: string;
  /** Who is making it — words only ("you're in" vs "your gallery"). */
  who: 'guest' | 'couple';
  photos: ScrapbookPhoto[];
  /** 'unavailable' = the read FAILED. Never shown as "no photos yet". */
  photosRead: 'ok' | 'unavailable';
  saveTarget: SaveTarget;
  backHref: string;
  backLabel: string;
  /** Inside the couple's dashboard shell, which already renders the page's one
   *  `<main>` (`couple-screens-keep-the-shell.test.ts`) — render a section. */
  inShell?: boolean;
};

type TrayPhoto = { id: string; url: string; thumb: string; mine: boolean };
type CutEntry = { id: string; thumb: string };

let seq = 0;
const nextId = (p: string) => `${p}${++seq}`;
const newSeed = () => Math.floor(Math.random() * 1e9);
const START_PHOTOS = 4;

function paperThumb(id: PaperId): string {
  const c = makeCanvas(54, 72);
  const g = c.getContext('2d');
  if (g) paintPaper(g, 54, 72, id, 0.5);
  return c.toDataURL('image/png');
}
function tapeThumb(id: TapeId): string {
  const c = makeCanvas(54, 72);
  const g = c.getContext('2d');
  if (g) {
    paintPaper(g, 54, 72, 'linen', 0.5);
    g.translate(27, 36);
    g.rotate(-0.5);
    g.drawImage(tapeStrip(70, 18, id, 3), -35, -9);
  }
  return c.toDataURL('image/png');
}
function swatch(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="36"><rect width="27" height="36" fill="${color}" stroke="#0002"/></svg>`,
  )}`;
}

export function ScrapbookMaker({ eventName, who, photos, photosRead, saveTarget, backHref, backLabel, inShell = false }: Props) {
  // ── the page (a ref — see the header) ─────────────────────────────────────
  const pageRef = useRef<ScrapPage>({ shape: '4:5', background: { kind: 'paper', paper: 'kraft' }, fade: 0, layers: [] });
  const photoCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const cutCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const sources = useMemo<Sources>(
    () => ({
      photo: (id) => photoCanvases.current.get(id) ?? null,
      cut: (id) => cutCanvases.current.get(id) ?? null,
    }),
    [],
  );
  const tiles = useMemo(() => new TileCache(sources), [sources]);
  const history = useRef<string[]>([]);
  const lastSnap = useRef('');

  // ── what the controls need to re-render for ───────────────────────────────
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [selId, setSelId] = useState<string | null>(null);
  const [tray, setTray] = useState<TrayPhoto[]>(() =>
    photos.map((p) => ({ id: p.id, url: p.url, thumb: p.thumbUrl ?? p.url, mine: false })),
  );
  const [cuts, setCuts] = useState<CutEntry[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wordsDraft, setWordsDraft] = useState('');
  const [finish, setFinish] = useState<{ url: string; blob: Blob } | null>(null);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [lift, setLift] = useState<{ photoId: string } | null>(null);
  // Swatch pictures are drawn on a canvas, so only once the page is in a browser.
  const [paperOptions, setPaperOptions] = useState<PickOption[]>(() => PAPERS.map((p) => ({ key: p.id, label: p.name })));
  const [tapeOptions, setTapeOptions] = useState<PickOption[]>(() => TAPES.map((t) => ({ key: t.id, label: t.name })));
  useEffect(() => {
    setPaperOptions(PAPERS.map((p) => ({ key: p.id, label: p.name, thumb: paperThumb(p.id) })));
    setTapeOptions(TAPES.map((t) => ({ key: t.id, label: t.name, thumb: tapeThumb(t.id) })));
  }, []);

  const stageWrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLCanvasElement>(null);
  const geom = useRef({ cssW: 0, dpr: 1 });
  const bgCache = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);

  // The selection, readable from inside the stable paint callback.
  const selRef = useRef<string | null>(null);
  selRef.current = selId;
  const selected = () => pageRef.current.layers.find((l) => l.id === selId) ?? null;

  // ── painting ───────────────────────────────────────────────────────────────
  const paint = useCallback(
    (selection: string | null = selRef.current) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const c = stage.current;
        const g = c?.getContext('2d');
        if (!c || !g) return;
        const scale = c.width / PAGE_W;
        if (!bgCache.current || bgCache.current.width !== c.width || bgCache.current.height !== c.height) {
          const b = makeCanvas(c.width, c.height);
          const bg = b.getContext('2d');
          if (bg) paintBackground(bg, b.width, b.height, pageRef.current, sources);
          bgCache.current = b;
        }
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(bgCache.current, 0, 0);
        paintLayers(g, pageRef.current.layers, tiles, scale);
        const l = pageRef.current.layers.find((x) => x.id === selection);
        const s = l ? tiles.size(l) : null;
        if (l && s) paintSelection(g, l, s, scale, geom.current.dpr);
      });
    },
    [sources, tiles],
  );

  const fit = useCallback(() => {
    const wrap = stageWrap.current;
    const c = stage.current;
    if (!wrap || !c) return;
    const ratio = pageHeight(pageRef.current.shape) / PAGE_W;
    const aw = wrap.clientWidth;
    const ah = Math.max(240, window.innerHeight * 0.62);
    let w = aw;
    if (w * ratio > ah) w = ah / ratio;
    const cssW = Math.max(160, Math.floor(w));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    geom.current = { cssW, dpr };
    c.style.width = `${cssW}px`;
    c.style.height = `${Math.floor(cssW * ratio)}px`;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssW * ratio * dpr);
    bgCache.current = null;
    paint();
  }, [paint]);

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => fit());
    if (stageWrap.current) ro.observe(stageWrap.current);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    void loadLetterings().then(() => {
      tiles.clear();
      paint();
    });
  }, [tiles, paint]);

  useEffect(() => paint(), [paint, selId]);

  // ── history ────────────────────────────────────────────────────────────────
  const snapshot = () => JSON.stringify(pageRef.current);
  const commit = useCallback(() => {
    history.current.push(lastSnap.current);
    if (history.current.length > 60) history.current.shift();
    lastSnap.current = JSON.stringify(pageRef.current);
    bump();
  }, [bump]);
  const backgroundChanged = useCallback(() => {
    bgCache.current = null;
  }, []);
  const undo = () => {
    const s = history.current.pop();
    if (!s) return;
    const prev = JSON.parse(s) as ScrapPage;
    const reshaped = prev.shape !== pageRef.current.shape;
    pageRef.current = prev;
    lastSnap.current = s;
    if (!prev.layers.some((l) => l.id === selId)) setSelId(null);
    backgroundChanged();
    if (reshaped) fit();
    else paint();
    bump();
  };

  // ── photos into canvases ───────────────────────────────────────────────────
  const ensurePhoto = useCallback(
    async (p: TrayPhoto): Promise<HTMLCanvasElement | null> => {
      const have = photoCanvases.current.get(p.id);
      if (have) return have;
      setLoadingId(p.id);
      try {
        const c = await loadPhoto(p.url);
        photoCanvases.current.set(p.id, c);
        return c;
      } catch {
        setNotice('That photo wouldn’t open here. Try another one.');
        return null;
      } finally {
        setLoadingId(null);
      }
    },
    [],
  );

  const addLayer = useCallback(
    (l: Omit<ScrapLayer, 'id' | 'seed'> & Partial<Pick<ScrapLayer, 'seed'>>, select = true) => {
      const layer: ScrapLayer = { seed: newSeed(), ...l, id: nextId('L') };
      pageRef.current.layers = [...pageRef.current.layers, layer];
      if (select) setSelId(layer.id);
      commit();
      paint(select ? layer.id : selRef.current);
      return layer;
    },
    [commit, paint],
  );

  const pinPhoto = useCallback(
    async (p: TrayPhoto) => {
      const c = await ensurePhoto(p);
      if (!c) return;
      const r = Math.random;
      const h = pageHeight(pageRef.current.shape);
      addLayer({
        kind: 'photo',
        src: p.id,
        frame: (['polaroid', 'taped', 'torn', 'plain'] as const)[Math.floor(r() * 4)]!,
        caption: '',
        tape: TAPES[Math.floor(r() * 4)]!.id,
        x: PAGE_W * (0.3 + r() * 0.4),
        y: h * (0.3 + r() * 0.4),
        w: 360 + r() * 80,
        rot: (r() - 0.5) * 14,
      });
    },
    [addLayer, ensurePhoto],
  );

  // The page opens WORKING: the first few photos already pinned and scattered.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const first = tray.slice(0, START_PHOTOS);
    if (first.length === 0) {
      lastSnap.current = snapshot();
      return;
    }
    void (async () => {
      const loaded = await Promise.all(first.map((p) => ensurePhoto(p).then((c) => (c ? p : null))));
      const ok = loaded.filter((p): p is TrayPhoto => Boolean(p));
      const frames = ['polaroid', 'taped', 'torn', 'stamp'] as const;
      const layers: ScrapLayer[] = ok.map((p, i) => ({
        id: nextId('L'),
        kind: 'photo',
        src: p.id,
        frame: frames[i % frames.length]!,
        caption: '',
        tape: TAPES[i % 4]!.id,
        x: 500,
        y: 600,
        w: 420,
        rot: 0,
        seed: newSeed(),
      }));
      pageRef.current.layers = scatterPhotos(layers, pageHeight(pageRef.current.shape));
      lastSnap.current = snapshot();
      paint(null);
      bump();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  // ── gestures on the page ───────────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | null
    | { type: 'drag'; id: string; dx: number; dy: number; moved: boolean }
    | { type: 'turn'; id: string; w: number; rot: number; dist: number; angle: number; moved: boolean }
    | { type: 'pinch'; id: string; w: number; rot: number; dist: number; angle: number; cx: number; cy: number; x0: number; y0: number; moved: boolean }
  >(null);
  const toPage = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAGE_W, y: ((e.clientY - r.top) / r.height) * pageHeight(pageRef.current.shape) };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPage(e);
    pointers.current.set(e.pointerId, p);
    const sel = selected();
    if (pointers.current.size === 2 && sel) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = {
        type: 'pinch',
        id: sel.id,
        w: sel.w,
        rot: sel.rot,
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        x0: sel.x,
        y0: sel.y,
        moved: false,
      };
      return;
    }
    if (pointers.current.size !== 1) return;
    const reach = 26 * (PAGE_W / Math.max(1, geom.current.cssW));
    const ss = sel ? tiles.size(sel) : null;
    if (sel && ss) {
      const h = handlePoint(sel, ss);
      if (Math.hypot(p.x - h.x, p.y - h.y) < reach) {
        gesture.current = { type: 'turn', id: sel.id, w: sel.w, rot: sel.rot, dist: Math.hypot(p.x - sel.x, p.y - sel.y), angle: Math.atan2(p.y - sel.y, p.x - sel.x), moved: false };
        return;
      }
    }
    const hit = hitTest(pageRef.current.layers, (l) => tiles.size(l), p);
    if (hit) {
      if (hit.id !== selId) setSelId(hit.id);
      gesture.current = { type: 'drag', id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y, moved: false };
    } else {
      setSelId(null);
      gesture.current = null;
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toPage(e);
    pointers.current.set(e.pointerId, p);
    const gst = gesture.current;
    if (!gst) return;
    const l = pageRef.current.layers.find((x) => x.id === gst.id);
    if (!l) return;
    const h = pageHeight(pageRef.current.shape);
    if (gst.type === 'drag') {
      l.x = clamp(p.x - gst.dx, -100, PAGE_W + 100);
      l.y = clamp(p.y - gst.dy, -100, h + 100);
    } else if (gst.type === 'turn') {
      Object.assign(l, turnAndResize(gst, { dist: Math.hypot(p.x - l.x, p.y - l.y), angle: Math.atan2(p.y - l.y, p.x - l.x) }));
    } else if (gst.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      Object.assign(l, turnAndResize(gst, { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) }));
      l.x = gst.x0 + ((a.x + b.x) / 2 - gst.cx);
      l.y = gst.y0 + ((a.y + b.y) / 2 - gst.cy);
    }
    gst.moved = true;
    paint(gst.id);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (gesture.current?.moved && pointers.current.size === 0) commit();
    if (pointers.current.size === 0 || gesture.current?.type === 'pinch') gesture.current = null;
  };

  // ── selection actions ──────────────────────────────────────────────────────
  const change = (patch: Partial<ScrapLayer>) => {
    const l = selected();
    if (!l) return;
    Object.assign(l, patch);
    commit();
    paint();
  };
  const remove = () => {
    pageRef.current.layers = pageRef.current.layers.filter((l) => l.id !== selId);
    setSelId(null);
    commit();
    paint(null);
  };
  const restack = (dir: 1 | -1) => {
    const ls = pageRef.current.layers;
    const i = ls.findIndex((l) => l.id === selId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ls.length) return;
    const next = ls.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    pageRef.current.layers = next;
    commit();
    paint();
  };
  const copy = () => {
    const l = selected();
    if (!l) return;
    const { id: _id, seed: _seed, ...rest } = l;
    addLayer({ ...rest, x: l.x + 40, y: l.y + 40 });
  };
  const useAsBackground = () => {
    const l = selected();
    if (!l?.src) return;
    pageRef.current.background = { kind: 'photo', src: l.src };
    pageRef.current.layers = pageRef.current.layers.filter((x) => x.id !== l.id);
    setSelId(null);
    backgroundChanged();
    commit();
    paint(null);
    setNotice('That photo is the background now. Soften it under Paper.');
  };

  // ── adding from the phone ──────────────────────────────────────────────────
  const fileIn = useRef<HTMLInputElement>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: TrayPhoto[] = [];
    for (const f of Array.from(files).slice(0, 12)) {
      if (!f.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(f);
      const id = nextId('D');
      try {
        const c = await loadPhoto(url);
        photoCanvases.current.set(id, c);
        added.push({ id, url, thumb: toCanvas(c, c.width, c.height, 200).toDataURL('image/jpeg', 0.8), mine: true });
      } catch {
        setNotice('One of those files couldn’t be opened as a photo.');
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (fileIn.current) fileIn.current.value = '';
    setTray((t) => [...added, ...t]);
    for (const p of added) await pinPhoto(p);
  };

  // ── finish ─────────────────────────────────────────────────────────────────
  const openFinish = async () => {
    setOutcome(null);
    try {
      const blob = await exportPage(pageRef.current, tiles, sources);
      setFinish({ url: URL.createObjectURL(blob), blob });
    } catch {
      setNotice('The page couldn’t be put together. Remove the last photo you added and try again.');
    }
  };
  const closeFinish = () => {
    if (finish) URL.revokeObjectURL(finish.url);
    setFinish(null);
    setOutcome(null);
  };
  const finishBox = useRef<HTMLDivElement>(null);
  useModalA11y({ open: !!finish, onClose: closeFinish, containerRef: finishBox });
  const keep = async () => {
    if (!finish) return;
    const r = await shareBlobToDevice(finish.blob, `${eventName.replace(/[^\w-]+/g, '-').toLowerCase() || 'scrapbook'}-page`);
    if (r === 'failed') setNotice('Your phone didn’t take the file. Press and hold the picture to save it instead.');
  };
  const save = async () => {
    if (!finish || saveTarget.kind === 'none') return;
    setSaving(true);
    setOutcome(null);
    const result = saveTarget.kind === 'guest' ? await saveGuestPage(finish.blob) : await saveCouplePage(finish.blob, saveTarget.uploadsToken);
    setOutcome(result);
    setSaving(false);
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  const sel = selected();
  const shape = pageRef.current.shape;
  const bg = pageRef.current.background;
  const nounPhotos = who === 'guest' ? 'Photos you’re in' : 'Your gallery';

  const Root = inShell ? 'section' : 'main';
  return (
    <Root className={inShell ? 'pb-12 text-ink' : 'min-h-screen bg-cream px-4 py-8 text-ink'}>
      <div className="mx-auto w-full max-w-xl">
        <Link href={backHref} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {backLabel}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Make a scrapbook page</h1>
        <p className="mt-1 text-sm text-ink/60">
          Pin photos, cut people out of them, and add paper, tape and words. Keep the page on your phone for free
          {saveTarget.kind === 'none' ? '.' : `, or save it to ${eventName}’s gallery as one photo.`}
        </p>

        <div ref={stageWrap} className="relative mt-5 flex justify-center rounded-2xl bg-ink/5 p-2.5">
          <canvas
            ref={stage}
            className="block touch-none select-none rounded-md shadow-sm"
            aria-label="Your scrapbook page. Drag a photo to move it."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {notice ? (
            <p role="status" className="absolute inset-x-4 bottom-4 rounded-md bg-ink px-3 py-2 text-center text-sm font-medium text-cream shadow">
              {notice}
            </p>
          ) : null}
        </div>

        {sel ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink/5 p-3" data-scrapbook-selection>
            {sel.kind === 'photo' ? (
              <>
                <PickMenu label="Frame" value={sel.frame ?? 'polaroid'} options={FRAMES.map((f) => ({ key: f.id, label: f.name }))} onPick={(k) => change({ frame: k as ScrapLayer['frame'] })} className="border border-ink/15" />
                {sel.frame === 'taped' ? (
                  <PickMenu label="Tape" value={sel.tape ?? 'gold'} options={tapeOptions} onPick={(k) => change({ tape: k as TapeId })} className="border border-ink/15" />
                ) : null}
                {sel.frame === 'polaroid' ? (
                  <input
                    key={sel.id}
                    defaultValue={sel.caption ?? ''}
                    maxLength={30}
                    placeholder="Write on the print"
                    aria-label="Words on the print"
                    onChange={(e) => {
                      sel.caption = e.target.value;
                      paint();
                    }}
                    onBlur={() => commit()}
                    className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-sm"
                  />
                ) : null}
                <button type="button" onClick={() => sel.src && setLift({ photoId: sel.src })} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-terracotta-700 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-800">
                  <Scissors aria-hidden className="h-4 w-4" strokeWidth={2} /> Cut out a person
                </button>
                <button type="button" onClick={useAsBackground} className="min-h-9 rounded-md bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/15">
                  Use as background
                </button>
              </>
            ) : null}
            {sel.kind === 'cut' ? (
              <PickMenu label="Edge" value={sel.edge ?? 'white'} options={EDGES.map((x) => ({ key: x.id, label: x.name }))} onPick={(k) => change({ edge: k as ScrapLayer['edge'] })} className="border border-ink/15" />
            ) : null}
            {sel.kind === 'words' ? (
              <>
                <input
                  key={sel.id}
                  defaultValue={sel.text ?? ''}
                  maxLength={60}
                  aria-label="Wording"
                  onChange={(e) => {
                    sel.text = e.target.value || ' ';
                    paint();
                  }}
                  onBlur={() => commit()}
                  className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-sm"
                />
                <PickMenu label="Lettering" value={sel.lettering ?? 'script'} options={LETTERINGS.map((x) => ({ key: x.id, label: x.name }))} onPick={(k) => change({ lettering: k as ScrapLayer['lettering'] })} className="border border-ink/15" />
                <PickMenu label="Colour" value={sel.color ?? '#2a2622'} options={WORD_COLORS.map((c) => ({ key: c.id, label: c.name, thumb: swatch(c.id) }))} onPick={(k) => change({ color: k })} className="border border-ink/15" />
                <PickMenu label="Label" value={sel.label ? 'yes' : 'no'} options={[{ key: 'no', label: 'No label' }, { key: 'yes', label: 'On a paper label' }]} onPick={(k) => change({ label: k === 'yes' })} className="border border-ink/15" />
              </>
            ) : null}
            {sel.kind === 'tape' ? (
              <PickMenu label="Tape" value={sel.tape ?? 'gold'} options={tapeOptions} onPick={(k) => change({ tape: k as TapeId })} className="border border-ink/15" />
            ) : null}
            <span className="flex-1" />
            <button type="button" onClick={() => restack(1)} className="min-h-9 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5">Forward</button>
            <button type="button" onClick={() => restack(-1)} className="min-h-9 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5">Back</button>
            <button type="button" onClick={copy} className="min-h-9 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5">Copy</button>
            <button type="button" onClick={remove} className="min-h-9 rounded-md px-2.5 py-1.5 text-sm font-medium text-danger-700 hover:bg-ink/5">Remove</button>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-ink/50">Drag to move · gold corner to turn and resize · pinch with two fingers</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} disabled={history.current.length === 0} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40">
            <Undo2 aria-hidden className="h-4 w-4" strokeWidth={2} /> Undo
          </button>
          <button
            type="button"
            onClick={() => {
              pageRef.current.layers = scatterPhotos(pageRef.current.layers, pageHeight(shape));
              commit();
              paint();
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            <Shuffle aria-hidden className="h-4 w-4" strokeWidth={2} /> Scatter the photos
          </button>
          <span className="flex-1" />
          <PickMenu
            label="Page shape"
            value={shape}
            options={PAGE_SHAPES.map((s) => ({ key: s.id, label: s.name }))}
            onPick={(k) => {
              pageRef.current = reshape(pageRef.current, k as PageShape);
              commit();
              fit();
            }}
            className="border border-ink/15"
          />
        </div>

        {/* Photos */}
        <section className="mt-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink/50">{nounPhotos}</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <label className="flex h-[74px] w-[74px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/20 bg-surface text-[11px] font-medium text-ink/70 hover:border-terracotta/50">
              <ImagePlus aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              From phone
              <input ref={fileIn} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            </label>
            {tray.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void pinPhoto(p)}
                aria-label="Pin this photo on the page"
                className="relative h-[74px] w-[74px] flex-none overflow-hidden rounded-xl bg-ink/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned or local URL; the optimizer would cache the expiry */}
                {/* crossOrigin MATCHES the canvas load of the same URL (`loadPhoto`): a
                    plain <img> would let the browser cache a non-CORS copy and then
                    hand THAT to the canvas, tainting it — the cut-out and the export
                    would both fail on a photo that displays fine. */}
                <img
                  src={p.thumb}
                  alt=""
                  loading="lazy"
                  crossOrigin={p.mine ? undefined : 'anonymous'}
                  className="h-full w-full object-cover"
                />
                {loadingId === p.id ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
                    <Loader2 aria-hidden className="h-5 w-5 animate-spin text-cream" strokeWidth={2} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {photosRead === 'unavailable' ? (
            <p className="mt-2 text-sm text-ink/70">
              We couldn’t load {who === 'guest' ? 'the photos you’re in' : 'your gallery'} just now. Nothing is wrong with them. Try again in a moment, or use photos from your phone.
            </p>
          ) : photos.length === 0 ? (
            <p className="mt-2 text-sm text-ink/60">
              {who === 'guest'
                ? 'No photos with you in them yet. They show up here once you’re tagged. Until then, use photos from your phone.'
                : 'Nothing in your gallery yet. Use photos from your phone for now.'}
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink/50">Tap a photo to pin it. Tap a pinned photo, then “Cut out a person”, to lift someone out as a sticker.</p>
          )}
        </section>

        {cuts.length > 0 ? (
          <section className="mt-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-ink/50">Your cut-outs</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {cuts.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    const c = cutCanvases.current.get(k.id);
                    if (!c) return;
                    addLayer({ kind: 'cut', src: k.id, edge: 'white', w: clamp((c.width / c.height) * 520, 200, 620), x: PAGE_W * (0.35 + Math.random() * 0.3), y: pageHeight(shape) * (0.45 + Math.random() * 0.2), rot: (Math.random() - 0.5) * 8 });
                  }}
                  aria-label="Add this cut-out again"
                  className="h-[74px] w-[74px] flex-none rounded-xl bg-surface p-1 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                  <img src={k.thumb} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Paper */}
        <section className="mt-5 flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink/50">Paper</h2>
          <PickMenu
            label="Paper"
            value={bg.kind === 'paper' ? bg.paper : null}
            buttonText={bg.kind === 'photo' ? 'A photo' : undefined}
            options={paperOptions}
            onPick={(k) => {
              pageRef.current.background = { kind: 'paper', paper: k as PaperId };
              backgroundChanged();
              commit();
              paint();
            }}
            className="border border-ink/15"
          />
          {bg.kind === 'photo' ? (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink/70">
              Soften
              <input
                type="range"
                min={0}
                max={70}
                defaultValue={Math.round(pageRef.current.fade * 100)}
                onChange={(e) => {
                  pageRef.current.fade = Number(e.target.value) / 100;
                  backgroundChanged();
                  paint();
                }}
                onPointerUp={() => commit()}
                className="min-w-0 flex-1 accent-terracotta"
              />
            </label>
          ) : (
            <span className="text-xs text-ink/50">or tap a pinned photo → “Use as background”</span>
          )}
        </section>

        {/* Tape and stickers */}
        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
              <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Tape and stickers
            </h2>
            <button
              type="button"
              onClick={() => addLayer({ kind: 'tape', tape: TAPES[Math.floor(Math.random() * TAPES.length)]!.id, w: 300, rot: (Math.random() - 0.5) * 40, x: PAGE_W * (0.3 + Math.random() * 0.4), y: pageHeight(shape) * (0.25 + Math.random() * 0.5) })}
              className="rounded-md bg-ink/10 px-2.5 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/15"
            >
              Add tape
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {STICKERS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => addLayer({ kind: 'sticker', text: ch, w: 130, rot: (Math.random() - 0.5) * 24, x: PAGE_W * (0.25 + Math.random() * 0.5), y: pageHeight(shape) * (0.25 + Math.random() * 0.5) })}
                className="rounded-md px-2 py-1 text-xl hover:bg-ink/5"
                aria-label={`Add ${ch}`}
              >
                {ch}
              </button>
            ))}
          </div>
        </section>

        {/* Words */}
        <section className="mt-4 flex items-center gap-2">
          <Type aria-hidden className="h-4 w-4 flex-none text-ink/50" strokeWidth={2} />
          <input
            value={wordsDraft}
            onChange={(e) => setWordsDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && wordsDraft.trim()) {
                addLayer({ kind: 'words', text: wordsDraft.trim(), lettering: 'script', color: '#2a2622', label: true, x: PAGE_W / 2, y: pageHeight(shape) * 0.85, w: 520, rot: -3 });
                setWordsDraft('');
              }
            }}
            maxLength={60}
            placeholder="Write something…"
            className="min-w-0 flex-1 rounded-md border border-ink/15 bg-surface px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!wordsDraft.trim()}
            onClick={() => {
              addLayer({ kind: 'words', text: wordsDraft.trim(), lettering: 'script', color: '#2a2622', label: true, x: PAGE_W / 2, y: pageHeight(shape) * 0.85, w: 520, rot: -3 });
              setWordsDraft('');
            }}
            className="flex-none rounded-md bg-ink/10 px-2.5 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/15 disabled:opacity-50"
          >
            Add
          </button>
        </section>

        <button
          type="button"
          onClick={() => void openFinish()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-terracotta-700 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta-800"
        >
          Finish the page
        </button>
      </div>

      {lift ? (
        <CutOutSheet
          photo={photoCanvases.current.get(lift.photoId) ?? null}
          onClose={() => setLift(null)}
          onCut={(canvas) => {
            const id = nextId('C');
            cutCanvases.current.set(id, canvas);
            setCuts((c) => [...c, { id, thumb: toCanvas(canvas, canvas.width, canvas.height, 180).toDataURL('image/png') }]);
            setLift(null);
            addLayer({ kind: 'cut', src: id, edge: 'white', w: clamp((canvas.width / canvas.height) * 520, 200, 620), x: PAGE_W * (0.35 + Math.random() * 0.3), y: pageHeight(shape) * (0.45 + Math.random() * 0.2), rot: (Math.random() - 0.5) * 8 });
            setNotice('Cut-out added. Drag it anywhere.');
          }}
        />
      ) : null}

      {finish ? (
        <div ref={finishBox} tabIndex={-1} className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 outline-none sm:items-center" role="dialog" aria-modal="true" aria-label="Your page">
          <div className="max-h-full w-full max-w-lg overflow-auto rounded-t-2xl bg-cream p-4 sm:rounded-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Your page</h2>
              <button type="button" onClick={closeFinish} className="min-h-9 rounded-md px-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5">
                Keep editing
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={finish.url} alt="Your finished scrapbook page" className="mt-3 w-full rounded-md shadow" />
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void keep()} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-ink/30">
                <Download aria-hidden className="h-4 w-4" strokeWidth={2} /> Keep it on my phone · free
              </button>
              {saveTarget.kind === 'none' ? (
                <p className="text-sm text-ink/70">
                  {saveTarget.reason}{' '}
                  {saveTarget.href ? (
                    <Link href={saveTarget.href} className="font-medium underline">
                      {saveTarget.hrefLabel ?? 'Open'}
                    </Link>
                  ) : null}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={saving || outcome?.ok === true}
                  onClick={() => void save()}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-terracotta-700 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
                  {outcome?.ok ? 'Saved' : `Save to ${who === 'guest' ? 'the host’s' : 'your'} gallery · counts as 1 photo`}
                </button>
              )}
              {outcome ? (
                <p role="status" className={`text-center text-sm ${outcome.ok ? 'text-success-600' : 'text-ink/70'}`}>
                  {outcome.message}{' '}
                  {!outcome.ok && outcome.href ? (
                    <Link href={outcome.href} className="font-medium underline">
                      {outcome.hrefLabel ?? 'Open'}
                    </Link>
                  ) : null}
                </p>
              ) : null}
              <p className="text-center text-xs text-ink/50">Make as many pages as you like. Each one you save to the gallery counts as one photo.</p>
            </div>
          </div>
        </div>
      ) : null}
    </Root>
  );
}

/**
 * The cut-out sheet: tap a person (or draw a line down them), tap more people to
 * add them, then put the cut-out on the page. Runs the segmenter on a copy of
 * the photo no larger than CUT_WORK_PX; the cut itself is taken from the full one.
 */
function CutOutSheet({
  photo,
  onClose,
  onCut,
}: {
  photo: HTMLCanvasElement | null;
  onClose: () => void;
  onCut: (canvas: HTMLCanvasElement) => void;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const work = useMemo(() => (photo ? toCanvas(photo, photo.width, photo.height, CUT_WORK_PX) : null), [photo]);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [taps, setTaps] = useState<{ x: number; y: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'busy' | 'ok' | 'err' }>({ text: 'Getting the cut-out tool ready. The first time it downloads about 17 MB.', tone: 'busy' });
  const path = useRef<{ x: number; y: number }[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: box });

  useEffect(() => {
    let live = true;
    loadCutout()
      .then(() => live && setStatus({ text: 'Ready. Tap the person you want to lift out.', tone: 'ok' }))
      .catch(() => live && setStatus({ text: 'The cut-out tool couldn’t load on this phone. Check your connection and open this again.', tone: 'err' }));
    return () => {
      live = false;
    };
  }, []);

  const union = useMemo<Mask | null>(() => {
    const u = unionMasks(masks.map((m) => m.data));
    return u && masks[0] ? { data: u, w: masks[0].w, h: masks[0].h } : null;
  }, [masks]);

  const draw = useCallback(() => {
    const c = view.current;
    const g = c?.getContext('2d');
    if (!c || !g || !photo) return;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(photo, 0, 0, c.width, c.height);
    if (union) {
      const m = makeCanvas(union.w, union.h);
      const mg = m.getContext('2d');
      if (mg) {
        const d = mg.createImageData(union.w, union.h);
        for (let i = 0, j = 0; i < union.data.length; i++, j += 4) {
          d.data[j] = 18;
          d.data[j + 1] = 20;
          d.data[j + 2] = 26;
          d.data[j + 3] = Math.round((1 - clamp((union.data[i]! - 0.3) / 0.4, 0, 1)) * 165);
        }
        mg.putImageData(d, 0, 0);
        g.drawImage(m, 0, 0, c.width, c.height);
      }
    }
    g.fillStyle = '#C5A059';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    for (const t of taps) {
      g.beginPath();
      g.arc(t.x * c.width, t.y * c.height, 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    const p = path.current;
    if (p && p.length > 1) {
      g.strokeStyle = 'rgba(197,160,89,0.95)';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      p.forEach((q, i) => (i ? g.lineTo(q.x * c.width, q.y * c.height) : g.moveTo(q.x * c.width, q.y * c.height)));
      g.stroke();
    }
  }, [photo, union, taps]);

  useEffect(() => {
    const c = view.current;
    if (!c || !photo) return;
    const maxW = Math.min(560, window.innerWidth - 48);
    const maxH = Math.max(220, window.innerHeight * 0.52);
    const s = Math.min(maxW / photo.width, maxH / photo.height);
    const d = Math.min(window.devicePixelRatio || 1, 2);
    c.style.width = `${Math.round(photo.width * s)}px`;
    c.style.height = `${Math.round(photo.height * s)}px`;
    c.width = Math.round(photo.width * s * d);
    c.height = Math.round(photo.height * s * d);
  }, [photo]);
  useEffect(() => draw(), [draw]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };
  const run = async (pts: { x: number; y: number }[]) => {
    const c = view.current;
    if (!work || !c) return;
    const gst = readGesture(pts, c.clientWidth, c.clientHeight);
    setBusy(true);
    setStatus({ text: 'Finding the person…', tone: 'busy' });
    try {
      const t0 = performance.now();
      const mask = await findSubject(work, gst);
      const ms = Math.round(performance.now() - t0);
      setMasks((m) => [...m, mask]);
      setTaps((t) => [...t, gst.kind === 'tap' ? gst.at : gst.points[0]!]);
      setStatus({ text: `Found in ${ms} ms. Tap someone else to add them, or put it on the page.`, tone: 'ok' });
    } catch {
      setStatus({ text: 'That didn’t work. Try tapping the middle of the person.', tone: 'err' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={box} tabIndex={-1} className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 outline-none sm:items-center" role="dialog" aria-modal="true" aria-label="Cut out a person">
      <div className="max-h-full w-full max-w-xl overflow-auto rounded-t-2xl bg-cream p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Cut out a person</h2>
          <button type="button" onClick={onClose} className="min-h-9 rounded-md px-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5">
            Cancel
          </button>
        </div>
        <p role="status" className={`mt-3 flex items-center gap-2 rounded-md bg-ink/5 px-3 py-2 text-sm font-medium ${status.tone === 'err' ? 'text-danger-700' : 'text-ink'}`}>
          {status.tone === 'busy' ? <Loader2 aria-hidden className="h-4 w-4 flex-none animate-spin" strokeWidth={2} /> : null}
          {status.text}
        </p>
        <div className="mt-3 flex justify-center rounded-xl bg-ink/5 p-2">
          {photo ? (
            <canvas
              ref={view}
              className="block max-w-full touch-none rounded-md"
              onPointerDown={(e) => {
                if (busy) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                path.current = [at(e)];
              }}
              onPointerMove={(e) => {
                const p = path.current;
                if (!p) return;
                const q = at(e);
                const last = p[p.length - 1]!;
                if (Math.hypot((q.x - last.x) * e.currentTarget.clientWidth, (q.y - last.y) * e.currentTarget.clientHeight) > 6) {
                  p.push(q);
                  draw();
                }
              }}
              onPointerUp={() => {
                const p = path.current;
                path.current = null;
                if (p) void run(p);
              }}
              onPointerCancel={() => {
                path.current = null;
                draw();
              }}
            />
          ) : (
            <p className="p-6 text-sm text-ink/60">This photo isn’t open yet. Close this and pin it first.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-ink/55">Tap a person, or draw a line down their body for a cleaner edge. Tap more people to put them in the same cut-out.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={masks.length === 0 || busy}
            onClick={() => {
              setMasks((m) => m.slice(0, -1));
              setTaps((t) => t.slice(0, -1));
            }}
            className="min-h-9 rounded-md bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/15 disabled:opacity-40"
          >
            Undo tap
          </button>
          <span className="flex-1" />
          <button
            type="button"
            disabled={!union || busy || !photo}
            onClick={() => {
              if (!union || !photo) return;
              const cut = cutFromMask(photo, union);
              if (cut) onCut(cut);
              else setStatus({ text: 'Nothing was picked. Tap the person you want.', tone: 'err' });
            }}
            className="min-h-9 rounded-md bg-terracotta-700 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-800 disabled:opacity-50"
          >
            Put it on the page
          </button>
        </div>
      </div>
    </div>
  );
}
