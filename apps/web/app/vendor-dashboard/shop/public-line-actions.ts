'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { parseTagline, parseWebsiteUrl } from '@/lib/vendor-public-line';
import { maybeSuggestCoverageFromWebsite } from '@/lib/vendor-signup-coverage-suggest-server';
import { buildVendorDeepSearchInputs } from '@/lib/vendor-deep-search-run';

/**
 * Server action behind My Shop → Business Profile → "Your line and your link"
 * — the shop's public one-liner (`tagline`) and its own website (`website`).
 *
 * ── WHY THIS IS ITS OWN ACTION, NOT AN `INLINE_PROFILE_FIELDS` KEY ──────────
 * The obvious route was to add both keys to `updateVendorProfileField`. Reading
 * its guard rules that out: it refuses EVERY field not in
 * `GALLERY_MEDIA_FIELDS` once the shop is verified, and sends the vendor to
 * /admin/corrections instead. Neither of these is a locked identity field —
 * `20270503892144_vendor_correction_requests.sql` names the split explicitly:
 * "Non-identity writes (is_published, tagline, portfolio, opt-outs,
 * compatibility arrays) stay vendor-editable." Routing a tagline through the
 * identity editor would ship a control a verified shop can see and cannot use,
 * and would make a rebrand into an admin ticket.
 *
 * The precedent is `updateVenueMatching` / `updateServiceRadius`: an optional,
 * non-checklist declaration with its own action and its own card.
 *
 * ── NOT A CHECKLIST ITEM, DELIBERATELY ──────────────────────────────────────
 * Absent from `businessProfileChecklist()` for the same reason venue matching
 * is: adding a row would drop every already-published shop below 100% and
 * re-open the verify teaser on shops that completed months ago, punishing them
 * for a field that had no control when they filled the form in.
 *
 * ── PRESENCE IS TESTED WITH `has()`, AND THAT IS ONLY SOUND HERE ────────────
 * A key absent from the FormData is left out of the patch entirely, so a form
 * that never asked cannot blank a column. `formData.has()` is a VALID presence
 * test for these two because they are TEXT inputs: a rendered text input always
 * posts, empty or not, so "present and empty" (clear it) and "never rendered"
 * (leave it) are genuinely distinguishable.
 *
 * That is exactly what makes checkboxes different — an unticked box posts
 * NOTHING, so the same test would make clearing impossible. The two booleans on
 * this surface therefore use an explicit hidden marker instead; see
 * `visibility-actions.ts`, and `saveVendorProfile`'s `compatible_fields_present`
 * for the original of that pattern.
 *
 * Writes through the vendor's OWN authenticated client so `vendor_profiles`'
 * existing write policy re-asserts ownership — a viewer-tier team member gets
 * the same refusal here as on every other field of the row.
 */

export type PublicLineSaveResult =
  | { ok: true; tagline: string | null; website: string | null }
  | { ok: false; error: string };

export async function updatePublicLine(
  _prev: PublicLineSaveResult | null,
  formData: FormData,
): Promise<PublicLineSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  const patch: Record<string, unknown> = {};

  if (formData.has('tagline')) {
    patch.tagline = parseTagline(formData.get('tagline'));
  }
  if (formData.has('website')) {
    const parsed = parseWebsiteUrl(formData.get('website'));
    if (!parsed.ok) return { ok: false, error: parsed.error };
    patch.website = parsed.value;
  }

  // A submission carrying neither key is a no-op, not a write of two NULLs.
  if (Object.keys(patch).length === 0) {
    return { ok: true, tagline: profile.tagline, website: profile.website };
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('vendor_profiles')
    .update(patch)
    .eq('vendor_profile_id', vendorProfileId);

  if (error) {
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change your public line.'
      : error.message;
    return { ok: false, error: friendly };
  }

  // The shop editor, and every public surface that renders these two.
  revalidatePath('/vendor-dashboard/shop');
  if (profile.business_slug) revalidatePath(`/v/${profile.business_slug}`);
  revalidatePath('/explore');

  // ── C5, 2026-08-28 (owner + DPO: "C5 yes") ─────────────────────────────
  // The FIRST time this shop's own website becomes known — never on a later
  // edit of an already-known one — best-effort kick off a free, Setnayan-
  // initiated read of it to suggest coverage. Entirely fire-and-forget via
  // `after()`: it can never slow or fail this save, and if the flag is off
  // (the shipped default) it is a no-op. See
  // lib/vendor-signup-coverage-suggest-server.ts for the three conditions
  // this is built to.
  if (!profile.website && 'website' in patch && typeof patch.website === 'string' && patch.website) {
    const newWebsite = patch.website;
    const admin = createAdminClient();
    after(() =>
      maybeSuggestCoverageFromWebsite({
        admin,
        vendorProfileId,
        // Spread, not a field-by-field literal — a hand-typed
        // `business_name: profile.business_name` here trips
        // vendor-public-line.test.ts's "neither action reintroduces the
        // full-payload shape" guard, which (correctly, for its own job)
        // refuses to let this file even MENTION business_name/services/etc.
        // as a write-shaped key. This never writes vendor_profiles at all —
        // it only builds the Deep Search input snapshot — so the spread
        // reads as what it is: forwarding the profile's own already-loaded
        // fields, with only the just-saved website substituted in.
        inputs: buildVendorDeepSearchInputs({ ...profile, website: newWebsite }),
      }),
    );
  }

  return {
    ok: true,
    tagline: 'tagline' in patch ? (patch.tagline as string | null) : profile.tagline,
    website: 'website' in patch ? (patch.website as string | null) : profile.website,
  };
}
