'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { type OpenRail } from '@/lib/payment-channels';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';
import {
  buyVendorPapicPortfolioPack,
  type BuyVendorPapicPortfolioPackState,
} from '../papic/portfolio-pack-actions';
import { formatCount } from '@/lib/format-number';
import { actionButtonClass } from '@/components/action-button';
import { PartCard, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import type { ShopPapicPack } from '@/lib/vendor-papic-credits';

const IDLE: BuyVendorPapicPortfolioPackState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

/**
 * "Papic credits" readout + the pack upsell — beside the shutter's own
 * pointsCap/pointsSpent bar (papic-capture-controller.tsx), which reads the
 * on-the-day CAMERA allowance only. This card reads the wider ONE-METER total
 * (`fetchVendorPapicPortfolioCredits`), which is also spent by the portfolio
 * album below it — so a supplier who has been importing photos sees the same
 * "left" the shutter would show them, not two numbers quietly disagreeing.
 *
 * The buy CTA only renders when `offerPack` is true (owner + Fable, 2026-09-05:
 * the pack is the call-to-action beside a grant UNDER a pack's worth) — a
 * supplier who already holds a pack's worth is not sold to.
 *
 * 🧾 The November look (supplier pages set two, page 8, 21 Nov 2026): a card — "Papic credits" with what is left at
 * its right, then Pack and Pay with as form rows (names and prices from the catalogue, never typed in), then Buy. A
 * balance that could not be read says "Couldn’t load your balance right now." and shows no number — never 0.
 */
export function PortfolioCreditsCard({
  eventId,
  credits,
  left,
  offerPack,
  packs,
  openRails,
}: {
  eventId: string;
  /** Total credits granted so far (booking fee + packs + admin/comp). `null` = unreadable. */
  credits: number | null;
  /** What's left to spend, across both doors (capture + portfolio import). `null` = unlimited. */
  left: number | null;
  offerPack: boolean;
  /** The couple's Papic packs on sale to the shop (2026-11-04); `null`/empty = render "unavailable", never a number. */
  packs: readonly ShopPapicPack[] | null;
  /** openChannels(settings) — the rails the owner has left ON. Empty = payments
   *  paused: the buy form gives way to PaymentsPausedNote (the server action
   *  refuses the same case). */
  openRails: readonly OpenRail[];
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);
  const [packCode, setPackCode] = useState<string | null>(packs?.[0]?.code ?? null);
  const pack = packs?.find((p) => p.code === packCode) ?? null;
  const [channel, setChannel] = useState<string | null>(openRails[0]?.id ?? null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
  }, [state, toast]);

  const rail = openRails.find((r) => r.id === channel) ?? openRails[0] ?? null;

  return (
    <PartCard>
      <section aria-label="Papic credits" data-portfolio-credits-card="">
        <h2 className={setTwo.cardHead}>
          Papic credits
          {credits == null ? null : (
            <span className={setTwo.cardHeadEnd} data-portfolio-credits="">
              {left == null ? `${formatCount(credits)} earned · unlimited to spend` : `${left} left to spend`}
            </span>
          )}
        </h2>
        {credits == null ? (
          <p role="alert" className={setTwo.cardHeadWarn} data-portfolio-credits="unread">
            Couldn’t load your balance right now.
          </p>
        ) : null}

        {offerPack && openRails.length === 0 ? (
          <PaymentsPausedNote />
        ) : offerPack ? (
          <form action={formAction}>
            <input type="hidden" name="event_id" value={eventId} />
            {packs && packs.length > 0 && pack ? (
              <div className={setTwo.fld}>
                <span className={setTwo.fldLabel}>Pack</span>
                <span className="flex min-w-0 flex-1 justify-end">
                  {/* The pack: the couple's three (owner 2026-11-04). One dropdown — PickMenu, never a raw <select>. */}
                  <input type="hidden" name="pack" value={pack.code} />
                  <PickMenu
                    label="Pack"
                    value={pack.code}
                    compact
                    options={packs.map((p) => ({
                      key: p.code,
                      label: `${p.title} · ${formatCount(p.credits)} credits · ${peso(p.pricePhp)}`,
                    }))}
                    onPick={(key) => setPackCode(key)}
                    dataAttr="data-portfolio-credits-pack"
                  />
                </span>
              </div>
            ) : null}
            <div className={setTwo.fld}>
              <span className={setTwo.fldLabel}>Pay with</span>
              <span className="flex min-w-0 flex-1 justify-end">
                {/* Only the rails the owner has left open (lib/payment-channels.ts). One dropdown — PickMenu, never a raw <select>. */}
                <input type="hidden" name="channel" value={rail?.id ?? ''} />
                <PickMenu
                  label="Pay with"
                  value={rail?.id ?? ''}
                  compact
                  options={openRails.map((r) => ({ key: r.id, label: r.label }))}
                  onPick={(key) => setChannel(key)}
                  dataAttr="data-portfolio-credits-channel"
                />
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <SubmitButton
                className={actionButtonClass('brand')}
                pendingLabel="Starting…"
                disabled={!packs || packs.length === 0}
              >
                <ShoppingBag aria-hidden strokeWidth={1.75} />
                <span className="lbl">{!packs || packs.length === 0 ? 'Pack unavailable' : 'Buy'}</span>
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </section>
    </PartCard>
  );
}
