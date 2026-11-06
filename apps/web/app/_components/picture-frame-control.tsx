'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Minus, Plus } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import {
  DEFAULT_PICTURE_FRAME,
  PICTURE_FRAME_FIELDS,
  PICTURE_ZOOM_MAX,
  PICTURE_ZOOM_MIN,
  PICTURE_ZOOM_STEP,
  panPictureFrame,
  pictureFrameStyle,
  storedPictureFrame,
  zoomPictureFrameAt,
  type FrameBox,
  type FramedPicture,
  type PictureFrame,
} from '@/lib/picture-frame';

/**
 * 🖼 THE ROUND-PHOTO FRAMER — one control for every round picture a person places (owner 7 Nov, prototype v21
 * `open_shop_redesign_2026-11-06/open-shop-redesign.html`, the logo step: *"drag and pinch to zoom"*). The shop logo
 * uses it first ("Add your logo" + My Shop's logo row); the profile picture (A4) is meant to reuse it as-is.
 *
 * The circle IS the editor: one finger drags the picture, two fingers pinch (zoom about their midpoint and follow it),
 * a mouse wheel or trackpad pinch zooms at the pointer, and − · slider · + zoom from the centre. Tap twice to start
 * again. `touch-action: none` sits on the circle ONLY, so the page still scrolls everywhere else. The frame is
 * continuous (`lib/picture-frame.ts`: x / y 0–100, zoom 100–300) and the math keeps the circle full — no empty edge.
 *
 * `onChange` fires live while a finger moves; `onCommit` fires when a change is finished (a finger lifts, a − / +
 * press, a slider step, a key) — the caller saves there, so "Saving…" never flickers mid-gesture.
 *
 * `picture` → the frame is also posted by the form this sits in, under that picture's columns
 * (`PICTURE_FRAME_FIELDS`, whole numbers, `storedPictureFrame`).
 */
