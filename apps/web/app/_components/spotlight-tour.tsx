'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SpotlightStep, SpotlightFinale, TourKey } from '@/lib/tours';
import { formatCount } from '@/lib/format-number';
import { Wordmark } from './brand-marks';

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
 */

const PROGRESS = 'setnayan.spotlight.';
/** How long the current step's element may be missing before a later visible step is taken. */
const GRACE_MS = 1400;
const TICK_MS = 350;
/** After a tap on a lit LINK, how long the tour waits for the next page before it gives up waiting. */
const NAV_WAIT_MS = 15000;

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

type Box = { x: number; y: number; w: number; h: number; r: string };

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
 * bar, the bottom bar or the home indicator. A bar that CONTAINS the target (a bottom tab) is
 * not an obstacle for that target.
 */
function freeBand(target: Element, insets: { top: number; bottom: number }): { top: number; bottom: number } {
  const H = window.innerHeight;
  let top = insets.top;
  let bottom = H - insets.bottom;
  const bars = document.querySelectorAll('header, nav, [data-bottom-dock], .shell-topbar');
  bars.forEach((b) => {
    if (isOurs(b) || b.contains(target)) return;
    const pos = getComputedStyle(b).position;
    if (pos !== 'fixed' && pos !== 'sticky') return;
    const r = b.getBoundingClientRect();
    if (r.height < 1 || r.height > H / 2 || r.width < window.innerWidth / 2) return;
    if (r.top <= H / 3 && r.bottom > top) top = Math.min(r.bottom, H / 3);
    else if (r.bottom >= (H * 2) / 3 && r.top < bottom) bottom = Math.max(r.top, (H * 2) / 3);
  });
  return { top, bottom };
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
.sn-spot-tip{position:fixed;z-index:2147483003;left:16px;right:16px;margin:0 auto;max-width:420px;background:var(--m-paper,#fff);color:var(--m-ink,#1e2229);border-radius:var(--m-r-lg,22px);padding:14px 16px;box-shadow:0 14px 36px rgba(0,0,0,.28);transition:top .5s cubic-bezier(.2,.8,.2,1),opacity .2s}
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
.sn-spot-done .sn-spot-tip{position:static;text-align:center;width:100%}
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
}: {
  tourKey: TourKey;
  steps: ReadonlyArray<SpotlightStep>;
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
  const [tipTop, setTipTop] = useState<number>(0);
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
        const cur = iRef.current;
        if (cur >= steps.length - 1) {
          finish();
          return;
        }
        writeProgress(tourKey, cur + 1);
        missingSince.current = null;
        setI(cur + 1);
      }, wait);
    },
    [finish, steps.length, tourKey],
  );

  /* Find, scroll and light the current step's element — every tick, so the ring follows a page that
     moves under it and comes back when a sheet closes or the person returns to that page. */
  const place = useCallback(() => {
    if (done || busy) return;
    /* The Maker is a full-screen editor with its own first-visit welcome: the journey waits
       under it and comes back the moment the host exits. */
    /* …and the cookie question comes first: it sits over the bottom of the screen, and a tour drawn over
       it would hide the one thing the person must answer. One thing at a time. */
    if (document.querySelector('[data-maker-shell], [data-cookie-consent]')) {
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
    }
    // A lit link was pressed and its page is still on its way (a slow phone): hold the ring, skip nothing.
    if (navPending.current && Date.now() - navPending.current.at < NAV_WAIT_MS) {
      targetRef.current = null;
      setLitFor(-1);
      return;
    }
    navPending.current = null;
    let el = drawn(step.anchor);
    if (el && !isFixedInside(el) && scrolledFor.current !== iRef.current) {
      const band = freeBand(el, insets.current);
      if (!inBand(el, band)) {
        scrolledFor.current = iRef.current;
        el.scrollIntoView({ block: 'center', behavior: prefersReduced() ? 'auto' : 'smooth' });
        return; // measure on the next tick, once the scroll has settled
      }
      scrolledFor.current = iRef.current;
    }
    if (el && !uncovered(el)) el = null;

    if (!el) {
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

    const band = freeBand(el, insets.current);
    const r = el.getBoundingClientRect();
    const pad = 8;
    let y = r.top - pad;
    let h = r.height + pad * 2;
    // Keep the ring (and its 7 px outline) inside the free band — never under a bar or the home indicator.
    const minTop = band.top + 8;
    const maxBottom = band.bottom - 8;
    if (y < minTop) {
      h -= minTop - y;
      y = minTop;
    }
    if (y + h > maxBottom) h = Math.max(24, maxBottom - y);
    const x = Math.max(8, r.left - pad);
    const w = Math.min(window.innerWidth - 8 - x, r.width + pad * 2);
    const next: Box = { x, y, w, h, r: h > 70 ? 'var(--m-r-lg,22px)' : 'var(--m-r-full,999px)' };
    setBox((b) => (b && b.x === x && b.y === y && b.w === w && b.h === h ? b : next));

    const tipH = tipRef.current?.offsetHeight ?? 190;
    const below = y + h + 20;
    const above = y - 20 - tipH;
    const top =
      below + tipH <= band.bottom - 12 || above < band.top + 12
        ? Math.min(below, window.innerHeight - insets.current.bottom - tipH - 12)
        : above;
    setTipTop(Math.max(insets.current.top + 12, top));
  }, [busy, done, steps, tourKey]);

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
      writeProgress(tourKey, Math.min(iRef.current + 1, steps.length - 1));
      advance(450);
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, [advance, litFor, steps.length, tourKey]);

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
  /* 👋 A welcome step is not one of the steps: "Step N of M" counts the others only. */
  const counted = steps.filter((s) => !s.welcome).length;
  const shownN = steps.slice(0, i + 1).filter((s) => !s.welcome).length;
  const title = step?.welcome
    ? name?.trim()
      ? step.title.replace('{name}', name.trim())
      : step.title.replace(/,?\s*\{name\}/, '')
    : step?.title;

  if (done) {
    return (
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
      </div>
    );
  }

  if (!box || !step) return null;

  const blocks: CSSProperties[] = [
    { left: 0, top: 0, right: 0, height: box.y },
    { left: 0, top: box.y + box.h, right: 0, bottom: 0 },
    { left: 0, top: box.y, width: box.x, height: box.h },
    { left: box.x + box.w, top: box.y, right: 0, height: box.h },
  ];

  return (
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
        style={{ top: tipTop, opacity: busy || litFor !== i ? 0 : 1 }}
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
        {step.welcome ? null : <div className="sn-spot-hint">Tap it yourself — or press Next</div>}
        <div className="sn-spot-row">
          <button type="button" className="sn-spot-skip" onClick={finish}>
            Skip
          </button>
          <div className="sn-spot-prog" aria-hidden>
            <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
          </div>
          <button ref={goRef} type="button" className="sn-spot-go" onClick={onNext} disabled={busy}>
            {i === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A bottom tab or a top-bar button: it does not scroll into view, it is already there. */
function isFixedInside(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === 'fixed' || p === 'sticky') return true;
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
