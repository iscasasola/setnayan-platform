'use client';

/**
 * Scroll-less seat-plan frame + command-bar primitives (council verdict
 * 2026-07-15 · Seat_Plan_Scrollless_Council_Verdict). Pure presentational
 * shells — no seat-plan data logic lives here. The 6k-line editor keeps its
 * state/handlers and drops these shells into its return.
 *
 * Kit (Atelier-Glass, owner-locked 2026-07-12): the command bar is the ONLY
 * backdrop-blur surface on the page; every menu / popover / panel below it is a
 * solid surface. Gold lives ONLY on Auto Arrange + the active view tick. Motion
 * respects `prefers-reduced-motion`.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The fixed 100dvh frame. Measures its own top offset from the viewport (the
 * shell's sticky chrome height) and fills the rest of the screen, so the page
 * never document-scrolls — the canvas absorbs all remaining height. Least
 * invasive shell opt-out (verdict §1 / risk R1): a scoped wrapper INSIDE the
 * page, no `layout.tsx` change. Uses `100dvh` (never `vh`) for iOS toolbar
 * collapse.
 */
export function SeatingFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [topPx, setTopPx] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      // With the page bled full-height and no document scroll, scrollY is 0 and
      // `top` is the sticky-chrome height below the viewport top.
      setTopPx(Math.max(0, Math.round(el.getBoundingClientRect().top)));
    };
    measure();
    window.addEventListener('resize', measure);
    // Re-measure if the shell chrome height changes (responsive top bar).
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  // Dev-only assertion (verdict §9): any future flow sibling that reintroduces
  // scroll by pushing the frame down fails loudly.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && topPx !== null && topPx > 240) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SeatingFrame] measured a top offset of ${topPx}px — the frame is being pushed down by a flow sibling; the scroll-less budget assumes it sits directly under the shell chrome.`,
      );
    }
  }, [topPx]);

  const style: CSSProperties =
    topPx === null ? { height: '100dvh' } : { height: `calc(100dvh - ${topPx}px)` };

  return (
    <div ref={ref} data-seating-frame className="flex flex-col overflow-hidden" style={style}>
      {children}
    </div>
  );
}

/**
 * Row 1 — the command bar. 52px, one row, never wraps, the page's single
 * backdrop-blur surface. `overflow-visible` so the menu popovers escape below
 * it. On very narrow widths controls can run past the edge (the mobile condensed
 * bar + `⋯` overflow sheet is a later PR); on desktop the six targets fit.
 */
