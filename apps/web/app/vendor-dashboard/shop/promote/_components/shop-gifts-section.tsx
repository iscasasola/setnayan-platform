'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Award, Gift, ShoppingBag, Sparkles, Ticket } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { Counter } from '@/app/_components/counter';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import type { OpenRail } from '@/lib/payment-channels';
import {
  SHOP_GIFT_MAX_QUANTITY,
  giftCount,
  giftUnitPrice,
  stockSubline,
  type FreeByKind,
  type ShopGiftKind,
  type ShopGiftPack,
  type ShopGiftStocks,
} from '@/lib/shop-gifts';
import {
  FREE_FEE_SUBLINE,
  FREE_FEE_TITLE,
  freeFeeSummary,
  rewardSourceWords,
  rewardWords,
  type GrantedReward,
  type RewardNames,
} from '@/lib/badge-rewards';
import {
  buyVendorPapicPortfolioPack,
  type BuyVendorPapicPortfolioPackState,
} from '@/app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions';

/** One row of the "Bought" list (`fetchShopGiftBought`), as the screen needs it. */
export type ShopGiftBoughtLine = {
  orderId: string;
  title: string;
  kind?: ShopGiftKind;
  quantity: number;
  paidPhp: number;
  createdAt: string;
  state: 'in_stock' | 'checking' | 'refunded';
};

export type ShopGiftsSectionData = {
  /** null ⇒ the stock could not be read — no Buy is offered against a number nobody read. */
  stock: ShopGiftStocks | null;
  /** null ⇒ the catalogue could not be read; [] ⇒ nothing on sale. */
  packs: ShopGiftPack[] | null;
  /** Verified-and-up pays the catalogue's gift price (`vendor_pays_gift_price`). */
  paysGiftPrice: boolean;
  /** null ⇒ the purchases could not be read. */
  bought: ShopGiftBoughtLine[] | null;
  openRails: OpenRail[];
  /** Papic on, and not inside the App Store shell (supplier purchases stay on the web). */
  canBuy: boolean;
  /**
   * 🏅 Badge rewards (owner 2026-11-05) — what each badge gave, kept in this same stock and marked "Badge reward", plus
   * the free booking fee. Absent ⇒ the section reads as before. `granted: null` ⇒ could not be read (never "none").
   */
  rewards?: {
    /** What is left of each kind's badge-reward stock (`rewardFreeByKind`). Null ⇒ unread. */
    left: FreeByKind | null;
    granted: GrantedReward[] | null;
    names: RewardNames;
  };
};

const IDLE: BuyVendorPapicPortfolioPackState = { status: 'idle' };
const ic = <Gift aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const icUnlock = <Sparkles aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const icFee = <Ticket aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const icReward = <Award aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

/**
 * The "🏅 300" chip on a stock row when some of it is badge reward — the mark that tells it apart from bought stock,
 * kept short so the row's own line still fits a phone (the ⓘ says what 🏅 means; the Badge rewards fold lists each).
 */
function rewardChip(left: FreeByKind | null | undefined, k: ShopGiftKind): { tone: 'ok'; word: string } | null {
  const n = left?.[k] ?? 0;
  return n > 0 ? { tone: 'ok', word: `🏅 ${giftCount(n)}` } : null;
}

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

const STATE_WORD: Record<ShopGiftBoughtLine['state'], string | null> = {
  in_stock: null,
  checking: 'Checking',
  refunded: 'Refunded',
};

