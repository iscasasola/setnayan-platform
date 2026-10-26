/**
 * service-card-checks.server.ts — the reads behind the automatic card check, and the flag it writes.
 *
 * Split from the pure `service-card-checks.ts` so the checks are unit-testable without a database (same shape as
 * `service-trade-aliases-db.ts` beside `service-trade-aliases.ts`).
 *
 * 🔒 EVERY READ HERE FAILS CLOSED. Each part of the context is its data or `null`; `null` makes the pure check add
 * `check_unavailable` and the card waits for a person. Contrast `getReviewedTradeAliasRows`, which fails SILENT on
 * purpose (a maker must never break over a synonym table) — a silent empty list HERE would be a silent pass.
 *
 * 🔒 SERVICE ROLE, DELIBERATELY. `card_claim_words`, `card_claim_word_allowances`, `integrity_flags` and
 * `vendor_image_flags` are admin-only under RLS; the supplier's session would read NO rows and every card would
 * pass. The caller (`commitVendorService`) has already proven the shop from the session (`ensureProfile`).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { readCardPriceBandTolerance } from '@/lib/card-price-band-tolerance';
import { resolveRegion } from '@/lib/region-source';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import { VENDOR_CATEGORIES, displayServiceLabel } from '@/lib/vendors';
import { emitNotification } from '@/lib/notification-emit';
import {
  primaryReason,
  runCardChecks,
  scoreFor,
  type CardCheckContext,
  type CardCheckInput,
  type CardCheckResult,
  type CardReason,
  type PhotoMatch,
} from '@/lib/service-card-checks';

type Admin = ReturnType<typeof createAdminClient>;

/** The supplier's sentence when a held card is switched on — the same words the database trigger raises. */
export const SERVICE_CARD_HELD_SENTENCE = "This card is waiting for a quick check, so it can't be switched on yet.";

const LEGACY = new Set<string>(VENDOR_CATEGORIES);
const PAX_ALL = '__all__';

/** The card's family of service keys — its own, the legacy key it belongs to, and every canonical leaf under that. */
export function ownServiceFamily(category: string, mergedInto: ReadonlyMap<string, string>): Set<string> {
  const own = new Set<string>([category]);
  const merged = mergedInto.get(category);
  if (merged) own.add(merged);
  const legacy = LEGACY.has(category)
    ? category
    : (PACKAGE_CANONICAL_TO_VENDOR_CATEGORY[category] as string | undefined) ?? null;
  if (legacy) {
    own.add(legacy);
    for (const [canonical, cat] of Object.entries(PACKAGE_CANONICAL_TO_VENDOR_CATEGORY)) {
      if (cat === legacy) own.add(canonical);
    }
  }
  return own;
}

async function readPhotoMatches(
  admin: Admin,
  vendorProfileId: string,
  cover: string | null,
  showcase: readonly string[],
): Promise<PhotoMatch[] | null> {
  const refs = [cover, ...showcase].filter((r): r is string => typeof r === 'string' && r.length > 0);
  if (refs.length === 0) return [];
  const { data, error } = await admin
    .from('vendor_image_flags')
    .select('public_id, flagged_r2_ref, hamming_distance')
    .eq('flagged_vendor_id', vendorProfileId)
    .eq('status', 'open')
    .in('flagged_r2_ref', refs);
  if (error || !data) {
    console.error('[supabase-error] lib/service-card-checks.server.ts · from:vendor_image_flags.select', error);
    return null;
  }
  return (data as { public_id: string; flagged_r2_ref: string; hamming_distance: number }[]).map((r) => ({
    imageFlagPublicId: r.public_id,
    hamming: Number(r.hamming_distance),
    which: r.flagged_r2_ref === cover ? 'cover' : 'showcase',
  }));
}

