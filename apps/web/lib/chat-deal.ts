/**
 * 🤝 THE DEAL, IN NUMBERS — the two pure rules behind "Every version, their ask beside it" (owner 19 Nov 2026,
 * DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screen 7; drawn by
 * `app/_components/chat/cards/deal-sheet.tsx`). 🔒 lib/chat-deal.test.ts
 */
import { goodUntilWords } from './chat-cards';
import { formatCentavosPhp } from './php';

/** What the rule reads of an ask (`ChangeAskRow`, `card-calls.ts`). */
export type DealAsk = {
  askedAt: string;
  status: string;
  raisedBy?: 'host' | 'supplier';
  kind?: 'words' | 'counter' | 'plan';
  amountCentavos?: number | null;
  goodUntil?: string | null;
  moneyHidden?: boolean;
};

/**
 * THEIR ASK = the hosts' newest OPEN counter that has not expired. Not a plan proposal, not an ask in words, not the
 * supplier's own counter, not one whose amount this reader may not see. Null = nobody is asking.
 */
export function theirOpenAsk<A extends DealAsk>(asks: readonly A[], today: string): A | null {
  return (
    [...asks]
      .filter((a) => a.status === 'open' && (a.raisedBy ?? 'host') === 'host' && (a.kind ?? 'counter') === 'counter' && a.amountCentavos != null && !a.moneyHidden)
      .filter((a) => !goodUntilWords(a.goodUntil ?? null, today).expired)
      .sort((a, b) => b.askedAt.localeCompare(a.askedAt))[0] ?? null
  );
}

/** "You are ₱5,000 apart" + "11%" — their total at or above yours is no gap at all (null). */
export function gapWords(yourTotalCentavos: number, theirTotalCentavos: number): { amount: string; percent: string } | null {
  const gap = yourTotalCentavos - theirTotalCentavos;
  if (yourTotalCentavos <= 0 || gap <= 0) return null;
  return { amount: formatCentavosPhp(gap), percent: `${Math.round((gap / yourTotalCentavos) * 100)}%` };
}
