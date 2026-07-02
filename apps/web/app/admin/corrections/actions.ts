'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { geocodeNominatim } from '@/lib/geo';
import {
  isLockedIdentityFieldKey,
  type LockedIdentityFieldKey,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';

// /admin/corrections actions — resolution path for the request-a-correction
// queue (verified vendors' locked identity fields, owner 2026-07-02).
//
//   · apply   — writes the requested value to vendor_profiles (admin client,
//               the ONLY write path that may touch a verified shop's identity)
//               and stamps status='applied' + resolved_at/_by.
//   · decline — stamps status='declined' + resolved_at/_by; profile untouched.
//
// Mirrors the requireAdmin + revalidatePath shape of
// app/admin/repost-watch/actions.ts.

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

function fail(message: string): never {
  redirect(`/admin/corrections?error=${encodeURIComponent(message)}`);
}

/**
 * Parses the free-text requested_value into the typed vendor_profiles column
 * value for the given field. Throws a redirect on values that can't be
 * applied (bad year, bad email, bad logo ref) so the admin sees WHY.
 */
function parseRequestedValue(
  field: LockedIdentityFieldKey,
  raw: string | null,
): unknown {
  const trimmed = raw?.trim() ?? '';
  switch (field) {
    case 'business_name': {
      if (!trimmed) fail('Shop name can’t be blank — decline instead.');
      return trimmed.slice(0, 128);
    }
    case 'business_owner_name':
    case 'hq_address':
    case 'contact_phone':
      return trimmed ? trimmed.slice(0, 256) : null;
    case 'contact_email': {
      if (!trimmed) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        fail('The requested email isn’t a valid address — decline instead.');
      }
      return trimmed.slice(0, 256);
    }
    case 'logo_url': {
      if (!trimmed) return null;
      if (!trimmed.startsWith('r2://') && !/^https?:\/\//i.test(trimmed)) {
        fail('Logo must be an r2:// ref or an http(s) URL — decline instead.');
      }
      return trimmed;
    }
    case 'services': {
      // Comma- or newline-separated list, mirroring the display serialization
      // the vendor's request snapshot uses (comma-joined).
      const items = trimmed
        .split(/[,\n]/)
        .map((s) => s.trim().slice(0, 48))
        .filter((s) => s.length > 0)
        .slice(0, 24);
      if (items.length === 0) {
        fail('Services list can’t be empty — decline instead.');
      }
      return items;
    }
    case 'in_business_since_year': {
      if (!trimmed) return null;
      const y = Number(trimmed);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) {
        fail('The requested year isn’t valid (1900–2100) — decline instead.');
      }
      return y;
    }
  }
}

async function loadOpenRequest(
  requestId: string,
): Promise<VendorCorrectionRequestRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_correction_requests')
    .select(
      'id,public_id,vendor_profile_id,field_key,current_value,requested_value,note,status,created_at,resolved_at,resolved_by',
    )
    .eq('id', Number(requestId))
    .maybeSingle();
  if (error || !data) return null;
  return data as VendorCorrectionRequestRow;
}

/**
 * Apply — writes the requested value to the vendor's profile, then marks the
 * request applied. Idempotent: an already-resolved request no-ops back to the
 * queue instead of double-writing.
 */
export async function applyCorrectionRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || !requestId) throw new Error('Invalid input');

  const request = await loadOpenRequest(requestId);
  if (!request) fail('Correction request not found.');
  if (request.status !== 'open') {
    redirect('/admin/corrections?already_resolved=1');
  }
  if (!isLockedIdentityFieldKey(request.field_key)) {
    fail('Unknown field on this request.');
  }

  const value = parseRequestedValue(request.field_key, request.requested_value);

  const admin = createAdminClient();
  const { error: writeErr } = await admin
    .from('vendor_profiles')
    .update({ [request.field_key]: value, updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', request.vendor_profile_id);
  if (writeErr) fail(writeErr.message);

  // Address corrections re-geocode best-effort (same contract as the vendor
  // save path — a Nominatim miss never fails the apply).
  if (request.field_key === 'hq_address' && typeof value === 'string' && value) {
    const geo = await geocodeNominatim(value);
    if (geo) {
      await admin
        .from('vendor_profiles')
        .update({ hq_latitude: geo.latitude, hq_longitude: geo.longitude })
        .eq('vendor_profile_id', request.vendor_profile_id);
    }
  }

  const { error: stampErr } = await admin
    .from('vendor_correction_requests')
    .update({
      status: 'applied',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', request.id)
    .eq('status', 'open');
  if (stampErr) fail(stampErr.message);

  revalidatePath('/admin/corrections');
  revalidatePath('/vendor-dashboard/profile');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/admin/corrections?applied=1');
}

/** Decline — stamps the verdict; the vendor's profile is untouched. */
export async function declineCorrectionRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || !requestId) throw new Error('Invalid input');

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_correction_requests')
    .update({
      status: 'declined',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', Number(requestId))
    .eq('status', 'open');
  if (error) fail(error.message);

  revalidatePath('/admin/corrections');
  redirect('/admin/corrections?declined=1');
}
