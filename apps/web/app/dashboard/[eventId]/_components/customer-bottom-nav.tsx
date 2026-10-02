'use client';

/**
 * CustomerBottomNav — the phone's ONE bottom bar inside an event (Stage D,
 * owner 2026-09-29: *"on mobile mode. we do not want that sub bottom nav
 * anymore. we want it to be simple and easy to manage"*).
 *
 *     Home · Guests · Suppliers · Hub · More
 *
 * The same five in every phase (owner 2026-10-01, DECISION_LOG "THE BOTTOM BAR
 * IS HOME · GUESTS · SUPPLIERS · HUB · MORE"), in the rail's own words, picked out of the one tree in
 * `lib/customer-menu.ts` (`buildCustomerMenuTree`) — the desktop rail draws
 * the same rows under the same words. Nothing docks above this bar; a
 * pillar's parts are chosen inside its page. "More" opens a small chooser
 * sheet with the five services (owner 2026-09-30) — never a sub-row.
 *
 * NAV REGISTRY: `navSlots` (`customer.bottom-nav.<key>`) overlays the
 * admin-managed label + icon on each tab; a slot marked hidden drops its tab.
 * Keys `home` · `guests` · `explore` · `launch` · `studio` — each has its slot
 * in NAV_SLOT_DEFAULTS. href + activeMatch always stay in code.
 *
 * Renders via the shared <BottomNav> primitive — traveling-pill + press-light
 * treatment is reused verbatim. Mobile-only (`lg:hidden`).
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { asksForMoreServices } from '@/lib/studio-hub';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { LucideIcon } from 'lucide-react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { buildCustomerMenuTree, type EventMenuChild, type EventStudioRow } from '@/lib/customer-menu';

/* The "More" chooser — fetched on the first tap with a plain `import()`, never
   in the first load. ⚠ NOT `next/dynamic`: that pulled next's loadable runtime
   (~4 KB raw) into this event-layout chunk and put the Maker 0.5 KB over its
   505 KB ceiling (measured 2026-10-01 against origin/main dc916d040). */
type MoreSheet = typeof import('./more-services-sheet').default;
import { customerGuestsBadge } from '@/lib/nav-badges';

