'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { deepSearchAiConfigured } from '@/lib/vendor-deep-search';
import { routes } from '@/lib/routes';
import {
  deepSearchEligibility,
  deepSearchMonth,
  fetchDeepSearchRunsPerMonth,
  DEEP_SEARCH_DENY_MESSAGE,
} from '@/lib/vendor-deep-search-addon';
import {
  buildVendorDeepSearchInputs,
  claimIncludedDeepSearchRun,
  releaseIncludedDeepSearchRun,
  runAndRecordVendorDeepSearch,
} from '@/lib/vendor-deep-search-run';

/**
 * Deep Search (supplier-facing) — run one of the paid month's INCLUDED web-research searches on the shop's OWN business;
 * its "What We Learned" review shows on the Deep Search page and in Shop › Details.
 *
 * ⚖ 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH"). Owner,
 * verbatim: *"Retire it"* · *"Deep Search 1 a month"*. ⛔ NOTHING IS SOLD HERE: no price is read, no order or payment is
 * minted, the shop never reaches a payment page. Plus, Pro and Ultra include `platform_settings.deep_search_runs_per_month`
 * runs each paid month; Free and Verified include none. 🔒 lib/deep-search-is-never-sold.test.ts
 *
 * ── THE ORDER OF THE GATES ───────────────────────────────────────────────────
 * signed in → the DPO control (fail-closed) → the shop (server-resolved) → the role ON THIS SHOP (owner/admin) → plan +
 * verification on a fresh read → the research engine is configured → the allowance READ (a refused read refuses the
 * run, never a guessed number) → the CLAIM: one row per included run, written BEFORE the search
 * (`claimIncludedDeepSearchRun` — atomic on `vendor_deep_search_uses_month_slot_uidx`), so a burst of presses can never
 * take more than the month includes.
 *
 * ── THE RUN ──────────────────────────────────────────────────────────────────
 * The research pass takes minutes, so it runs after the response (`after`, inside this route's `maxDuration`); the page
 * shows the search as running ("Searching since …") until its result lands. A run that fails hands its claim back
 * (`releaseIncludedDeepSearchRun`), so a failure never spends one of the month's runs.
 */

export type VendorDeepSearchActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** An included run was claimed and the search started; its result appears on the page when it lands. */
  | { status: 'started'; message: string };

function err(message: string): VendorDeepSearchActionState {
  return { status: 'error', message };
}

export async function runVendorDeepSearch(
  _prev: VendorDeepSearchActionState,
  _formData: FormData,
): Promise<VendorDeepSearchActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // DPO gate — Deep Search is a privacy-sensitive flow (AI web-research over public sources + dossier storage).
  // Fail-closed until the owner approves it at /admin/data-privacy, so it never runs while undisclosed.
  if (!(await isDataPrivacyControlActive('vendor_deep_search'))) {
    return err('Deep Search isn’t available yet — it’s pending a privacy review.');
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS shop (not the user's highest role anywhere), so an agent or viewer here cannot spend
  // the shop's run through a role held on another shop.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) return err('Only the owner or an admin can run Deep Search.');

  // ── Plan + verification (fresh read) ───────────────────────────────────────
  const { data: gateRow, error: gateErr } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (gateErr || !gateRow) return err('Couldn’t read your plan just now. Try again.');
  const gate = gateRow as { tier_state?: string | null; tier_expires_at?: string | null; verification_state?: string | null };
  const eligibility = deepSearchEligibility({ tier: gate.tier_state ?? null, verification: gate.verification_state ?? null });
  if (!eligibility.ok) return err(DEEP_SEARCH_DENY_MESSAGE[eligibility.reason]);

  // Without the AI research engine (ANTHROPIC_API_KEY unset) a run degrades to the keyless Lite pass — not worth one of
  // the month's runs. Refuse before anything is claimed.
  if (!deepSearchAiConfigured()) {
    return err('Deep Search is offline for a moment — the research engine isn’t answering. Your search wasn’t used.');
  }

  // ── The allowance (admin setting) and the claim ────────────────────────────
  const admin = createAdminClient();
  const runs = await fetchDeepSearchRunsPerMonth(admin);
  if (!runs.read) return err('Couldn’t read this month’s searches just now. Try again.');
  const month = deepSearchMonth(gate.tier_expires_at ?? null, Date.now());
  const claim = await claimIncludedDeepSearchRun(admin, {
    vendorProfileId,
    monthStartIso: month.startIso,
    perMonth: runs.perMonth,
  });
  if (!claim.claimed) {
    return claim.reason === 'used_up'
      ? err('This month’s searches are used. They come back when your plan’s next month starts.')
      : err('Couldn’t start your search just now. Try again.');
  }

  // ── The shop's facts, snapshotted now ──────────────────────────────────────
  const { data: vp, error: vpErr } = await admin
    .from('vendor_profiles')
    .select('business_name, website, location_city, services, gallery_video_links')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (vpErr || !vp) {
    await releaseIncludedDeepSearchRun(admin, claim.useId);
    return err('Couldn’t read your shop just now. Your search wasn’t used.');
  }
  const facts = vp as {
    business_name?: string | null;
    website?: string | null;
    location_city?: string | null;
    services?: string[] | null;
    gallery_video_links?: string[] | null;
  };
  const inputs = buildVendorDeepSearchInputs({
    business_name: facts.business_name ?? '',
    website: facts.website ?? null,
    location_city: facts.location_city ?? null,
    services: facts.services ?? [],
    gallery_video_links: facts.gallery_video_links ?? [],
  });

  // ── Run after the response; a failure hands the run back ───────────────────
  const useId = claim.useId;
  after(async () => {
    try {
      const result = await runAndRecordVendorDeepSearch({
        admin,
        vendorProfileId,
        requestedByUserId: user.id,
        inputs,
        wasFree: true,
        orderId: null,
        claimUseId: useId,
      });
      if (result.status === 'failed') await releaseIncludedDeepSearchRun(admin, useId);
    } catch (e) {
      console.error('[deep-search] included run threw', e);
      await releaseIncludedDeepSearchRun(admin, useId);
    }
    revalidatePath(routes.vendorDashboard.deepSearch());
    revalidatePath(routes.vendorDashboard.profile());
  });

  revalidatePath(routes.vendorDashboard.deepSearch());
  revalidatePath(routes.vendorDashboard.profile());
  return {
    status: 'started',
    message: 'Your Deep Search is running. It takes a few minutes — the result appears here when it’s ready.',
  };
}
