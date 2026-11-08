'use client';

/**
 * <FrameStep> — ONE Frame step for every supplier photo (Photo Frame Template,
 * owner-approved 2026-11-04; slice A1b).
 *
 * 🔒 THE CONTRACT is `setnayan-handoff-src/prototypes-4nov/photo_frame_template_2026-11-04_fable.html`:
 * this is its "THE SCREEN" section ported — the header (‹ · title · the
 * device-adaptive line · ⓘ), the dark stage with the frame, the gold snap
 * lines and the fading hint, the caption under the stage, the live previews,
 * and the tools in the thumb zone (Zoom slider, "How to adjust", Reset ·
 * Looks good). The geometry is `lib/photo-frame.ts` (its `frameRect` /
 * `deriveRect` / `applySnap` / `snapZoom`), the mark is the SAME Seal and plate
 * layout and painter that burns it into the upload, so what the stage shows is
 * what is stamped.
 *
 * Opened by `FileUpload` (props `frame` + `previews`) after a pick, and again
 * when the photo's tile is tapped ("re-open to edit in place"). "Looks good" is
 * the only required tap: with no touch it returns {0.5, 0.5, 1}, today's
 * centre crop.
 *
 * Input, per the contract's table: one-finger drag · two-finger pinch around
 * the pinch centre · trackpad pinch (ctrl+wheel, Safari gesture*) · two-finger
 * swipe pans · mouse click-drag · the slider · double-tap / double-click
 * resets. The page never zooms or scrolls while gesturing inside the frame
 * (`touch-action:none`, preventDefault on ctrl+wheel and touchmove).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { Explain } from './explain';
import {
  DEFAULT_FRAMING,
  FRAME_ASPECT,
  clampFraming,
  deriveRect,
  frameRect,
  frameScale,
  snapFocus,
  snapZoom,
  zoomAbout,
  type FrameShape,
  type Framing,
  type SnapState,
} from '@/lib/photo-frame';
import type { Box, MarkLayout, MarkSpec } from '@/lib/photo-mark-geometry';
// The painter and the layout come from lib/watermark.ts, the module that burns the mark in — the SAME code, and
// already its own chunk; importing them directly would split them into one more lazy chunk (upload-mark.ts).
import { layoutMarkInFrame, markPainter } from '@/lib/watermark';

export type FramePreviews = 'service-card' | 'service-video' | 'portfolio' | 'inspiration' | 'shop-logo';

type Copy = { hd: [string, string]; cap: string; info: string[]; save?: string };

/** The prototype's USES, for the supplier uses this slice ships. Verbatim. */
const COPY: Record<FramePreviews, Copy> = {
  'service-card': {
    hd: ['Frame your photo', 'Drag to move · pinch to zoom · double-tap to reset'],
    cap: 'The Setnayan mark is stamped inside this square after you save. It cannot be dragged or zoomed out of view.',
    info: [
      'The square is what couples see on the Find card. The opened sheet and the full view show more around it, never less.',
      'The Setnayan mark is burned into the picture inside your square, bottom-right. It keeps your photo yours wherever it is shared.',
    ],
  },
  'service-video': {
    hd: ['Frame your clip', 'Drag · pinch · scrub to check the whole clip'],
    cap: 'The Setnayan mark is burned into the clip inside this square when it is prepared, the same place as on photos.',
    info: [
      'Scrub the clip to check your framing across all of it.',
      'The framing and the Setnayan mark are burned in when the clip is prepared (720p), so every copy carries them.',
      'Re-framing prepares the clip again from the original you uploaded.',
    ],
  },
  portfolio: {
    hd: ['Frame your photo', 'Drag to move · pinch to zoom · double-tap to reset'],
    cap: 'The Setnayan mark is stamped inside this square after you save.',
    info: ['The square is the portfolio tile. The full view shows the whole photo.'],
  },
  inspiration: {
    hd: ['Frame your photo', 'Drag to move · pinch to zoom · double-tap to reset'],
    cap: 'The Setnayan mark is stamped inside this square after you save.',
    info: ['The square is the mood-board tile and the Inspiration picker tile: both are square today.'],
  },
  'shop-logo': {
    hd: ['Frame your logo', 'Drag to move · pinch to zoom · double-tap to reset'],
    cap: 'This picture is also the coin in your verified mark. The logo itself carries no mark.',
    info: [
      'The circle is your shop everywhere: the shop header, the chip on every card, and the coin in the Setnayan Verified mark on your photos.',
    ],
  },
};

