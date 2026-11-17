'use client';

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { Counter } from '@/app/_components/counter';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { payPath } from '@/lib/pay-path';
import type { OpenRail } from '@/lib/payment-channels';
import type { ShopGiftBundle, ShopGiftPack } from '@/lib/shop-gifts';
import {
  SHOP_GIFT_STORE_MOST_EACH,
  mostOf,
  canAdd,
  encodeCart,
  summarizeCart,
  type AddVerdict,
  type GiftCart,
} from '@/lib/shop-gift-cart';
import { GIFT_ORDER_PILL, historyMonth, historyWhen, type GiftHistoryRow, type GiftOrderState } from '@/lib/shop-gift-history';
import {
  buyVendorPapicPortfolioPack,
  type BuyVendorPapicPortfolioPackState,
} from '@/app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions';
import { useToast } from '@/app/_components/toast/toast-provider';
import { GiftTicketArt, GiftTicketPile } from './gift-ticket-art';
import { GIFT_HOLD_RULE, bundleShape, giftSheetGrow, giftSheetWords, giftStoreCapLine } from './gift-store-copy';
import s from './gift-store.module.css';

/**
 * 🛒 THE GIFT STORE — the owner-approved prototype `gifts-interactive` v16 (2026-11-17, "build it"), translated:
 *
 *   · TicketSheet   — tap a ticket in Your gifts: its picture, what it is for your client / for you, "You have N
 *                     available", then Add 1 and Add <10 + 1>. After Add, the store opens scrolled to THAT item's row,
 *                     which flashes (no "Just added" box — owner removed it 17 Nov);
 *   · GiftStore     — Papic and Event singles (− n +, at most 9), then "<10 + 1> bundles · pay 10, get 11" (no count cap — only the payment max); the cart bar:
 *                     "N tickets (M free) · save ₱X", the total, "Buy now · ₱total", "₱100,000 is the most in one payment.";
 *   · GiftHistory   — Transaction history (‹ Your gifts): bought orders and gifts given.
 *
 * 💰 Every ₱ is the catalogue's (the packs' list price, the bundles' own price) and the ceiling is the admin setting
 * (`maxPaymentPhp`) — nothing here types a price. Buy now posts codes and counts only to the shipped buy action
 * (`for=gift_cart`), which re-prices everything and sends the shop to `/pay/<reference>`.
 */

const IDLE: BuyVendorPapicPortfolioPackState = { status: 'idle' };

/** Why + is grey, in the prototype's words. */
function addWhy(v: AddVerdict, maxPhp: number, code: string): string | null {
  if (v === 'over_max') return `Would pass ${formatPhp(maxPhp)}`;
  if (v === 'most_each') return `${formatCount(mostOf(code))} is the most`;
  if (v === 'not_on_sale') return 'Not on sale right now';
  return null;
}

// ── the ticket sheet ────────────────────────────────────────────────────────

