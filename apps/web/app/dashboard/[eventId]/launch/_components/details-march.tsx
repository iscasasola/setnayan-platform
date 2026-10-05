'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import {
  keyTarget,
  leadOf,
  planDrop,
  readSource,
  readTarget,
  type MarchPlan,
  type MarchSection,
  type MarchSource,
  type MarchStep,
} from '@/lib/march-drag';
import type { MarchResult } from '@/lib/march-result';
import { setEntourageLineOrder } from '../../guests/entourage-order-actions';
import { joinEntourageLine, swapEntouragePlaces } from '../../guests/march-actions';
import { unpairGuestAction } from '../../guests/pair-actions';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';

/**
 * THE WEDDING MARCH MAKER — drag the names (owner 2026-10-06, DECISION_LOG "THE
 * WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER — NOT A LIST OF NAMES";
 * prototype `prototypes/wedding_march_drag_maker_2026-10-06_fable.html`).
 *
 *   *"i don't need this to expand the names"* → the navigator shows ONE item;
 *   the lines are no longer its pieces. *"no need to the toolbar. we can just
 *   drag the names"* → no buttons, no ↑↓: every edit is a drag.
 *   *"the 2 columns that can drag names on both sides"* → two columns, the
 *   left and the right of the aisle; each walk one numbered row.
 *
 * What each drop means, and which SHIPPED action carries it, is
 * `lib/march-drag.ts` (pure, tested gesture by gesture). This file only lifts,
 * hit-tests, draws the drop at once, and sends the steps in order through
 * `makerSave` — one refresh per burst. A refused step puts the march back as
 * the server has it and says why.
 *
 * 📱 Touch: a long-press (~250 ms) lifts a name, so a plain swipe still
 * scrolls; the list auto-scrolls near its edges. Desktop: a 4 px drag lifts.
 * ⌨ Keyboard (no buttons are drawn for it): Space picks a name or a walk's
 * number up, Space on a name or an empty spot puts it there, ↑ / ↓ move it one
 * walk, Escape puts it back — every outcome said in a polite live region.
 *
 * ⚖ Pairs are NOT couples ("A WALK AND A COUPLE ARE INDEPENDENT"): nothing here
 * says one. The word is "walk alone", never "solo".
 *
 * ⏱ IT WRITES LIVE (the march is not part of the Event Hub draft): it says so
 * with `HubSavesImmediately`, and `data-writes-live` tells the guided flow's
 * Skip that nothing is left unsaved.
 */

export type MarchSectionData = MarchSection;

/** The words for a step nobody could carry out (a thrown action says nothing a person can act on). */
const DID_NOT_GO = 'That did not go through — nothing was changed.';
// no-card-ok: a NAME you drag (a pressable chip), not a container — its edge is what the finger picks up.
const NAME_CHIP = 'flex min-h-11 cursor-grab touch-pan-y select-none flex-col justify-center rounded-lg border px-2.5 py-1.5 transition-[box-shadow,opacity] duration-150 [-webkit-touch-callout:none]'; // no-card-ok: a draggable name chip
/** A refusal after part of the same move was saved. */
const partly = (reason: string) =>
  `${reason.replace(/\s*[—-]\s*nothing was changed\.?$/i, '.').replace(/\.\.$/, '.')} Part of the move was saved — the march shows where everyone is now.`;
const LAB_SAVED: MarchResult = { ok: true, written: 1 };
const LONG_PRESS_MS = 250;
const SETTLE_MS = 240;
const EDGE_PX = 56;

/** One shipped action per step — the only door to the server from this maker. */
async function callStep(eventId: string, step: MarchStep): Promise<MarchResult> {
  switch (step.kind) {
    case 'swap':
      return swapEntouragePlaces(eventId, step.section, step.a, step.b);
    case 'join':
      return joinEntourageLine(eventId, step.section, step.anchor, step.joiner);
    case 'order':
      return setEntourageLineOrder(eventId, step.section, step.leads);
    case 'unpair':
      /* "they walk alone, right behind it" — the Guest list's own unpair, in place
         (a refusal is THROWN in this mode; the catch below says it). */
      await unpairGuestAction(eventId, step.guest, 'in-place');
      return { ok: true, written: 1 };
  }
}

