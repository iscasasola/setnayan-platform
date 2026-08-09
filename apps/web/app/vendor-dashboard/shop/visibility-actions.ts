'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Server action behind My Shop → Business Profile → "Where else you show up" —
 * the two standing preferences that decide whether Setnayan may surface a shop
 * somewhere other than its own listing:
 *
 *   • `same_day_available`      → the couple's Day-of "Get help" shortlist
 *                                 (`lib/same-day-vendors.ts`)
 *   • `social_feature_opt_out`  → the verification celebration post on
 *                                 Setnayan's Facebook/Instagram
 *                                 (`lib/social/flush.ts#sweepVendorFeatures`)
 *
 * ── BOTH COLUMNS SHIPPED WITH A READER AND NO WRITER ────────────────────────
 * Their only writer was `saveVendorProfile`, whose form was retired 2026-07-05.
 * Since then `same_day_available` has been FALSE for every shop, so the Day-of
 * shortlist could never match anyone; and `social_feature_opt_out` has been
 * FALSE for every shop, so every verified vendor was eligible for a public post
 * and none could decline. The opt-out's own column comment still advertises the
 * control — "Self-serve on /vendor-dashboard/profile" — at a route that has
 * been a redirect stub for a month. This action is that missing control.
 *
 * Owner decision 2026-08-09: keep the opt-OUT default (featured unless the
 * vendor declines) and ship the missing checkbox, rather than inverting to
 * opt-in. A business promotion post is not the personal-data case that made
 * `users.public_greeting_opt_in` default FALSE in the same migration.
 *
 * ── WHY ITS OWN ACTION, AND WHY THE VERIFIED LOCK WOULD INVERT IT ───────────
 * `updateVendorProfileField` refuses every field outside `GALLERY_MEDIA_FIELDS`
 * once a shop is verified. Both of these only DO anything for a verified shop —
 * `findSameDayVendors` requires `verification_state = 'verified'`, and the
 * social sweep filters on it too. Routing them through the identity editor
 * would have made them settable by exactly the vendors they can never apply to,
 * and unsettable by exactly the vendors they exist for. The correction-request
 * migration also names "opt-outs" among the non-identity writes that stay
 * vendor-editable, so the lock was never meant to cover them.
 *
 * ── THE HIDDEN MARKER IS LOAD-BEARING (checkbox absent-means-false) ─────────
 * An unticked checkbox posts NOTHING, so `formData.get(k) === 'on'` reads
 * IDENTICALLY for "the vendor unticked it" and "the form never rendered it".
 * A future caller that posts this action's FormData without the boxes would
 * therefore silently write FALSE to both — re-enabling social posting for a
 * vendor who had opted out, with a save that reported success. So the write is
 * gated on an explicit `visibility_fields_present` marker: no marker, no write.
 * Same reasoning and same shape as `compatible_fields_present` in
 * `saveVendorProfile`; the sibling text fields use `has()` instead, and
 * `public-line-actions.ts` explains why that is sound there and not here.
 */

export type VisibilitySaveResult =
  | { ok: true; sameDayAvailable: boolean; socialFeatureOptOut: boolean }
  | { ok: false; error: string };

export async function updateVisibilityPreferences(
  _prev: VisibilitySaveResult | null,
  formData: FormData,
): Promise<VisibilitySaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  // No marker = a form that never put these questions on screen. Refuse rather
  // than write two FALSEs it did not mean.
  if (!formData.get('visibility_fields_present')) {
    return { ok: false, error: 'That form can’t change these settings.' };
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  const sameDayAvailable = formData.get('same_day_available') === 'on';
  const socialFeatureOptOut = formData.get('social_feature_opt_out') === 'on';

  const { error } = await supabase
    .from('vendor_profiles')
    .update({
      same_day_available: sameDayAvailable,
      social_feature_opt_out: socialFeatureOptOut,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_profile_id', vendorProfileId);

  if (error) {
    // Pre-migration (42703 undefined_column / 42P01 undefined_table) — the code
    // is live, the column is not. Say it in words a shop owner can act on
    // rather than leaking a Postgres code onto the screen.
    if (error.code === '42703' || error.code === '42P01') {
      return { ok: false, error: 'These settings aren’t switched on yet — try again shortly.' };
    }
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change where your shop shows up.'
      : error.message;
    return { ok: false, error: friendly };
  }

  revalidatePath('/vendor-dashboard/shop');

  return { ok: true, sameDayAvailable, socialFeatureOptOut };
}
