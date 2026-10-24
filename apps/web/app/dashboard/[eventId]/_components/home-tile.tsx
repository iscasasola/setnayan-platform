'use client';

/**
 * home-tile.tsx — THE COMPACT TILE, the phone's control row (owner-approved 2026-10-24, "ok":
 * `prototypes/home_control_center_2026-10-24_fable.html`, its `.tile` · `.faces` · `.dots` · `.tiny` rules and the
 * "Faces — swipe, and auto-rotate" table). Below 768 px only (`md:hidden` on the grid); the detail card draws the same
 * model from `md` up.
 *
 *   one counter at a time · swipe inside the tile (finger or mouse, a snap) · small dots under the figure, the active
 *   one an 18 px bar that fills over the 4.5 s · ← → from the keyboard · faces read as a list · at most one tiny action
 *   per face · a TAP THAT IS NOT A SWIPE OPENS THE EXACT ITEM of the face it lands on.
 *
 * AUTO-ROTATE (`home-tile-rotation.ts` holds the rules): 4.5 s a face, a 320 ms slide, 0.9 s between tiles in grid
 * order; paused under a finger, off screen (40 %), on a hidden page; never under reduced motion, never for one face,
 * never for a failed read. A touch rests the tile 9 s and it resumes from the face it was left on. The last face is
 * remembered per viewer on this device (a convenience — a private window simply starts at the first).
 *
 * ONE TICKER for every tile on the page (a single requestAnimationFrame), and the progress bar is written straight to
 * the dot's style — React renders only when a face changes.
 */

import Link from 'next/link';
import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { ArrowRight, CalendarDays, Check, Eye, Mail, PenLine, Plus, RotateCw } from 'lucide-react';
import type { FaceAction, FaceIcon, HomeFace, HomeTileModel } from './home-control-faces';
import { FACE_MS, RESUME_MS, STAGGER_MS, TAP_PX, VISIBLE_THRESHOLD, swipeLands, tilePaused, tileRotates } from './home-tile-rotation';
import { openEventHub } from './open-event-hub';
import { Count } from '@/components/count';

/* ─── One ticker for the page ─────────────────────────────────────────────── */

type Rotor = (now: number) => void;
const rotors = new Set<Rotor>();
let frame = 0;
function loop(now: number) {
  for (const r of rotors) r(now);
  frame = rotors.size > 0 ? requestAnimationFrame(loop) : 0;
}
function joinTicker(r: Rotor): () => void {
  rotors.add(r);
  if (!frame) frame = requestAnimationFrame(loop);
  return () => {
    rotors.delete(r);
  };
}

/* ─── Icons and the tiny action ───────────────────────────────────────────── */

const ICONS: Record<FaceIcon, typeof Mail> = {
  mail: Mail,
  plus: Plus,
  check: Check,
  pay: ArrowRight,
  reload: RotateCw,
  pen: PenLine,
  eye: Eye,
  cal: CalendarDays,
};

export function FaceIconMark({ icon, className }: { icon: FaceIcon; className?: string }) {
  const I = ICONS[icon];
  return <I aria-hidden className={className} strokeWidth={1.9} />;
}

/**
 * 👁 THE PUBLIC EVENT HUB, WITHOUT LEAVING HOME — a real new-tab link on the web (`target="_blank"`), routed through
 * `openEventHub` so the app shell can open its in-app browser instead.
 */
export function HubViewLink({
  url,
  className,
  label,
  children,
  marker,
  skip,
}: {
  url: string;
  className?: string;
  label: string;
  children: ReactNode;
  marker?: string;
  /** True when this press was really the end of a swipe — then it opens nothing. */
  skip?: () => boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={className}
      data-home-hub-view={marker ?? ''}
      onClick={(e) => {
        e.preventDefault();
        if (skip?.()) return;
        openEventHub(url);
      }}
    >
      {children}
    </a>
  );
}

/** ⟳ Reload — re-runs the page's reads (`router.refresh()`); never claims the read worked. */
function useReload(): () => void {
  const router = useContext(AppRouterContext);
  // one-render: keep (retry) — the person's Reload on a widget whose read failed; no write came before it.
  return useCallback(() => (router ? router.refresh() : window.location.reload()), [router]);
}

function TinyAction({ action, today }: { action: FaceAction; today?: boolean }) {
  const reload = useReload();
  const cls = `hc-tiny${action.main || today ? ' hc-tiny-main' : ''}${action.pill ? ' hc-tiny-pill' : ''}`;
  const inner = (
    <>
      <FaceIconMark icon={action.icon} />
      {action.pill ? <span>{action.label}</span> : null}
    </>
  );
  if (action.href === null) {
    return (
      <button type="button" className={cls} aria-label={action.label} onClick={reload} data-hc-act="" data-testid="home-tile-reload">
        {inner}
      </button>
    );
  }
  if (action.external) {
    return (
      <HubViewLink url={action.href} className={cls} label={action.label} marker="tile">
        {inner}
      </HubViewLink>
    );
  }
  return (
    <Link href={action.href} className={cls} aria-label={action.label} data-hc-act="">
      {inner}
    </Link>
  );
}

