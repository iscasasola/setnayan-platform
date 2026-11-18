/**
 * 🖨 WHAT A PRINT WEARS — ONLY THE APPROVED v84 BADGES (owner 15 Nov 2026, DECISION_LOG "THE BADGES IN THE APPROVED
 * PROTOTYPE ARE THE ONLY BADGES"; art `prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html`).
 *
 * The prints used to wear the retired pills (`badgesForPrint` → events milestone · ★ rating · years in business ·
 * monthly awards). Each now becomes its v84 equivalent, or nothing:
 *
 *   retired pill          on paper now
 *   ─────────────────     ───────────────────────────────────────────────────────────────────────────────
 *   Verified              Setnayan Verified — the v84 blue check (`lib/verified-v84-art.ts`); the Verified
 *                         Partner seal takes its place for life (`displayedSeals`)
 *   N events milestone    Completed bookings at its tier (the v84 calendar picture)
 *   ★ rating              Five-star reviews at its tier (the v84 bubble picture); the ★ average stays a
 *                         plain text line on the pieces that print one ("Stars + reviews")
 *   Years in business     REMOVED — no v84 badge; "In business since" stays a text line where a piece has one
 *   Monthly awards        REMOVED — retired by the 15 Nov ruling; the yearly SEALS replace them (below)
 *   —                     Gifts given · Trusted by · Invites at their tier, when earned (the same shelf)
 *   —                     The seals a shop holds: No. 1 · Top 10 · Clients' Choice · Most In-Demand ·
 *                         Verified Partner (the v84 seal art, `lib/print-seal-art.ts`)
 *
 * 🔑 NO SECOND RULE. A tier is the Shop › Badges shelf's own tile (`shelfBadge`, `lib/shop-badge-shelf.ts`) from the
 * reward engine's counts, and only an EARNED tile prints — a locked, unread or not-counted badge never does. The seals
 * are `readShopSeals` (`lib/shop-seals.server.ts`) through `displayedSeals`, the shop page's own rule.
 *
 * PURE — no I/O. The badges are read by `lib/print-badges-v84.server.ts`; the art is resolved by `lib/print-badge-art.ts`.
 * 🔒 lib/print-badges-v84.test.ts · lib/prints-wear-only-v84-badges.test.ts
 */
import { SHOP_BADGE_KEYS, type ShopBadgeKey } from '@/lib/badge-tiers';
import { badgeArtSrc, shelfBadge, type ShelfFamily, type ShelfInput } from '@/lib/shop-badge-shelf';
import { SEAL_LABEL, displayedSeals, type StoredSeal } from '@/lib/shop-seals';

export type PrintBadge =
  | { kind: 'verified'; key: 'verified'; label: string }
  | { kind: 'tier'; key: ShopBadgeKey; label: string; family: ShelfFamily; tier: number }
  | { kind: 'seal'; key: StoredSeal; label: string; year: number };

export type PrintBadgeInput = {
  /** `hasVerifiedBadge(...)` as read now. */
  verified: boolean;
  /** The reward engine's counts (`readBadgeRewardFacts`); null = unread → no tier prints. */
  counts: ShelfInput['counts'];
  /** `shop_seals` rows (`readShopSeals(...).rows`); null = unread → no seal prints (Verified still does). */
  seals: ReadonlyArray<{ seal: StoredSeal; award_year: number }> | null;
};

export const VERIFIED_PRINT_LABEL = 'Setnayan Verified';

/**
 * Every badge a print wears today, in the order they print: the seals (`SEAL_ORDER`: No. 1 → Top 10 → Clients' Choice
 * → Most In-Demand → Verified Partner → Setnayan Verified), then the earned tiers in the shelf's own order.
 * A yearly seal won more than once prints once, with its newest year; Top 10 of a year the shop was No. 1 is No. 1.
 */
export function printBadgesV84(i: PrintBadgeInput): PrintBadge[] {
  const rows = i.seals ?? [];
  const newest = new Map<StoredSeal, number>();
  for (const r of rows) newest.set(r.seal, Math.max(newest.get(r.seal) ?? 0, r.award_year));
  if (newest.has('no1') && newest.get('no1') === newest.get('top10')) newest.delete('top10');
  const out: PrintBadge[] = [];
  for (const k of displayedSeals([...newest.keys()], i.verified)) {
    if (k === 'verified') out.push({ kind: 'verified', key: 'verified', label: VERIFIED_PRINT_LABEL });
    else out.push({ kind: 'seal', key: k, label: SEAL_LABEL[k], year: newest.get(k)! });
  }
  for (const key of SHOP_BADGE_KEYS) {
    const t = shelfBadge(key, { counts: i.counts, verified: i.verified, granted: null });
    if (t.state !== 'earned' || !t.family || t.tier === null) continue;
    out.push({ kind: 'tier', key, label: `${t.title} (${t.tierName})`, family: t.family, tier: t.tier });
  }
  return out;
}

/** The words of a badge in a print's quiet line ("Completed bookings (Gold)", "Top 10 Supplier 2026"). */
export function printBadgeWords(b: PrintBadge): string {
  return b.kind === 'seal' ? `${b.label} ${b.year}` : b.label;
}

/** What the Prints sheet lists before Save: the words, and the picture that prints (`/api/vendor/badges?view=print`). */
export type PrintBadgeListItem = { key: string; kind: PrintBadge['kind']; label: string; src: string };

/** The picture the sheet shows for a badge: a tier's own static v84 file; Verified or a seal, the print file itself. */
export function printBadgeListItem(b: PrintBadge): PrintBadgeListItem {
  const src = b.kind === 'tier' ? badgeArtSrc(b.family, b.tier) : `/api/vendor/badges?badge=${encodeURIComponent(b.key)}&inline=1`;
  return { key: b.key, kind: b.kind, label: printBadgeWords(b), src };
}

/**
 * One badge with its art RESOLVED on the server (`resolvePrintBadgeArt`): `svg` is a standalone <svg> whose
 * width × height is its native box (`w` × `h`), dropped into SVG prints as is; `png` is the same picture for a PDF
 * backend (null for Verified, which prints as vector ops).
 */
export type PrintBadgeArt = { badge: PrintBadge; w: number; h: number; svg: string; png: Uint8Array | null };
