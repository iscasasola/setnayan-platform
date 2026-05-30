/**
 * Officiant auto-resolve · canonical helper + types + copy.
 *
 * Shared between the DIY-tier WeddingEssentialsHero (free couples on
 * /dashboard/[eventId]/today via essential card #6 of 7) AND the paid-
 * tier OfficiantCard (Today's Focus ₱1,499 couples on the same route
 * via WizardHero's Card 04). Both surfaces detect the same auto-resolve
 * conditions + display the same canonical hint copy when matched ·
 * per CLAUDE.md 2026-05-29 "🎯 VENDOR DISCOVERY ARCHITECTURE LOCK" row
 * item (1) Card 04 Officiant auto-resolve.
 *
 * Refactor history:
 *
 *   - PR #682 (2026-05-30) shipped the DIY-tier auto-resolve via an
 *     inline helper in today/page.tsx.
 *   - PR #685 (2026-05-30) shipped the paid-tier auto-resolve via a
 *     duplicate inline helper in officiant-card.tsx · deliberately
 *     duplicated to keep that PR's blast radius scoped.
 *   - This file (2026-05-30 follow-up) extracts the shared logic ·
 *     both callers now import from here · canonical hint copy unified
 *     (paid tier's slightly-richer "officiates the sacrament" phrasing
 *     for catholic_parish wins for both surfaces).
 *
 * The three framings:
 *
 *   - 'catholic_parish' · Catholic ceremony at a parish church · the
 *     priest from the parish officiates · confirmed via Pre-Cana.
 *   - 'civil_registrar' · Civil ceremony at a city hall / municipal
 *     registrar · the judge or registrar officiates as part of the
 *     venue commitment.
 *   - 'inc_chapel' · INC ceremony at an INC chapel · an INC minister
 *     from the chapel officiates.
 *
 * Other ceremony × venue combinations (Christian-at-banquet · Muslim ·
 * Cultural · Mixed · Catholic-at-non-church-destination · INC-at-non-
 * chapel · Civil-at-non-registrar) fall through to null = standard
 * vendor picker.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] ·
 * concrete + Filipino-aware framing · no engineering jargon.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Auto-resolution framings · which kind of locked-venue commitment is
 * implicitly handling the officiant role. Drives the framing-specific
 * hint copy + provider label on both DIY and paid surfaces.
 */
export type OfficiantAutoResolutionFraming =
  | 'catholic_parish'
  | 'civil_registrar'
  | 'inc_chapel';

/**
 * Auto-resolution payload · returned by `computeOfficiantAutoResolution`
 * when the host's locked ceremony venue implicitly handles the officiant
 * role. The caller renders a framing-specific "set by your venue"
 * treatment with the provider's name surfaced.
 */
export type OfficiantAutoResolution = {
  framing: OfficiantAutoResolutionFraming;
  /**
   * Public-facing name of the venue/parish/registrar that implicitly
   * handles this essential · sourced from `venue_directory.name`
   * (admin-seeded famous venues) OR `vendor_profiles.business_name`
   * (marketplace-linked venues).
   */
  providerName: string;
};

/**
 * Canonical hint copy per framing · brand-voice editorial register ·
 * names the role the venue's officiant plays (Catholic priest · Civil
 * judge / registrar · INC minister) + the gating paperwork or
 * commitment when relevant.
 *
 * Both DIY-tier WeddingEssentialsHero and paid-tier
 * OfficiantAutoResolvedPanel render this exact copy when auto-resolve
 * triggers · single source of truth keeps the two tiers consistent.
 */
export function getOfficiantAutoResolvedHint(
  framing: OfficiantAutoResolutionFraming,
): string {
  switch (framing) {
    case 'catholic_parish':
      return 'The priest from your parish officiates the sacrament. Confirmed via Pre-Cana paperwork.';
    case 'civil_registrar':
      return 'The judge or registrar at this venue officiates the ceremony.';
    case 'inc_chapel':
      return 'Your INC minister officiates from this chapel.';
  }
}

/**
 * Minimal shape of an `event_vendors` row this helper needs. Both
 * `marketplace_vendor_id` and `source_venue_directory_id` are nullable
 * because a single event_vendors row is sourced from EITHER the
 * marketplace OR the curated venue_directory (admin-seeded famous
 * venues like Manila Cathedral · Quezon City Hall · INC Central Chapel).
 * Off-platform / custom-added vendors have both set to NULL.
 */
type EventVendorRow = {
  marketplace_vendor_id: string | null;
  source_venue_directory_id: string | null;
  category: string | null;
  status: string | null;
};

type ComputeInput = {
  eventId: string;
  ceremonyType: string | null;
  /**
   * Optional pre-fetched event_vendors rows · when provided, the helper
   * skips its internal fetch. The DIY-tier today/page.tsx passes its
   * already-fetched rows (which it also uses for the multi-essential
   * rollups in computeEssentialStates) to avoid a duplicate query.
   * The paid-tier OfficiantCard omits this and lets the helper fetch
   * its own rows.
   *
   * Must include all 4 fields (marketplace_vendor_id ·
   * source_venue_directory_id · category · status). If the caller
   * fetched with a narrower SELECT, OMIT this option and let the helper
   * fetch fresh.
   */
  vendorRows?: ReadonlyArray<EventVendorRow>;
};