export function PictureFrameControl({
  imageUrl,
  frame,
  onChange,
  onCommit,
  picture,
  status = null,
  savedLabel = 'Saved',
  alt,
  size = 148,
  tipTitle = 'The circle is what people see',
}: {
  /** The display URL of the picture, or null before one is chosen — then only the hidden inputs render. */
  imageUrl: string | null;
  frame: PictureFrame;
  onChange: (frame: PictureFrame) => void;
  onCommit?: (frame: PictureFrame) => void;
  /** Which picture this frames — its columns are the hidden inputs' names. Absent → nothing is posted. */
  picture?: FramedPicture;
  /** The caller's save state, drawn in ONE place beside the hint — never stacked. */
  status?: 'saving' | 'saved' | null;
  savedLabel?: string;
  alt: string;
  size?: number;
  tipTitle?: string;
}) {
  const circle = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1);
  const [snap, setSnap] = useState(false);
  // The latest frame, for handlers that run between renders (a pointer move lands before React re-renders).
  const live = useRef(frame);
  live.current = frame;
  const box = (): FrameBox => ({ size: circle.current?.clientWidth || size, aspect });
  const boxRef = useRef(box);
  boxRef.current = box;
  const set = (next: PictureFrame) => {
    live.current = next;
    onChange(next);
  };
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const setRef = useRef(set);
  setRef.current = set;

  // The gesture — pointer events only (mouse, pen, finger alike).
  const g = useRef({
    pts: new Map<number, [number, number]>(),
    mode: null as null | 'drag' | 'pinch',
    last: [0, 0] as [number, number],
    d0: 1,
    z0: 100,
    mid: [0, 0] as [number, number],
    moved: false,
    tapT: 0,
    tapX: 0,
    tapY: 0,
  });
  const at = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = circle.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function reset() {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      setSnap(true);
      window.setTimeout(() => setSnap(false), 260);
    }
    set(DEFAULT_PICTURE_FRAME);
    onCommit?.(DEFAULT_PICTURE_FRAME);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    try {
      circle.current?.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic pointer cannot be captured — the move still arrives on the circle */
    }
    const s = g.current;
    const p = at(e);
    s.pts.set(e.pointerId, p);
    setSnap(false);
    if (s.pts.size === 1) {
      s.mode = 'drag';
      s.last = p;
      s.moved = false;
    } else if (s.pts.size === 2) {
      const [a, b] = [...s.pts.values()] as [[number, number], [number, number]];
      s.mode = 'pinch';
      s.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      s.z0 = live.current.zoom;
      s.mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (!s.pts.has(e.pointerId)) return;
    const p = at(e);
    s.pts.set(e.pointerId, p);
    if (s.mode === 'drag' && s.pts.size === 1) {
      const dx = p[0] - s.last[0];
      const dy = p[1] - s.last[1];
      if (dx || dy) {
        s.moved = true;
        s.last = p;
        set(panPictureFrame(live.current, box(), dx, dy));
      }
    } else if (s.mode === 'pinch' && s.pts.size === 2) {
      const [a, b] = [...s.pts.values()] as [[number, number], [number, number]];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      s.moved = true;
      const zoomed = zoomPictureFrameAt(live.current, box(), (s.z0 * d) / s.d0, s.mid[0], s.mid[1]);
      set(panPictureFrame(zoomed, box(), mid[0] - s.mid[0], mid[1] - s.mid[1]));
      s.mid = mid;
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (!s.pts.has(e.pointerId)) return;
    const [x, y] = at(e);
    s.pts.delete(e.pointerId);
    try {
      circle.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (s.pts.size === 1) {
      // One finger of a pinch lifted: carry on dragging with the other.
      s.mode = 'drag';
      s.last = [...s.pts.values()][0]!;
      return;
    }
    if (s.pts.size > 0) return;
    if (s.moved) {
      onCommit?.(live.current);
    } else {
      const now = performance.now();
      if (now - s.tapT < 350 && Math.hypot(x - s.tapX, y - s.tapY) < 30) {
        s.tapT = 0;
        reset();
      } else {
        s.tapT = now;
        s.tapX = x;
        s.tapY = y;
      }
    }
    s.mode = null;
    s.moved = false;
  }

  // The wheel needs a NON-passive listener to keep the page from scrolling under it — React's onWheel is passive.
  useEffect(() => {
    const el = circle.current;
    if (!el) return;
    let t: number | null = null;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      const next = zoomPictureFrameAt(
        live.current,
        boxRef.current(),
        live.current.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)),
        e.clientX - r.left,
        e.clientY - r.top,
      );
      setRef.current(next);
      // A wheel has no "let go": the change is finished when the wheel rests.
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => commitRef.current?.(live.current), 250);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (t) window.clearTimeout(t);
    };
  }, [imageUrl]);

  function zoomFromCentre(z: number) {
    const D = box().size;
    const next = zoomPictureFrameAt(live.current, box(), z, D / 2, D / 2);
    set(next);
    onCommit?.(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = 8;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      const next = panPictureFrame(live.current, box(), dx, dy);
      set(next);
      onCommit?.(next);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomFromCentre(live.current.zoom + PICTURE_ZOOM_STEP);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomFromCentre(live.current.zoom - PICTURE_ZOOM_STEP);
    } else if (e.key === '0') {
      e.preventDefault();
      reset();
    }
  }

  const posted = storedPictureFrame(frame);
  const inputNames = picture ? PICTURE_FRAME_FIELDS[picture] : null;
  return (
    <div className="space-y-3" data-picture-frame="">
      {inputNames ? (
        <>
          <input type="hidden" name={inputNames.x} value={posted.x} />
          <input type="hidden" name={inputNames.y} value={posted.y} />
          <input type="hidden" name={inputNames.zoom} value={posted.zoom} />
        </>
      ) : null}
      {imageUrl ? (
        <div className="flex flex-col items-center gap-3">
          <div
            ref={circle}
            role="img"
            tabIndex={0}
            aria-label={`${alt} — drag to move, pinch or scroll to zoom, tap twice to start again`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className="relative shrink-0 cursor-grab select-none overflow-hidden rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 active:cursor-grabbing"
            style={{
              width: size,
              height: size,
              borderColor: 'var(--m-line)',
              background: 'var(--m-paper-2)',
              touchAction: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            data-picture-frame-circle=""
          >
            {/* A presigned R2 URL — next/image can't optimise short-lived signed URLs (FileUpload's pattern). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const i = e.currentTarget;
                if (i.naturalWidth && i.naturalHeight) setAspect(i.naturalWidth / i.naturalHeight);
              }}
              className="pointer-events-none block h-full w-full object-cover"
              style={{
                ...pictureFrameStyle(frame),
                transition: snap ? 'object-position 220ms ease-out, transform 220ms ease-out' : undefined,
              }}
            />
          </div>
          {/* BUTTON_RULE: − and + are round buttons at the ends of a slim slider; no dropdown. */}
          <div className="flex w-full max-w-[260px] items-center gap-2.5" data-picture-frame-zoom="">
            <ActionButton
              tone="neutral"
              icon={Minus}
              label="Zoom out"
              iconOnly
              disabled={frame.zoom <= PICTURE_ZOOM_MIN}
              onClick={() => zoomFromCentre(live.current.zoom - PICTURE_ZOOM_STEP)}
            />
            <input
              type="range"
              min={PICTURE_ZOOM_MIN}
              max={PICTURE_ZOOM_MAX}
              step={1}
              value={Math.round(frame.zoom)}
              aria-label="Zoom"
              onChange={(e) => zoomFromCentre(Number(e.currentTarget.value))}
              className="h-10 min-w-0 flex-1"
              style={{ accentColor: 'var(--m-ink)' }}
            />
            <ActionButton
              tone="neutral"
              icon={Plus}
              label="Zoom in"
              iconOnly
              disabled={frame.zoom >= PICTURE_ZOOM_MAX}
              onClick={() => zoomFromCentre(live.current.zoom + PICTURE_ZOOM_STEP)}
            />
          </div>
          <div className="flex w-full max-w-[320px] items-center justify-between gap-2.5 text-xs" style={{ minHeight: 24 }}>
            <InfoTip label="Drag to move · pinch to zoom" ariaLabel="About framing" align="start">
              <span className="block space-y-1">
                <b className="block">{tipTitle}</b>
                <span className="block">
                  Drag the picture to place it; pinch, scroll or use − and + to zoom from 1× to 3×. It always fills the
                  circle — no empty edges. Tap twice to start again.
                </span>
                {status !== null || onCommit ? (
                  <>
                    <b className="block">Saves on its own</b>
                    <span className="block">Every change is kept the moment you let go. There is nothing to press.</span>
                  </>
                ) : null}
              </span>
            </InfoTip>
            <span
              aria-live="polite"
              className="inline-flex min-w-[64px] items-center justify-end gap-1 whitespace-nowrap"
              style={{ color: status === 'saved' ? 'rgb(var(--color-ok))' : 'var(--m-slate-3)', fontWeight: status === 'saved' ? 500 : undefined }}
              data-picture-frame-status={status ?? ''}
            >
              {status === 'saving' ? (
                'Saving…'
              ) : status === 'saved' ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {savedLabel}
                </>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
