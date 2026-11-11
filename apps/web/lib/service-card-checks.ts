/**
 * service-card-checks.ts — THE CHECKS A SERVICE CARD PASSES BEFORE CREATE (owner 2026-10-26).
 *
 * ⚖ *"when there is something they need to change, they must fix it before the service card is created. this way, we
 * do not need to integrity watch them one by one. and they resolve it by themselves"* · *"once a photo is used. it
 * technically cannot be used on another service card."* · *"ok then remove the price integrity issue"*.
 *
 * So the checks run LIVE in the shipped maker (`canvas-maker.tsx`) — each problem on its own row, Create (Save on an
 * edit) waiting until it is fixed — and the save (`commitVendorService`) asks the SAME functions again and refuses.
 * Nothing is created and then held; there is no per-card review queue. Exactly three checks:
 *
 *   1. CLAIM WORDS — a word from the admin list `card_claim_words` in the name, a what's-included line or an extra.
 *      A shop holding an admin allowance for that word (`card_claim_word_allowances`) is not stopped by it.
 *   2. THE CARD MATCHES ITS SERVICE — the name says another trade (by the live taxonomy's labels and its REVIEWED
 *      aliases, never a hard-coded copy) and nothing on the card says its own.
 *   3. ONE PHOTO = ONE SERVICE CARD — server-only (pHash), `lib/card-photo-check.server.ts`; its verdict type lives
 *      here so the maker and the save speak one shape.
 *
 * ⛔ NO PRICE CHECK OF ANY KIND. A card's price is the supplier's ("of course a card has different inclusions so their
 * prices can really differ from each other").
 *
 * PURE — no I/O. The page reads the word list and the trades (`lib/service-card-checks.server.ts`) and hands them in.
 */

import { claimReadings } from './claim-text-fold';

// ── 1 · claim words ─────────────────────────────────────────────────────────

/** One word on the admin list, as the supplier reads it: the word and its one-line why. */
export type ClaimWord = { phrase: string; why: string };

/** A word found on the card: which word, why, and the field it is in (the row that shows it). */
export type ClaimHit = { phrase: string; why: string; field: ClaimField; index: number };

/** The card fields a claim word is looked for in — each one is a row of the maker. */
export type ClaimField = 'name' | 'included' | 'extras';

export type ClaimText = { field: ClaimField; index?: number; value: string | null | undefined };

/** The sentence when a word has no note of its own. */
export const CLAIM_WORD_FALLBACK_WHY = 'A claim we can’t check for couples.';

const LETTER_OR_DIGIT = '[\\p{L}\\p{N}]';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The pattern for one phrase: any case, WHOLE word — "official" is found in "Official caterer" and never in
 * "unofficially"; "#1" never in "#10"; "100%" never in "1100%". The words of a phrase may be split by spaces or a
 * hyphen ("best-in-town" carries "best in").
 */
export function claimWordPattern(phrase: string): RegExp {
  const parts = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).map(escapeRegExp);
  return new RegExp(`(?<!${LETTER_OR_DIGIT})${parts.join('[\\s\\-]+')}(?!${LETTER_OR_DIGIT})`, 'iu');
}

/**
 * Every claim word on the card, in field order (name first), one hit per (field, line, word). `allowed` = the words
 * this shop holds an admin allowance for — skipped for it alone.
 */
export function findClaimWords(
  texts: ReadonlyArray<ClaimText>,
  words: ReadonlyArray<ClaimWord>,
  allowed: ReadonlyArray<string> = [],
): ClaimHit[] {
  const skip = new Set(allowed.map((a) => a.trim().toLowerCase()));
  const live = words
    .filter((w) => w.phrase.trim().length > 0 && !skip.has(w.phrase.trim().toLowerCase()))
    .map((w) => ({ w, re: claimWordPattern(w.phrase) }));
  const hits: ClaimHit[] = [];
  for (const t of texts) {
    const value = (t.value ?? '').trim();
    if (!value) continue;
    // 🥸 DISGUISED FORMS (owner 2026-11-08: "N0. 1 · b e s t · #1️⃣"): the list is asked against every reading a couple
    // would see — spaced letters joined, look-alike digits read as letters, keycaps and full-width forms folded.
    const readings = claimReadings(value);
    for (const { w, re } of live) {
      if (readings.some((r) => re.test(r))) {
        hits.push({ phrase: w.phrase, why: w.why.trim() || CLAIM_WORD_FALLBACK_WHY, field: t.field, index: t.index ?? 0 });
      }
    }
  }
  return hits;
}

