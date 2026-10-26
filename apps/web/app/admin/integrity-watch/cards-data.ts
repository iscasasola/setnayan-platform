/**
 * Integrity watch › Cards — the reads (service card checks, owner 2026-10-26; approved prototype frames 2–4 + 7).
 *
 * Server-only and admin-only: the page calls this after `requireAdmin()`. Everything it returns is a plain,
 * already-resolved prop for `_cards/cards-tab.tsx`, so `/dev/card-checks-lab` can draw the same components from
 * fixtures without a database.
 *
 * ⚠ READS ARE HONEST: the list read failing is returned as `{ ok: false }` and the page says so — it never renders an
 * empty "No cards waiting" over a read it could not make.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { VENDOR_SERVICE_FULL_SELECT, fetchDiscountsByService, fetchInclusionsByService, type VendorServiceRow } from '@/lib/vendor-services';
import { toServiceCard } from '@/lib/service-card-view-model';
import { displayServiceLabel } from '@/lib/vendors';
import { VERIFICATION_STATE_LABEL, parseVerificationState } from '@/lib/vendor-verification';
import { COUPLE_SIDE_BOOKED_STATUSES } from '@/lib/admin/suppliers-to-review';
import { regionBySlug } from '@/lib/region-source';
import { reasonsFromDetail } from '@/lib/service-card-check-copy';
import type { CardReason } from '@/lib/service-card-checks';
import type { CardOpenView, CardQueueRow, CardStatusFilter, CardReasonFilter, ClaimWordRow, PhotoPair } from './_cards/cards-types';

const SLA_HOURS = 72; // the queue's existing slaHours (QUEUE_DEFS['integrity-watch'])

const STATUS_IN: Record<CardStatusFilter, string[] | null> = {
  open: ['open', 'asked_to_fix'],
  approved: ['approved'],
  asked_to_fix: ['asked_to_fix'],
  rejected: ['rejected'],
  all: null,
};

const BASIS_WORD: Record<string, string> = { per_pax: 'per guest', per_hour: 'per hour', fixed: 'flat' };

function photoCount(svc: { primary_photo_r2_key?: string | null; showcase_photo_r2_keys?: string[] | null }): number {
  return (svc.primary_photo_r2_key ? 1 : 0) + (svc.showcase_photo_r2_keys ?? []).filter(Boolean).length;
}

export async function loadCardsQueue(args: {
  status: CardStatusFilter;
  reason: CardReasonFilter;
  now: Date;
}): Promise<{ ok: true; rows: CardQueueRow[]; openCount: number } | { ok: false }> {
  const admin = createAdminClient();
  let q = admin
    .from('integrity_flags')
    .select('id, public_id, subject_vendor_id, subject_service_id, score, status, detail, created_at')
    .eq('kind', 'service_card')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200);
  const inList = STATUS_IN[args.status];
  if (inList) q = q.in('status', inList);
  const [{ data, error }, openRes] = await Promise.all([
    q,
    admin.from('integrity_flags').select('id', { count: 'exact', head: true }).eq('kind', 'service_card').in('status', ['open', 'asked_to_fix']),
  ]);
  if (error || !data) return { ok: false };
  const flags = data as {
    id: number;
    public_id: string;
    subject_vendor_id: string;
    subject_service_id: string;
    score: number;
    status: CardQueueRow['status'];
    detail: Record<string, unknown> | null;
    created_at: string;
  }[];

  const serviceIds = [...new Set(flags.map((f) => f.subject_service_id))];
  const vendorIds = [...new Set(flags.map((f) => f.subject_vendor_id))];
  const [svcRes, shopRes, cardsRes] = await Promise.all([
    serviceIds.length
      ? admin.from('vendor_services').select('vendor_service_id, title, category, starting_price_php, pricing_basis, primary_photo_r2_key, showcase_photo_r2_keys').in('vendor_service_id', serviceIds)
      : Promise.resolve({ data: [], error: null }),
    vendorIds.length
      ? admin.from('vendor_profiles').select('vendor_profile_id, business_name, verification_state').in('vendor_profile_id', vendorIds)
      : Promise.resolve({ data: [], error: null }),
    vendorIds.length
      ? admin.from('vendor_services').select('vendor_profile_id').in('vendor_profile_id', vendorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (svcRes.error || shopRes.error || cardsRes.error) return { ok: false };
  const svcById = new Map(
    ((svcRes.data ?? []) as {
      vendor_service_id: string;
      title: string | null;
      category: string;
      starting_price_php: number | null;
      pricing_basis: string | null;
      primary_photo_r2_key: string | null;
      showcase_photo_r2_keys: string[] | null;
    }[]).map((s) => [s.vendor_service_id, s]),
  );
  const shopById = new Map(
    ((shopRes.data ?? []) as { vendor_profile_id: string; business_name: string | null; verification_state: string | null }[]).map((v) => [v.vendor_profile_id, v]),
  );
  const cardCount = new Map<string, number>();
  for (const c of (cardsRes.data ?? []) as { vendor_profile_id: string }[]) cardCount.set(c.vendor_profile_id, (cardCount.get(c.vendor_profile_id) ?? 0) + 1);

  const rows: CardQueueRow[] = [];
  for (const f of flags) {
    const svc = svcById.get(f.subject_service_id);
    if (!svc) continue;
    const reasons = reasonsFromDetail(f.detail);
    if (args.reason !== 'any' && !reasons.some((r) => r.code === args.reason)) continue;
    const shop = shopById.get(f.subject_vendor_id);
    const state = parseVerificationState(shop?.verification_state);
    const service = reasons.find((r): r is Extract<CardReason, { code: 'service' }> => r.code === 'service');
    const ageH = (args.now.getTime() - new Date(f.created_at).getTime()) / 3_600_000;
    rows.push({
      flagId: f.id,
      publicId: f.public_id,
      status: f.status,
      title: svc.title?.trim() || displayServiceLabel(svc.category),
      priceLine: [
        svc.starting_price_php ? `from ₱${svc.starting_price_php.toLocaleString('en-PH')}` : 'no price',
        BASIS_WORD[svc.pricing_basis ?? 'fixed'] ?? 'flat',
        `${photoCount(svc)} photo${photoCount(svc) === 1 ? '' : 's'}`,
      ].join(' · '),
      coverUrl: await displayUrlForStoredAsset(svc.primary_photo_r2_key).catch(() => null),
      shopName: shop?.business_name?.trim() || 'Unnamed supplier',
      shopLine: `${VERIFICATION_STATE_LABEL[state]} · ${cardCount.get(f.subject_vendor_id) ?? 1} card${(cardCount.get(f.subject_vendor_id) ?? 1) === 1 ? '' : 's'}`,
      shopVerified: state === 'verified',
      filedLabel: displayServiceLabel(svc.category),
      readsLike: service ? service.matchedLabel : null,
      reasons,
      afterReject: f.detail?.previous === 'rejected',
      age: f.created_at,
      overSla: (f.status === 'open' || f.status === 'asked_to_fix') && ageH > SLA_HOURS,
    });
  }
  // A card nobody can see yet (unverified shop) is not urgent: verified rows first, then the score order.
  rows.sort((a, b) => Number(b.shopVerified) - Number(a.shopVerified));
  return { ok: true, rows, openCount: openRes.count ?? 0 };
}

export async function loadCardOpen(publicId: string, now: Date): Promise<CardOpenView | null | 'failed'> {
  const admin = createAdminClient();
  const { data: f, error } = await admin
    .from('integrity_flags')
    .select('id, public_id, subject_vendor_id, subject_service_id, status, detail, resolution_notes, created_at')
    .eq('kind', 'service_card')
    .eq('public_id', publicId)
    .maybeSingle();
  if (error) return 'failed';
  if (!f) return null;
  const flag = f as {
    id: number;
    public_id: string;
    subject_vendor_id: string;
    subject_service_id: string;
    status: CardOpenView['status'];
    detail: Record<string, unknown> | null;
    resolution_notes: string | null;
    created_at: string;
  };
  const [svcRes, shopRes, cardsRes, bookedRes] = await Promise.all([
    admin.from('vendor_services').select(VENDOR_SERVICE_FULL_SELECT).eq('vendor_service_id', flag.subject_service_id).maybeSingle(),
    admin.from('vendor_profiles').select('business_name, verification_state, created_at, services').eq('vendor_profile_id', flag.subject_vendor_id).maybeSingle(),
    admin.from('vendor_services').select('is_active').eq('vendor_profile_id', flag.subject_vendor_id),
    admin.from('event_vendors').select('status').eq('marketplace_vendor_id', flag.subject_vendor_id),
  ]);
  if (svcRes.error || !svcRes.data || shopRes.error) return 'failed';
  const svc = svcRes.data as unknown as VendorServiceRow & { primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] | null };
  const shop = (shopRes.data ?? null) as { business_name: string | null; verification_state: string | null; created_at: string; services: string[] | null } | null;
  const [incs, discs] = await Promise.all([
    fetchInclusionsByService(admin, [svc.vendor_service_id]),
    fetchDiscountsByService(admin, [svc.vendor_service_id]),
  ]);
  const showcaseUrls = (
    await Promise.all((svc.showcase_photo_r2_keys ?? []).map((k) => displayUrlForStoredAsset(k).catch(() => null)))
  ).filter((u): u is string => !!u);
  const coverUrl = await displayUrlForStoredAsset(svc.primary_photo_r2_key).catch(() => null);
  const card = toServiceCard(svc, incs.get(svc.vendor_service_id), discs.get(svc.vendor_service_id), undefined, { photos: showcaseUrls, videoUrl: null }, false, null, now, null, null, false, coverUrl);

  const reasons = reasonsFromDetail(flag.detail);
  const photo = reasons.find((r): r is Extract<CardReason, { code: 'photo' }> => r.code === 'photo');
  const pairs: PhotoPair[] = [];
  if (photo && photo.matches.length > 0) {
    const { data: imgs } = await admin
      .from('vendor_image_flags')
      .select('public_id, flagged_r2_ref, source_r2_ref, source_surface, source_vendor_id, hamming_distance, status, created_at')
      .in('public_id', photo.matches.map((m) => m.imageFlagPublicId));
    const rows = (imgs ?? []) as {
      public_id: string;
      flagged_r2_ref: string;
      source_r2_ref: string;
      source_surface: string;
      source_vendor_id: string;
      hamming_distance: number;
      status: string;
      created_at: string;
    }[];
    const srcIds = [...new Set(rows.map((r) => r.source_vendor_id))];
    const { data: srcShops } = srcIds.length
      ? await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', srcIds)
      : { data: [] };
    const srcName = new Map(((srcShops ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => [s.vendor_profile_id, s.business_name?.trim() || 'Unnamed supplier']));
    const SURF: Record<string, string> = { service_primary: 'Service cover', service_showcase: 'Service showcase', portfolio: 'Portfolio', moodboard_library: 'Inspiration' };
    for (const r of rows) {
      pairs.push({
        imageFlagPublicId: r.public_id,
        hamming: Number(r.hamming_distance),
        stillOpen: r.status === 'open',
        thisUrl: await displayUrlForStoredAsset(r.flagged_r2_ref).catch(() => null),
        thisCaption: `${shop?.business_name?.trim() || 'This shop'} · ${r.flagged_r2_ref === svc.primary_photo_r2_key ? 'Service cover' : 'Service showcase'}`,
        sourceUrl: await displayUrlForStoredAsset(r.source_r2_ref).catch(() => null),
        sourceCaption: `${srcName.get(r.source_vendor_id) ?? 'Another shop'} · ${SURF[r.source_surface] ?? r.source_surface}`,
      });
    }
  }

  const state = parseVerificationState(shop?.verification_state);
  const cards = (cardsRes.data ?? []) as { is_active: boolean }[];
  const booked = ((bookedRes.data ?? []) as { status: string }[]).filter((b) => COUPLE_SIDE_BOOKED_STATUSES.has(b.status)).length;
  const price = reasons.find((r): r is Extract<CardReason, { code: 'price' }> => r.code === 'price');
  return {
    flagId: flag.id,
    publicId: flag.public_id,
    serviceId: svc.vendor_service_id,
    vendorProfileId: flag.subject_vendor_id,
    status: flag.status,
    flaggedAt: flag.created_at,
    afterReject: flag.detail?.previous === 'rejected',
    resolutionNotes: flag.resolution_notes,
    card,
    title: svc.title?.trim() || displayServiceLabel(svc.category),
    shopName: shop?.business_name?.trim() || 'Unnamed supplier',
    shopState: VERIFICATION_STATE_LABEL[state],
    shopVerified: state === 'verified',
    shopLine: `${cards.length} card${cards.length === 1 ? '' : 's'}, ${cards.filter((c) => c.is_active).length} live · joined ${new Date(shop?.created_at ?? flag.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} · ${booked} booking${booked === 1 ? '' : 's'}`,
    filedLabel: displayServiceLabel(svc.category),
    shopCovers: (shop?.services ?? []).map((s) => displayServiceLabel(s)).join(', '),
    reasons,
    pairs,
    bandRegionLabel: price ? regionBySlug(price.region)?.display_label ?? price.region : null,
  };
}

export async function loadClaimWords(): Promise<ClaimWordRow[] | null> {
  const { data, error } = await createAdminClient().from('card_claim_words').select('phrase, note').order('created_at', { ascending: true });
  if (error || !data) return null;
  return data as ClaimWordRow[];
}
