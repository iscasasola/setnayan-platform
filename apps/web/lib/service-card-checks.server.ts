import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { reviewedAliasesByLiveTrade } from '@/lib/service-trade-aliases';
import { getReviewedTradeAliasRows } from '@/lib/service-trade-aliases-db';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import { checkCardPhotos } from '@/lib/card-photo-check.server';
import { cardFairTexts, fairRefusal, findFairHits } from '@/lib/fair-presentation';
import {
  CLAIM_WORD_FALLBACK_WHY,
  cardPhotoLine,
  findServiceMismatch,
  photoBlocks,
  serviceMismatchLine,
  type CheckTrade,
  type ClaimWord,
} from '@/lib/service-card-checks';

/**
 * service-card-checks.server.ts — WHAT THE CARD CHECKS READ, for the maker's page and for the save (one reader, so
 * the maker and the save can never check against two different lists).
 *
 * REQUESTS: 2 to the database for the claim words (the list + this shop's allowances, in parallel, service role —
 * both tables are admin-only under RLS) + the taxonomy and the reviewed aliases, which are React-`cache`d per request
 * (`getCoverageTaxonomy` · `getReviewedTradeAliasRows` · `getServiceMergeForwards`), so the maker's own kind list
 * reading them first makes them free here.
 *
 * Each half fails SOFT to `null` = "could not be read" — never to an empty list, which would read as "nothing on this
 * card to fix" (a failure that renders as success). The maker says the check is waiting; the save lets the card
 * through (fail-open, like the QR guard) and logs.
 */

export type CardCheckRules = {
  /** The claim words this shop may not use — the admin list less this shop's allowances. `null` = unread. */
  claimWords: ClaimWord[] | null;
  /** Every live trade with its reviewed aliases — the taxonomy, never a hard-coded copy. `null` = unread. */
  trades: CheckTrade[] | null;
  /**
   * 🚫 This shop's cards by id → name — check 9 (flooding): a card named the same as another of the shop's cards.
   * The maker leaves out the card being edited. `null` = unread (the check then waits for the save). Optional so an
   * older caller (the dev lab) that hands in no list simply skips it.
   */
  ownCards?: OwnCardName[] | null;
};

export type OwnCardName = { id: string; title: string };

/** This shop's card names (1 request). `null` = unread. */
export async function loadOwnCardNames(vendorProfileId: string): Promise<OwnCardName[] | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('vendor_services')
      .select('vendor_service_id, title')
      .eq('vendor_profile_id', vendorProfileId);
    if (error) {
      console.error('[supabase-error] lib/service-card-checks.server.ts · vendor_services (own card names)', error);
      return null;
    }
    return ((data ?? []) as { vendor_service_id: string; title: string | null }[])
      .filter((r) => (r.title ?? '').trim().length > 0)
      .map((r) => ({ id: r.vendor_service_id, title: (r.title ?? '').trim() }));
  } catch (e) {
    console.error('[card-checks] own card names unread', e);
    return null;
  }
}

/** The names a card is compared against for flooding: every other card of the shop. */
export function siblingCardNames(own: ReadonlyArray<OwnCardName> | null | undefined, serviceId: string | null): string[] {
  return (own ?? []).filter((c) => c.id !== serviceId).map((c) => c.title);
}

export async function loadClaimWordsFor(vendorProfileId: string): Promise<ClaimWord[] | null> {
  try {
    const admin = createAdminClient();
    const [words, allowed] = await Promise.all([
      admin.from('card_claim_words').select('phrase, note').order('phrase'),
      admin.from('card_claim_word_allowances').select('phrase').eq('vendor_profile_id', vendorProfileId),
    ]);
    if (words.error || allowed.error) {
      console.error('[supabase-error] lib/service-card-checks.server.ts · card_claim_words', words.error ?? allowed.error);
      return null;
    }
    const skip = new Set(((allowed.data ?? []) as { phrase: string }[]).map((a) => a.phrase));
    return ((words.data ?? []) as { phrase: string; note: string | null }[])
      .filter((w) => !skip.has(w.phrase))
      .map((w) => ({ phrase: w.phrase, why: (w.note ?? '').trim() || CLAIM_WORD_FALLBACK_WHY }));
  } catch (e) {
    console.error('[card-checks] claim words unread', e);
    return null;
  }
}

export async function loadCheckTrades(): Promise<CheckTrade[] | null> {
  try {
    const tree = await getCoverageTaxonomy();
    const liveKeys = new Set<string>(tree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService))));
    const [aliasRows, forwards] = await Promise.all([
      getReviewedTradeAliasRows().catch(() => []),
      getServiceMergeForwards().catch(() => ({})),
    ]);
    const aliases = reviewedAliasesByLiveTrade(aliasRows, forwards, liveKeys);
    const trades = tree.flatMap((p) =>
      p.branches.flatMap((b) =>
        b.leaves.map((l) => ({ key: l.canonicalService, label: l.label, branch: b.label, aliases: aliases.get(l.canonicalService) })),
      ),
    );
    return trades.length > 0 ? trades : null;
  } catch (e) {
    console.error('[card-checks] trades unread', e);
    return null;
  }
}

export async function loadCardCheckRules(vendorProfileId: string): Promise<CardCheckRules> {
  const [claimWords, trades, ownCards] = await Promise.all([
    loadClaimWordsFor(vendorProfileId),
    loadCheckTrades(),
    loadOwnCardNames(vendorProfileId),
  ]);
  return { claimWords, trades, ownCards };
}

/**
 * THE SAVE ASKS AGAIN (`commitVendorService`, new cards AND edits). The maker already kept Create shut while any of
 * the three was open; this is the same functions over the posted form, so a card that skipped the maker (an old tab, a
 * hand-made POST) is refused with the same sentence the row showed. Returns the FIRST refusal, or null.
 *
 * A half that could not be read lets the card through (fail-open, like the QR guard) — an unreadable list is not a
 * reason to stop an honest save — and is logged where it was read.
 */
export async function cardCheckRefusal(card: {
  vendorProfileId: string;
  serviceId: string | null;
  category: string;
  categoryLabel: string;
  title: string;
  inclusionLabels: string[];
  addonLabels: string[];
  cover: string | null;
  showcase: string[];
}): Promise<string | null> {
  const [rules, photos] = await Promise.all([
    loadCardCheckRules(card.vendorProfileId),
    checkCardPhotos({ vendorProfileId: card.vendorProfileId, serviceId: card.serviceId, cover: card.cover, showcase: card.showcase }),
  ]);
  // 🚫 FAIR PRESENTATION (owner 2026-11-08) — the claim words (disguised forms too), rank forms, no emoji, and the
  // text checks of the 18, on the name, every what's-included line and every extra. The SAME function the maker's
  // rows ask (`lib/fair-presentation.ts`). An unread word list skips only the word check; the rest still run.
  {
    const refusal = fairRefusal(
      findFairHits(cardFairTexts(card), {
        words: rules.claimWords,
        siblingNames: siblingCardNames(rules.ownCards, card.serviceId),
      }),
    );
    if (refusal) return refusal;
  }
  if (rules.trades) {
    const m = findServiceMismatch({
      title: card.title,
      lines: card.inclusionLabels,
      category: card.category,
      categoryLabel: card.categoryLabel,
      trades: rules.trades,
    });
    if (m) return `${serviceMismatchLine(m, card.categoryLabel)} Rename it, or file it under ${m.says.label}.`;
  }
  const blocked = photos.find(photoBlocks);
  return blocked ? cardPhotoLine(blocked) : null;
}
