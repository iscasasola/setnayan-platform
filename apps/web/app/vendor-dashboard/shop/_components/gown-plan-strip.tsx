'use client';

/**
 * 👗 The Attire Maker's plan, on its own panel (owner 2026-11-28; rules lib/gown-plan.ts): where the shop stands (the
 * trial's days, its plan, or paused with its work kept) and the two monthly plans, each one press to the shipped
 * Toolkit checkout (`storeAction` op `buy`, the same order → pay path every tool uses; web-only, as all buying is).
 * Prices are the catalog's, worded by lib/php.ts; a price that could not be read says so and offers no button.
 */
import { CalendarClock, ShoppingBag } from 'lucide-react';
import { formatPhp } from '@/lib/php';
import { GOWN_PLAN_WORDS, gownPlanLine, type GownPlanState, type GownPlanTier } from '@/lib/gown-plan';
import { StoreOp } from '@/app/vendor-dashboard/shop/store/_components/store-client';

export function GownPlanStrip({ plan, prices }: { plan: GownPlanState; prices: { read: boolean; use: number | null; full: number | null } }) {
  const current = plan.s === 'paid' ? plan.tier : null;
  // Full is never offered a step down mid-plan; Use and save is offered Full; everyone else is offered both.
  const tiers: GownPlanTier[] = current === 'full' ? ['full'] : current === 'use' ? ['use', 'full'] : ['use', 'full'];
  return (
    <section className="sn-frame space-y-3 p-4" data-gown-plan={plan.s}>
      <p className="flex items-center gap-2 text-sn-md font-semibold text-ink" data-gown-plan-line="">
        <CalendarClock aria-hidden className="h-4 w-4 flex-none" />
        {gownPlanLine(plan)}
      </p>
      {plan.s === 'paused' ? <p className="text-sn-base text-ink/70">Your clients, designs and records stay here. Pick a plan to make new ones.</p> : null}
      <ul className="m-0 list-none space-y-2 p-0">
        {tiers.map((t) => {
          const price = prices[t];
          const renew = current === t;
          return (
            <li key={t} className="sn-row flex flex-wrap items-center justify-between gap-2" data-gown-plan-tier={t}>
              <span className="min-w-0 flex-1">
                <b className="block text-sn-md text-ink">{GOWN_PLAN_WORDS[t].name}</b>
                <small className="block text-sn-base text-ink/70">{GOWN_PLAN_WORDS[t].line}</small>
              </span>
              {price !== null ? (
                <span className="contents" data-web-only="">
                  <StoreOp
                    op="buy"
                    fields={{ tool: 'attire_tool', plan: t }}
                    tone={renew || current === null ? 'brand' : 'neutral'}
                    main={t === 'full' && current !== 'full'}
                    icon={<ShoppingBag aria-hidden strokeWidth={1.8} />}
                    label={`${renew ? 'Renew' : 'Pay'} ${formatPhp(price)} / month`}
                    data={`gown-plan-buy-${t}`}
                  />
                </span>
              ) : (
                <small className="text-sn-base text-ink/70">{prices.read ? 'Price not set yet' : 'Couldn’t read the price'}</small>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