const BASE_INFO = [
  'Only the position and zoom are saved; the original is kept.',
  '"Looks good" keeps the centre framing: no touch needed.',
  'The photo settles on the centre when it is close (a thin gold line shows while it is there); zoom settles on 1× (fill). Keep dragging to leave it.',
];

export type FrameStepProps = {
  /** The CLEAN original: an object URL of the picked file, or the private original's short-lived URL. */
  src: string;
  isVideo?: boolean;
  shape: FrameShape;
  previews: FramePreviews;
  /** What is stamped (null = no mark: the logo). */
  mark: { spec: MarkSpec; logoDataUrl?: string | null } | null;
  initial?: Framing | null;
  reopened?: boolean;
  onDone: (f: Framing, size: { width: number; height: number }) => void;
  onCancel: () => void;
};

type Source = { el: HTMLImageElement | HTMLVideoElement; w: number; h: number };

const DPR = () => (typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1));

/** Draw `rect` of the source into a canvas of cssW×cssH, with the mark (image px) burned on top. */
function paintView(
  canvas: HTMLCanvasElement | null,
  cssW: number,
  cssH: number,
  src: Source,
  rect: Box,
  layout: MarkLayout | null,
  logo: CanvasImageSource | null,
  painter: typeof markPainter | null,
) {
  if (!canvas || cssW <= 0 || cssH <= 0) return null;
  const dpr = DPR();
  const W = Math.round(cssW * dpr);
  const H = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(src.el, rect.left, rect.top, rect.width, rect.height, 0, 0, W, H);
  if (layout && painter) {
    const k = W / rect.width;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, -rect.left * k, -rect.top * k);
    painter.paintMark(ctx, layout, logo);
    ctx.restore();
  }
  return ctx;
}

