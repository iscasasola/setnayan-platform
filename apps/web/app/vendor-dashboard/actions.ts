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
  isLockedLogoCompletion,
  fetchVerifiedLock,
  isLockedIdentityFieldKey,
} from '@/lib/vendor-corrections';
import { geocodeNominatim } from '@/lib/geo';
import { parseVideoLink } from '@/lib/video-embed';
import { getTaxonomy } from '@/lib/taxonomy-db';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_FEATURED_EDITORIALS_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
  MICROSITE_TOGGLEABLE_SECTIONS,
  MICROSITE_VIDEOS_MAX,
  isValidAccentKey,
  micrositeCan,
  parseVideoRef,
  serializeVideoRef,
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
 * Parses the repeated `gallery_video_links` inputs from the Featured-videos
 * editor into a clean array of external video URLs. Each value is validated
 * through `parseVideoLink` (drops non-URLs, non-http(s) schemes like
 * `javascript:`, and unrecognised junk) and stored as the normalised full URL.
 * Deduped and capped at 10 to match the DB `cardinality <= 10` CHECK, so a
 * hostile client can't balloon the column past the constraint.
 */
function parseVideoLinks(raw: FormDataEntryValue[], max = 10): string[] {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const parsed = parseVideoLink(item);
    if (!parsed) continue;
    if (out.includes(parsed.originalUrl)) continue;
    out.push(parsed.originalUrl);
    if (out.length >= max) break;
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
    // Featured videos — external URLs (YouTube/Vimeo inline · IG/FB/TikTok
    // link-out). Validated + capped at 10 to match the DB CHECK. Additive
    // 2026-07-05; not a locked-identity field, so it stays editable post-verify.
    gallery_video_links: parseVideoLinks(
      formData.getAll('gallery_video_links'),
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
    for (const key of LOCKED_IDENTITY_FIELD_KEYS) {
      // One exception (2026-07-21): a verified shop whose logo is EMPTY may
      // still fill it in. Since the logo stopped being mandatory at
      // registration, a verified vendor can exist with logo_url NULL — and
      // with `requestProfileCorrection` having no UI wired to it, stripping
      // this write would leave them no way to ever add a logo. Blank →
      // non-blank only; changing an existing logo stays locked.
      if (key === 'logo_url' && isLockedLogoCompletion(lockedCurrent?.logo_url, payload.logo_url)) {
        continue;
      }
      delete strip[key];
    }
  }
  // True when the strip above let a first-ever logo through, so the publish
  // gate below evaluates the value we are actually about to write.
  const logoCompletionAllowed =
    identityLocked && isLockedLogoCompletion(lockedCurrent?.logo_url, payload.logo_url);

  // Effective identity values for the publish gate — the CURRENT DB values
  // when locked (they're what stays written), the form payload otherwise.
  const eff = identityLocked
    ? {
        logo_url: logoCompletionAllowed
          ? payload.logo_url
          : (lockedCurrent?.logo_url ?? null),
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
  // Gallery & media (relocated from the retired /profile page to My Shop →
  // Website · 2026-07-05). NOT locked-identity fields, so they stay editable
  // post-verification — the verified-lock guard below allowlists them.
  'portfolio',
  'gallery_videos',
]);

/**
 * The Gallery & media fields (portfolio photos + featured video links) that
 * stay editable even after a shop is VERIFIED (identity-locked). These are not
 * among the 8 locked identity fields, so a verified vendor can still curate
 * their gallery — the verified-lock guard skips them.
 */
