'use client';

/**
 * BottomNav — THE canonical bottom navigation for the whole app.
 *
 * 🔒 UNBREAKABLE TEMPLATE (owner-locked 2026-06-13 ·
 *    project_setnayan_bottom_nav_canonical · DECISION_LOG 2026-06-13).
 * Every bottom-nav surface — customer dashboard, vendor dashboard,
 * admin/HQ — mounts THIS component and passes only its own tabs. No
 * surface hand-rolls a bar. The matching lint guard
 * (scripts/lint-bottom-nav.mjs) fails the build if a `*bottom-nav*`
 * wrapper is added that does not delegate here.
 *
 * THE LOCKED INTERACTION (measured off Instagram's Liquid-Glass bar):
 *  - Frosted-glass stadium bar (translucent --m-paper + backdrop-blur).
 *  - Active indicator = a FULL stadium pill that fills its tab cell and
 *    TRAVELS ON RELEASE (selection commits on finger-up → the route
 *    changes → the active index flips → the pill glides over) with a
 *    spring + a subtle horizontal "liquid" stretch (.nav-pill-stretch).
 *  - Press feedback = a diffused WHITE light that blooms under the finger
 *    ON PRESS-DOWN (pointerdown, not release): it fills the pill
 *    top-to-bottom solid and feathers only at the left/right ends (tall
 *    element clipped by the row's overflow-hidden), fading on release.
 *  - The pressed icon grows while held, settles on release.
 *  This nav treatment SUPERSEDES the generic .sn-bounce for bottom navs.
 *
 * CENTRAL TUNING: the four motion knobs live as CSS custom props on the
 * nav root (--bn-dur / --bn-grow / --bn-glow / --bn-stretch). Retune the
 * whole app's nav feel by editing those four values here — nowhere else.
 * Owner-locked baseline 2026-06-13: 500ms · grow 1.15 · glow 1.2 ·
 * stretch 1.1 · white light.
 *
 * SCOPE: mobile-only (`lg:hidden`). A FLOATING PILL bar — inset 14px from
 * each edge, floating 12px above the safe-area, fully rounded (NOT an
 * edge-to-edge strip). Evenly distributed columns, one per item up to 6
 * (the customer 6-tab row); the active pill is a consistent centered
 * capsule so 3/4/5/6-tab bars all read the same.
 *
 * ACTIVE DETECTION: each item's `activeMatch` accepts a single prefix
 * string OR an array of prefixes (any-of). Match is exact-equal OR
 * `startsWith(prefix + '/')` — same trailing-slash rule as <SidebarItem>
 * so `/budgets` never mis-matches `/budget`. `activeMatchExact` suppresses
 * the startsWith branch for Home-style tabs that prefix every sibling.
 *
 * SAFE-AREA: the bar's bottom offset is `calc(env(safe-area-inset-bottom)
 * + 12px)`, floating it clear of the iOS home indicator. Z-INDEX: z-30
 * (same layer as <SidebarShell>).
 *
 * ──────────────────────────────────────────────────────────────────────
 * ACCORDION MODE (0021 ADDENDUM · owner-locked 2026-06-15). A strictly
 * ADDITIVE second render path: pass `menus={BottomNavMenu[]}` instead of
 * `items` to get SIX fixed top-level menus where any menu with `children`
 * (≤5) extracts an inline accordion ON TAP — no "More" overflow, no
 * horizontal scroll. When `items` (the legacy flat prop) is passed, the
 * accordion code never runs and the vendor/admin doorways stay byte-for-
 * byte identical. The accordion REUSES the locked machinery verbatim — the
 * traveling pill, the press-light bloom, the icon-grow — the only new
 * wiring is `activeIndex` resolving against the CURRENT mode's slot map
 * (primary mode = menu index · section mode = anchor slot 0 + children
 * slots 1..n). See <BottomNavAccordion> below for the choreography.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { BottomNavItem, BottomNavMenu, NavBadgeTone } from './types';

type FlatProps = {
  items: BottomNavItem[];
  menus?: undefined;
};

type AccordionProps = {
  items?: undefined;
  /**
   * Accordion mode — SIX fixed top-level menus, each optionally extracting
   * an inline accordion of ≤5 children. When present, the accordion render
   * path runs instead of the flat path. (0021 ADDENDUM 2026-06-15.)
   */
  menus: BottomNavMenu[];
};

