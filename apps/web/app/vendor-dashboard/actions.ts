'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { vendorExperienceEnabled } from '@/lib/vendor-experience';
import {
  BUSINESS_PROFILE_LABELS,
  fetchHasBusinessDocuments,
  fetchOwnVendorProfile,
} from '@/lib/vendor-profile';
import { geocodeNominatim } from '@/lib/geo';
import { getTaxonomy } from '@/lib/taxonomy-db';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
  MICROSITE_TOGGLEABLE_SECTIONS,
} from '@/lib/vendor-microsite';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function nonBlank(raw: FormDataEntryValue | null, max = 128): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

const SLUG_RE = /^[a-z0-9-]{3,32}$/;

function parseSlug(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered.length === 0) return null;
  if (!SLUG_RE.test(lowered)) {
    throw new Error('Slug must be 3–32 chars: lowercase letters, numbers, hyphens.');
  }
  return lowered;
}

const CANONICAL_SERVICE_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * Resolves the EXTRA canonical leaf keys the services picker is allowed to
 * store verbatim in vendor_profiles.services[] — beyond the 30 coarse
 * VENDOR_CATEGORIES. These are the tradition / specialty leaves (e.g. the
 * Chinese specialist set: date_fengshui_consultant, chinese_lauriat_caterer,
 * tea_set_styling, angpao_betrothal_supplier, lion_dance_troupe) that the
 * /explore marketplace tiles + the date-specialist CTA match against, but that
 * no vendor could self-list under before this change.
 *
 * The set is DB-driven and MUST mirror the picker's selection rule in
 * app/vendor-dashboard/profile/page.tsx so the two never disagree: every
 * marketplace-VISIBLE `tradition` leaf with a real tile that either carries a
 * faith tag (genuine cultural specialists) OR is the de-faith'd Chinese
 * banquet caterer (food rows are never faith-tagged per the 2026-06-11
 * de-faith lock, so it's admitted by explicit key allowlist). getTaxonomy() is
 * itself fallback-safe (lib/taxonomy.ts constant when the DB is unseeded), and
 * the whole resolution is wrapped so a hiccup yields an EMPTY set — which makes
 * Save behave exactly as before (any leaf falls through to the custom path /
 * gets dropped), never widening acceptance on a failed read.
 */
const DEFAULT_FOOD_TRADITION_LEAVES: ReadonlySet<string> = new Set([
  'chinese_lauriat_caterer',
]);

async function resolveExtraCanonicalSet(): Promise<ReadonlySet<string>> {
  try {
    const tax = await getTaxonomy();
    const out = new Set<string>();
    for (const [key, meta] of Object.entries(tax.map)) {
      if (meta.tradition !== true) continue;
      if (meta.marketplaceHidden) continue;
      if (!meta.tile) continue;
      if (meta.faith != null || DEFAULT_FOOD_TRADITION_LEAVES.has(key)) {
        out.add(key);
      }
    }
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard] extra-canonical resolution failed', err);
    return new Set<string>();
  }
}

// Iteration 0043 — wedding-type compatibility tags. Allowed values mirror
// the live events.ceremony_type CHECK constraint AND the CEREMONY_TYPES
// picker rendered in app/vendor-dashboard/profile/page.tsx (both 18-wide).
// The canonical list is migration 20261120000000_faith_worldwide_expansion
// (the latest to widen events_ceremony_type_check). Previously this set held
// only the original 7 keys, so Save silently dropped the 11 faith expansions
// (chinese, jewish, born_again, aglipayan, lds, sda, jw, hindu, sikh,
// buddhist, orthodox) — a false-success bug. Validation still rejects truly
// unknown values; we just stop dropping the valid ones.
const ALLOWED_CEREMONY_TYPES: ReadonlySet<string> = new Set([
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'chinese',
  'jewish',
  'born_again',
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
  'mixed',
]);
const ALLOWED_VENUE_SETTINGS: ReadonlySet<string> = new Set([
  'banquet_hall',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
  'civil_registrar',
]);

/**
 * Parse a repeated set of checkbox values into a clean compatibility array.
 * Returns NULL (not `[]`) when nothing is selected so the marketplace
 * filter treats this vendor as "open to all" rather than "compatible with
 * none". Drops anything not in the allowed set as a cheap defense against
 * a hostile client posting arbitrary strings.
 */