export function GiftTicketSheet({
  pack,
  bundle,
  available,
  cart,
  packs,
  bundles,
  maxPaymentPhp,
  canBuy,
  onClose,
  onAdd,
}: {
  pack: ShopGiftPack | null;
  bundle: ShopGiftBundle | null;
  available: number | null;
  cart: GiftCart;
  packs: readonly ShopGiftPack[];
  bundles: readonly ShopGiftBundle[];
  maxPaymentPhp: number;
  /** Buying is offered (Papic on, not the App Store shell, a rail open). */
  canBuy: boolean;
  onClose: () => void;
  onAdd: (code: string) => void;
}) {
  const headingId = useId();
  if (!pack) return null;
  const words = giftSheetWords(pack);
  const one = canAdd(cart, pack.code, packs, bundles, maxPaymentPhp);
  const many = bundle ? canAdd(cart, bundle.code, packs, bundles, maxPaymentPhp) : null;
  const shape = bundle ? bundleShape(bundle) : null;
  const grow = bundle ? giftSheetGrow(bundle) : null;
  const save = bundle ? Math.max(0, bundle.quantity * pack.srpCentavos - bundle.priceCentavos) : 0;
  return (
    <Sheet open={pack !== null} onClose={onClose} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5 text-center" data-gift-ticket-sheet={pack.code}>
        <GiftTicketArt pack={pack} className="mx-auto h-auto w-[70%] max-w-[260px]" />
        <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{words.eyebrow}</p>
        <h2 id={headingId} className="mt-0.5 text-[22px] font-bold text-ink">
          {pack.title}
        </h2>
        <div className="mt-3 grid gap-2 text-left text-[14px] leading-snug text-ink/80">
          <p>
            <em className="block text-[12px] font-semibold not-italic text-ink/55">For your client</em>
            {words.forClient}
          </p>
          <p>
            <em className="block text-[12px] font-semibold not-italic text-ink/55">For you</em>
            {words.forYou}
          </p>
        </div>
        <small className="mt-3 block text-[13px] text-ink/60" data-gift-ticket-available="">
          {available === null ? 'Couldn’t read your gifts right now' : `You have ${formatCount(available)} available`}
        </small>
        <small className="mt-0.5 block text-[12.5px] text-ink/55" data-gift-hold-rule="">
          {GIFT_HOLD_RULE}
        </small>
        {canBuy ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <AddButton
              word="Add 1"
              price={formatPhp(pack.srpCentavos / 100)}
              why={addWhy(one, maxPaymentPhp, pack.code)}
              onPress={() => onAdd(pack.code)}
              data="gift-sheet-add-1"
            />
            {bundle && shape ? (
              <AddButton
                main
                word={`Add ${shape.label}`}
                price={`${formatPhp(bundle.priceCentavos / 100)}${save > 0 ? ` · save ${formatPhp(save / 100)}` : ''}`}
                why={many && bundle ? addWhy(many, maxPaymentPhp, bundle.code) : null}
                onPress={() => onAdd(bundle.code)}
                data="gift-sheet-add-bundle"
              />
            ) : null}
          </div>
        ) : null}
        {canBuy && grow ? <p className="mt-2 text-[12.5px] text-ink/60">{grow}</p> : null}
      </div>
    </Sheet>
  );
}

function AddButton({
  word,
  price,
  why,
  main = false,
  onPress,
  data,
}: {
  word: string;
  price: string;
  why: string | null;
  main?: boolean;
  onPress: () => void;
  data: string;
}) {
  const off = why !== null;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={off}
      aria-label={off ? `${word} — ${why}` : `${word}, ${price}`}
      data-testid={data}
      className={`sn-press grid min-h-[56px] content-center justify-items-center rounded-xl px-2 py-1.5 ${
        main ? 'bg-sn-accent text-sn-on-accent' : 'border border-sn-accent/40 bg-sn-accent/[0.09] text-sn-accent'
      } ${off ? 'opacity-45' : ''}`}
    >
      <b className="text-[15px] leading-tight">{word}</b>
      <i className="text-[12px] not-italic opacity-85">{off ? why : price}</i>
    </button>
  );
}

// ── the store ───────────────────────────────────────────────────────────────

