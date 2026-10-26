/**
 * service-card-checks.ts — the automatic look every service card gets when it is saved to go live.
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN", corpus
 * `prototypes/service_card_checks_2026-10-26/` + PLAN.md): *"Cards go live right away after automatic checks; only
 * flagged cards wait for admin review."* A pass publishes exactly as today. A hit never refuses the save — it saves
 * the card hidden and opens one `integrity_flags(kind='service_card')` row for Integrity watch › Cards.
 *
 * THE FOUR CHECKS (and what is NOT one)
 *   · photo   — the card's cover or a showcase photo matches another shop's (repost-watch pHash). The hash itself
 *               lands after the save (`after()`); here we only carry forward matches repost-watch already holds OPEN
 *               for this card's current photos, so a resave cannot quietly clear a photo hold.
 *   · price   — BELOW the service's market band only, by more than the owner's tolerance. NO tolerance set = the
 *               price check is OFF (ruling: "OFF until set — no guessed number"). No band = no check.
 *   · service — the card's words match ANOTHER service's reviewed search words and NONE of its own. Both halves, so a
 *               card with no telling words ("Package A") passes.
 *   · words   — a claim word from the admin list, whole-word, any case, in the title · inclusion lines · add-on names,
 *               unless that shop has an allowance for it.
 *   · NOT a check: an unverified shop. Its cards are not visible to couples anyway — the admin row shows a context
 *     chip; holding the card would be a second source of truth for a fact the shop row already holds.
 *
 * 🔒 FAIL-CLOSED. This runs inside an `actions.ts` save that decides whether a card goes LIVE. A read the check needed
 * and could not make is not a pass: it becomes the reason `check_unavailable` ("We couldn't finish the automatic
 * check — a person will look") and the card waits. Same posture as `reads-are-honest` turned the other way: there an
 * absence must not render as emptiness; here an absence must not render as a clean card.
 *
 * Pure: no I/O. The reads live in `service-card-checks.server.ts`, which hands this file a context where every part
 * is either its data or `null` (= could not be read).
 */

/** The reason codes a held card can carry (stored in `integrity_flags.detail.reasons[].code`). */
export type CardReasonCode = 'photo' | 'price' | 'service' | 'words' | 'check_unavailable';

export type PhotoMatch = {
  /** The open `vendor_image_flags.public_id` on Repost watch — approving the card resolves it too. */
  imageFlagPublicId: string;
  hamming: number;
  /** Which of THIS card's photos matched. Never which shop it matched (ruling: "another shop", never which). */
  which: 'cover' | 'showcase';
};

export type CardReason =
  | { code: 'photo'; matches: PhotoMatch[] }
  | {
      code: 'price';
      pricePhp: number;
      basis: string;
      lowPhp: number;
      medianPhp: number;
      highPhp: number;
      sampleN: number;
      region: string;
      bucket: string;
      tolerance: number;
    }
  | { code: 'service'; filed: string; filedLabel: string; matched: string; matchedLabel: string; words: string[]; ownWords: string[] }
  | { code: 'words'; hits: string[] }
  | { code: 'check_unavailable'; checks: Array<'photo' | 'price' | 'service' | 'words'> };

/**
 * Sort weight (0–100, the existing `integrity_flags.score` column): photo 90 · price 70 · service 60 · words 40 —
 * PLAN §3, the max of the hits, so the Cards list sorts photo-first the way Integrity watch sorts by score. Not shown
 * to suppliers; not a tunable. `check_unavailable` sits between price and service so an unfinished check is looked at
 * before a claim word.
 */
export const REASON_SCORE: Record<CardReasonCode, number> = {
  photo: 90,
  price: 70,
  check_unavailable: 65,
  service: 60,
  words: 40,
};

export function scoreFor(reasons: readonly CardReason[]): number {
  return reasons.reduce((m, r) => Math.max(m, REASON_SCORE[r.code]), 0);
}