/**
 * Detect whether the host's locked ceremony venue implicitly handles
 * the officiant role.
 *
 * Three framings qualify per CLAUDE.md 2026-05-29 "Vendor Discovery
 * Architecture" row item (1):
 *
 *   - Catholic · locked religious_venue whose compatible_ceremony_types
 *     includes 'catholic' (parish church) · framing='catholic_parish'.
 *   - INC · locked religious_venue whose compatible_ceremony_types
 *     includes 'inc' (INC chapel) · framing='inc_chapel'.
 *   - Civil · locked venue with venue_type='civil_registrar' (admin-
 *     seeded city hall) OR compatible_venue_settings includes
 *     'civil_registrar' (marketplace-listed registrar) ·
 *     framing='civil_registrar'.
 *
 * Falls through to null (= standard vendor picker) for:
 *
 *   - Ceremony types other than catholic/civil/inc.
 *   - Events with no locked venue.
 *   - Events where the host has already picked or considered a separate
 *     officiant (event_vendors row with category='officiant' exists) ·
 *     explicit picks always win over auto-resolution.
 *   - Locked venues whose compat metadata doesn't match the host's
 *     ceremony_type (e.g., Catholic+banquet-hall destination).
 *
 * Looks up provider name + compat data from the two possible sources:
 * `venue_directory` (admin-seeded famous venues) takes precedence when
 * source_venue_directory_id is set · `vendor_profiles` is the fallback
 * for marketplace-listed venues without a venue_directory link.
 *
 * Returns the first candidate whose compat metadata matches the host's
 * ceremony type · multiple locked venues walk in array order (in
 * practice the religious_venue will be the religious_venue category
 * row and the reception will be the venue category row).
 */
export async function computeOfficiantAutoResolution(
  supabase: SupabaseClient,
  input: ComputeInput,
): Promise<OfficiantAutoResolution | null> {
  const { eventId, ceremonyType } = input;

  if (!ceremonyType || !['catholic', 'civil', 'inc'].includes(ceremonyType)) {
    return null;
  }

  // Fetch event_vendors only if the caller didn't pass pre-fetched rows.
  let vendorRows: ReadonlyArray<EventVendorRow>;
  if (input.vendorRows) {
    vendorRows = input.vendorRows;
  } else {
    const { data } = await supabase
      .from('event_vendors')
      .select(
        'marketplace_vendor_id, source_venue_directory_id, category, status',
      )
      .eq('event_id', eventId);
    if (!data) return null;
    vendorRows = data as ReadonlyArray<EventVendorRow>;
  }

  // Gate · don't override explicit officiant picks. Couples who've
  // already considered or locked a separate officiant see their picks
  // via the existing picker path · auto-resolve never overrides an
  // explicit choice.
  const hasOfficiantRow = vendorRows.some((v) => v.category === 'officiant');
  if (hasOfficiantRow) return null;

  // Same locked-statuses + venue categories as the venue essential's
  // rollUpVendorPick for consistency · couple's locked venue is the
  // anchor for the officiant auto-resolve.
  const lockedStatuses = new Set([
    'contracted',
    'deposit_paid',
    'delivered',
    'complete',
  ]);
  const venueCategories = new Set(['religious_venue', 'venue']);
  const candidates = vendorRows.filter(
    (v) =>
      venueCategories.has(v.category ?? '') &&
      lockedStatuses.has(v.status ?? ''),
  );
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    let providerName: string | null = null;
    let compatibleTypes: ReadonlyArray<string> = [];
    let isCivilRegistrar = false;

    if (candidate.source_venue_directory_id) {
      const { data } = await supabase
        .from('venue_directory')
        .select('name, compatible_ceremony_types, venue_type')
        .eq('venue_directory_id', candidate.source_venue_directory_id)
        .maybeSingle();
      if (data) {
        const row = data as {
          name?: string | null;
          compatible_ceremony_types?: ReadonlyArray<string> | null;
          venue_type?: string | null;
        };
        providerName = row.name ?? null;
        compatibleTypes = row.compatible_ceremony_types ?? [];
        isCivilRegistrar = row.venue_type === 'civil_registrar';
      }
    } else if (candidate.marketplace_vendor_id) {
      const { data } = await supabase
        .from('vendor_profiles')
        .select(
          'business_name, compatible_ceremony_types, compatible_venue_settings',
        )
        .eq('vendor_profile_id', candidate.marketplace_vendor_id)
        .maybeSingle();
      if (data) {
        const row = data as {
          business_name?: string | null;
          compatible_ceremony_types?: ReadonlyArray<string> | null;
          compatible_venue_settings?: ReadonlyArray<string> | null;
        };
        providerName = row.business_name ?? null;
        compatibleTypes = row.compatible_ceremony_types ?? [];
        isCivilRegistrar = (row.compatible_venue_settings ?? []).includes(
          'civil_registrar',
        );
      }
    }

    if (!providerName) continue;

    if (ceremonyType === 'catholic' && compatibleTypes.includes('catholic')) {
      return { framing: 'catholic_parish', providerName };
    }
    if (ceremonyType === 'inc' && compatibleTypes.includes('inc')) {
      return { framing: 'inc_chapel', providerName };
    }
    if (ceremonyType === 'civil' && isCivilRegistrar) {
      return { framing: 'civil_registrar', providerName };
    }
  }

  return null;
}
