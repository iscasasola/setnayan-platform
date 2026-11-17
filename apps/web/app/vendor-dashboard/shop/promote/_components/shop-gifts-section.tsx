'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Award, Gift, ShoppingBag, Ticket } from 'lucide-react';
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
  bundleFreePacks,
  SHOP_GIFT_UNLOCK_KINDS,
  freeCredits,
  giftCount,
  shopGiftBuyable,
  type FreeByKind,
  type ShopGiftBundle,
  type ShopGiftKind,
  type ShopGiftPack,
  type ShopGiftStock,
  type ShopGiftStocks,
} from '@/lib/shop-gifts';
import { bump, canAdd, type GiftCart } from '@/lib/shop-gift-cart';
import type { GiftHistoryRow } from '@/lib/shop-gift-history';
import { GiftHistory, GiftStore, GiftTicketSheet } from './gift-store';
import { GiftTicketArt } from './gift-ticket-art';
import { GIFT_PAYMENT_SENT, bundleShape } from './gift-store-copy';
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
  /** 📦 Packs this order landed — a bundle lands its whole count. Absent ⇒ `quantity`. */
  packs?: number;
  /** 📦 "Buy 10, get 1 free" on a bundle order. */
  bundleNote?: string | null;
  createdAt: string;
  state: 'in_stock' | 'checking' | 'refunded';
};

