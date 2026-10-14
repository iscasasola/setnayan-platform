import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  businessProfileChecklist,
  fetchVendorBusinessStartDate,
  type BusinessProfileItem,
  type VendorProfileRow,
} from '@/lib/vendor-profile';
import {
  REQUIRED_DOC_SLOT_KEYS,
  VENDOR_DOC_SLOTS,
  countCompleteVendorSlots,
  fetchLatestApplication,
  isSlotComplete,
  requiredDocsComplete,
  verificationSubmitMissing,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import { fetchVendorBranches, fetchBranchFeePhp, branchAutoRadiusKm, BRANCH_FEE_PHP, type VendorBranchView } from '@/lib/vendor-branches';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailDetails } from '@/lib/payment-channels';
import { tierCaps, asVendorTier, isTierAtLeast } from '@/lib/vendor-tier-caps';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchVendorServicePickerVocab } from '@/lib/vendor-service-vocab';
import { fetchCorrectionRequests, type VendorCorrectionRequestRow } from '@/lib/vendor-corrections';
import {
  fetchPendingSignupCoverageSuggestion,
  type PendingCoverageSuggestion,
} from '@/lib/vendor-signup-coverage-suggest-reader';
import { fetchOwnPaymentMethodsMeasured, type VendorPaymentMethodRow } from '@/lib/vendor-payment-methods';
import { detailsProgress, type DetailsProgress } from '@/lib/supplier-details';
import type { ProfileFieldData } from '../shop/_components/editable-row';
import type { VerifySummary } from '../shop/_components/verify-section';
import type { PayInfo } from '../_components/branch-manager';

/**
 * YOUR DETAILS — every read the one list needs, started at once and awaited once (step 5).
 *
 * 🔑 THESE ARE MY SHOP'S DOOR-1 READS, MOVED. Until 2026-10-14 My Shop paid for all of them on every visit to draw
 * the Profile tile, the papers and the Branch tile; those panels now live here, so Shop no longer reads them and
 * this page reads them only when a supplier opens their details. The shapes they build (`ProfileFieldData`,
 * `VerifySummary`, the branch panel's props) are byte-for-byte the ones `shop/page.tsx` built — the editors are the
 * same components.
 *
 * Two merges, each one request fewer: the plan, the two shop switches, the travel distances, the start date and the
 * page's About paragraph are ALL columns of the shop's own row, read in ONE select (the shop page split them only
 * for a deploy-order window that closed months ago — every column is applied). A refused read degrades to the
 * column defaults and is logged, exactly as each split probe did.
 *
 * Payment methods are read here ONCE and handed to the embedded payment surface (`preloaded`), so the "N of 6" line
 * and the fold below it never ask twice.
 */
export type DetailsData = {
  vendorId: string;
  businessName: string;
  slug: string | null;
  isVerified: boolean;
  tier: string | null;
  checklist: BusinessProfileItem[];
  profileComplete: boolean;
  profileFields: ProfileFieldData;
  businessStartDate: string | null;
  compatibleVenueSettings: string[] | null;
  compatibleCeremonyTypes: string[] | null;
  venueType: string | null;
  tagline: string | null;
  website: string | null;
  about: string | null;
  sameDayAvailable: boolean;
  socialFeatureOptOut: boolean;
  socialAlreadyFeatured: boolean;
  openCorrections: VendorCorrectionRequestRow[];
  pendingCoverageSuggestion: PendingCoverageSuggestion | null;
  verify: VerifySummary;
  verifyMeasured: boolean;
  branch: {
    city: string | null;
    branchLocations: number;
    tier: string | null;
    hqLat: number | null;
    hqLng: number | null;
    reachKm: number;
    innerRadiusKm: number | null;
    outerRadiusKm: number | null;
    branches: VendorBranchView[];
    branchFeePhp: number;
    branchAutoRadius: number;
    branchPay: PayInfo;
  };
  pay: { methods: VendorPaymentMethodRow[]; measured: boolean };
  logoUnavailable: boolean;
  progress: DetailsProgress;
};

type OwnRow = {
  tier_state?: string | null;
  same_day_available?: boolean | null;
  social_feature_opt_out?: boolean | null;
  social_featured_at?: string | null;
  inner_radius_km?: number | null;
  outer_radius_km?: number | null;
  microsite_about?: string | null;
};

