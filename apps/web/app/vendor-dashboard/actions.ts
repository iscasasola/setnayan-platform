'use server';

import { revalidatePath } from 'next/cache';
import { parseClientRef, vendorOwnedMediaPolicy } from '@/lib/r2-client-ref';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { vendorExperienceEnabled } from '@/lib/vendor-experience';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  VERIFIED_LOCK_ERROR,
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
import { findSlugConflict, SLUG_CONFLICT_MESSAGE } from '@/lib/slug-availability';
import { parseCoordPair } from '@/lib/parse-coord';
import { parsePhPhone } from '@/lib/ph-phone';
import { OPEN_SHOP_ERRORS } from '@/lib/open-shop-validation';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function nonBlank(raw: FormDataEntryValue | null, max = 128): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
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

// Iteration 0043 — wedding-type compatibility tags.
//
// The vocabulary and the parse MOVED to `lib/vendor-compatibility.ts` on
// 2026-08-05; the last consumer in THIS file went with `saveVendorProfile` on
// 2026-08-09 (see the tombstone below). The vendor-side allowlist now lives
// with its only writer, `shop/venue-match-actions.ts` — the card that actually
// renders the checkboxes, where "absent" honestly means "the vendor unticked
// it" instead of "this form never asked". `lib/venue-settings.test.ts` asserts
// the import THERE, so the list still cannot go back to being hand-typed.

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
function parsePortfolioRefs(
  raw: FormDataEntryValue[],
  max: number,
  vendorProfileId: string,
): string[] {
  // ── 🔴 SEC-1: EVERY ref is pinned to THIS vendor's own folder ──────────────
  //
  // The `startsWith('r2://')` check below used to be the only validation, and it
  // was not enough by a wide margin. `/v/[slug]` — the PUBLIC vendor page —
  // resolves this column through `resolvePortfolioUrls` → `displayUrlForStoredAsset`,
  // which is precisely the function `lib/r2-client-ref.ts` documents as signing
  // "any r2:// ref for any of the five buckets with no tenancy check whatsoever".
  //
  // So a vendor could put `r2://setnayan-vendor-verification/vendors/{someone
  // else}/verification/dti.pdf` into their OWN portfolio array and their own
  // public profile would publish it — another vendor's DTI / BIR 2303 / Mayor's
  // Permit, i.e. government ID documents, served to the open internet. Worse than
  // the paperwork lane (#3902), which at least required a signed-in host.
  //
  // `vendorOwnedMediaPolicy` pins both halves: the PUBLIC media bucket (never a
  // private one) and the `vendors/{thisVendor}/` prefix. A ref that fails is
  // DROPPED rather than throwing — a portfolio is a list, and one bad entry must
  // not fail an otherwise valid profile save — but it can never be stored, so the
  // publish path has nothing to sign.
  const policy = vendorOwnedMediaPolicy(vendorProfileId);
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (!trimmed.startsWith('r2://')) continue;
    if (out.includes(trimmed)) continue;
    if (!parseClientRef(trimmed, policy)) continue; // not this vendor's own media
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

/**
 * ── `saveVendorProfile` — DELETED 2026-08-09. Do not bring it back. ─────────
 *
 * It was the server action behind the full `/vendor-dashboard/profile` form,
 * retired 2026-07-05. The route became a redirect stub to My Shop; the action
 * outlived it by five weeks with NO CALLER, still exported from a `'use server'`
 * module whose other exports are wired to client components.
 *
 * WHY DELETED RATHER THAN PATCHED. It built a FULL payload from FormData and
 * `UPDATE`d the whole thing, so every column it named was written from whatever
 * the submission happened to carry — and absence is not emptiness:
 *
 *   • THREE blind booleans, `<key> = formData.get('<key>') === 'on'`, where a
 *     submission that never carried the checkbox writes FALSE:
 *       - `is_published`         → unpublishes the shop
 *       - `social_feature_opt_out` → silently opts the shop OUT of the
 *         verification celebration post
 *       - `same_day_available`   → drops the shop from the couple's Day-of
 *         "Get help" shortlist
 *     There is no `name="is_published"` control anywhere in the VENDOR UI (the
 *     app's only one is the ADMIN page, app/admin/vendors/[id]/edit/page.tsx),
 *     and none at all for the other two. So EVERY possible caller was a caller
 *     that would have written all three to false.
 *   • TWELVE more columns nulled by absence — tagline, website, contact_email,
 *     contact_phone, location_city, hq_address, logo_url, services,
 *     business_owner_name, in_business_since_year, portfolio_r2_keys,
 *     gallery_video_links.
 *   • It bypassed the per-field validators that replaced it: a submission with
 *     no `business_name` wrote `''`, which `updateVendorProfileField` refuses
 *     outright ("Shop name is required") precisely because the publish gate
 *     depends on that field being non-blank.
 *
 * The compatibility pair was already fenced off in 2026-08-05 under a comment
 * headed "COMPATIBILITY: ABSENT ≠ EMPTY" — the same class of bug, found twice,
 * fixed for two of fifteen columns. Fencing the remaining thirteen one key at a
 * time would have left a full-form escape hatch nobody calls and everybody has
 * to keep re-auditing. Deleting the function closes all fifteen at once.
 *
 * NOTHING WAS LOST that a vendor can still reach: the identity + gallery fields
 * live on `updateVendorProfileField`; `business_slug` + microsite on
 * `updateVendorWebsiteField`; venue/ceremony fit on
 * `shop/venue-match-actions.ts`; the founding date on `updateBusinessStartDate`.
 * ⚠ Four columns it named have NO live writer and did not gain one here —
 * `tagline`, `website`, `social_feature_opt_out`, `same_day_available`. They
 * had none before this deletion either (the action had no caller), so this is a
 * PRE-EXISTING gap being recorded, not one being created.
 *
 * The `is_published` half of this is locked by `lib/vendor-publish-guard.test.ts`,
 * which fails on any formData-derived write to that column from a vendor-scoped
 * action. Publishing is an ADMIN decision (/admin/verify writes
 * `public_visibility` + `verification_state`, the live marketplace gate).
 */

/**
 * The inline single-field patch behind the My Shop → Business Profile editor
 * (2026-07-02). Each checklist row edits ONE field in place instead of deep-
 * linking to the full /profile form.
 *
 * WHY a separate action (not saveVendorProfile): `saveVendorProfile` WAS a
 * FULL-FORM action — it read every column from FormData and wrote a complete
 * payload, so submitting a single field would null the other eight. That is why
 * this one was built, and ultimately why the other was deleted on 2026-08-09
 * (see the tombstone above). This action writes ONLY the one target column
 * (+ updated_at), and re-runs ONLY that field's side-effects, which mirrored
 * `saveVendorProfile` EXACTLY and nothing more:
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
 * It never sets `is_published`, so it can't accidentally publish/unpublish —
 * the property the full form did NOT have, and the reason that one is gone
 * (`lib/vendor-publish-guard.test.ts` now enforces it for every vendor-scoped
 * action, this one included). It returns a VALUE (never redirects) so the
 * client toasts + collapses in place.
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
  // VENUE SIZE + CAPACITY (owner 2026-08-07: "allowing vendors to set the sizes
  // of their venues so customers can fillup the space").
  //
  // One field key carrying four numbers, because they are one answer about one
  // room and a couple's plan cannot use half of it. `capacity_min`/`capacity_max`
  // already existed with NO WRITER anywhere — same screen, same audience, so
  // they are picked up here rather than left as one more setting nobody can set.
  'venue_size',
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
      // The city travels WITH the address rather than as its own row, for two
      // reasons. It is the same fact — a street and the city it is in — and
      // splitting them invites the two to disagree. And a new checklist row
      // would flip every existing vendor's Business Profile from complete to
      // incomplete overnight for a field they were never asked for.
      //
      // `nullIfBlank`, not a blank-guard: clearing the city is a real edit here,
      // unlike the signup wizard where an absent field means "not asked".
      if (formData.has('location_city')) {
        patch = { ...patch, location_city: nullIfBlank(formData.get('location_city')) };
      }
      // Vendor-placed map pin (My Shop's inline editor posts hidden
      // hq_latitude/hq_longitude when the vendor dragged the pin, clicked the
      // map, or accepted a client-side geocode of THIS text): more precise than
      // any server re-geocode of the address — save it directly and skip the
      // Nominatim round-trip. Absent/malformed coords fall through to today's
      // geocode path unchanged.
      // This copy was already CORRECT — it string-checked before coercing. It
      // moves to the shared helper anyway: three hand-written copies of one
      // rule, two right and one wrong, is exactly how the wizard shipped the
      // Null Island bug while this screen was fine.
      const pin = parseCoordPair(formData.get('hq_latitude'), formData.get('hq_longitude'));
      if (v && pin) {
        patch = { ...patch, hq_latitude: pin.lat, hq_longitude: pin.lng };
      } else {
        geocodeAddress = v; // best-effort geocode below, same as the full form
      }
      break;
    }
    case 'contact_phone': {
      // ── THE SAME RULE AS SIGNUP, BECAUSE IT IS THE SAME NUMBER ─────────────
      // Owner-locked 2026-08-10: the contact number must be a real Philippine
      // one. Validating it only where a shop is CREATED would have meant a
      // vendor could pass the rule on day one and then replace the number with
      // anything the next day, on this screen — which is the more likely path,
      // since this is where a number actually gets changed.
      //
      // Validated here for the same reason the email beneath it is: the inline
      // editor submits with noValidate, so nothing in the browser is checking.
      const rawPhone = nullIfBlank(formData.get('contact_phone'));
      if (rawPhone) {
        const parsed = parsePhPhone(rawPhone);
        if (!parsed.ok) return { ok: false, error: OPEN_SHOP_ERRORS.contactPhoneNotPh };
        // Stored canonically, so the same number typed four ways is one value
        // here and at signup rather than two spellings of the same shop.
        patch = { contact_phone: parsed.e164 };
      } else {
        patch = { contact_phone: null };
      }
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
    case 'venue_size': {
      // Both dimensions or neither — the DB CHECK enforces the same pair, and
      // the couple-side seeding cannot use a width with no length. Clearing the
      // room (both blank) is legitimate and must stay possible: a vendor who
      // stops offering a fixed room should be able to say so.
      const dim = (key: string): number | null | 'bad' => {
        const raw = formData.get(key);
        if (typeof raw !== 'string' || !raw.trim()) return null;
        const n = Number(raw.trim());
        // 500 m mirrors `parseDim` in the seating action, which already clamps
        // the couple's own input — the two ends of one number must agree.
        if (!Number.isFinite(n) || n <= 0 || n > 500) return 'bad';
        return n;
      };
      const w = dim('venue_width_m');
      const l = dim('venue_length_m');
      if (w === 'bad' || l === 'bad') {
        return { ok: false, error: 'Enter a room size in metres, up to 500.' };
      }
      if ((w === null) !== (l === null)) {
        return { ok: false, error: 'Enter both the width and the length, or leave both blank.' };
      }

      const cap = (key: string): number | null | 'bad' => {
        const raw = formData.get(key);
        if (typeof raw !== 'string' || !raw.trim()) return null;
        const n = Number(raw.trim());
        if (!Number.isInteger(n) || n <= 0 || n > 100_000) return 'bad';
        return n;
      };
      const cmin = cap('capacity_min');
      const cmax = cap('capacity_max');
      if (cmin === 'bad' || cmax === 'bad') {
        return { ok: false, error: 'Enter a guest count as a whole number.' };
      }
      if (cmin !== null && cmax !== null && cmin > cmax) {
        return { ok: false, error: 'The smallest party cannot be larger than the largest.' };
      }

      patch = {
        venue_width_m: w,
        venue_length_m: l,
        capacity_min: cmin,
        capacity_max: cmax,
      };
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
      // SEC-1: same pinning as the full-profile save. Same fail-closed reasoning —
      // `vendor_profile_id` is the PK of this user's own row, and the patch below
      // is an UPDATE keyed on `user_id`, so a missing id writes nothing at all.
      const refs = parsePortfolioRefs(
        formData.getAll('portfolio_r2_keys'),
        portfolioMax,
        tr?.vendor_profile_id ?? '',
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
  // ⛔ 'business_slug' lived here until 2026-08-10. The shop address is chosen
  //    once at /open-shop and is PERMANENT on every tier (owner, twice).
  //    🔑 IT IS REFUSED HERE, AT THE ALLOWLIST — NOT AT THE TIER GATE BELOW.
  //    Removing it from PRO_WEBSITE_FIELDS alone would have handed the rename
  //    to Free, Verified and Solo instead of taking it away: this Set decides
  //    what may be edited at all, that one only decides who pays. The real
  //    boundary is the database trigger vendor_profiles_business_slug_immutable
  //    (20271124956492) — RLS lets a vendor PATCH this column directly.
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

/** PRO-gated website fields — the premium PAGE controls. Until 2026-08-10 the
 *  custom slug was gated here too; the address is now permanent on every tier,
 *  so this cap no longer has anything to do with the website's NAME. */
const PRO_WEBSITE_FIELDS = new Set([
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
  const { data: row, error: rowError } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_slug, services, portfolio_r2_keys, tier_state')
    .eq('user_id', user.id)
    .maybeSingle();
  // ⚠ CHECK THIS ERROR — it now decides the self-exclusion below. Supabase
  // resolves `{ error }` rather than throwing, so an unchecked failure leaves
  // `vendor_profile_id` null and the availability probe then sees the vendor's
  // OWN row as somebody else's: a Pro vendor re-saving the address they already
  // hold is told it belongs to another business.
  if (rowError) {
    return { ok: false, error: 'We couldn’t load your shop just now. Please try again.' };
  }
  const rowTyped = row as
    | {
        vendor_profile_id?: string | null;
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
    // ⛔ case 'business_slug' was removed 2026-08-10 — the address is chosen
    //    once and is permanent. Its careful four-namespace conflict check did
    //    not go to waste: the same `findSlugConflict` now runs on the
    //    /open-shop path, which is the only place an address is ever set.
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
    return { ok: false, error: error.message };
  }

  revalidatePath('/vendor-dashboard/shop');
  // One public path now, not two: the address cannot move, so there is no old
  // one to also revalidate.
  if (currentSlug) {
    revalidatePath(`/v/${currentSlug}`);
    revalidatePath(`/${currentSlug}`);
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
