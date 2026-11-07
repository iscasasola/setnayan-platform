'use client';

import { useMemo, useState } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { BuyGiftsSheet } from '@/app/vendor-dashboard/shop/promote/_components/shop-gifts-section';
import { bookingFeePhp } from '@/lib/booking-fee';
import { formatCentavos } from '@/lib/vendor-proposals';
import { GIFT_SHARE_OF_FEE_PCT } from '@/lib/setnayan-gift';
import type { OpenRail } from '@/lib/payment-channels';
import {
  addGiftMenu,
  alwaysAllowedPack,
  giftCount,
  giftPackLine,
  judgeQuoteGifts,
  type ShopGiftQuoteBasis,
} from '@/lib/shop-gifts';

/** Buying from inside the quote — present only where the shop can buy (Papic on, not the App Store shell). */
export type QuoteShopGiftsBuy = { paysGiftPrice: boolean; openRails: OpenRail[] };

const BUY_KEY = '__buy_more_gifts';

/**
 * 🎁 GIFTS FROM YOU — the supplier's own gifts on a quote (owner 2026-11-04, prototype supplier dashboard v59, the quote
 * frame "Gifts from you"). Drawn under the money rows; judged by the SAME `judgeQuoteGifts` the send action re-runs on
 * a fresh read, so what is drawn here is what the server accepts.
 *
 *   This booking's gift limit · 40% of its ₱fee booking fee · <smallest pack> is always allowed      ₱limit
 *   🎁 <pack> · N credits                  (swipe left → Remove, with Undo)
 *   Gifts worth · At the price couples pay: ₱v of ₱limit       — or the over-limit / short line
 *   ＋ Add a gift from your stock ▾        (every pack, each saying why it cannot go on now · Add to your stock…)
 *
 * The block owns no state of its own: the codes are the composer's, sent with the quote (`shopGiftCodes`).
 *
 * 💎 Slice 2 (2026-11-05): Event Plus and Event Pro sit in the same menu, counted from their own stock. On an event that
 * already has Event Plus, an Event Plus line says it makes it Event Pro (owner: "the second event plus will auto
 * upgrade event pro"); on an event that already has Event Pro, neither can be added.
 */
