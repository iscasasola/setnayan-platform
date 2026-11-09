import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset } from '@/lib/uploads';
import { computePHash, hammingDistance, phashFromDb } from '@/lib/perceptual-hash';
import { fetchAssetBytes, resolveThreshold, type RepostSurface } from '@/lib/vendor-image-repost-watch';
import { decidePhotoVerdict, type CardPhotoVerdict, type CardPhotoWhere, type NamedPhotoHash } from '@/lib/service-card-checks';

/**
 * card-photo-check.server.ts — ONE PHOTO = ONE SERVICE CARD (owner 2026-10-26: *"once a photo is used. it technically
 * cannot be used on another service card."*).
 *
 * Asked by the maker when the card's set of photos changes (`checkCardPhotosAction`) and again by the save, which
 * refuses. A photo is "used" when a hash of it NAMES a card (`vendor_image_hashes.vendor_service_id`, written by the
 * save, cleared when the card drops the photo or is deleted):
 *
 *   · ANOTHER SHOP's card, within the admin-set Hamming threshold (the shipped repost-watch sensitivity, one number
 *     for both) → `another_shop`. Which shop is NEVER returned — the verdict carries no id, ref or name.
 *   · ANOTHER of this shop's cards — the same stored ref (a copied card keeps its cover) or a matching hash →
 *     `this_shop`, naming that card (it is theirs).
 *   · the photo could not be read just now → `unchecked`: it does not stop the card, and the row says so.
 *
 * The pHash is the SHIPPED one (`lib/perceptual-hash.ts`), computed from the authoritative R2 bytes server-side —
 * never a hash the browser sends (a reposter controls the browser).
 *
 * REQUESTS per ask: 3 reads in parallel (this shop's cards · this shop's existing hashes for these refs · every hash
 * that names a card) + the threshold setting + one R2 GET per photo NOT hashed yet (a saved card's photos are hashed,
 * so re-asking an unchanged card costs no R2 GET).
 */

const MAX_PHOTOS = 1 + 24;

type Item = { ref: string; where: CardPhotoWhere };

/** The other shop's photo a verdict matched — server-only; used by "It's mine — report it", never returned. */
export type PhotoSource = { vendorProfileId: string; ref: string; surface: RepostSurface; distance: number };

type Matched = { verdict: CardPhotoVerdict; source: PhotoSource | null };

function itemsOf(cover: string | null, showcase: ReadonlyArray<string>): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const [ref, where] of [[cover, 'cover'], ...showcase.map((r) => [r, 'showcase'] as const)] as const) {
    if (typeof ref !== 'string') continue;
    const r = ref.trim();
    if (!r || seen.has(r) || !parseStoredAsset(r)) continue;
    seen.add(r);
    out.push({ ref: r, where });
  }
  return out.slice(0, MAX_PHOTOS);
}

export async function matchCardPhotos(args: {
  vendorProfileId: string;
  /** The card being edited — its own photos never count against it. `null` on a new card. */
  serviceId: string | null;
  cover: string | null;
  showcase: ReadonlyArray<string>;
}): Promise<Matched[]> {
  const items = itemsOf(args.cover, args.showcase);
  if (items.length === 0) return [];
  const unchecked = (i: Item): Matched => ({ verdict: { ref: i.ref, where: i.where, verdict: 'unchecked' }, source: null });

  try {
    const admin = createAdminClient();
    const [cardsRes, ownHashRes, namedRes, threshold] = await Promise.all([
      admin
        .from('vendor_services')
        .select('vendor_service_id, title, category, primary_photo_r2_key, showcase_photo_r2_keys')
        .eq('vendor_profile_id', args.vendorProfileId),
      admin
        .from('vendor_image_hashes')
        .select('r2_ref, phash')
        .eq('vendor_profile_id', args.vendorProfileId)
        .in('r2_ref', items.map((i) => i.ref)),
      admin
        .from('vendor_image_hashes')
        .select('vendor_profile_id, r2_ref, surface, phash, is_demo, vendor_service_id')
        .not('vendor_service_id', 'is', null)
        .in('surface', ['service_primary', 'service_showcase']),
      resolveThreshold(admin),
    ]);
    if (cardsRes.error || ownHashRes.error || namedRes.error) {
      console.error('[supabase-error] lib/card-photo-check.server.ts', cardsRes.error ?? ownHashRes.error ?? namedRes.error);
      return items.map(unchecked);
    }

    const cards = (cardsRes.data ?? []) as {
      vendor_service_id: string;
      title: string | null;
      category: string;
      primary_photo_r2_key: string | null;
      showcase_photo_r2_keys: string[] | null;
    }[];
    const cardTitle: Map<string, string> = new Map(cards.map((c) => [c.vendor_service_id, (c.title ?? '').trim() || 'another card']));
    const ownHash = new Map(((ownHashRes.data ?? []) as { r2_ref: string; phash: string | number }[]).map((h) => [h.r2_ref, h.phash]));
    const named: NamedPhotoHash<RepostSurface>[] = (
      (namedRes.data ?? []) as {
        vendor_profile_id: string;
        r2_ref: string;
        surface: RepostSurface;
        phash: string | number;
        is_demo: boolean;
        vendor_service_id: string;
      }[]
    ).map((h) => ({
      vendorProfileId: h.vendor_profile_id,
      ref: h.r2_ref,
      surface: h.surface,
      phash: phashFromDb(h.phash),
      isDemo: h.is_demo,
      vendorServiceId: h.vendor_service_id,
    }));

    const out: Matched[] = [];
    for (const item of items) {
      // The same stored photo on another of this shop's cards (a copied card keeps its cover) — no hash needed.
      const sameRef = cards.find(
        (c) =>
          c.vendor_service_id !== args.serviceId &&
          (c.primary_photo_r2_key === item.ref || (c.showcase_photo_r2_keys ?? []).includes(item.ref)),
      );

      let phash: bigint | null = null;
      const stored = ownHash.get(item.ref);
      if (stored !== undefined && stored !== null) {
        phash = phashFromDb(stored);
      } else {
        const bytes = await fetchAssetBytes(item.ref);
        phash = bytes ? await computePHash(bytes) : null;
      }

      const decided = decidePhotoVerdict({
        ref: item.ref,
        where: item.where,
        phash,
        vendorProfileId: args.vendorProfileId,
        serviceId: args.serviceId,
        threshold,
        named,
        ownCards: cardTitle,
        sameRefCardId: sameRef?.vendor_service_id ?? null,
        distance: hammingDistance,
      });
      out.push({
        verdict: decided.verdict,
        source: decided.source
          ? { vendorProfileId: decided.source.vendorProfileId, ref: decided.source.ref, surface: decided.source.surface, distance: decided.source.distance }
          : null,
      });
    }
    return out;
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'card-photo-check' } });
    return items.map(unchecked);
  }
}

/** The verdicts alone — what the maker and the save read. Never carries the other shop. */
export async function checkCardPhotos(args: Parameters<typeof matchCardPhotos>[0]): Promise<CardPhotoVerdict[]> {
  return (await matchCardPhotos(args)).map((m) => m.verdict);
}
