/**
 * 💰 MONEY'S THREE FIGURES — Received · To come in · Overdue, on Customers' pinned row (supplier dashboard v13, APPROVED
 * 2026-10-29, prototype `custMoney()` tiles; DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE
 * PINNED ROW ON SCROLL": *"like on money, they get the overdue to comin and received as a sompressed pinned row"*).
 *
 * 🔑 A PLAIN MODULE, PURE — every figure is the page's ONE money picture (`moneyPicture`, `lib/vendor-money.ts`), worded
 * the way Today words its "to come in" (`formatPesoCompact`). It sums nothing itself.
 * HONEST: a payday read that fell short (`totals === null`) draws every figure "—", never ₱0 (`reads-are-honest`).
 * Each figure is a door to where its rows are: Received → This year; To come in and Overdue → every payment still to
 * come in (overdue ones first — the picture's own order).
 */
import { formatCount } from '@/lib/format-number';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import type { MoneyTotals } from '@/lib/vendor-money';
import type { CustomersFigure } from './_components/customers-figures';

const HUB = '/vendor-dashboard/customers';

export function moneyFiguresOf(totals: MoneyTotals | null): CustomersFigure[] {
  const all = `${HUB}?seg=money&next=all#money-rows`;
  return [
    { key: 'received', value: totals ? formatPesoCompact(Math.round(totals.receivedPhp * 100)) : null, word: 'received', href: `${HUB}?seg=money#money-year` },
    { key: 'to-come', value: totals ? formatPesoCompact(Math.round(totals.toComePhp * 100)) : null, word: 'to come in', short: 'to come', href: all },
    { key: 'overdue', value: totals ? formatCount(totals.overdue) : null, word: 'overdue', hot: Boolean(totals && totals.overdue > 0), href: all },
  ];
}
