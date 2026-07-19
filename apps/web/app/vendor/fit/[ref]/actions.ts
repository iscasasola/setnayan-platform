'use server';

/**
 * Fit-QR "add to shortlist" — a thin wrapper over the canonical marketplace
 * shortlist path (`attachMarketplaceVendorToCategory`, status='considering'), so
 * a couple who scanned a vendor's fit QR and liked the fit can add it to an
 * event's bench without re-deriving anything. Reuses the existing action's auth,
 * idempotency, and RLS guards; on success we bounce to that event's Vendors tab.
 */

import { redirect } from 'next/navigation';
import { attachMarketplaceVendorToCategory } from '@/app/dashboard/[eventId]/vendors/actions';

export async function addVendorFromFit(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '');
  const ref = String(formData.get('ref') ?? '');
  const res = await attachMarketplaceVendorToCategory(formData);
  if (res.status === 'ok' || res.status === 'already_attached') {
    redirect(`/dashboard/${eventId}/vendors?added=1`);
  }
  // Failure → back to the fit page (keeping the event selection) with an error flag.
  redirect(
    `/vendor/fit/${encodeURIComponent(ref)}?event=${encodeURIComponent(eventId)}&err=${encodeURIComponent(res.status)}`,
  );
}
