'use client';

/**
 * SubNav — a SECTION sub-nav docked directly above the global bottom nav.
 *
 * The reusable companion to <BottomNav> (project_setnayan_bottom_nav_canonical):
 * when a page's primary bottom-nav tab owns sub-sections, mount a <SubNav> and
 * pass only its own tabs. It renders a floating frosted pill — one size down
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

export type SubNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
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

  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      // Geometry mirrors <BottomNav> → NavShell so the two bars read as one
      // system: inset 14px, frosted --m-paper-2 @ 92% + the same soft shadow,
      // fully rounded. Docks ABOVE the (now compact) bottom nav: bottom =
      // safe-area + 12px (nav offset) + ~56px (icons-only nav height) + 8px gap
      // ≈ safe-area + 76px. `z-20` (just under the nav's z-30) so it appears to
      // rise out of the dock. `.subnav-lift` plays the reveal once on mount.
      className="subnav-lift fixed inset-x-[14px] bottom-[calc(env(safe-area-inset-bottom)+76px)] z-20 flex select-none gap-1 rounded-full border p-1 backdrop-blur lg:hidden"
      style={{
        background: 'rgba(248, 246, 240, 0.92)',
        borderColor: 'var(--m-line)',
        boxShadow: '0 10px 30px -12px rgba(30, 34, 41, 0.35)',
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const on = it.key === activeKey;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(it.key)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5"
            style={{
              color: on ? 'var(--m-ink)' : 'var(--m-slate)',
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
              style={{ color: on ? 'var(--m-orange)' : 'var(--m-slate)' }}
            />
            <span
              className="max-w-full truncate text-[10px] tracking-wide"
              style={{ fontWeight: on ? 600 : 400 }}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