type Props = FlatProps | AccordionProps;

function matchesPath(pathname: string, item: BottomNavItem): boolean {
  const matches = Array.isArray(item.activeMatch)
    ? item.activeMatch
    : [item.activeMatch];
  return item.activeMatchExact
    ? matches.some((prefix) => pathname === prefix)
    : matches.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
      );
}

function useIsActive(pathname: string) {
  return useCallback(
    (item: BottomNavItem) => matchesPath(pathname, item),
    [pathname],
  );
}

/** Honors prefers-reduced-motion → the accordion collapses to a near-instant
 *  cross-fade per the spec §4. Returns true when the user prefers reduced
 *  motion. SSR-safe (defaults to false on the server / before mount). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

export function BottomNav(props: Props) {
  if (props.menus) {
    return <BottomNavAccordion menus={props.menus} />;
  }
  return <BottomNavFlat items={props.items ?? []} />;
}

/* ════════════════════════════════════════════════════════════════════════
 * FLAT BOTTOM NAV — the canonical, owner-locked baseline (unchanged).
 * Vendor + admin doorways render this path. Customer doorway opts into the
 * accordion path below.
 * ════════════════════════════════════════════════════════════════════════ */

function BottomNavFlat({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname() ?? '';
  const isActive = useIsActive(pathname);

  // Which tab is being physically pressed right now (pointerdown → up).
  // Drives the white press-light + the icon grow. Cleared on release,
  // pointer-leave, cancel, and any window-level pointerup (release outside
  // the bar) so the light never sticks on.
  const [pressed, setPressed] = useState<number | null>(null);
  useEffect(() => {
    if (pressed === null) return;
    const clear = () => setPressed(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [pressed]);

  // One-shot press-light flash: re-keyed on every press-down so even a quick
  // tap plays the full bloom-and-fade (NOT tied to holding). Persists at the
  // last-pressed column; the keyframe self-fades to invisible between taps.
  const [flash, setFlash] = useState<{ index: number; id: number } | null>(
    null,
  );

  // Surface a dev warning when callers exceed the 6-tab budget — beyond 6,
  // labels get cramped at common PH mobile widths (360-414px).
  useEffect(() => {
    if (items.length > 6) {
      // eslint-disable-next-line no-console
      console.warn(
        `BottomNav: rendering ${items.length} items — > 6 will not fit gracefully on mobile.`,
      );
    }
  }, [items.length]);

  if (items.length < 1) return null;

  const n = Math.min(items.length, 6);
  const colW = 100 / n;
  const activeIndex = items.findIndex((it) => isActive(it));

  return (
    <NavShell>
      <div className="relative overflow-hidden">
        {/* Active pill — travels on release. Outer track carries the
            horizontal position (transitioned); inner span carries the
            stretch keyframe (re-keyed per active index). Hidden when no
            tab matches the current route. */}
        {activeIndex >= 0 ? (
          <TravelPill index={activeIndex} colW={colW} />
        ) : null}

        {/* Press light — a one-shot WHITE bloom under the finger on
            press-down. Re-keyed per press (flash.id); never travels. */}
        {flash ? <PressFlash index={flash.index} colW={colW} flashId={flash.id} /> : null}

        <ul
          className="relative z-10 grid py-1"
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, i) => (
            <BottomNavTab
              key={item.key}
              item={item}
              active={i === activeIndex}
              pressed={pressed === i}
              onPressStart={() => {
                setPressed(i);
                setFlash((f) => ({ index: i, id: f ? f.id + 1 : 1 }));
              }}
              onPressEnd={() => setPressed(null)}
            />
          ))}
        </ul>
      </div>
    </NavShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * ACCORDION BOTTOM NAV — 0021 ADDENDUM (owner-locked 2026-06-15).
 *
 * SIX fixed top-level menus. A menu WITH children extracts the accordion
 * in place; a menu WITHOUT children navigates straight. Two modes:
 *   - PRIMARY  : the six menus, evenly distributed (slot i = menu i).
 *   - SECTION  : an open menu's accordion. Slot 0 = the hinge (the tapped menu,
 *                KEEPS its own glyph — e.g. the Setnayan logo — and toggles the
 *                section closed on tap; owner 2026-06-15 "the logo stays"), slots
 *                1..n = its children.
 *
 * The locked machinery is REUSED verbatim: the traveling dark pill, the
 * white press-light bloom on press-DOWN, the icon-grow on press. The pill's
 * target index resolves against the CURRENT mode's slot map.
 *
 * CHOREOGRAPHY (validated · spec §3) — two overlapping beats on expand:
 *   1. Clear + glide. The tapped menu glides to the FAR-LEFT corner; menus
 *      to its left slide off the left edge, menus to its right slide off the
 *      right edge.
 *   2. Unfurl. The children slide out from behind the corner anchor,
 *      cascading left→right (staggered) into slots 1..n. Beat 2 starts at
 *      ~45% of beat 1.
 * Collapse reverses. Input is locked while animating. prefers-reduced-motion
 * → near-instant cross-fade.
 *
 * LAYOUT: all menus + every menu's children are rendered as absolutely-
 * positioned cells inside the bar's relative container; we animate
 * `left` / `width` / `opacity`. The anchor (back-hinge) sits above its
 * children (z-index) on a --m-paper-2 backdrop so the cascade emerges from
 * behind it.
 * ════════════════════════════════════════════════════════════════════════ */

// Accordion timing (spec §4 · "do not re-invent"). Item slide duration,
// the beat-2 overlap fraction, and the per-child stagger. These are the
// accordion-specific knobs; the trail/pill/glow stay on the four --bn-* knobs.
const ACC_DUR = 280; // ms — the accordion slide, per beat
const ACC_STAGGER = 40; // ms — slide-from-corner cascade, per child
const ACC_EASE = 'cubic-bezier(.32,.72,0,1)'; // decelerate-out

type CellTransform = {
  /** left edge as a % of the bar width */
  left: number;
  /** width as a % of the bar width */
  width: number;
  opacity: number;
  /** transition-delay in ms (for the staggered cascade) */
  delay: number;
};

function BottomNavAccordion({ menus }: { menus: BottomNavMenu[] }) {
  const pathname = usePathname() ?? '';
  const reduced = usePrefersReducedMotion();

  // Cap at 6 menus (spec §2). Beyond that the bar can't lay out cleanly.
  const topMenus = menus.slice(0, 6);

  useEffect(() => {
    if (menus.length > 6) {
      // eslint-disable-next-line no-console
      console.warn(
        `BottomNav(accordion): ${menus.length} menus — only the first 6 render (spec §2 "six fixed menus").`,
      );
    }
    for (const m of menus) {
      if (m.children && m.children.length > 5) {
        // eslint-disable-next-line no-console
        console.warn(
          `BottomNav(accordion): menu "${m.key}" has ${m.children.length} children — capped at 5 (spec §5.4).`,
        );
      }
    }
  }, [menus]);

  // open = the index (into topMenus) of the currently expanded menu, or null
  // for primary mode. `animating` locks input during a beat (spec §4).
  const [open, setOpen] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // `entering` = true for the FIRST paint after a mode change so the FRESHLY-
  // MOUNTED CHILD cells start parked behind the corner anchor (left:0,
  // opacity:0) and then transition out to their slots — that's what makes the
  // children "slide out from behind the corner" (spec §3 beat 2) rather than
  // fade in place. The top-menu cells (primary slots + hinge + parked) are NOT
  // parked by `entering`: they carry a STABLE `m-${key}` key across modes, so
  // they persist and glide from their real current positions on their own —
  // parking them would re-snap them and reintroduce the jump this fix removed.
  // Flipped to false on the next animation frame so the CSS transition runs.
  const [entering, setEntering] = useState(false);

  // Press feedback — shared with the flat path's machinery. `pressed` drives
  // the icon-grow; `flash` drives the one-shot white press-light bloom. Both
  // index into the CURRENT mode's slot map.
  const [pressed, setPressed] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ index: number; id: number } | null>(
    null,
  );
  useEffect(() => {
    if (pressed === null) return;
    const clear = () => setPressed(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, [pressed]);

  useEffect(
    () => () => {
      if (animTimer.current) clearTimeout(animTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Drop the `entering` park on the next frame after a mode change so the
  // CSS transition animates the cells from the corner out to their slots.
  useEffect(() => {
    if (!entering) return;
    rafRef.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntering(false)),
    );
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [entering]);

  // Which menu's section claims the current route (so the back-hinge pill +
  // child highlight resolve correctly while a section is open) AND which top
  // menu lights in primary mode.
  const activeMenuIndex = useMemo(
    () =>
      topMenus.findIndex(
        (m) =>
          matchesPath(pathname, m) ||
          (m.children?.some((c) => matchesPath(pathname, c)) ?? false),
      ),
    [topMenus, pathname],
  );

  // Keep the OPENED section expanded across navigation — owner 2026-06-15:
  // "when I tap a button, the bottom nav must NOT reset; it should stay where
  // the icon is pressed." This REVERSES the prior auto-collapse-on-route-change:
  // tapping a child now navigates AND keeps its section open, so the traveling
  // pill simply glides to the freshly-active child. `open` persists naturally
  // because the bar lives in the dashboard layout (Next.js doesn't remount it
  // across in-section navigation). We only (a) clear any stale animation lock
  // from a fast nav, and (b) if a section is open and the new route belongs to a
  // DIFFERENT top menu (an on-page link that jumped sections), follow it into
  // that menu's section. Primary mode stays primary — navigation NEVER auto-
  // opens a section the user didn't tap (open === null is preserved).
  useEffect(() => {
    if (animTimer.current) clearTimeout(animTimer.current);
    setAnimating(false);
    setEntering(false);
    setOpen((prev) =>
      prev === null ? null : activeMenuIndex >= 0 ? activeMenuIndex : prev,
    );
  }, [pathname, activeMenuIndex]);

  const openMenu = open !== null ? topMenus[open] : null;
  const openChildren = openMenu?.children?.slice(0, 5) ?? [];

  // Slot count of the CURRENT mode: primary = #menus; section = 1 (hinge) + #children.
  const n =
    open !== null ? 1 + openChildren.length : topMenus.length;
  const colW = 100 / Math.max(n, 1);

  // Active slot index in the CURRENT mode (drives the traveling pill).
  let activeSlot = -1;
  if (open !== null && openMenu) {
    // Section mode — light the active child (slot 1..n) or the hinge (slot 0)
    // if the menu's own route is active.
    const childIdx = openChildren.findIndex((c) => matchesPath(pathname, c));
    if (childIdx >= 0) activeSlot = 1 + childIdx;
    else if (matchesPath(pathname, openMenu)) activeSlot = 0;
    else activeSlot = 0; // default: the hinge anchors the section
  } else {
    activeSlot = activeMenuIndex;
  }

  // Transition string honoring reduced-motion (near-instant cross-fade).
  const cellTransition = reduced
    ? 'opacity 80ms linear'
    : `left ${ACC_DUR}ms ${ACC_EASE}, width ${ACC_DUR}ms ${ACC_EASE}, opacity ${ACC_DUR}ms ${ACC_EASE}`;

  // Begin a mode change with the input-lock window (spec §4 "ignore taps
  // while animating"). The lock clears after one beat-stack (~ACC_DUR +
  // the full cascade), or instantly under reduced motion.
  const beginAnim = useCallback(() => {
    if (animTimer.current) clearTimeout(animTimer.current);
    setAnimating(true);
    // Park the incoming cells behind the corner for one frame so they slide
    // OUT (skipped under reduced motion → instant cross-fade, no slide).
    if (!reduced) setEntering(true);
    const total = reduced
      ? 90
      : ACC_DUR + ACC_STAGGER * 5 + 60; // worst-case 5-child cascade + buffer
    animTimer.current = setTimeout(() => setAnimating(false), total);
  }, [reduced]);

  const expand = useCallback(
    (menuIndex: number) => {
      if (animating) return;
      beginAnim();
      setOpen(menuIndex);
    },
    [animating, beginAnim],
  );

  const collapse = useCallback(() => {
    if (animating) return;
    // The persisted parked menu cells (stable `m-${key}`) already sit off-edge
    // in section mode, so flipping back to primary mode lets them glide from
    // their off-edge positions to `i*colW` — the collapse reverses naturally
    // without tracking which menu was open.
    beginAnim();
    setOpen(null);
  }, [animating, beginAnim]);

  // ── Build the absolutely-positioned cell list for the CURRENT mode ──────
  // Each top menu AND each child of the open menu gets a cell. Cells the
  // current mode doesn't show are parked off-edge at opacity 0 so the slide
  // reads (menus to the hinge's left exit left; to its right exit right).

  type Cell = {
    nodeKey: string;
    item: BottomNavItem;
    /** the slot this cell occupies in the CURRENT mode, or -1 if off-stage */
    slot: number;
    transform: CellTransform;
    /** role for press/active resolution + chevron swap */
    role: 'menu' | 'hinge' | 'child';
    /** for hinge: collapse on tap; for child/menu: navigate or expand */
    onActivate?: () => void;
    /** menu index it belongs to (for expand) */
    menuIndex?: number;
  };

  const cells: Cell[] = [];

  if (open === null) {
    // PRIMARY MODE — six menus in their slots, each at its REAL position.
    //
    // 🔑 STABLE KEY + NO ENTERING PARK (FIX 2026-06-15). Every top menu `i`
    // uses the SAME `m-${m.key}` key it carries in section mode (as the hinge
    // or a parked cell), so React PERSISTS the element across the mode flip
    // instead of unmounting + remounting it at its destination. Because the
    // element persists, simply rendering its real `left`/`width`/`opacity`
    // here lets the CSS transition GLIDE it from wherever it was (off-edge
    // when collapsing back from a section) to `i*colW`. We do NOT apply the
    // `entering` park to these menu cells — they must start from their real
    // current positions for the transition to run (parking them would re-snap
    // them off-edge for a frame and reintroduce the very jump we're killing).
    topMenus.forEach((m, i) => {
      cells.push({
        nodeKey: `m-${m.key}`,
        item: m,
        slot: i,
        role: 'menu',
        menuIndex: i,
        transform: {
          left: i * colW,
          width: colW,
          opacity: 1,
          delay: 0,
        },
      });
    });
  } else if (openMenu) {
    // SECTION MODE — hinge at slot 0, children at slots 1..n.
    // The hinge is the open menu and KEEPS its own glyph (the logo); tapping it
    // collapses the section (owner 2026-06-15 "the logo stays, not a back button").
    //
    // 🔑 STABLE KEY (FIX 2026-06-15). The hinge reuses the open menu's primary
    // key `m-${openMenu.key}` (NOT a fresh `hinge-*` key), so it is the SAME
    // element that sat at slot `open` in primary mode — it persists and
    // transitions `open*colW` → 0 (glides to the corner) instead of snapping.
    // No `entering` park here for the same reason as the primary menus.
    cells.push({
      nodeKey: `m-${openMenu.key}`,
      item: openMenu,
      slot: 0,
      role: 'hinge',
      transform: { left: 0, width: colW, opacity: 1, delay: 0 },
    });
    openChildren.forEach((c, i) => {
      const slot = 1 + i;
      cells.push({
        nodeKey: `c-${openMenu.key}-${c.key}`,
        item: c,
        slot,
        role: 'child',
        // Children are FRESHLY MOUNTED on expand, so the `entering` park is
        // kept ONLY for them — they start parked behind the hinge corner
        // (slot 0, invisible) and slide OUT to their slots (spec §3 beat 2).
        transform: entering
          ? // Beat 2 start: parked behind the hinge corner (slot 0), invisible.
            { left: 0, width: colW, opacity: 0, delay: 0 }
          : {
              left: slot * colW,
              width: colW,
              opacity: 1,
              // Cascade: beat 2 starts at ~45% of beat 1, then each child
              // staggers ~40ms after the previous (slide-from-corner).
              delay: reduced ? 0 : Math.round(ACC_DUR * 0.45) + i * ACC_STAGGER,
            },
      });
    });
    // Park the OTHER top menus off-edge. They keep their STABLE `m-${m.key}`
    // key so they are the SAME elements that sat at `i*colW` in primary mode:
    // on expand they persist and transition `i*colW` → off-edge (left of the
    // open menu slide off the left, right slide off the right). They're
    // invisible + non-interactive while parked.
    topMenus.forEach((m, i) => {
      if (i === open) return; // the hinge already represents the open menu
      cells.push({
        nodeKey: `m-${m.key}`,
        item: m,
        slot: -1,
        role: 'menu',
        menuIndex: i,
        transform: {
          // left of the open menu exits left (negative); right exits right.
          left: i < open ? -colW : 100,
          width: colW,
          opacity: 0,
          delay: 0,
        },
      });
    });
  }

  if (topMenus.length < 1) return null;

  return (
    <NavShell>
      {/* Fixed-height stage so the absolutely-positioned cells have a box to
          lay out in. 64px ≈ the flat bar's `py-1` + `min-h-[56px]` cells, so
          the accordion bar is the same height as the flat one. */}
      <div className="relative overflow-hidden" style={{ height: 64 }}>
        {/* Active pill — travels to the active slot in the CURRENT mode. */}
        {activeSlot >= 0 ? (
          <TravelPill index={activeSlot} colW={colW} />
        ) : null}

        {/* Press light — one-shot white bloom on press-down at the pressed
            slot. Re-keyed per press; never travels. */}
        {flash ? (
          <PressFlash index={flash.index} colW={colW} flashId={flash.id} />
        ) : null}

        {/* Absolutely-positioned cells — animate left/width/opacity. */}
        <div className="relative z-10 h-full" aria-hidden={false}>
          {cells.map((cell) => {
            const slotActive = cell.slot >= 0 && cell.slot === activeSlot;
            const isPressed = cell.slot >= 0 && pressed === cell.slot;
            const interactive = cell.slot >= 0; // parked cells are inert
            const press = () => {
              if (!interactive) return;
              setPressed(cell.slot);
              setFlash((f) => ({
                index: cell.slot,
                id: f ? f.id + 1 : 1,
              }));
            };
            const release = () => setPressed(null);

            return (
              <AccordionCell
                key={cell.nodeKey}
                item={cell.item}
                role={cell.role}
                active={slotActive}
                pressed={isPressed}
                interactive={interactive}
                transform={cell.transform}
                transition={cellTransition}
                // The anchor (hinge) sits above its children so the cascade
                // emerges from behind it; parked menus sit below everything.
                z={cell.role === 'hinge' ? 3 : cell.slot >= 0 ? 2 : 1}
                onPressStart={press}
                onPressEnd={release}
                onActivate={() => {
                  if (animating) return;
                  if (cell.role === 'hinge') {
                    collapse();
                  } else if (cell.role === 'menu') {
                    const m = cell.item as BottomNavMenu;
                    if (m.children && m.children.length > 0) {
                      expand(cell.menuIndex!);
                    }
                    // No children → the cell is a real <Link>, navigation
                    // happens via the anchor; nothing to do here.
                  }
                  // children → real <Link> navigation; the section STAYS open
                  // on route change (owner 2026-06-15) so the pill glides to
                  // the freshly-active child — see the keep-open effect above.
                }}
              />
            );
          })}
        </div>
      </div>
    </NavShell>
  );
}

/* ── shared chrome ─────────────────────────────────────────────────────── */

/** The floating frosted-glass pill shell + the four central tuning knobs.
 *  Shared by both the flat and accordion render paths so the bar geometry +
 *  the --bn-* knobs stay a single source of truth (lint guard markers live
 *  here). */
function NavShell({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed left-[14px] right-[14px] bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 overflow-hidden rounded-full border backdrop-blur lg:hidden"
      style={
        {
          // FLOATING PILL bar (owner-locked 2026-06-13 "long floating pill,
          // use as the template"). Inset 14px from each edge, floating 12px
          // above the safe-area, fully rounded (rounded-full) — NOT an
          // edge-to-edge bottom strip. Frosted-glass: slightly desaturated
          // paper so the WHITE press light reads against it (a white glow on
          // pure white is invisible — same reason Instagram's bar is grey).
          background: 'rgba(248, 246, 240, 0.92)', // --m-paper-2 @ 92% alpha
          borderColor: 'var(--m-line)',
          // Soft drop shadow gives the "floating above the page" read.
          boxShadow: '0 10px 30px -12px rgba(30, 34, 41, 0.35)',
          // 🔒 The four central tuning knobs (owner-locked baseline 2026-06-13).
          // Retune the whole app's nav feel by editing ONLY these four.
          '--bn-dur': '500ms',
          '--bn-grow': '1.15',
          '--bn-glow': '1.5',
          '--bn-stretch': '1.1',
        } as CSSProperties
      }
    >
      {children}
    </nav>
  );
}

/** The traveling dark stadium pill (--m-ink @ 15%) — travels on release with
 *  the spring + the .nav-pill-stretch liquid stretch keyframe (re-keyed per
 *  index). The single active-indicator for BOTH render paths. */
function TravelPill({ index, colW }: { index: number; colW: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 z-0"
      style={{
        left: 0,
        width: `${colW}%`,
        height: 44,
        transform: `translateY(-50%) translateX(${index * 100}%)`,
        transition: 'transform var(--bn-dur) cubic-bezier(0.34, 1.4, 0.5, 1)',
      }}
    >
      <span
        key={index}
        className="nav-pill-stretch absolute inset-y-0"
        style={{
          // CONSISTENT capsule, centered in the cell — NOT cell-filling.
          // A fixed ~52px width (capped to the cell on a tight 6-tab bar)
          // keeps the pill identical across 3/4/5/6-tab consoles, instead
          // of ballooning in admin's wide 4-tab cells. marginInline:auto
          // centers it without a transform so the stretch keyframe stays
          // clean. (owner 2026-06-13 "template must adjust for 3/4/5/6")
          left: 0,
          right: 0,
          marginInline: 'auto',
          width: 'min(52px, calc(100% - 8px))',
          borderRadius: 999,
          background: 'rgba(30, 34, 41, 0.15)', // --m-ink @ 15% — bolder so the active tab reads at a glance
        }}
      />
    </span>
  );
}

/** The one-shot WHITE press-light bloom under the finger on press-down. Fills
 *  the pill top-to-bottom (tall element clipped by the row) and feathers only
 *  at the left/right ends. Re-keyed per press (flashId) so even a quick TAP
 *  plays the full bloom-and-fade; never travels — it jumps to the pressed
 *  column. The .nav-press-flash hook is a lint-guard marker. */
function PressFlash({
  index,
  colW,
  flashId,
}: {
  index: number;
  colW: number;
  flashId: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 z-[1]"
      style={{
        left: 0,
        width: `${colW}%`,
        height: 44,
        transform: `translateY(-50%) translateX(${index * 100}%)`,
      }}
    >
      <span
        key={flashId}
        className="nav-press-flash absolute left-1/2 top-1/2"
        style={{
          // Consistent width (slightly wider than the pill for the feather),
          // capped to the cell — matches the pill so the press-light reads
          // identically across 3/4/5/6-tab bars. Centered via translate.
          width: 'min(64px, calc(100% - 2px))',
          height: 90,
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.95)',
          filter: 'blur(12px)',
          opacity: 0,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </span>
  );
}

/* ── flat-path tab cell (unchanged) ────────────────────────────────────── */

function BottomNavTab({
  item,
  active,
  pressed,
  onPressStart,
  onPressEnd,
}: {
  item: BottomNavItem;
  active: boolean;
  pressed: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
        className="flex min-h-[56px] min-h-[44pt] select-none flex-col items-center justify-center gap-0.5 px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          color: active ? 'var(--m-ink)' : 'var(--m-slate)',
          outlineColor: 'var(--m-orange)',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        <span className="relative inline-flex">
          <Icon
            aria-hidden
            className="h-[22px] w-[22px]"
            strokeWidth={1.75}
            style={{
              color: active ? 'var(--m-orange)' : 'var(--m-slate)',
              transform: `scale(${pressed ? 'var(--bn-grow)' : '1'})`,
              transition: 'transform 175ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
          {item.badge && item.badge.count > 0 ? (
            <BadgeDot tone={item.badge.tone} count={item.badge.count} label={item.badge.label} />
          ) : null}
        </span>
        <span
          className="whitespace-nowrap text-[10px] tracking-wide"
          style={{ fontWeight: active ? 600 : 400 }}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}

/* ── accordion-path cell ───────────────────────────────────────────────── */

/**
 * AccordionCell — one absolutely-positioned cell in the accordion bar. A
 * menu without children + every child renders as a <Link> (real navigation);
 * a menu WITH children + the back-hinge render as a <button> (open/close the
 * section). All share the locked icon-grow-on-press + the gold active icon.
 *
 * The hinge KEEPS the open menu's own glyph (e.g. the Setnayan logo) rather than
 * swapping to a back-chevron, and tapping it collapses the section back to the
 * six menus (owner 2026-06-15 "the logo stays, not a back button").
 */
function AccordionCell({
  item,
  role,
  active,
  pressed,
  interactive,
  transform,
  transition,
  z,
  onPressStart,
  onPressEnd,
  onActivate,
}: {
  item: BottomNavItem;
  role: 'menu' | 'hinge' | 'child';
  active: boolean;
  pressed: boolean;
  interactive: boolean;
  transform: CellTransform;
  transition: string;
  z: number;
  onPressStart: () => void;
  onPressEnd: () => void;
  onActivate: () => void;
}) {
  const Icon = item.icon;
  const isMenuWithChildren =
    role === 'menu' &&
    Array.isArray((item as BottomNavMenu).children) &&
    ((item as BottomNavMenu).children?.length ?? 0) > 0;

  // A real navigation happens for: a menu WITHOUT children, and every child.
  // The back-hinge + a menu WITH children are buttons (open/close), no nav.
  const asLink = role === 'child' || (role === 'menu' && !isMenuWithChildren);

  const inner = (
    <>
      <span className="relative inline-flex">
        {/* The hinge keeps its OWN glyph (e.g. the Setnayan logo) — NOT a
            back-chevron (owner 2026-06-15: "the logo stays, not a back button").
            It still toggles the section closed on tap; rendered in ink so it
            reads as the section anchor while a child holds the active pill. */}
        <Icon
          aria-hidden
          className="h-[22px] w-[22px]"
          strokeWidth={role === 'hinge' ? 2 : 1.75}
          style={{
            color:
              role === 'hinge'
                ? active
                  ? 'var(--m-orange)'
                  : 'var(--m-ink)'
                : active
                  ? 'var(--m-orange)'
                  : 'var(--m-slate)',
            transform: `scale(${pressed ? 'var(--bn-grow)' : '1'})`,
            transition: 'transform 175ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        {item.badge && item.badge.count > 0 ? (
          <BadgeDot
            tone={item.badge.tone}
            count={item.badge.count}
            label={item.badge.label}
          />
        ) : null}
      </span>
      <span
        className="max-w-full truncate whitespace-nowrap text-[10px] tracking-wide"
        style={{ fontWeight: active ? 600 : 400 }}
      >
        {item.label}
      </span>
    </>
  );

  const cellStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${transform.left}%`,
    width: `${transform.width}%`,
    opacity: transform.opacity,
    transition,
    transitionDelay: `${transform.delay}ms`,
    zIndex: z,
    // The hinge sits on a paper backdrop so the children cascade emerges from
    // behind it (spec §7 "anchor above children with a --m-paper-2 bg").
    background: role === 'hinge' ? 'var(--m-paper-2)' : 'transparent',
  };

  const className =
    'flex min-h-[56px] min-h-[44pt] h-full w-full select-none flex-col items-center justify-center gap-0.5 px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const contentStyle: CSSProperties = {
    color: active ? 'var(--m-ink)' : 'var(--m-slate)',
    outlineColor: 'var(--m-orange)',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  };

  const pointerHandlers = {
    onPointerDown: onPressStart,
    onPointerUp: onPressEnd,
    onPointerLeave: onPressEnd,
    onPointerCancel: onPressEnd,
  };

  return (
    <div style={cellStyle}>
      {asLink ? (
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          aria-hidden={!interactive}
          tabIndex={interactive ? undefined : -1}
          {...pointerHandlers}
          onClick={onActivate}
          className={className}
          style={{
            ...contentStyle,
            pointerEvents: interactive ? undefined : 'none',
          }}
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={
            role === 'menu' ? false : role === 'hinge' ? true : undefined
          }
          aria-label={
            role === 'hinge'
              ? `Collapse ${item.label} menu`
              : `Open ${item.label}`
          }
          aria-hidden={!interactive}
          tabIndex={interactive ? undefined : -1}
          {...pointerHandlers}
          onClick={onActivate}
          className={className}
          style={{
            ...contentStyle,
            pointerEvents: interactive ? undefined : 'none',
          }}
        >
          {inner}
        </button>
      )}
    </div>
  );
}

/**
 * Compact badge dot over the top-right of the icon. Same tone palette as
 * the sidebar badge but smaller — bottom-nav real-estate is too tight for
 * a full pill, so the dot + sr-only label carries the count for AT.
 */
function BadgeDot({
  tone,
  count,
  label,
}: {
  tone: NavBadgeTone;
  count: number;
  label?: string;
}) {
  const toneStyle: Record<NavBadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: '#E7E5E4', fg: '#44403C' },
    amber: { bg: '#FEF3C7', fg: '#78350F' },
    red: { bg: '#FEE2E2', fg: '#7F1D1D' },
    orange: { bg: 'var(--m-orange)', fg: '#FFFFFF' },
  };
  const { bg, fg } = toneStyle[tone];
  const display = count > 9 ? '9+' : String(count);

  return (
    <span
      aria-label={label ?? `${count} new`}
      className="absolute -right-1.5 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none"
      style={{ background: bg, color: fg }}
    >
      {display}
    </span>
  );
}