type Drag = {
  source: MarchSource;
  key: string;
  ghost: HTMLElement;
  ox: number;
  oy: number;
  x: number;
  y: number;
  scroller: HTMLElement;
  dir: number;
};

type Toast = { said: string; undo: MarchStep[] | null; before: MarchSection[] | null; refused?: boolean };

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The scroller's visible top and bottom — clamped to the screen (a tall box may run past it). */
function edgesOf(el: HTMLElement): [number, number] {
  const page = el === document.scrollingElement || el === document.documentElement;
  if (page) return [0, window.innerHeight];
  const r = el.getBoundingClientRect();
  return [Math.max(0, r.top), Math.min(window.innerHeight, r.bottom)];
}

/** The nearest box that scrolls the march — the body column, else the page. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * The march maker — the Wedding March item's page (Details › Your event).
 * `lab` (the dev Maker lab only): the steps are not sent, so the gestures can be
 * walked on fixture data with no database.
 */
export function MarchMaker({
  eventId,
  sections,
  lab = false,
}: {
  eventId: string;
  sections: readonly MarchSection[];
  lab?: boolean;
}) {
  /* The drop, drawn before the server answers; null = the server's march. */
  const [mine, setMine] = useState<MarchSection[] | null>(null);
  const shown = mine ?? (sections as MarchSection[]);
  const anyone = shown.length > 0;
  const [lifted, setLifted] = useState<string | null>(null);
  const [over, setOver] = useState<{ zone: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  /* ⌨ What the keyboard is holding, and what it last did (said aloud). */
  const [held, setHeld] = useState<{ source: MarchSource; key: string; name: string } | null>(null);
  const [heard, setHeard] = useState('');
  const refocus = useRef<string | null>(null);

  const root = useRef<HTMLElement>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const era = useRef(0);
  const flip = useRef<Map<string, DOMRect> | null>(null);
  const landing = useRef<{ ghost: HTMLElement; key: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The server's march came back (one refresh per burst): show it — unless
     more of this burst is still on its way. */
  useEffect(() => {
    if (inFlight.current === 0) setMine(null);
  }, [sections]);

  const say = useCallback((t: Toast | null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    if (t) toastTimer.current = setTimeout(() => setToast(null), t.refused ? 6000 : 4200);
  }, []);
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  /** Where every name and walk stands now — the start of the re-flow animation. */
  const measure = () => {
    const m = new Map<string, DOMRect>();
    root.current?.querySelectorAll<HTMLElement>('[data-march-flip]').forEach((el) => m.set(el.dataset.marchFlip!, el.getBoundingClientRect()));
    return m;
  };

  /**
   * Show `next` NOW, then send `steps` one after another (each re-reads the
   * march on the server, so they may not overlap). A refusal ends the burst:
   * what is still queued is dropped and the march goes back to the server's.
   */
  const commit = useCallback(
    (next: MarchSection[], steps: readonly MarchStep[], said: Toast) => {
      flip.current = measure();
      setMine(next);
      say(said);
      const mineEra = era.current;
      let landed = 0;
      for (const step of steps) {
        inFlight.current += 1;
        chain.current = chain.current
          .then(async () => {
          try {
            if (era.current !== mineEra) return;
            // The lab draws the drop and sends nothing; a thrown action is said in plain words.
            const r: MarchResult = await makerSave(
              () => (lab ? Promise.resolve(LAB_SAVED) : callStep(eventId, step).catch(() => ({ ok: false as const, reason: DID_NOT_GO }))),
              requestMakerRefresh,
            );
            if (r.ok) landed += 1;
            else if (era.current === mineEra) {
              era.current += 1;
              flip.current = measure();
              setMine(null);
              // Half a move is not "nothing changed": say what stands (the refresh draws it).
              say({ said: landed > 0 ? partly(r.reason) : r.reason, undo: null, before: null, refused: true });
            }
          } finally {
            inFlight.current -= 1;
          }
          })
          // A save that throws must never wedge the queue (every later step would wait forever).
          .catch(() => {});
      }
    },
    [eventId, lab, say],
  );

  const run = useCallback(
    (plan: MarchPlan | null) => {
      if (!plan) return;
      if (!plan.ok) {
        say({ said: plan.reason, undo: null, before: null, refused: true });
        return;
      }
      commit(plan.next, plan.steps, { said: plan.said, undo: plan.undo, before: shown });
    },
    [commit, say, shown],
  );

  const undo = () => {
    if (!toast?.undo?.length || !toast.before) return;
    commit(toast.before, toast.undo, { said: 'Put back', undo: null, before: null });
  };

  /* ── the re-flow (FLIP) and the ghost's landing, after the drop is drawn ── */
  useLayoutEffect(() => {
    if (refocus.current) {
      root.current?.querySelector<HTMLElement>(`[data-march-key="${CSS.escape(refocus.current)}"]`)?.focus({ preventScroll: false });
      refocus.current = null;
    }
    const was = flip.current;
    flip.current = null;
    const quiet = reduced();
    // Where the ghost lands — measured BEFORE the re-flow animations shift the boxes.
    const land = landing.current;
    landing.current = null;
    const home = land ? root.current?.querySelector<HTMLElement>(`[data-march-flip="${CSS.escape(land.key)}"]`) : null;
    const homeAt = home?.getBoundingClientRect() ?? null;
    if (was && !quiet) {
      root.current?.querySelectorAll<HTMLElement>('[data-march-flip]').forEach((el) => {
        const b = was.get(el.dataset.marchFlip!);
        if (!b) {
          el.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
          return;
        }
        const a = el.getBoundingClientRect();
        const dx = b.left - a.left;
        const dy = b.top - a.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
      });
    }
    if (!land) return;
    let once = false;
    const done = () => {
      if (once) return;
      once = true;
      land.ghost.remove();
      // Only clear the dim if no newer drag has lifted something since.
      setLifted((k) => (k === land.key && !drag.current ? null : k));
    };
    if (!homeAt || quiet) return done();
    const anim = land.ghost.animate(
      [{ transform: land.ghost.style.transform, opacity: 1 }, { transform: `translate(${homeAt.left}px,${homeAt.top}px)`, opacity: 0.2 }],
      { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    );
    anim.onfinish = done;
    // A hidden tab may never finish the animation.
    setTimeout(done, 320);
  });

  /* ── the drag ─────────────────────────────────────────────────────────── */
  const drag = useRef<Drag | null>(null);
  const pending = useRef<{ el: HTMLElement; source: MarchSource; key: string; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const raf = useRef(0);
  const target = useRef<string | null>(null);
  const [, redraw] = useState(0);
  /* The window listeners are stable wrappers around the latest handlers. */
  const onMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onUpRef = useRef<(e?: PointerEvent) => void>(() => {});
  const onCancelRef = useRef<() => void>(() => {});
  const moveL = useRef((e: PointerEvent) => onMoveRef.current(e));
  const upL = useRef((e: PointerEvent) => onUpRef.current(e));
  const cancelL = useRef(() => onCancelRef.current());

  /** What the finger is over: a drop zone (a name, an empty spot, a gap), or the nearest gap in its section. */
  const hit = useCallback(
    (d: Drag) => {
      const box = root.current;
      if (!box) return;
      let zone: string | null = null;
      for (const el of document.elementsFromPoint(d.x, d.y)) {
        if (!box.contains(el)) continue;
        const z = (el as HTMLElement).closest<HTMLElement>('[data-march-drop]');
        // A walk lands only in a gap; a name lands on a name, an empty spot or a gap.
        if (z && box.contains(z) && (d.source.kind === 'name' || z.dataset.marchDrop!.startsWith('gap|'))) {
          zone = z.dataset.marchDrop!;
          break;
        }
        // Over a walk or a heading but not on a zone: the nearest gap in that section.
        const sec = (el as HTMLElement).closest<HTMLElement>('[data-march-section]');
        if (sec) {
          let best: string | null = null;
          let bd = d.source.kind === 'walk' ? 80 : 40;
          sec.querySelectorAll<HTMLElement>('[data-march-drop^="gap|"]').forEach((g) => {
            const r = g.getBoundingClientRect();
            const dy = Math.abs(d.y - (r.top + r.height / 2));
            if (dy < bd) {
              bd = dy;
              best = g.dataset.marchDrop!;
            }
          });
          zone = best;
          break;
        }
      }
      const plan = zone ? planDrop(shown, d.source, readTarget(zone)!) : null;
      const next = plan ? zone : null;
      if (next === target.current) return;
      target.current = next;
      setOver(next && plan ? { zone: next, ok: plan.ok } : null);
    },
    [shown],
  );

  const stopAll = useCallback(() => {
    const p = pending.current;
    if (p?.timer) clearTimeout(p.timer);
    pending.current = null;
    cancelAnimationFrame(raf.current);
    window.removeEventListener('pointermove', moveL.current);
    window.removeEventListener('pointerup', upL.current);
    window.removeEventListener('pointercancel', cancelL.current);
  }, []);

  /* The latest hit-test (it reads the march as drawn NOW, not as it was at the lift). */
  const hitRef = useRef(hit);
  hitRef.current = hit;
  const loop = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    if (d.dir) {
      const [top, bottom] = edgesOf(d.scroller);
      const dist = d.dir < 0 ? top + EDGE_PX - d.y : d.y - (bottom - EDGE_PX);
      d.scroller.scrollTop += d.dir * Math.min(18, 4 + dist / 4);
      hitRef.current(d);
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const lift = useCallback(
    (x: number, y: number) => {
      const p = pending.current;
      if (!p || drag.current) return;
      const r = p.el.getBoundingClientRect();
      const ghost = p.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-march-flip');
      ghost.removeAttribute('data-march-drop');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        zIndex: '9999',
        pointerEvents: 'none',
        transform: `translate(${r.left}px,${r.top}px)`,
        boxShadow: '0 18px 34px -14px rgba(44,42,41,.55)',
        willChange: 'transform',
      });
      ghost.dataset.marchGhost = '';
      document.body.appendChild(ghost);
      drag.current = { source: p.source, key: p.key, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller: scrollerOf(p.el), dir: 0 };
      ghost.style.transform = `translate(${x - drag.current.ox}px,${y - drag.current.oy}px) scale(1.03)`;
      setLifted(p.key);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* no haptics here */
      }
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const p = pending.current;
      // One finger drags; a second one is ignored.
      if (!p || e.pointerId !== p.pid) return;
      if (!drag.current) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch) {
          // Moving before the long-press ends is a scroll — let it be one.
          if (moved > 8) stopAll();
          return;
        }
        if (moved > 4) lift(e.clientX, e.clientY);
        if (!drag.current) return;
      }
      e.preventDefault();
      const d = drag.current;
      d.x = e.clientX;
      d.y = e.clientY;
      d.ghost.style.transform = `translate(${d.x - d.ox}px,${d.y - d.oy}px) scale(1.03)`;
      hit(d);
      const [top, bottom] = edgesOf(d.scroller);
      d.dir = d.y < top + EDGE_PX && d.y > top - 40 ? -1 : d.y > bottom - EDGE_PX && d.y < bottom + 40 ? 1 : 0;
    },
    [hit, lift, stopAll],
  );

  const onUp = useCallback((e?: PointerEvent) => {
    if (e && pending.current && e.pointerId !== pending.current.pid) return;
    const d = drag.current;
    stopAll();
    if (!d) return;
    drag.current = null;
    const zone = target.current;
    target.current = null;
    setOver(null);
    const plan = zone ? planDrop(shown, d.source, readTarget(zone)!) : null;
    landing.current = { ghost: d.ghost, key: d.key };
    if (plan) run(plan);
    // Nowhere to go: one more paint, and the ghost settles back where it came from.
    else redraw((n) => n + 1);
  }, [run, shown, stopAll]);

  const onCancel = useCallback(() => {
    const d = drag.current;
    stopAll();
    drag.current = null;
    target.current = null;
    setOver(null);
    if (d) {
      d.ghost.remove();
      setLifted(null);
    }
  }, [stopAll]);

  useEffect(() => {
    onMoveRef.current = onMove;
    onUpRef.current = onUp;
    onCancelRef.current = onCancel;
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag.current || pending.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-march-drag]');
    if (!el || !root.current?.contains(el)) return;
    const source = readSource(el.dataset.marchDrag);
    if (!source) return;
    const key = source.kind === 'name' ? source.id : `walk:${source.lead}`;
    const touch = e.pointerType !== 'mouse';
    pending.current = { el, source, key, x: e.clientX, y: e.clientY, touch, pid: e.pointerId, timer: null };
    if (touch) pending.current.timer = setTimeout(() => lift(e.clientX, e.clientY), LONG_PRESS_MS);
    window.addEventListener('pointermove', moveL.current, { passive: false });
    window.addEventListener('pointerup', upL.current);
    window.addEventListener('pointercancel', cancelL.current);
  };
  /* 📱 While a name is lifted the page must not scroll under the finger (the
     edges auto-scroll instead). The listener is on the maker from the start,
     NOT added at the lift: a browser decides at touchstart whether anything may
     block its scroll, and a listener that arrives later is too late — the pan
     wins and the drag is cancelled. A touch keeps its first target, so every
     move of a drag that began here comes through here. */
  useEffect(() => {
    const box = root.current;
    const block = (e: TouchEvent) => {
      if (drag.current) e.preventDefault();
    };
    box?.addEventListener('touchmove', block, { passive: false });
    const move = moveL.current;
    const up = upL.current;
    const cancel = cancelL.current;
    return () => {
      // Leaving mid-drag (a Skip, a navigation): no ghost left on the page, no loop left running.
      cancelAnimationFrame(raf.current);
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null;
      drag.current?.ghost.remove();
      drag.current = null;
      box?.removeEventListener('touchmove', block);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    // Re-attached when the maker first has someone to draw (the empty state has no root).
  }, [anyone]);
  /** ⌨ The same drops, from the keyboard. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-march-toast]')) return;
    if (e.key === 'Escape' && held) {
      e.preventDefault();
      setHeld(null);
      setHeard(`${held.name} put back — nothing moved.`);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      if (held) {
        e.preventDefault();
        const zone = el.closest<HTMLElement>('[data-march-drop]')?.dataset.marchDrop;
        const plan = zone ? planDrop(shown, held.source, readTarget(zone)!) : null;
        setHeld(null);
        refocus.current = held.key;
        if (plan) run(plan);
        setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${held.name} put back — nothing moved.`);
        return;
      }
      const from = el.closest<HTMLElement>('[data-march-drag]');
      const source = readSource(from?.dataset.marchDrag);
      if (!from || !source) return;
      e.preventDefault();
      const name = from.dataset.marchName ?? '';
      setHeld({ source, key: from.dataset.marchKey ?? '', name });
      setHeard(`${name} picked up. Space on a name or an empty spot puts them there; arrow keys move them a walk; Escape puts them back.`);
      return;
    }
    if (held && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = keyTarget(shown, held.source, e.key === 'ArrowUp' ? -1 : 1);
      const plan = to ? planDrop(shown, held.source, to) : null;
      refocus.current = held.key;
      if (plan) run(plan);
      setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${held.name} cannot go further.`);
      // Still held: ↑ / ↓ again keeps moving it (a name keeps its id; a walk moved by ↑ / ↓ keeps its lead).
    }
  };

  if (!anyone) {
    return (
      <p className="mx-auto max-w-md text-sm text-ink/65" data-march-maker="">
        Nobody walks yet. Give a guest a role on their guest card — a sponsor, a bearer, the honour attendants — and
        they appear here in walking order.
      </p>
    );
  }

  const walks = shown.reduce((n, s) => n + s.rows.length, 0);
  const people = shown.reduce((n, s) => n + s.rows.reduce((k, r) => k + (r[0] ? 1 : 0) + (r[1] ? 1 : 0), 0), 0);
  const dragging = lifted !== null;
  const ring = (zone: string) =>
    over?.zone === zone ? (over.ok ? ' ring-2 ring-terracotta-700 ring-offset-1' : ' ring-2 ring-danger-500/60 ring-offset-1') : '';
  let step = 0;

  return (
    <section
      ref={root}
      data-march-maker=""
      data-writes-live=""
      aria-label="Wedding March — drag a name to move it"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      /* ♿ A screen reader's "activate" is a click with no pointer (detail 0):
         the same pick-up and drop as Space. A mouse drags instead. */
      onClick={(e) => {
        if (e.detail !== 0 || (e.target as HTMLElement).closest('[data-march-toast]')) return;
        if (!(e.target as HTMLElement).closest('[data-march-drag],[data-march-drop]')) return;
        onKeyDown({ ...e, key: ' ', target: e.target, preventDefault: () => e.preventDefault() } as unknown as ReactKeyboardEvent<HTMLElement>);
      }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-march-drag]')) e.preventDefault();
      }}
      onDragStart={(e) => e.preventDefault()}
      className={`mx-auto flex w-full max-w-2xl flex-col pb-6 ${dragging ? 'cursor-grabbing' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
        <p className="text-xs text-ink/60" data-march-count="">
          {walks} walk{walks === 1 ? '' : 's'} · {people} walking
        </p>
        <HubSavesImmediately />
      </div>
      <div aria-hidden className="grid grid-cols-[2rem_1fr_1fr] gap-1.5 px-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta-800">
        <span />
        <span className="text-center">Left</span>
        <span className="text-center">Right</span>
      </div>
      {shown.map((sec) => (
        <div key={sec.key} data-march-section={sec.key} className="flex flex-col">
          <p className="flex items-baseline gap-2 px-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/65">
            {sec.label}
            <small className="font-sans text-[11px] normal-case tracking-normal text-ink/50">
              {sec.rows.length} walk{sec.rows.length === 1 ? '' : 's'}
            </small>
          </p>
          <Gap zone={`gap|${sec.key}|0`} on={over?.zone === `gap|${sec.key}|0`} ok={over?.ok ?? true} />
          {sec.rows.map((row, i) => {
            step += 1;
            const lead = leadOf(row);
            const walkKey = `walk:${lead}`;
            return (
              <div key={lead || i} className="flex flex-col">
                <div
                  data-march-flip={walkKey}
                  data-march-walk={step}
                  className={`grid grid-cols-[2rem_1fr_1fr] items-stretch gap-1.5 rounded-xl bg-white p-1.5 ring-1 ring-ink/10 transition-opacity ${lifted === walkKey ? 'opacity-30' : ''}`}
                >
                  <span
                    data-march-drag={`walk|${sec.key}|${lead}`}
                    data-march-key={walkKey}
                    data-march-name={row.filter((x) => x !== null).map((x) => x!.name).join(' and ')}
                    tabIndex={0}
                    role="button"
                    aria-pressed={held?.key === walkKey}
                    aria-label={`Step ${step} — drag to move this walk`}
                    className="flex min-h-11 cursor-grab touch-pan-y select-none items-center justify-center font-serif text-xl text-terracotta-800 [-webkit-touch-callout:none]"
                  >
                    {step}
                  </span>
                  {[0, 1].map((c) => {
                    const p = row[c as 0 | 1];
                    if (p) {
                      const zone = `name|${p.id}`;
                      return (
                        <div
                          key={p.id || c}
                          data-march-flip={p.id}
                          data-march-drop={zone}
                          data-march-drag={p.id ? `name|${p.id}` : undefined}
                          data-march-key={p.id}
                          data-march-name={p.name}
                          tabIndex={p.id ? 0 : undefined}
                          role="button"
                          aria-pressed={held?.key === p.id}
                          data-march-side={c === 0 ? 'left' : 'right'}
                          aria-label={`${p.name}${p.tag ? `, ${p.tag}` : ''} — step ${step}, ${c === 0 ? 'left' : 'right'}`}
                          className={`${NAME_CHIP} ${
                            p.tag ? 'border-terracotta-700/60 bg-white' : 'border-terracotta-700/20 bg-terracotta-700/[0.06]'
                          } ${lifted === p.id ? 'border-dashed opacity-30' : ''}${held?.key === p.id ? ' ring-2 ring-ink ring-offset-1' : ''}${ring(zone)}`}
                        >
                          <span className="font-serif text-[15.5px] leading-tight text-ink [overflow-wrap:anywhere]">{p.name}</span>
                          {p.tag ? (
                            <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-terracotta-800">{p.tag}</span>
                          ) : null}
                        </div>
                      );
                    }
                    const anchor = row[c === 0 ? 1 : 0];
                    const zone = `beside|${anchor?.id ?? ''}`;
                    return (
                      <div
                        key={`empty-${c}`}
                        data-march-drop={anchor?.id ? zone : undefined}
                        tabIndex={anchor?.id && held ? 0 : undefined}
                        role={anchor?.id ? 'button' : undefined}
                        aria-label={anchor ? `Walk beside ${anchor.name}` : undefined}
                        className={`flex min-h-11 items-center justify-center rounded-lg border-[1.5px] border-dashed px-2 text-center text-[11px] leading-tight transition-colors ${
                          dragging ? 'border-terracotta-700/40 text-terracotta-800' : 'border-ink/15 text-ink/50'
                        }${ring(zone)}`}
                      >
                        {dragging || held ? 'walk together' : 'walks alone'}
                      </div>
                    );
                  })}
                </div>
                <Gap zone={`gap|${sec.key}|${i + 1}`} on={over?.zone === `gap|${sec.key}|${i + 1}`} ok={over?.ok ?? true} />
              </div>
            );
          })}
        </div>
      ))}
      <p aria-live="polite" className="sr-only" data-march-heard="">
        {heard}
      </p>
      {toast ? (
        <div
          role="status"
          data-march-toast={toast.refused ? 'refused' : 'done'}
          className="fixed inset-x-3 bottom-[calc(var(--maker-lt-h,0px)+12px)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-3.5 py-2.5 text-sm text-cream shadow-lg lg:bottom-4"
        >
          <span className="min-w-0 flex-1">{toast.said}</span>
          {toast.undo ? (
            <button type="button" onClick={undo} data-march-undo="" className="min-h-9 shrink-0 rounded-full bg-cream/15 px-3.5 text-sm font-semibold">
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** The gap between two walks — a gold line where the drop would land. */
function Gap({ zone, on, ok }: { zone: string; on: boolean; ok: boolean }) {
  return (
    <div data-march-drop={zone} aria-hidden className={`relative mx-1 transition-[height] duration-200 ${on ? 'h-5' : 'h-2.5'}`}>
      <span
        className={`absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-opacity duration-150 ${
          on ? (ok ? 'bg-terracotta-700 opacity-100' : 'bg-danger-500/60 opacity-100') : 'opacity-0'
        }`}
      />
    </div>
  );
}
