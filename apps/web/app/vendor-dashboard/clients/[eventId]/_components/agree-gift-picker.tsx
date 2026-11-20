'use client';

/**
 * GIFT FOR SERVICES — the gift picker on the Agree step (owner 2026-11-15, DECISION_LOG "GIFT FOR SERVICES DESIGN —
 * DECISIONS"; drawing `setnayan_gift_services_2026-11-14_fable`, screen 1: fee · gift · "You pay if you agree").
 *
 * Lives INSIDE the Agree form: every picked pack posts as one hidden `gift` field, and `vendorAgreeToLock` judges them
 * with a dry run BEFORE the yes, then writes them after it — no new server action. The gift row opens a sheet with one
 * row per pack on sale (its LIST price, "In your stock", "Bought · waiting for approval", − / +), the limit, and "Most
 * credits for your limit" when the gift is all Papic and a better mix the shop can give exists.
 *
 * ⚖ 20–21 Nov (DECISION_LOG): every booking carries AT LEAST ONE gift — the pick starts on the smallest Papic pack (or
 * the gift the store just sold, `?agree_gift=`), and the last one cannot be taken off. Nothing is bought on the
 * booking-fee bill (16 Nov). A gift the shop has none of reads "0 left · Buy more ›" and opens the "Your gifts" store
 * with that gift chosen and this page as the way back.
 *
 * Every rule is `lib/agree-gifts.ts` — the same order of checks the database runs — so the sheet never offers what
 * the door would refuse. Nothing here is a price: each figure is the catalogue's, read on the server.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Gift, Minus, Plus, Sparkles } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { pesoFromCentavos } from '@/lib/accepted-quote-terms';
import { formatCount } from '@/lib/format-number';
import {
  AGREE_GIFT_NEEDED,
  agreeGiftItems,
  agreeGiftOptions,
  agreeGiftStart,
  bestPapicMix,
  giftStoreHref,
  judgeAgreeGifts,
  offersBetterPapicMix,
  type AgreeGiftBasis,
} from '@/lib/agree-gifts';
import { GIFT_ZERO_LEFT } from '@/app/vendor-dashboard/shop/promote/_components/gift-store-copy';
import { forgetGiftReturn } from '@/app/vendor-dashboard/shop/promote/_components/gift-return-banner';

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

export function AgreeGiftPicker({ basis, regift = false }: { basis: AgreeGiftBasis; regift?: boolean }) {
  const pathname = usePathname();
  const returned = useSearchParams().get('agree_gift');
  const [codes, setCodes] = useState<string[]>(() => agreeGiftStart(basis, returned));
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const verdict = useMemo(() => judgeAgreeGifts(codes, basis), [codes, basis]);
  const options = useMemo(() => agreeGiftOptions(codes, basis), [codes, basis]);
  const better = useMemo(() => offersBetterPapicMix(codes, basis), [codes, basis]);
  const items = agreeGiftItems(verdict.lines);
  const ok = verdict.state === 'ok';
  const fee = basis.billCentavos ?? basis.feeCentavos;
  const fromStock = verdict.lines.filter((l) => l.source === 'stock').length;
  const waiting = verdict.lines.filter((l) => l.source === 'sent').length;
  // The way back from the store: this page, reopening on the gift bought (owner 21 Nov).
  const buyHref = (code: string) => giftStoreHref(code, `${pathname}?agree_gift=${encodeURIComponent(code)}`);
  const firstMissing = verdict.missing[0] ?? null;
  // 📱 The iPhone app sells nothing (store shell): no Buy word, no store door — the loader sets canBuy false there.
  const canBuy = basis.canBuy !== false;

  // Back from the store: the way back has been used.
  useEffect(() => {
    if (returned) forgetGiftReturn();
  }, [returned]);

  const add = (code: string) => setCodes((c) => [...c, code]);
  const remove = (code: string) =>
    setCodes((c) => {
      if (c.length <= 1) return c; // never none (20 Nov)
      const i = c.lastIndexOf(code);
      return i < 0 ? c : [...c.slice(0, i), ...c.slice(i + 1)];
    });

  return (
    <div data-agree-gift="" className="mb-3">
      {codes.map((c, i) => (
        <input key={`${c}-${i}`} type="hidden" name="gift" value={c} />
      ))}
      <dl className="divide-y divide-ink/10 border-y border-ink/10 text-[14px]">
        {regift ? null : (
        <div className="flex items-baseline justify-between gap-3 py-3">
          <dt className="text-ink/70">Booking fee</dt>
          <dd className="tabular-nums text-ink">{fee > 0 ? pesoFromCentavos(fee) : 'No bill on this booking'}</dd>
        </div>
        )}
        <div className="py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            data-agree-gift-open=""
          >
            <span className="flex min-w-0 items-start gap-2">
              <Gift {...ico} className="mt-0.5 h-4 w-4 flex-none text-terracotta-700" />
              <span className="min-w-0">
                <span className="block text-ink">Setnayan gift for the couple&rsquo;s event services</span>
                <span className="block text-[12.5px] text-ink/60">
                  {items ?? 'At least 1 gift'}
                  {fromStock > 0 ? ` · ${formatCount(fromStock)} from your stock` : ''}
                  {waiting > 0 ? ` · ${formatCount(waiting)} bought · waiting for approval` : ''}
                </span>
              </span>
            </span>
            <span className="flex-none text-ink">{ok ? 'Change ›' : 'Pick ›'}</span>
          </button>
          {verdict.state === 'needs_stock' && firstMissing ? (
            <p className="mt-1 pl-6 text-[12.5px] text-danger-900" data-agree-gift-needs="">
              {AGREE_GIFT_NEEDED}
              {canBuy ? (
                <>
                  {' '}
                  <Link href={buyHref(firstMissing)} className="font-semibold underline underline-offset-2">
                    {GIFT_ZERO_LEFT}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {regift ? null : (
        <div className="flex items-baseline justify-between gap-3 py-3 font-medium">
          <dt className="text-ink">You pay if you agree</dt>
          <dd className="tabular-nums text-ink" data-agree-gift-total="">
            {fee > 0 ? pesoFromCentavos(fee) : pesoFromCentavos(0)}
          </dd>
        </div>
        )}
      </dl>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledById={titleId}
        rise
        foot={
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-[13px] text-ink/70">Gifts are never added to your booking fee</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-full border border-ink/20 px-5 text-[14px] font-medium text-ink"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="px-5 pb-6 pt-5">
          <h2 id={titleId} className="pr-12 text-[17px] font-semibold text-ink">
            Gift for their event
          </h2>
          <InfoTip
            label={`${pesoFromCentavos(verdict.valueCentavos)} of ${pesoFromCentavos(verdict.limitCentavos)} · your gift limit`}
            ariaLabel="About the gift limit"
            labelAs="p"
            className="mt-1"
            labelClassName="text-[13px] text-ink/60"
            align="start"
          >
            Every booking needs at least 1 gift. Everything you give together stays within your gift limit — a share of
            this booking&rsquo;s fee, at the price couples pay; the smallest Papic pack can always be given. Gifts come
            from your stock, or from gifts you bought whose payment is waiting for approval. None left? Add more in Your
            gifts and come back here. Stock gifts land at the couple&rsquo;s first payment.
          </InfoTip>

          {better ? (
            <button
              type="button"
              onClick={() => setCodes(bestPapicMix(basis))}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-terracotta-700/40 px-4 text-[14px] font-medium text-terracotta-700"
              data-agree-gift-best=""
            >
              <Sparkles {...ico} className="h-4 w-4" />
              Most credits for your limit
            </button>
          ) : null}

          <ul className="mt-3 divide-y divide-ink/10" data-agree-gift-rows="">
            {options.map((o) => (
              <li key={o.pack.code} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{o.pack.title}</p>
                  <span className="block text-[12.5px] text-ink/60">
                    {pesoFromCentavos(o.pack.srpCentavos)} each
                    {o.inStock && o.inStock > 0 ? ` · In your stock (${formatCount(o.inStock)})` : ''}
                    {o.sent > 0 ? ` · Bought · waiting for approval (${formatCount(o.sent)})` : ''}
                    {!o.canAdd && o.why ? ` · ${o.why}` : ''}
                  </span>
                  {canBuy && o.buyMore && o.fits ? (
                    <Link
                      href={buyHref(o.pack.code)}
                      className="mt-0.5 inline-block text-[12.5px] font-semibold text-terracotta-700 underline underline-offset-2"
                      data-agree-gift-buy={o.pack.code}
                    >
                      {GIFT_ZERO_LEFT}
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    aria-label={`One less ${o.pack.title}`}
                    disabled={!o.canRemove}
                    onClick={() => remove(o.pack.code)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-ink disabled:opacity-40"
                  >
                    <Minus {...ico} className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums text-ink">{formatCount(o.count)}</span>
                  <button
                    type="button"
                    aria-label={`One more ${o.pack.title}`}
                    disabled={!o.canAdd || o.buyMore}
                    title={o.why ?? undefined}
                    onClick={() => add(o.pack.code)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-ink disabled:opacity-40"
                  >
                    <Plus {...ico} className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {basis.free === null ? (
            <p className="mt-2 text-[12.5px] text-warn-800">
              We couldn&rsquo;t read your gift stock just now. Agree checks it again before anything is booked.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
