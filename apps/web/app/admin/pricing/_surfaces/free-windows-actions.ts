'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { fetchV2CustomerCatalog, fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { tierRank } from '@/lib/vendor-tier-caps';
import {
  isVendorDealAudience,
  vendorTierOfSku,
  type PromotedVendorTier,
} from '@/lib/promo-free-windows';

/**
 * Server actions for the Catalog Studio "Free windows" tab
 * (/admin/pricing?tab=free-windows) AND the Deals section of /admin/gifts —
 * the second surface posts to these same actions with `return_to=/admin/gifts`
 * rather than forking a writer. CRUD over public.promo_free_windows —
 * admin-scheduled "these services are free this weekend" announcements, and
 * (2026-09-05) vendor COHORT deals: all verified vendors, or every vendor who
 * registers and gets verified inside the window.
 *
 * Every write requireAdminAction()-gates + writes an admin_audit_log row (same
 * {action,target_id,actor_user_id,metadata} shape as saveAllPricing). Redirects
 * back to the posting surface with a flash param it renders as a banner.
 *
 * G5 (2026-09-06): a couple window may also carry an event_date_from/to
 * range (both nullable, migration 20271208727445) — "for an event dated
 * on/in a range" (a), vs. the pre-existing unfiltered "for any event" (c)
 * when both stay null. Date-only, parsed WITHOUT the Manila-anchoring
 * parsePhLocal uses (it's compared against another date-only column,
 * events.event_date, never a wall-clock instant). The couple branch now also
 * requires `reason` (min 10 chars), matching the vendor branch's own bar —
 * giving a paid service away, cohort-wide or date-scoped, gets the same
 * on-the-record justification either way.
 */

const TAB = '/admin/pricing?tab=free-windows';

/**
 * Where a form came from. Only two surfaces post here; anything else lands on
 * the tab (an open redirect through a form field is not a feature).
 */
const RETURN_TARGETS: Record<string, string> = {
  '/admin/gifts': '/admin/gifts',
};

function returnBase(formData: FormData): string {
  const raw = String(formData.get('return_to') ?? '').trim();
  return RETURN_TARGETS[raw] ?? TAB;
}

/** Redirect back to the posting surface with a single flash param. Never returns (redirect throws). */
function backTo(base: string, key: string, value = '1'): never {
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}${new URLSearchParams({ [key]: value }).toString()}`);
}

function revalidateBoth(): void {
  revalidatePath('/admin/pricing');
  revalidatePath('/admin/gifts');
}

/**
 * Parse a <input type="datetime-local"> value as PHILIPPINE time. The input
 * carries NO timezone ("2026-07-25T18:00"); a bare new Date() would read it in
 * the server's zone (UTC on Vercel), silently shifting a 6pm promo to 2am. We
 * anchor it to +08:00 so "6pm" means 6pm in Manila regardless of runtime TZ.
 * Returns null for an empty / unparseable value.
 */
function parsePhLocal(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // Already zoned (Z or ±hh:mm) → trust it; otherwise anchor to Manila.
  const zoned = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}+08:00`;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The tiers a deal can PROMOTE to — the paid rungs only. Deliberately not
 * `VENDOR_TIERS` from vendor-tier-caps (that ladder also holds free, verified
 * and custom, none of which a promotion may name).
 */
const PROMOTABLE_VENDOR_TIERS = ['solo', 'pro', 'enterprise'];

/**
 * Parse a bare <input type="date"> value ('YYYY-MM-DD') as a plain date
 * string — NOT anchored to Manila time like parsePhLocal. This bound is
 * compared against another date-only column (events.event_date), never
 * against a wall-clock instant, so there is no timezone to anchor: "Dec 1"
 * means the calendar day, full stop. Returns null for empty/malformed input.
 */