/** The sentence a supplier reads for one word — shown on its row, and as the save's refusal. */
export function claimWordLine(hit: Pick<ClaimHit, 'phrase'>): string {
  return `Reword “${hit.phrase}” to save this card.`;
}

// ── 2 · the card matches its service ────────────────────────────────────────

/** One live trade, as the check needs it — the maker's `TradeMatch` fits this shape. */
export type CheckTrade = {
  key: string;
  label: string;
  branch: string;
  aliases?: readonly string[];
};

export type ServiceMismatch = {
  /** The trade the card's NAME says. */
  says: CheckTrade;
  /** The word on the card that said it (a label or a reviewed alias). */
  word: string;
};

/** Lower-case, letters and digits only, single-spaced — the same text on both sides of a match. */
export function normaliseCardText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A phrase this short is too common to tell a trade by ("dj" stays found by its own trade only). */
const MIN_SIGNAL_LEN = 3;

/** Words that name no trade by themselves — two trades sharing "and" or "wedding" are not related. */
const NOT_A_TRADE_WORD = new Set([
  'and', 'the', 'for', 'with', 'wedding', 'weddings', 'event', 'events', 'party', 'parties', 'service', 'services',
  'package', 'packages', 'other', 'rental', 'rentals', 'hire', 'more',
]);

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

function phrasesOf(t: CheckTrade): string[] {
  return [t.label, ...(t.aliases ?? [])].map(normaliseCardText).filter((p) => p.length >= MIN_SIGNAL_LEN);
}

function signalTokens(label: string): Set<string> {
  return new Set(
    normaliseCardText(label)
      .split(' ')
      .filter((w) => w.length >= 4 && !NOT_A_TRADE_WORD.has(w)),
  );
}

/**
 * Does the card's NAME say a different trade, with nothing on the card saying its own?
 *
 * Deliberately conservative — a wrong "this isn't your service" would stop an honest card at Create:
 *   · only the NAME is read for the other trade (an inclusion like "with photo booth" is an extra, not the card);
 *   · a trade in the same branch as the card's own, or sharing a real word with its label ("Photo & Video" ·
 *     "Photo Booth"), is RELATED and never a mismatch;
 *   · any word of the card's own trade (label or reviewed alias), or of a related one, anywhere in the name or the
 *     what's-included lines, clears it.
 * The longest matching phrase wins when two trades are named.
 */
export function findServiceMismatch(args: {
  title: string | null | undefined;
  lines?: ReadonlyArray<string>;
  category: string;
  categoryLabel: string;
  trades: ReadonlyArray<CheckTrade>;
}): ServiceMismatch | null {
  const title = normaliseCardText(args.title ?? '');
  if (!title || !args.category) return null;
  const everything = normaliseCardText([args.title ?? '', ...(args.lines ?? [])].join(' '));

  const own = args.trades.find((t) => t.key === args.category) ?? null;
  const ownTokens = new Set([...signalTokens(args.categoryLabel), ...(own ? signalTokens(own.label) : [])]);
  const related = (t: CheckTrade) =>
    t.key === args.category ||
    (own !== null && t.branch === own.branch) ||
    [...signalTokens(t.label)].some((w) => ownTokens.has(w));

  const ownPhrases = [
    normaliseCardText(args.categoryLabel),
    ...(own ? phrasesOf(own) : []),
    ...args.trades.filter(related).flatMap(phrasesOf),
  ].filter((p) => p.length >= MIN_SIGNAL_LEN);
  if (ownPhrases.some((p) => containsPhrase(everything, p))) return null;

  let best: ServiceMismatch | null = null;
  // A related trade cannot match here: its phrases are in `ownPhrases`, which already returned null above.
  for (const t of args.trades) {
    for (const p of phrasesOf(t)) {
      if (containsPhrase(title, p) && (best === null || p.length > normaliseCardText(best.word).length)) {
        best = { says: t, word: p };
      }
    }
  }
  return best;
}