export function QuoteShopGifts({
  basis,
  totalCentavos,
  codes,
  onChange,
  buy = null,
}: {
  basis: ShopGiftQuoteBasis;
  /** The quote's net payable — the figure the fee and the limit are priced from. */
  totalCentavos: number;
  codes: string[];
  onChange: (next: string[]) => void;
  buy?: QuoteShopGiftsBuy | null;
}) {
  const [buying, setBuying] = useState(false);
  const verdict = useMemo(
    () => judgeQuoteGifts(codes, basis.packs, totalCentavos, basis.schedule, basis.free, basis.eventHas, basis.rewardFree ?? null),
    [codes, basis, totalCentavos],
  );
  const menu = useMemo(
    () => addGiftMenu(codes, basis.packs, totalCentavos, basis.schedule, basis.free, basis.eventHas, basis.rewardFree ?? null),
    [codes, basis, totalCentavos],
  );
  const smallest = alwaysAllowedPack(basis.packs);
  const feeCentavos = totalCentavos > 0 ? Math.round(bookingFeePhp(totalCentavos / 100, basis.schedule) * 100) : 0;
  const leftAfter = basis.free === null || verdict.credits === 0 ? null : Math.max(0, basis.free.papic - verdict.credits);
  // The first Event Plus on an event that already has Plus becomes Event Pro — said on that line.
  const firstPlusIndex = codes.findIndex((c) => basis.packs.find((p) => p.code === c)?.kind === 'event_plus');

  const options = [
    ...menu.map((o) => ({ key: o.code, label: o.title, ...(o.ok ? {} : { disabledNote: o.why ?? undefined }) })),
    ...(buy ? [{ key: BUY_KEY, label: 'Add to your stock…' }] : []),
  ];

  return (
    <div data-testid="quote-shop-gifts" className="mt-3 space-y-2">
      <UndoToastHost />
      <InfoTip label="Gifts from you" labelClassName="text-sm font-semibold text-ink" align="start">
        Gifts from your own stock. They leave your stock when the couple&rsquo;s first payment clears, and land on their
        event — Papic credits in its shared credits, Event Plus or Event Pro unlocked on it. A second Event Plus on an
        event that already has one makes it Event Pro. Gifts from your badge rewards are used first and sit outside this
        booking&rsquo;s gift limit.
      </InfoTip>

      <div className="flex items-start justify-between gap-3 text-sm" data-testid="quote-shop-gifts-limit">
        <span className="min-w-0">
          <span className="block text-ink">This booking&rsquo;s gift limit</span>
          <span className="mt-0.5 block text-xs text-ink/60">
            {GIFT_SHARE_OF_FEE_PCT}% of its {formatCentavos(feeCentavos)} booking fee
            {smallest ? ` · ${smallest.title} is always allowed` : ''}
          </span>
        </span>
        <span className="tabular-nums text-ink">{formatCentavos(verdict.limitCentavos)}</span>
      </div>

      {basis.free === null ? (
        <p className="text-xs text-danger-700" role="status" data-testid="quote-shop-gifts-unread">
          Couldn&rsquo;t read your gifts right now — reopen the quote to try again.
        </p>
      ) : null}

      {codes.length > 0 ? (
        <ul className="space-y-1.5">
          {codes.map((code, i) => {
            const pack = basis.packs.find((p) => p.code === code);
            const title = pack?.title ?? code;
            return (
              <SwipeToDelete
                key={`${code}-${i}`}
                as="li"
                label={`Remove ${title}`}
                word="Remove"
                radiusClass="rounded-lg"
                onDelete={() => {
                  const before = codes;
                  deleteWithUndo({
                    label: `“${title}” taken off this quote`,
                    hide: () => onChange(before.filter((_, j) => j !== i)),
                    restore: () => onChange(before),
                    commit: () => undefined, // nothing was written — the quote is not sent yet
                  });
                }}
              >
                <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm" data-testid="quote-shop-gift-line">
                  <span className="min-w-0">
                    <span className="block text-ink">🎁 {title}</span>
                    <span className="mt-0.5 block text-xs text-ink/60">
                      {!pack
                        ? 'Not on sale any more'
                        : pack.kind === 'event_plus' && basis.eventHas === 'plus' && i === firstPlusIndex
                          ? 'They already have Event Plus — this makes it Event Pro'
                          : giftPackLine(pack)}
                      {pack && verdict.fromReward[i] ? (
                        <span className="font-medium text-success-700" data-testid="quote-shop-gift-reward">
                          {' '}
                          · Badge reward
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
              </SwipeToDelete>
            );
          })}
        </ul>
      ) : null}

      {verdict.state === 'ok' ? (
        <p className="text-xs text-ink/60" data-testid="quote-shop-gifts-worth">
          Gifts worth {formatCentavos(verdict.valueCentavos)} at the price couples pay
          {verdict.rewardCentavos > 0 ? ` · ${formatCentavos(verdict.rewardCentavos)} from badge rewards, outside the limit` : ''}
          {verdict.alwaysAllowed ? '' : ` · of ${formatCentavos(verdict.limitCentavos)}`}
          {leftAfter !== null ? ` · ${giftCount(leftAfter)} credits left in your stock after` : ''}
        </p>
      ) : verdict.state === 'over_limit' ? (
        <p className="text-xs text-danger-700" role="status" data-testid="quote-shop-gifts-over">
          <b className="font-semibold">
            Gifts worth {formatCentavos(verdict.valueCentavos - verdict.rewardCentavos)}
            {verdict.rewardCentavos > 0 ? ' (not counting badge rewards)' : ''} · over the{' '}
            {formatCentavos(verdict.limitCentavos)} limit.
          </b>{' '}
          Not on this quote until it fits — remove a gift or raise the booking.
        </p>
      ) : verdict.state === 'short' ? (
        <p className="text-xs text-danger-700" role="status" data-testid="quote-shop-gifts-short">
          <b className="font-semibold">
            Not on this quote · short {giftCount(verdict.shortBy)}{' '}
            {verdict.shortKind === 'papic' || !verdict.shortKind
              ? 'credits'
              : (basis.packs.find((p) => p.kind === verdict.shortKind)?.title ?? 'gifts')}
            .
          </b>{' '}
          Remove a gift, or add to your stock first.
        </p>
      ) : verdict.state === 'already_has' ? (
        <p className="text-xs text-danger-700" role="status" data-testid="quote-shop-gifts-already">
          <b className="font-semibold">Their event already has Event Pro.</b> Take Event Plus and Event Pro off this quote.
        </p>
      ) : verdict.state === 'unknown_pack' ? (
        <p className="text-xs text-danger-700" role="status">
          One of these gifts is not on sale any more — remove it.
        </p>
      ) : null}

      <PickMenu
        label="Add a gift from your stock"
        value={null}
        buttonText="＋ Add a gift from your stock"
        compact
        className="!min-h-11"
        options={options}
        onPick={(key) => {
          if (key === BUY_KEY) setBuying(true);
          else onChange([...codes, key]);
        }}
        dataAttr="data-quote-shop-gifts-add"
      />

      {buy ? (
        <BuyGiftsSheet
          open={buying}
          onClose={() => setBuying(false)}
          packs={basis.packs}
          paysGiftPrice={buy.paysGiftPrice}
          openRails={buy.openRails}
        />
      ) : null}
    </div>
  );
}