async function readBand(admin: Admin, vendorProfileId: string, category: string): Promise<CardCheckContext['band']> {
  const { data: vp, error: vpErr } = await admin
    .from('vendor_profiles')
    .select('hq_region')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (vpErr) {
    console.error('[supabase-error] lib/service-card-checks.server.ts · from:vendor_profiles.select', vpErr);
    return null;
  }
  const hq = ((vp as { hq_region?: string | null } | null)?.hq_region ?? '').trim();
  // The same region key `recompute_market_price_bands()` writes: the canonical slug, else the stored spelling.
  const region = resolveRegion(hq)?.slug ?? (hq || null);
  if (!region) return 'none';
  const { data, error } = await admin
    .from('market_price_bands')
    .select('low_php, median_php, high_php, sample_n')
    .eq('category', category)
    .eq('region_slug', region)
    .eq('pax_bucket', PAX_ALL)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/service-card-checks.server.ts · from:market_price_bands.select', error);
    return null;
  }
  if (!data) return 'none';
  const b = data as { low_php: number | string; median_php: number | string; high_php: number | string; sample_n: number };
  return {
    lowPhp: Number(b.low_php),
    medianPhp: Number(b.median_php),
    highPhp: Number(b.high_php),
    sampleN: Number(b.sample_n),
    region,
    bucket: PAX_ALL,
  };
}

async function readServiceWords(admin: Admin, category: string): Promise<CardCheckContext['serviceWords']> {
  const [schemas, aliases, merges] = await Promise.all([
    admin.from('canonical_service_schemas').select('canonical_service, display_name_en, display_name_tl, display_name_ceb'),
    admin.from('canonical_service_aliases').select('phrase, canonical_service').not('reviewed_at', 'is', null),
    admin.from('canonical_service_taxonomy').select('canonical_service, merged_into').not('merged_into', 'is', null),
  ]);
  if (schemas.error || aliases.error || merges.error || !schemas.data || !aliases.data || !merges.data) {
    console.error(
      '[supabase-error] lib/service-card-checks.server.ts · from:canonical_service_schemas/aliases/taxonomy.select',
      schemas.error ?? aliases.error ?? merges.error,
    );
    return null;
  }

  const mergedInto = new Map<string, string>();
  for (const m of merges.data as { canonical_service: string; merged_into: string | null }[]) {
    if (m.merged_into) mergedInto.set(m.canonical_service, m.merged_into);
  }
  const forward = (k: string) => mergedInto.get(k) ?? k;

  const byService = new Map<string, string[]>();
  const labelOf = new Map<string, string>();
  const add = (k: string, w: string | null | undefined) => {
    const t = (w ?? '').trim();
    if (!t) return;
    const key = forward(k);
    const list = byService.get(key) ?? [];
    if (!list.includes(t.toLowerCase())) list.push(t.toLowerCase());
    byService.set(key, list);
  };
  for (const s of schemas.data as {
    canonical_service: string;
    display_name_en: string | null;
    display_name_tl: string | null;
    display_name_ceb: string | null;
  }[]) {
    add(s.canonical_service, s.display_name_en);
    add(s.canonical_service, s.display_name_tl);
    add(s.canonical_service, s.display_name_ceb);
    if (s.display_name_en?.trim()) labelOf.set(forward(s.canonical_service), s.display_name_en.trim());
  }
  for (const a of aliases.data as { phrase: string; canonical_service: string }[]) add(a.canonical_service, a.phrase);
  for (const k of byService.keys()) if (!labelOf.has(k)) labelOf.set(k, displayServiceLabel(k));

  return { byService, labelOf, ownKeys: ownServiceFamily(category, mergedInto) };
}

async function readClaimWords(admin: Admin, vendorProfileId: string): Promise<CardCheckContext['claimWords']> {
  const [words, allowances] = await Promise.all([
    admin.from('card_claim_words').select('phrase'),
    admin.from('card_claim_word_allowances').select('phrase').eq('vendor_profile_id', vendorProfileId),
  ]);
  if (words.error || allowances.error || !words.data || !allowances.data) {
    console.error(
      '[supabase-error] lib/service-card-checks.server.ts · from:card_claim_words/card_claim_word_allowances.select',
      words.error ?? allowances.error,
    );
    return null;
  }
  return {
    words: (words.data as { phrase: string }[]).map((w) => w.phrase),
    allowed: new Set((allowances.data as { phrase: string }[]).map((a) => a.phrase)),
  };
}