/** The sentence on the Name row (and the save's refusal). */
export function serviceMismatchLine(m: ServiceMismatch, categoryLabel: string): string {
  return `The name says ${m.says.label}, but this card is filed under ${categoryLabel}.`;
}

// ── 3 · one photo = one service card (verdict shape; the check is server-only) ──

export type CardPhotoWhere = 'cover' | 'showcase';

/** "It's mine — report it": the note admin reads, at most this long (the column's CHECK, and the report's own cut). */
export const REPORT_NOTE_MAX = 200;

/**
 * One photo's verdict. `another_shop` NEVER says which shop (owner: tell the supplier "another shop", never which
 * one). `this_shop` names the supplier's own card. `unchecked` = the photo could not be read just now — it does not
 * stop the card (the save asks again), and the row says so rather than looking checked.
 */
export type CardPhotoVerdict =
  | { ref: string; where: CardPhotoWhere; verdict: 'ok' }
  | { ref: string; where: CardPhotoWhere; verdict: 'unchecked' }
  | { ref: string; where: CardPhotoWhere; verdict: 'this_shop'; cardTitle: string }
  | { ref: string; where: CardPhotoWhere; verdict: 'another_shop' };

export function photoBlocks(v: CardPhotoVerdict): boolean {
  return v.verdict === 'this_shop' || v.verdict === 'another_shop';
}

/** The sentence on the Photos row (and the save's refusal). */
export function cardPhotoLine(v: CardPhotoVerdict): string | null {
  const which = v.where === 'cover' ? 'Your cover photo' : 'One of your photos';
  if (v.verdict === 'another_shop') return `${which} is already on another shop’s card. Replace it to save.`;
  if (v.verdict === 'this_shop') return `${which} is already on your card “${v.cardTitle}”. One photo, one card — replace it to save.`;
  return null;
}

/** A hash that names a card, as the photo check reads it (`vendor_image_hashes` with `vendor_service_id` set). */
export type NamedPhotoHash<S extends string = string> = {
  vendorProfileId: string;
  ref: string;
  surface: S;
  phash: bigint;
  isDemo: boolean;
  vendorServiceId: string;
};

/**
 * THE RULE for one photo, pure (the server reads the rows and hands them in — `lib/card-photo-check.server.ts`):
 *   · within `threshold` of a photo on ANOTHER shop's card (a demo shop's never counts) → `another_shop`, the closest;
 *   · the same stored ref on another of this shop's cards (`sameRefCardId`), or within `threshold` of a photo on one
 *     → `this_shop`, naming that card;
 *   · no hash (the photo could not be read) → `unchecked`; else `ok`.
 * The card being edited (`serviceId`) never counts against itself. Another shop always wins over this shop: it is the
 * one the supplier cannot fix by editing their other card.
 */
