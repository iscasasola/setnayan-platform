import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { readClaimedTeamInvite } from '@/lib/vendor-invites';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  businessProfileChecklist,
  profileGaps,
  fetchVendorBusinessStartDate,
  type BusinessProfileItem,
  type VendorProfileRow,
} from '@/lib/vendor-profile';
import {
  REQUIRED_DOC_SLOT_KEYS,
  VENDOR_DOC_SLOTS,
  countCompleteRequiredSlots,
  countCompleteVendorSlots,
  fetchLatestApplication,
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
import { fetchCorrectionRequests, identityLockOf, type LockedIdentityFieldKey, type VendorCorrectionRequestRow } from '@/lib/vendor-corrections';
import {
  fetchPendingSignupCoverageSuggestion,
  type PendingCoverageSuggestion,
} from '@/lib/vendor-signup-coverage-suggest-reader';
import { fetchOwnPaymentMethodsMeasured, type VendorPaymentMethodRow } from '@/lib/vendor-payment-methods';
import { detailsProgress, type DetailsProgress } from '@/lib/supplier-details';
import { isStoreShellRequest } from '@/lib/request-platform';
import {
  loadDeepSearchOffer,
  loadLastDeepSearch,
  type DeepSearchOffer,
  type LastDeepSearch,
} from '@/lib/vendor-deep-search-offer';
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
  /** Unfinished profile items but the logo — its own first step (`profileGaps`, owner 2026-10-22). */
  fieldsLeft: number;
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
  /**
   * 🏷 The locked fields this shop changes ONLY by request today (`identityLockOf`, owner 2026-10-29): the web
   * address always; every identity field once verified; a name/address Setnayan set up. The ask card offers these;
   * My Shop's rows for them become "Ask to change" (or "Asked · waiting") instead of a save the server refuses.
   */
  requestOnly: LockedIdentityFieldKey[];
  /** Setnayan pre-created this shop for them (says why the name asks). */
  setUpBySetnayan: boolean;
  pendingCoverageSuggestion: PendingCoverageSuggestion | null;
  verify: VerifySummary;
  verifyMeasured: boolean;
  /** Required papers in, of how many — the documents row's line ("1 of 4 in"). */
  docsIn: number;
  docsTotal: number;
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
    /** Verified — an unverified shop's 0 km says why. */
    isVerified?: boolean;
    /** The plan was read (false → Where you work says so, never a false 0 km). */
    tierMeasured?: boolean;
  };
  pay: { methods: VendorPaymentMethodRow[]; measured: boolean };
  /** 🔎 What Run Deep Search does for this shop now (`loadDeepSearchOffer` — the Deep Search page's own resolver).
   *  Null in the App Store / Play Store shell, which refuses Deep Search — no card there. */
  deepSearch: DeepSearchOffer | null;
  /** The last search, or that it could not be read. */
  lastDeepSearch: LastDeepSearch;
  /** 🗓 "On Setnayan since" — the shop row's `created_at` (read-only). */
  onSetnayanSince: string | null;
  logoUnavailable: boolean;
  progress: DetailsProgress;
  /**
   * 🎁 The shop came from Setnayan's own invite (prototype `supplier_personal_invite_2026-10-23` frame B4): the
   * staged rows read "from your invite". False when it did not — or when that could not be read (said nothing).
   */
  fromInvite?: boolean;
  /** The logo is in — the Name and logo row then stops asking for it. */
  hasLogo?: boolean;
};

