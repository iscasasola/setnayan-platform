import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';
import { vendorJson } from '@/lib/api-vendor';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * GET /api/v1/vendor/profile
 *
 * Bearer-authenticated · scope vendor.profile.read. Returns the calling vendor's
 * OWN business profile + active services + packages — everything the vendor
 * already owns and sees in their dashboard, shaped for integration.
 *
 * Scoped to auth.vendorProfileId (the shop that holds the api_access grant).
 * Column allowlists below deliberately EXCLUDE internal / compliance-sensitive
 * fields — BIR/tax identifiers (tin_*, registered_*, bir_*), precise HQ geo,
 * moderation flags (fraud_*, demotion_*), demo markers, and raw R2 storage keys.
 * The vendor's own list/quote prices ARE returned (they belong to the vendor;
 * they are not margins).
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);
  const scopeError = requireScope(auth, 'vendor.profile.read');
  if (scopeError) return scopeError;

  const admin = createAdminClient();
  const vendorProfileId = auth.vendorProfileId;

  const { data: profile, error: profileErr } = await admin
    .from('vendor_profiles')
    .select(
      'public_id, business_name, business_slug, tagline, logo_url, website, contact_email, contact_phone, location_city, hq_region, services, event_types, compatible_ceremony_types, compatible_venue_settings, capacity_min, capacity_max, venue_type, in_business_since_year, weddings_done_approx, is_published, verification_state, tier_state, created_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();

  if (profileErr) {
    logQueryError('GET /api/v1/vendor/profile (profile)', profileErr, {
      vendor_profile_id: vendorProfileId,
    });
    return apiErrorResponse(500, 'database_error', 'Profile could not load right now. Try again in a moment.');
  }
  if (!profile) {
    return apiErrorResponse(404, 'not_found', 'Vendor profile not found.');
  }

  const { data: services, error: servicesErr } = await admin
    .from('vendor_services')
    .select(
      'public_id, category, title, starting_price_php, pricing_basis, per_pax_price_php, base_pax, min_pax, hour_base_php, min_hours, extra_hour_php, crew_size, crew_meal_required, crew_meal_included, transport_included, transport_flat_fee_php, recommended_lead_time_months, is_active, created_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });

  if (servicesErr) {
    logQueryError('GET /api/v1/vendor/profile (services)', servicesErr, {
      vendor_profile_id: vendorProfileId,
    });
    return apiErrorResponse(500, 'database_error', 'Profile could not load right now. Try again in a moment.');
  }

  const { data: packages, error: packagesErr } = await admin
    .from('vendor_packages')
    .select(
      'package_id, package_name, description, total_price_centavos, consumable_budget_centavos, is_consumable_flexible, primary_canonical_service, is_active, created_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });

  if (packagesErr) {
    logQueryError('GET /api/v1/vendor/profile (packages)', packagesErr, {
      vendor_profile_id: vendorProfileId,
    });
    return apiErrorResponse(500, 'database_error', 'Profile could not load right now. Try again in a moment.');
  }

  return vendorJson({
    profile,
    services: services ?? [],
    packages: packages ?? [],
  });
}