export function FrameStep({ src, isVideo = false, shape, previews, mark, initial, reopened = false, onDone, onCancel }: FrameStepProps) {
  const copy = COPY[previews];
  const aspect = FRAME_ASPECT[shape];
  const [source, setSource] = useState<Source | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touch, setTouch] = useState(true);
  const [zoomUi, setZoomUi] = useState(1);
  const [hintOff, setHintOff] = useState(false);
  const [snapLines, setSnapLines] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [toast, setToast] = useState<string | null>(null);
  const [frameCss, setFrameCss] = useState({ w: 358, h: 358 });
  const [pvW, setPvW] = useState(358);
  const [clipT, setClipT] = useState(0);
  const [clipLen, setClipLen] = useState(0);

  const f = useRef<Framing>({ ...(initial ?? DEFAULT_FRAMING) });
  const snap = useRef<SnapState>({ x: false, y: false, z: (initial?.zoom ?? 1) === 1 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLCanvasElement | null>(null);
  const pvRef = useRef<HTMLDivElement | null>(null);
  const painterRef = useRef<typeof markPainter | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);

  /* ── load the original (and the painter + fonts, when there is a mark) ── */
  useEffect(() => {
    let alive = true;
    setTouch(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    (async () => {
      try {
        if (mark) {
          await markPainter.ensureMarkFonts();
          painterRef.current = markPainter;
          if (mark.logoDataUrl) {
            const logo = new Image();
            logo.src = mark.logoDataUrl;
            await logo.decode().catch(() => undefined);
            logoRef.current = logo;
          }
        }
        if (isVideo) {
          const v = document.createElement('video');
          v.muted = true;
          v.playsInline = true;
          v.preload = 'auto';
          v.crossOrigin = 'anonymous';
          v.src = src;
          // iPhone Safari ignores `preload` and fetches no frame until the clip plays or seeks:
          // wait for its size, nudge it (a muted play is always allowed), then seek to a frame.
          await new Promise<void>((res, rej) => {
            v.onloadedmetadata = () => res();
            v.onerror = () => rej(new Error('This clip could not be opened here.'));
          });
          try {
            await v.play();
            v.pause();
          } catch {
            /* a refused play still leaves the seek below to fetch a frame */
          }
          await new Promise<void>((res) => {
            const done = () => res();
            v.onseeked = done;
            window.setTimeout(done, 3000);
            v.currentTime = Math.min(0.05, Number.isFinite(v.duration) ? v.duration / 2 : 0.05);
          });
          if (!alive) return;
          setClipLen(Number.isFinite(v.duration) ? v.duration : 0);
          setSource({ el: v, w: v.videoWidth, h: v.videoHeight });
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = src;
          await img.decode();
          if (!alive) return;
          setSource({ el: img, w: img.naturalWidth, h: img.naturalHeight });
        }
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'This photo could not be opened.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [src, isVideo, mark]);

  /* ── the frame's CSS size: the stage's width, capped at 440 tall ── */
  useEffect(() => {
    const el = wrapRef.current;
    const pv = pvRef.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth || 390;
      let w = W;
      let h = Math.round(W / aspect);
      if (h > 440) {
        h = 440;
        w = Math.round(h * aspect);
      }
      setFrameCss({ w, h });
      if (pv) setPvW(Math.max(200, pv.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  /** The mark laid out inside the frame, in original pixels (the SAME call `markPhotoFile` makes). */
  const layoutFor = useCallback(
    (fr: Box): MarkLayout | null => {
      const painter = painterRef.current;
      if (!mark || !painter) return null;
      const probe = document.createElement('canvas').getContext('2d');
      if (!probe) return null;
      return layoutMarkInFrame(fr, shape, mark.spec, painter.canvasMeasure(probe));
    },
    [mark, shape],
  );

  /* ── draw: the stage and every preview, from the one framing ── */
  const draw = useCallback(() => {
    if (!source) return;
    f.current = clampFraming(source.w, source.h, aspect, f.current);
    const fr = frameRect(source.w, source.h, aspect, f.current);
    const layout = layoutFor(fr);
    const painter = painterRef.current;
    const logo = logoRef.current;
    paintView(stageRef.current, frameCss.w, frameCss.h, source, fr, layout, logo, painter);
    const host = pvRef.current;
    if (host) {
      host.querySelectorAll<HTMLCanvasElement>('canvas[data-k]').forEach((c) => {
        const k = c.dataset.k;
        const w = Number(c.dataset.w);
        if (k === 'crop') {
          const A = Number(c.dataset.a);
          const h = Math.round(w / A);
          paintView(c, w, h, source, deriveRect(source.w, source.h, aspect, f.current, A), c.dataset.mark === '1' ? layout : null, logo, painter);
        } else if (k === 'full') {
          const h = Math.round((w * source.h) / source.w);
          const ctx = paintView(c, w, h, source, { left: 0, top: 0, width: source.w, height: source.h }, layout, logo, painter);
          if (!ctx) return;
          const k2 = c.width / source.w;
          ctx.save();
          ctx.fillStyle = 'rgba(20,18,16,.45)';
          ctx.beginPath();
          ctx.rect(0, 0, c.width, c.height);
          if (shape === 'circle') ctx.arc((fr.left + fr.width / 2) * k2, (fr.top + fr.height / 2) * k2, (fr.width / 2) * k2, 0, 7, true);
          else ctx.rect(fr.left * k2, fr.top * k2, fr.width * k2, fr.height * k2);
          ctx.fill('evenodd');
          const d = DPR();
          ctx.setLineDash([5 * d, 4 * d]);
          ctx.lineWidth = 1.5 * d;
          ctx.strokeStyle = 'rgba(255,253,247,.95)';
          ctx.beginPath();
          if (shape === 'circle') ctx.arc((fr.left + fr.width / 2) * k2, (fr.top + fr.height / 2) * k2, (fr.width / 2) * k2, 0, 7);
          else ctx.rect(fr.left * k2, fr.top * k2, fr.width * k2, fr.height * k2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
    setZoomUi(f.current.zoom);
  }, [source, aspect, frameCss, layoutFor, shape]);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, pvW]);

  const tick = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(8);
      } catch {
        /* iPhone: the gold line is the cue */
      }
    }
  };
  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2200);
  };
  const reset = useCallback(() => {
    f.current = { ...DEFAULT_FRAMING };
    snap.current = { x: false, y: false, z: true };
    schedule();
    flash('Back to the centre');
  }, [schedule]);

  /* ── gestures ── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !source) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0: { d: number; z: number } | null = null;
    let lastTap = 0;
    let moved = 0;
    let raw: { focusX: number; focusY: number } | null = null;
    let wheelT: number | undefined;
    let gz = 1;
    const stageBox = () => stageRef.current?.getBoundingClientRect() ?? el.getBoundingClientRect();
    const local = (e: { clientX: number; clientY: number }) => {
      const r = stageBox();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pxPerUnit = () => {
      const sc = frameScale(source.w, source.h, frameCss.w, frameCss.h, f.current.zoom);
      return [sc * source.w, sc * source.h] as const;
    };
    const applySnap = () => {
      if (!raw) return;
      const [ux, uy] = pxPerUnit();
      const out = snapFocus(raw, ux, uy, snap.current);
      f.current = { ...f.current, focusX: out.focusX, focusY: out.focusY };
      snap.current = out.snap;
      if (out.ticked) tick();
    };
    const setZoom = (z: number) => {
      const out = snapZoom(z, snap.current);
      snap.current = out.snap;
      if (out.ticked) tick();
      return out.zoom;
    };
    const zoomAt = (p: { x: number; y: number }, factor: number) => {
      const z = setZoom(f.current.zoom * factor);
      f.current = zoomAbout(source.w, source.h, frameCss.w, frameCss.h, f.current, p, z);
    };
    const onDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer the browser no longer tracks: follow it without capture */
      }
      pts.set(e.pointerId, local(e));
      moved = 0;
      setHintOff(true);
      raw = { focusX: f.current.focusX, focusY: f.current.focusY };
      snap.current = { ...snap.current, x: false, y: false };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: f.current.zoom };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId)!;
      const cur = local(e);
      pts.set(e.pointerId, cur);
      if (pts.size === 1 && raw) {
        const [ux, uy] = pxPerUnit();
        raw.focusX -= (cur.x - prev.x) / ux;
        raw.focusY -= (cur.y - prev.y) / uy;
        moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
        applySnap();
        setSnapLines({ x: snap.current.x, y: snap.current.y });
      } else if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const z = setZoom((pinch0.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0.d);
        f.current = zoomAbout(source.w, source.h, frameCss.w, frameCss.h, f.current, mid, z);
        raw = { focusX: f.current.focusX, focusY: f.current.focusY };
        moved = 99;
        setSnapLines({ x: false, y: false });
      }
      schedule();
    };
    const onEnd = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (pts.size === 0) {
        setSnapLines({ x: false, y: false });
        if (moved < 6) {
          const now = Date.now();
          if (now - lastTap < 320) {
            reset();
            lastTap = 0;
          } else lastTap = now;
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setHintOff(true);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(local(e), Math.exp(-e.deltaY * 0.01));
        setSnapLines({ x: false, y: false });
      } else {
        const [ux, uy] = pxPerUnit();
        raw = raw && pts.size === 0 ? raw : { focusX: f.current.focusX, focusY: f.current.focusY };
        raw.focusX += e.deltaX / ux;
        raw.focusY += e.deltaY / uy;
        applySnap();
        setSnapLines({ x: snap.current.x, y: snap.current.y });
        window.clearTimeout(wheelT);
        wheelT = window.setTimeout(() => {
          setSnapLines({ x: false, y: false });
          raw = null;
        }, 180);
      }
      schedule();
    };
    type GestureEv = Event & { scale: number; clientX: number; clientY: number };
    const onGStart = (e: Event) => {
      e.preventDefault();
      gz = f.current.zoom;
    };
    const onGChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEv;
      zoomAt(local(g), (gz * g.scale) / f.current.zoom);
      schedule();
    };
    const stop = (e: Event) => e.preventDefault();
    const pageZoomGuard = (e: WheelEvent) => {
      if (e.ctrlKey && el.contains(e.target as Node)) e.preventDefault();
    };
    const onDbl = (e: MouseEvent) => {
      e.preventDefault();
      reset();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGStart);
    el.addEventListener('gesturechange', onGChange);
    el.addEventListener('gestureend', stop);
    el.addEventListener('touchmove', stop, { passive: false });
    el.addEventListener('dblclick', onDbl);
    document.addEventListener('wheel', pageZoomGuard, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGStart);
      el.removeEventListener('gesturechange', onGChange);
      el.removeEventListener('gestureend', stop);
      el.removeEventListener('touchmove', stop);
      el.removeEventListener('dblclick', onDbl);
      document.removeEventListener('wheel', pageZoomGuard);
      window.clearTimeout(wheelT);
    };
  }, [source, frameCss, schedule, reset]);

  /* ── the clip: scrub to check the framing across it ── */
  const scrubTo = (t: number) => {
    setClipT(t);
    const v = source?.el;
    if (v instanceof HTMLVideoElement) {
      v.currentTime = t;
      v.onseeked = () => schedule();
    }
  };

  /* The step is a full-screen dialog: focus moves into it and is kept there, the page behind does not scroll,
     focus goes back to the photo on close, and Esc backs out like the ‹ (the shared contract, lib/use-modal-a11y.ts). */
  useModalA11y({ open: true, onClose: onCancel, containerRef: rootRef });

  const gest = touch ? 'Drag to move · pinch to zoom · double-tap to reset' : 'Drag to move · use the slider to zoom · double-click to reset';
  const sub = copy.hd[1]
    .replace('Drag to move · pinch to zoom · double-tap to reset', gest)
    .replace('Drag · pinch · scrub', touch ? 'Drag · pinch · scrub' : 'Drag · slider · scrub');
  const howTo = touch
    ? 'How to adjust · drag to move · pinch to zoom · the slider also zooms'
    : 'How to adjust · drag to move · the slider zooms · pinch or ctrl+scroll on a trackpad · two-finger swipe moves';
  const marked = mark !== null;

  /* ── the previews, per use (the prototype's `build()`, for the supplier uses) ── */
  const PW = pvW;
  const half = Math.floor((PW - 12) / 2);
  const third = Math.floor((PW - 12) / 3);
  const cv = (a: number, w: number, extra?: { round?: boolean; mark?: boolean; tile?: boolean }) => (
    <canvas
      data-k="crop"
      data-a={a}
      data-w={w}
      data-mark={extra?.mark === false ? '0' : marked ? '1' : '0'}
      className={`fst-cv block${extra?.round ? ' rounded-full' : extra?.tile ? ' rounded' : ''}`}
    />
  );
  const full = (what: string) => (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <canvas data-k="full" data-w={PW} className="fst-cv block rounded-xl" />
      <span className="fst-cap">
        <b>Full photo</b> · the whole original · dashed = your {what}
        {marked ? ' · the mark is inside it' : ''}
      </span>
    </div>
  );
  const bars = (
    <span className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5" aria-hidden>
      <i className="fst-bar w-4/5" />
      <i className="fst-bar w-1/2" />
      <i className="fst-bar w-1/3" />
    </span>
  );
  const pvBody = useMemo(() => {
    if (previews === 'service-card' || previews === 'service-video') {
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-[5px]">
              <div className="fst-fc">
                {cv(1, half)}
                {bars}
              </div>
              <span className="fst-cap">
                <b>Find card</b>
                {previews === 'service-video' ? ' · playing muted · mark burned in' : ''}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <div className="fst-fc">{cv(5 / 7, half)}</div>
              <span className="fst-cap">
                <b>Service card</b> · the 5:7 cover
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="fst-fc">
              {cv(1.56, PW)}
              {bars}
            </div>
            <span className="fst-cap">
              <b>Opened sheet</b> · the hero · more around the square
            </span>
          </div>
          {previews === 'service-card' ? full('square') : null}
        </>
      );
    }
    if (previews === 'portfolio') {
      return (
        <>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="grid grid-cols-3 gap-1.5">
              {cv(1, third, { tile: true })}
              <span className="fst-ph a rounded" style={{ height: third }} />
              <span className="fst-ph b rounded" style={{ height: third }} />
            </div>
            <span className="fst-cap">
              <b>Portfolio grid</b> · your tile among the others
            </span>
          </div>
          {full('square')}
        </>
      );
    }
    if (previews === 'inspiration') {
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-[5px]">
              <div className="relative overflow-hidden rounded">{cv(1, half)}</div>
              <span className="fst-cap">
                <b>Mood board</b> · the tile a couple saves
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-[5px]">
              <div className="relative overflow-hidden rounded">{cv(1, half)}</div>
              <span className="fst-cap">
                <b>Inspiration picker</b> · picked
              </span>
            </div>
          </div>
          {full('square')}
        </>
      );
    }
    // shop-logo
    return (
      <>
        <div className="fst-acct">
          {cv(1, 64, { round: true, mark: false })}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5" aria-hidden>
            <i className="fst-bar w-3/5" />
            <i className="fst-bar w-2/5" />
          </span>
        </div>
        <span className="fst-cap">
          <b>Shop header</b>
        </span>
        <div className="flex items-end gap-[18px] px-0.5 py-1">
          {[20, 32, 48, 96].map((s) => (
            <div key={s} className="flex flex-col items-center gap-[5px] text-center">
              {cv(1, s, { round: true, mark: false })}
              <span className="fst-cap">{s === 20 ? '20 · card chip' : s === 32 ? '32 · chat' : s === 48 ? '48 · rows' : '96 · shop'}</span>
            </div>
          ))}
        </div>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, PW, half, third, marked]);

  return (
    <div ref={rootRef} tabIndex={-1} className="fst" role="dialog" aria-modal="true" aria-label={copy.hd[0]} data-frame-step={shape}>
      <style>{FST_CSS}</style>
      {toast ? <div className="fst-toast">{toast}</div> : null}
      <div className="fst-hd">
        <button type="button" className="fst-xb" aria-label="Back" onClick={onCancel}>
          ‹
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[17px] font-semibold leading-tight">{copy.hd[0]}</span>
          <span className="text-[12.5px] text-[var(--fst-muted)]">{sub}</span>
        </div>
        <Explain title="About framing" label="More about framing" data="frame-step">
          <ul className="fst-info">
            {[...copy.info, ...BASE_INFO].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Explain>
      </div>
      {reopened ? (
        <div className="fst-reopen">
          {isVideo
            ? 'Re-framing · your saved framing is loaded · saving prepares the clip again from the kept original'
            : 'Re-framing · your saved framing is loaded'}
        </div>
      ) : null}

      <div ref={wrapRef} className="fst-stage" data-frame-stage="">
        <div className="relative flex-none" style={{ width: frameCss.w, height: frameCss.h }}>
          <canvas ref={stageRef} className="block" />
          {shape === 'circle' ? <div className="fst-mask" /> : null}
          <div className={`fst-snap v${snapLines.x ? ' on' : ''}`} data-snap-line="v" />
          <div className={`fst-snap h${snapLines.y ? ' on' : ''}`} data-snap-line="h" />
        </div>
        <div className={`fst-hint${hintOff ? ' off' : ''}`}>{touch ? 'Drag · pinch · double-tap' : 'Drag · slider · double-click'}</div>
        {!source && !loadError ? <div className="fst-hint">Opening…</div> : null}
        {loadError ? <div className="fst-hint">{loadError}</div> : null}
      </div>
      <div className="fst-stagecap">
        {marked ? <span className="fst-dot" /> : null}
        <span>{copy.cap}</span>
      </div>

      <div ref={pvRef} className="fst-pv">
        <div className="fst-pv-h">
          <span>HOW IT READS · LIVE</span>
        </div>
        {pvBody}
      </div>

      <div className="fst-tools">
        {isVideo && clipLen > 0 ? (
          <div className="fst-trow">
            <span className="fst-lab">Clip</span>
            <input
              type="range"
              min={0}
              max={clipLen}
              step={0.05}
              value={clipT}
              aria-label="Scrub the clip"
              onChange={(e) => scrubTo(Number(e.target.value))}
            />
            <span className="fst-zv">{clipT.toFixed(1)} s</span>
          </div>
        ) : null}
        <div className="fst-trow">
          <span className="fst-lab" title={touch ? 'Fallback for pinch' : ''}>
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoomUi}
            aria-label="Zoom"
            data-frame-zoom=""
            onChange={(e) => {
              const out = snapZoom(Number(e.target.value), snap.current);
              snap.current = out.snap;
              if (out.ticked) tick();
              f.current = { ...f.current, zoom: out.zoom };
              schedule();
            }}
          />
          <span className="fst-zv">{zoomUi.toFixed(1)}×</span>
        </div>
        <div className="fst-trow text-[12px] text-[var(--fst-muted)]">
          <span>{howTo}</span>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="fst-btn fst-sec" onClick={reset}>
            Reset
          </button>
          <button
            type="button"
            className="fst-btn fst-pri"
            data-frame-done=""
            disabled={!source}
            onClick={() => source && onDone(clampFraming(source.w, source.h, aspect, f.current), { width: source.w, height: source.h })}
          >
            Looks good
          </button>
        </div>
      </div>

    </div>
  );
}