export async function loadDetailsData(
  supabase: SupabaseClient,
  profile: VendorProfileRow,
): Promise<DetailsData> {
  const vendorId = profile.vendor_profile_id;

  const ownRead = (async (): Promise<OwnRow> => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(
          'tier_state, same_day_available, social_feature_opt_out, social_featured_at, inner_radius_km, outer_radius_km, microsite_about',
        )
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      // ⚠ Their plan, their switches, their travel distances. Refused, each reads as its default — the switches OFF,
      // ⚠ the distances "not set" — and the reason reaches the logs.
      if (error) logQueryError('VendorDetails.ownRow', error, { vendorId }, 'graceful_degrade');
      return (data ?? {}) as OwnRow;
    } catch {
      return {};
    }
  })();

  // The start date has its own guarded reader; it is one more column of the same row, read beside it.
  const startDateRead = fetchVendorBusinessStartDate(supabase, vendorId);

  let verifyMeasured = true;
  const appRead = fetchLatestApplication(supabase, vendorId).catch((err) => {
    logQueryError('VendorDetails.latestApplication', err, { vendorId });
    verifyMeasured = false;
    return null;
  });
  const validateRead = (async () => {
    let validateEmail = 'verify@setnayan.com';
    let validatePhone: string | null = null;
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('vendor_validate_email,vendor_validate_phone')
        .eq('id', 1)
        .maybeSingle();
      if (error) logQueryError('VendorDetails.validateContacts', error, { vendorId }, 'graceful_degrade');
      const row = data as { vendor_validate_email?: string | null; vendor_validate_phone?: string | null } | null;
      if (row?.vendor_validate_email?.trim()) validateEmail = row.vendor_validate_email.trim();
      validatePhone = row?.vendor_validate_phone?.trim() || null;
    } catch {
      /* defaults above */
    }
    return { validateEmail, validatePhone };
  })();
  const registrationRead = (async () => {
    try {
      // `vendor_profiles_self`, never the table: `registration_number_raw` is off `authenticated`'s column allowlist
      // (the shop page's own note, moved with the read).
      const { data, error } = await supabase
        .from('vendor_profiles_self')
        .select('registration_number_raw')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      if (error) logQueryError('VendorDetails.registrationOnFile', error, { vendorId }, 'graceful_degrade');
      return Boolean((data as { registration_number_raw?: string | null } | null)?.registration_number_raw);
    } catch {
      return false;
    }
  })();

  const logoRead = (async () => {
    try {
      const url = profile.logo_url ? await displayUrlForStoredAsset(profile.logo_url) : null;
      return { map: profile.logo_url && url ? { [profile.logo_url]: url } : {}, unavailable: false };
    } catch (err) {
      logQueryError('VendorDetails.logoDisplayUrl', err, { vendorId, hasLogo: !!profile.logo_url });
      return { map: {} as Record<string, string>, unavailable: !!profile.logo_url };
    }
  })();
  const vocabRead = fetchVendorServicePickerVocab();
  const correctionsRead = fetchCorrectionRequests(supabase, { status: 'open', vendorProfileId: vendorId });
  const suggestionRead = fetchPendingSignupCoverageSuggestion(vendorId, profile.services ?? []).catch((err) => {
    logQueryError('VendorDetails.coverageSuggestion', err, { vendorId });
    return null;
  });
  const branchesRead = fetchVendorBranches(supabase, vendorId, createAdminClient()).catch((err) => {
    logQueryError('VendorDetails.branches', err, { vendorId });
    return [] as VendorBranchView[];
  });
  const branchPayRead = (async () => {
    const own = await ownRead;
    let branchFeePhp = BRANCH_FEE_PHP;
    let branchPay: PayInfo = { accounts: [], open: [] };
    // Only an Enterprise shop's manager can buy a branch, so only it pays for the fee + rails reads.
    if (isTierAtLeast(own.tier_state ?? null, 'enterprise')) {
      const [fee, settings] = await Promise.all([
        fetchBranchFeePhp(supabase).catch((err) => {
          logQueryError('VendorDetails.branchFee', err, { vendorId });
          return BRANCH_FEE_PHP;
        }),
        fetchPlatformSettings(supabase).catch((err) => {
          logQueryError('VendorDetails.platformSettings', err, { vendorId });
          return null;
        }),
      ]);
      branchFeePhp = fee;
      if (settings) branchPay = openRailDetails(settings);
    }
    return { branchFeePhp, branchPay };
  })();
  const payRead = fetchOwnPaymentMethodsMeasured(supabase, vendorId);

  const [own, businessStartDate, app, validate, registrationOnFile, logo, vocab, openCorrections, suggestion, branches, { branchFeePhp, branchPay }, pay] =
    await Promise.all([
      ownRead,
      startDateRead,
      appRead,
      validateRead,
      registrationRead,
      logoRead,
      vocabRead,
      correctionsRead,
      suggestionRead,
      branchesRead,
      branchPayRead,
      payRead,
    ]);

  const completion = businessProfileChecklist(profile);
  const uploads = (app?.doc_uploads ?? {}) as DocUploadMap;
  const meetSlot = uploads.google_meet;
  const meetScheduledAt =
    meetSlot && typeof meetSlot === 'object' && !Array.isArray(meetSlot) && 'scheduled_at' in meetSlot
      ? ((meetSlot as { scheduled_at?: string | null }).scheduled_at ?? null)
      : null;
  const verify: VerifySummary = {
    status: (app?.status as VerifySummary['status']) ?? null,
    vendorComplete: countCompleteVendorSlots(uploads),
    vendorTotal: VENDOR_DOC_SLOTS.length,
    requiredDocsIn: requiredDocsComplete(uploads),
    // The stamps ride on the application row itself (`fetchLatestApplication` merges them) — the shop page read
    // them a second time; here they are taken from the row already in hand.
    emailConfirmedAt: app?.contact_email_confirmed_at ?? null,
    phoneConfirmedAt: app?.contact_phone_confirmed_at ?? null,
    meetScheduledAt,
    decisionReason: (app?.decision_reason as string | null) ?? null,
    submitMissing: verificationSubmitMissing({
      profileComplete: completion.complete,
      uploads,
      registrationNumberOnFile: registrationOnFile,
    }),
    validateEmail: validate.validateEmail,
    validatePhone: validate.validatePhone,
  };
  const requiredIn = [...REQUIRED_DOC_SLOT_KEYS].filter((k) => isSlotComplete(k, uploads?.[k])).length;
  const isVerified = profile.public_visibility === 'verified';
  const tier = own.tier_state ?? null;

  const profileFields: ProfileFieldData = {
    business_name: profile.business_name ?? '',
    business_owner_name: profile.business_owner_name ?? '',
    hq_address: profile.hq_address ?? '',
    location_city: profile.location_city ?? '',
    hq_latitude: profile.hq_latitude ?? null,
    hq_longitude: profile.hq_longitude ?? null,
    contact_phone: profile.contact_phone ?? '',
    contact_email: profile.contact_email ?? '',
    in_business_since_year: profile.in_business_since_year ? String(profile.in_business_since_year) : '',
    venue_width_m: profile.venue_width_m != null ? String(profile.venue_width_m) : '',
    venue_length_m: profile.venue_length_m != null ? String(profile.venue_length_m) : '',
    capacity_min: profile.capacity_min != null ? String(profile.capacity_min) : '',
    capacity_max: profile.capacity_max != null ? String(profile.capacity_max) : '',
    logo_url: profile.logo_url ?? null,
    logoDisplayMap: logo.map,
    services: (profile.services ?? []) as string[],
    serviceLabels: vocab.serviceLabels,
    extraServiceLeaves: vocab.extraServiceLeaves,
    vendorProfileId: vendorId,
  };

  const progress = detailsProgress({
    checklist: completion.items,
    docs: {
      measured: verifyMeasured,
      isVerified,
      status: verify.status,
      requiredIn,
      requiredTotal: REQUIRED_DOC_SLOT_KEYS.size,
    },
    payMethods: pay.measured ? pay.methods.length : null,
  });

  const about = own.microsite_about?.trim() || null;

  return {
    vendorId,
    businessName: profile.business_name ?? 'Your shop',
    slug: profile.business_slug ?? null,
    isVerified,
    tier,
    checklist: completion.items,
    profileComplete: completion.complete,
    profileFields,
    businessStartDate,
    compatibleVenueSettings: profile.compatible_venue_settings ?? null,
    compatibleCeremonyTypes: profile.compatible_ceremony_types ?? null,
    venueType: profile.venue_type ?? null,
    tagline: profile.tagline,
    website: profile.website,
    about,
    sameDayAvailable: own.same_day_available === true,
    socialFeatureOptOut: own.social_feature_opt_out === true,
    socialAlreadyFeatured: own.social_featured_at != null,
    openCorrections,
    pendingCoverageSuggestion: suggestion,
    verify,
    verifyMeasured,
    branch: {
      city: profile.location_city ?? null,
      branchLocations: 1 + branches.filter((b) => b.status === 'active').length,
      tier,
      hqLat: profile.hq_latitude ?? null,
      hqLng: profile.hq_longitude ?? null,
      reachKm: tierCaps(asVendorTier(tier)).serviceRadiusKm,
      innerRadiusKm: own.inner_radius_km ?? null,
      outerRadiusKm: own.outer_radius_km ?? null,
      branches,
      branchFeePhp,
      branchAutoRadius: branchAutoRadiusKm(),
      branchPay,
    },
    pay,
    logoUnavailable: logo.unavailable,
    progress,
  };
}
