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
 * 🧠 R4 slice 10 (owner, Guests prototype v12–v18): the drawing is the MIND MAP — the couple in the centre, the ⇅ Group
 * by's groups as hubs on one ring (≤ 6; the rest fold into "Other groups · N", which opens into its own map, "‹ All
 * groups" back), each hub's people as faces around it (10 at most; "+N more" opens the hub alone), one hub alone shows
 * everyone. Layout: `lib/guest-mind-map.ts` (pure). A face peeks (`onOpen`). The measure, the fit and the pinch below
 * are the shipped canvas's, unchanged. (`lib/guest-map-layout.ts`'s tree stays for its own guard; nothing draws it.)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { guestDisplayName, type GuestRow } from '@/lib/guests';
import { formatCount } from '@/lib/format-number';
import { ChevronLeft } from 'lucide-react';
import type { MapBranch, PlusOneWords } from '@/lib/guest-roster-view';
import { COUPLE_R, FACE_R, HUB_R, faceInitials, facePos, mindMapBounds, mindMapHubs, type MindDrill } from '@/lib/guest-mind-map';
import styles from './guests-screen.module.css';
import { displayPersonName } from '@/lib/person-name-case';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  plusWords,
}: {
  rootLabel: string;
  tree: readonly MapBranch[];
  isToInvite: (g: GuestRow) => boolean;
  /** 🤝 Whose +1 each +1 is — an unnamed seat is named by its guest, as on the List (`plusOneWordsFrom`). */
  plusWords?: ReadonlyMap<string, PlusOneWords>;
  onOpen: (guestId: string, el: HTMLElement) => void;
  /** Changes when the arrangement changes — the map re-fits. */
  fitKey: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [drill, setDrill] = useState<MindDrill | null>(null);
  const [hubSel, setHubSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const zoomRef = useRef(1);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // A new arrangement (or list) starts at the whole map again.
  useEffect(() => {
    setDrill(null);
    setHubSel(null);
  }, [fitKey]);
  const hubs = useMemo(() => mindMapHubs(tree, drill), [tree, drill]);
  const bounds = useMemo(() => mindMapBounds(hubs), [hubs]);
  const map = { width: bounds.width, height: bounds.height };

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
  }, [fitKey, box?.w, box?.h, map.width, map.height, drill]);

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
  // World → canvas: the couple at (0, 0) sits at (-minX, -minY).
  const X = (x: number) => x - bounds.minX;
  const Y = (y: number) => y - bounds.minY;
  const many = hubs.length > 1;
  return (
    <div ref={wrap} className={styles.mapwrap} data-guest-map="" data-map-zoom={z.toFixed(2)} data-mind-map="">
      {/* ‹ Back to every group, after opening "Other" or a hub's "+N more". */}
      {drill ? (
        <button type="button" className={styles.mindBack} onClick={() => setDrill(null)} data-mind-back="">
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          All groups
        </button>
      ) : null}
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
        <svg className={styles.links} viewBox={`0 0 ${W} ${H}`} aria-hidden data-mind-links="">
          {hubs.map((h) => (
            <g key={h.key}>
              {many ? <line x1={X(0)} y1={Y(0)} x2={X(h.x)} y2={Y(h.y)} /> : null}
              {h.shown.map((g, i) => {
                const p = facePos(h, i);
                return <line key={g.guest_id} x1={X(h.x)} y1={Y(h.y)} x2={X(p.x)} y2={Y(p.y)} />;
              })}
            </g>
          ))}
        </svg>
        {/* The couple in the centre (more than one hub). */}
        {many ? (
          <span
            className={styles.mindCouple}
            style={{ left: X(0), top: Y(0), width: COUPLE_R * 2, height: COUPLE_R * 2 }}
            data-map-root=""
          >
            {rootLabel}
          </span>
        ) : null}
        {hubs.map((h) => (
          <span key={`hub-${h.key}`}>
            <button
              type="button"
              className={`${styles.mindHub} ${hubSel === h.key ? styles.mindHubOn : ''} ${h.isOther ? styles.mindOther : ''}`}
              style={{ left: X(h.x), top: Y(h.y), width: HUB_R * 2, height: HUB_R * 2 }}
              aria-pressed={h.isOther ? undefined : hubSel === h.key}
              aria-label={`${h.label} · ${formatCount(h.guests.length)}${h.isOther ? ' — open them' : ''}`}
              onClick={() => {
                if (h.isOther && h.keys) {
                  setHubSel(null);
                  setDrill({ kind: 'other', keys: h.keys });
                } else setHubSel((s) => (s === h.key ? null : h.key));
              }}
              data-mind-hub={h.key}
            >
              {formatCount(h.guests.length)}
            </button>
            <span className={styles.mindLabel} style={{ left: X(h.x), top: Y(h.y + h.ext + 14) }} aria-hidden>
              {h.label}
            </span>
            {h.more > 0 ? (
              <button
                type="button"
                className={styles.mindMore}
                style={{ left: X(h.x), top: Y(h.y + h.ext + 36) }}
                onClick={() => {
                  setHubSel(null);
                  setDrill({ kind: 'hub', key: h.key });
                }}
                data-mind-more={h.key}
              >
                +{formatCount(h.more)} more
              </button>
            ) : null}
            {h.shown.map((g, i) => {
              const p = facePos(h, i);
              const toInvite = isToInvite(g) && g.rsvp_status === 'pending';
              const r = REPLY_MARK[g.rsvp_status];
              const words = plusWords?.get(g.guest_id);
              const name = words?.name ?? displayPersonName(guestDisplayName(g));
              const side = words?.side ?? g.side;
              return (
                <button
                  key={g.guest_id}
                  type="button"
                  className={`${styles.mindFace} ${side === 'bride' ? styles.sideBride : side === 'groom' ? styles.sideGroom : styles.sideBoth} ${
                    toInvite ? '' : g.rsvp_status === 'attending' ? styles.leafYes : g.rsvp_status === 'declined' ? styles.leafNo : styles.leafNone
                  }`}
                  style={{ left: X(p.x), top: Y(p.y), width: FACE_R * 2, height: FACE_R * 2 }}
                  onClick={(e) => onOpen(g.guest_id, e.currentTarget)}
                  aria-label={`${name}${words?.of ? `, ${words.of}` : ''} — ${toInvite ? 'to invite' : r.word}`}
                  data-map-leaf=""
                  data-plus-one-of={words?.hostId}
                >
                  {faceInitials(g)}
                </button>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
