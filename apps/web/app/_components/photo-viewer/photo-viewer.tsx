'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2, X, type LucideIcon } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import {
  MIN_SCALE,
  clampPan,
  clampScale,
  classifySwipe,
  distance,
  doubleTapZoom,
  isDoubleTap,
  keyIntent,
  lockAxis,
  pinchScale,
  type Axis,
} from '@/lib/photo-viewer-gestures';

/**
 * 🖼 THE ONE PHOTO VIEWER — every gallery that opens a photo full screen opens THIS (owner 2026-10-27, on Memories:
 * *"tapping a photo will open a preview in full screen with (X). download, delete, tag … these will be icons only. no
 * need view because we want to be able to view it. will have pinch zoom. swiping left and right goes to the next or
 * preious photo. swipe down or up will close the preview."* — and then, for the whole app: *"this view photo will work
 * the same across all galleries possible. (buttons may change, but pinch zoom, swipe, button locations will stay the
 * same."*).
 *
 * So the FRAME is fixed here and only the BUTTONS come from the caller:
 *
 *   · the photo fills the screen (contain) on the obsidian ground — opaque, nothing of the page shows through;
 *   · ✕ is ALWAYS top-left (44 px), with the photo's own line beside it and "3 of 24" at the right;
 *   · the action bar is ALWAYS bottom-centre: icon-only 44 px buttons, each with an aria-label, a hover tooltip and a
 *     long-press label — the caller passes any subset (`actions`), in its order;
 *   · a caller's panel (a confirm, the tag picker, a ⋯ list) rises in ONE place, just above the bar (`panel`);
 *   · pinch and double-tap zoom (and ⌃/trackpad pinch on a desktop); zoomed in, a drag pans;
 *   · swipe left / right = next / previous in the caller's CURRENT order; swipe up or down = close;
 *   · ← / → / Escape on a keyboard, and the phone's Back closes it (`useBackCloses`, one history entry);
 *   · portalled to <body> — no contained ancestor can shrink it — and the page under it neither scrolls nor moves, so
 *     closing lands exactly where you were (`useModalA11y`'s lock restores the scroll).
 *
 * The thresholds are arithmetic in `lib/photo-viewer-gestures.ts` (unit-tested); the frame is held by
 * `app/_components/photo-viewer/the-one-photo-viewer.test.ts`.
 */

export type PhotoViewerAction = {
  key: string;
  icon: LucideIcon;
  /** Said by a screen reader, on hover and on a long press — the button itself shows only its icon. */
  label: string;
  onPress?: () => void;
  /** A plain link instead of a press (a same-origin save route). */
  href?: string;
  download?: boolean;
  tone?: 'danger';
  /** Its panel is open. */
  pressed?: boolean;
  busy?: boolean;
};

export type PhotoViewerMedia = {
  /** Stable per item — the zoom resets when it changes. */
  key: string;
  kind: 'photo' | 'clip';
  src: string;
  poster?: string | null;
  alt?: string;
  /** Held back (a content screen): drawn blurred until "Show" is pressed. */
  veiled?: boolean;
};