/** The flag's `reason` column — the highest-scoring code. */
export function primaryReason(reasons: readonly CardReason[]): CardReasonCode {
  let best: CardReason | undefined;
  for (const r of reasons) if (!best || REASON_SCORE[r.code] > REASON_SCORE[best.code]) best = r;
  return best?.code ?? 'words';
}

// ── matching ─────────────────────────────────────────────────────────────────

/** Lower-case, collapse whitespace. Both sides of every match go through this. */
export function normaliseText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word match that also works for phrases made of symbols ("#1", "100%"): the phrase may not be glued to a
 * letter or a digit on either side. "#1" matches "#1 Wedding" and not "#10"; "100%" matches "100% sure" and not
 * "1100%"; "best in" matches "Best  in Tagaytay" and not "bestinclass".
 */
export function containsWholePhrase(text: string, phrase: string): boolean {
  const p = normaliseText(phrase);
  if (p.length === 0) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(p)}(?![\\p{L}\\p{N}])`, 'u');
  return re.test(normaliseText(text));
}

/** Claim words found in the card's text, minus this shop's allowances. Returns the list's own (lower-case) phrases. */
export function findClaimWords(
  texts: readonly (string | null | undefined)[],
  words: readonly string[],
  allowed: ReadonlySet<string>,
): string[] {
  const joined = texts.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join(' \n ');
  if (!joined) return [];
  const hits: string[] = [];
  for (const w of words) {
    const p = normaliseText(w);
    if (!p || allowed.has(p) || hits.includes(p)) continue;
    if (containsWholePhrase(joined, p)) hits.push(p);
  }
  return hits;
}

/**
 * Below the band by more than the tolerance: price < low × (1 − tolerance). Only below — the ruling ("price BELOW
 * the service's band only"). A degenerate band (low ≤ 0) never holds.
 */
export function priceIsFarBelowBand(pricePhp: number, lowPhp: number, tolerance: number): boolean {
  if (!(pricePhp > 0) || !(lowPhp > 0)) return false;
  return pricePhp < lowPhp * (1 - tolerance);
}

export type ServiceWords = {
  /** canonical service key → its words (display names + reviewed search words), already merged-forward. */
  byService: ReadonlyMap<string, readonly string[]>;
  /** canonical service key → a label for the admin and supplier copy. */
  labelOf: ReadonlyMap<string, string>;
};

/**
 * "Filed under X, reads like Y": the card's words match another service's words and none of its own. `ownKeys` is
 * the card's whole family (its own key, the canonical services that map to it, and the legacy key they map to), so a
 * garden-venue card filed under Venue is never "wrong" for saying "garden venue". Returns null on a pass.
 */
export function findServiceMismatch(
  texts: readonly (string | null | undefined)[],
  ownKeys: ReadonlySet<string>,
  extraOwnWords: readonly string[],
  words: ServiceWords,
): { matched: string; words: string[]; ownWords: string[] } | null {
  const joined = texts.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join(' \n ');
  if (!joined) return null;

  const ownWords = new Set<string>(extraOwnWords.map(normaliseText).filter(Boolean));
  for (const k of ownKeys) for (const w of words.byService.get(k) ?? []) ownWords.add(normaliseText(w));
  for (const w of ownWords) if (containsWholePhrase(joined, w)) return null; // its own words are there → a pass

  let best: { key: string; found: string[] } | null = null;
  for (const [key, list] of words.byService) {
    if (ownKeys.has(key)) continue;
    const found: string[] = [];
    for (const w of list) {
      const p = normaliseText(w);
      if (!p || ownWords.has(p) || found.includes(p)) continue;
      if (containsWholePhrase(joined, p)) found.push(p);
    }
    if (found.length > 0 && (!best || found.length > best.found.length)) best = { key, found };
  }
  if (!best) return null;
  return { matched: best.key, words: best.found, ownWords: [...ownWords].slice(0, 6) };
}

// ── the whole look ───────────────────────────────────────────────────────────

export type CardCheckInput = {
  vendorProfileId: string;
  /** `vendor_services.category` — a legacy key or a canonical leaf. */
  category: string;
  categoryLabel: string;
  title: string | null;
  inclusionLabels: readonly string[];
  /** `null` = the add-ons could not be read → the words check cannot finish (the card waits). */
  addonLabels: readonly string[] | null;
  /** `starting_price_php` — the anchor the market bands are computed from. */
  startingPricePhp: number | null;
  pricingBasis: string;
};

/** Everything the checks read. `null` on any part = that read failed → the card waits (`check_unavailable`). */
export type CardCheckContext = {
  /** Open repost-watch matches for this card's current photos. */
  photoMatches: PhotoMatch[] | null;
  /** The owner's tolerance: a number, `'off'` (NULL in settings), or null (could not read). */
  tolerance: number | 'off' | null;
  /** The band row for (category, shop region, '__all__'): the row, `'none'` (no band → no check), or null. */
  band:
    | { lowPhp: number; medianPhp: number; highPhp: number; sampleN: number; region: string; bucket: string }
    | 'none'
    | null;
  serviceWords: (ServiceWords & { ownKeys: ReadonlySet<string> }) | null;
  claimWords: { words: readonly string[]; allowed: ReadonlySet<string> } | null;
};

export type CardCheckResult = { reasons: CardReason[]; score: number; held: boolean };

export function runCardChecks(input: CardCheckInput, ctx: CardCheckContext): CardCheckResult {
  const reasons: CardReason[] = [];
  const unavailable: Array<'photo' | 'price' | 'service' | 'words'> = [];

  // photo
  if (ctx.photoMatches === null) unavailable.push('photo');
  else if (ctx.photoMatches.length > 0) reasons.push({ code: 'photo', matches: ctx.photoMatches });

  // price — OFF until the owner sets a tolerance; no band → no check
  if (ctx.tolerance === null) unavailable.push('price');
  else if (ctx.tolerance !== 'off' && typeof input.startingPricePhp === 'number' && input.startingPricePhp > 0) {
    if (ctx.band === null) unavailable.push('price');
    else if (ctx.band !== 'none' && priceIsFarBelowBand(input.startingPricePhp, ctx.band.lowPhp, ctx.tolerance)) {
      reasons.push({
        code: 'price',
        pricePhp: input.startingPricePhp,
        basis: input.pricingBasis,
        lowPhp: ctx.band.lowPhp,
        medianPhp: ctx.band.medianPhp,
        highPhp: ctx.band.highPhp,
        sampleN: ctx.band.sampleN,
        region: ctx.band.region,
        bucket: ctx.band.bucket,
        tolerance: ctx.tolerance,
      });
    }
  }

  // service
  const serviceTexts = [input.title, ...input.inclusionLabels];
  if (ctx.serviceWords === null) unavailable.push('service');
  else {
    const hit = findServiceMismatch(serviceTexts, ctx.serviceWords.ownKeys, [input.categoryLabel], ctx.serviceWords);
    if (hit) {
      reasons.push({
        code: 'service',
        filed: input.category,
        filedLabel: input.categoryLabel,
        matched: hit.matched,
        matchedLabel: ctx.serviceWords.labelOf.get(hit.matched) ?? hit.matched,
        words: hit.words,
        ownWords: hit.ownWords,
      });
    }
  }

  // words
  if (ctx.claimWords === null || input.addonLabels === null) unavailable.push('words');
  else {
    const hits = findClaimWords(
      [input.title, ...input.inclusionLabels, ...input.addonLabels],
      ctx.claimWords.words,
      ctx.claimWords.allowed,
    );
    if (hits.length > 0) reasons.push({ code: 'words', hits });
  }

  if (unavailable.length > 0) reasons.push({ code: 'check_unavailable', checks: unavailable });
  return { reasons, score: scoreFor(reasons), held: reasons.length > 0 };
}

/** Only these reasons on a row → the admin may tick it for bulk approve (PLAN §9.5: words-only). */
export function isWordsOnly(reasons: readonly { code: string }[]): boolean {
  return reasons.length > 0 && reasons.every((r) => r.code === 'words');
}
