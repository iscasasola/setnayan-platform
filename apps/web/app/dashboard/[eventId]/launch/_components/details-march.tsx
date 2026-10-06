'use client';

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { reportCrash } from '@/lib/telemetry/report-crash';
import { isMarchOnlyGroup } from '@/lib/entourage';
import {
  acrossTheAisle,
  keyTarget,
  leadOf,
  planMove,
  planSectionsDefault,
  readSource,
  sectionsMoved,
  readTarget,
  type MarchMove,
  type MarchOut,
  type MarchSection,
  type MarchSource,
  type MarchStep,
} from '@/lib/march-drag';
import type { MarchResult } from '@/lib/march-result';
import { setEntourageLineOrder } from '../../guests/entourage-order-actions';
import { joinEntourageLine, moveEntourageSection, resetEntourageSections, setMarchWalking, swapEntouragePlaces } from '../../guests/march-actions';
import { MarchTray } from './details-march-tray';
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
/* Stable empties: a fresh `[]` default every render would look like a new march from the server each time. */
const NO_NAMES: readonly string[] = [];
const NO_OUT: readonly MarchOut[] = [];
const LAB_NO_RENDER = () => {};
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
    case 'section':
      return moveEntourageSection(eventId, step.section, step.direction);
    case 'sections-default':
      return resetEntourageSections(eventId);
    case 'walking':
      return setMarchWalking(eventId, step.guest, step.walks);
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

/** What the maker shows: the walks, the printed sections' saved order (what a header drag steps through), the tray. */
type Shown = { sections: MarchSection[]; printed: string[]; out: MarchOut[] };
type Toast = { said: string; undo: MarchStep[] | null; before: Shown | null; refused?: boolean };

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

type MarchMakerProps = {
  eventId: string;
  sections: readonly MarchSection[];
  /** The printed sections with someone in them, in the saved order (`printedSectionOrder`). */
  printed?: readonly string[];
  /** 🚶 The "Not walking" tray (`marchTray`); null = it could not be read. */
  out?: readonly MarchOut[] | null;
  lab?: boolean;
};

/**
 * 🧯 THE MARCH FAILS ALONE (controller 2026-10-06, after the owner's Maker went to
 * the root crash card on the march — "Something on our end didn't work"). A
 * throw inside the march draws ONE line in its own place — "The march couldn't
 * load — Retry" — and every other part of the Maker stays where it was. Retry
 * draws the march again from the server's copy (`requestMakerRefresh`). The
 * failure is still recorded (`reportCrash`, boundary "march"), so a quiet
 * fallback never becomes a silent one.
 */
export class MarchBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    reportCrash(error, 'march');
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p role="alert" data-march-failed="" className="mx-auto max-w-md text-sm text-ink/70">
        The march couldn’t load —{' '}
        <button
          type="button"
          data-march-retry=""
          onClick={() => {
            this.setState({ failed: false });
            requestMakerRefresh();
          }}
          className="min-h-9 font-semibold text-terracotta-800 underline underline-offset-2"
        >
          Retry
        </button>
      </p>
    );
  }
}

/**
 * The march maker — the Wedding March item's page (Details › Your event).
 * `lab` (the dev Maker lab only): the steps are not sent, so the gestures can be
 * walked on fixture data with no database. Inside its own boundary (`MarchBoundary`).
 */
export function MarchMaker(props: MarchMakerProps) {
  return (
    <MarchBoundary>
      <MarchMakerBody {...props} />
    </MarchBoundary>
  );
}