function parseCompatibilityArray(
  raw: FormDataEntryValue[],
  allowed: ReadonlySet<string>,
): string[] | null {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!allowed.has(trimmed)) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out.length > 0 ? out : null;
}

/**
 * Parses the repeated hidden inputs the <FileUpload> widget emits for the
 * portfolio gallery into a clean `r2://bucket/key` array.
 *
 * <FileUpload name="portfolio_r2_keys" multiple/> renders one hidden input
 * per uploaded ref, so `formData.getAll('portfolio_r2_keys')` returns all
 * of them. We accept only well-formed `r2://` refs (cheap defense against a
 * client posting arbitrary strings) and cap the array at 10 entries —
 * matches the component-level `maxFiles=10` so a hostile client can't
 * balloon the column.
 */
function parsePortfolioRefs(raw: FormDataEntryValue[], max = 10): string[] {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (!trimmed.startsWith('r2://')) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= max) break; // tier cap (Infinity = unlimited → never breaks)
  }
  return out;
}

/**
 * The logo column accepts either an r2:// ref (from the new <FileUpload>)
 * or a legacy http(s) URL (backwards compat — vendors who already pasted
 * an external image URL keep working). We reject anything else so the
 * column doesn't accumulate junk strings.
 */
function parseLogoValue(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('r2://')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function parseServices(
  raw: FormDataEntryValue | null,
  // Extra canonical leaf keys (tradition / specialty leaves) accepted VERBATIM
  // in addition to the 30 coarse VENDOR_CATEGORIES. Defaults to empty so any
  // submission WITHOUT an extra canonical is parsed byte-identically to before.
  extraCanonical: ReadonlySet<string> = new Set<string>(),
): string[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    // Canonical entries — keep the key verbatim. Either a coarse
    // VENDOR_CATEGORIES enum key OR a real, currently-offered canonical leaf
    // (tradition / specialty). Both are validated against a known set — never
    // an arbitrary string — so this stays a tight allowlist.
    if (CANONICAL_SERVICE_SET.has(item) || extraCanonical.has(item)) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
      continue;
    }
    // Custom entry — trim, length-check, dedupe case-insensitively.
    const trimmed = item.trim().slice(0, 48);
    if (trimmed.length === 0) continue;
    const lc = trimmed.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(trimmed);
    if (out.length >= 24) break;
  }
  return out;
}

