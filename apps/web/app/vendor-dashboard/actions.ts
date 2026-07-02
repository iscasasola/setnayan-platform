'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { vendorExperienceEnabled } from '@/lib/vendor-experience';
import {
  BUSINESS_PROFILE_LABELS,
  fetchOwnVendorProfile,
} from '@/lib/vendor-profile';
import {
  LOCKED_IDENTITY_FIELD_KEYS,
  VERIFIED_LOCK_ERROR,
  fetchVerifiedLock,
  isLockedIdentityFieldKey,
} from '@/lib/vendor-corrections';
import { geocodeNominatim } from '@/lib/geo';
import { getTaxonomy } from '@/lib/taxonomy-db';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_FEATURED_EDITORIALS_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
  MICROSITE_TOGGLEABLE_SECTIONS,
  isValidAccentKey,
  micrositeCan,
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

  // Verified-lock (owner 2026-07-02): once a shop is VERIFIED its 8 identity
  // fields lock server-side — the vendor files a correction request instead
  // (vendor_correction_requests → /admin/corrections). Probed here so the
  // experience-reset + publish gate + payload strip below can all honor it.
  // fetchVerifiedLock is defensive: any read hiccup = NOT locked (never brick
  // an ordinary save on a probe failure).
  const identityLocked = await fetchVerifiedLock(supabase, user.id);

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
      // When identity is verified-locked the year is NOT written below, so a
      // differing form value must not clear the admin's DTI verification.
      ...(priorYear !== in_business_since_year && !identityLocked
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

  // Verified-lock strip (owner 2026-07-02): remove the 8 locked identity keys
  // from the write so the full form's OTHER writes (is_published, tagline,
  // portfolio, opt-outs, compatibility arrays, slug) keep working — a verified
  // vendor's identity edits are preserved-as-current, never applied, and the
  // redirect below surfaces the "Request a correction" notice. The current DB
  // values are read first so the publish gate can still evaluate completeness.
  type LockedIdentitySnapshot = {
    business_name: string | null;
    business_owner_name: string | null;
    hq_address: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    services: string[] | null;
    in_business_since_year: number | null;
    logo_url: string | null;
  };
  let lockedCurrent: LockedIdentitySnapshot | null = null;
  if (identityLocked) {
    try {
      const { data: cur } = await supabase
        .from('vendor_profiles')
        .select(
          'business_name,business_owner_name,hq_address,contact_phone,contact_email,services,in_business_since_year,logo_url',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      lockedCurrent = (cur as LockedIdentitySnapshot | null) ?? null;
    } catch {
      lockedCurrent = null;
    }
    const strip = payload as unknown as Record<string, unknown>;
    for (const key of LOCKED_IDENTITY_FIELD_KEYS) delete strip[key];
  }

  // Effective identity values for the publish gate — the CURRENT DB values
  // when locked (they're what stays written), the form payload otherwise.
  const eff = identityLocked
    ? {
        logo_url: lockedCurrent?.logo_url ?? null,
        business_name: lockedCurrent?.business_name ?? '',
        business_owner_name: lockedCurrent?.business_owner_name ?? null,
        hq_address: lockedCurrent?.hq_address ?? null,
        contact_phone: lockedCurrent?.contact_phone ?? null,
        contact_email: lockedCurrent?.contact_email ?? null,
        services: lockedCurrent?.services ?? [],
        in_business_since_year: lockedCurrent?.in_business_since_year ?? null,
      }
    : {
        logo_url: payload.logo_url,
        business_name: payload.business_name,
        business_owner_name,
        hq_address,
        contact_phone: payload.contact_phone,
        contact_email: payload.contact_email,
        services: payload.services,
        in_business_since_year,
      };

  // Business Profile publish gate (vendor onboarding · owner 2026-06-28; Logo
  // added + relabelled 2026-07-02; documents REMOVED 2026-07-03): a vendor can
  // go LIVE once the 8 identity fields are complete. Verification documents no
  // longer gate publication — they moved to the My Shop "Get verified" section
  // and gate only the verified BADGE (owner-approved redesign: "profile
  // complete → couples can find and contact you; get verified to earn the
  // badge"). If they tick "publish" while incomplete, we still save their
  // edits but keep them unpublished and tell them what's missing — never
  // silently publish a half-built profile. Labels come from the shared
  // BUSINESS_PROFILE_LABELS so this gate and the completion card never drift.
  let publishBlockedMissing: string[] = [];
  if (payload.is_published) {
    const missing: string[] = [];
    // Lock-aware effective values (B2): when identity is locked the gate
    // evaluates the CURRENT DB values, not the stripped form payload.
    // Documents deliberately absent (2026-07-03): verification gates only the
    // badge, never publication.
    if (!eff.logo_url) missing.push(BUSINESS_PROFILE_LABELS.logo);
    if (!eff.business_name) missing.push(BUSINESS_PROFILE_LABELS.business_name);
    if (!eff.business_owner_name) missing.push(BUSINESS_PROFILE_LABELS.business_owner_name);
    if (!eff.hq_address) missing.push(BUSINESS_PROFILE_LABELS.maps_pin);
    if (!eff.contact_phone) missing.push(BUSINESS_PROFILE_LABELS.contact_phone);
    if (!eff.contact_email) missing.push(BUSINESS_PROFILE_LABELS.contact_email);
    if (eff.services.length === 0) missing.push(BUSINESS_PROFILE_LABELS.services);
    if (!eff.in_business_since_year) missing.push(BUSINESS_PROFILE_LABELS.in_business_since_year);
    if (missing.length > 0) {
      payload.is_published = false;
      publishBlockedMissing = missing;
    }
  }

  // QR-in-media guard (owner-locked 2026-07-03): website media may not embed
  // the vendor's invite/lock QR. Scan only refs NOT already stored (an
  // unchanged gallery re-save costs nothing) — the authoritative server-side
  // reject; the <FileUpload qrGuard> client check is fast feedback only.
  // vendorQrGuardRejects fails OPEN on scanner trouble, never blocking an
  // honest save (the admin retro-scan is the backstop).
  {
    const { data: curMedia } = await supabase
      .from('vendor_profiles')
      .select('portfolio_r2_keys, logo_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const cur = curMedia as
      | { portfolio_r2_keys?: string[] | null; logo_url?: string | null }
      | null;
    const stored = new Set((cur?.portfolio_r2_keys ?? []).filter(Boolean));
    const toScan = payload.portfolio_r2_keys.filter((r) => !stored.has(r));
    // logo_url is absent from payload when identity is verified-locked (the
    // strip above) — the optional chain skips it cleanly then.
    if (payload.logo_url && payload.logo_url !== cur?.logo_url) {
      toScan.push(payload.logo_url);
    }
    if (toScan.length > 0 && (await vendorQrGuardRejects(toScan))) {
      return redirect(
        `/vendor-dashboard/profile?error=${encodeURIComponent(VENDOR_QR_MEDIA_ERROR)}`,
      );
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
  // When identity is verified-locked the form's hq_address was NOT written, so
  // it must not drive the geocode either (coords would drift from the stored
  // address). City-level geocode stays available.
  const geocodeQuery = identityLocked ? location_city : hq_address ?? location_city;
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
  if (identityLocked) {
    // Other edits saved; identity fields were preserved — surface the notice.
    redirect('/vendor-dashboard/profile?saved=1&identity_locked=1');
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
 *   - maps_pin (hq_address) → best-effort Nominatim geocode of hq_latitude/longitude,
 *     UNLESS the form posts a vendor-pinned hq_latitude/hq_longitude (the My Shop
 *     map picker) — those save directly and the server geocode is skipped
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

  // Verified-lock (owner 2026-07-02): every inline field IS one of the 8
  // locked identity fields, so a verified shop can't patch any of them —
  // corrections go through requestProfileCorrection → /admin/corrections.
  if (await fetchVerifiedLock(supabase, user.id)) {
    return { ok: false, error: VERIFIED_LOCK_ERROR };
  }

  // Build a SINGLE-column patch. `geocodeAddress` / `yearChanged` capture the
  // per-field side-effects to run after the base write.
  let patch: Record<string, unknown> = {};
  let geocodeAddress: string | null = null;
  let newYear: number | null = null;
  let runYearExperienceReset = false;

  switch (field) {
    case 'logo': {
      const logoRef = parseLogoValue(formData.get('logo_url'));
      // QR-in-media guard (owner 2026-07-03): the logo renders on the public
      // vendor page — it may not embed the vendor's invite/lock QR.
      if (logoRef && (await vendorQrGuardRejects([logoRef]))) {
        return { ok: false, error: VENDOR_QR_MEDIA_ERROR };
      }
      patch = { logo_url: logoRef };
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
      // Vendor-placed map pin (My Shop's inline editor posts hidden
      // hq_latitude/hq_longitude when the vendor dragged the pin, clicked the
      // map, or accepted a client-side geocode of THIS text): more precise than
      // any server re-geocode of the address — save it directly and skip the
      // Nominatim round-trip. Absent/malformed coords fall through to today's
      // geocode path unchanged.
      const parseCoord = (raw: FormDataEntryValue | null, absMax: number): number | null => {
        if (typeof raw !== 'string' || raw.trim() === '') return null;
        const n = Number(raw.trim());
        return Number.isFinite(n) && Math.abs(n) <= absMax ? n : null;
      };
      const lat = parseCoord(formData.get('hq_latitude'), 90);
      const lng = parseCoord(formData.get('hq_longitude'), 180);
      if (v && lat !== null && lng !== null) {
        patch = { ...patch, hq_latitude: lat, hq_longitude: lng };
      } else {
        geocodeAddress = v; // best-effort geocode below, same as the full form
      }
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
 * Request-a-correction for a VERIFIED (identity-locked) shop (owner
 * 2026-07-02). Instead of editing one of the 8 locked identity fields, the
 * vendor files a vendor_correction_requests row ("change <field> from
 * <current> to <requested>"); an admin applies or declines it on
 * /admin/corrections. `(prevState, formData)` signature for useActionState —
 * returns a VALUE, never redirects, so the panel can toast in place.
 *
 * Defensive: a pre-migration database (missing table) returns a friendly
 * error instead of crashing.
 */
export type CorrectionRequestResult = { ok: true } | { ok: false; error: string };

export async function requestProfileCorrection(
  _prevState: CorrectionRequestResult | null,
  formData: FormData,
): Promise<CorrectionRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const fieldKey = formData.get('field_key');
  if (!isLockedIdentityFieldKey(fieldKey)) {
    return { ok: false, error: 'That field can’t be corrected here.' };
  }
  const requestedValue = nullIfBlank(formData.get('requested_value'));
  const note = nullIfBlank(formData.get('note'));
  if (!requestedValue && !note) {
    return { ok: false, error: 'Tell us what the value should be.' };
  }

  // Own profile + a display snapshot of the current value for the admin queue.
  const { data: profRow, error: profErr } = await supabase
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,business_name,business_owner_name,hq_address,contact_phone,contact_email,services,in_business_since_year,logo_url',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (profErr || !profRow) {
    return { ok: false, error: 'Vendor profile not found.' };
  }
  const prof = profRow as Record<string, unknown> & { vendor_profile_id: string };
  const rawCurrent = prof[fieldKey];
  const currentValue = Array.isArray(rawCurrent)
    ? rawCurrent.join(', ')
    : rawCurrent == null
      ? null
      : String(rawCurrent);

  const { error } = await supabase.from('vendor_correction_requests').insert({
    vendor_profile_id: prof.vendor_profile_id,
    field_key: fieldKey,
    current_value: currentValue,
    requested_value: requestedValue ? requestedValue.slice(0, 2000) : null,
    note: note ? note.slice(0, 1000) : null,
  });
  if (error) {
    // Pre-migration table-missing lands here too — friendly, non-technical.
    return {
      ok: false,
      error:
        'Your correction request couldn’t be filed right now — please try again shortly.',
    };
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
  // PRO controls (gated on tierCaps.customWebsiteName).
  'business_slug',
  'microsite_hero_photo',
  'microsite_accent',
  'microsite_pinned_review',
  'microsite_featured_editorials',
]);

/** SOLO+-gated website fields — personalizing the page (tier ladder 2026-07-03).
 *  Free/Verified get the auto-composed page; Solo unlocks these. */
const SOLO_WEBSITE_FIELDS = new Set([
  'microsite_about',
  'microsite_sections',
  'microsite_featured_services',
  'microsite_accent',
]);

/** PRO-gated website fields. Reuses the same cap the custom slug already uses. */
const PRO_WEBSITE_FIELDS = new Set([
  'business_slug',
  'microsite_hero_photo',
  'microsite_pinned_review',
  'microsite_featured_editorials',
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

  // One read, reused below: current services (constrain featured picks to owned
  // leaves), portfolio keys (constrain hero photo), slug (revalidation), tier
  // (Pro gate).
  const { data: row } = await supabase
    .from('vendor_profiles')
    .select('business_slug, services, portfolio_r2_keys, tier_state')
    .eq('user_id', user.id)
    .maybeSingle();
  const rowTyped = row as
    | {
        business_slug?: string | null;
        services?: string[] | null;
        portfolio_r2_keys?: string[] | null;
        tier_state?: string | null;
      }
    | null;
  const currentServices = (rowTyped?.services ?? []) as string[];
  const currentSlug = rowTyped?.business_slug ?? null;
  const portfolioKeys = (rowTyped?.portfolio_r2_keys ?? []) as string[];
  const caps = tierCaps(asVendorTier(rowTyped?.tier_state));

  // SOLO gate — personalizing the page (About / sections / featured services)
  // is a Solo+ benefit. Free/Verified are auto-composed. Server-side backstop.
  if (
    SOLO_WEBSITE_FIELDS.has(field) &&
    !micrositeCan(rowTyped?.tier_state).canPersonalize
  ) {
    return {
      ok: false,
      error: 'Personalizing your page is a Solo feature — upgrade to customize.',
    };
  }

  // PRO gate — the premium customization controls reuse the same cap as the
  // custom slug (Pro/Enterprise). The UI hides them for lower tiers; this is
  // the server-side backstop.
  if (PRO_WEBSITE_FIELDS.has(field) && !caps.customWebsiteName) {
    return { ok: false, error: 'This is a Pro feature — upgrade to customize.' };
  }

  // Slug edits change the public path — revalidate BOTH the old and the new.
  let nextSlug = currentSlug;

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
    case 'business_slug': {
      let parsed: string | null;
      try {
        parsed = parseSlug(formData.get('business_slug'));
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      patch = { business_slug: parsed };
      nextSlug = parsed;
      break;
    }
    case 'microsite_hero_photo': {
      // Must be one of the vendor's own portfolio photos, or cleared.
      const raw = nullIfBlank(formData.get('microsite_hero_photo'));
      if (raw && !portfolioKeys.includes(raw)) {
        return { ok: false, error: 'Pick a photo from your portfolio.' };
      }
      patch = { microsite_hero_photo_key: raw };
      break;
    }
    case 'microsite_accent': {
      const raw = nullIfBlank(formData.get('microsite_accent'));
      if (raw && !isValidAccentKey(raw)) {
        return { ok: false, error: 'Pick an accent from the palette.' };
      }
      patch = { microsite_accent: raw };
      break;
    }
    case 'microsite_pinned_review': {
      // Store the chosen review_id (or clear). The public render only pins it
      // when it matches one of THIS vendor's fetched reviews, so a stale/foreign
      // id simply doesn't pin — no cross-vendor leak. Cap length defensively.
      const raw = nullIfBlank(formData.get('microsite_pinned_review'));
      patch = { microsite_pinned_review_id: raw ? raw.slice(0, 64) : null };
      break;
    }
    case 'microsite_featured_editorials': {
      // Up to 3 story event_ids to feature first in the public Editorials
      // section. The public render only surfaces ids that match one of THIS
      // vendor's published stories, so a stale/foreign id simply no-ops.
      const featured = formData
        .getAll('microsite_featured_editorials')
        .map(String)
        .filter(Boolean)
        .slice(0, MICROSITE_FEATURED_EDITORIALS_MAX);
      patch = { microsite_featured_editorial_ids: featured };
      break;
    }
    default:
      return { ok: false, error: 'That field can’t be edited here.' };
  }

  const { error } = await supabase
    .from('vendor_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) {
    // Surface the common slug-collision case with friendly copy.
    if (field === 'business_slug' && /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: 'That address is taken — try another.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/vendor-dashboard/shop');
  for (const s of new Set([currentSlug, nextSlug].filter(Boolean) as string[])) {
    revalidatePath(`/v/${s}`);
    revalidatePath(`/${s}`);
  }
  return { ok: true };
}
