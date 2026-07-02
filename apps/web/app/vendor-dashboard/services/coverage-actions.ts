'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { getCoverageTaxonomy, type CoverageLeaf } from '@/lib/vendor-coverages';
import { getEventTypeVocab } from '@/lib/event-types-db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

/**
 * Coverage CRUD (Vendor Services rework 2026-07-02). A coverage is a first-class
 * `vendor_coverages` row: a taxonomy leaf (canonical_service) the vendor serves
 * + the event types they cater for it. The Explore sync (vendor_profiles.services
 * + event_types union) is wired in the follow-up PR.
 */

const BASE = '/vendor-dashboard/services';

function back(base: string, kind: 'saved' | 'error', msg?: string): never {
  redirect(kind === 'error' && msg ? `${base}?error=${encodeURIComponent(msg)}` : `${base}?saved=1`);
}

async function requireVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

async function findLeaf(canonicalService: string): Promise<CoverageLeaf | null> {
  const tree = await getCoverageTaxonomy();
  for (const p of tree)
    for (const b of p.branches)
      for (const l of b.leaves) if (l.canonicalService === canonicalService) return l;
  return null;
}

/** Validate an event_types[] submission against the active vocab + the leaf's
 *  allowed set. Never returns empty (the DB CHECK requires ≥1). */
async function parseEventTypes(raw: string[], allowed: string[] | null): Promise<string[]> {
  const vocab = await getEventTypeVocab();
  const vocabKeys = new Set(vocab.map((v) => v.key));
  const allowSet = allowed && allowed.length ? new Set(allowed) : null;
  const out = Array.from(new Set(raw)).filter(
    (k) => vocabKeys.has(k) && (!allowSet || allowSet.has(k)),
  );
  if (out.length) return out;
  const firstAllowed = allowed?.[0];
  if (firstAllowed) return [firstAllowed];
  return ['wedding'];
}

/**
 * Coverage is the SOURCE that drives Explore (owner-locked 2026-07-02). On
 * every coverage write, recompute the vendor profile from its coverages:
 *   • event_types = union across coverages (never empty → ['wedding']); drives
 *     the Explore ?event_type= filter (read via the vendor_market_stats view).
 *   • services[] = the vendor's coarse profile categories PRESERVED + the
 *     covered canonical_service keys. Explore already matches canonical keys
 *     directly (.contains('services',[canonical])) and a tile filter overlaps
 *     against the tile's canonicals — so writing coverage canonicals here makes
 *     coverage drive category/tile discovery with NO Explore-filter or view
 *     change. Coarse entries (VENDOR_CATEGORIES, e.g. the profile picker) are
 *     preserved; only the canonical portion is recomputed, so removing a
 *     coverage correctly drops its leaf from discovery.
 */
async function syncProfileFromCoverages(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<void> {
  const { data: covs } = await supabase
    .from('vendor_coverages')
    .select('canonical_service,event_types')
    .eq('vendor_profile_id', vendorProfileId);
  const coverages = (covs ?? []) as {
    canonical_service: string;
    event_types: string[] | null;
  }[];

  const evUnion = new Set<string>();
  for (const c of coverages) for (const e of c.event_types ?? []) evUnion.add(e);
  const event_types = evUnion.size > 0 ? Array.from(evUnion) : ['wedding'];

  const coarse = new Set<string>(VENDOR_CATEGORIES);
  const { data: prof } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const preservedCoarse = (
    (prof as { services: string[] | null } | null)?.services ?? []
  ).filter((s) => coarse.has(s));
  const coveredCanon = coverages.map((c) => c.canonical_service);
  const services = Array.from(new Set([...preservedCoarse, ...coveredCanon]));

  await supabase
    .from('vendor_profiles')
    .update({ event_types, services })
    .eq('vendor_profile_id', vendorProfileId);
}

export async function createCoverage(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const base = await servicesReturnBase();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const leaf = await findLeaf(canonical);
  if (!leaf) back(base, 'error', 'That category is not available. Pick one from the list.');
  const eventTypes = await parseEventTypes(
    formData.getAll('event_types').map(String),
    leaf.allowedEventTypes,
  );
  const { error } = await supabase.from('vendor_coverages').insert({
    vendor_profile_id: profile.vendor_profile_id,
    canonical_service: canonical,
    event_types: eventTypes,
  });
  if (error) {
    // 23505 = unique_violation → the vendor already covers this leaf.
    back(base, 'error', error.code === '23505' ? 'You already cover that category.' : error.message);
  }
  await syncProfileFromCoverages(supabase, profile.vendor_profile_id);
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  back(base, 'saved');
}

export async function updateCoverageEventTypes(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const base = await servicesReturnBase();
  const coverageId = Number(formData.get('coverage_id'));
  if (!Number.isFinite(coverageId)) back(base, 'error', 'Missing coverage.');
  const { data: cov } = await supabase
    .from('vendor_coverages')
    .select('canonical_service')
    .eq('id', coverageId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!cov) back(base, 'error', 'Coverage not found.');
  const leaf = await findLeaf((cov as { canonical_service: string }).canonical_service);
  const eventTypes = await parseEventTypes(
    formData.getAll('event_types').map(String),
    leaf?.allowedEventTypes ?? null,
  );
  const { error } = await supabase
    .from('vendor_coverages')
    .update({ event_types: eventTypes, updated_at: new Date().toISOString() })
    .eq('id', coverageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) back(base, 'error', error.message);
  await syncProfileFromCoverages(supabase, profile.vendor_profile_id);
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  back(base, 'saved');
}

export async function deleteCoverage(formData: FormData): Promise<void> {
  const { supabase, profile } = await requireVendor();
  const base = await servicesReturnBase();
  const coverageId = Number(formData.get('coverage_id'));
  if (!Number.isFinite(coverageId)) back(base, 'error', 'Missing coverage.');
  // The coverage's service cards have coverage_id SET NULL by the FK; the UI
  // confirms this destructive step (and may delete the cards) before calling.
  const { error } = await supabase
    .from('vendor_coverages')
    .delete()
    .eq('id', coverageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) back(base, 'error', error.message);
  await syncProfileFromCoverages(supabase, profile.vendor_profile_id);
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  back(base, 'saved');
}
