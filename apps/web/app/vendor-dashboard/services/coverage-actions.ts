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
import { getActiveFaithKeys } from '@/lib/faith-vocab-db';
import { coverageServesKey } from '@/lib/coverage-serves-key';

/** Validate a faiths[] submission against the ACTIVE `faith_vocab` keys (the
 *  DB is the vocab authority per the vendor_coverages.faiths column comment;
 *  getActiveFaithKeys fails soft to the static FAITH_REGISTRY set). Unlike
 *  event_types, faiths MAY be empty — empty means "all faiths welcomed" (the
 *  couple religion filter treats an empty coverage.faiths as
 *  compatible-with-all). */
async function parseFaiths(raw: string[]): Promise<string[]> {
  const valid = await getActiveFaithKeys();
  return Array.from(new Set(raw)).filter((f) => valid.has(f));
}

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
  const faiths = await parseFaiths(formData.getAll('faiths').map(String));
  const { error } = await supabase.from('vendor_coverages').insert({
    vendor_profile_id: profile.vendor_profile_id,
    canonical_service: canonical,
    event_types: eventTypes,
    faiths,
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

/**
 * The result of writing "who it’s for", for a caller that must NOT navigate.
 * `ok:false` always carries a sentence a vendor can act on.
 */
export type CoverageServesResult = {
  ok: boolean;
  message: string | null;
  /**
   * WHAT WAS ACTUALLY STORED, as `coverageId|sorted event types|sorted faiths`.
   *
   * The caller compares this against what is on screen to decide whether it may
   * still say "Saved". It is built from the SERVER's narrowed values, not the
   * browser's submission, so a chip the server dropped cannot be reported back
   * as saved — the note simply stops claiming it. `null` on any failure.
   */
  savedKey: string | null;
};

/**
 * THE WRITE ITSELF — one body, two doors.
 *
 * Extracted so the audience save can happen with or without a redirect. Both
 * exported actions below call THIS, so there is exactly one place that decides
 * what a vendor’s coverage says, and no second copy to drift.
 *
 * It never redirects on an outcome of its own — only `requireVendor()` may
 * redirect, and only for the two cases where there is no vendor to write for
 * (signed out → /login, no profile → /vendor-dashboard). Those are the same
 * on both doors, because in neither case is there a card worth preserving.
 */
async function writeCoverageServes(formData: FormData): Promise<CoverageServesResult> {
  const { supabase, profile } = await requireVendor();
  const coverageId = Number(formData.get('coverage_id'));
  if (!Number.isFinite(coverageId))
    return { ok: false, message: 'Missing coverage.', savedKey: null };
  const { data: cov } = await supabase
    .from('vendor_coverages')
    .select('canonical_service')
    .eq('id', coverageId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!cov) return { ok: false, message: 'Coverage not found.', savedKey: null };
  const leaf = await findLeaf((cov as { canonical_service: string }).canonical_service);
  const eventTypes = await parseEventTypes(
    formData.getAll('event_types').map(String),
    leaf?.allowedEventTypes ?? null,
  );
  const faiths = await parseFaiths(formData.getAll('faiths').map(String));
  const { error } = await supabase
    .from('vendor_coverages')
    .update({ event_types: eventTypes, faiths, updated_at: new Date().toISOString() })
    .eq('id', coverageId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (error) return { ok: false, message: error.message, savedKey: null };
  await syncProfileFromCoverages(supabase, profile.vendor_profile_id);
  revalidatePath(BASE);
  revalidatePath('/vendor-dashboard/shop');
  return {
    ok: true,
    message: null,
    savedKey: coverageServesKey(coverageId, eventTypes, faiths),
  };
}

/**
 * The SHIPPED door, byte-for-byte in behaviour: write, then land back on
 * Services with `?saved=1` or `?error=`. The coverage panel on the Services
 * page uses this and is unchanged — it is already ON that page, so returning
 * to it costs the vendor nothing.
 */
export async function updateCoverageServes(formData: FormData): Promise<void> {
  const base = await servicesReturnBase();
  const res = await writeCoverageServes(formData);
  back(base, res.ok ? 'saved' : 'error', res.message ?? undefined);
}

/**
 * THE SECOND DOOR — save and STAY.
 *
 * 🔑 A REDIRECT IS A DESTRUCTIVE ACT WHEN THE PAGE HOLDS UNSAVED WORK. In the
 * zero-step maker the card IS the form, and it is not saved until the vendor
 * presses Publish. "Who it’s for" lives on `vendor_coverages`, not on the card,
 * so it is a SIBLING form — and the shipped action ended in `redirect(...)`,
 * which threw away every unposted thing the vendor had typed: title, price,
 * inclusions, the customization draft, the photos they had just uploaded. The
 * sheet warned them about it, which is not a fix: a warning tells somebody the
 * product is about to lose their work and then loses it.
 *
 * Same write, same validation, same revalidation — only the ending changes.
 * `useActionState` on the caller renders the outcome in place.
 */
export async function updateCoverageServesInPlace(
  _prev: CoverageServesResult,
  formData: FormData,
): Promise<CoverageServesResult> {
  return writeCoverageServes(formData);
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
