'use client';

/**
 * guest-map-canvas.tsx — THE MAP IS THE SCREEN (Maker PR 4f · G22, G38, G39;
 * owner 2026-10-07: *"fix this page to be minimal as possible. this has too much
 * text and the map will take up the whole screen"* · *"full width"* · *"pinch"* ·
 * *"no background for map"* · *"extend map until here"*).
 *
 * One canvas at EVERY width (the old phone tree, `MobileTree`, and the old
 * two-tab lens are retired): the couple at the centre-left → the branches of
 * the map's own arrange dropdown (By side · By role · By RSVP · By group — Side
 * nests each side's groups) → the guests as leaves with their reply mark,
 * joined by curved links. Tap a guest to open their card.
 *
 *   · no card, no hint above it — the canvas starts under the counts and runs
 *     down to the bottom bar (`height` is measured, not guessed);
 *   · edge to edge — it breaks out of the page's side padding;
 *   · no background of its own;
 *   · the first open FITS the whole map (scale 0.6–1.8, centred);
 *   · pinch on a phone, ctrl / trackpad-pinch wheel on a computer (0.5–2.5).
 *
 * The layout is the prototype's: every leaf gets a row, a parent sits centred
 * over its children (`layoutMap`, pure, exported for the guard).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { guestDisplayName, type GuestRow } from '@/lib/guests';
import type { MapBranch } from '@/lib/guest-roster-view';
import styles from './guests-screen.module.css';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type MapNode =
  | { kind: 'root'; label: string; depth: 0; y: number }
  | { kind: 'branch'; label: string; count: number; depth: number; y: number; top: boolean }
  | { kind: 'leaf'; guest: GuestRow; depth: number; y: number };

/** Place every node: leaves one row each, parents centred over their children. */
export function layoutMap(
  rootLabel: string,
  tree: readonly MapBranch[],
  phone: boolean,
): { nodes: MapNode[]; links: [number, number][]; width: number; height: number; colX: number[] } {
  const ROW = phone ? 40 : 44;
  const colX = phone ? [12, 150, 300, 470] : [24, 190, 400, 620];
  const nodes: MapNode[] = [];
  const links: [number, number][] = [];
  let row = 0;
  const leafAt = (g: GuestRow, depth: number) => {
    const i = nodes.push({ kind: 'leaf', guest: g, depth, y: row * ROW + 40 }) - 1;
    row++;
    return i;
  };
  const place = (b: MapBranch, depth: number): number => {
    const kidIdx = [...b.kids.map((k) => place(k, depth + 1)), ...b.guests.map((g) => leafAt(g, depth + 1))];
    const ys = kidIdx.map((i) => nodes[i]!.y);
    const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : row * ROW + 40;
    const count = b.guests.length + b.kids.reduce((n, k) => n + k.guests.length, 0);
    const idx = nodes.push({ kind: 'branch', label: b.label, count, depth, y, top: depth === 1 }) - 1;
    for (const k of kidIdx) links.push([idx, k]);
    return idx;
  };
  const top = tree.map((b) => place(b, 1));
  const ys = top.map((i) => nodes[i]!.y);
  const rootIdx =
    nodes.push({ kind: 'root', label: rootLabel, depth: 0, y: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 40 }) - 1;
  for (const t of top) links.push([rootIdx, t]);
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return {
    nodes,
    links,
    width: (colX[Math.min(maxDepth, colX.length - 1)] ?? 470) + (phone ? 200 : 260),
    height: Math.max(row, 1) * ROW + 80,
    colX,
  };
}

const REPLY_MARK: Record<GuestRow['rsvp_status'], { mark: string; cls: string; word: string }> = {
  attending: { mark: '✓', cls: 'pillOk', word: 'attending' },
  pending: { mark: '…', cls: 'pillMute', word: 'no reply' },
  maybe: { mark: '?', cls: 'pillWine', word: 'maybe' },
  declined: { mark: '✕', cls: 'pillMute', word: 'not coming' },
};