/** Read everything the checks need. A part that throws is `null` like a part that errors. */
export async function loadCardCheckContext(args: {
  vendorProfileId: string;
  category: string;
  cover: string | null;
  showcase: readonly string[];
}): Promise<CardCheckContext> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { photoMatches: null, tolerance: null, band: null, serviceWords: null, claimWords: null };
  }
  const safe = async <T>(p: () => Promise<T>): Promise<T | null> => {
    try {
      return await p();
    } catch {
      return null;
    }
  };
  const [photoMatches, tol, band, serviceWords, claimWords] = await Promise.all([
    safe(() => readPhotoMatches(admin, args.vendorProfileId, args.cover, args.showcase)),
    safe(() => readCardPriceBandTolerance(admin)),
    safe(() => readBand(admin, args.vendorProfileId, args.category)),
    safe(() => readServiceWords(admin, args.category)),
    safe(() => readClaimWords(admin, args.vendorProfileId)),
  ]);
  const tolerance: CardCheckContext['tolerance'] =
    tol && tol.ok ? (tol.tolerance === null ? 'off' : tol.tolerance) : null;
  // The band is only needed (and only asked) when the price check is on.
  return {
    photoMatches,
    tolerance,
    band: tolerance === 'off' ? 'none' : band,
    serviceWords,
    claimWords,
  };
}

/**
 * The LATE half of the photo check. Repost-watch hashes a card's photos after the save (`after()`), so a match can
 * land seconds later. When this card's current photos now carry an open match, pull the card from Explore and hold
 * it — merging the photo reason into any hold it already has — and tell the supplier in the app. Best-effort, like
 * every `after()` task: a failure here leaves the card as the save left it, and the next save checks it again.
 */
export async function holdServiceCardForPhotoMatch(args: {
  serviceId: string;
  vendorProfileId: string;
  cover: string | null;
  showcase: readonly string[];
  title: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const matches = await readPhotoMatches(admin, args.vendorProfileId, args.cover, args.showcase);
    if (!matches || matches.length === 0) return;
    const existing = await readHoldingFlag(args.serviceId);
    if (existing === undefined) return;
    const prior = ((existing?.detail?.reasons ?? []) as CardReason[]).filter((r) => r && typeof r === 'object');
    const priorPhoto = prior.find((r) => r.code === 'photo');
    const known = new Set(priorPhoto && priorPhoto.code === 'photo' ? priorPhoto.matches.map((m) => m.imageFlagPublicId) : []);
    if (existing && matches.every((m) => known.has(m.imageFlagPublicId))) return; // already held for these
    const reasons: CardReason[] = [{ code: 'photo', matches }, ...prior.filter((r) => r.code !== 'photo')];
    const ok = await holdServiceCard({
      serviceId: args.serviceId,
      vendorProfileId: args.vendorProfileId,
      reasons,
      score: scoreFor(reasons),
      existing: existing ?? null,
    });
    if (!ok) return;
    await admin
      .from('vendor_services')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('vendor_service_id', args.serviceId)
      .eq('vendor_profile_id', args.vendorProfileId);
    await noticeCardHeld({ vendorProfileId: args.vendorProfileId, serviceId: args.serviceId, title: args.title });
  } catch (e) {
    console.error('[service-card-checks] late photo hold failed:', e);
  }
}

export async function checkServiceCard(
  input: CardCheckInput & { cover: string | null; showcase: readonly string[] },
): Promise<CardCheckResult> {
  const ctx = await loadCardCheckContext({
    vendorProfileId: input.vendorProfileId,
    category: input.category,
    cover: input.cover,
    showcase: input.showcase,
  });
  return runCardChecks(input, ctx);
}

// ── the flag ─────────────────────────────────────────────────────────────────

export type HoldingFlag = { id: number; status: 'open' | 'asked_to_fix' | 'rejected'; detail: Record<string, unknown> };

