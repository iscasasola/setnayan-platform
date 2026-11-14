import { Gift } from 'lucide-react';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { formatCount } from '@/lib/format-number';
import type { ShopGiftHoldRow, ShopGiftLedgerRow } from '@/lib/shop-gifts.server';

/** The gift a row moved: "1,000 credits" for Papic, "1 Event Plus" for an unlock (slice 2). */
const giftWord = (kind: ShopGiftLedgerRow['giftKind'], n: number) =>
  kind === 'papic'
    ? `${formatCount(n)} credits`
    : `${formatCount(n)} ${kind === 'event_plus' ? 'Event Plus' : kind === 'event_ultra' ? 'Event Ultra' : 'Event Pro'}`;

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/**
 * 🎁 ADMIN › GIFTS & COMPS › SUPPLIER GIFTS (owner 2026-11-04) — every credit a shop bought, gave or had reversed, and
 * what live quotes still promise. Read-only: the money moves through the order (approve / refund on Orders) and the one
 * delivery door. 💎 Event Plus / Event Pro rows (slice 2) count units; a given one names what the event received (a
 * second Plus becomes Event Pro). Presentational — the page reads; `/dev/supplier-plan-lab?s=gifts-admin` mounts the same component.
 */
export function ShopGiftsLedger({
  ledger,
  ledgerError,
  holds,
  holdsError,
  giftLimitPct,
}: {
  ledger: ShopGiftLedgerRow[] | null;
  ledgerError: { message: string } | null;
  holds: ShopGiftHoldRow[] | null;
  holdsError: { message: string } | null;
  /** The live gift limit (`getGiftLimitPct`) — the same setting this page edits. Never typed. */
  giftLimitPct: number;
}) {
  return (
    <section className="mb-10" data-admin-shop-gifts="">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">Supplier gifts</h2>
      <p className="mb-4 text-xs text-ink/60">
        A shop&rsquo;s gifts on one booking are capped at {giftLimitPct}% of that booking&rsquo;s fee, at the
        price couples pay — the same share as the Setnayan gift. The smallest Papic pack is always allowed. Gift prices
        are the catalogue&rsquo;s.
      </p>

      <ConsoleTable<ShopGiftLedgerRow>
        rows={ledger}
        readError={ledgerError}
        readPermitted
        reads="the supplier gift ledger"
        label="Supplier gift ledger"
        cap={200}
        minWidth="36rem"
        rowKey={(r) => r.entryId}
        empty={{
          Icon: Gift,
          title: 'No supplier has bought gifts yet',
          blurb: 'A purchase lands here once its payment is approved on Orders.',
        }}
        columns={[
          { header: 'When', mono: true, cell: (r) => fmtDay(r.createdAt) },
          { header: 'Shop', cell: (r) => r.shopName ?? r.vendorProfileId },
          {
            header: 'What',
            cell: (r) =>
              r.kind === 'bought'
                ? `Bought${r.orderReference ? ` · ${r.orderReference}` : ''}`
                : r.kind === 'given'
                  ? `Given to ${r.eventName ?? 'an event'}${
                      r.giftKind === 'event_plus' && r.unlocksSku === 'COUPLE_WEBSITE_PRO'
                        ? ' · their second Plus, so Event Pro'
                        : ''
                    }${r.landed ? '' : r.giftKind === 'papic' ? ' · not in the pool' : ' · not unlocked'}`
                  : r.kind === 'badge_reward'
                    ? r.note?.trim() || 'Badge reward'
                    : `Reversed${r.orderReference ? ` · ${r.orderReference}` : ''}`,
          },
          {
            header: 'Gift',
            mono: true,
            align: 'right',
            cell: (r) => `${r.delta > 0 ? '+' : '−'}${giftWord(r.giftKind, Math.abs(r.delta))}`,
          },
        ]}
      />

      <h3 className="mb-2 mt-6 text-xs font-medium text-ink/60">On quotes, not given yet</h3>
      <ConsoleTable<ShopGiftHoldRow>
        rows={holds}
        readError={holdsError}
        readPermitted
        reads="the gift lines on live quotes"
        label="Gifts on live quotes"
        cap={100}
        rowKey={(h) => h.proposalId}
        empty={{
          Icon: Gift,
          title: 'No live quote carries a supplier gift',
          blurb: 'A gift on a sent or accepted quote shows here until the couple’s first payment clears.',
        }}
        columns={[
          { header: 'Shop', cell: (h) => h.shopName ?? '—' },
          { header: 'Event', cell: (h) => h.eventName ?? '—' },
          { header: 'Quote', cell: (h) => (h.status === 'accepted' ? 'Accepted' : 'Sent') },
          {
            header: 'Gifts',
            mono: true,
            align: 'right',
            cell: (h) =>
              [
                h.credits > 0 ? giftWord('papic', h.credits) : null,
                h.plus > 0 ? giftWord('event_plus', h.plus) : null,
                h.pro > 0 ? giftWord('event_pro', h.pro) : null,
                h.ultra > 0 ? giftWord('event_ultra', h.ultra) : null,
              ]
                .filter(Boolean)
                .join(' · '),
          },
        ]}
      />
    </section>
  );
}