export function CommandBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative z-30 flex h-[52px] shrink-0 items-center gap-2 overflow-visible border-b border-ink/10 px-3"
      style={{
        background: 'rgba(255,255,255,.55)',
        backdropFilter: 'blur(18px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Row 2 — banner slot. One single-line strip max (hard height budget). The
 * caller resolves the priority winner + "N notices" overflow.
 */
export function BannerSlot({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="shrink-0">{children}</div>;
}

/**
 * Row 3 — body. The left panel + canvas split; the canvas cell owns all
 * remaining height and positions its content `absolute inset-0`.
 */
export function FrameBody({ children }: { children: ReactNode }) {
  // Desktop: [320px panel | canvas] grid. Mobile (<lg): a vertical flex split so
  // the canvas is never fully pushed below the fold (the polished bottom-drawer
  // is a later PR — verdict §7). Children add `flex-1 lg:flex-none` to share the
  // mobile height and hand back to the grid at lg.
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
      {children}
    </div>
  );
}

/**
 * A labeled dropdown menu for the command bar. icon + label + chevron trigger
 * (never a bare icon — verdict §2 discoverability guardrail), a click-away
 * backdrop, and a solid (non-blurred) popover panel. `stateBadge` renders a
 * small dot on the closed trigger (e.g. Arrange when a policy is Off).
 */
export function BarMenu({
  label,
  icon: Icon,
  children,
  disabled,
  align = 'left',
  stateBadge,
  width = 'w-64',
  title,
  onOpenChange,
  onHover,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
  disabled?: boolean;
  align?: 'left' | 'right';
  stateBadge?: boolean;
  width?: string;
  title?: string;
  onOpenChange?: (open: boolean) => void;
  onHover?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => set(!open)}
        onMouseEnter={onHover}
        disabled={disabled}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 text-xs font-medium text-ink transition-colors hover:border-terracotta disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className="h-3 w-3 text-ink/40" />
        {stateBadge ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-cream bg-terracotta" />
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => set(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            onClick={() => set(false)}
            className={`absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } z-40 mt-1 ${width} overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg`}
          >
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** A section caption inside a BarMenu popover. */
export function MenuCaption({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/45">
      {children}
    </p>
  );
}

/** A thin divider between menu groups. */
export function MenuDivider() {
  return <div className="my-1 border-t border-ink/10" />;
}

/**
 * A single menu row — icon + label (+ optional hint / trailing badge). Used for
 * both button actions and `<a>` links (pass `as`).
 */
export function MenuRow({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  badge,
  href,
  target,
  emphasized,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  href?: string;
  target?: string;
  emphasized?: boolean;
}) {
  const inner = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <Icon className={`h-4 w-4 shrink-0 ${emphasized ? 'text-terracotta' : 'text-ink/55'}`} strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] text-ink/50">
            {badge}
          </span>
        ) : null}
      </span>
      {hint ? <span className="pl-[22px] text-[11px] leading-snug text-ink/55">{hint}</span> : null}
    </span>
  );
  const cls = `flex w-full items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40 ${
    emphasized ? 'bg-terracotta/[0.06]' : ''
  }`;
  if (href) {
    return (
      <a role="menuitem" href={href} target={target} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/**
 * The permanent save-status chip (verdict §2, SAVE row). Always visible — the
 * old appear/disappear Save button is why drags got lost. No autosave in v1
 * (sign-off S2); the chip + a `beforeunload` guard is the safety net.
 */
export function SaveStatusChip({
  state,
  unsavedCount,
  savedAt,
  onSave,
  disabled,
}: {
  state: SaveState;
  unsavedCount: number;
  savedAt: string | null;
  onSave: () => void;
  disabled?: boolean;
}) {
  const dirty = state === 'dirty' || state === 'error';
  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'error'
        ? 'Retry save'
        : state === 'dirty'
          ? `${unsavedCount} unsaved`
          : savedAt
            ? `Saved · ${savedAt}`
            : 'Saved';
  return (
    <button
      type="button"
      onClick={dirty ? onSave : undefined}
      disabled={disabled || state === 'saving' || (!dirty && state === 'saved')}
      title={
        dirty
          ? 'Unsaved layout changes — click to save (⌘S)'
          : 'All layout changes saved'
      }
      aria-live="polite"
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-mono text-[11px] transition-colors ${
        dirty
          ? 'cursor-pointer border-terracotta/50 bg-terracotta/5 text-terracotta hover:border-terracotta'
          : 'border-ink/12 bg-cream text-ink/55'
      } disabled:cursor-default`}
    >
      {dirty ? (
        <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/**
 * The [2D · 3D · List] segmented view control (verdict §4). One control for the
 * whole view axis. Gold tick on the active segment (kit). The 3D segment hides
 * when `NEXT_PUBLIC_SEATING_3D === 'false'` (never link to the lab's 404 gate).
 * Shared between the 2D editor and the 3D lab chrome so 2D↔3D is one click and
 * the doorway is never orphaned (directive §4).
 */
export function SeatingViewSegment({
  active,
  onSelect,
  on3DHover,
}: {
  active: '2d' | '3d' | 'list';
  onSelect: (target: '2d' | '3d' | 'list') => void;
  on3DHover?: () => void;
}) {
  const show3D = process.env.NEXT_PUBLIC_SEATING_3D !== 'false';
  const items: { key: '2d' | '3d' | 'list'; label: string }[] = [
    { key: '2d', label: '2D' },
    ...(show3D ? ([{ key: '3d', label: '3D' }] as const) : []),
    { key: 'list', label: 'List' },
  ];
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-ink/15 bg-cream p-0.5">
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(it.key)}
            onMouseEnter={it.key === '3d' ? on3DHover : undefined}
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition ${
              on
                ? 'bg-mulberry/15 text-mulberry-700 ring-1 ring-mulberry/40'
                : 'text-ink/55 hover:text-ink'
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