export function GuestMapCanvas({
  rootLabel,
  tree,
  isToInvite,
  onOpen,
  fitKey,
}: {
  rootLabel: string;
  tree: readonly MapBranch[];
  isToInvite: (g: GuestRow) => boolean;
  onOpen: (guestId: string, el: HTMLElement) => void;
  /** Changes when the arrangement changes — the map re-fits. */
  fitKey: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const zoomRef = useRef(1);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const sync = () => setPhone(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  const map = useMemo(() => layoutMap(rootLabel, tree, phone), [rootLabel, tree, phone]);

  // ── The canvas runs from its top down to the bottom bar ("extend map until here").
  useIso(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const dock = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sn-bottomdock-h')) || 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = Math.max(320, window.innerHeight - top - dock);
      el.style.height = `${h}px`;
      setBox((prev) => (prev && prev.w === el.clientWidth && prev.h === h ? prev : { w: el.clientWidth, h }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── First open (and every new arrangement) FITS the whole map, 0.6–1.8.
  useIso(() => {
    if (!box) return;
    const lower = (document.querySelector('[data-guests-thumb]') as HTMLElement | null)?.offsetHeight ?? 0;
    const fit = Math.min(1.8, Math.max(0.6, Math.min((box.w - 24) / map.width, (box.h - lower - 24) / map.height)));
    zoomRef.current = fit;
    setZoom(fit);
    if (wrap.current) {
      wrap.current.scrollTop = 0;
      wrap.current.scrollLeft = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, box?.w, box?.h, map.width, map.height]);

  // ── Pinch (two fingers) and ctrl / trackpad-pinch wheel, 0.5–2.5.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let pinch: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const set = (z: number) => {
      const next = Math.min(2.5, Math.max(0.5, z));
      zoomRef.current = next;
      setZoom(next);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      set((pinch.z * dist(e.touches)) / pinch.d);
    };
    const onEnd = () => {
      pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      set(zoomRef.current * (e.deltaY < 0 ? 1.08 : 0.92));
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const z = zoom ?? 1;
  const W = map.width;
  const H = map.height;
  const lowerH = 70;
  const ml = box ? Math.max(12, (box.w - W * z) / 2) : 12;
  const mt = box ? Math.max(12, (box.h - lowerH - H * z) / 2) : 12;
  const nodeX = (n: MapNode) => map.colX[Math.min(n.depth, map.colX.length - 1)] ?? 0;
  const linkStartX = (n: MapNode) =>
    nodeX(n) + (n.kind === 'root' ? (phone ? 100 : 120) : n.kind === 'branch' && n.top ? (phone ? 120 : 150) : phone ? 110 : 130);

  return (
    <div ref={wrap} className={styles.mapwrap} data-guest-map="" data-map-zoom={z.toFixed(2)}>
      <div
        className={styles.mapcanvas}
        style={{
          width: W,
          height: H,
          transform: `scale(${z})`,
          marginLeft: ml,
          marginTop: mt,
          marginRight: Math.max(12, W * (z - 1) + 12),
          marginBottom: Math.max(12, H * (z - 1) + 12 + lowerH),
          visibility: zoom === null ? 'hidden' : undefined,
        }}
      >
        <svg className={styles.links} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {map.links.map(([a, b]) => {
            const A = map.nodes[a]!;
            const B = map.nodes[b]!;
            const x1 = linkStartX(A);
            const x2 = nodeX(B);
            const mx = (x1 + x2) / 2;
            return <path key={`${a}-${b}`} d={`M${x1} ${A.y} C${mx} ${A.y} ${mx} ${B.y} ${x2} ${B.y}`} />;
          })}
        </svg>
        {map.nodes.map((n, i) => {
          const style = { left: nodeX(n), top: n.y, animationDelay: `${Math.min(600, i * 18)}ms` };
          if (n.kind === 'root') {
            return (
              <span key="root" className={`${styles.node} ${styles.nodeRoot}`} style={style} data-map-root="">
                {n.label}
              </span>
            );
          }
          if (n.kind === 'branch') {
            return (
              <span
                key={`b-${i}`}
                className={`${styles.node} ${n.top ? styles.nodeSide : styles.nodeGrp}`}
                style={style}
                data-map-branch=""
              >
                {n.label} <span className={styles.mute}>· {n.count}</span>
              </span>
            );
          }
          const g = n.guest;
          const toInvite = isToInvite(g) && g.rsvp_status === 'pending';
          const r = REPLY_MARK[g.rsvp_status];
          const tone = toInvite
            ? ''
            : g.rsvp_status === 'attending'
              ? styles.leafYes
              : g.rsvp_status === 'pending'
                ? styles.leafNone
                : g.rsvp_status === 'declined'
                  ? styles.leafNo
                  : '';
          const name = guestDisplayName(g);
          return (
            <button
              key={g.guest_id}
              type="button"
              className={`${styles.node} ${tone}`}
              style={style}
              onClick={(e) => onOpen(g.guest_id, e.currentTarget)}
              aria-label={`${name} — ${toInvite ? 'to invite' : r.word}`}
              data-map-leaf=""
            >
              <span
                aria-hidden
                className={`${styles.dot} ${g.side === 'bride' ? styles.sideBride : g.side === 'groom' ? styles.sideGroom : styles.sideBoth}`}
              />
              {name}
              <span aria-hidden className={`${styles.pill} ${toInvite ? styles.pillGold : styles[r.cls]}`}>
                {toInvite ? '✉' : r.mark}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
