import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayLogoUrl } from '@/lib/uploads';
import { readRewardNames } from '@/lib/badge-rewards.server';
import {
  badgeRewardMomentView,
  shopGiftMomentView,
  type GiftMomentSource,
  type GiftMomentView,
  type ShopGiftLine,
} from '@/lib/gift-moment';

/**
 * 🎁 THE GIFT MOMENT — the reads and the claim (the words are `lib/gift-moment.ts`, the rows migration
 * `gift_moment_claims`). Every call runs AS THE SIGNED-IN PERSON (`supabase` is their own client): the database
 * functions answer only a host of the event or a manager of the shop, so this file never decides who may see a gift.
 *
 * 🔑 A FAILED READ IS NOT "NO GIFTS" — it returns null, and the caller draws nothing (no moment, no waiting line);
 * the next visit reads again. It never draws an empty state that could be mistaken for "nothing came".
 */

type EventRow = {
  ref_id: string;
  giver_name: string | null;
  giver_logo: string | null;
  lines: unknown;
  landed_at: string;
  claimed_at: string | null;
};

type ShopRow = {
  ref_id: string;
  reward_key: string;
  badge: string;
  reward_kind: string;
  units: number;
  landed_at: string;
  claimed_at: string | null;
};

function linesOf(v: unknown): ShopGiftLine[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((l) => l as { title?: unknown; kind?: unknown; credits?: unknown })
    .filter((l) => typeof l.title === 'string' && typeof l.kind === 'string')
    .map((l) => ({ title: l.title as string, kind: l.kind as string, credits: Number(l.credits) || 0 }));
}

/** A supplier's gifts on one event, for its host. null = the read failed. */
export async function readEventGiftMoments(supabase: SupabaseClient, eventId: string): Promise<GiftMomentView[] | null> {
  const { data, error } = await supabase.rpc('gift_moments_for_event', { p_event_id: eventId });
  if (error) {
    console.error('[gift-moment] event read failed', error.message);
    return null;
  }
  const rows = (data ?? []) as EventRow[];
  return Promise.all(
    rows.map(async (r) => {
      // A logo that cannot be shown falls back to the two initials — never a broken image on the seal.
      const logoSrc = r.giver_logo ? await displayLogoUrl({ logo_url: r.giver_logo }).catch(() => null) : null;
      return shopGiftMomentView(
        { ref: r.ref_id, giverName: r.giver_name, logoSrc, lines: linesOf(r.lines), landedAt: r.landed_at, claimedAt: r.claimed_at },
        eventId,
      );
    }),
  );
}

/** A shop's badge rewards as gift moments. null = the read failed. `admin` reads only the catalogue's pack names. */
export async function readShopGiftMoments(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<GiftMomentView[] | null> {
  const [{ data, error }, names] = await Promise.all([
    supabase.rpc('gift_moments_for_shop', { p_vendor_profile_id: vendorProfileId }),
    readRewardNames(admin).catch(() => undefined),
  ]);
  if (error) {
    console.error('[gift-moment] shop read failed', error.message);
    return null;
  }
  return ((data ?? []) as ShopRow[]).map((r) =>
    badgeRewardMomentView(
      {
        ref: r.ref_id,
        rewardKey: r.reward_key,
        badge: r.badge,
        rewardKind: r.reward_kind,
        units: Number(r.units) || 1,
        landedAt: r.landed_at,
        claimedAt: r.claimed_at,
      },
      names,
    ),
  );
}

export type ClaimAnswer = { status: 'claimed' | 'already' | 'refused'; claimedAt: string | null } | null;

/**
 * Pressing Redeem. ONE database statement decides (`gift_moment_claim`): the first press is the claim, every repeat
 * answers 'already'. null = the request did not get an answer (the button offers Try again, which sends this same
 * claim — safe, because of the key).
 */
export async function claimGiftMoment(supabase: SupabaseClient, source: GiftMomentSource, ref: string): Promise<ClaimAnswer> {
  const { data, error } = await supabase.rpc('gift_moment_claim', { p_source: source, p_ref: ref });
  if (error) {
    console.error('[gift-moment] claim failed', error.message);
    return null;
  }
  const d = (data ?? {}) as { status?: string; claimed_at?: string | null };
  if (d.status === 'claimed' || d.status === 'already' || d.status === 'refused') {
    return { status: d.status, claimedAt: d.claimed_at ?? null };
  }
  return null;
}