/**
 * The prototype's stylesheet for the screen, scoped under `.fst`. Its colours are the app's tokens (globals.css), so
 * light and dark follow the app; its corners are the `--m-r-*` scale. The stage stays dark in both themes: it is a
 * photo light-box, the same near-black the mark's plate shadow uses.
 */
const FST_CSS = `
.fst{--fst-bg:rgb(var(--color-cream));--fst-surface:rgb(var(--color-raised));--fst-ink:rgb(var(--color-ink));--fst-muted:rgb(var(--color-ink) / .72);--fst-line:rgb(var(--color-ink) / .14);--fst-line2:rgb(var(--color-ink) / .09);--fst-gold:rgb(var(--color-terracotta));--fst-gold-soft:rgb(var(--color-terracotta) / .14);--fst-accent:rgb(var(--color-mulberry));--fst-pill:rgb(var(--color-ink) / .06);--fst-stage:rgb(20 18 16);
  position:fixed;inset:0;z-index:90;background:var(--fst-surface);color:var(--fst-ink);display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;font-size:15px;line-height:1.5;padding-bottom:env(safe-area-inset-bottom)}
.fst:focus{outline:none}
.fst-hd{display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 16px 10px}
.fst-xb{width:34px;height:34px;border-radius:50%;background:var(--fst-pill);display:grid;place-items:center;border:0;cursor:pointer;flex:none;font-size:16px;color:var(--fst-ink)}
.fst-info{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;list-style:disc}
.fst-reopen{margin:0 16px 8px;padding:7px 12px;border-radius:var(--m-r-sm);background:var(--fst-gold-soft);color:var(--fst-gold);font-size:12.5px;font-weight:500;line-height:1.35}
.fst-stage{position:relative;background:var(--fst-stage);touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;cursor:grab;display:flex;justify-content:center;flex:none}
.fst-stage:active{cursor:grabbing}
.fst-mask{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle closest-side at center, transparent calc(100% - 1px), rgba(20,18,16,.62) 100%)}
.fst-mask::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,253,247,.85)}
.fst-snap{position:absolute;background:rgb(233 207 134);box-shadow:0 0 4px rgba(233,207,134,.9);pointer-events:none;display:none}
.fst-snap.v{top:0;bottom:0;left:50%;width:1px;margin-left:-.5px}.fst-snap.h{left:0;right:0;top:50%;height:1px;margin-top:-.5px}
.fst-snap.on{display:block}
.fst-hint{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:11.5px;color:rgba(255,253,247,.9);pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6);transition:opacity .4s}
.fst-hint.off{opacity:0}
.fst-stagecap{display:flex;align-items:center;gap:8px;padding:8px 16px 0;font-size:12px;color:var(--fst-muted);min-height:18px;line-height:1.35}
.fst-dot{width:8px;height:8px;border-radius:50%;background:var(--fst-gold);flex:none}
.fst-pv{padding:10px 14px 6px;display:flex;flex-direction:column;gap:10px}
.fst-pv-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;letter-spacing:.16em;color:var(--fst-gold);font-weight:500}
.fst-cap{font-size:11.5px;color:var(--fst-muted);line-height:1.3}
.fst-cap b{color:var(--fst-ink);font-weight:600}
.fst-cv{background:var(--fst-stage)}
.fst-ph{display:block}
.fst-ph.a{background:linear-gradient(135deg,rgb(var(--color-veil)),rgb(var(--color-terracotta) / .35))}
.fst-ph.b{background:linear-gradient(135deg,rgb(var(--color-ink) / .06),rgb(var(--color-link) / .3))}
.fst-fc{position:relative;background:var(--fst-surface);border:1px solid var(--fst-line);border-radius:var(--m-r-md);overflow:hidden}
.fst-bar{display:block;height:8px;border-radius:var(--m-r-full);background:var(--fst-pill)}
.fst-acct{display:flex;align-items:center;gap:12px;padding:12px;background:var(--fst-surface);border:1px solid var(--fst-line);border-radius:var(--m-r-md)}
.fst-tools{padding:10px 16px 18px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--fst-line2);margin-top:auto;position:sticky;bottom:0;background:var(--fst-surface)}
.fst-trow{display:flex;align-items:center;gap:10px}
.fst-lab{font-size:12.5px;color:var(--fst-muted);flex:none;width:52px}
.fst input[type=range]{flex:1;accent-color:var(--fst-accent);height:28px;margin:0;min-width:0}
.fst-zv{font-size:12.5px;color:var(--fst-muted);width:44px;text-align:right;flex:none}
.fst-btn{height:48px;border-radius:var(--m-r-full);display:grid;place-items:center;font-size:15px;font-weight:500;border:0;cursor:pointer;white-space:nowrap}
.fst-pri{flex:1;background:var(--fst-accent);color:rgb(var(--color-cream))}
.fst-pri:disabled{opacity:.5}
.fst-sec{flex:0 0 96px;background:transparent;border:1.5px solid var(--fst-line);color:var(--fst-ink)}
.fst-toast{position:fixed;left:16px;right:16px;top:60px;background:var(--fst-ink);color:var(--fst-bg);border-radius:var(--m-r-md);padding:10px 14px;font-size:13.5px;z-index:95;line-height:1.35;pointer-events:none}
`;