/**
 * The card's holding flag, or `null` when none. `undefined` = the read failed — the caller must treat the card as
 * possibly held (fail-closed: never publish over a hold we could not see).
 */
export async function readHoldingFlag(serviceId: string): Promise<HoldingFlag | null | undefined> {
  try {
    const { data, error } = await createAdminClient()
      .from('integrity_flags')
      .select('id, status, detail')
      .eq('kind', 'service_card')
      .eq('subject_service_id', serviceId)
      .in('status', ['open', 'asked_to_fix', 'rejected'])
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/service-card-checks.server.ts · from:integrity_flags.select', error);
      return undefined;
    }
    return (data as HoldingFlag | null) ?? null;
  } catch {
    return undefined;
  }
}

/**
 * Open (or refresh) the card's holding flag with these reasons. A rejected row is RE-OPENED as `open` with
 * `detail.previous = 'rejected'` (ruling: "after a Reject every save re-queues"). Returns false when the write failed.
 */
export async function holdServiceCard(args: {
  serviceId: string;
  vendorProfileId: string;
  reasons: CardReason[];
  score: number;
  existing: HoldingFlag | null;
}): Promise<boolean> {
  const admin = createAdminClient();
  const detail: Record<string, unknown> = {
    reasons: args.reasons,
    checked_at: new Date().toISOString(),
  };
  if (args.existing?.status === 'rejected' || args.existing?.detail?.previous === 'rejected') detail.previous = 'rejected';
  const row = {
    score: args.score,
    reason: primaryReason(args.reasons),
    detail,
    status: 'open',
    resolution_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  };
  if (args.existing) {
    const { error } = await admin.from('integrity_flags').update(row).eq('id', args.existing.id);
    if (error) console.error('[supabase-error] lib/service-card-checks.server.ts · from:integrity_flags.update', error);
    return !error;
  }
  const { error } = await admin.from('integrity_flags').insert({
    ...row,
    kind: 'service_card',
    subject_vendor_id: args.vendorProfileId,
    subject_service_id: args.serviceId,
  });
  if (error) console.error('[supabase-error] lib/service-card-checks.server.ts · from:integrity_flags.insert', error);
  return !error;
}

/** A resave that passes clears an open / asked-to-fix hold by itself (PLAN §5.4). Never a rejected one. */
export async function clearServiceCardHold(flag: HoldingFlag): Promise<boolean> {
  if (flag.status === 'rejected') return false;
  const { error } = await createAdminClient()
    .from('integrity_flags')
    .update({
      status: 'dismissed',
      detail: { ...flag.detail, auto: 'fixed on resave' },
      resolution_notes: 'Cleared by itself — the supplier saved a version that passed.',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', flag.id)
    .in('status', ['open', 'asked_to_fix']);
  if (error) console.error('[supabase-error] lib/service-card-checks.server.ts · from:integrity_flags.update (clear)', error);
  return !error;
}

/** Put a cleared flag back (the save that should have followed the clear failed). Best-effort. */
export async function restoreServiceCardHold(flag: HoldingFlag): Promise<void> {
  try {
    await createAdminClient()
      .from('integrity_flags')
      .update({ status: flag.status, detail: flag.detail, resolution_notes: null, reviewed_at: null })
      .eq('id', flag.id);
  } catch {
    // the card stays hidden either way; the next save re-checks it
  }
}

/** Tell the supplier, in the app only (owner 2026-10-26: no email). */
export async function noticeCardHeld(args: { vendorProfileId: string; serviceId: string; title: string }): Promise<void> {
  try {
    const { data } = await createAdminClient()
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    const userId = (data as { user_id?: string | null } | null)?.user_id;
    if (!userId) return;
    await emitNotification({
      userId,
      type: 'service_card_check',
      title: `Saved · waiting for a quick check`,
      body: `“${args.title}” is saved and kept out of Explore until a person at Setnayan has looked, or until you save a version that passes.`,
      relatedUrl: `/vendor-dashboard/services/${args.serviceId}`,
    });
  } catch (e) {
    console.error('[service-card-checks] notice failed:', e);
  }
}