export function CustomerBottomNav({
  eventId,
  phase = 'plan',
  navSlots,
  hideKeys,
  guestCount,
  seatingEnabled,
  websiteEnabled,
  studioRows,
  storeShell,
  services,
}: {
  eventId: string;
  phase?: MenuLifecyclePhase;
  navSlots?: Record<string, NavSlotLite>;
  /**
   * Live guest head-count → the Guests tab's badge, identical to the one the
   * desktop sidebar has always shown. Resolved server-side in layout.tsx and
   * fail-soft there, so 0/null means "none or could not tell" and the shared
   * helper renders nothing rather than a badge claiming zero.
   */
  guestCount?: number | null;
  /** Top-level menu keys to drop for this event type (['explore'] for a
   *  vendor-free Simple Event). Resolved from the profile in layout.tsx. */
  hideKeys?: string[];
  /** Whether this event type enables 'seating' — gates the Seat plan rail row,
   *  whose pages light the Guest list tab here. Resolved in layout.tsx. */
  seatingEnabled?: boolean;
  /**
   * Whether this event type enables the 'website' surface — gates the Event
   * Hub Maker tab.
   *
   * 🔴 THIS PROP DID NOT EXIST, AND THE TAB IT GATES NEVER RENDERED ON A PHONE.
   * `buildCustomerMenuTree` gates the plan-phase `launch` row on
   * `ctx.websiteEnabled`; this component never passed it, so the flag arrived
   * `undefined`, the gate read that as "no website surface", and the row was
   * dropped from every planning phone. The day-of and after rosters build their
   * `launch` row UNGATED, so the tab appeared the moment the wedding arrived —
   * which is exactly why nobody found it: the bug only existed before the day.
   *
   * 🔑 AND BEFORE THE DAY IS WHEN THE HUB IS THE PRODUCT. `customer-menu.ts`
   * says so itself, about the change that created this row: *"on a phone in the
   * months BEFORE the day — when the save-the-date and the invitation ARE the
   * product — the Hub was two taps deep behind a word for something else."*
   * That fix shipped, and on phones it never took effect.
   *
   * ⚠ UNDEFINED MEANS HIDE HERE — the opposite of `seatingEnabled` one field
   * up, whose docblock says *"a caller that has not been taught this field must
   * not silently lose the tab."* Two sibling gates, opposite defaults, and only
   * one of them was designed for the caller who had not been taught. That
   * asymmetry is the root cause, not a typo. The gate itself is RIGHT — an
   * event kind with no website surface must not offer the Hub, and the desktop
   * rail hides it too — so the caller is what gets fixed, plus a guard below so
   * the next caller cannot repeat it.
   */
  websiteEnabled?: boolean;
  /**
   * The event's Studio products as PLAIN DATA (key · href · name) — no longer
   * tabs, but the one tree claims each product's pages for the tab that holds
   * it (More Services, or the Maker for Mood Board / Logo), so a product page
   * still lights a tab. Without this list those pages light nothing.
   *
   * 🛑 Strings only. This is a `'use client'` component fed by a server
   * layout; a function prop here is the 2026-09-23 seven-hour outage.
   */
  studioRows?: ReadonlyArray<EventStudioRow>;
  /**
   * The App Store / Play Store shell, resolved server-side (`isStoreShellRequest()`
   * in layout.tsx). The one tree drops every tab whose door `lib/store-shell.ts`
   * refuses, so a refused tab is never built — a hidden-after-paint tab left a
   * blank slot in the grid (the Papic slot the owner saw on 2026-09-25).
   */
  storeShell?: boolean;
  /**
   * 📂 The five under More Services (owner 2026-09-30) — plain data built in
   * layout.tsx (`ourServicesMenuChildren`). The bar NEVER draws them as a sub-
   * row: its "More" tab opens a chooser sheet with them. Empty → the tab goes
   * to its address (Home, `?more=services`), where there is nothing to open.
   */
  services?: ReadonlyArray<EventMenuChild>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [MoreServicesSheet, setSheet] = useState<MoreSheet | null>(null);
  const openMore = () => {
    setMoreOpen(true);
    if (!MoreServicesSheet) void import('./more-services-sheet').then((x) => setSheet(() => x.default));
  };
  /* 🧭 THE MORE MENU HAS AN ADDRESS (owner 2026-10-02, tracker d1 — the
     full-page More Services is gone; "the More menu is the one place"). Every
     "open the services" link, and the two retired page paths, land on Home
     with `?more=services` (`studioHubHref`); on the phone that opens THIS
     sheet. Read on every URL change, so an in-app link opens it too. */
  const search = useSearchParams()?.toString() ?? '';
  const hasServices = !!services?.length;
  useEffect(() => {
    if (hasServices && asksForMoreServices(search)) openMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open on the URL, not on every render
  }, [search, hasServices]);
  const tree = buildCustomerMenuTree(eventId, { phase, hideKeys, seatingEnabled, websiteEnabled, studioRows, storeShell, services });

  const items: BottomNavItem[] = tree.flatMap((m) => {
    // Registry overrides (label + icon) — every tab has its
    // `customer.bottom-nav.<key>` slot in NAV_SLOT_DEFAULTS.
    const slot = navSlots?.[`customer.bottom-nav.${m.key}`];
    if (slot?.isHidden) return [];
    const label = slot?.label ?? m.label;
    // Keep the Setnayan mark on the Home tab as the code default when no
    // admin override has set an icon for the slot.
    const icon =
      slot
        ? navIconComponent(slot.icon)
        : m.key === 'home'
          ? (SetnayanMark as unknown as LucideIcon)
          : m.icon;
    // Live badge — the SAME helper the desktop rail's Guest list row uses, so
    // the phone and the laptop can never show different numbers for the same
    // thing. Only tabs whose sidebar twin already carries a badge get one;
    // inventing a count for a tab is a product decision, not a port detail.
    const badge = m.key === 'guests' ? customerGuestsBadge(guestCount) : undefined;
    return [
      {
        key: m.key,
        label,
        icon,
        href: m.href,
        activeMatch: m.activeMatch,
        activeMatchExact: m.activeMatchExact,
        ...(badge ? { badge } : {}),
        ...(m.key === 'studio' && services?.length
          ? {
              onSelect: openMore,
            }
          : {}),
      },
    ];
  });

  return (
    <>
      <BottomNav items={items} />
      {/* Mounted only while open — fetched on the first tap, nothing before. */}
      {moreOpen && MoreServicesSheet && services?.length ? (
        <MoreServicesSheet
          open
          onClose={() => setMoreOpen(false)}
          title="More Services"
          services={services}
        />
      ) : null}
    </>
  );
}
