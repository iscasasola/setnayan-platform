'use client';

/**
 * guest-drawer.tsx — the mobile / below-xl QUICK-VIEW guest SHEET (Living Roster
 * P1) and its per-row trigger. Opening a roster row's quick-view slides this
 * read-only sheet in over the roster; the full detail/edit route stays (a "Open
 * full details" link at the foot). This is the in-context glance.
 *
 * Inspector P2 (2026-07-15): the SHEET is now one of TWO frames over the SAME
 * `GuestDetailBody` — on desktop (≥xl) a row instead SELECTS into the sticky
 * inspector column (guests/page.tsx), so the body never diverges between the two
 * presentations. Accordingly `QuickViewButton` is inspector-aware: at ≥xl (under
 * an InspectorLayout) it selects `?inspect=<guestId>`; below xl it opens this
 * sheet exactly as before. The body markup lives in guest-detail-body.tsx.
 *
 * State is a module-level store (mirrors guest-selection-store.ts) so a row can
 * open the sheet without threading a context up to the page. ONE host is mounted
 * in page.tsx.
 */

import { useSyncExternalStore } from 'react';
import { Eye, X } from 'lucide-react';
import { Drawer } from './overlay-primitives';
import {
  useInspectorContext,
  useIsInspectorViewport,
} from '@/app/_components/inspector/inspector-column';
import { guestDisplayName, type GuestRow } from '@/lib/guests';
import { GuestDetailBody } from './guest-detail-body';

const TITLE_ID = 'gl-guest-drawer-title';

// ── store ─────────────────────────────────────────────────────────────────

type DrawerPayload = { guest: GuestRow; groupLabels: string[] };

let state: DrawerPayload | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const guestDrawer = {
  open(guest: GuestRow, groupLabels: string[] = []) {
    state = { guest, groupLabels };
    emit();
  },
  close() {
    state = null;
    emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

function useGuestDrawer(): DrawerPayload | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// ── row trigger ───────────────────────────────────────────────────────────

/** The per-row quick-view affordance. Additive — the name InspectorTrigger to
 *  the full detail route is untouched. On desktop (≥xl, under an
 *  InspectorLayout) it SELECTS the guest into the sticky inspector column;
 *  below xl it opens the slide-in sheet. */
export function QuickViewButton({
  guest,
  groupLabels,
}: {
  guest: GuestRow;
  groupLabels: string[];
}) {
  const ctx = useInspectorContext();
  const isXl = useIsInspectorViewport();
  return (
    <button
      type="button"
      onClick={(e) => {
        if (ctx && isXl) {
          ctx.select(guest.guest_id, e.currentTarget as unknown as HTMLElement);
        } else {
          guestDrawer.open(guest, groupLabels);
        }
      }}
      aria-label={`Quick view ${guestDisplayName(guest)}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/45 hover:bg-terracotta/10 hover:text-terracotta-700"
    >
      <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

// ── host (mobile / below-xl sheet) ─────────────────────────────────────────

export function GuestDrawerHost({
  eventId,
  brandedQrActive = false,
}: {
  eventId: string;
  /** Paid CUSTOM_QR_GUEST upgrade admin-approved → offer the branded PNG
   *  download directly (else the sheet routes to the Invitation page). */
  brandedQrActive?: boolean;
}) {
  const payload = useGuestDrawer();
  if (!payload) return null;
  const { guest, groupLabels } = payload;

  return (
    <Drawer onClose={guestDrawer.close} labelledById={TITLE_ID}>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Guest
        </p>
        <button
          type="button"
          onClick={guestDrawer.close}
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <GuestDetailBody
        guest={guest}
        groupLabels={groupLabels}
        eventId={eventId}
        brandedQrActive={brandedQrActive}
        headingId={TITLE_ID}
      />
    </Drawer>
  );
}