/**
 * 🎁 YOUR GIFTS — the supplier's gift stock (owner 2026-11-04, prototype supplier dashboard v59 "Your gifts").
 *
 *   Your gifts ⓘ                      (title; everything else in the ⓘ)
 *   Papic credits · N free to offer · M on sent quotes          [balance]
 *   Event Plus · Event Pro — the same row, as COUNTS (slice 2, 2026-11-05), each once it is on sale or in stock
 *   [Buy gifts]                        → the Buy sheet: Gift ▾ · How many − n + · Total · Pay with ▾ · Pay ₱X
 *   Bought ▾                           qty × title · date · ₱ (Checking / Refunded when so)
 *   the quiet line                     where gifts go, in one sentence
 *
 * 📣 HOME: Shop › Promote (owner 2026-11-05, "one Promote place for every marketing tool") — moved here from the Plan page
 * unchanged; its reads moved with it (`shop-gifts-data.ts`). `#gifts` is its address (the pinned row's gifts figure).
 *
 * Presentational: every value arrives read. The ONE write is the shipped buy action (`for=gift`), which mints the order
 * and its quantity; the stock moves only when the payment is approved (`grantShopGiftPurchase`).
 */
export function ShopGiftsSection({ data }: { data: ShopGiftsSectionData }) {
  const [buying, setBuying] = useState(false);
  const headingId = useId();
  const { stock, bought } = data;
  const packs = data.packs ?? [];
  const canOffer = data.canBuy && stock !== null && packs.length > 0;
  const rewards = data.rewards;
  const granted = rewards?.granted ?? null;
  const fee = granted ? freeFeeSummary(granted) : null;
  const stockRewards = granted?.filter((g) => g.kind !== 'fee_waiver') ?? [];

  return (
    <section id="gifts" className="mt-8 scroll-mt-24" data-shop-gifts="" aria-labelledby={headingId}>
      <InfoTip label="Your gifts" labelAs="h2" labelClassName="sn-sec" labelId={headingId} align="start">
        Bought ahead, for your couples. Put them on a quote; they leave your stock only when that couple&rsquo;s first
        payment clears, and land on their event. Never cashed out. Every badge you earn adds its reward here too, marked
        Badge reward (🏅 on a row is how much of it is): it never expires and sits outside a booking&rsquo;s gift limit. A free booking fee is used by
        itself on your next booking that would carry a fee.
      </InfoTip>

      <div className="mt-2">
        <DatesRow
          data="shop-gifts-papic"
          lead={ic}
          title="Papic credits"
          line={stockSubline(stock?.papic ?? null)}
          strong={stock ? formatCount(stock.papic.balance) : null}
          badge={stock ? rewardChip(rewards?.left, 'papic') : null}
        />
        {(['event_plus', 'event_pro', 'event_ultra'] as const).map((k) => {
          const pack = packs.find((p) => p.kind === k);
          const s = stock?.[k] ?? null;
          // A count is shown once the product is on sale or the shop holds some — never a row for nothing.
          if (!pack && !(s && (s.balance !== 0 || s.held > 0))) return null;
          return (
            <DatesRow
              key={k}
              data={`shop-gifts-${k.replace('_', '-')}`}
              lead={icUnlock}
              title={pack?.title ?? (k === 'event_plus' ? 'Event Plus' : k === 'event_ultra' ? 'Event Ultra' : 'Event Pro')}
              line={stockSubline(s)}
              strong={stock ? formatCount(s?.balance ?? 0) : null}
              badge={stock ? rewardChip(rewards?.left, k) : null}
            />
          );
        })}

        {rewards ? (
          <DatesRow
            data="shop-gifts-free-fee"
            lead={icFee}
            title={FREE_FEE_TITLE}
            line={fee === null ? 'Couldn’t read your badge rewards right now' : FREE_FEE_SUBLINE}
            strong={fee ? formatCount(fee.waiting) : null}
          />
        ) : null}

        {canOffer ? (
          <div className="mt-3">
            <ActionButton
              tone="brand"
              main
              icon={ShoppingBag}
              label="Buy gifts"
              onClick={() => setBuying(true)}
              aria-haspopup="dialog"
              data-testid="shop-gifts-buy"
            />
          </div>
        ) : data.canBuy && data.packs !== null && packs.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-ink/60" role="status">
            Gifts are not on sale right now.
          </p>
        ) : null}

        {/* 🎁 NEXT EVENT WITH US (prototype 6 Nov § 6, "one new row") — what a couple who booked you gets when they book
            you again. NOTHING CAN BE SET YET (coordinator, 6 Nov: show the state honestly, invent no gift): there is no
            offer store and no claim on a later booking, so the row says so instead of opening a sheet that saves
            nowhere. The host thank-you (§ 3) draws no offer block for the same reason. */}
        <div className="mt-3" data-shop-gifts-next-event="">
          <DatesRow
            data="shop-gifts-next-event"
            lead={ic}
            title="Next event with us"
            line="Not set · can’t be set here yet"
          />
        </div>

        <div className="mt-3 border-t border-ink/10" data-plan-fold="gifts-bought">
          <Fold
            title="Bought"
            line={bought === null ? 'Couldn’t load — nothing is lost' : bought.length > 0 ? `${formatCount(bought.length)}` : 'None yet'}
            data="shop-gifts-bought"
          >
            <div className="pb-3">
              {bought === null ? (
                <p className="py-2 text-[13.5px] text-ink/70" role="status">
                  Your gift purchases couldn&rsquo;t load. Reload to try again — nothing you bought has changed.
                </p>
              ) : bought.length === 0 ? (
                <p className="py-2 text-[13.5px] text-ink/60">Nothing bought yet.</p>
              ) : (
                bought.map((b) => {
                  const word = STATE_WORD[b.state];
                  return (
                    <DatesRow
                      key={b.orderId}
                      data="shop-gifts-bought-row"
                      title={`${formatCount(b.quantity)} × ${b.title}`}
                      line={`${day(b.createdAt)} · ${formatPhp(b.paidPhp)}`}
                      badge={word ? { tone: 'quiet', word } : null}
                    />
                  );
                })
              )}
            </div>
          </Fold>
        </div>

        {rewards ? (
          <div className="border-t border-ink/10" data-plan-fold="gifts-badge-rewards">
            <Fold
              title="Badge rewards"
              line={granted === null ? 'Couldn’t load — nothing is lost' : granted.length > 0 ? `${formatCount(granted.length)}` : 'None yet'}
              data="shop-gifts-badge-rewards"
            >
              <div className="pb-3">
                {granted === null ? (
                  <p className="py-2 text-[13.5px] text-ink/70" role="status">
                    Your badge rewards couldn&rsquo;t load. Reload to try again — nothing you earned has changed.
                  </p>
                ) : granted.length === 0 ? (
                  <p className="py-2 text-[13.5px] text-ink/60">Each badge you earn adds a gift here for your next couples.</p>
                ) : (
                  <>
                    {stockRewards.map((g) => (
                      <DatesRow
                        key={g.rewardId}
                        data="shop-gifts-badge-reward-row"
                        lead={icReward}
                        title={rewardWords({ kind: g.kind, units: g.units }, rewards.names)}
                        line={`${day(g.grantedAt)} · ${rewardSourceWords(g.key)}`}
                        badge={{ tone: 'ok', word: 'Badge reward' }}
                      />
                    ))}
                    {fee?.history.map((h) => (
                      <DatesRow
                        key={h.rewardId}
                        data="shop-gifts-free-fee-row"
                        lead={icFee}
                        title={<span aria-label={h.sentence}>{h.title}</span>}
                        line={h.line}
                        badge={{ tone: h.state === 'waiting' ? 'ok' : 'quiet', word: h.state === 'used' ? 'Used' : h.state === 'revoked' ? 'Taken back' : 'Waiting' }}
                      />
                    ))}
                  </>
                )}
              </div>
            </Fold>
          </div>
        ) : null}

        <p className="mt-2 text-[13px] text-ink/55">
          You give them on a quote — they come out of here when the couple&rsquo;s first payment clears.
        </p>
      </div>

      {canOffer ? (
        <BuyGiftsSheet
          open={buying}
          onClose={() => setBuying(false)}
          packs={packs}
          paysGiftPrice={data.paysGiftPrice}
          openRails={data.openRails}
        />
      ) : null}
    </section>
  );
}

