'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

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

// Iteration 0043 — wedding-type compatibility tags. Allowed values mirror
// the events.ceremony_type + events.venue_setting CHECK constraints from
// migration 20260521000000_iteration_0043_wedding_type_picker.sql.
const ALLOWED_CEREMONY_TYPES: ReadonlySet<string> = new Set([
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
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
function parsePortfolioRefs(raw: FormDataEntryValue[]): string[] {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (!trimmed.startsWith('r2://')) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= 10) break;
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

function parseServices(raw: FormDataEntryValue | null): string[] {
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
    // Canonical entries — keep the enum key verbatim.
    if (CANONICAL_SERVICE_SET.has(item)) {
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
      `/vendor-dashboard?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const payload = {
    business_name: nonBlank(formData.get('business_name'), 128),
    business_slug,
    tagline: nullIfBlank(formData.get('tagline')),
    logo_url: parseLogoValue(formData.get('logo_url')),
    services: parseServices(formData.get('services')),
    location_city: nullIfBlank(formData.get('location_city')),
    website: nullIfBlank(formData.get('website')),
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    is_published: formData.get('is_published') === 'on',
    portfolio_r2_keys: parsePortfolioRefs(formData.getAll('portfolio_r2_keys')),
    compatible_ceremony_types: parseCompatibilityArray(
      formData.getAll('compatible_ceremony_types'),
      ALLOWED_CEREMONY_TYPES,
    ),
    compatible_venue_settings: parseCompatibilityArray(
      formData.getAll('compatible_venue_settings'),
      ALLOWED_VENUE_SETTINGS,
    ),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('vendor_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (error) {
    return redirect(
      `/vendor-dashboard?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard');
  redirect('/vendor-dashboard?saved=1');
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
