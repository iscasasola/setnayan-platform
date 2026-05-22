'use server';

// ============================================================================
// /dashboard/[eventId]/vendors/[eventVendorId]/workspace/actions.ts
//
// Server actions for the per-vendor workspace page.
//
// V1 minimum scope (per owner directive STEP 6, 2026-05-22):
//   - advanceWorkspaceStatus  — host marks the next payment stage as reached
//
// V1.1 follow-ups (deferred — wired from existing surfaces in V1):
//   - addPaymentMilestone     → uses /dashboard/[eventId]/budget (0007)
//   - markPaymentPaid         → uses /dashboard/[eventId]/budget (0007)
//   - addMeeting              → V1.x once meeting CRUD ships
//   - uploadWorkspaceDocument → vendors upload via /vendor-dashboard/contracts
//
// Auth pattern matches the existing vendors/actions.ts conventions — gate on
// signed-in user, then rely on RLS on event_vendors to scope to the host's
// own events (the event_vendors_couple_write policy from migration
// 20260513100000_iteration_0006_vendors.sql).
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Mirrors the CHECK constraint values from migration
// 20260604130000_event_vendors_workspace_status.sql exactly. Keep this list in
// lock-step with the migration's CHECK clause — any divergence surfaces as a
// 23514 check_violation when the action tries to update.
const WORKSPACE_STATUS_VALUES = [
  'plan_finalized',
  'downpayment_paid',
  'second_payment_due',
  'second_payment_paid',
  'final_payment_due',
  'paid_in_full',
  'delivered',
] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUS_VALUES)[number];

function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return (
    typeof value === 'string' &&
    (WORKSPACE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export type AdvanceWorkspaceStatusResult =
  | { status: 'ok'; newStatus: WorkspaceStatus }
  | { status: 'not_signed_in' }
  | { status: 'invalid_status' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * Advance the per-vendor workspace status to a specific value.
 *
 * Idempotent — if the row already has the requested status, returns 'ok'
 * without writing. RLS on event_vendors enforces that only the host can update
 * (the event_vendors_couple_write policy).
 *
 * Called from V1.x inline stage controls (deferred). The action ships now so
 * the future UI doesn't have to wait on a separate PR to wire it up.
 */
export async function advanceWorkspaceStatus(formData: FormData): Promise<AdvanceWorkspaceStatusResult> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const newStatusRaw = formData.get('workspace_status');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    return { status: 'error', message: 'Invalid input.' };
  }
  if (!isWorkspaceStatus(newStatusRaw)) {
    return { status: 'invalid_status' };
  }
  const newStatus = newStatusRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Form actions can't `redirect` and return a result simultaneously
    // (Next.js throws on the redirect), so we return the typed result and
    // let the caller redirect to /login if needed.
    return { status: 'not_signed_in' };
  }

  // Read first so we can short-circuit if the status is already correct.
  // RLS scopes this select to the host's own events.
  const { data: existing, error: readErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, workspace_status')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) return { status: 'error', message: readErr.message };
  if (!existing) return { status: 'not_found' };

  if (existing.workspace_status === newStatus) {
    return { status: 'ok', newStatus };
  }

  const { error: writeErr } = await supabase
    .from('event_vendors')
    .update({ workspace_status: newStatus })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);

  if (writeErr) return { status: 'error', message: writeErr.message };

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
  revalidatePath(`/dashboard/${eventId}`);

  return { status: 'ok', newStatus };
}

/**
 * Convenience form-only wrapper that performs the redirect dance the typed
 * `advanceWorkspaceStatus` action above intentionally skips. V1.x form
 * controls should call this from a `<form action={...}>` — the result-bearing
 * variant is for V1.x client components that want to render error toasts.
 */
export async function advanceWorkspaceStatusForm(formData: FormData): Promise<void> {
  const result = await advanceWorkspaceStatus(formData);
  if (result.status === 'not_signed_in') redirect('/login');
  // Any other status is silently swallowed in form mode — the revalidatePath
  // already happened on success, and the UI surfaces invalid_status /
  // not_found / error via a separate dev-only path in the typed variant.
}
