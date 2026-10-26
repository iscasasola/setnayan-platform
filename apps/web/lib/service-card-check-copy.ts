/**
 * service-card-check-copy.ts — what the SUPPLIER reads when the automatic check holds a card.
 *
 * Drawn in the approved prototype (corpus `prototypes/service_card_checks_2026-10-26/`, frame 1 · Delta 1 — the gold
 * box that replaces the sage one after Create). Pure, so the words are unit-tested.
 *
 * 🔒 THREE RULES (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN" + PLAN §9.8):
 *   · it says "waiting for a quick check" and gives the fix — never "flag", "fraud", "scam", "violation";
 *   · a photo match names ANOTHER SHOP, never which one (ruling: 'supplier told "another shop", never which');
 *   · the reasons come from the flag row the server wrote, never from the address.
 */
import type { CardReason } from './service-card-checks';

export type SupplierReasonLine = { icon: string; title: string; line: string };

const PESO = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

function basisWords(basis: string): string {
  if (basis === 'per_pax') return ' per guest';
  if (basis === 'per_hour') return ' per hour';
  return '';
}

/** “Guaranteed” · “Guaranteed” and “#1” · “Guaranteed”, “#1” and “Official”. */
export function quotedList(words: readonly string[]): string {
  const q = words.map((w) => `“${w.charAt(0).toUpperCase()}${w.slice(1)}”`);
  if (q.length <= 1) return q[0] ?? '';
  return `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
}

export function supplierReasonLines(
  reasons: readonly CardReason[],
  opts: { serviceLabel: string },
): SupplierReasonLine[] {
  const out: SupplierReasonLine[] = [];
  for (const r of reasons) {
    switch (r.code) {
      case 'photo': {
        const cover = r.matches.some((m) => m.which === 'cover');
        out.push({
          icon: '📷',
          title: cover ? 'The cover photo also appears on another shop' : 'A showcase photo also appears on another shop',
          line: 'If it’s your own work, say so when you save — we’ll clear it.',
        });
        break;
      }
      case 'price':
        out.push({
          icon: '₱',
          title: `${PESO(r.pricePhp)}${basisWords(r.basis)} is far below what ${opts.serviceLabel} usually costs here`,
          line: 'Check the number and whether it’s per guest or a flat price.',
        });
        break;
      case 'service':
        out.push({
          icon: '⇄',
          title: `The name reads like ${r.matchedLabel}, but the card is filed under ${r.filedLabel}`,
          line: 'Move it or rename it.',
        });
        break;
      case 'words':
        out.push({
          icon: 'Aa',
          title: `${quotedList(r.hits)} can’t be shown on a card`,
          line: 'Say what you do instead — couples read it as a promise.',
        });
        break;
      case 'check_unavailable':
        out.push({
          icon: '…',
          title: 'We couldn’t finish the automatic check',
          line: 'A person at Setnayan will look — you don’t need to do anything.',
        });
        break;
    }
  }
  return out;
}

const COUNT_WORD = ['No things', 'One thing', 'Two things', 'Three things', 'Four things'];

/** The box's headline + the sentence under it. */
export function heldBoxHeading(args: {
  reasons: readonly CardReason[];
  /** The card was rejected before and this save re-queued it (ruling: "after a Reject every save re-queues"). */
  afterReject: boolean;
}): { headline: string; intro: string } {
  const actionable = args.reasons.filter((r) => r.code !== 'check_unavailable').length;
  const headline = args.afterReject ? 'Saved · we’ll look again' : 'Saved · waiting for a quick check';
  if (actionable === 0) {
    return { headline, intro: 'A person at Setnayan will look at this version before it goes live.' };
  }
  const n = COUNT_WORD[actionable] ?? `${actionable} things`;
  return {
    headline,
    intro:
      actionable === 1
        ? `${n} to look at. Fix it and save again, or leave it and we’ll review it as is.`
        : `${n} to look at. Fix them and save again, or leave it and we’ll review it as is.`,
  };
}

/** Parse `integrity_flags.detail.reasons` defensively — a malformed row yields no lines, never a crash. */
export function reasonsFromDetail(detail: unknown): CardReason[] {
  const raw = (detail as { reasons?: unknown } | null)?.reasons;
  if (!Array.isArray(raw)) return [];
  const known = new Set(['photo', 'price', 'service', 'words', 'check_unavailable']);
  return raw.filter(
    (r): r is CardReason => !!r && typeof r === 'object' && known.has((r as { code?: string }).code ?? ''),
  );
}
