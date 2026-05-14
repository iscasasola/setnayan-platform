'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  type VendorCategory,
  type VendorStatus,
} from '@/lib/vendors';

function isValidCategory(value: unknown): value is VendorCategory {
  return typeof value === 'string' && (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

function isValidStatus(value: unknown): value is VendorStatus {
  return typeof value === 'string' && (VENDOR_STATUSES as readonly string[]).includes(value);
}

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function createVendor(formData: FormData) {
  const eventId = formData.get('event_id');
  const name = formData.get('vendor_name');
  const category = formData.get('category');

  if (typeof eventId !== 'string' || typeof name !== 'string' || !isValidCategory(category)) {
    throw new Error('Invalid input');
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 128) {
    throw new Error('Vendor name must be 1–128 chars');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_vendors').insert({
    event_id: eventId,
    category,
    vendor_name: trimmedName,
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    total_cost_php: parseMoney(formData.get('total_cost_php')),
    deposit_paid_php: parseMoney(formData.get('deposit_paid_php')),
    notes: nullIfBlank(formData.get('notes')),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`);
}

export async function updateVendorStatus(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const status = formData.get('status');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string' || !isValidStatus(status)) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Snapshot the prior state so we can detect the "first-time delivered"
  // transition that triggers the review-request notification below.
  const { data: prev } = await supabase
    .from('event_vendors')
    .select('status, vendor_name')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  const { error } = await supabase
    .from('event_vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Phase-2 review-request emit: the moment a vendor's service is marked
  // delivered (and wasn't already delivered/complete), drop a notification
  // on the couple's tray + send a Resend email asking them to leave a
  // review. Failure to emit must never roll back the status change itself,
  // so emitNotification swallows errors internally.
  if (
    status === 'delivered'
    && prev?.status !== 'delivered'
    && prev?.status !== 'complete'
  ) {
    const vendorName = prev?.vendor_name ?? 'your vendor';
    await emitNotification({
      userId: user.id,
      type: 'review_request',
      title: `How was ${vendorName}?`,
      body: 'Their service is marked delivered. Take a minute to leave a public review.',
      relatedUrl: `/dashboard/${eventId}/vendors/${vendorId}/review`,
    });
  }

  revalidatePath(`/dashboard/${eventId}/vendors`);
}

export async function deleteVendor(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendors')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`);
}
