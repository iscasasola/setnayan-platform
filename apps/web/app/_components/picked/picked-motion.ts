/**
 * 🎬 THE PICKED PAGE'S MOTION — open rises from the tapped row, close is the exact reverse (B1 step 5, spec §0.6:
 * open/close the rise (700 ms since 10 Nov), close = exact reverse, no jump > 40 px, no pause > 90 ms; reduced motion = a 120 ms fade).
 *
 * The list row records WHERE it was tapped (its rect) and WHICH list it was (the URL) just before the soft
 * navigation; the shell reads it once on mount. A hard load (Today, a notification, a typed URL) finds nothing and
 * simply appears — and its ✕ goes to the Clients list instead of `history.back()`, which could leave the app.
 *
 * The numbers are L1's ONE rise (`lib/rise-motion.ts` — 700 ms, its ease, the 120 ms reduced fade), read here at
 * integration so the picked client and every other rise move alike; this file keeps the origin bookkeeping.
 *
 * 🪞 ONE MOTION, BOTH SIDES (Supplier Build 3 · Lane A, 9 Nov 2026). The supplier's picked client and the host's
 * picked supplier both open through `PickedShell` (`./picked-shell.tsx`) with these frames. Which lists a page may
 * have been opened FROM is the caller's (`readPickedOrigin(path, from)`): the supplier's Clients and Chats, the host's
 * Chats — a stale origin from any other list is ignored.
 */
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';

export const PICKED_OPEN_MS = RISE_MS;
export const PICKED_EASE = RISE_EASE;
export const PICKED_FADE_MS = RISE_REDUCED_MS;
/** §10 #26 (owner 8 Nov: "make the animation run 0.7 seconds"): 700 ms, 44 px, this ease, opacity full at 45 %. */
export const PICKED_PAGE_SLIDE_MS = 700;
export const PICKED_PAGE_SLIDE_EASE = 'cubic-bezier(.33,1,.68,1)';

const KEY = 'sn:picked-client-origin';

export type PickedOrigin = {
  /** The list URL the client was opened from (path + query). */
  from: string;
  /** The client opened (`/vendor-dashboard/clients/<id>`), so a stale origin for another client is ignored. */
  to: string;
  rect: { top: number; left: number; width: number; height: number } | null;
  at: number;
};

/** Called by a list row on tap, before the soft navigation. Never throws (private mode, blocked storage). */
export function rememberPickedOrigin(row: Element | null, to: string): void {
  try {
    const r = row?.getBoundingClientRect();
    const o: PickedOrigin = {
      from: `${window.location.pathname}${window.location.search}`,
      to,
      rect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
      at: Date.now(),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable — the client simply appears, and ✕ goes to the list */
  }
}

/** The lists the supplier's picked client opens over: Clients, and the envelope's Chats (Build 3 ✉️). */
export const SUPPLIER_PICKED_LISTS: readonly string[] = ['/vendor-dashboard/customers', '/vendor-dashboard/messages'];

/** The origin for THIS page, if it was opened from one of `from` (list path prefixes) in the last half hour. */
export function readPickedOrigin(eventPath: string, from: readonly string[] = SUPPLIER_PICKED_LISTS): PickedOrigin | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PickedOrigin;
    if (!o || typeof o.from !== 'string' || typeof o.to !== 'string') return null;
    if (!o.to.startsWith(eventPath) || Date.now() - o.at > 60_000 * 30) return null;
    if (!from.some((prefix) => o.from.startsWith(prefix))) return null;
    return o;
  } catch {
    return null;
  }
}

export function forgetPickedOrigin(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}

/** `clip-path` that frames the row's rect inside the viewport — the open's first frame and the close's last. */
export function rectClip(rect: PickedOrigin['rect']): string {
  if (!rect || typeof window === 'undefined') return 'inset(0 0 0 0 round 0px)';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, vw - (rect.left + rect.width));
  const bottom = Math.max(0, vh - (rect.top + rect.height));
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 14px)`;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The ONE open motion, as frames + timing: the close plays these same frames with `direction: 'reverse'`, so it is
 * the exact reverse by construction (spec §0.6). Reduced motion → a 120 ms fade. A hard load (no tapped row) → no
 * motion at all: the client simply appears, and ✕ simply leaves.
 */
export function pickedMotion(
  origin: PickedOrigin | null,
): { frames: Keyframe[]; timing: KeyframeAnimationOptions } | null {
  if (prefersReducedMotion()) {
    return { frames: [{ opacity: 0 }, { opacity: 1 }], timing: { duration: PICKED_FADE_MS, easing: 'linear' } };
  }
  if (!origin?.rect) return null;
  return {
    frames: [{ clipPath: rectClip(origin.rect) }, { clipPath: 'inset(0 0 0 0 round 0px)' }],
    timing: { duration: PICKED_OPEN_MS, easing: PICKED_EASE },
  };
}
