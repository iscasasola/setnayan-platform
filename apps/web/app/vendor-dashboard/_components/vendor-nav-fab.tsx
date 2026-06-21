'use client';

import { Inbox } from 'lucide-react';
import { NavFab } from '@/app/_components/nav/nav-fab';

/**
 * VendorNavFab — the vendor doorway's broken-out primary action (NAV-2).
 *
 * Action = **Check inquiries** → `/vendor-dashboard/bookings` (the pipeline where
 * new couple inquiries land; each row carries an `inquiry_status`). Owner-picked
 * (2026-06-21) — replying to incoming inquiries is the vendor's most time-sensitive
 * job, so it earns the prominent floating shortcut.
 *
 * Thin client wrapper (the Lucide icon ref can't cross the Server→Client boundary,
 * same pattern as VendorBottomNav). `bookings` is in `VENDOR_SCOPED_BOTTOM_NAV_KEYS`,
 * so every vendor role can reach it — no role gating needed. The NavFab primitive
 * hides itself whenever a docked SubNav is up (e.g. the Services takeover).
 */
export function VendorNavFab() {
  return (
    <NavFab
      href="/vendor-dashboard/bookings"
      label="Check inquiries"
      icon={Inbox}
    />
  );
}