/** The Buy sheet — the shipped pack-buy pair (Pack ▾ · Pay with ▾ · Submit) plus "How many". */
export function BuyGiftsSheet({
  open,
  onClose,
  packs,
  paysGiftPrice,
  openRails,
  initialCode,
}: {
  open: boolean;
  onClose: () => void;
  packs: ShopGiftPack[];
  paysGiftPrice: boolean;
  openRails: OpenRail[];
  initialCode?: string | null;
}) {
  const headingId = useId();
  const toast = useToast();
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);
  const [code, setCode] = useState<string | null>(initialCode ?? packs[0]?.code ?? null);
  const [qty, setQty] = useState(1);
  const [rail, setRail] = useState<string | null>(openRails[0]?.id ?? null);
  const pack = packs.find((p) => p.code === code) ?? packs[0] ?? null;

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
  }, [state, toast]);

  if (!pack) return null;
  const unit = giftUnitPrice(pack, paysGiftPrice);
  const totalPhp = (unit.centavos * qty) / 100;
  const srpTotalPhp = (pack.srpCentavos * qty) / 100;

  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5" data-shop-gifts-sheet="">
        <h2 id={headingId} className="pr-12 text-[18px] font-semibold text-ink">
          Buy gifts
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">Lands in your gifts when the payment is approved.</p>

        {openRails.length === 0 ? (
          <PaymentsPausedNote className="mt-4" />
        ) : (
          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="for" value="gift" />
            <input type="hidden" name="pack" value={pack.code} />
            <input type="hidden" name="quantity" value={qty} />
            <input type="hidden" name="channel" value={rail ?? ''} />

            <PickMenu
              label="Gift"
              value={pack.code}
              className="!min-h-11 w-full"
              options={packs.map((p) => ({
                key: p.code,
                label: `${p.title} · ${formatPhp(giftUnitPrice(p, paysGiftPrice).centavos / 100)} each`,
              }))}
              onPick={(key) => setCode(key)}
              dataAttr="data-shop-gifts-pack"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-ink">How many</span>
              <Counter
                value={qty}
                label="How many to buy"
                onLess={() => setQty((n) => Math.max(1, n - 1))}
                onMore={() => setQty((n) => Math.min(SHOP_GIFT_MAX_QUANTITY, n + 1))}
                lessDisabled={qty <= 1}
                moreDisabled={qty >= SHOP_GIFT_MAX_QUANTITY}
                lessLabel={qty <= 1 ? 'One is the least you can buy' : 'One less'}
                moreLabel={qty >= SHOP_GIFT_MAX_QUANTITY ? `${SHOP_GIFT_MAX_QUANTITY} is the most in one order` : 'One more'}
                data="shop-gifts-qty"
              />
            </div>

            <div className="space-y-1 border-t border-ink/10 pt-3 text-[14px]" data-shop-gifts-sum="">
              <p className="flex justify-between">
                <span className="text-ink/70">You get</span>
                <span className="tabular-nums">
                  {pack.kind === 'papic' ? `${formatCount(pack.credits * qty)} credits` : `${formatCount(qty)} × ${pack.title}`}
                </span>
              </p>
              {unit.basis === 'gift' ? (
                <p className="flex justify-between" data-shop-gifts-srp="">
                  <span className="text-ink/70">Price couples pay</span>
                  <s className="tabular-nums text-ink/50">{formatPhp(srpTotalPhp)}</s>
                </p>
              ) : null}
              <p className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums" data-shop-gifts-total="">
                  {formatPhp(totalPhp)}
                </span>
              </p>
            </div>

            <PickMenu
              label="Pay with"
              value={rail}
              className="!min-h-11 w-full"
              options={openRails.map((r) => ({ key: r.id, label: r.label }))}
              onPick={(key) => setRail(key)}
              dataAttr="data-shop-gifts-rail"
            />

            <SupplierSubmit
              tone="brand"
              main
              icon={<ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
              label={`Pay ${formatPhp(totalPhp)}`}
              pendingLabel="Starting…"
              className="w-full"
            />
          </form>
        )}
      </div>
    </Sheet>
  );
}
