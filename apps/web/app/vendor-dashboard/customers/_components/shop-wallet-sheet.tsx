'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PaymentsPausedNote } from '@/app/vendor-dashboard/_components/payments-paused-note';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import type { OpenRail } from '@/lib/payment-channels';
import {
  buyVendorPapicPortfolioPack,
  type BuyVendorPapicPortfolioPackState,
} from '@/app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions';
import { DatesRow } from './dates-row';

/**
 * THE SHOP WALLET SHEET — tap 3 from the Shop tab bar (Customers › Money › the
 * wallet row). Prototype `shop_wallet_portfolio_credits_2026-10-23`, frames
 * `wallet-sheet` · `buy-sheet` · `f4-pack-unavailable`.
 *
 *   the balance  — "128 Papic credits", or (F1) "Couldn't read your shop
 *                  wallet" and NO Buy: a price is never offered against a
 *                  balance nobody read;
 *   Came from    — packs one by one, portfolio spends folded into one line,
 *                  event spends folded per event (`walletHistoryLines`);
 *   Your events' own credits — each event's own pot, quoted (each a door to
 *                  that event's Papic). Those credits are spent FIRST there;
 *   Buy a pack   — the shipped pair (rail ▾ + Buy), the only place Buy lives.
 *                  Pack SKU inactive → "Pack unavailable" (shipped copy); every
 *                  rail closed → the shipped PaymentsPausedNote. Hidden in the
 *                  App Store shell (supplier purchases stay on the web).
 *
 * Opened by URL (`?seg=money&wallet=1`), so the Shop uploader and an event's
 * Papic can link the word "Shop wallet" straight here, and Back closes it.
 * Closing replaces the URL without the param.
 */

export type ShopWalletSheetData = {
  /** null = the wallet could not be read (said, never 0). */
  balance: number | null;
  /** A pack not approved yet — "₱500 pack · checking" / "needs a new screenshot". */
  pending: { title: string; sub: string; href: string } | null;
  lines: readonly { key: string; title: string; sub: string }[];
  /** null = the events' pots could not be read. */
  pots: readonly { key: string; title: string; sub: string; href: string }[] | null;
  buy: {
    openRails: readonly OpenRail[];
    /** null = the pack SKU is missing/inactive. */
    pricePhp: number | null;
    packCredits: number;
  };
  /** App Store / Play shell: no buying here (guideline 3.1.1). */
  storeShell: boolean;
};

const IDLE: BuyVendorPapicPortfolioPackState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');
const count = (n: number) => n.toLocaleString('en-PH');

export function ShopWalletSheet({ data, closeHref }: { data: ShopWalletSheetData; closeHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();

  const close = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };

  const sheet = (
    <Sheet open={open} onClose={close} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5" data-shop-wallet-sheet="" data-wallet-read={data.balance == null ? 'unread' : 'read'}>
        <h2 id={headingId} className="pr-12 text-[18px] font-semibold text-ink">
          Shop wallet
        </h2>
        {data.balance == null ? (
          <p className="mt-2 text-[14px] text-ink/70" role="status" data-shop-wallet-unread="">
            <b className="font-semibold text-ink">Couldn&rsquo;t read your shop wallet.</b> Nothing was spent — close and
            open it again to retry.
          </p>
        ) : (
          <>
            <p className="mt-1 flex items-baseline gap-2" data-shop-wallet-balance="">
              <span className="text-[40px] font-bold leading-none tabular-nums text-ink">{count(data.balance)}</span>
              <span className="text-[15px] text-ink/55">Papic credits</span>
            </p>
            <p className="mt-2 text-[13.5px] text-ink/60">
              Spend them on your portfolio or on any event you&rsquo;re booked on. Each event spends its own credits
              first.
            </p>
          </>
        )}

        <p className="home-k2 mt-5">Came from</p>
        <div data-shop-wallet-history="">
          {data.pending ? <DatesRow data="wallet-pending" title={data.pending.title} line={data.pending.sub} href={data.pending.href} /> : null}
          {data.lines.map((l) => (
            <DatesRow key={l.key} data="wallet-line" title={l.title} line={l.sub} />
          ))}
          {data.balance != null && data.lines.length === 0 && !data.pending ? (
            <p className="py-2 text-[13.5px] text-ink/60" data-shop-wallet-empty="">
              Nothing yet — a pack lands here when its payment is approved.
            </p>
          ) : null}
        </div>

        <p className="home-k2 mt-5">Your events&rsquo; own credits</p>
        <div data-shop-wallet-pots="">
          {data.pots == null ? (
            <p className="py-2 text-[13.5px] text-ink/70" role="status">
              Couldn&rsquo;t read your events&rsquo; own credits right now.
            </p>
          ) : data.pots.length === 0 ? (
            <p className="py-2 text-[13.5px] text-ink/60">No booked event yet — each one brings its own credits.</p>
          ) : (
            data.pots.map((p) => <DatesRow key={p.key} data="wallet-pot" title={p.title} line={p.sub} href={p.href} />)
          )}
        </div>

        <BuyAPack balance={data.balance} buy={data.buy} storeShell={data.storeShell} />
      </div>
    </Sheet>
  );

  return mounted ? createPortal(sheet, document.body) : null;
}

/**
 * The only place a pack is bought. Hidden in the store shell; withheld when the
 * balance is unread (F1 — no remembered price beside an unread balance).
 */
function BuyAPack({
  balance,
  buy,
  storeShell,
}: {
  balance: number | null;
  buy: ShopWalletSheetData['buy'];
  storeShell: boolean;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);
  const { openRails } = buy;
  const [rail, setRail] = useState<string | null>(openRails[0]?.id ?? null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
  }, [state, toast]);

  if (storeShell || balance == null) return null;

  return (
    <div className="mt-5" data-shop-wallet-buy="">
      <p className="home-k2">Buy a pack</p>
      {buy.pricePhp != null ? (
        <p className="mt-1 text-[13.5px] text-ink/60">
          {peso(buy.pricePhp)} · {count(buy.packCredits)} credits · lands in this wallet when the payment is approved ·
          never expires while your shop exists.
        </p>
      ) : null}
      {openRails.length === 0 ? (
        <PaymentsPausedNote className="mt-2" />
      ) : buy.pricePhp == null ? (
        <>
          <div className="mt-3">
            <ActionButton tone="brand" main disabled icon={ShoppingBag} label="Pack unavailable" />
          </div>
          <p className="mt-2 text-[13.5px] text-danger-700" role="status" data-shop-wallet-pack-unavailable="">
            The Papic credit pack is temporarily unavailable. Your {count(balance)} credits are safe; try again later.
          </p>
        </>
      ) : (
        <form action={formAction} className="mt-3 flex items-center gap-2">
          {/* Only the rails the owner has left open (lib/payment-channels.ts). */}
          <input type="hidden" name="channel" value={rail ?? ''} />
          <PickMenu
            label="Pay with"
            value={rail}
            compact
            className="!min-h-11"
            options={openRails.map((r) => ({ key: r.id, label: r.label }))}
            onPick={(key) => setRail(key)}
            dataAttr="data-shop-wallet-rail"
          />
          <SupplierSubmit
            tone="brand"
            main
            icon={<ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
            label={`Buy ${count(buy.packCredits)} credits · ${peso(buy.pricePhp)}`}
            pendingLabel="Starting…"
            className="flex-1"
          />
        </form>
      )}
    </div>
  );
}
