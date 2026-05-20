'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';

// Iteration 0041 — email capture for Coming-Soon event_type interest.
// Mirrors the 0043 `notifyWhenWeddingTypeLaunches` pattern but indexed by
// event_type instead of ceremony_type. The form lives on the /vendors
// empty-state banner that PR #184 added, fires when no vendors match the
// active event_type filter.
//
// user_id is stamped when the action is invoked with an authenticated
// session; anonymous submissions persist email only. Both paths use the
// admin client to bypass RLS on insert — the policy on
// couple_event_type_notify_signups grants INSERT to anon + auth anyway,
// but admin client keeps the signature identical to other "submit and
// confirm" forms in the app.

const ALLOWED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'wedding',
  'gender_reveal',
  'debut',
  'birthday',
  'celebration',
  'travel',
  'corporate',
  'tournament',
  'christening',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotifyResult =
  | { status: 'ok' }
  | { status: 'invalid_email' }
  | { status: 'invalid_event_type' }
  | { status: 'error'; message: string };

export async function notifyWhenEventTypeLaunches(formData: FormData): Promise<NotifyResult> {
  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawEventType = String(formData.get('event_type') ?? '').trim();

  if (!EMAIL_REGEX.test(rawEmail)) {
    return { status: 'invalid_email' };
  }
  if (!ALLOWED_EVENT_TYPES.has(rawEventType)) {
    return { status: 'invalid_event_type' };
  }

  // Stamp user_id if the visitor is signed in; leave null for anonymous
  // browsers. Either way the row is valid per the RLS policy + the column
  // schema.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('couple_event_type_notify_signups').insert({
    user_id: user?.id ?? null,
    email: rawEmail.toLowerCase(),
    event_type: rawEventType,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  // Marketplace page may want to repaint with a "thanks" banner — the
  // submitter's URL stays put so we revalidate the same path.
  revalidatePath('/vendors');
  return { status: 'ok' };
}

// ============================================================================
// Save-vendor-to-picks (2026-05-20)
// ----------------------------------------------------------------------------
// Couple clicks "Save" on a marketplace vendor card or profile → we create an
// event_vendors row attached to their primary couple event, with
// marketplace_vendor_id pointing back at the canonical vendor_profiles row
// (iteration 0006/0022 — column added by migration 20260519200000).
//
// "Primary event" = the events row with is_primary=TRUE owned by this user.
// New couples always have exactly one primary event (created via the
// create-event flow). Multi-event couples can flip primary from their
// dashboard; saving always lands on whichever event is primary at the time
// of the click — matches the owner direction ("they will be logged on an
// event and it will always go there").
//
// Idempotent: if an event_vendors row for this (event_id, marketplace_vendor_id)
// already exists we return 'already_saved' instead of inserting a duplicate.
// There's no unique constraint on the pair today, so we check-then-insert.
// The tiny race window (two parallel saves) is acceptable for V1 — worst
// case the couple sees two rows under the same vendor name in their tracker.
// ============================================================================

export type SaveVendorResult =
  | { status: 'ok'; eventVendorId: string }
  | { status: 'already_saved'; eventVendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'no_primary_event' }
  | { status: 'vendor_not_found' }
  | { status: 'error'; message: string };

function coerceCategory(services: ReadonlyArray<string>): VendorCategory {
  // vendor_profiles.services is `text[]` mixing canonical_service taxonomy
  // strings + raw vendor_category enum values. Pick the first entry that
  // matches a known enum value; fall back to 'misc' if nothing maps.
  for (const s of services) {
    if (VENDOR_CATEGORIES.includes(s as VendorCategory)) {
      return s as VendorCategory;
    }
  }
  return 'misc';
}

export async function saveVendorToPicks(formData: FormData): Promise<SaveVendorResult> {
  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();
  if (!vendorProfileId) {
    return { status: 'error', message: 'Missing vendor_profile_id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  const admin = createAdminClient();

  // 1. Resolve the user's primary couple event.
  const { data: membershipRows, error: memError } = await admin
    .from('event_members')
    .select('event_id, events:event_id(event_id, is_primary, archived)')
    .eq('user_id', user.id)
    .eq('member_type', 'couple');
  if (memError) {
    return { status: 'error', message: memError.message };
  }

  type EventStub = { event_id: string; is_primary: boolean; archived: boolean };
  const events = (membershipRows ?? [])
    .map((r) => (Array.isArray(r.events) ? r.events[0] : r.events) as EventStub | null)
    .filter((e): e is EventStub => e !== null && !e.archived)
    .sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1));

  const primaryEvent = events[0];
  if (!primaryEvent) {
    return { status: 'no_primary_event' };
  }

  // 2. Load the vendor profile (name + services for category mapping +
  //    HQ coords so we can anchor the event's venue if this is a venue pick).
  const { data: vendor, error: vError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, services, hq_latitude, hq_longitude')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (vError) {
    return { status: 'error', message: vError.message };
  }
  if (!vendor) {
    return { status: 'vendor_not_found' };
  }

  // 3. Already saved? Return idempotently.
  const { data: existing } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', primaryEvent.event_id)
    .eq('marketplace_vendor_id', vendorProfileId)
    .maybeSingle();
  if (existing?.vendor_id) {
    return { status: 'already_saved', eventVendorId: existing.vendor_id };
  }

  // 4. Insert.
  const category = coerceCategory((vendor.services ?? []) as string[]);
  const { data: inserted, error: iError } = await admin
    .from('event_vendors')
    .insert({
      event_id: primaryEvent.event_id,
      marketplace_vendor_id: vendorProfileId,
      category,
      vendor_name: vendor.business_name,
      status: 'considering',
    })
    .select('vendor_id')
    .single();
  if (iError || !inserted) {
    return { status: 'error', message: iError?.message ?? 'Insert failed' };
  }

  // 5. 2026-05-21 — anchor the event's reception venue when this save
  // is a venue pick. First-saved-wins: we only set venue_latitude when
  // it's currently NULL so the couple doesn't lose a manually-set
  // anchor (or one they pinned by saving a different venue earlier).
  // Admin can override via /admin/events. Distance chips on the
  // marketplace key off this column.
  const vendorHasCoords =
    vendor.hq_latitude !== null && vendor.hq_longitude !== null;
  if (category === 'venue' && vendorHasCoords) {
    await admin
      .from('events')
      .update({
        venue_latitude: vendor.hq_latitude,
        venue_longitude: vendor.hq_longitude,
      })
      .eq('event_id', primaryEvent.event_id)
      .is('venue_latitude', null);
  }

  // Repaint both the marketplace (button → "Saved" · distance chips
  // update if venue just got anchored) and the couple home (12-group
  // planner now shows the new pick).
  revalidatePath('/vendors');
  revalidatePath(`/v/`);
  revalidatePath(`/dashboard/${primaryEvent.event_id}`);

  return { status: 'ok', eventVendorId: inserted.vendor_id };
}