export function GiftStore({
  open,
  onClose,
  cart,
  setCart,
  packs,
  bundles,
  maxPaymentPhp,
  openRails,
  flash,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  cart: GiftCart;
  setCart: (next: GiftCart) => void;
  packs: readonly ShopGiftPack[];
  bundles: readonly ShopGiftBundle[];
  maxPaymentPhp: number;
  openRails: OpenRail[];
  /** The item just added — the store opens scrolled to its row, which flashes. */
  flash: { code: string; n: number } | null;
  /** "Added to your order · <item> · Now N in your order" (prototype `tst`). */
  toast: { label: string; n: number; key: number } | null;
}) {
  const headingId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);
  const notify = useToast();
  const sum = summarizeCart(cart, packs, bundles);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') notify.error(state.message);
  }, [state, notify]);

  // Scroll to the row just added and flash it (prototype v16 `rowFlash`, 1.4 s).
  useEffect(() => {
    if (!open || !flash) return;
    const t = window.setTimeout(() => {
      const row = scrollRef.current?.querySelector<HTMLElement>(`[data-store-row="${flash.code}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      row.classList.remove(s.flash!);
      void row.offsetWidth;
      row.classList.add(s.flash!);
    }, 60);
    return () => window.clearTimeout(t);
  }, [open, flash]);

  const step = (code: string, by: 1 | -1) => {
    const next: Record<string, number> = { ...cart };
    const n = Math.max(0, (next[code] ?? 0) + by);
    if (n === 0) delete next[code];
    else next[code] = n;
    setCart(next);
  };

  const row = (code: string, pic: ReactNode, title: string, note: ReactNode, capLine: string | null) => {
    const n = cart[code] ?? 0;
    const v = canAdd(cart, code, packs, bundles, maxPaymentPhp);
    const why = addWhy(v, maxPaymentPhp, code);
    return (
      <div key={code}>
        <div className="flex min-h-[64px] items-center gap-2.5 px-3 py-2.5" data-store-row={code}>
          <span className="flex flex-none items-center">{pic}</span>
          <span className="grid min-w-0 flex-1">
            <b className="truncate text-[15px] text-ink">{title}</b>
            <span className="text-[13px] text-ink/60">{note}</span>
          </span>
          <Counter
            value={n}
            label={`How many ${title}`}
            onLess={() => step(code, -1)}
            onMore={() => step(code, 1)}
            lessDisabled={n <= 0}
            moreDisabled={why !== null}
            lessLabel={n <= 0 ? 'None picked' : 'One less'}
            moreLabel={why ?? 'One more'}
            data={`gift-store-${code}`}
          />
        </div>
        {capLine && n >= SHOP_GIFT_STORE_MOST_EACH ? (
          <p className="border-t border-ink/10 px-3 py-2 text-[12.5px] text-ink/70" data-gift-store-cap="">
            {capLine}
          </p>
        ) : null}
      </div>
    );
  };

  const group = (name: string, list: readonly ShopGiftPack[]) =>
    list.length === 0 ? null : (
      <section key={name}>
        <p className="mx-0.5 mb-1.5 mt-3.5 text-[15px] font-bold text-ink">{name}</p>
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-frame shadow-sn-frame">
          {list.map((p) =>
            row(
              p.code,
              <GiftTicketArt pack={p} width={72} className="h-auto w-[72px]" />,
              p.title,
              `${formatPhp(p.srpCentavos / 100)} each`,
              giftStoreCapLine(SHOP_GIFT_STORE_MOST_EACH, bundles.find((b) => b.pack.code === p.code) ?? null),
            ),
          )}
        </div>
      </section>
    );

  const firstShape = bundles[0] ? bundleShape(bundles[0]) : null;
  // 🏦 BDO only (owner 17 Nov: "we will make all our transactions enter BDO Account"). No fallback to another rail: with
  // BDO closed the store says payments are paused, as it does with nothing open. (#7926 makes the same rule app-wide.)
  const rail = openRails.find((r) => r.id === 'bdo')?.id ?? '';
  const total = formatPhp(sum.totalCentavos / 100);

  const head = (
    <div className="flex min-h-[52px] items-center gap-2 border-b border-ink/10 bg-frame px-2">
      <button type="button" onClick={onClose} className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] font-semibold text-sn-accent">
        <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        Your gifts
      </button>
      <h2 id={headingId} className="sr-only">
        Buy gifts
      </h2>
    </div>
  );

  const foot = (
    <div className="border-t border-ink/10 bg-frame px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3" data-gift-cart-bar="">
      <div className="flex items-baseline justify-between gap-3 text-[14.5px] font-bold text-ink">
        <span data-gift-cart-count="">
          {sum.tickets > 0 ? (
            <>
              {formatCount(sum.tickets)} ticket{sum.tickets === 1 ? '' : 's'}
              {sum.free > 0 ? (
                <span className="font-semibold text-ink/70">
                  {' '}
                  ({formatCount(sum.free)} free) · <span className="text-success-700">save {formatPhp(sum.saveCentavos / 100)}</span>
                </span>
              ) : null}
            </>
          ) : (
            <span className="font-semibold text-ink/55">Nothing picked yet</span>
          )}
        </span>
        <b className="tabular-nums" data-gift-cart-total="">
          {total}
        </b>
      </div>
      <div className="mt-2">
        {rail === '' ? (
          <PaymentsPausedNote />
        ) : sum.lines.length > 0 ? (
          <form action={formAction}>
            <input type="hidden" name="for" value="gift_cart" />
            <input type="hidden" name="cart" value={encodeCart(cart)} />
            <input type="hidden" name="channel" value={rail} />
            <SupplierSubmit
              tone="brand"
              main
              icon={<ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
              label={`Buy now · ${total}`}
              pendingLabel="Starting…"
              className="w-full"
            />
          </form>
        ) : (
          <ActionButton tone="brand" main icon={ShoppingBag} label={`Buy now · ${total}`} disabled className="w-full" />
        )}
      </div>
      <p className="mt-1.5 text-center text-[12.5px] text-ink/60" data-gift-cart-limit="">
        {formatPhp(maxPaymentPhp)} is the most in one payment.
      </p>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId} full head={head} foot={foot}>
      <div ref={scrollRef} className="bg-[rgb(238_242_248)] px-4 pb-4 pt-1" data-gift-store="">
        {group('Papic', packs.filter((p) => p.kind === 'papic'))}
        {group('Event', packs.filter((p) => p.kind !== 'papic'))}
        {bundles.length > 0 && firstShape ? (
          <section>
            <p className="mx-0.5 mb-1.5 mt-3.5 text-[15px] text-ink">
              <b>{firstShape.label} bundles</b>{' '}
              <span className="text-ink/60">
                pay {formatCount(firstShape.paid)}, get {formatCount(firstShape.paid + firstShape.free)}
              </span>
            </p>
            <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-frame shadow-sn-frame">
              {bundles.map((b) => {
                const save = Math.max(0, b.quantity * b.pack.srpCentavos - b.priceCentavos);
                return row(
                  b.code,
                  <GiftTicketPile pack={b.pack} label={bundleShape(b).label} width={72} />,
                  b.pack.title,
                  <>
                    {formatPhp(b.priceCentavos / 100)}
                    {save > 0 ? (
                      <>
                        {' · '}
                        <b className="text-success-700">save {formatPhp(save / 100)}</b>
                      </>
                    ) : null}
                  </>,
                  null,
                );
              })}
            </div>
          </section>
        ) : null}
        {toast ? (
          <div
            key={toast.key}
            role="status"
            className={`${s.toast} pointer-events-none fixed left-1/2 top-[44%] z-[80] w-[min(300px,80%)] rounded-2xl bg-frame px-[18px] pb-4 pt-[18px] text-center shadow-sn-frame`}
            data-gift-added-toast=""
          >
            <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-success-100 text-[22px] font-extrabold text-success-700">✓</span>
            <p className="text-[16px] font-bold text-ink">Added to your order</p>
            <p className="mt-0.5 text-[14px] text-ink/70">{toast.label}</p>
            <p className="mt-2 text-[13px] font-bold text-sn-accent">Now {formatCount(toast.n)} in your order</p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

// ── the history ─────────────────────────────────────────────────────────────

const PILL: Readonly<Record<GiftOrderState, string>> = {
  in_stock: 'bg-success-50 text-success-800',
  sent: 'bg-warn-50 text-warn-900',
  unpaid: 'bg-ink/[0.06] text-ink/70',
  refunded: 'bg-ink/[0.06] text-ink/60',
};

type HistoryFilter = 'all' | 'bought' | 'given';

export function GiftHistory({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  /** Null ⇒ could not be read (never "nothing yet"). */
  rows: GiftHistoryRow[] | null;
}) {
  const headingId = useId();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.kind === filter);
  const months: Array<{ month: string; rows: GiftHistoryRow[] }> = [];
  for (const r of shown) {
    const m = historyMonth(r.createdAt);
    const last = months[months.length - 1];
    if (last && last.month === m) last.rows.push(r);
    else months.push({ month: m, rows: [r] });
  }
  const head = (
    <div className="flex min-h-[52px] items-center gap-2 border-b border-ink/10 bg-frame px-2">
      <button type="button" onClick={onClose} className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] font-semibold text-sn-accent">
        <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        Your gifts
      </button>
    </div>
  );
  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId} full head={head}>
      <div className="min-h-full bg-[rgb(238_242_248)] px-4 pb-6 pt-3" data-gift-history="">
        <h2 id={headingId} className="text-[19px] font-bold text-ink">
          Transaction history
        </h2>
        {rows === null ? (
          <p className="mt-3 text-[14px] text-ink/70" role="status">
            Your history couldn&rsquo;t load. Reload to try again — nothing you bought or gave has changed.
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[17px] font-bold text-ink">
                All <span className="text-ink/55">{formatCount(shown.length)}</span>
              </span>
              <span className="flex-1" />
              <PickMenu
                label="Show"
                value={filter}
                className="!min-h-11 min-w-[190px]"
                options={[
                  { key: 'all', label: 'Bought and given' },
                  { key: 'bought', label: 'Bought' },
                  { key: 'given', label: 'Given' },
                ]}
                onPick={(k) => setFilter(k as HistoryFilter)}
                dataAttr="data-gift-history-filter"
              />
            </div>
            {shown.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink/60">Nothing here yet.</p>
            ) : (
              months.map((m) => (
                <div key={m.month}>
                  <p className="mb-1.5 mt-4 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink/55">{m.month}</p>
                  <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-frame shadow-sn-frame">
                    {m.rows.map((r) => (
                      <HistoryItem key={r.key} row={r} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function HistoryItem({ row }: { row: GiftHistoryRow }) {
  if (row.kind === 'given') {
    return (
      <div className="flex items-center gap-3 px-3.5 py-3" data-gift-history-row="given">
        <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full bg-success-700" />
        <span className="grid min-w-0 flex-1">
          <b className="truncate text-[14.5px] text-ink">{row.eventName ?? 'A booking'}</b>
          <span className="text-[12.5px] text-ink/60">given {historyWhen(row.createdAt)}</span>
        </span>
        <span className="grid flex-none justify-items-end gap-1">
          <b className="text-[14px] text-ink">{row.count > 1 ? `${formatCount(row.count)} × ${row.giftTitle}` : row.giftTitle}</b>
          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-ink/70">Given</span>
        </span>
      </div>
    );
  }
  const body = (
    <>
      <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full bg-sn-accent" />
      <span className="grid min-w-0 flex-1">
        <b className="truncate text-[14.5px] text-ink">{row.title}</b>
        <span className="text-[12.5px] text-ink/60">
          {row.items} · {historyWhen(row.createdAt)}
        </span>
      </span>
      <span className="grid flex-none justify-items-end gap-1">
        <b className="tabular-nums text-[14px] text-ink">{formatPhp(row.paidPhp)}</b>
        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${PILL[row.state]}`} data-gift-history-pill={row.state}>
          {GIFT_ORDER_PILL[row.state]}
        </span>
      </span>
    </>
  );
  // An order nothing was sent for opens its payment page again — the one place it can be paid.
  return row.state === 'unpaid' && row.referenceCode ? (
    <Link href={payPath(row.referenceCode)} className="sn-press flex items-center gap-3 px-3.5 py-3" data-gift-history-row="bought">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-3.5 py-3" data-gift-history-row="bought">
      {body}
    </div>
  );
}
