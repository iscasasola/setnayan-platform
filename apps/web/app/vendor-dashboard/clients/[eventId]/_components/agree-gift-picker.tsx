'use client';

/**
 * GIFT FOR SERVICES — the gift picker on the Agree step (owner 2026-11-15, DECISION_LOG "GIFT FOR SERVICES DESIGN —
 * DECISIONS"; drawing `setnayan_gift_services_2026-11-14_fable`, screen 1: fee · gift · "You pay if you agree").
 *
 * Lives INSIDE the Agree form: every picked pack posts as one hidden `gift` field, and `vendorAgreeToLock` hands them
 * to the SQL door after the yes — no new server action. The rows above the button are the drawing's three lines and
 * a total; the gift row opens a sheet with one row per pack on sale (its LIST price, "In your stock" when the shop
 * holds it, − / +), the limit, and "Most credits for your limit" when the gift is all Papic and a better mix exists.
 *
 * Every rule is `lib/agree-gifts.ts` — the same order of checks the database runs — so the sheet never offers what
 * the door would refuse. Nothing here is a price: each figure is the catalogue's, read on the server.
 */
import { useId, useMemo, useState } from 'react';
import { Gift, Minus, Plus, Sparkles } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { pesoFromCentavos } from '@/lib/accepted-quote-terms';
import { formatCount } from '@/lib/format-number';
import {
  agreeGiftItems,
  agreeGiftOptions,
  bestPapicMix,
  judgeAgreeGifts,
  offersBetterPapicMix,
  type AgreeGiftBasis,
} from '@/lib/agree-gifts';

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

export function AgreeGiftPicker({ basis }: { basis: AgreeGiftBasis }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const verdict = useMemo(() => judgeAgreeGifts(codes, basis), [codes, basis]);
  const options = useMemo(() => agreeGiftOptions(codes, basis), [codes, basis]);
  const better = useMemo(() => offersBetterPapicMix(codes, basis), [codes, basis]);
  const items = agreeGiftItems(verdict.lines);
  const ok = verdict.state === 'ok';
  const fee = basis.feeCentavos;
  const giftOnBill = ok ? verdict.boughtCentavos : 0;
  const fromStock = ok ? verdict.lines.filter((l) => l.fromStock).length : 0;

  const add = (code: string) => setCodes((c) => [...c, code]);
  const remove = (code: string) =>
    setCodes((c) => {
      const i = c.lastIndexOf(code);
      return i < 0 ? c : [...c.slice(0, i), ...c.slice(i + 1)];
    });

  return (
    <div data-agree-gift="" className="mb-3">
      {ok ? codes.map((c, i) => <input key={`${c}-${i}`} type="hidden" name="gift" value={c} />) : null}
      <dl className="divide-y divide-ink/10 border-y border-ink/10 text-[14px]">
        <div className="flex items-baseline justify-between gap-3 py-3">
          <dt className="text-ink/70">Booking fee</dt>
          <dd className="tabular-nums text-ink">{pesoFromCentavos(fee)}</dd>
        </div>
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
                  {items && ok
                    ? `${items}${fromStock > 0 ? ` · ${fromStock} from your stock` : ''}`
                    : `Papic or their Event plan · up to ${pesoFromCentavos(verdict.limitCentavos)} · optional`}
                </span>
              </span>
            </span>
            <span className="flex-none tabular-nums text-ink">{items && ok ? pesoFromCentavos(giftOnBill) : 'Add ›'}</span>
          </button>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-3 font-medium">
          <dt className="text-ink">You pay if you agree</dt>
          <dd className="tabular-nums text-ink" data-agree-gift-total="">{pesoFromCentavos(fee + giftOnBill)}</dd>
        </div>
      </dl>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledById={titleId}
        rise
        foot={
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-[13px] text-ink/70">
              Adds <span className="tabular-nums text-ink">{pesoFromCentavos(giftOnBill)}</span> to your bill
            </p>
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
            Everything you give together stays within your gift limit — a share of this booking&rsquo;s fee, at the price
            couples pay. The smallest Papic pack can always be given. What is in your stock costs nothing more but still
            counts; the rest is added to your booking-fee bill and reaches the couple once that bill is paid. Stock gifts
            land at their first payment.
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
                    {!o.canAdd && o.count === 0 && o.why ? ` · ${o.why}` : ''}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    aria-label={`One less ${o.pack.title}`}
                    disabled={o.count === 0}
                    onClick={() => remove(o.pack.code)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-ink/15 text-ink disabled:opacity-40"
                  >
                    <Minus {...ico} className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums text-ink">{formatCount(o.count)}</span>
                  <button
                    type="button"
                    aria-label={`One more ${o.pack.title}`}
                    disabled={!o.canAdd}
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
              We couldn&rsquo;t read your gift stock just now, so everything here is priced as bought.
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
