import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { CLAIM_WORD_FALLBACK_WHY, type ClaimWord } from '@/lib/service-card-checks';
import { loadClaimWordsFor } from '@/lib/service-card-checks.server';
import { fairRefusal, findFairHits, type FairText } from '@/lib/fair-presentation';

/**
 * fair-presentation.server.ts — THE SAVE ASKS AGAIN, for every supplier-written field (owner 2026-11-08).
 *
 * Every page that draws a supplier-written field shows the fair-presentation note live and keeps Save off
 * (`lib/fair-presentation.ts`); this is the SAME function over the posted text, so a save that skipped the page (an old
 * tab, a hand-made POST) is refused with the same sentence. One reader of the word list (`loadClaimWordsFor`), so the
 * live note and the save can never check against two different lists.
 *
 * REQUESTS: 2 to the database (the list + this shop's allowances, in parallel) — 1 when there is no shop yet
 * (`/open-shop`, the list alone). Fails SOFT: an unread list skips the word check only and is logged where it was
 * read; every other check needs no list and still runs. Never an email, never a notification — a refusal is a
 * sentence on the screen the supplier is on.
 */

/** The word list with no shop's allowances — for a name typed before the shop exists. `null` = unread. */
export async function loadClaimWordList(): Promise<ClaimWord[] | null> {
  try {
    const { data, error } = await createAdminClient().from('card_claim_words').select('phrase, note').order('phrase');
    if (error) {
      console.error('[supabase-error] lib/fair-presentation.server.ts · card_claim_words', error);
      return null;
    }
    return ((data ?? []) as { phrase: string; note: string | null }[]).map((w) => ({
      phrase: w.phrase,
      why: (w.note ?? '').trim() || CLAIM_WORD_FALLBACK_WHY,
    }));
  } catch (e) {
    console.error('[fair-presentation] claim words unread', e);
    return null;
  }
}

/** The words this shop may not use (its allowances removed), or the plain list before a shop exists. */
export function loadFairWords(vendorProfileId: string | null): Promise<ClaimWord[] | null> {
  return vendorProfileId ? loadClaimWordsFor(vendorProfileId) : loadClaimWordList();
}

/**
 * The refusal for `texts`, or null. `words` may be handed in when the caller already read them (the card save reads
 * them once for every check); otherwise they are read here.
 */
export async function fairPresentationRefusal(args: {
  vendorProfileId: string | null;
  texts: ReadonlyArray<FairText>;
  siblingNames?: ReadonlyArray<string>;
  words?: ClaimWord[] | null;
}): Promise<string | null> {
  // Nothing written → nothing to read the list for.
  if (!args.texts.some((t) => (t.value ?? '').trim().length > 0)) return null;
  const words = args.words !== undefined ? args.words : await loadFairWords(args.vendorProfileId);
  return fairRefusal(findFairHits(args.texts, { words, siblingNames: args.siblingNames }));
}