function parsePlainDate(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function createFreeWindow(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();
  const base = returnBase(formData);
  // A function DECLARATION, not an arrow: TS only credits a `never` call as
  // terminating inside a declared function (an arrow here is TS2534).
  function backWith(key: string, value = '1'): never {
    backTo(base, key, value);
  }

  const rawAudience = String(formData.get('audience_type') ?? 'all_couples');
  if (rawAudience !== 'all_couples' && !isVendorDealAudience(rawAudience)) {
    // 'segment' (and anything typed into the field) is schema-forward, unbuilt.
    backWith('createError', 'audience');
  }
  const audienceType = rawAudience as 'all_couples' | 'all_vendors' | 'new_verified_vendors';
  const isVendor = isVendorDealAudience(audienceType);
  const title = String(formData.get('title') ?? '').trim();
  const blurb = String(formData.get('blurb') ?? '').trim();
  const startsAt = parsePhLocal(String(formData.get('starts_at') ?? ''));
  const endsAt = parsePhLocal(String(formData.get('ends_at') ?? ''));

  if (!title) backWith('createError', 'title');
  if (!startsAt) backWith('createError', 'starts');
  if (!endsAt) backWith('createError', 'ends');
  if (endsAt! <= startsAt!) backWith('createError', 'order');

  let covered: string[] = [];
  let promotedTier: string | null = null;
  let dealLengthDays: number | null = null;
  let reason: string | null = null;
  let eventDateFrom: string | null = null;
  let eventDateTo: string | null = null;

  if (isVendor) {
    // Vendor deal: a TIER promotion (a vendor SKU can never be ₱0 — DB CHECK
    // price_php > 0). Two ways to name the tier, both ending in the same column:
    //   · the gifts creator posts `service_keys` picked from the live
    //     vendor_billing_catalog — only TIER rows survive validation, because
    //     nothing today can make an add-on free (each has its own resolver);
    //     the highest tier among them wins, and the rows are kept in
    //     covered_service_keys so the deal records the price it waived;
    //   · the Catalog Studio tab posts `promoted_vendor_tier` directly.
    const pickedSkus = formData
      .getAll('service_keys')
      .map((v) => String(v))
      .filter(Boolean);
    if (pickedSkus.length > 0) {
      const catalog = await fetchV2VendorCatalog();
      const live = new Set(catalog.map((s) => s.sku_code));
      covered = pickedSkus.filter((code) => live.has(code) && vendorTierOfSku(code) !== null);
      let best: PromotedVendorTier | null = null;
      for (const code of covered) {
        const t = vendorTierOfSku(code);
        if (t && (best === null || tierRank(t) > tierRank(best))) best = t;
      }
      promotedTier = best;
    } else {
      const tier = String(formData.get('promoted_vendor_tier') ?? '');
      promotedTier = PROMOTABLE_VENDOR_TIERS.includes(tier) ? tier : null;
    }
    if (!promotedTier) backWith('createError', 'tier');

    // Deal length is a SEPARATE control from the window: the window says who
    // gets in, this says how long each qualifying vendor keeps it. Blank keeps
    // the old meaning — until the window ends.
    const rawLength = String(formData.get('deal_length_days') ?? '').trim();
    if (rawLength) {
      const n = Number(rawLength);
      if (!Number.isInteger(n) || n < 1 || n > 365) backWith('createError', 'length');
      dealLengthDays = n;
    }

    // A vendor deal gives paid features away to a cohort; say why, on the record.
    reason = String(formData.get('reason') ?? '').trim();
    if (reason.length < 10) backWith('createError', 'reason');
  } else {
    // Couple window: only real, live couple SKUs may be freed (defense-in-depth:
    // the form is POST-able with arbitrary service_keys). Silently drop anything
    // not in the live catalog; if nothing survives, that's a validation failure.
    const skus = formData
      .getAll('service_keys')
      .map((v) => String(v))
      .filter(Boolean);
    const catalog = await fetchV2CustomerCatalog();
    const valid = new Set(catalog.map((s) => s.service_code));
    covered = skus.filter((s) => valid.has(s));
    if (covered.length === 0) backWith('createError', 'skus');

    // Event-date-range filter (G5): optional, date-only, NOT PH-anchored —
    // compared against events.event_date, a bare 'YYYY-MM-DD' column, never
    // against a wall-clock instant. Blank → null → (c) "for any event",
    // unchanged. Both set → (a) "for an event dated on/in a range" (from ===
    // to is the single-specific-date case).
    eventDateFrom = parsePlainDate(String(formData.get('event_date_from') ?? ''));
    eventDateTo = parsePlainDate(String(formData.get('event_date_to') ?? ''));
    if (eventDateFrom && eventDateTo && eventDateTo < eventDateFrom) {
      backWith('createError', 'event_date_order');
    }

    // A couple window gives a paid service away to every qualifying couple;
    // say why, on the record — same bar as the vendor branch's own reason.
    reason = String(formData.get('reason') ?? '').trim();
    if (reason.length < 10) backWith('createError', 'reason');
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('promo_free_windows')
    .insert({
      title,
      blurb: blurb || null,
      covered_service_keys: covered,
      audience_type: audienceType,
      promoted_vendor_tier: promotedTier,
      deal_length_days: dealLengthDays,
      event_date_from: eventDateFrom,
      event_date_to: eventDateTo,
      starts_at: startsAt!.toISOString(),
      ends_at: endsAt!.toISOString(),
      is_active: true,
      show_banner: formData.get('show_banner') === 'on',
      created_by: userId,
    })
    .select('promo_window_id')
    .maybeSingle();

  if (error || !data) backWith('createError', 'db');

  await admin.from('admin_audit_log').insert({
    action: 'promo_free_window_create',
    target_id: data!.promo_window_id,
    actor_user_id: userId,
    metadata: {
      title,
      audience_type: audienceType,
      covered_service_keys: covered,
      promoted_vendor_tier: promotedTier,
      deal_length_days: dealLengthDays,
      event_date_from: eventDateFrom,
      event_date_to: eventDateTo,
      reason,
      starts_at: startsAt!.toISOString(),
      ends_at: endsAt!.toISOString(),
    },
  });

  revalidateBoth();
  backWith('created');
}

export async function setFreeWindowActive(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();
  const base = returnBase(formData);
  // A function DECLARATION, not an arrow: TS only credits a `never` call as
  // terminating inside a declared function (an arrow here is TS2534).
  function backWith(key: string, value = '1'): never {
    backTo(base, key, value);
  }
  const id = String(formData.get('promo_window_id') ?? '').trim();
  const active = formData.get('is_active') === 'true';
  if (!id) backWith('error');

  const admin = createAdminClient();
  const { error } = await admin
    .from('promo_free_windows')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('promo_window_id', id);
  if (error) backWith('error');

  await admin.from('admin_audit_log').insert({
    action: active ? 'promo_free_window_activate' : 'promo_free_window_deactivate',
    target_id: id,
    actor_user_id: userId,
    metadata: { is_active: active },
  });

  revalidateBoth();
  backWith('saved');
}

export async function deleteFreeWindow(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();
  const base = returnBase(formData);
  // A function DECLARATION, not an arrow: TS only credits a `never` call as
  // terminating inside a declared function (an arrow here is TS2534).
  function backWith(key: string, value = '1'): never {
    backTo(base, key, value);
  }
  const id = String(formData.get('promo_window_id') ?? '').trim();
  if (!id) backWith('error');

  const admin = createAdminClient();
  const { error } = await admin
    .from('promo_free_windows')
    .delete()
    .eq('promo_window_id', id);
  if (error) backWith('error');

  await admin.from('admin_audit_log').insert({
    action: 'promo_free_window_delete',
    target_id: id,
    actor_user_id: userId,
    metadata: {},
  });

  revalidateBoth();
  backWith('deleted');
}
