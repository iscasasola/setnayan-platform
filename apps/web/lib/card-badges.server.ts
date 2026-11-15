import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  CARD_BADGES,
  CARD_BADGE_KEYS,
  cardBadgeRow,
  parseShopBadgeFacts,
  passingCardBadges,
  type CardBadgesRead,
  type EarnedCardBadgeKey,
} from '@/lib/card-badges';

/**
 * 🏅 THE SERVICE-CARD BADGES, READ FOR ONE SHOP (badge build J3).
 *
 * 1 · `service_card_badge_facts` — the raw 30-day numbers per card (service role: it reads other couples' events).
 * 2 · `passingCardBadges` — the ONE rule (lib/card-badges.ts).
 * 3 · `service_card_badge_settle` — remembers since when each badge has been held; a badge no longer passing is
 *     forgotten (its time starts again). It answers which holds are NEW for exactly one caller, and that caller sends
 *     the shop the Today congratulations (`card_badge_earned`) — once per earning, however many pages open at once.
 *
 * ⚠ THE CHECK RUNS WHEN THE SHOP'S PAGE IS SHOWN, NOT ON A CLOCK. What a viewer sees is always computed from the last
 * 30 days at that moment, so a medal is never shown after it stopped passing. What is NOT continuous: the held time
 * resets only when a page is drawn while the badge fails — a gap nobody saw does not reset it. Named in the PR.
 *
 * Fails CLOSED and SAYS SO: a refused or malformed read is `{ kind: 'unreadable' }` — never an empty row that reads as
 * "this card has no badges".
 */
export async function readCardBadges(
  admin: SupabaseClient,
  args: {
    vendorProfileId: string;
    shopVerified: boolean;
    /** The shop holds the Verified Partner seal — its cards' 6th medal reads "Verified Partner · for life". */
    verifiedPartner: boolean;
  },
): Promise<CardBadgesRead> {
  const { data, error } = await admin.rpc('service_card_badge_facts', { p_vendor_profile_id: args.vendorProfileId });
  if (error) {
    logQueryError('readCardBadges.facts', error, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return { kind: 'unreadable' };
  }
  const facts = parseShopBadgeFacts(data);
  if (!facts) {
    console.error('[readCardBadges] facts unreadable or malformed', { vendorProfileId: args.vendorProfileId });
    return { kind: 'unreadable' };
  }

  const now = Date.now();
  const passing = facts.cards.flatMap((c) =>
    passingCardBadges(c, facts.good_standing, now).map((badge) => ({ card: c.id, badge })),
  );

  const { data: held, error: settleError } = await admin.rpc('service_card_badge_settle', {
    p_vendor_profile_id: args.vendorProfileId,
    p_passing: passing,
  });
  if (settleError || !Array.isArray(held)) {
    if (settleError) logQueryError('readCardBadges.settle', settleError, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return { kind: 'unreadable' };
  }

  type Hold = { vendor_service_id: string; badge: string; held_since: string; is_new: boolean };
  const holds = (held as Hold[]).filter((h): h is Hold & { badge: EarnedCardBadgeKey } =>
    (CARD_BADGE_KEYS as readonly string[]).includes(h.badge),
  );

  const verified = {
    on: args.shopVerified && facts.good_standing,
    since: facts.verified_since,
    partner: args.verifiedPartner && facts.good_standing,
  };
  const byCard: Record<string, ReturnType<typeof cardBadgeRow>> = {};
  for (const c of facts.cards) {
    if (!c.published) continue;
    byCard[c.id] = cardBadgeRow(
      holds.filter((h) => h.vendor_service_id === c.id),
      verified,
    );
  }

  const fresh = holds.filter((h) => h.is_new);
  if (fresh.length > 0) await announce(admin, args.vendorProfileId, fresh);

  return { kind: 'ok', byCard };
}

/** "Your Wedding Film card earned Hot Booking" — one notice per new badge, to the shop's owner, on Today. */
async function announce(
  admin: SupabaseClient,
  vendorProfileId: string,
  fresh: ReadonlyArray<{ vendor_service_id: string; badge: EarnedCardBadgeKey }>,
): Promise<void> {
  const [{ data: shop, error: shopError }, { data: cards, error: cardsError }] = await Promise.all([
    admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    admin
      .from('vendor_services')
      .select('vendor_service_id, title')
      .in('vendor_service_id', [...new Set(fresh.map((f) => f.vendor_service_id))]),
  ]);
  const userId = (shop as { user_id?: string | null } | null)?.user_id ?? null;
  if (shopError || !userId) {
    if (shopError) logQueryError('readCardBadges.announce.shop', shopError, { vendorProfileId }, 'graceful_degrade');
    return;
  }
  if (cardsError) logQueryError('readCardBadges.announce.cards', cardsError, { vendorProfileId }, 'graceful_degrade');
  const titleOf = new Map(
    ((cards ?? []) as Array<{ vendor_service_id: string; title: string | null }>).map((c) => [c.vendor_service_id, c.title]),
  );
  for (const f of fresh) {
    const badge = CARD_BADGES[f.badge];
    const title = titleOf.get(f.vendor_service_id)?.trim();
    await emitNotification({
      userId,
      type: 'card_badge_earned',
      title: title ? `Your “${title}” card earned ${badge.name}` : `One of your cards earned ${badge.name}`,
      body: badge.rule,
      relatedUrl: '/vendor-dashboard',
    });
  }
}