export function decidePhotoVerdict<S extends string>(args: {
  ref: string;
  where: CardPhotoWhere;
  phash: bigint | null;
  vendorProfileId: string;
  serviceId: string | null;
  threshold: number;
  named: ReadonlyArray<NamedPhotoHash<S>>;
  /** This shop's cards by id → title (only these can be named). */
  ownCards: ReadonlyMap<string, string>;
  /** Another of this shop's cards that stores this exact ref, if any. */
  sameRefCardId: string | null;
  distance: (a: bigint, b: bigint) => number;
}): { verdict: CardPhotoVerdict; source: NamedPhotoHash<S> & { distance: number } | null } {
  const { ref, where } = args;
  let other: { row: NamedPhotoHash<S>; dist: number } | null = null;
  let mine: { row: NamedPhotoHash<S>; dist: number } | null = null;
  if (args.phash !== null) {
    for (const row of args.named) {
      const isMine = row.vendorProfileId === args.vendorProfileId;
      if (isMine && row.vendorServiceId === args.serviceId) continue;
      if (!isMine && row.isDemo) continue;
      if (isMine && !args.ownCards.has(row.vendorServiceId)) continue;
      const dist = args.distance(args.phash, row.phash);
      if (dist > args.threshold) continue;
      if (!isMine && (other === null || dist < other.dist)) other = { row, dist };
      if (isMine && (mine === null || dist < mine.dist)) mine = { row, dist };
    }
  }
  if (other) return { verdict: { ref, where, verdict: 'another_shop' }, source: { ...other.row, distance: other.dist } };
  const ownId = args.sameRefCardId ?? mine?.row.vendorServiceId ?? null;
  if (ownId) {
    return { verdict: { ref, where, verdict: 'this_shop', cardTitle: args.ownCards.get(ownId) ?? 'another card' }, source: null };
  }
  if (args.phash === null) return { verdict: { ref, where, verdict: 'unchecked' }, source: null };
  return { verdict: { ref, where, verdict: 'ok' }, source: null };
}

// ── all three ───────────────────────────────────────────────────────────────

/** How many open problems stop Create — the maker's thumb-row count and the save's first refusal. */
export function openCardProblems(args: {
  claims: ReadonlyArray<ClaimHit>;
  mismatch: ServiceMismatch | null;
  photos: ReadonlyArray<CardPhotoVerdict>;
}): number {
  return args.claims.length + (args.mismatch ? 1 : 0) + args.photos.filter(photoBlocks).length;
}

/** The maker's live read of the form: the text the checks read, and the photo refs. */
export type CardCheckInput = {
  title: string;
  inclusionLabels: string[];
  addonLabels: string[];
  coverRef: string | null;
  showcaseRefs: string[];
};

export const EMPTY_CARD_CHECK_INPUT: CardCheckInput = {
  title: '',
  inclusionLabels: [],
  addonLabels: [],
  coverRef: null,
  showcaseRefs: [],
};

/** FormData → what the checks read. The SHIPPED field names; the server parses the same names. */
export function readCardCheckInput(fd: FormData): CardCheckInput {
  const strs = (k: string) => fd.getAll(k).map((v) => String(v).trim()).filter((v) => v.length > 0);
  const cover = String(fd.get('primary_photo_r2_key') ?? '').trim();
  return {
    title: String(fd.get('title') ?? '').trim(),
    inclusionLabels: strs('inclusion_label'),
    addonLabels: strs('addon_label'),
    coverRef: cover.length > 0 ? cover : null,
    showcaseRefs: Array.from(new Set(strs('showcase_photo_r2_keys'))),
  };
}

export function cardCheckInputKey(i: CardCheckInput): string {
  return [i.title, i.inclusionLabels.join('\u0001'), i.addonLabels.join('\u0001'), i.coverRef ?? '', i.showcaseRefs.join('\u0001')].join('\u0002');
}

/** The texts claim words are looked for in, in row order. */
export function claimTextsOf(i: Pick<CardCheckInput, 'title' | 'inclusionLabels' | 'addonLabels'>): ClaimText[] {
  return [
    { field: 'name', value: i.title },
    ...i.inclusionLabels.map((value, index) => ({ field: 'included' as const, index, value })),
    ...i.addonLabels.map((value, index) => ({ field: 'extras' as const, index, value })),
  ];
}

/** The photos key the maker re-asks the server on — only when the SET of photos changes. */
export function photoRefsKey(i: Pick<CardCheckInput, 'coverRef' | 'showcaseRefs'>): string {
  return [i.coverRef ?? '', ...i.showcaseRefs].join('\u0001');
}