export function PhotoViewer({
  media,
  onClose,
  onPrev,
  onNext,
  actions = [],
  panel = null,
  onPanelClose,
  title,
  subtitle,
  position,
  label,
}: {
  media: PhotoViewerMedia;
  onClose: () => void;
  /** The neighbours in the caller's current order — absent at either end (no wrap). */
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  actions?: PhotoViewerAction[];
  /** The caller's panel (a confirm, a picker) — drawn above the bar, in the one place every viewer keeps it. */
  panel?: ReactNode;
  onPanelClose?: () => void;
  title?: string | null;
  subtitle?: string | null;
  position?: { index: number; count: number } | null;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const close = useBackCloses(true, onClose);
  useModalA11y({ open: true, onClose: close, containerRef: dialogRef });
  const host = typeof document === 'undefined' ? null : document.body;

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [live, setLive] = useState(false);
  const [unveiled, setUnveiled] = useState<string | null>(null);

  /* A new photo starts whole: 1×, centred, and veiled again if it is held back. */
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDrag({ x: 0, y: 0 });
  }, [media.key]);

  const hasPrev = Boolean(onPrev);
  const hasNext = Boolean(onNext);
  const go = useCallback(
    (intent: 'prev' | 'next' | 'close') => {
      if (intent === 'close') close();
      else if (intent === 'prev') onPrev?.();
      else onNext?.();
    },
    [close, onPrev, onNext],
  );

  /* ← / → on a keyboard (Escape is `useModalA11y`'s, so it peels a panel's confirm first). Never while typing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = keyIntent(e.key);
      if (k === 'prev' || k === 'next') {
        e.preventDefault();
        go(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const box = () => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { w: r.width, h: r.height, left: r.left, top: r.top } : { w: 1, h: 1, left: 0, top: 0 };
  };

  // ── TOUCH: one finger swipes (or pans when zoomed), two fingers pinch ────────────────────────────────────────────
  const one = useRef<{ x: number; y: number; t: number; axis: Axis; pan: { x: number; y: number }; moved: boolean } | null>(null);
  const two = useRef<{ d: number; scale: number; mid: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const zoomable = media.kind === 'photo';

  const onTouchStart = (e: React.TouchEvent) => {
    setLive(true);
    if (e.touches.length >= 2 && zoomable) {
      const a = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      const b = { x: e.touches[1]!.clientX, y: e.touches[1]!.clientY };
      two.current = { d: distance(a, b), scale, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pan };
      one.current = null;
      setDrag({ x: 0, y: 0 });
      return;
    }
    const t = e.touches[0];
    if (t) one.current = { x: t.clientX, y: t.clientY, t: performance.now(), axis: null, pan, moved: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = two.current;
    if (p && e.touches.length >= 2) {
      const a = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      const b = { x: e.touches[1]!.clientX, y: e.touches[1]!.clientY };
      const s = pinchScale(p.scale, p.d, distance(a, b));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setScale(s);
      setPan(clampPan({ x: p.pan.x + mid.x - p.mid.x, y: p.pan.y + mid.y - p.mid.y }, s, box()));
      return;
    }
    const s0 = one.current;
    const t = e.touches[0];
    if (!s0 || !t) return;
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) s0.moved = true;
    if (scale > MIN_SCALE + 0.01) {
      setPan(clampPan({ x: s0.pan.x + dx, y: s0.pan.y + dy }, scale, box()));
      return;
    }
    if (!s0.axis) s0.axis = lockAxis(dx, dy, hasPrev || hasNext);
    if (s0.axis === 'x') setDrag({ x: dx, y: 0 });
    else if (s0.axis === 'y') setDrag({ x: 0, y: dy });
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (two.current) {
      if (e.touches.length < 2) {
        two.current = null;
        if (scale < 1.05) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        }
        one.current = null;
        setLive(false);
      }
      return;
    }
    const s0 = one.current;
    one.current = null;
    setLive(false);
    if (!s0) return;
    const ch = e.changedTouches[0];
    const dx = ch ? ch.clientX - s0.x : drag.x;
    const dy = ch ? ch.clientY - s0.y : drag.y;
    setDrag({ x: 0, y: 0 });
    if (!s0.moved && ch) {
      const now = { t: performance.now(), x: ch.clientX, y: ch.clientY };
      if (zoomable && isDoubleTap(lastTap.current, now)) {
        const z = doubleTapZoom(scale, now, box());
        setScale(z.scale);
        setPan(z.pan);
        lastTap.current = null;
      } else lastTap.current = now;
      return;
    }
    const r = classifySwipe({ dx, dy, ms: performance.now() - s0.t, axis: s0.axis, scale, hasPrev, hasNext });
    if (r !== 'none') go(r);
  };

  // ── DESKTOP: double-click zooms, ⌃ + wheel (a trackpad pinch) scales, a drag pans while zoomed ────────────────────
  const mouse = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const onDoubleClick = (e: React.MouseEvent) => {
    if (!zoomable) return;
    const z = doubleTapZoom(scale, { x: e.clientX, y: e.clientY }, box());
    setScale(z.scale);
    setPan(z.pan);
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((s) => {
        const next = clampScale(s * Math.exp(-e.deltaY / 120));
        setPan((p) => (next <= MIN_SCALE ? { x: 0, y: 0 } : clampPan(p, next, box())));
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomable, media.key]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || scale <= MIN_SCALE) return;
    mouse.current = { x: e.clientX, y: e.clientY, pan };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setLive(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const m = mouse.current;
    if (!m) return;
    setPan(clampPan({ x: m.pan.x + e.clientX - m.x, y: m.pan.y + e.clientY - m.y }, scale, box()));
  };
  const onPointerUp = () => {
    mouse.current = null;
    setLive(false);
  };

  const veiled = Boolean(media.veiled) && unveiled !== media.key;
  const fade = drag.y !== 0 ? Math.max(0.35, 1 - Math.abs(drag.y) / 500) : 1;
  const transform = `translate3d(${pan.x + drag.x}px, ${pan.y + drag.y}px, 0) scale(${scale})`;

  if (!host) return null;
  return createPortal(
    <div
      ref={dialogRef}
      data-photo-viewer=""
      data-one-viewer=""
      data-viewer-zoom={scale > MIN_SCALE + 0.01 ? 'in' : 'fit'}
      className="sn-gal-scrim fixed inset-0 z-[80] overflow-hidden overscroll-contain outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? (media.kind === 'clip' ? 'Video clip' : 'Photo')}
      tabIndex={-1}
    >
      {/* THE STAGE — the whole screen. Gestures live here; the chrome above it is its own layer. */}
      <div
        ref={stageRef}
        data-viewer-stage=""
        className="absolute inset-0 flex touch-none select-none items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={panel && onPanelClose ? onPanelClose : undefined}
        style={{ opacity: fade }}
      >
        <div
          data-viewer-media={media.kind}
          className={`flex h-full w-full items-center justify-center will-change-transform ${live ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
          style={{ transform }}
        >
          {media.kind === 'clip' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={media.key}
              src={media.src}
              poster={media.poster ?? undefined}
              controls
              autoPlay
              playsInline
              loop
              className="max-h-full max-w-full bg-black object-contain"
            />
          ) : (
            // A presigned URL — a plain <img>; the optimizer would cache an expiring URL (the rule every tile follows).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={media.key}
              src={media.src}
              alt={media.alt ?? ''}
              draggable={false}
              className={`max-h-full max-w-full object-contain ${veiled ? 'blur-[28px]' : ''}`}
            />
          )}
        </div>
        {veiled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUnveiled(media.key);
            }}
            data-viewer-unveil=""
            className="sn-gal-btn sn-gal-text absolute left-1/2 top-1/2 inline-flex min-h-[44px] -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-[rgb(23_22_15/0.66)] px-5 text-[14px] font-medium"
          >
            Show
          </button>
        ) : null}
      </div>

      {/* TOP — ✕ at the left, always; the photo's line; "3 of 24" at the right. */}
      <div
        data-viewer-top=""
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 bg-gradient-to-b from-[rgb(23_22_15/0.72)] to-transparent pb-6 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          title="Close"
          data-viewer-close=""
          className="sn-gal-text pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(23_22_15/0.5)] hover:bg-[rgb(251_250_247/0.1)]"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 pt-1.5">
          {title ? <p className="sn-gal-text truncate text-[14px] font-semibold leading-tight">{title}</p> : null}
          {subtitle ? <p className="sn-gal-soft truncate text-[12px] leading-tight">{subtitle}</p> : null}
        </div>
        {position && position.count > 1 ? (
          <p className="sn-gal-soft shrink-0 pt-3 font-mono text-[11px] tracking-[0.08em]" data-viewer-position="">
            {position.index + 1} of {position.count}
          </p>
        ) : null}
      </div>

      {/* ‹ › — the neighbours, for a mouse (a phone swipes). */}
      {hasPrev ? (
        <button
          type="button"
          onClick={() => go('prev')}
          aria-label="Previous"
          title="Previous"
          className="sn-gal-text absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(23_22_15/0.5)] hover:bg-[rgb(251_250_247/0.1)] lg:inline-flex"
        >
          <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={1.8} />
        </button>
      ) : null}
      {hasNext ? (
        <button
          type="button"
          onClick={() => go('next')}
          aria-label="Next"
          title="Next"
          className="sn-gal-text absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(23_22_15/0.5)] hover:bg-[rgb(251_250_247/0.1)] lg:inline-flex"
        >
          <ChevronRight aria-hidden className="h-6 w-6" strokeWidth={1.8} />
        </button>
      ) : null}

      {/* BOTTOM — the caller's panel (one place), then the action bar (one place). */}
      <div
        data-viewer-bottom=""
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-[rgb(23_22_15/0.78)] to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8"
      >
        {panel ? (
          <div
            data-viewer-panel=""
            className="sn-gal-lb-card sn-gal-text pointer-events-auto max-h-[min(60vh,28rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl p-3"
          >
            {panel}
          </div>
        ) : null}
        {actions.length ? (
          <div data-viewer-actions="" className="pointer-events-auto flex items-center justify-center gap-3">
            {actions.map((a) => (
              <ViewerButton key={a.key} action={a} />
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    host,
  );
}

const BTN =
  'sn-gal-text relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(23_22_15/0.5)] ring-1 ring-[rgb(251_250_247/0.18)] hover:bg-[rgb(251_250_247/0.1)] disabled:opacity-60';

/** One icon of the bar — 44 px, labelled for a screen reader, on hover (`title`) and on a long press. */
function ViewerButton({ action: a }: { action: PhotoViewerAction }) {
  const [said, setSaid] = useState(false);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const Icon = a.busy ? Loader2 : a.icon;
  const press = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      longPressed.current = false;
      timer.current = window.setTimeout(() => {
        longPressed.current = true;
        setSaid(true);
      }, 450);
    },
    onPointerUp: () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (longPressed.current) window.setTimeout(() => setSaid(false), 900);
    },
    onPointerLeave: () => {
      if (timer.current) window.clearTimeout(timer.current);
      setSaid(false);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  /* A long press only says the name — it never also fires the action. */
  const guard = (e: React.MouseEvent) => {
    if (longPressed.current) {
      e.preventDefault();
      longPressed.current = false;
      return true;
    }
    return false;
  };
  const tone = a.tone === 'danger' ? 'text-[#F2A07F]' : '';
  const on = a.pressed ? 'bg-[rgb(251_250_247/0.16)] ring-[rgb(251_250_247/0.5)]' : '';
  const bubble = said ? (
    <span
      role="tooltip"
      className="sn-gal-badge pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[12px]"
    >
      {a.label}
    </span>
  ) : null;
  const icon = <Icon aria-hidden className={`h-5 w-5 ${a.busy ? 'animate-spin' : ''}`} strokeWidth={1.9} />;
  if (a.href) {
    return (
      <a
        href={a.href}
        download={a.download ? '' : undefined}
        aria-label={a.label}
        title={a.label}
        data-viewer-action={a.key}
        className={`${BTN} ${tone}`}
        onClick={(e) => {
          if (!guard(e)) a.onPress?.();
        }}
        {...press}
      >
        {icon}
        {bubble}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={a.label}
      title={a.label}
      aria-pressed={a.pressed === undefined ? undefined : a.pressed}
      disabled={a.busy}
      data-viewer-action={a.key}
      className={`${BTN} ${tone} ${on}`}
      onClick={(e) => {
        if (!guard(e)) a.onPress?.();
      }}
      {...press}
    >
      {icon}
      {bubble}
    </button>
  );
}
