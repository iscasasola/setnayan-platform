'use client';

/**
 * guest-drawer.tsx — the roster row's quick-view TRIGGER.
 *
 * ── What used to be here ────────────────────────────────────────────────────
 * A module-level store, a portalled sheet, and a read-only body. Until
 * 2026-09-22 a guest had two surfaces and this file was one of them: below xl
 * the eye opened a read-only sheet whose only exit into the form was a link
 * called "Open full details".
 *
 * Both are gone. `?inspect=<guestId>` now server-renders the whole guest card,
 * and `InspectorLayout mobileSheet` presents it as the peek sheet below xl — so
 * the sheet, its store and its host had nothing left to do. What remains is the
 * trigger, which selects the card at EVERY width.
 */

import { Eye } from 'lucide-react';
import {
  useInspectorContext,
  useIsInspectorViewport,
} from '@/app/_components/inspector/inspector-column';
import { guestDisplayName, type GuestRow } from '@/lib/guests';

/** The per-row quick-view affordance. The name beside it is the other trigger
 *  for the same card; this one exists because the name is also a link and a
 *  host scanning the roster wants a target that is unambiguously "show me". */
export function QuickViewButton({ guest }: { guest: GuestRow }) {
  const ctx = useInspectorContext();
  const isXl = useIsInspectorViewport();
  return (
    <button
      type="button"
      onClick={(e) => {
        // `ctx.sheet` is on for the guests roster, so this selects below xl too
        // rather than falling through to a route.
        if (!ctx || !(isXl || ctx.sheet)) return;
        ctx.select(guest.guest_id, e.currentTarget as unknown as HTMLElement);
      }}
      aria-label={`Quick view ${guestDisplayName(guest)}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/45 hover:bg-terracotta/10 hover:text-terracotta-700"
    >
      <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
