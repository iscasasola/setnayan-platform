'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { InfoTip } from '@/app/_components/info-tip';

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
  anchor,
  popovers = false,
  summaryEnd = false,
  danger = false,
  tip,
  open: openProp,
  onOpenChange,
  pin = false,
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
  /**
   * 📌 THE OPEN HEAD PINS (owner 2026-10-29, Admin › Categories panels approved — prototype
   * `carry-2026-10-29/admin-categories-proto`, strips `strip-pin-*`): while this fold is open and its head has scrolled
   * past the top of the scrolling box, the head stays there, SLIM (40 px, the summary faded), so the person always
   * sees which fold they are in; scrolling back lets it go. The change moves at the family's speed; nothing moves
   * under "reduce motion". A press on a pinned head takes the person back to the fold's top instead of shutting it.
   * The head is sticky inside the fold, so it leaves with the fold's last row. Absent → the head is exactly as it was.
   */
  pin?: boolean;
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
  const box = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!pin || !open) {
      setStuck(false);
      return;
    }
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    /* The box that scrolls (a sheet's body, the page) — the head pins to ITS top. */
    let root: HTMLElement | null = el.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        const top = e.rootBounds?.top ?? 0;
        setStuck(!e.isIntersecting && e.boundingClientRect.top < top);
      },
      { root, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pin, open]);
  const pinned = pin && open && stuck;
  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  };
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
      data-fold-pinned={pinned ? '' : undefined}
      onClick={() => (pinned ? toTop() : setOpen((o) => !o))}
      className={`sn-press flex items-center gap-2 text-left font-semibold text-ink ${pin ? 'transition-[min-height,font-size] duration-300 ease-sn motion-reduce:transition-none' : ''} ${pinned ? 'min-h-10 text-[13.5px]' : 'min-h-[52px] text-[15px]'} ${leadPress || tipped ? 'min-w-0 flex-1' : 'w-full'}`}
    >
      {lead}
      {tipped ? (
        <span className="ml-auto min-w-0 flex-1 truncate text-right text-[13.5px] font-normal text-ink/55">{summary}</span>
      ) : summaryEnd ? (
        <>
          <span className={`shrink-0 font-medium ${danger ? 'text-danger-700' : ''}`}>{title}</span>
          <span className={`ml-auto min-w-0 flex-1 truncate text-right text-[13.5px] font-normal text-ink/55 ${pin ? 'transition-opacity duration-300 motion-reduce:transition-none' : ''} ${pinned ? 'opacity-0' : ''}`}>{summary}</span>
        </>
      ) : line !== undefined ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate">{title}</span>
          {line ? <span className="block truncate text-[13px] font-normal text-ink/60">{line}</span> : null}
        </span>
      ) : (
        <span className={`min-w-0 flex-1 ${danger ? 'text-danger-700' : ''}`}>
          {title}
          {summary ? <small className="text-[12.5px] font-normal text-ink/55"> · {summary}</small> : null}
        </span>
      )}
      {aside}
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
      {pin ? <div ref={sentinel} aria-hidden data-fold-sentinel="" className="h-px -mb-px" /> : null}
      {pin ? (
        <div
          data-fold-pin=""
          className={`${open ? 'sticky top-0 z-[3] bg-cream' : ''} transition-shadow duration-300 motion-reduce:transition-none ${pinned ? 'shadow-[0_1px_0_rgb(var(--color-ink)/0.1)]' : ''}`}
        >
          {head}
        </div>
      ) : leadPress ? (
        <div className="flex items-center gap-2" data-fold-row="">
          {leadPress}
          {head}
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
      <div
        id={id}
        data-fold-body=""
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        {/* 4 px of room each side, so a row's focus ring and an open field's highlight are not cut by the fold's edge. */}
        <div className={`-mx-1 min-h-0 ${popovers && open && settled ? 'overflow-visible' : 'overflow-hidden'} px-1 transition-opacity duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}>
          <OneOpenScope id={scope}>{children}</OneOpenScope>
        </div>
      </div>
    </div>
  );
}
