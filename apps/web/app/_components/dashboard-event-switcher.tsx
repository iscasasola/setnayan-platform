'use client';

import Link from 'next/link';
import {
  EventSwitcher,
  type SwitcherEvent,
} from '@/app/dashboard/[eventId]/_components/event-switcher';
import { EmptyEventMonogram } from '@/app/_components/event-monogram';

/**
 * Dashboard event-switcher chrome affordance — shared across the three
 * doorways' top-left corner.
 *
 * WHY (owner directive 2026-06-02, verbatim): "i want the event switcher to
 * be visible on all 3 dashboards. located at the same location as customer
 * dashboard." The customer doorway already shows the monogram-▾ EventSwitcher
 * top-left on every route (event-scoped via [eventId]/layout.tsx, non-event
 * via OuterDashboardHeader). This wrapper lifts the *exact* non-event pattern
 * from OuterDashboardHeader (primary event as the anchor monogram, or the
 * empty-state "+" linking to create-event) so the vendor + admin doorways can
 * drop it into their SidebarShell topBar top-left — replacing the brand logo
 * that sat there — and read identically to the customer dashboard.
 *
 * SCOPE SPLIT (no console-row duplication): the switcher here owns EVENTS only
 * — `+ Add event`, the event list, and the anchor monogram that hops into the
 * primary event's couple dashboard. Cross-console hopping (Customer / Shop /
 * Admin) stays owned by the always-visible `RoleSwitchPill` that already lives
 * in every doorway's chrome, so we pass `hasVendorAccess`/`hasAdminAccess` as
 * `false` here — that suppresses `EventSwitcher`'s own "Switch view" section
 * (it renders nothing when both flags are false), avoiding two equally-
 * prominent paths to the same cross-console links. The shared `EventSwitcher`
 * component is therefore used verbatim — zero changes to it, zero risk to the
 * customer surfaces that already mount it.
 *
 * With zero couple events the anchor renders as the empty "+" monogram linking
 * to `/dashboard/create-event` (same fallback as OuterDashboardHeader).
 */

type PrimaryEventData = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  // Onboarding free-monogram design (owner-locked 2026-06-03). Forwarded so the
  // vendor + admin doorways' anchor renders the couple's REAL customized
  // monogram — without these keys EventMonogram falls back to the legacy
  // serif-italic "basic" badge (the bug the owner saw on vendor/admin chrome).
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
};

type Props = {
  primaryEvent: PrimaryEventData | null;
  switcherEvents: SwitcherEvent[];
};

export function DashboardEventSwitcher({ primaryEvent, switcherEvents }: Props) {
  if (!primaryEvent) {
    return (
      <Link
        href="/dashboard/create-event"
        aria-label="Create your first event"
        className="inline-flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
      >
        <EmptyEventMonogram size="md" />
        <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-ink/60 sm:inline">
          Add event
        </span>
      </Link>
    );
  }

  return (
    <EventSwitcher
      currentEventId={primaryEvent.event_id}
      currentEventName={primaryEvent.display_name}
      currentEventDate={primaryEvent.event_date}
      currentMonogramText={primaryEvent.monogram_text}
      currentMonogramColor={primaryEvent.monogram_color}
      currentMonogramFrameKey={primaryEvent.monogram_frame_key}
      currentMonogramFontKey={primaryEvent.monogram_font_key}
      events={switcherEvents}
      hasVendorAccess={false}
      hasAdminAccess={false}
      vendorProfiles={[]}
    />
  );
}
