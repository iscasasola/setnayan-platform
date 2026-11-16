import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import { cardCongratsTodayLine } from '@/app/_components/award/card-congrats-words';
import {
  CARD_BADGES,
  CARD_BADGE_KEYS,
  CARD_BADGE_TAGS,
  cardBadgeCongratsHref,
  cardBadgeRow,
  parseShopBadgeFacts,
  passingCardBadges,
  type CardBadgesRead,
  type EarnedCardBadgeKey,
} from '@/lib/card-badges';

/**
 * 🏅 THE SERVICE-CARD BADGES, FOR ONE SHOP (badge build J3).
 *
 * TWO doors, and only one of them writes:
 *
 *   readCardBadges(...)    the PUBLIC render (`/v/[slug]`). READ-ONLY: `service_card_badge_facts` (the raw 30-day
 *                          numbers) → `passingCardBadges` (the ONE rule) → the open holds, read for their `held_since`.
 *                          A medal shows only while it passes NOW; its time comes from the open hold, or the name alone
 *                          when no hold is open yet. 🔒 A render never writes — no settle, no notice, on any view.
 *   settleCardBadges(...)  the WRITE path, run from `sweepShopBadges` (lib/badge-earned.server.ts) — i.e. from after()
 *                          on the moments a count moves (booking delivered/complete, a review, a gift) and from the daily
 *                          backstop `maybeRunBadgeRewardSweep`, which also visits every shop holding a card badge and
 *                          every shop asked about recently, so each card is checked every day. It calls
 *                          `service_card_badge_settle` (closes what stopped passing — its time starts again — opens
 *                          what newly passes) and sends the shop ONE Today line per new hold:
 *                          "Congratulations, your [card] service card earned [badge]" → the congratulations.
 *
 * Fails CLOSED and SAYS SO: a refused or malformed read is `{ kind: 'unreadable' }` — never an empty row that reads as
 * "this card has no badges".
 */
