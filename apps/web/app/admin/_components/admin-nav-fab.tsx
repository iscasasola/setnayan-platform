'use client';

import { Receipt } from 'lucide-react';
import { NavFab } from '@/app/_components/nav/nav-fab';

/**
 * AdminNavFab — the admin doorway's broken-out primary action (NAV-2).
 *
 * Action = **Payment requests** → `/admin/payments` (the reconciliation queue,
 * which defaults to the `pending` filter — the couples' submitted payment proofs
 * awaiting review). Owner-picked (2026-06-21) — clearing the payment-reconciliation
 * queue within the 24-hr SLA is the admin's most time-sensitive job.
 *
 * Thin client wrapper (Lucide icon ref can't cross the Server→Client boundary,
 * same pattern as AdminBottomNav). The NavFab primitive hides itself whenever a
 * docked SubNav is up.
 */
export function AdminNavFab() {
  return (
    <NavFab
      href="/admin/payments"
      label="Payment requests"
      icon={Receipt}
    />
  );
}
