'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { InfoTip } from '@/app/_components/info-tip';
import { joinPinLine } from '@/app/_components/pinned-row/pin-line';

/** How many OPEN folds this one sits inside — its head pins that many slim lines further down (flush under theirs). */
const FoldDepth = createContext(0);
/** A slim head's height (owner 2026-10-29: "~40 px"). */
export const FOLD_SLIM_PX = 40;

/**
 * 📌 THE OPEN HEAD PINS AS ONE SLIM LINE (owner 2026-10-29, APP-WIDE — supplier dashboard v13 "ACCORDION PIN RULE":
 * "an OPEN section's head, once it reaches the top, pins as ONE SLIM LINE (icon small · name · ⓘ · ▾; sub-line, count
 * and tags hidden; ~40px) and hands over to the next; scrolling back restores it"; DECISION_LOG "LAST ROUND" item 6,
 * "every page's section headers pin too and hand over to the next").
 *
 * While the fold is open its head is `position: sticky` on the PIN LINE — the bottom of whatever is already pinned at
 * the top (`--sn-pin-top`, `pin-line.ts`), plus one slim line per open fold it sits in, so a nested head sits flush
 * under its parent's. Inside a sheet or any other box that scrolls on its own, the line is that box's top. Once the head
 * has actually travelled up to the line it goes slim (`data-slim`); back down, or near where it stuck, it is full again
 * (the prototype's hysteresis: on at the line, off 6 px below it). The fold's own box is the sticky container, so the
 * head leaves with the fold's last row and the NEXT open head takes the line — the hand-over. Written as attributes,
 * never state: nothing re-renders for a scroll. Closed, the head is exactly as it always was.
 * 🔒 app/_components/the-open-fold-head-pins-slim.test.ts
 */
function useSlimPin(on: boolean, depth: number) {
  const pinRef = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pin = pinRef.current;
    const root = box.current;
    if (!on || !pin || !root) return;
    // The box this head scrolls in: the page, or the nearest ancestor that scrolls on its own (a sheet, a panel).
    let inner: HTMLElement | null = root.parentElement;
    while (inner && inner !== document.body && !/(auto|scroll)/.test(getComputedStyle(inner).overflowY)) inner = inner.parentElement;
    if (inner === document.body || inner === document.documentElement) inner = null;
    const offset = depth * FOLD_SLIM_PX;
    pin.setAttribute('data-fold-pin', inner ? 'inner' : 'page');
    pin.style.top = inner ? `${offset}px` : `calc(var(--sn-pin-top, 0px) + ${offset}px)`;
    // A pinned head needs a ground, or the rows scroll through it: the nearest painted background above it.
    let bg = '';
    for (let el: HTMLElement | null = root; el && !bg; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) bg = c;
    }
    pin.style.backgroundColor = bg || 'var(--sn-canvas)';
    const leave = inner ? null : joinPinLine();
    let raf = 0;
    let slim = false;
    const read = () => {
      raf = 0;
      const line = (inner ? inner.getBoundingClientRect().top : 0) + (parseFloat(getComputedStyle(pin).top) || 0);
      const r = pin.getBoundingClientRect();
      const travelled = root.getBoundingClientRect().top < r.top - 1;
      const next = slim ? travelled && r.top <= line + 6 : travelled && r.top <= line + 1;
      if (next !== slim) {
        slim = next;
        pin.setAttribute('data-was-slim', '');
        pin.toggleAttribute('data-slim', next);
      }
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      leave?.();
      pin.removeAttribute('data-fold-pin');
      pin.removeAttribute('data-slim');
      pin.removeAttribute('data-was-slim');
      pin.style.top = '';
      pin.style.backgroundColor = '';
    };
  }, [on, depth]);
  return { pinRef, box };
}

/**
 * FOLD — keeps the less-used things out of the way; one line says what is inside (`INTERACTION_RULES.md` § 9,
 * kind 19; approved gallery `prototypes/control_templates_2026-10-08.html` § 19).
 *
 *   · it opens DOWNWARD and the arrow turns over (the arrow is the app's accent — the small mark that says "you can
 *     tap this");
 *   · ONE FOLD OPEN AT A TIME on a screen (`useOneOpen`: opening one closes another; a dropdown or an explanation
 *     opened INSIDE it never closes it — `OneOpenScope`);
 *   · what is inside STAYS MOUNTED while shut (a field in it keeps its words and its place in a form) — it is only
 *     out of reach (`inert`) and out of sight;
 *   · the height moves on `grid-template-rows` at the press family's one speed; nothing moves under "reduce motion".
 *
 * Neutral: it knows no screen, and writes no colour of its own.
 */
