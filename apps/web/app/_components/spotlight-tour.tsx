'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SpotlightStep, SpotlightFinale, TourKey } from '@/lib/tours';
import { formatCount } from '@/lib/format-number';
import { missingGroups, nextKept, spotlightCount } from '@/lib/spotlight-drops';
import { Wordmark } from './brand-marks';
import { freeBandFrom, ringFor, tipFor, type Bar, type Box, type Rect } from '@/lib/spotlight-geometry';

/**
 * 🔦 THE SPOTLIGHT TOUR — the approved look, copied from the corpus sample
 * `prototypes/spotlight_tour_sample_2026-10-02.html` (owner, 2026-10-02: "Yes. That is good.";
 * DECISION_LOG "THE SPOTLIGHT TOUR LOOK IS APPROVED").
 *
 * The screen dims, a white pulsing ring GLIDES (~0.75 s ease) from button to button — across
 * pages too, because the mount sits in the role layout, which survives a client navigation — a
 * hand shows where to tap, and a tip card pops in with "Step N of M", a progress bar, Skip and
 * Next. The person may tap the lit button themselves: it is the REAL button (the four blockers
 * around the hole leave it uncovered), so the real thing happens and the tour moves on. At the
 * end: confetti and "You're set". Reduced motion turns the motion off.
 *
 * NEVER the old centred step card (`GuidedTourCard`) — those stay off (`lib/tip-popups.ts`).
 *
 * 📦 This file is the LAZY half. `spotlight-mount.tsx` loads it with `React.lazy` only when a
 * tour is due or the ⓘ asks for it, so a page whose tour is done never downloads it — and the
 * Maker's first load never carries it (`scripts/check-maker-js-budget.mjs`).
 *
 * ANCHORS. A step names a stable `data-tour="…"` on the real element. The first VISIBLE,
 * UNCOVERED match is lit. When the current step's element is not on this screen (another page,
 * a sheet over it), the dim lifts and the tour waits — it comes back the moment the element is
 * there. If it stays away while a LATER step's element is on screen, the tour skips ahead to
 * that one (a host who already made their event never meets "Create your event").
 *
 * 🚪 A MISSING DOORWAY TAKES ITS PAGE WITH IT (owner 2026-10-22, `lib/spotlight-drops.ts`). While the page a step
 * belongs to IS on screen, a step of it that is not drawn after DROP_GRACE_MS is dropped — a doorway with the page
 * behind it — and "Step N of M" is counted from what is left; nothing left goes to the finale. A Simple event's
 * hidden Guests and Suppliers tabs used to leave the journey sitting silent on Home, on every visit.
 */

const PROGRESS = 'setnayan.spotlight.';
/** How long the current step's element may be missing before a later visible step is taken. */
const GRACE_MS = 1400;
const TICK_MS = 350;
/** After a tap on a lit LINK, how long the tour waits for the next page before it gives up waiting. */
const NAV_WAIT_MS = 15000;
/** How long a step of the page on screen may be missing before it is dropped — longer than GRACE_MS, so a part
    that streams in (a lazy piece, a Suspense boundary) arrives first. */
const DROP_GRACE_MS = 3000;

/** The address a tap on this element walks to, when it is (inside) a link to another page. */
function linkTarget(el: Element): string | null {
  const a = el.closest('a[href]') as HTMLAnchorElement | null;
  if (!a) return null;
  try {
    const to = new URL(a.href, location.href);
    return to.pathname + to.search !== location.pathname + location.search ? to.href : null;
  } catch {
    return null;
  }
}