const GALLERY_MEDIA_FIELDS = new Set(['portfolio', 'gallery_videos']);

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

  // Verified-lock (owner 2026-07-02): the 8 IDENTITY inline fields can't be
  // patched by a verified shop — corrections go through
  // requestProfileCorrection → /admin/corrections. The Gallery & media fields
  // (portfolio / featured videos) are NOT locked identity, so they stay
  // editable post-verification (matches the retired /profile full-form, whose
  // verified-lock strip never touched portfolio_r2_keys / gallery_video_links).
  if (
    !GALLERY_MEDIA_FIELDS.has(field) &&
    (await fetchVerifiedLock(supabase, user.id))
  ) {
    // ONE exception (2026-07-21): a verified shop with an EMPTY logo may
    // still add one. Owner decision 4 made the logo optional at registration,
    // so "verified with logo_url NULL" is now a state a real vendor can be
    // in — and this lock, with `requestProfileCorrection` having no UI wired
    // to it anywhere, is what made that state permanent. Blank → non-blank
    // only; replacing an existing logo stays locked, which is the rule that
    // protects the identity an admin actually signed off on.
    let allowLogoCompletion = false;
    if (field === 'logo') {
      const { data: cur } = await supabase
        .from('vendor_profiles')
        .select('logo_url')
        .eq('user_id', user.id)
        .maybeSingle();
      allowLogoCompletion = isLockedLogoCompletion(
        (cur as { logo_url?: string | null } | null)?.logo_url ?? null,
        parseLogoValue(formData.get('logo_url')),
      );
    }
    if (!allowLogoCompletion) {
      return { ok: false, error: VERIFIED_LOCK_ERROR };
    }
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
    case 'portfolio': {
      // Portfolio photos (relocated to My Shop → Website · 2026-07-05). Mirrors
      // saveVendorProfile's parse + tier cap + QR-guard + repost-hash EXACTLY so
      // behavior is identical to the retired /profile full-form.
      const { data: tierRow } = await supabase
        .from('vendor_profiles')
        .select('tier_state, portfolio_r2_keys, vendor_profile_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const tr = tierRow as
        | {
            tier_state?: string | null;
            portfolio_r2_keys?: string[] | null;
            vendor_profile_id?: string;
          }
        | null;
      const portfolioMax = tierCaps(asVendorTier(tr?.tier_state)).portfolioPhotos;
      const refs = parsePortfolioRefs(
        formData.getAll('portfolio_r2_keys'),
        portfolioMax,
      );
      // QR-in-media guard (owner 2026-07-03): only scan refs NOT already stored
      // (an unchanged re-save costs nothing). Fails OPEN on scanner trouble.
      const stored = new Set((tr?.portfolio_r2_keys ?? []).filter(Boolean));
      const toScan = refs.filter((r) => !stored.has(r));
      if (toScan.length > 0 && (await vendorQrGuardRejects(toScan))) {
        return { ok: false, error: VENDOR_QR_MEDIA_ERROR };
      }
      patch = { portfolio_r2_keys: refs };
      // Repost-watch: hash the gallery post-write (cron-free, self-swallowing).
      if (refs.length > 0 && tr?.vendor_profile_id) {
        const vendorProfileId = tr.vendor_profile_id;
        after(() =>
          hashAndScanVendorImages({
            vendorProfileId,
            refs,
            surface: 'portfolio',
          }),
        );
      }
      break;
    }
    case 'gallery_videos': {
      // Featured videos (relocated · 2026-07-05). External URLs validated +
      // deduped + capped at 10 to match the DB cardinality CHECK — identical to
      // saveVendorProfile's gallery_video_links parse.
      patch = {
        gallery_video_links: parseVideoLinks(
          formData.getAll('gallery_video_links'),
        ),
      };
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
  // Gallery & media edits (portfolio / featured videos) also change the PUBLIC
  // microsite, so revalidate /v/[slug] + its bare-root alias — mirrors what the
  // full-form saveVendorProfile relied on via its /vendor-dashboard revalidate.
  if (GALLERY_MEDIA_FIELDS.has(field)) {
    const { data: slugRow } = await supabase
      .from('vendor_profiles')
      .select('business_slug')
      .eq('user_id', user.id)
      .maybeSingle();
    const slug = (slugRow as { business_slug?: string | null } | null)?.business_slug;
    if (slug) {
      revalidatePath(`/v/${slug}`);
      revalidatePath(`/${slug}`);
    }
  }
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
  // ENTERPRISE control (gated on micrositeCan().isEnterprise).
  'microsite_videos',
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

/** ENTERPRISE-gated website fields — the "Flagship" 4th-tier differentiators
 *  (owner 2026-07-03). The video portfolio is Enterprise-only. */
const ENTERPRISE_WEBSITE_FIELDS = new Set(['microsite_videos']);

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

  // ENTERPRISE gate — the video portfolio is a Flagship differentiator. UI hides
  // it below Enterprise; server-side backstop.
  if (
    ENTERPRISE_WEBSITE_FIELDS.has(field) &&
    !micrositeCan(rowTyped?.tier_state).isEnterprise
  ) {
    return {
      ok: false,
      error: 'Video portfolio is an Enterprise feature — upgrade to add films.',
    };
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
    case 'microsite_videos': {
      // Enterprise "Films" portfolio — normalize each submitted value to a
      // canonical YouTube/Vimeo ref (owner-locked providers; Drive rejected),
      // serialize provider-prefixed, drop unrecognizable + cross-provider dupes,
      // cap the combined rack.
      const seen = new Set<string>();
      const stored: string[] = [];
      for (const v of formData.getAll('microsite_videos').map(String)) {
        const ref = parseVideoRef(v);
        if (!ref) continue;
        const key = serializeVideoRef(ref);
        if (seen.has(key)) continue;
        seen.add(key);
        stored.push(key);
        if (stored.length >= MICROSITE_VIDEOS_MAX) break;
      }
      patch = { microsite_video_ids: stored };
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

/**
 * Save the shop's precise founding DATE (`in_business_since_date`, migration
 * 20270805100000) — drives the exact business monthsary/anniversary day. A
 * plain server-action form (no client JS): blank clears it. The write is
 * guarded so a not-yet-applied migration (apply-lag) fails soft instead of
 * throwing; the revalidate re-renders the shop + Overview with the saved value.
 */
export async function updateBusinessStartDate(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return;

  const raw = String(formData.get('in_business_since_date') ?? '').trim();
  // Accept a full ISO date, or blank to clear. Reject anything else.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

  try {
    await supabase
      .from('vendor_profiles')
      .update({ in_business_since_date: value })
      .eq('vendor_profile_id', profile.vendor_profile_id);
  } catch {
    // graceful-degrade: apply-lag or a transient error — nothing to surface on
    // a plain-form action; the revalidate will show whether it persisted.
  }
  revalidatePath('/vendor-dashboard/shop');
  revalidatePath('/vendor-dashboard');
}