export async function saveVendorProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let business_slug: string | null;
  try {
    business_slug = parseSlug(formData.get('business_slug'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard/profile?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const hq_address = nullIfBlank(formData.get('hq_address'));
  const location_city = nullIfBlank(formData.get('location_city'));

  // Tier caps (Phase B portfolio + Phase C #4 custom slug). Soft-probe
  // tier_state + the current business_slug in one query (neither is in
  // FULL_VENDOR_PROFILE_SELECT). One read, reused for both caps below.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, business_slug')
    .eq('user_id', user.id)
    .maybeSingle();
  const tierRowTyped = tierRow as
    | { tier_state?: string | null; business_slug?: string | null }
    | null;
  const caps = tierCaps(asVendorTier(tierRowTyped?.tier_state));
  const portfolioMax = caps.portfolioPhotos;

  // Phase C #4 — a custom website slug is a PRO/ENTERPRISE feature
  // (caps.customWebsiteName). FREE/VERIFIED may keep their existing slug but
  // cannot CHANGE it — reject only the change, never error on an unchanged
  // save (so a downgrade never blocks ordinary profile edits).
  const currentSlug = tierRowTyped?.business_slug ?? null;
  if (!caps.customWebsiteName && business_slug !== currentSlug) {
    return redirect(
      `/vendor-dashboard/profile?error=${encodeURIComponent(
        'A custom website address is a Pro feature. Upgrade to change your slug.',
      )}`,
    );
  }

  // Business owner / representative name — a required Business Profile field.
  const business_owner_name = nullIfBlank(formData.get('business_owner_name'));

  // Year started — a core required Business Profile field, ALWAYS parsed
  // (independent of the experience-verification flag). Public profile shows
  // "X years in business".
  const yearRaw = formData.get('in_business_since_year');
  let in_business_since_year: number | null = null;
  if (typeof yearRaw === 'string' && yearRaw.trim()) {
    const y = Number(yearRaw.trim());
    if (Number.isInteger(y) && y >= 1900 && y <= 2100) in_business_since_year = y;
  }

  // Declared experience extras (service-card trust signal) — flag-gated + schema-
  // dependent (NEXT_PUBLIC_VENDOR_EXPERIENCE_ENABLED). Changing the declared YEAR
  // invalidates any prior admin DTI-verification (the confirmed year no longer
  // matches), so we clear it → the badge falls back to "self-reported" until an
  // admin re-confirms. `in_business_since_year` itself is written from the core
  // field above, not here.
  let experienceFields: Record<string, unknown> = {};
  if (vendorExperienceEnabled()) {
    const wedRaw = formData.get('weddings_done_approx');
    let weddings_done_approx: number | null = null;
    if (typeof wedRaw === 'string' && wedRaw.trim()) {
      const w = Number(wedRaw.trim());
      if (Number.isInteger(w) && w >= 0) weddings_done_approx = Math.min(w, 100000);
    }
    const { data: prior } = await supabase
      .from('vendor_profiles')
      .select('in_business_since_year')
      .eq('user_id', user.id)
      .maybeSingle();
    const priorYear = (prior as { in_business_since_year?: number | null } | null)?.in_business_since_year ?? null;
    experienceFields = {
      weddings_done_approx,
      ...(priorYear !== in_business_since_year
        ? { experience_verified_at: null, experience_verified_by: null }
        : {}),
    };
  }

  // Extra canonical leaves the picker is currently allowed to offer (tradition /
  // specialty leaves). DB-driven + fallback-safe; empty on any hiccup, which
  // makes parseServices behave exactly as before. Mirrors the picker's set in
  // app/vendor-dashboard/profile/page.tsx so the two never disagree.
  const extraCanonicalSet = await resolveExtraCanonicalSet();

  const payload = {
    business_name: nonBlank(formData.get('business_name'), 128),
    business_slug,
    tagline: nullIfBlank(formData.get('tagline')),
    logo_url: parseLogoValue(formData.get('logo_url')),
    services: parseServices(formData.get('services'), extraCanonicalSet),
    business_owner_name,
    in_business_since_year,
    location_city,
    hq_address,
    website: nullIfBlank(formData.get('website')),
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    is_published: formData.get('is_published') === 'on',
    portfolio_r2_keys: parsePortfolioRefs(
      formData.getAll('portfolio_r2_keys'),
      portfolioMax,
    ),
    compatible_ceremony_types: parseCompatibilityArray(
      formData.getAll('compatible_ceremony_types'),
      ALLOWED_CEREMONY_TYPES,
    ),
    compatible_venue_settings: parseCompatibilityArray(
      formData.getAll('compatible_venue_settings'),
      ALLOWED_VENUE_SETTINGS,
    ),
    // event_types is NOT written here anymore — coverage is the source
    // (owner-locked 2026-07-02). It's recomputed as the union across the
    // vendor's coverages by syncProfileEventTypes in services/coverage-actions.ts.
    // Social Sharing Program (20261203000000) — opt OUT of the verification
    // celebration post on Setnayan's Facebook page (unticked = featured;
    // Free unnamed · Pro+ named per the hybrid-anonymity doctrine).
    social_feature_opt_out: formData.get('social_feature_opt_out') === 'on',
    // Same-day "Get help" opt-in (Event Lifecycle Menu PR5, 20270104000000) —
    // willing to take same-day / day-of jobs → surfaces in the couple's Day-of
    // Get-help shortlist (verified + paid tier only). Default off.
    same_day_available: formData.get('same_day_available') === 'on',
    ...experienceFields,
    updated_at: new Date().toISOString(),
  };

  // Business Profile publish gate (vendor onboarding · owner 2026-06-28; Logo
  // added + relabelled 2026-07-02): a vendor can only go LIVE once their
  // Business Profile is complete (the 9 required fields incl. logo + uploaded
  // documents). If they tick "publish" while incomplete, we still save their
  // edits but keep them unpublished and tell them what's missing — never
  // silently publish a half-built profile. Labels come from the shared
  // BUSINESS_PROFILE_LABELS so this gate and the completion card never drift.
  let publishBlockedMissing: string[] = [];
  if (payload.is_published) {
    const { data: idRow } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const vendorProfileId = (idRow as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
    const hasDocuments = vendorProfileId
      ? await fetchHasBusinessDocuments(supabase, vendorProfileId)
      : false;
    const missing: string[] = [];
    if (!payload.logo_url) missing.push(BUSINESS_PROFILE_LABELS.logo);
    if (!payload.business_name) missing.push(BUSINESS_PROFILE_LABELS.business_name);
    if (!business_owner_name) missing.push(BUSINESS_PROFILE_LABELS.business_owner_name);
    if (!hq_address) missing.push(BUSINESS_PROFILE_LABELS.maps_pin);
    if (!payload.contact_phone) missing.push(BUSINESS_PROFILE_LABELS.contact_phone);
    if (!payload.contact_email) missing.push(BUSINESS_PROFILE_LABELS.contact_email);
    if (payload.services.length === 0) missing.push(BUSINESS_PROFILE_LABELS.services);
    if (!in_business_since_year) missing.push(BUSINESS_PROFILE_LABELS.in_business_since_year);
    if (!hasDocuments) missing.push(BUSINESS_PROFILE_LABELS.business_documents);
    if (missing.length > 0) {
      payload.is_published = false;
      publishBlockedMissing = missing;
    }
  }

  const { error } = await supabase
    .from('vendor_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (error) {
    return redirect(
      `/vendor-dashboard/profile?error=${encodeURIComponent(error.message)}`,
    );
  }

  // 2026-05-21 — auto-geocode the HQ when the vendor saves. Best-effort:
  // a Nominatim miss or network blip just leaves hq_latitude/longitude
  // unchanged. The save itself never fails on geocode errors. Prefers
  // hq_address (street-level) over location_city (city-level) for better
  // resolution. Admin-supplied coords (if any) are NOT clobbered here —
  // this UPDATE only fires when the geocoder actually returns something.
  const geocodeQuery = hq_address ?? location_city;
  if (geocodeQuery) {
    const geo = await geocodeNominatim(geocodeQuery);
    if (geo) {
      const admin = createAdminClient();
      await admin
        .from('vendor_profiles')
        .update({
          hq_latitude: geo.latitude,
          hq_longitude: geo.longitude,
        })
        .eq('user_id', user.id);
    }
  }

  // Reverse-image repost-watch: hash the portfolio gallery + flag cross-vendor,
  // non-demo perceptual matches, post-response (cron-free). Scheduled BEFORE the
  // redirect (which throws to unwind) and self-swallowing so it never affects
  // the save. Re-saving with an unchanged gallery is cheap — already-hashed refs
  // are skipped inside the task.
  if (payload.portfolio_r2_keys.length > 0) {
    const { data: idRow } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const vendorProfileId =
      (idRow as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
    if (vendorProfileId) {
      const portfolioRefs = payload.portfolio_r2_keys;
      after(() =>
        hashAndScanVendorImages({
          vendorProfileId,
          refs: portfolioRefs,
          surface: 'portfolio',
        }),
      );
    }
  }

  revalidatePath('/vendor-dashboard/profile');
  if (publishBlockedMissing.length > 0) {
    // Saved, but publishing was blocked — surface exactly what's still missing.
    redirect(
      `/vendor-dashboard/profile?saved=1&publish_blocked=${encodeURIComponent(
        publishBlockedMissing.join(', '),
      )}`,
    );
  }
  redirect('/vendor-dashboard/profile?saved=1');
}

/**
 * The inline single-field patch behind the My Shop → Business Profile editor
 * (2026-07-02). Each checklist row edits ONE field in place instead of deep-
 * linking to the full /profile form.
 *
 * WHY a separate action (not saveVendorProfile): `saveVendorProfile` is a FULL-
 * FORM action — it reads every column from FormData and writes a complete
 * payload, so submitting a single field would null the other eight. This action
 * writes ONLY the one target column (+ updated_at), and re-runs ONLY that
 * field's side-effects, mirroring `saveVendorProfile` EXACTLY and nothing more:
 *   - maps_pin (hq_address) → best-effort Nominatim geocode of hq_latitude/longitude
 *   - in_business_since_year → clear DTI experience-verification if the year
 *     actually changed, flag-gated (same as the full form)
 *   - services → write services[] ONLY. Deliberately does NOT touch event_types
 *     (coverage-owned, owner-locked 2026-07-02 — the full form doesn't sync it
 *     here either).
 *   - logo → NO repost-hash: the repost-watch scope excludes logos (only
 *     portfolio + service covers are hashed, per the 2026-07-01 lock), and the
 *     full form doesn't hash the logo either.
 * It never sets `is_published`, so it can't accidentally publish/unpublish. It
 * returns a VALUE (never redirects) so the client toasts + collapses in place.
 * `saveVendorProfile` stays the untouched full-form escape hatch.
 *
 * Signature is `(prevState, formData)` for `useActionState`. `field` + the value
 * arrive as form inputs; value input names match the /profile form so the exact
 * same parse helpers apply.
 */
export type FieldSaveResult = { ok: true } | { ok: false; error: string };

const INLINE_PROFILE_FIELDS = new Set([
  'logo',
  'business_name',
  'business_owner_name',
  'maps_pin',
  'contact_phone',
  'contact_email',
  'services',
  'in_business_since_year',
]);

export async function updateVendorProfileField(
  _prevState: FieldSaveResult | null,
  formData: FormData,
): Promise<FieldSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Do NOT redirect — the panel must stay mounted so the client can toast.
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const field = String(formData.get('field') ?? '');
  if (!INLINE_PROFILE_FIELDS.has(field)) {
    return { ok: false, error: 'That field can’t be edited here.' };
  }

  // Build a SINGLE-column patch. `geocodeAddress` / `yearChanged` capture the
  // per-field side-effects to run after the base write.
  let patch: Record<string, unknown> = {};
  let geocodeAddress: string | null = null;
  let newYear: number | null = null;
  let runYearExperienceReset = false;

  switch (field) {
    case 'logo': {
      patch = { logo_url: parseLogoValue(formData.get('logo_url')) };
      break;
    }
    case 'business_name': {
      const v = nonBlank(formData.get('business_name'), 128);
      // Required field — never let an inline edit blank it (the publish gate
      // depends on it). Reject rather than write ''.
      if (!v) return { ok: false, error: 'Shop name is required.' };
      patch = { business_name: v };
      break;
    }
    case 'business_owner_name': {
      patch = { business_owner_name: nullIfBlank(formData.get('business_owner_name')) };
      break;
    }
    case 'maps_pin': {
      const v = nullIfBlank(formData.get('hq_address'));
      patch = { hq_address: v };
      geocodeAddress = v; // best-effort geocode below, same as the full form
      break;
    }
    case 'contact_phone': {
      patch = { contact_phone: nullIfBlank(formData.get('contact_phone')) };
      break;
    }
    case 'contact_email': {
      const email = nullIfBlank(formData.get('contact_email'));
      // The inline editor submits with noValidate (so the on-collapse
      // requestSubmit always reaches the server), so the browser's type="email"
      // check no longer guards this — validate the format here instead.
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      patch = { contact_email: email };
      break;
    }
    case 'services': {
      const extraCanonicalSet = await resolveExtraCanonicalSet();
      patch = { services: parseServices(formData.get('services'), extraCanonicalSet) };
      break;
    }
    case 'in_business_since_year': {
      const raw = formData.get('in_business_since_year');
      if (typeof raw === 'string' && raw.trim()) {
        const y = Number(raw.trim());
        if (!Number.isInteger(y) || y < 1900 || y > 2100) {
          return { ok: false, error: 'Enter a valid year.' };
        }
        newYear = y;
      }
      patch = { in_business_since_year: newYear };
      runYearExperienceReset = true;
      break;
    }
    default:
      return { ok: false, error: 'That field can’t be edited here.' };
  }

  // Year change invalidates any admin DTI experience-verification — clear it in
  // the SAME patch when the value actually changed (flag-gated, mirrors
  // saveVendorProfile's experienceFields logic).
  if (runYearExperienceReset && vendorExperienceEnabled()) {
    const { data: prior } = await supabase
      .from('vendor_profiles')
      .select('in_business_since_year')
      .eq('user_id', user.id)
      .maybeSingle();
    const priorYear =
      (prior as { in_business_since_year?: number | null } | null)?.in_business_since_year ?? null;
    if (priorYear !== newYear) {
      patch = { ...patch, experience_verified_at: null, experience_verified_by: null };
    }
  }

  const { error } = await supabase
    .from('vendor_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  // Best-effort geocode for a changed address (async, non-fatal — same contract
  // as saveVendorProfile). Admin-supplied coords aren't clobbered on a miss.
  if (geocodeAddress) {
    const geo = await geocodeNominatim(geocodeAddress);
    if (geo) {
      const admin = createAdminClient();
      await admin
        .from('vendor_profiles')
        .update({ hq_latitude: geo.latitude, hq_longitude: geo.longitude })
        .eq('user_id', user.id);
    }
  }

  revalidatePath('/vendor-dashboard/shop');
  revalidatePath('/vendor-dashboard/profile');
  return { ok: true };
}

/**
 * Flips the "Include team bookings" toggle on the Completed-events backend
 * card (iteration 0022 § 2.4a). The public count is NEVER affected by this
 * toggle — only the vendor's own backend display switches between the
 * team-excluded view (default, matches public) and the full unfiltered
 * view.
 *
 * The toggle change is written to `admin_audit_log` so the vendor's audit
 * trail keeps a record of every flip — action `vendor_backend_count_toggle`.
 */
export async function toggleVendorBackendCount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const requested = formData.get('show_team_bookings');
  const target = requested === 'on' || requested === 'true';

  // Read the existing row + value so we can audit the delta and only
  // write when the value actually changes.
  const { data: profile, error: readError } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, show_team_bookings_in_backend_count')
    .eq('user_id', user.id)
    .maybeSingle();

  if (readError || !profile) {
    return redirect(
      `/vendor-dashboard?error=${encodeURIComponent(
        readError?.message ?? 'Vendor profile not found',
      )}`,
    );
  }

  const previous = profile.show_team_bookings_in_backend_count ?? false;
  if (previous === target) {
    // Idempotent no-op — still revalidate so the URL params flip without
    // a stale audit row.
    revalidatePath('/vendor-dashboard');
    return redirect('/vendor-dashboard?saved=1');
  }

  const { error: updateError } = await supabase
    .from('vendor_profiles')
    .update({
      show_team_bookings_in_backend_count: target,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (updateError) {
    return redirect(
      `/vendor-dashboard?error=${encodeURIComponent(updateError.message)}`,
    );
  }

  // Best-effort audit write. We don't fail the user-visible toggle if the
  // audit table doesn't exist yet (e.g. older test environment); the toggle
  // change still lands on the vendor_profiles row.
  const auditPayload = {
    action: 'vendor_backend_count_toggle' as const,
    target_id: profile.vendor_profile_id,
    actor_user_id: user.id,
    metadata: {
      old_value: previous,
      new_value: target,
      by_user_id: user.id,
    },
  };
  await supabase.from('admin_audit_log').insert(auditPayload);

  revalidatePath('/vendor-dashboard');
  redirect('/vendor-dashboard?saved=1');
}

/**
 * Shortlist Radar (Wave 2) — vendor-facing demand read.
 *
 * Resolves the caller's OWN vendor_profile_id, then calls the two RLS-scoped
 * SECURITY DEFINER RPCs:
 *   • count_saves_for_vendor   → live "N couples saved you" tally (distinct
 *     savers across vendor_follows + guest_saved_vendors, count only — never
 *     a user_id, so guest_saved_vendors stays owner-only at the RLS layer).
 *   • rival_signals_for_vendor → de-identified (month, region, count) demand
 *     rollup in the vendor's hq_region; the RPC itself honors the admin
 *     radar_enabled toggle + min-N floor, so nothing below the floor and no
 *     couple identity ever reaches this process.
 *
 * Best-effort: any failure (no profile, RPC error, pre-migration deploy)
 * collapses to zeros/empty so the dashboard home never breaks.
 */
export type ShortlistRadarSignal = {
  month_bucket: string;
  region_code: string;
  signal_count: number;
};

export type ShortlistRadar = {
  savedCount: number;
  signals: ShortlistRadarSignal[];
};

export async function getShortlistRadar(): Promise<ShortlistRadar> {
  const empty: ShortlistRadar = { savedCount: 0, signals: [] };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return empty;

    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return empty;
    const vendorProfileId = profile.vendor_profile_id;

    const [savesRes, signalsRes] = await Promise.all([
      supabase.rpc('count_saves_for_vendor', {
        p_vendor_profile_id: vendorProfileId,
      }),
      supabase.rpc('rival_signals_for_vendor', {
        p_vendor_profile_id: vendorProfileId,
      }),
    ]);

    const savedCount =
      typeof savesRes.data === 'number' ? savesRes.data : 0;

    const signals: ShortlistRadarSignal[] = Array.isArray(signalsRes.data)
      ? (signalsRes.data as ShortlistRadarSignal[]).map((row) => ({
          month_bucket: String(row.month_bucket),
          region_code: String(row.region_code),
          signal_count: Number(row.signal_count) || 0,
        }))
      : [];

    return { savedCount, signals };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getShortlistRadar] failed', err);
    return empty;
  }
}

/* ─── My Shop → Website editor ──────────────────────────────────────────── */

/**
 * The FREE microsite controls a vendor can edit inline in My Shop → Website.
 * (Pro controls — slug / hero photo / accent / featured editorials / pinned
 * review — are gated on tierCaps.customWebsiteName and land in a follow-up PR.)
 */
const INLINE_WEBSITE_FIELDS = new Set([
  'microsite_about',
  'microsite_sections',
  'microsite_featured_services',
]);

/**
 * Save one FREE microsite field from the My Shop → Website editor. Mirrors
 * updateVendorProfileField (no redirect — the panel stays mounted so the client
 * can toast), and additionally revalidates the public microsite so the change
 * shows immediately on /v/[slug] (and its bare-root alias).
 */
export async function updateVendorWebsiteField(
  _prevState: FieldSaveResult | null,
  formData: FormData,
): Promise<FieldSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const field = String(formData.get('field') ?? '');
  if (!INLINE_WEBSITE_FIELDS.has(field)) {
    return { ok: false, error: 'That field can’t be edited here.' };
  }

  // Current services (to constrain featured picks to owned leaves) + slug (to
  // revalidate the public page). One read, reused below.
  const { data: row } = await supabase
    .from('vendor_profiles')
    .select('business_slug, services')
    .eq('user_id', user.id)
    .maybeSingle();
  const rowTyped = row as
    | { business_slug?: string | null; services?: string[] | null }
    | null;
  const currentServices = (rowTyped?.services ?? []) as string[];
  const slug = rowTyped?.business_slug ?? null;

  let patch: Record<string, unknown> = {};
  switch (field) {
    case 'microsite_about': {
      const raw = nullIfBlank(formData.get('microsite_about'));
      patch = { microsite_about: raw ? raw.slice(0, MICROSITE_ABOUT_MAX) : null };
      break;
    }
    case 'microsite_sections': {
      // Only the toggleable keys are honored. A present checkbox = visible;
      // absent = hidden. Reviews are intentionally not toggleable.
      const sections: Record<string, boolean> = {};
      for (const s of MICROSITE_TOGGLEABLE_SECTIONS) {
        sections[s.key] = formData.get(`section_${s.key}`) === 'on';
      }
      patch = { microsite_sections: sections };
      break;
    }
    case 'microsite_featured_services': {
      const allowed = new Set(currentServices);
      const featured = formData
        .getAll('microsite_featured_services')
        .map(String)
        .filter((s) => allowed.has(s))
        .slice(0, MICROSITE_FEATURED_SERVICES_MAX);
      patch = { microsite_featured_service_ids: featured };
      break;
    }
    default:
      return { ok: false, error: 'That field can’t be edited here.' };
  }

  const { error } = await supabase
    .from('vendor_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/vendor-dashboard/shop');
  if (slug) {
    revalidatePath(`/v/${slug}`);
    revalidatePath(`/${slug}`);
  }
  return { ok: true };
}