function readProgress(key: string): number {
  try {
    const v = window.localStorage.getItem(PROGRESS + key);
    const n = v == null ? 0 : Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function writeProgress(key: string, i: number | null): void {
  try {
    if (i == null) window.localStorage.removeItem(PROGRESS + key);
    else window.localStorage.setItem(PROGRESS + key, String(i));
  } catch {
    /* private mode — the tour simply starts over next time */
  }
}

/** Our own layers — and Next's dev-only overlay badge, which never ships but would "cover" a tab in a lab. */
function isOurs(el: Element | null): boolean {
  return !!el?.closest('[data-sn-spot], nextjs-portal');
}

/** The safe-area insets, read once from a probe (env() is not readable from script directly). */
function safeInsets(): { top: number; bottom: number } {
  const p = document.createElement('div');
  p.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(p);
  const cs = getComputedStyle(p);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  p.remove();
  return out;
}

/**
 * The band of the screen no fixed or sticky bar covers — so a ring is never drawn under the top
 * bar, the bottom bar or the home indicator. The rule is `freeBandFrom` (`lib/spotlight-geometry.ts`);
 * this reads, for each bar, whether it holds the target, whether it is PAINTED (the Maker is a
 * full-screen sheet over the app's own sticky top bar — a bar nobody can see is no obstacle; the
 * 2026-10-23 thin ring under Apply), and whether the target is drawn over it.
 */
function freeBand(target: Element, insets: { top: number; bottom: number }): { top: number; bottom: number } {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const t = target.getBoundingClientRect();
  const targetOnTop = target instanceof HTMLElement && onTop(target);
  const bars: Bar[] = [];
  document.querySelectorAll('header, nav, [data-bottom-dock], .shell-topbar').forEach((b) => {
    if (isOurs(b)) return;
    const pos = getComputedStyle(b).position;
    if (pos !== 'fixed' && pos !== 'sticky') return;
    const r = b.getBoundingClientRect();
    const overlaps = r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom;
    bars.push({
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      holds: b.contains(target),
      painted: painted(b, r, vw, vh),
      under: overlaps && targetOnTop,
    });
  });
  return freeBandFrom(bars, vw, vh, insets);
}

/** Is any of the bar the top-most thing where it sits? A bar that takes no taps cannot be asked — it counts. */
function painted(b: Element, r: DOMRect, vw: number, vh: number): boolean {
  if (getComputedStyle(b).pointerEvents === 'none') return true;
  const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
  const x0 = Math.max(r.left, 0);
  const x1 = Math.min(r.right, vw);
  if (x1 <= x0 || y < r.top || y > r.bottom) return false;
  return [0.25, 0.5, 0.75].some((f) => {
    const hit = document.elementsFromPoint(x0 + (x1 - x0) * f, y).find((n) => !isOurs(n));
    return !!hit && (hit === b || b.contains(hit));
  });
}

/** The element is the thing on top at its own centre (or holds it). */
function onTop(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const hit = document.elementsFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 22)).find((n) => !isOurs(n));
  return !!hit && (el === hit || el.contains(hit) || hit.contains(el));
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function candidates(anchor: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour~="${CSS.escape(anchor)}"]`));
}

/**
 * The first match that is drawn (has a size and is not hidden by CSS) — the INNERMOST one when a match
 * holds another: the Next card carries its step's token and so does its main button, so the button is lit
 * when there is one and the whole card when the card's button is a different kind (Reload, Buy more).
 */
function drawn(anchor: string): HTMLElement | null {
  const all = candidates(anchor);
  for (const el of all.filter((c) => !all.some((o) => o !== c && c.contains(o) && isDrawn(o)))) {
    if (isDrawn(el)) return el;
  }
  return null;
}

function isDrawn(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el);
  return !(cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0);
}

/** Is the element's centre actually it on screen — not under a sheet, a bar or off the edge? */
function uncovered(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + Math.min(r.height / 2, 22);
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
  /* A line that is not a tap target (`pointer-events: none`, the Maker's "Tap anything to change it") is never the
     answer to a hit test, so it would read as covered for ever; on screen is all it can be. */
  if (getComputedStyle(el).pointerEvents === 'none') return true;
  const hit = document.elementsFromPoint(x, y).find((n) => !isOurs(n));
  return !!hit && (el === hit || el.contains(hit) || hit.contains(el));
}

function inBand(el: HTMLElement, band: { top: number; bottom: number }): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= band.top + 4 && r.bottom <= band.bottom - 4;
}

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const HAND =
  'M9 11V5.5a1.5 1.5 0 0 1 3 0V10l.5-.1a1.5 1.5 0 0 1 2 1.2l.1.4a1.5 1.5 0 0 1 2.4.9V13a1.4 1.4 0 0 1 2.5.9v2.6c0 3-2.4 5.5-5.4 5.5h-1.4a5.5 5.5 0 0 1-4.6-2.5L5.4 15a1.4 1.4 0 0 1 2.2-1.8L9 14.6';

/* The sample's own CSS, scoped to `.sn-spot-*`. Colours come from the --m-* family so the tip
   card turns dark with the page (`html.dark`); the dim and the white ring are the same in both. */
const CSS_TEXT = `
.sn-spot-ring{position:fixed;z-index:2147483001;border-radius:var(--m-r-full,999px);box-shadow:0 0 0 9999px rgba(15,17,21,.64);outline:3px solid #fff;outline-offset:4px;transition:all .75s cubic-bezier(.65,0,.35,1);pointer-events:none}
.sn-spot-ring::after{content:"";position:absolute;inset:-10px;border-radius:inherit;border:2px solid rgba(255,255,255,.6);animation:sn-spot-pulse 1.6s ease-out infinite}
@keyframes sn-spot-pulse{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.2)}}
.sn-spot-block{position:fixed;z-index:2147483000;touch-action:none}
.sn-spot-tip{position:fixed;z-index:2147483003;left:16px;width:min(420px,calc(100% - 32px));background:var(--m-paper,#fff);color:var(--m-ink,#1e2229);border-radius:var(--m-r-lg,22px);padding:14px 16px;box-shadow:0 14px 36px rgba(0,0,0,.28);transition:top .5s cubic-bezier(.2,.8,.2,1),left .5s cubic-bezier(.2,.8,.2,1),opacity .2s}
.sn-spot-tip.pop{animation:sn-spot-pop .45s cubic-bezier(.2,1.4,.4,1)}
@keyframes sn-spot-pop{from{opacity:0;transform:translateY(10px) scale(.94)}}
.sn-spot-brand{margin-bottom:8px}
.sn-spot-step{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--m-orange,#A9834B);margin-bottom:2px}
.sn-spot-tip h4{margin:0 0 4px;font-size:17px;font-weight:600;line-height:1.3}
.sn-spot-tip p{margin:0 0 12px;font-size:14px;line-height:1.4;color:var(--m-slate,#3a3e45)}
.sn-spot-hint{font-size:13px;color:var(--m-mulberry,#C24E25);font-weight:600;margin:-6px 0 10px}
.sn-spot-row{display:flex;justify-content:space-between;align-items:center}
.sn-spot-prog{height:4px;border-radius:var(--m-r-xs,4px);background:var(--m-line,#efe9df);flex:1;margin:0 12px;overflow:hidden}
.sn-spot-prog i{display:block;height:100%;background:var(--m-mulberry,#C24E25);transition:width .5s}
.sn-spot-skip{background:none;border:0;color:var(--m-slate-2,#6b6f76);font:inherit;font-size:14px;min-height:44px;padding:0 4px;cursor:pointer}
.sn-spot-go{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:var(--m-r-full,999px);font:inherit;font-weight:600;font-size:14px;border:0;background:var(--m-ink,#1e2229);color:var(--m-paper,#fff);cursor:pointer}
.sn-spot-finger{position:fixed;z-index:2147483002;width:34px;height:34px;pointer-events:none;opacity:0;transition:left .8s cubic-bezier(.2,.8,.2,1),top .8s cubic-bezier(.2,.8,.2,1),opacity .3s}
.sn-spot-finger.tap{animation:sn-spot-tap .9s ease-in-out infinite}
@keyframes sn-spot-tap{50%{transform:scale(.8)}}
.sn-spot-done{position:fixed;inset:0;z-index:2147483004;display:flex;align-items:center;justify-content:center;background:rgba(15,17,21,.6);padding:16px}
.sn-spot-done .sn-spot-tip{position:static;text-align:center;width:100%;max-width:420px}
.sn-spot-confetti{position:fixed;inset:0;z-index:2147483005;pointer-events:none;overflow:hidden}
.sn-spot-confetti i{position:absolute;top:-12px;width:8px;height:12px;border-radius:var(--m-r-xs,4px);animation:sn-spot-fall 1.8s ease-in forwards}
@keyframes sn-spot-fall{to{transform:translateY(110vh) rotate(540deg);opacity:.2}}
@media (prefers-reduced-motion:reduce){.sn-spot-ring,.sn-spot-ring::after,.sn-spot-tip,.sn-spot-finger,.sn-spot-prog i,.sn-spot-confetti i{animation:none!important;transition:none!important}.sn-spot-confetti{display:none}}
`;

const CONFETTI = ['#b8934a', '#6e2a3a', '#fff', '#e8c88a', '#c97b8d'];

export function SpotlightTour({
  tourKey,
  steps,
  finale,
  record,
  restart,
  name = null,
  completeAction,
  onClose,
  inMaker = false,
}: {
  tourKey: TourKey;
  steps: ReadonlyArray<SpotlightStep>;
  /** Mounted INSIDE the Maker (its own tour, or a page drawn in it): the Maker pause is not for this one. */
  inMaker?: boolean;
  /** The person's display name — a welcome step's "Welcome, {name}". */
  name?: string | null;
  finale: SpotlightFinale;
  /** First visit: finishing or skipping writes `users.tour_seen_keys` (the shipped `completeTour`). The ⓘ replays with false. */
  record: boolean;
  /** Start from step 1 instead of where the person stopped (the ⓘ). */
  restart: boolean;
  completeAction: (tourKey: TourKey) => Promise<void>;
  onClose: () => void;
}) {
  const [i, setI] = useState<number>(() => (restart ? 0 : Math.min(readProgress(tourKey), steps.length - 1)));
  const [box, setBox] = useState<Box | null>(null);
  const [tipAt, setTipAt] = useState<{ left: number; top: number; width: number }>({ left: 16, top: 0, width: 0 });
  const [finger, setFinger] = useState<{ x: number; y: number; on: boolean; tap: boolean }>({ x: 0, y: 0, on: false, tap: false });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  /** The step whose element is lit right now (−1: none) — the tip and the hand belong to it. */
  const [litFor, setLitFor] = useState(-1);
  const tipRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const missingSince = useRef<number | null>(null);
  /** A lit link was pressed: the page it opens has not arrived yet (never skip ahead meanwhile). */
  const navPending = useRef<{ from: string; at: number } | null>(null);
  const lastHref = useRef<string>('');
  const scrolledFor = useRef<number>(-1);
  const insets = useRef<{ top: number; bottom: number }>({ top: 0, bottom: 0 });
  const keyboardRef = useRef(false);
  const iRef = useRef(i);
  iRef.current = i;
  /** Steps dropped because their page is on screen without them (`lib/spotlight-drops.ts`). */
  const [dropped, setDropped] = useState<ReadonlySet<number>>(() => new Set());
  const droppedRef = useRef(dropped);
  droppedRef.current = dropped;
  /** When each missing group's first step was first seen missing on this page. */
  const dropSince = useRef(new Map<number, number>());

  useEffect(() => {
    insets.current = safeInsets();
  }, []);

  const finish = useCallback(() => {
    setBox(null);
    setDone(true);
    writeProgress(tourKey, null);
    if (record) {
      /* 📵 The tour is already ending: a record that could not be written (no signal, a 5xx) must not take
         the page with it. It is simply offered once more on the next visit. */
      completeAction(tourKey).catch(() => {});
    }
  }, [completeAction, record, tourKey]);

  const advance = useCallback(
    (wait: number) => {
      setBusy(true);
      setFinger((f) => ({ ...f, on: false, tap: false }));
      window.setTimeout(() => {
        setBusy(false);
        const next = nextKept(steps, iRef.current, droppedRef.current);
        if (next === null) {
          finish();
          return;
        }
        writeProgress(tourKey, next);
        missingSince.current = null;
        setI(next);
      }, wait);
    },
    [finish, steps, tourKey],
  );

  /* Find, scroll and light the current step's element — every tick, so the ring follows a page that
     moves under it and comes back when a sheet closes or the person returns to that page. */
  const place = useCallback(() => {
    if (done || busy) return;
    /* The Maker is a full-screen editor with its own first-visit welcome: the journey waits
       under it and comes back the moment the host exits. */
    if (!inMaker && document.querySelector('[data-maker-shell]')) {
      targetRef.current = null;
      setBox(null);
      setLitFor(-1);
      missingSince.current = null;
      return;
    }
    const step = steps[iRef.current];
    if (!step) return;
    // A new page: its elements get the full grace to arrive before anything is skipped.
    if (location.href !== lastHref.current) {
      lastHref.current = location.href;
      missingSince.current = null;
      navPending.current = null;
      dropSince.current.clear();
    }
    // A lit link was pressed and its page is still on its way (a slow phone): hold the ring, skip nothing.
    if (navPending.current && Date.now() - navPending.current.at < NAV_WAIT_MS) {
      targetRef.current = null;
      setLitFor(-1);
      return;
    }
    navPending.current = null;

    /* 🚪 The page on screen is missing a step — or a doorway, and so the page behind it: drop them, once each has
       stayed away DROP_GRACE_MS, and count from what is left. */
    {
      const now = Date.now();
      const groups = missingGroups(steps, iRef.current, droppedRef.current, (j) => drawn(steps[j]!.anchor) !== null);
      const firsts = new Set(groups.map((g) => g[0]!));
      for (const k of [...dropSince.current.keys()]) if (!firsts.has(k)) dropSince.current.delete(k);
      const ripe: number[] = [];
      for (const g of groups) {
        const since = dropSince.current.get(g[0]!);
        if (since === undefined) dropSince.current.set(g[0]!, now);
        else if (now - since > DROP_GRACE_MS) ripe.push(...g);
      }
      if (ripe.length > 0) {
        const next = new Set(droppedRef.current);
        for (const j of ripe) next.add(j);
        droppedRef.current = next;
        setDropped(next);
        if (next.has(iRef.current)) {
          const to = nextKept(steps, iRef.current, next);
          if (to === null) {
            finish();
            return;
          }
          missingSince.current = null;
          writeProgress(tourKey, to);
          setI(to);
          return;
        }
      }
    }

    let el = drawn(step.anchor);
    if (el && !isFixedInside(el) && scrolledFor.current !== iRef.current) {
      const band = freeBand(el, insets.current);
      if (!inBand(el, band)) {
        scrolledFor.current = iRef.current;
        /* Taller than the room between the bars: its TOP comes into view (centred, both ends were off screen and it
           read as covered for ever). */
        const tall = el.getBoundingClientRect().height > band.bottom - band.top - 16;
        el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: prefersReduced() ? 'auto' : 'smooth' });
        return; // measure on the next tick, once the scroll has settled
      }
      scrolledFor.current = iRef.current;
    }
    if (el && !uncovered(el)) el = null;
    /* One padding on every side, the outline on screen and out of the bars (`ringFor`, lib/spotlight-geometry.ts).
       Nothing left to light (a line under a bar) is a MISSING step — it waits or is skipped, never an empty ring. */
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const band = el ? freeBand(el, insets.current) : null;
    const ring = el && band ? ringFor(rectOf(el), vw, band) : null;
    if (!ring) el = null;

    if (!el || !ring || !band) {
      targetRef.current = null;
      setLitFor(-1);
      const now = Date.now();
      if (missingSince.current == null) missingSince.current = now;
      /* Within the grace the ring HOLDS where it was (the next page is still arriving), so it glides on
         from there when the element appears — across pages, as the sample's did. After it, the dim lifts. */
      if (now - missingSince.current > GRACE_MS) setBox(null);
      if (now - missingSince.current > GRACE_MS) {
        // Skip ahead to a later step whose element IS on this screen.
        for (let j = iRef.current + 1; j < steps.length; j++) {
          if (droppedRef.current.has(j)) continue;
          const later = drawn(steps[j]!.anchor);
          if (later && uncovered(later)) {
            missingSince.current = null;
            writeProgress(tourKey, j);
            setI(j);
            break;
          }
        }
      }
      return;
    }
    missingSince.current = null;
    targetRef.current = el;
    setLitFor(iRef.current);
    setBox((b) => (b && b.x === ring.x && b.y === ring.y && b.w === ring.w && b.h === ring.h ? b : ring));

    // The card beside its ring — under, over or next to it, never parked at the top of a wide screen.
    const tip = tipFor(ring, { h: tipRef.current?.offsetHeight ?? 190 }, vw, window.innerHeight, band, insets.current);
    setTipAt((p) => (p.left === tip.left && p.top === tip.top && p.width === tip.width ? p : tip));
  }, [busy, done, finish, inMaker, steps, tourKey]);

  useEffect(() => {
    place();
    const t = window.setInterval(place, TICK_MS);
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', onResize);
    };
  }, [place]);

  // A newly lit step: the tip pops in, focus moves to Next, the hand glides in and taps.
  const boxRef = useRef(box);
  boxRef.current = box;
  useEffect(() => {
    const box = boxRef.current;
    if (litFor < 0 || !box) return;
    const tip = tipRef.current;
    if (tip) {
      tip.classList.remove('pop');
      void tip.offsetWidth;
      tip.classList.add('pop');
    }
    /* Focus follows only a KEYBOARD walk (Next pressed with Enter / Space): on a phone a moved focus
       draws the focus ring on Next for no reason. */
    if (keyboardRef.current) goRef.current?.focus({ preventScroll: true });
    setFinger({ x: box.x + box.w + 30, y: box.y + box.h + 40, on: false, tap: false });
    const a = window.setTimeout(() => setFinger({ x: box.x + box.w / 2 - 6, y: box.y + box.h / 2 - 4, on: true, tap: false }), 700);
    const b = window.setTimeout(() => setFinger((f) => ({ ...f, tap: true })), 1500);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [litFor]);

  /* The person taps the lit button themselves: the real thing happens, then the tour moves on. Listened
     for on the document (capture), so a button the page re-draws mid-step is still heard. */
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    if (litFor < 0) return;
    const onTap = (e: MouseEvent) => {
      const el = targetRef.current;
      if (busyRef.current || !el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      if (linkTarget(el)) navPending.current = { from: location.href, at: Date.now() };
      // Record where they are first — a tap that navigates must still resume on the next step.
      writeProgress(tourKey, nextKept(steps, iRef.current, droppedRef.current) ?? iRef.current);
      advance(450);
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, [advance, litFor, steps, tourKey]);

  // Escape skips, as the old card did.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (done ? onClose : finish)();
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') keyboardRef.current = true;
    };
    const onPointer = () => {
      keyboardRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [done, finish, onClose]);

  const onNext = () => {
    if (busy) return;
    const step = steps[i];
    const el = targetRef.current;
    if (step?.go && el) {
      // A doorway (a tab, a link): Next walks there, as the sample's Next did.
      el.click();
      return; // the click listener above advances
    }
    advance(0);
  };

  const step = steps[i];
  const style = <style>{CSS_TEXT}</style>;
  /* 👋 A welcome step is not one of the steps, nor is a dropped one: "Step N of M" counts what is left. */
  const { n: shownN, of: counted } = spotlightCount(steps, i, dropped);
  const last = nextKept(steps, i, dropped) === null;
  const title = step?.welcome
    ? name?.trim()
      ? step.title.replace('{name}', name.trim())
      : step.title.replace(/,?\s*\{name\}/, '')
    : step?.title;

  if (done) {
    return toBody(
      <div data-sn-spot="">
        {style}
        <div className="sn-spot-done" role="dialog" aria-labelledby="sn-spot-done-title">
          <div className="sn-spot-tip pop">
            <div className="sn-spot-step">Done</div>
            <h4 id="sn-spot-done-title">{finale.title}</h4>
            <p>{finale.body}</p>
            <button type="button" className="sn-spot-go" onClick={onClose} autoFocus>
              {finale.button}
            </button>
          </div>
        </div>
        <Confetti />
      </div>,
    );
  }

  if (!box || !step) return null;

  const blocks: CSSProperties[] = [
    { left: 0, top: 0, right: 0, height: box.y },
    { left: 0, top: box.y + box.h, right: 0, bottom: 0 },
    { left: 0, top: box.y, width: box.x, height: box.h },
    { left: box.x + box.w, top: box.y, right: 0, height: box.h },
  ];

  return toBody(
    <div data-sn-spot="">
      {style}
      {blocks.map((b, n) => (
        <div key={n} className="sn-spot-block" style={b} aria-hidden onClick={(e) => e.stopPropagation()} />
      ))}
      <div
        className="sn-spot-ring"
        aria-hidden
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r }}
      />
      <svg
        className={`sn-spot-finger${finger.tap ? ' tap' : ''}`}
        viewBox="0 0 24 24"
        aria-hidden
        style={{ left: finger.x, top: finger.y, opacity: finger.on && !busy && litFor === i ? 1 : 0 }}
      >
        <path fill="#fff" stroke="#1e2229" strokeWidth="1.2" d={HAND} />
      </svg>
      <div
        ref={tipRef}
        className="sn-spot-tip"
        role="dialog"
        aria-live="polite"
        aria-labelledby="sn-spot-title"
        style={{ top: tipAt.top, left: tipAt.left, width: tipAt.width || undefined, opacity: busy || litFor !== i ? 0 : 1 }}
      >
        {step.welcome ? (
          /* The mark, larger — this once (prototype P4). */
          <div className="sn-spot-brand" data-spot-welcome="">
            <Wordmark size={18} color="var(--m-ink,#1e2229)" />
          </div>
        ) : null}
        <div className="sn-spot-step">
          {step.welcome ? 'Welcome' : `Step ${formatCount(shownN)} of ${formatCount(counted)}`}
        </div>
        <h4 id="sn-spot-title">{title}</h4>
        <p>{step.body}</p>
        {step.welcome ? null : <div className="sn-spot-hint">{step.hint ?? 'Tap it yourself — or press Next'}</div>}
        <div className="sn-spot-row">
          <button type="button" className="sn-spot-skip" onClick={finish}>
            Skip
          </button>
          <div className="sn-spot-prog" aria-hidden>
            <i style={{ width: `${(Math.max(1, shownN) / Math.max(1, counted)) * 100}%` }} />
          </div>
          <button ref={goRef} type="button" className="sn-spot-go" onClick={onNext} disabled={busy}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
  );
}

/**
 * 🧭 The layers are drawn on <body>, never where the mount sits: `position: fixed` is measured from the nearest
 * ancestor with a transform, a filter, `contain` or `will-change` — a page slide, a frosted panel, the Maker's own
 * frame — and the ring lands off its button by however far that ancestor sits from the screen's corner. On <body> the
 * screen is the one box the ring, the blockers, the card and `getBoundingClientRect()` all agree on.
 */
function toBody(node: ReactNode): ReactNode {
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

/** A bottom tab or a top-bar button: it does not scroll into view, it is already there. An element in a box that
    scrolls INSIDE a fixed one (a Studio tool's editor in the Maker) does scroll — its own box moves it. */
function isFixedInside(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (n !== el && /auto|scroll/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return false;
    if (cs.position === 'fixed' || cs.position === 'sticky') return true;
  }
  return false;
}

function Confetti() {
  const [bits] = useState(() =>
    Array.from({ length: 70 }, (_, n) => ({
      left: `${Math.random() * 100}%`,
      background: CONFETTI[n % CONFETTI.length],
      animationDelay: `${Math.random() * 0.6}s`,
      animationDuration: `${1.4 + Math.random()}s`,
    })),
  );
  return (
    <div className="sn-spot-confetti" aria-hidden>
      {bits.map((s, n) => (
        <i key={n} style={s} />
      ))}
    </div>
  );
}