export type ShopGiftsSectionData = {
  /** null ⇒ the stock could not be read — no Buy is offered against a number nobody read. */
  stock: ShopGiftStocks | null;
  /** null ⇒ the catalogue could not be read; [] ⇒ nothing on sale. */
  packs: ShopGiftPack[] | null;
  /**
   * 📦 BUY 10, GET 1 FREE bundles on sale (owner 2026-11-14), from the catalogue. Every shop may buy them. [] ⇒ none on
   * sale or unread — the singles stay on sale either way. ONE price per single gift: its list price.
   */
  bundles: ShopGiftBundle[];
  /**
   * 🧾 Transaction history (prototype v16, 2026-11-17): bought orders and gifts given, newest first
   * (`fetchShopGiftHistory`). null ⇒ could not be read — never "nothing bought".
   */
  history: GiftHistoryRow[] | null;
  /** 🚚 Tickets a SENT payment will land once approved, per gift code ("+N on the way"). */
  onTheWay: Readonly<Record<string, number>>;
  /** 🎁 Every ticket given to a couple's event. null ⇒ could not be read. */
  givenTotal: number | null;
  /** 💳 The most in one payment — the admin setting (`getMaxPaymentPhp`), never typed here. */
  maxPaymentPhp: number;
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
const icFee = <Ticket aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const icReward = <Award aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const ic = <Gift aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

/** A plan's name when its catalogue row could not be read — the catalogue's own titles. */
const UNLOCK_FALLBACK_TITLE: Readonly<Record<(typeof SHOP_GIFT_UNLOCK_KINDS)[number], string>> = {
  event_plus: 'Event Plus',
  event_pro: 'Event Pro',
  event_ultra: 'Event Ultra',
};

/** One ticket in "Available": a gift on sale, or one the shop still holds that is no longer on sale. */
type Tile = { pack: ShopGiftPack; onSale: boolean; stock: ShopGiftStock | null; smallestPapic: boolean };

/**
 * The tickets, in the store's order: every Papic pack (smallest first) then Event Plus / Pro / Ultra — each on sale or
 * held. A gift neither on sale nor held draws no ticket (never a tile for nothing).
 */
function tiles(packs: readonly ShopGiftPack[], stock: ShopGiftStocks | null): Tile[] {
  const out: Tile[] = [];
  const papic = packs.filter((p) => p.kind === 'papic');
  papic.forEach((p, i) => out.push({ pack: p, onSale: true, stock: stock ? (stock.packs[p.code] ?? { balance: 0, held: 0 }) : null, smallestPapic: i === 0 }));
  for (const [code, st] of Object.entries(stock?.packs ?? {})) {
    if (out.some((t) => t.pack.code === code) || (st.balance === 0 && st.held === 0)) continue;
    // Held but off sale: its title is its code (the catalogue no longer names it); 1 credit so the Papic ticket prints.
    out.push({ pack: { code, title: code, kind: 'papic', credits: 1, srpCentavos: 0 }, onSale: false, stock: st, smallestPapic: false });
  }
  for (const k of SHOP_GIFT_UNLOCK_KINDS) {
    const pack = packs.find((p) => p.kind === k);
    const st = stock?.[k] ?? null;
    if (!pack && !(st && (st.balance !== 0 || st.held > 0))) continue;
    out.push({
      pack: pack ?? { code: k, title: UNLOCK_FALLBACK_TITLE[k], kind: k, credits: 1, srpCentavos: 0 },
      onSale: !!pack,
      stock: stock ? (st ?? { balance: 0, held: 0 }) : null,
      smallestPapic: false,
    });
  }
  return out;
}

const HISTORY_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/**
 * 🎁 YOUR GIFTS — the supplier's gift stock and its STORE (owner-approved prototype `gifts-interactive` v16, 2026-11-17,
 * "build it"; first drawn as prototype supplier dashboard v59 "Your gifts", 2026-11-04).
 *
 *   Your gifts ⓘ
 *   [ Total · Available · Held · Given · ⟲ History ]   one card, five cells (Total = available + held)
 *   ✓ Payment sent. We're checking it. …              while a sent payment waits for approval
 *   Available                                          (no count chip)
 *   ticket ticket                                      two per row: the ticket, "N available", "M held on a quote",
 *   ticket ticket                                      "+N on the way" — tap one → its sheet (Add 1 · Add 10 + 1)
 *   [Buy more]                                         → the store (singles − n +, then 10 + 1 bundles; one order)
 *   Free booking fee · Next event with us · Badge rewards ▾ · the quiet line — unchanged from the shipped section
 *
 * ⟲ History is its own screen (‹ Your gifts): bought orders (Waiting for approval / In your gifts) and gifts given. It
 * replaces the old "Bought" fold and carries every row that fold had.
 *
 * 📣 HOME: Shop › Promote (owner 2026-11-05) — `#gifts` is its address. Presentational: every value arrives read. The
 * ONE write is the shipped buy action: `for=gift_cart` (the store) or `for=gift` (the quote's Buy sheet), which mints the
 * order; the stock moves only when an ADMIN approves the payment (`lib/sku-activation.ts`).
 */
export function ShopGiftsSection({ data }: { data: ShopGiftsSectionData }) {
  const headingId = useId();
  const { stock, history } = data;
  const packs = data.packs ?? [];
  // 💎 Every gift is in the store — Event Ultra too, at its list price (owner 2026-11-17).
  const buyPacks = packs.filter((p) => shopGiftBuyable(p.code));
  const canOffer = data.canBuy && stock !== null && buyPacks.length > 0;
  const rewards = data.rewards;
  const granted = rewards?.granted ?? null;
  const fee = granted ? freeFeeSummary(granted) : null;
  const stockRewards = granted?.filter((g) => g.kind !== 'fee_waiver') ?? [];

  const [cart, setCart] = useState<GiftCart>({});
  const [view, setView] = useState<'store' | 'history' | null>(null);
  const [sheetCode, setSheetCode] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ code: string; n: number } | null>(null);
  const [toast, setToast] = useState<{ label: string; n: number; key: number } | null>(null);

  const list = tiles(packs, stock);
  const free = (t: Tile) => (t.stock ? freeCredits(t.stock) ?? 0 : null);
  const totals = stock
    ? list.reduce((acc, t) => ({ available: acc.available + (free(t) ?? 0), held: acc.held + (t.stock?.held ?? 0) }), { available: 0, held: 0 })
    : null;
  const sent = (history ?? []).some((r) => r.kind === 'bought' && r.state === 'sent');
  const sheetTile = list.find((t) => t.pack.code === sheetCode) ?? null;
  const bundleOf = (code: string) => data.bundles.find((b) => b.pack.code === code) ?? null;

  /** Add from a ticket's sheet: into the order, then the store opens on THAT row (prototype v16 — no "Just added" box). */
  const addFromSheet = (code: string) => {
    if (canAdd(cart, code, buyPacks, data.bundles, data.maxPaymentPhp) !== 'ok') return;
    const next = bump(cart, code, 1);
    setCart(next);
    const b = data.bundles.find((x) => x.code === code);
    const title = b ? `${b.pack.title} · ${bundleShape(b).label}` : (buyPacks.find((p) => p.code === code)?.title ?? code);
    const n = next[code] ?? 0;
    setSheetCode(null);
    setFlash({ code, n });
    setToast({ label: title, n, key: Date.now() });
    setView('store');
  };

  const cell = (n: number | null, word: string, dataName: string) => (
    <div className="grid min-h-16 content-center justify-items-center gap-0.5 px-0.5 py-3 text-center" data-gift-stat={dataName}>
      <b className="text-[20px] leading-tight text-ink tabular-nums">{n === null ? '—' : formatCount(n)}</b>
      <span className="text-[11.5px] text-ink/60">{word}</span>
    </div>
  );

  return (
    <section id="gifts" className="mt-8 scroll-mt-24" data-shop-gifts="" aria-labelledby={headingId}>
      <InfoTip label="Your gifts" labelAs="h2" labelClassName="sn-sec" labelId={headingId} align="start">
        Bought ahead, for your couples. Put them on a quote; they leave your stock only when that couple&rsquo;s first
        payment clears, and land on their event. Never cashed out. Every badge you earn adds its reward here too, marked
        Badge reward (🏅 on a ticket is how much of it is): it never expires and sits outside a booking&rsquo;s gift limit. A free booking fee is used by
        itself on your next booking that would carry a fee.
      </InfoTip>

      <div className="mt-2">
        {/* 🔢 One card, five cells (prototype v16): Total (available + held) · Available · Held · Given · History. */}
        <div
          className="grid grid-cols-5 divide-x divide-ink/[0.08] rounded-2xl bg-white shadow-[0_2px_10px_-6px_rgba(16,27,48,0.3)]"
          data-gift-stats=""
        >
          {cell(totals ? totals.available + totals.held : null, 'Total', 'total')}
          {cell(totals ? totals.available : null, 'Available', 'available')}
          {cell(totals ? totals.held : null, 'Held', 'held')}
          {cell(data.givenTotal, 'Given', 'given')}
          <button
            type="button"
            onClick={() => setView('history')}
            aria-label="Transaction history"
            className="sn-press grid min-h-16 content-center justify-items-center gap-0.5 px-0.5 py-3 text-sn-accent"
            data-testid="shop-gifts-history"
          >
            {HISTORY_ICON}
            <span className="text-[11.5px] font-semibold">History</span>
          </button>
        </div>
        {stock === null ? (
          <p className="mt-2 text-[13.5px] text-ink/70" role="status">
            Couldn&rsquo;t read your gifts right now. Reload to try again — nothing has changed.
          </p>
        ) : null}

        {sent ? (
          <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-sn-accent bg-white px-3.5 py-3 text-[14px] text-ink" role="status" data-gift-payment-sent="">
            <span aria-hidden className="text-success-700">✓</span>
            <span>
              <b>{GIFT_PAYMENT_SENT.lead}</b>
              {GIFT_PAYMENT_SENT.rest}
            </span>
          </div>
        ) : null}

        <p className="mt-4 text-[17px] font-bold text-ink">Available</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5" data-gift-tiles="">
          {list.map((t) => {
            const n = free(t);
            const chip = t.smallestPapic || t.pack.kind !== 'papic' ? rewardChipOf(rewards?.left, t.pack) : null;
            const onWay = data.onTheWay[t.pack.code] ?? 0;
            const tappable = t.onSale;
            const inner = (
              <>
                <GiftTicketArt pack={t.pack} className={`mx-auto h-auto w-full ${n === 0 ? 'opacity-55 grayscale-[35%]' : ''}`} />
                <div className="mt-0.5 flex items-baseline justify-center gap-1.5 border-t border-ink/10 pt-2">
                  <b className="text-[20px] leading-none text-ink tabular-nums">{n === null ? '—' : formatCount(n)}</b>
                  <i className="text-[12.5px] not-italic text-ink/60">available</i>
                </div>
                {t.stock && t.stock.held > 0 ? (
                  <p className="text-center text-[11.5px] font-semibold text-sn-accent">{formatCount(t.stock.held)} held on a quote</p>
                ) : null}
                {onWay > 0 ? <p className="text-center text-[11.5px] font-bold text-success-700">+{formatCount(onWay)} on the way</p> : null}
                {chip ? <p className="text-center text-[11.5px] text-ink/60">{chip}</p> : null}
                <span className="sr-only">{t.pack.title}</span>
              </>
            );
            return tappable ? (
              <button
                key={t.pack.code}
                type="button"
                onClick={() => setSheetCode(t.pack.code)}
                aria-label={`${t.pack.title}: ${n === null ? 'unread' : `${formatCount(n)} available`}`}
                className="sn-press grid min-w-0 content-start gap-1.5 rounded-2xl bg-white px-2.5 pb-3 pt-2.5 text-left shadow-[0_2px_10px_-6px_rgba(16,27,48,0.3)]"
                data-gift-tile={t.pack.code}
              >
                {inner}
              </button>
            ) : (
              <div key={t.pack.code} className="grid min-w-0 content-start gap-1.5 rounded-2xl bg-white px-2.5 pb-3 pt-2.5 shadow-[0_2px_10px_-6px_rgba(16,27,48,0.3)]" data-gift-tile={t.pack.code}>
                {inner}
              </div>
            );
          })}
        </div>

        {canOffer ? (
          <div className="mt-3">
            <ActionButton
              tone="brand"
              main
              icon={ShoppingBag}
              label="Buy more"
              onClick={() => {
                setFlash(null);
                setToast(null);
                setView('store');
              }}
              aria-haspopup="dialog"
              className="w-full"
              data-testid="shop-gifts-buy"
            />
          </div>
        ) : data.canBuy && data.packs !== null && buyPacks.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-ink/60" role="status">
            Gifts are not on sale right now.
          </p>
        ) : null}

        {rewards ? (
          <div className="mt-3">
            <DatesRow
              data="shop-gifts-free-fee"
              lead={icFee}
              title={FREE_FEE_TITLE}
              line={fee === null ? 'Couldn’t read your badge rewards right now' : FREE_FEE_SUBLINE}
              strong={fee ? formatCount(fee.waiting) : null}
            />
          </div>
        ) : null}

        {/* 🎁 NEXT EVENT WITH US (prototype 6 Nov § 6, "one new row") — NOTHING CAN BE SET YET (coordinator, 6 Nov: show
            the state honestly, invent no gift): there is no offer store and no claim on a later booking. */}
        <div className="mt-3" data-shop-gifts-next-event="">
          <DatesRow data="shop-gifts-next-event" lead={ic} title="Next event with us" line="Not set · can’t be set here yet" />
        </div>

        {rewards ? (
          <div className="mt-3 border-t border-ink/10" data-plan-fold="gifts-badge-rewards">
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

      <GiftTicketSheet
        pack={sheetTile?.pack ?? null}
        bundle={sheetTile ? bundleOf(sheetTile.pack.code) : null}
        available={sheetTile ? free(sheetTile) : null}
        cart={cart}
        packs={buyPacks}
        bundles={data.bundles}
        maxPaymentPhp={data.maxPaymentPhp}
        canBuy={canOffer}
        onClose={() => setSheetCode(null)}
        onAdd={addFromSheet}
      />
      {canOffer ? (
        <GiftStore
          open={view === 'store'}
          onClose={() => setView(null)}
          cart={cart}
          setCart={setCart}
          packs={buyPacks}
          bundles={data.bundles}
          maxPaymentPhp={data.maxPaymentPhp}
          openRails={data.openRails}
          flash={flash}
          toast={toast}
        />
      ) : null}
      <GiftHistory open={view === 'history'} onClose={() => setView(null)} rows={history} />
    </section>
  );
}

/** The "🏅 N" line on a ticket when some of its stock is badge reward (Papic: the smallest pack, counted in packs). */
function rewardChipOf(left: FreeByKind | null | undefined, pack: ShopGiftPack): string | null {
  const raw = left?.[pack.kind] ?? 0;
  const n = pack.kind === 'papic' ? Math.floor(raw / Math.max(1, pack.credits)) : raw;
  return n > 0 ? `🏅 ${giftCount(n)} badge reward` : null;
}

/**
 * The Buy sheet — the shipped pack-buy pair (Gift ▾ · Pay with ▾ · Submit) plus "How many". 📦 Since 2026-11-14 the Gift
 * menu opens with the BUY 10, GET 1 FREE bundles, then each single gift at its ONE price (the list price) — Event Ultra
 * beside Plus and Pro. No second price is drawn: every price is the price couples pay.
 */
export function BuyGiftsSheet({
  open,
  onClose,
  packs,
  bundles = [],
  openRails,
  initialCode,
}: {
  open: boolean;
  onClose: () => void;
  packs: ShopGiftPack[];
  bundles?: ShopGiftBundle[];
  openRails: OpenRail[];
  initialCode?: string | null;
}) {
  const headingId = useId();
  const toast = useToast();
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);
  const [code, setCode] = useState<string | null>(initialCode ?? bundles[0]?.code ?? packs[0]?.code ?? null);
  const [qty, setQty] = useState(1);
  const [rail, setRail] = useState<string | null>(openRails[0]?.id ?? null);
  const bundle = bundles.find((b) => b.code === code) ?? null;
  const pack = bundle ? null : (packs.find((p) => p.code === code) ?? (bundles.length === 0 ? packs[0] : null) ?? null);
  const picked = bundle ?? pack ?? bundles[0] ?? packs[0] ?? null;

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
  }, [state, toast]);

  if (!picked) return null;
  const isBundle = 'pack' in picked;
  const unitCentavos = isBundle ? picked.priceCentavos : picked.srpCentavos;
  const totalPhp = (unitCentavos * qty) / 100;
  const free = isBundle ? bundleFreePacks(picked) : 0;

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
            <input type="hidden" name="pack" value={picked.code} />
            <input type="hidden" name="quantity" value={qty} />
            <input type="hidden" name="channel" value={rail ?? ''} />

            <PickMenu
              label="Gift"
              value={picked.code}
              className="!min-h-11 w-full"
              options={[
                ...bundles.map((b) => {
                  const f = bundleFreePacks(b);
                  return {
                    key: b.code,
                    label: `${b.title} · ${formatPhp(b.priceCentavos / 100)}`,
                    hint: `${formatCount(b.quantity)} × ${b.pack.title} in your gifts`,
                    group: f > 0 ? `Buy ${formatCount(b.quantity - f)}, get ${formatCount(f)} free` : 'Bundles',
                  };
                }),
                ...packs.map((p) => ({
                  key: p.code,
                  label: `${p.title} · ${formatPhp(p.srpCentavos / 100)} each`,
                  group: bundles.length > 0 ? 'One at a time' : undefined,
                })),
              ]}
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
                  {isBundle
                    ? `${formatCount(picked.quantity * qty)} × ${picked.pack.title}`
                    : `${formatCount(qty)} × ${picked.title}`}
                </span>
              </p>
              {isBundle && free > 0 ? (
                <p className="flex justify-between" data-shop-gifts-free="">
                  <span className="text-ink/70">Free in {qty > 1 ? 'these bundles' : 'this bundle'}</span>
                  <span className="tabular-nums">{`${formatCount(free * qty)} × ${picked.pack.title}`}</span>
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
