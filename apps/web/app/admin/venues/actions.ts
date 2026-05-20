'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENUE_TYPES, CEREMONY_TYPES, type VenueType } from './_constants';

/**
 * Admin server actions for the V1 venue_directory (read-only directory of
 * known PH wedding venues, seeded in migration 20260526000000). Admins
 * curate the list while V1.2 venue iteration is being built.
 *
 * Every action gates on the `is_internal | is_team_member | admin` check
 * that mirrors the rest of the admin console — RLS on the table also
 * enforces it server-side, but the redirect-on-fail UX is nicer than a
 * silent RLS rejection.
 */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function requireAdmin() {
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
  return user.id;
}

type ParsedForm = {
  slug: string;
  name: string;
  venue_type: VenueType;
  location_city: string;
  hq_address: string | null;
  hq_latitude: number;
  hq_longitude: number;
  compatible_ceremony_types: string[];
  source_note: string | null;
};

function parseForm(formData: FormData): ParsedForm {
  const slug = String(formData.get('slug') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const venueType = String(formData.get('venue_type') ?? '').trim();
  const locationCity = String(formData.get('location_city') ?? '').trim();
  const hqAddress = String(formData.get('hq_address') ?? '').trim();
  const lat = Number(formData.get('hq_latitude'));
  const lng = Number(formData.get('hq_longitude'));
  const sourceNote = String(formData.get('source_note') ?? '').trim();

  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 80) {
    throw new Error('Slug must be 2-80 chars of lowercase letters, digits, and single hyphens.');
  }
  if (name.length < 1 || name.length > 200) {
    throw new Error('Name must be 1-200 chars.');
  }
  if (!(VENUE_TYPES as readonly string[]).includes(venueType)) {
    throw new Error('Invalid venue_type.');
  }
  if (locationCity.length < 1 || locationCity.length > 100) {
    throw new Error('Location city must be 1-100 chars.');
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }
  if (hqAddress.length > 500) {
    throw new Error('Address too long (max 500 chars).');
  }

  const ceremonyTypes: string[] = [];
  for (const ct of CEREMONY_TYPES) {
    if (formData.get(`compatible_${ct}`) === 'on') ceremonyTypes.push(ct);
  }

  return {
    slug,
    name,
    venue_type: venueType as VenueType,
    location_city: locationCity,
    hq_address: hqAddress.length > 0 ? hqAddress : null,
    hq_latitude: lat,
    hq_longitude: lng,
    compatible_ceremony_types: ceremonyTypes,
    source_note: sourceNote.length > 0 ? sourceNote : null,
  };
}

export async function createVenue(formData: FormData) {
  await requireAdmin();
  const parsed = parseForm(formData);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('venue_directory')
    .insert(parsed)
    .select('venue_directory_id')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath('/admin/venues');
  redirect(`/admin/venues/${data.venue_directory_id}`);
}

export async function updateVenue(venueDirectoryId: string, formData: FormData) {
  await requireAdmin();
  const parsed = parseForm(formData);

  const admin = createAdminClient();
  const { error } = await admin
    .from('venue_directory')
    .update(parsed)
    .eq('venue_directory_id', venueDirectoryId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/venues');
  revalidatePath(`/admin/venues/${venueDirectoryId}`);
}

export async function deleteVenue(formData: FormData) {
  await requireAdmin();
  const venueDirectoryId = formData.get('venue_directory_id');
  if (typeof venueDirectoryId !== 'string' || venueDirectoryId.length === 0) {
    throw new Error('Invalid venue_directory_id');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('venue_directory')
    .delete()
    .eq('venue_directory_id', venueDirectoryId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/venues');
  redirect('/admin/venues');
}