export async function readCardBadges(
  admin: SupabaseClient,
  args: {
    vendorProfileId: string;
    shopVerified: boolean;
    /** The shop holds the Verified Partner seal (`readShopSeals`) — its cards' 6th medal reads "Verified Partner · for life". */
    verifiedPartner: boolean;
  },
): Promise<CardBadgesRead> {
  const [factsRes, holdsRes] = await Promise.all([
    admin.rpc('service_card_badge_facts', { p_vendor_profile_id: args.vendorProfileId }),
    admin
      .from('service_card_badge_holds')
      .select('vendor_service_id, badge, held_since')
      .eq('vendor_profile_id', args.vendorProfileId)
      .is('lost_at', null),
  ]);
  if (factsRes.error) {
    logQueryError('readCardBadges.facts', factsRes.error, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return { kind: 'unreadable' };
  }
  if (holdsRes.error || !Array.isArray(holdsRes.data)) {
    if (holdsRes.error) logQueryError('readCardBadges.holds', holdsRes.error, { vendorProfileId: args.vendorProfileId }, 'graceful_degrade');
    return { kind: 'unreadable' };
  }
  const facts = parseShopBadgeFacts(factsRes.data);
  if (!facts) {
    console.error('[readCardBadges] facts unreadable or malformed', { vendorProfileId: args.vendorProfileId });
    return { kind: 'unreadable' };
  }

  const sinceOf = new Map<string, string>();
  for (const h of holdsRes.data as Array<{ vendor_service_id: string; badge: string; held_since: string }>) {
    sinceOf.set(`${h.vendor_service_id}.${h.badge}`, h.held_since);
  }

  const now = Date.now();
  const verified = {
    on: args.shopVerified && facts.good_standing,
    since: facts.verified_since,
    partner: args.verifiedPartner && facts.good_standing,
  };
  const byCard: Record<string, ReturnType<typeof cardBadgeRow>> = {};
  for (const c of facts.cards) {
    if (!c.published) continue;
    const passing = passingCardBadges(c, facts.good_standing, now);
    byCard[c.id] = cardBadgeRow(
      passing.map((badge) => ({ badge, held_since: sinceOf.get(`${c.id}.${badge}`) ?? null })),
      verified,
    );
  }
  return { kind: 'ok', byCard };
}

/**
 * The write path (service role): work out what passes now, settle the holds, tell the shop about each NEW one. Called
 * only from the sweep (`sweepShopBadges`) — never from a render. Answers how many holds were newly opened; null when a
 * read or the settle failed (nothing is told then — the next sweep settles it).
 */
export async function settleCardBadges(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { data, error } = await admin.rpc('service_card_badge_facts', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError('settleCardBadges.facts', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const facts = parseShopBadgeFacts(data);
  if (!facts) return null;

  const now = Date.now();
  const passing = facts.cards.flatMap((c) =>
    passingCardBadges(c, facts.good_standing, now).map((badge) => ({ card: c.id, badge })),
  );
  const { data: held, error: settleError } = await admin.rpc('service_card_badge_settle', {
    p_vendor_profile_id: vendorProfileId,
    p_passing: passing,
  });
  if (settleError || !Array.isArray(held)) {
    if (settleError) logQueryError('settleCardBadges.settle', settleError, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  type Hold = { vendor_service_id: string; badge: string; is_new: boolean };
  const fresh = (held as Hold[]).filter(
    (h): h is Hold & { badge: EarnedCardBadgeKey } => h.is_new && (CARD_BADGE_KEYS as readonly string[]).includes(h.badge),
  );
  if (fresh.length > 0) await announce(admin, vendorProfileId, fresh);
  return fresh.length;
}

/** "Congratulations, your Wedding Film service card earned Hot Booking" — one Today line per new hold, to the owner. */
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
    if (shopError) logQueryError('settleCardBadges.announce.shop', shopError, { vendorProfileId }, 'graceful_degrade');
    return;
  }
  if (cardsError) {
    // No card names = no line: the words name the card, and a nameless line is not the drawing's.
    logQueryError('settleCardBadges.announce.cards', cardsError, { vendorProfileId }, 'graceful_degrade');
    return;
  }
  const titleOf = new Map(
    ((cards ?? []) as Array<{ vendor_service_id: string; title: string | null }>).map((c) => [c.vendor_service_id, c.title]),
  );
  for (const f of fresh) {
    const title = titleOf.get(f.vendor_service_id)?.trim();
    if (!title) continue;
    const badge = CARD_BADGES[f.badge];
    await emitNotification({
      userId,
      type: 'card_badge_earned',
      title: cardCongratsTodayLine(title, badge.name),
      body: badge.rule,
      relatedUrl: cardBadgeCongratsHref(f.vendor_service_id, f.badge),
    });
  }
}

/** What the congratulations draws for one link — only for a card of THIS shop that holds that badge now. */
export type CardBadgeCongratsRead = { cardName: string; badge: EarnedCardBadgeKey; name: string; tag: string; rule: string };
export async function readCardBadgeCongrats(
  admin: SupabaseClient,
  vendorProfileId: string,
  link: { vendorServiceId: string; badge: EarnedCardBadgeKey },
): Promise<CardBadgeCongratsRead | null> {
  const [{ data: hold, error: holdError }, { data: card, error: cardError }] = await Promise.all([
    admin
      .from('service_card_badge_holds')
      .select('hold_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('vendor_service_id', link.vendorServiceId)
      .eq('badge', link.badge)
      .is('lost_at', null)
      .maybeSingle(),
    admin
      .from('vendor_services')
      .select('title')
      .eq('vendor_service_id', link.vendorServiceId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  if (holdError || cardError) {
    logQueryError('readCardBadgeCongrats', (holdError ?? cardError)!, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const cardName = (card as { title?: string | null } | null)?.title?.trim();
  if (!hold || !cardName) return null;
  const def = CARD_BADGES[link.badge];
  return { cardName, badge: link.badge, name: def.name, tag: CARD_BADGE_TAGS[link.badge], rule: def.rule };
}