/* ─── The tile ────────────────────────────────────────────────────────────── */

/** The face's figure — counted to its value (`Count`, owner H2) when it is a number, its words when it is not. */
export function FaceFigure({ face }: { face: HomeFace }) {
  return face.count ? <Count value={face.count.value} format={face.count.format} id={`home-${face.id}`} /> : <>{face.big}</>;
}

function FaceBody({ face }: { face: HomeFace }) {
  const big = (
    <span className="hc-big">
      <FaceFigure face={face} />
      {face.unit ? <small> {face.unit}</small> : null}
    </span>
  );
  return (
    <>
      {typeof face.meter === 'number' ? (
        <span className="hc-row">
          {big}
          <span className="hc-thin" aria-hidden>
            <i style={{ width: `${Math.max(0, Math.min(100, face.meter))}%` }} />
          </span>
        </span>
      ) : (
        big
      )}
      <span className="hc-sm">{face.sm}</span>
    </>
  );
}

function readReduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function HomeTile({ model, eventId, stagger }: { model: HomeTileModel; eventId: string; /** this tile's place among the rotating tiles */ stagger: number }) {
  const faces = model.faces;
  const count = faces.length;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  // Timing lives in refs: the ticker writes the progress bar without a render.
  const t = useRef({ elapsed: 0, last: 0, wait: stagger * STAGGER_MS, restingUntil: 0, holding: false, onScreen: true, index: 0 });
  const drag = useRef<{ x0: number; dx: number; width: number; captured: boolean; id: number } | null>(null);
  const swiped = useRef(false);
  const storeKey = `sn_home_face_${eventId}_${model.key}`;
  const rotates = tileRotates({ faces: count, failed: model.failed, reducedMotion: reduced });

  const go = useCallback(
    (to: number, byHand: boolean) => {
      const next = ((to % count) + count) % count;
      t.current.index = next;
      t.current.elapsed = 0;
      if (byHand) t.current.restingUntil = performance.now() + RESUME_MS;
      setIndex(next);
      try {
        window.localStorage.setItem(storeKey, String(next));
      } catch {
        /* storage refused — the face is simply not remembered */
      }
    },
    [count, storeKey],
  );

  // The remembered face (after hydration, so the server's first face and the client's agree on the first paint).
  useEffect(() => {
    setReduced(readReduced());
    let mq: MediaQueryList | null = null;
    const onChange = () => setReduced(readReduced());
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onChange);
    } catch {
      /* no matchMedia — motion stays as drawn */
    }
    try {
      const saved = Number(window.localStorage.getItem(storeKey));
      if (Number.isInteger(saved) && saved > 0 && saved < count) {
        t.current.index = saved;
        setIndex(saved);
      }
    } catch {
      /* storage refused — start at the first face */
    }
    return () => mq?.removeEventListener('change', onChange);
  }, [count, storeKey]);

  // On screen? (IntersectionObserver, 40 %) — below md the grid is `display: none`, which reads as off screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) t.current.onScreen = e.isIntersecting;
    }, { threshold: VISIBLE_THRESHOLD });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The ticker — only for a tile that may rotate.
  useEffect(() => {
    if (!rotates) return;
    t.current.last = 0;
    return joinTicker((now) => {
      const s = t.current;
      const dt = s.last ? Math.min(250, now - s.last) : 0;
      s.last = now;
      if (tilePaused({ holding: s.holding, onScreen: s.onScreen, pageHidden: document.hidden, restingUntil: s.restingUntil, now })) return;
      if (s.wait > 0) {
        s.wait -= dt;
        return;
      }
      s.elapsed += dt;
      const bar = dots.current?.querySelector<HTMLElement>('[aria-current="true"]');
      if (bar) bar.style.setProperty('--p', String(Math.min(1, s.elapsed / FACE_MS)));
      if (s.elapsed >= FACE_MS) go(s.index + 1, false);
    });
  }, [rotates, go]);

  // A face change resets every dot's bar.
  useEffect(() => {
    dots.current?.querySelectorAll<HTMLElement>('[data-hc-dot]').forEach((d) => d.style.setProperty('--p', '0'));
  }, [index]);

  /* Swipe — a pointer that moves past 6 px is a swipe (captured from then on); under it, a tap. */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (e.target as HTMLElement).closest('[data-hc-act],[data-hc-dot]')) return;
    drag.current = { x0: e.clientX, dx: 0, width: root.current?.clientWidth || 1, captured: false, id: e.pointerId };
    t.current.holding = true;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.x0;
    if (!d.captured && Math.abs(d.dx) > TAP_PX) {
      d.captured = true;
      try {
        root.current?.setPointerCapture(d.id);
      } catch {
        /* capture refused — the swipe still tracks while over the tile */
      }
    }
    if (d.captured && track.current) {
      track.current.style.transition = 'none';
      track.current.style.transform = `translateX(calc(${-t.current.index * 100}% + ${d.dx}px))`;
    }
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    t.current.holding = false;
    if (!d) return;
    if (track.current) {
      track.current.style.transition = '';
      track.current.style.transform = '';
    }
    if (d.captured) {
      swiped.current = true;
      window.setTimeout(() => (swiped.current = false), 350);
      go(swipeLands({ index: t.current.index, faces: count, dx: d.dx, width: d.width }), true);
    } else {
      // A touch that is not a swipe still rests the tile (owner: resume after 8–10 s).
      t.current.restingUntil = performance.now() + RESUME_MS;
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(t.current.index + 1, true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(t.current.index - 1, true);
    }
  };
  const onDoorClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (swiped.current) e.preventDefault();
  };

  const face = faces[Math.min(index, count - 1)]!;
  const doorLabel = `${model.label ?? ''}${model.label ? ': ' : ''}${face.big}${face.unit ? ` ${face.unit}` : ''} — ${face.sm}`;
  const doorClass = 'hc-door';

  if (model.key === 'count') {
    return (
      <div className={`hc-tile hc-count${model.span ? ' hc-span' : ''}`} data-home-tile="count" data-home-tile-face={face.id} ref={root}>
        {model.today ? <span className="hc-chip">Today</span> : null}
        <span className="hc-cd" aria-hidden>
          <span className={`hc-cd-n${face.count ? '' : ' hc-cd-word'}`}>
            <FaceFigure face={face} />
          </span>
          {face.unit ? <span className="hc-cd-w">{face.unit}</span> : null}
          {face.sm ? <span className="hc-cd-d">{face.sm}</span> : null}
        </span>
        <Link href={face.href} className={doorClass} aria-label={`${face.big}${face.unit ? ` ${face.unit}` : ''}${face.sm ? ` — ${face.sm}` : ''}`} draggable={false} />
        {face.action ? (
          <span className="hc-acts">
            <TinyAction action={face.action} today={model.today} />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className={`hc-tile${model.span ? ' hc-span' : ''}${model.failed ? ' hc-bad' : ''}${count > 1 ? ' hc-swipe' : ''}${face.late ? ' hc-late' : ''}`}
      data-home-tile={model.key}
      data-home-tile-face={face.id}
      data-home-tile-rotates={rotates ? '' : undefined}
      data-home-tile-failed={model.failed ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {model.label ? <span className="hc-lab">{model.label}</span> : null}
      {model.today ? <span className="hc-chip">Today</span> : null}
      <div className="hc-faces">
        <div className="hc-track" ref={track} style={{ transform: `translateX(${-index * 100}%)` }} role="list" aria-label={`${model.label ?? model.key} — swipe for more`}>
          {faces.map((f, i) => (
            <div key={f.id} role="listitem" aria-hidden={i !== index} className={`hc-face${f.late ? ' hc-face-late' : ''}`} data-home-face={f.id} data-home-face-href={f.href}>
              <FaceBody face={f} />
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <div className="hc-dots" ref={dots}>
          {faces.map((f, i) => (
            <button
              key={f.id}
              type="button"
              data-hc-dot=""
              aria-current={i === index ? 'true' : undefined}
              aria-label={`Counter ${i + 1} of ${count}`}
              className={`hc-dot${i === index ? ' on' : ''}`}
              onClick={() => go(i, true)}
            />
          ))}
        </div>
      ) : null}
      {/* THE DOOR — a tap that is not a swipe opens the exact item of the face it lands on. */}
      {face.external ? (
        <HubViewLink url={face.href} className={doorClass} label={doorLabel} marker="face" skip={() => swiped.current}>
          {null}
        </HubViewLink>
      ) : (
        <Link href={face.href} className={doorClass} aria-label={doorLabel} onClick={onDoorClick} draggable={false} onDragStart={(e) => e.preventDefault()} />
      )}
      {model.side ? (
        <span className="hc-side">
          {model.side.map((a) => (
            <TinyAction key={a.label} action={a} />
          ))}
        </span>
      ) : face.action ? (
        <span className="hc-acts">
          <TinyAction action={face.action} today={model.today && face.action.main} />
        </span>
      ) : null}
    </div>
  );
}
