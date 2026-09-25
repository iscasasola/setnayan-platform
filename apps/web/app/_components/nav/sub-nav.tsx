'use client';

/**
 * SubNav — a SECTION sub-nav docked directly above the global bottom nav.
 *
 * The reusable companion to <BottomNav> (project_setnayan_bottom_nav_canonical):
 * when a page's primary bottom-nav tab owns sub-sections, mount a <SubNav> and
 * pass only its own tabs.
 *
 * ⚓ INSIDE A <BottomDock> (2026-09-25) it is the dock's top row, attached to
 * the bar as one anchored unit — the event layout mounts it that way. The
 * floating pill described next is only what it draws with NO dock around it.
 *
 * Undocked, it renders a floating frosted pill — one size down
 * from the bottom-nav pill so it reads as that tab's subordinate shelf — docked
 * just above the bottom nav, and LIFTS into place on mount (owner-picked reveal
 * 2026-06-16; the `.subnav-lift` keyframe lives in globals.css). Items are
 * ICON-OVER-TEXT (label under the glyph), mirroring the bottom-nav cells.
 *
 * Coordination (owner 2026-06-16 "when sub nav shows, the bottom nav shrinks and
 * becomes icons only"): while ANY <SubNav> is mounted, the bottom nav collapses
 * its labels to icons-only — it only loses the TEXT row (the icon never shrinks),
 * so the bar gets a touch shorter and the two bars stack without crowding. The
 * signal is a tiny module-level store read by <BottomNav> via useSubNavDocked()
 * (race-free vs. a fire-and-forget event — a late subscriber reads the current
 * count). Mobile-only (`lg:hidden`); on desktop the page keeps its own top strip.
 *
 * Reuse on other pages: `<SubNav items={...} activeKey={key} onSelect={fn} />`.
 * `onSelect` drives client-side section switching (the page owns the panel + the
 * active key); an href-per-item variant can be added when a page needs routing.
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useInBottomDock } from './bottom-nav';

export type SubNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /**
   * Render the item dimmed — a "not yet" state for a tab that's present but not
   * actionable right now (e.g. a time-gated Day-of stage before the event). It
   * stays tappable; only its opacity drops. The active item is never muted.
   */
  muted?: boolean;
};

/* ── docked-state store ──────────────────────────────────────────────────
 * How many <SubNav>s are currently mounted. The bottom nav collapses to
 * icons-only whenever this is > 0. A store (not a CustomEvent) so the order in
 * which <SubNav> and <BottomNav> mount doesn't matter — a subscriber that
 * attaches late still reads the current count. */
let dockedCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return dockedCount > 0;
}
function getServerSnapshot() {
  return false;
}

/** True while at least one <SubNav> is docked. <BottomNav> reads this to drop
 *  its labels to icons-only. SSR-safe (false on the server / first paint). */
export function useSubNavDocked(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function SubNav({
  items,
  activeKey,
  onSelect,
  ariaLabel = 'Section navigation',
}: {
  items: SubNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
}) {
  const docked = useInBottomDock();
  // Register as docked for the lifetime of this component → the bottom nav goes
  // icons-only while we're on screen, and restores its labels when we unmount
  // (e.g. navigating away from the section).
  useEffect(() => {
    dockedCount += 1;
    emit();
    return () => {
      dockedCount = Math.max(0, dockedCount - 1);
      emit();
    };
  }, []);

  if (items.length < 1) return null;

  /*
    ⚓ DOCKED: ONE UNIT WITH THE BAR (2026-09-25). Inside a <BottomDock> the
    strip is the dock's TOP ROW — no `fixed`, no pill, no shadow of its own;
    the dock's glass is its surface and the bar sits directly under it.
    Measured in the iOS simulator on the Event Hub Controller before this: the
    strip floated as a second pill 20px above the bar pill, both over the page,
    with "Edit this site" showing between and under them. The design says the
    strip "docks above the bar" — attached, not stacked.
  */
  if (docked) {
    return (
      <nav
        role="tablist"
        aria-label={ariaLabel}
        data-dock-strip
        className="flex w-full select-none gap-1 px-1.5 pt-1.5 lg:hidden"
      >
        {items.map((it) => (
          <SubNavTab key={it.key} item={it} on={it.key === activeKey} onSelect={onSelect} />
        ))}
      </nav>
    );
  }

  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      // Geometry mirrors <BottomNav> → NavShell so the two bars read as one
      // system: inset 14px, frosted --m-paper-2 @ 92% + the same soft shadow,
      // fully rounded. Docks a fixed 8px gap ABOVE the bottom nav, derived from
      // the nav's REAL measured height (--sn-bottomnav-h, published by NavShell's
      // ResizeObserver) — NO hardcoded height guess, so the gap can't drift or
      // overlap if the bar's height ever changes (labels, tab count, font).
      // bottom = safe-area + 12px (the nav's own float offset) + nav height + 8px
      // gap. Falls back to the 64px design height until JS measures (SSR). `z-20`
      // (just under the nav's z-30) so it appears to rise out of the dock.
      // `.subnav-lift` plays the reveal once on mount.
      // 2026-09-24 house style: NO BORDER — depth (blur + shadow) separates the
      // dock from the page, never a drawn line (DESIGN-LANGUAGE-AMENDMENT.md).
      className="subnav-lift fixed inset-x-[14px] z-20 flex select-none gap-1 rounded-full p-1 backdrop-blur lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + var(--sn-bottomnav-h, 64px) + 20px)',
        background: 'rgba(248, 246, 240, 0.92)',
        boxShadow: '0 10px 30px -12px rgba(30, 34, 41, 0.35)',
      }}
    >
      {items.map((it) => (
        <SubNavTab key={it.key} item={it} on={it.key === activeKey} onSelect={onSelect} />
      ))}
    </nav>
  );
}

/** One strip tab — the same cell whether the strip floats or is docked. */
function SubNavTab({
  item: it,
  on,
  onSelect,
}: {
  item: SubNavItem;
  on: boolean;
  onSelect: (key: string) => void;
}) {
  const Icon = it.icon;
  // A muted (e.g. time-gated) item reads as "not yet": dimmed, but only
  // while it isn't the active tab — selecting it still lights it fully.
  const dim = it.muted && !on;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={() => onSelect(it.key)}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition-[background-color,color,transform] duration-300 ease-in-out active:scale-95"
      style={{
        color: on ? 'var(--m-ink)' : 'var(--m-slate)',
        opacity: dim ? 0.45 : 1,
        // Active = the bottom-nav pill's translucent-grey fill (not the
        // white sn-seg pill) so the docked shelf matches the adjacent bar.
        background: on
          ? 'color-mix(in srgb, var(--m-ink) 15%, transparent)'
          : 'transparent',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {/* One size down from the nav's 22px icon — subordinate, never the
          same weight as the primary bar. */}
      <Icon
        aria-hidden
        className="h-5 w-5 shrink-0"
        strokeWidth={1.75}
        style={{ color: on ? 'var(--m-nav-active)' : 'var(--m-slate)' }}
      />
      {/* Two centred lines, never an ellipsis — the same rule as the bar's
          labels ("Event Hub Controller" sits in the Invite strip too). */}
      <span
        className="line-clamp-2 max-w-full break-words text-center text-[10px] leading-[1.1] tracking-wide"
        style={{ fontWeight: on ? 600 : 400 }}
      >
        {it.label}
      </span>
    </button>
  );
}