function MarchMakerBody({
  eventId,
  sections,
  printed = NO_NAMES,
  out = NO_OUT,
  lab = false,
}: MarchMakerProps) {
  /* The drop, drawn before the server answers; null = the server's march. */
  const [mine, setMine] = useState<Shown | null>(null);
  const shown = mine?.sections ?? (sections as MarchSection[]);
  const shownPrinted = mine?.printed ?? (printed as string[]);
  const outUnread = out === null;
  const shownOut = useMemo(() => mine?.out ?? ((out ?? []) as MarchOut[]), [mine, out]);
  const anyone = shown.length > 0 || shownOut.length > 0;
  /* 🚶 THE TRAY LIVES IN THE EDITOR'S PLACE (owner 2026-10-06): the phone's lower
     third, the desk's right panel — `MarchTraySlot`, which the march's editor is.
     Drawn there through a portal, so it is still THIS maker: one state, one drag. */
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  /* The slot moves: the guided step's sheet and All items' panel are different
     parents, and a closed sheet drops it. Found again whenever the workspace's
     tree changes — never a portal into a detached node. */
  useEffect(() => {
    const find = () => {
      const el = document.querySelector<HTMLElement>('[data-march-tray-slot]');
      setSlot((was) => (was === el ? was : el));
    };
    find();
    const scope = root.current?.closest('[data-details-workspace]') ?? document.body;
    const mo = new MutationObserver(find);
    mo.observe(scope, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [anyone]);
  const [lifted, setLifted] = useState<string | null>(null);
  const [over, setOver] = useState<{ zone: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  /* ⌨ What the keyboard is holding, and what it last did (said aloud). */
  const [carried, setCarried] = useState<{ source: MarchSource; key: string; name: string } | null>(null);
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
  }, [sections, printed, out]);

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
    (next: Shown, steps: readonly MarchStep[], said: Toast) => {
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
              // The lab has no server march to come back, so it asks for no render either.
              lab ? LAB_NO_RENDER : requestMakerRefresh,
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
    (plan: MarchMove | null) => {
      if (!plan) return;
      if (!plan.ok) {
        say({ said: plan.reason, undo: null, before: null, refused: true });
        return;
      }
      commit({ sections: plan.sections, printed: plan.printed, out: plan.out ?? shownOut }, plan.steps, {
        said: plan.said,
        undo: plan.undo,
        before: { sections: shown, printed: shownPrinted, out: shownOut },
      });
    },
    [commit, say, shown, shownPrinted, shownOut],
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
    const home = land
      ? root.current?.querySelector<HTMLElement>(`[data-march-flip="${CSS.escape(land.key)}"],[data-march-key="${CSS.escape(land.key)}"]`)
      : null;
    const homeAt = home?.getBoundingClientRect() ?? null;
    if (was && !quiet) {
      /* A name inside a walk that moved too travels WITH it: animate only its
         own share of the move, or it would slide twice as far. */
      const els = [...(root.current?.querySelectorAll<HTMLElement>('[data-march-flip]') ?? [])];
      const delta = new Map<HTMLElement, [number, number] | null>();
      for (const el of els) {
        const b = was.get(el.dataset.marchFlip!);
        const a = el.getBoundingClientRect();
        delta.set(el, b ? [b.left - a.left, b.top - a.top] : null);
      }
      for (const el of els) {
        const d = delta.get(el);
        if (!d) {
          el.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
          continue;
        }
        const up = el.parentElement?.closest<HTMLElement>('[data-march-flip]');
        const pd = (up && delta.get(up)) || [0, 0];
        const dx = d[0] - pd[0];
        const dy = d[1] - pd[1];
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
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

  /** Is this element the maker's — the march, its tray, or the tray's full list? */
  const within = useCallback(
    (el: Element | null) =>
      Boolean(el && (root.current?.contains(el) || slot?.contains(el) || el.closest('[data-march-tray-sheet]'))),
    [slot],
  );

  /** What the finger is over: a drop zone (a name, an empty spot, a gap, the tray), or the nearest gap in its section. */
  const hit = useCallback(
    (d: Drag) => {
      const box = root.current;
      if (!box) return;
      let zone: string | null = null;
      for (const el of document.elementsFromPoint(d.x, d.y)) {
        if (!within(el)) continue;
        const z = (el as HTMLElement).closest<HTMLElement>('[data-march-drop]');
        // A walk lands only in a gap; a section only on a section's header; a name anywhere but a header;
        // a tray name anywhere in the march (its role decides where it lands).
        const kind = z?.dataset.marchDrop?.split('|')[0];
        const fits =
          d.source.kind === 'name'
            ? kind !== 'section'
            : d.source.kind === 'out'
              ? kind !== 'section' && kind !== 'tray'
              : d.source.kind === 'walk'
                ? kind === 'gap'
                : kind === 'section';
        if (z && within(z) && fits) {
          zone = z.dataset.marchDrop!;
          break;
        }
        // Over a walk or a heading but not on a zone: the nearest gap in that section.
        const sec = (el as HTMLElement).closest<HTMLElement>('[data-march-section]');
        if (sec && d.source.kind === 'section') {
          // A section dragged over another section takes its place.
          zone = `section|${sec.dataset.marchSection}`;
          break;
        }
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
      const to = zone ? readTarget(zone) : null;
      const plan = to ? planMove(shown, shownPrinted, d.source, to, shownOut) : null;
      const next = plan ? zone : null;
      if (next === target.current) return;
      target.current = next;
      setOver(next && plan ? { zone: next, ok: plan.ok } : null);
    },
    [shown, shownPrinted, shownOut, within],
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
      // A tray name scrolls the MARCH near its edges (the tray itself never scrolls).
      const scroller = p.source.kind === 'out' && root.current ? scrollerOf(root.current) : scrollerOf(p.el);
      drag.current = { source: p.source, key: p.key, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller, dir: 0 };
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
    const to = zone ? readTarget(zone) : null;
    const plan = to ? planMove(shown, shownPrinted, d.source, to, shownOut) : null;
    landing.current = { ghost: d.ghost, key: d.key };
    if (plan) run(plan);
    // Nowhere to go: one more paint, and the ghost settles back where it came from.
    else redraw((n) => n + 1);
  }, [run, shown, shownPrinted, shownOut, stopAll]);

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
    if (!el || !within(el)) return;
    const source = readSource(el.dataset.marchDrag);
    if (!source) return;
    const key =
      source.kind === 'name' || source.kind === 'out' ? source.id : source.kind === 'walk' ? `walk:${source.lead}` : `section:${source.key}`;
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
    // The tray too: a drag that starts on a tray chip is a touch whose first target is in the slot.
    slot?.addEventListener('touchmove', block, { passive: false });
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
      slot?.removeEventListener('touchmove', block);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    // Re-attached when the maker first has someone to draw (the empty state has no root), and when the tray's slot is found.
  }, [anyone, slot]);
  /** ⌨ The same drops, from the keyboard. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-march-toast]')) return;
    if (e.key === 'Escape' && carried) {
      e.preventDefault();
      setCarried(null);
      setHeard(`${carried.name} put back — nothing moved.`);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      if (carried) {
        e.preventDefault();
        const zone = el.closest<HTMLElement>('[data-march-drop]')?.dataset.marchDrop;
        const to = zone ? readTarget(zone) : null;
        const plan = to ? planMove(shown, shownPrinted, carried.source, to, shownOut) : null;
        setCarried(null);
        refocus.current = carried.key;
        if (plan) run(plan);
        setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${carried.name} put back — nothing moved.`);
        return;
      }
      const from = el.closest<HTMLElement>('[data-march-drag]');
      const source = readSource(from?.dataset.marchDrag);
      if (!from || !source) return;
      e.preventDefault();
      const name = from.dataset.marchName ?? '';
      setCarried({ source, key: from.dataset.marchKey ?? '', name });
      setHeard(`${name} picked up. Space on a name or an empty spot puts them there; arrow keys move them a walk; Escape puts them back.`);
      return;
    }
    if (carried && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = keyTarget(shown, carried.source, e.key === 'ArrowUp' ? -1 : 1);
      const plan = to ? planMove(shown, shownPrinted, carried.source, to, shownOut) : null;
      refocus.current = carried.key;
      if (plan) run(plan);
      setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${carried.name} cannot go further.`);
      // Still carried: ↑ / ↓ again keeps moving it (a name keeps its id; a walk moved by ↑ / ↓ keeps its lead).
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
      className={`mx-auto flex w-full max-w-2xl select-none flex-col pb-6 ${dragging ? 'cursor-grabbing' : ''}`}
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
      {shown.length === 0 ? (
        /* Nobody walks yet, but the tray holds people: the whole march is where they land. */
        <div
          data-march-drop="gap|*|0"
          className={`mt-3 flex min-h-24 items-center justify-center rounded-xl border-[1.5px] border-dashed px-4 text-center text-sm ${
            over?.zone === 'gap|*|0' ? 'border-terracotta-700 text-terracotta-800' : 'border-ink/15 text-ink/55'
          }`}
        >
          Drag a name here from Not walking.
        </div>
      ) : null}
      {shown.map((sec) => {
        /* 🚶 A section moves by dragging its HEADER — every one but the groom's
           side (always first) and the bride's (always last). */
        const fixed = isMarchOnlyGroup(sec.key);
        const sectionKey = `section:${sec.key}`;
        return (
        <div key={sec.key} data-march-section={sec.key} className={`flex flex-col transition-opacity ${lifted === sectionKey ? 'opacity-30' : ''}`}>
          <p
            data-march-drag={fixed ? undefined : `section|${sec.key}`}
            data-march-drop={fixed ? undefined : `section|${sec.key}`}
            data-march-key={fixed ? undefined : sectionKey}
            data-march-name={sec.label}
            tabIndex={fixed ? undefined : 0}
            role={fixed ? undefined : 'button'}
            aria-pressed={fixed ? undefined : carried?.key === sectionKey}
            aria-label={fixed ? undefined : `${sec.label} — drag to move the whole section`}
            className={`mt-3 flex min-h-9 items-baseline gap-2 rounded-lg px-1 pt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/65 ${
              fixed ? '' : 'cursor-grab touch-pan-y [-webkit-touch-callout:none]'
            }${carried?.key === sectionKey ? ' ring-2 ring-ink' : ''}${ring(`section|${sec.key}`)}`}
          >
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
            /* 🚶 Drawn across the aisle by role and side (owner 2026-10-06 — Ninong left,
               Ninang right; the groom's crew left, the bride's right): `acrossTheAisle`. */
            const laid = acrossTheAisle(row);
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
                    aria-pressed={carried?.key === walkKey}
                    aria-label={`Step ${step} — drag to move this walk`}
                    className="flex min-h-11 cursor-grab touch-pan-y select-none items-center justify-center font-serif text-xl text-terracotta-800 [-webkit-touch-callout:none]"
                  >
                    {step}
                  </span>
                  {[0, 1].map((c) => {
                    const p = laid[c as 0 | 1];
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
                          aria-pressed={carried?.key === p.id}
                          data-march-side={c === 0 ? 'left' : 'right'}
                          aria-label={`${p.name}${p.tag ? `, ${p.tag}` : ''} — step ${step}, ${c === 0 ? 'left' : 'right'}`}
                          className={`${NAME_CHIP} ${
                            p.tag ? 'border-terracotta-700/60 bg-white' : 'border-terracotta-700/20 bg-terracotta-700/[0.06]'
                          } ${lifted === p.id ? 'border-dashed opacity-30' : ''}${carried?.key === p.id ? ' ring-2 ring-ink ring-offset-1' : ''}${ring(zone)}`}
                        >
                          <span className="font-serif text-[15.5px] leading-tight text-ink [overflow-wrap:anywhere]">{p.name}</span>
                          {p.tag ? (
                            <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-terracotta-800">{p.tag}</span>
                          ) : null}
                        </div>
                      );
                    }
                    const anchor = laid[c === 0 ? 1 : 0];
                    const zone = `beside|${anchor?.id ?? ''}`;
                    return (
                      <div
                        key={`empty-${c}`}
                        data-march-drop={anchor?.id ? zone : undefined}
                        tabIndex={anchor?.id && carried ? 0 : undefined}
                        role={anchor?.id ? 'button' : undefined}
                        aria-label={anchor ? `Walk beside ${anchor.name}` : undefined}
                        className={`flex min-h-11 items-center justify-center rounded-lg border-[1.5px] border-dashed px-2 text-center text-[11px] leading-tight transition-colors ${
                          dragging ? 'border-terracotta-700/40 text-terracotta-800' : 'border-ink/15 text-ink/50'
                        }${ring(zone)}`}
                      >
                        {dragging || carried ? 'walk together' : 'walks alone'}
                      </div>
                    );
                  })}
                </div>
                <Gap zone={`gap|${sec.key}|${i + 1}`} on={over?.zone === `gap|${sec.key}|${i + 1}`} ok={over?.ok ?? true} />
              </div>
            );
          })}
        </div>
        );
      })}
      {sectionsMoved(shownPrinted) ? (
        /* One line, not a toolbar: the built-in section order back (Undo puts yours back). */
        <button
          type="button"
          data-march-sections-default=""
          onClick={() => run(planSectionsDefault(shown, shownPrinted))}
          className="mt-3 min-h-9 self-start px-1 text-xs text-ink/60 underline decoration-ink/25 underline-offset-2"
        >
          Put the sections back in their usual order
        </button>
      ) : null}
      {slot
        ? createPortal(
            <MarchTray
              out={shownOut}
              unread={outUnread && !mine}
              lifted={lifted}
              over={over?.zone === 'tray' ? over.ok : null}
              carried={carried?.key ?? null}
            />,
            slot,
          )
        : null}
      <p aria-live="polite" className="sr-only" data-march-heard="">
        {heard}
      </p>
      {toast ? (
        <div
          role="status"
          data-march-toast={toast.refused ? 'refused' : 'done'}
          /* The toast never blocks a name under it — only its Undo takes a tap. */
          className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--maker-lt-h,0px)+12px)] z-40 mx-auto flex max-w-md select-none items-center gap-3 rounded-xl bg-ink px-3.5 py-2.5 text-sm text-cream shadow-lg lg:bottom-4"
        >
          <span className="min-w-0 flex-1">{toast.said}</span>
          {toast.undo ? (
            <button type="button" onClick={undo} data-march-undo="" className="pointer-events-auto min-h-9 shrink-0 rounded-full bg-cream/15 px-3.5 text-sm font-semibold">
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
