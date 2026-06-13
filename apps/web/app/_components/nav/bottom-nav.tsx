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
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BottomNavItem, NavBadgeTone } from './types';

type Props = {
  items: BottomNavItem[];
};

function useIsActive(pathname: string) {
  return useCallback(
    (item: BottomNavItem) => {
      const matches = Array.isArray(item.activeMatch)
        ? item.activeMatch
        : [item.activeMatch];
      return item.activeMatchExact
        ? matches.some((prefix) => pathname === prefix)
        : matches.some(
            (prefix) =>
              pathname === prefix || pathname.startsWith(prefix + '/'),
          );
    },
    [pathname],
  );
}

export function BottomNav({ items }: Props) {
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
      <div className="relative overflow-hidden">
        {/* Active pill — travels on release. Outer track carries the
            horizontal position (transitioned); inner span carries the
            stretch keyframe (re-keyed per active index). Hidden when no
            tab matches the current route. */}
        {activeIndex >= 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 z-0"
            style={{
              left: 0,
              width: `${colW}%`,
              height: 44,
              transform: `translateY(-50%) translateX(${activeIndex * 100}%)`,
              transition:
                'transform var(--bn-dur) cubic-bezier(0.34, 1.4, 0.5, 1)',
            }}
          >
            <span
              key={activeIndex}
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
        ) : null}

        {/* Press light — a one-shot WHITE bloom under the finger on
            press-down. Fills the pill top-to-bottom (tall element clipped by
            the row) and feathers only at the left/right ends. Re-keyed per
            press (flash.id) so even a quick TAP plays the full bloom-and-fade;
            never travels — it jumps to the pressed column. */}
        {flash ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 z-[1]"
            style={{
              left: 0,
              width: `${colW}%`,
              height: 44,
              transform: `translateY(-50%) translateX(${flash.index * 100}%)`,
            }}
          >
            <span
              key={flash.id}
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
        ) : null}

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
    </nav>
  );
}

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