export function Fold({
  title,
  summary,
  defaultOpen = false,
  children,
  data,
  className = '',
  line,
  aside,
  lead,
  leadPress,
  endPress,
  current = false,
  wrap = false,
  titleNode,
  anchor,
  popovers = false,
  summaryEnd = false,
  danger = false,
  tip,
  open: openProp,
  onOpenChange,
}: {
  /** What the fold is — "More for guests". */
  title: string;
  /** One quiet line of what is inside — "the address, who can view, the QR". */
  summary?: string;
  /**
   * A LIST ROW THAT OPENS IN PLACE (a queue of asks — the supplier's "Also waiting"): the row's one line, UNDER the
   * title instead of beside it, each cut with "…" so the row stays one height. Absent → the head is exactly as it was.
   */
  line?: string;
  /** A state shown at the right, before the arrow — a `Badge` ("2 of 3"). Never something pressable. */
  aside?: ReactNode;
  /** A mark at the LEFT of the head — a list row's avatar, so a row that opens in place lines up with the rows that go
   *  somewhere. Never something pressable. Absent → the head is exactly as it was. */
  lead?: ReactNode;
  /**
   * A PRESSABLE mark at the LEFT, BESIDE the head rather than inside it — a row's colour circle that opens its own
   * picker (Your page › Look). The head keeps its own press (open / shut), the mark keeps its own; a button is never
   * nested in the head. Absent → the head is exactly as it was.
   */
  leadPress?: ReactNode;
  /**
   * A PRESSABLE at the RIGHT, BESIDE the head rather than inside it — a list row's ONE action ("Confirm" · "Reply" · "Pay")
   * that acts directly while the rest of the row opens it (owner 2026-10-29, supplier dashboard v13: *"where is the
   * expand look of these rows?"* — the row opens, "the button still does its one thing"). Like `leadPress`, a button is
   * never nested in the head. Absent → the head is exactly as it was.
   */
  endPress?: ReactNode;
  /**
   * THIS ROW IS THE ONE OPEN IN THE RIGHT COLUMN (from 701 a supplier list opens a row beside itself, not under it —
   * `vendor-dashboard/_components/supplier-open-row.tsx`). The head says so (`aria-current`, `data-fold-current`) while
   * the fold itself stays shut. Absent → the head is exactly as it was.
   */
  current?: boolean;
  /** With `line`: the title takes TWO lines before it is ever cut (house rule "names never cut"). Absent → one line. */
  wrap?: boolean;
  /** With `line`: what the title DRAWS when it is marked (a search's matching letters) — `title` stays its words. */
  titleNode?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** `data-fold="<data>"`. */
  data?: string;
  /**
   * A LINK CAN OPEN IT. The fold carries `id="<anchor>"`, and an address ending in `#<anchor>` — on arrival or
   * from a link on the same page — opens it and brings it into view. No round trip: a link from elsewhere
   * (`/vendor-dashboard/profile#docs`) and the thumb row's "Add what is left" (`#docs`) both land on the open
   * fold. Absent → no id, and the fold is exactly as it was.
   */
  anchor?: string;
  /**
   * AN ⓘ INSIDE MAY HANG PAST THE FOLD'S EDGE. The body clips (`overflow-hidden`) so its height can move; that also
   * cuts off an `InfoTip` popover that opens near the bottom. `popovers` lifts the clip once the fold has finished
   * opening, and puts it back the moment it starts to shut. Opt-in, so every other fold is exactly as it was.
   */
  popovers?: boolean;
  /**
   * A LIST OF ROWS (the guest card's groups, owner-approved prototype `guest_card_groups_and_papic_2026-10-23.html`): the
   * title at the LEFT, its one-line summary at the RIGHT — cut with "…", never wrapping, so every row is one height.
   * Absent → the summary sits beside the title as it always did.
   */
  summaryEnd?: boolean;
  /** The title in the danger colour — a row whose inside is a destructive act (the card's Delete). Absent → ink. */
  danger?: boolean;
  /**
   * ⓘ BESIDE THE TITLE (house rule: the title and one short line visible, the details inside the ⓘ — owner 2026-10-23).
   * With `summaryEnd`: the title becomes the `InfoTip`'s own label, drawn BESIDE the head (a button is never nested in
   * the head), and the head keeps the summary and the arrow, named for the title. The ⓘ is inside the fold's own
   * `OneOpenScope`, so opening it never shuts the fold; a tap on the title still opens the fold (a pointer convenience —
   * the keyboard's door is the head button, named for the title). Absent → the head is exactly as it was.
   */
  tip?: ReactNode;
  className?: string;
  /**
   * CONTROLLED, when the caller decides which fold is open (Today's new-shop steps: a save ticks ✓ and the NEXT one
   * opens — owner 2026-10-28, "the next opens"). `open` + `onOpenChange` together; absent → the fold keeps its own
   * state exactly as it always did.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : ownOpen;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlled) onOpenChange?.(value);
    else setOwnOpen(value);
  };
  // The anchor below opens through the newest setter (a controlled fold's changes every render).
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  // "Settled" = open AND the height has finished moving. Only then may a popover spill out.
  const [settled, setSettled] = useState(defaultOpen);
  useEffect(() => {
    if (!popovers) return;
    if (!open) {
      setSettled(false);
      return;
    }
    // transitionend does not fire under "reduce motion" (no transition) — a short timer covers it either way.
    const t = setTimeout(() => setSettled(true), 750); // the height moves at --sn-pill-dur (700 ms)
    return () => clearTimeout(t);
  }, [open, popovers]);
  const scope = useOneOpen(open, setOpen);
  const id = useId();
  const depth = useContext(FoldDepth);
  const { pinRef, box } = useSlimPin(open, depth);
  useEffect(() => {
    if (!anchor) return;
    const apply = () => {
      if (window.location.hash !== `#${anchor}`) return;
      setOpenRef.current(true);
      requestAnimationFrame(() => box.current?.scrollIntoView({ block: 'start' }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [anchor]);
  const tipped = Boolean(tip) && summaryEnd;
  const head = (
    <button
      type="button"
      data-fold-head=""
      aria-expanded={open}
      aria-controls={id}
      aria-label={tipped ? (summary ? `${title} · ${summary}` : title) : undefined}
      aria-current={current ? 'true' : undefined}
      data-fold-current={current ? '' : undefined}
      onClick={() => setOpen((o) => !o)}
      className={`sn-press flex min-h-[52px] items-center gap-2 text-left text-[15px] font-semibold text-ink ${leadPress || tipped || endPress ? 'min-w-0 flex-1' : 'w-full'}`}
    >
      {lead ? (
        <span className="inline-flex flex-none" data-fold-lead="">
          {lead}
        </span>
      ) : null}
      {tipped ? (
        <span className="ml-auto min-w-0 flex-1 truncate text-right text-[13.5px] font-normal text-ink/55">{summary}</span>
      ) : summaryEnd ? (
        <>
          <span className={`shrink-0 font-medium ${danger ? 'text-danger-700' : ''}`}>{title}</span>
          <span className="ml-auto min-w-0 flex-1 truncate text-right text-[13.5px] font-normal text-ink/55" data-fold-sub="">
            {summary}
          </span>
        </>
      ) : line !== undefined ? (
        <span className="min-w-0 flex-1">
          <span className={wrap ? 'line-clamp-2 block leading-snug' : 'block truncate'}>{titleNode ?? title}</span>
          {line ? (
            <span className="block truncate text-[13px] font-normal text-ink/60" data-fold-sub="">
              {line}
            </span>
          ) : null}
        </span>
      ) : (
        <span className={`min-w-0 flex-1 ${danger ? 'text-danger-700' : ''}`}>
          {title}
          {summary ? (
            <small className="text-[12.5px] font-normal text-ink/55" data-fold-sub="">
              {' '}
              · {summary}
            </small>
          ) : null}
        </span>
      )}
      {aside ? (
        <span className="contents" data-fold-aside="">
          {aside}
        </span>
      ) : null}
      <ChevronDown aria-hidden className={`h-4 w-4 flex-none text-sn-accent transition-transform duration-sn-pill ease-sn-spring motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
    </button>
  );
  return (
    <div
      ref={box}
      id={anchor}
      data-fold={data ?? ''}
      data-fold-open={open ? '' : undefined}
      className={anchor ? `scroll-mt-24 ${className}` : className}
    >
      <div ref={pinRef} data-fold-pinbox="">
      {leadPress || endPress ? (
        <div className="flex items-center gap-2" data-fold-row="">
          {leadPress}
          {head}
          {endPress ? (
            <span className="flex flex-none items-center" data-fold-end="">
              {endPress}
            </span>
          ) : null}
        </div>
      ) : tipped ? (
        <div className="flex items-center gap-2" data-fold-row="" data-fold-tipped="">
          <div className="shrink-0 cursor-pointer" data-fold-title="" onClick={(e) => !(e.target as Element).closest('button') && setOpen((o) => !o)}>
            <OneOpenScope id={scope}>
              <InfoTip label={title} labelClassName={`text-[15px] font-medium ${danger ? 'text-danger-700' : 'text-ink'}`} align="start">
                {tip}
              </InfoTip>
            </OneOpenScope>
          </div>
          {head}
        </div>
      ) : (
        head
      )}
      </div>
      <div
        id={id}
        data-fold-body=""
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        {/* 4 px of room each side, so a row's focus ring and an open field's highlight are not cut by the fold's edge. */}
        <div className={`-mx-1 min-h-0 ${popovers && open && settled ? 'overflow-visible' : 'overflow-hidden'} px-1 transition-opacity duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}>
          <FoldDepth.Provider value={open ? depth + 1 : depth}>
            <OneOpenScope id={scope}>{children}</OneOpenScope>
          </FoldDepth.Provider>
        </div>
      </div>
    </div>
  );
}