type OwnRow = {
  tier_state?: string | null;
  tier_expires_at?: string | null;
  verification_state?: string | null;
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
  /** Today's six setup steps mount parts of this list but never the Deep Search card — they skip its reads. */
  opts: { deepSearch?: boolean } = {},
): Promise<DetailsData> {
  const withDeepSearch = opts.deepSearch !== false;
  const vendorId = profile.vendor_profile_id;

  // 📍 `ownMeasured`: the plan behind Where you work's reach. Refused, the reach is NOT drawn as Free's 0 km (that
  // would tell a paying shop to get verified) — Where you work says the plan could not be read.
  let ownMeasured = true;
  const ownRead = (async (): Promise<OwnRow> => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select(
          'tier_state, tier_expires_at, verification_state, same_day_available, social_feature_opt_out, social_featured_at, inner_radius_km, outer_radius_km, microsite_about',
        )
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      // ⚠ Their plan, their switches, their travel distances. Refused, each reads as its default — the switches OFF,
      // ⚠ the distances "not set" — and the reason reaches the logs.
      if (error) {
        ownMeasured = false;
        logQueryError('VendorDetails.ownRow', error, { vendorId }, 'graceful_degrade');
      }
      return (data ?? {}) as OwnRow;
    } catch {
      ownMeasured = false;
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
  // 🔎 Deep Search (Supplier dashboard v13 note 2): the same offer `/vendor-dashboard/deep-search` makes — it waits for
  // the plan + verification in the shop row above, and nothing else — and the last search, started with the rest.
  // 🔒 The App Store / Play Store shell refuses Deep Search (a paid per-run service — `lib/store-shell.ts`), so there
  // the card is not drawn and none of its reads run.
  const storeShellRead = isStoreShellRequest();
  // The two loaders log their own refusals (`logQueryError`) and say `measured: false` — nothing is swallowed here.
  const deepSearchRead = (async () => {
    const [own, storeShell] = await Promise.all([ownRead, storeShellRead]);
    if (storeShell || !withDeepSearch) return null;
    return loadDeepSearchOffer(supabase, createAdminClient(), {
      vendorProfileId: vendorId,
      tier: own.tier_state ?? null,
      tierExpiresAt: own.tier_expires_at ?? null,
      verification: own.verification_state ?? null,
    });
  })();
  const lastDeepSearchRead = (async (): Promise<LastDeepSearch> => {
    if ((await storeShellRead) || !withDeepSearch) return { measured: true, last: null };
    return loadLastDeepSearch(supabase, createAdminClient(), vendorId);
  })();
  const inviteRead = (async () => readClaimedTeamInvite(createAdminClient(), vendorId))().catch((err) => {
    // Unread → "from your invite" is simply not said; never a false claim.
    logQueryError('VendorDetails.claimedInvite', err, { vendorId }, 'graceful_degrade');
    return null;
  });

  const [own, businessStartDate, app, validate, registrationOnFile, logo, vocab, openCorrections, suggestion, branches, { branchFeePhp, branchPay }, pay, deepSearch, lastDeepSearch] =
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
      deepSearchRead,
      lastDeepSearchRead,
    ]);
  const fromInvite = (await inviteRead) !== null;


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
    requiredIn: countCompleteRequiredSlots(uploads),
    requiredDocsIn: requiredDocsComplete(uploads),
    // The stamps ride on the application row itself (`fetchLatestApplication` merges them) — the shop page read
    // them a second time; here they are taken from the row already in hand.
    emailConfirmedAt: app?.contact_email_confirmed_at ?? null,
    phoneConfirmedAt: app?.contact_phone_confirmed_at ?? null,
    meetScheduledAt,
    decisionReason: (app?.decision_reason as string | null) ?? null,
    submitMissing: verificationSubmitMissing({
      profileComplete: completion.complete,
      onlyLogoMissing: profileGaps(completion).onlyLogoMissing,
      uploads,
      registrationNumberOnFile: registrationOnFile,
    }),
    validateEmail: validate.validateEmail,
    validatePhone: validate.validatePhone,
  };
  const requiredIn = verify.requiredIn;
  const isVerified = profile.public_visibility === 'verified';
  const lock = identityLockOf(profile);
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
    fieldsLeft: profileGaps(completion).fieldsLeft,
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
    requestOnly: lock.requestOnly,
    setUpBySetnayan: lock.setUpBySetnayan,
    pendingCoverageSuggestion: suggestion,
    verify,
    verifyMeasured,
    docsIn: requiredIn,
    docsTotal: REQUIRED_DOC_SLOT_KEYS.size,
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
      isVerified,
      tierMeasured: ownMeasured,
    },
    pay,
    deepSearch,
    lastDeepSearch,
    onSetnayanSince: profile.created_at ?? null,
    logoUnavailable: logo.unavailable,
    progress,
    fromInvite,
    hasLogo: Boolean(profile.logo_url),
  };
}
