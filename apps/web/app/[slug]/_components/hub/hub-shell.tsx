'use client';

/**
 * HubShell — the fullscreen, no-scroll event-day "hub" for guests (Phase 2 of
 * the event-day guest-hub program · DECISION_LOG 2026-06-28).
 *
 * Owner centerpiece: "On the day, a guest opens their event page on their
 * phone and sees ONE screen-filling, no-scroll hub with a bottom MENU that
 * toggles between the day-of functions — instead of a long scrolling page.
 * Everything shows in realtime, fills the screen, menu to toggle between
 * functions."
 *
 * This is a SEPARATE fullscreen route (/[slug]/hub) — the long-scrolling
 * /[slug] page (4,100+ lines, also serving STD/reveal/RSVP/anonymous) stays
 * 100% intact. The hub is reachable from the event-day bottom bar.
 *
 * ARCHITECTURE. The SERVER (hub/page.tsx) resolves the guest identity + every
 * panel's data and renders each panel's CONTENT as a ReactNode, handing them
 * here as named props (`now`, `schedule`, …). This client shell owns only the
 * fixed-height chrome + the menu toggle: it never touches the DB. A panel prop
 * that is `null` means that function isn't available for this viewer/phase, so
 * its menu slot is dropped (a no-guest viewer has no `me`; a non-live event has
 * no `watch`). Menu meta (icon + label) lives here so no component type crosses
 * the server→client boundary.
 *
 * NO-SCROLL SHELL. `fixed inset-0` flex column: a slim signature header (safe-
 * area top) + the panel region (the only scrollable area, for a long Schedule)
 * + the bottom toggle menu (safe-area bottom). The PAGE never scrolls.
 *
 * REALTIME. `useDayOfLiveTick` re-runs the server component (router.refresh)
 * on a quiet cadence + on tab-focus while the wedding day is active — the
 * pull-only "live propagation" the rest of the day-of surfaces already use, so
 * "everything shows in realtime" without any push/socket infra. The active
 * panel (client state) survives the refresh.
 *
 * MENU. Respects the responsive ruleset — ≤5 primary pill slots + a "More"
 * overflow sheet on mobile. The aesthetic echoes the canonical floating
 * frosted-pill BottomNav, but this is a PANEL TOGGLE (one route, client state),
 * not route navigation — so it deliberately does not mount the canonical
 * `BottomNav` (which is usePathname/<Link>-driven) and is not named
 * `*-bottom-nav.tsx` (the delegation lint guard keys on that name).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CalendarClock,
  Camera,
  Images,
  MapPin,
  MoreHorizontal,
  Radio,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';

export type HubPanelKey =
  | 'now'
  | 'watch'
  | 'camera'
  | 'photos'
  | 'me'
  | 'schedule'
  | 'directions';

// Menu meta lives client-side (icon component types can't cross the RSC
// boundary). The array order is the canonical PRIORITY order — the first five
// AVAILABLE panels become the primary pills, the rest fall into "More". Watch
// rides high so a live broadcast is one tap away; Schedule/Directions are
// reference panels that comfortably live under More when the bar is full.
const MENU: { key: HubPanelKey; label: string; icon: LucideIcon }[] = [
  { key: 'now', label: 'Now', icon: Activity },
  { key: 'watch', label: 'Watch', icon: Radio },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'photos', label: 'Photos', icon: Images },
  { key: 'me', label: 'Me', icon: User },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock },
  { key: 'directions', label: 'Directions', icon: MapPin },
];

const MAX_PRIMARY = 5;

export function HubShell({
  eventDate,
  header,
  now,
  watch,
  camera,
  photos,
  me,
  schedule,
  directions,
}: {
  /** Event date (drives the realtime tick; inert outside the wedding day). */
  eventDate: string | null;
  /** Slim signature header (monogram / names + live badge), server-rendered. */
  header: ReactNode;
  now: ReactNode;
  watch: ReactNode | null;
  camera: ReactNode | null;
  photos: ReactNode | null;
  me: ReactNode | null;
  schedule: ReactNode | null;
  directions: ReactNode | null;
}) {
  const router = useRouter();
  // Pull-only realtime: re-read current truth on a quiet cadence while the
  // wedding day is active + the tab is visible (no push/socket). The active
  // panel is local state, so it survives the server refresh.
  useDayOfLiveTick(eventDate, () => router.refresh());

  const panels: Record<HubPanelKey, ReactNode | null> = {
    now,
    watch,
    camera,
    photos,
    me,
    schedule,
    directions,
  };

  const available = MENU.filter((m) => panels[m.key] != null);
  const primary = available.slice(0, MAX_PRIMARY);
  const overflow = available.slice(MAX_PRIMARY);

  const [active, setActive] = useState<HubPanelKey>('now');
  const [moreOpen, setMoreOpen] = useState(false);

  // If a realtime refresh removes the active panel (e.g. the live window
  // closed → Watch disappears), fall back to the first still-available panel
  // so we never render a blank stage.
  useEffect(() => {
    if (!available.some((m) => m.key === active)) {
      setActive(available[0]?.key ?? 'now');
    }
  }, [available, active]);

  const moreSheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    containerRef: moreSheetRef,
  });

  const overflowActive = overflow.some((m) => m.key === active);

  function select(key: HubPanelKey) {
    setActive(key);
    setMoreOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream text-ink">
      {/* Signature header — slim, safe-area aware. */}
      <header className="shrink-0 border-b border-ink/8 bg-cream/80 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)] backdrop-blur">
        {header}
      </header>

      {/* Panel stage — the ONLY scrollable region (a long Schedule). The page
          itself never scrolls. Re-mounted per panel so the entrance plays. */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
        <PanelFade key={active}>{panels[active]}</PanelFade>
      </main>

      {/* Bottom toggle menu — ≤5 primary pills + a More overflow sheet. */}
      <nav
        aria-label="Event hub"
        className="shrink-0 border-t border-ink/10 bg-cream/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur"
      >
        <ul
          className="mx-auto grid max-w-md gap-1"
          style={{
            gridTemplateColumns: `repeat(${primary.length + (overflow.length > 0 ? 1 : 0)}, minmax(0, 1fr))`,
          }}
        >
          {primary.map((m) => (
            <li key={m.key}>
              <HubMenuButton
                label={m.label}
                icon={m.icon}
                active={active === m.key}
                onClick={() => select(m.key)}
              />
            </li>
          ))}
          {overflow.length > 0 ? (
            <li>
              <HubMenuButton
                label="More"
                icon={MoreHorizontal}
                active={overflowActive}
                onClick={() => setMoreOpen((v) => !v)}
                expanded={moreOpen}
              />
            </li>
          ) : null}
        </ul>
      </nav>

      {/* More overflow sheet — anchored above the menu. */}
      {moreOpen && overflow.length > 0 ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More event functions"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-ink/10 bg-cream p-3 shadow-2xl"
          >
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                More
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-1">
              {overflow.map((m) => {
                const Icon = m.icon;
                return (
                  <li key={m.key}>
                    <button
                      type="button"
                      onClick={() => select(m.key)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                        active === m.key
                          ? 'bg-ink text-cream'
                          : 'text-ink hover:bg-ink/5'
                      }`}
                    >
                      <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                      {m.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One toggle pill in the bottom menu. Active = filled ink pill (the signature
 *  read), restrained transition. ≥44px tap target. */
function HubMenuButton({
  label,
  icon: Icon,
  active,
  onClick,
  expanded,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      aria-expanded={expanded}
      className={`flex min-h-[44px] w-full select-none flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition ${
        active
          ? 'bg-ink text-cream'
          : 'text-ink/60 hover:text-ink'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      <Icon
        aria-hidden
        className="h-[20px] w-[20px]"
        strokeWidth={active ? 2 : 1.75}
      />
      <span className="text-[0.6rem] font-semibold leading-none tracking-wide">
        {label}
      </span>
    </button>
  );
}

/** A restrained entrance for the freshly-shown panel — the hub's one signature
 *  moment (premium-UI doctrine). Skipped under prefers-reduced-motion. */
function PanelFade({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 260ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
}
