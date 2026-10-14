'use client';

/**
 * THE PLAN AS ONE DROPDOWN (simpler supplier dashboard step 6; prototype SCREENS.plan: "Your plan ▾ · Cycle ▾ ·
 * What you pay + Pay"). Replaces the three side-by-side plan cards: the rule "3+ options → ONE dropdown".
 *
 *   · Your plan ▾ — Free · Solo · Pro · Enterprise, each with its catalogue price for the picked cycle;
 *   · Cycle ▾     — 28 days · A year (hidden for Free);
 *   · What you pay — the picked plan's catalogue price, and the one terracotta **Pay** (the SHIPPED
 *     `startSubscriptionPurchase`, `sku_code` only — the RPC re-reads the price). The line under "Your plan" says
 *     what picking does (`planPickLine`: up = live once paid, down = when the term ends, Free = nothing renews).
 *
 * Every rule the cards carried stays: a plan shorter than the time held says why instead of Pay (owner 2026-08-27);
 * an unverified shop is sent to get verified first (the RPC's NOT_VERIFIED, said before the click). Prices arrive
 * from the server, read from `vendor_billing_catalog`; nothing here holds a number of its own.
 */
import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CalendarDays, Gem, Wallet } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';
import { DatesRow } from '../../customers/_components/dates-row';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { formatPhp } from '@/lib/php';

type Action = (formData: FormData) => void | Promise<void>;
type Cycle = 'monthly' | 'annual';

export type PlanPick = {
  /** `free` or a paid tier. */
  key: string;
  name: string;
  /** Catalogue price per cycle; absent = that cycle is not sold. */
  price: Partial<Record<Cycle, number>>;
  /** Per cycle: the too-short sentence (the purchase would be refused), or null. */
  tooShort: Partial<Record<Cycle, string | null>>;
  /** What picking this plan does, in one line (`planPickLine`). */
  pickLine: string;
};

const lead = (Icon: typeof Gem) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;

const CYCLE_WORD: Record<Cycle, string> = { monthly: '28 days', annual: 'a year' };

export function PlanPicker({
  plans,
  current,
  cycle: startCycle,
  verified,
  action,
}: {
  plans: readonly PlanPick[];
  /** The plan the shop is on now (`free` covers Free · Verified). */
  current: string;
  cycle: Cycle;
  verified: boolean;
  /** The shipped `startSubscriptionPurchase`. */
  action: Action;
}) {
  const [picked, setPicked] = useState(plans.some((p) => p.key === current) ? current : 'free');
  const [cycle, setCycle] = useState<Cycle>(startCycle);
  const plan = plans.find((p) => p.key === picked) ?? plans[0];
  if (!plan) return null;
  const isFree = plan.key === 'free';
  const isCustom = plan.key === 'custom';
  const price = plan.price[cycle];
  const tooShort = plan.tooShort[cycle] ?? null;

  const options = plans.map((p) => ({
    key: p.key,
    label: p.key === 'free' || p.key === 'custom' ? p.name : p.price[cycle] !== undefined ? `${p.name} · ${formatPhp(p.price[cycle]!)} / ${CYCLE_WORD[cycle]}` : p.name,
  }));

  return (
    <div data-plan-picker="">
      <DatesRow
        data="plan-pick"
        lead={lead(Gem)}
        title="Your plan"
        line={plan.pickLine}
        end={
          <PickMenu
            label="Your plan"
            value={picked}
            options={options}
            onPick={(k) => setPicked(k)}
            dataAttr="data-plan-pick-menu"
            compact
            className="!min-h-11"
          />
        }
      />
      {isFree || isCustom ? null : (
        <DatesRow
          data="plan-cycle"
          lead={lead(CalendarDays)}
          title="Cycle"
          line={cycle === 'annual' ? 'Paid once a year' : 'Paid every 28 days'}
          end={
            <PickMenu
              label="Cycle"
              value={cycle}
              options={[
                { key: 'monthly', label: '28 days' },
                { key: 'annual', label: 'A year' },
              ]}
              onPick={(k) => setCycle(k === 'annual' ? 'annual' : 'monthly')}
              dataAttr="data-plan-cycle-menu"
              compact
              className="!min-h-11"
            />
          }
        />
      )}
      <DatesRow
        data="plan-pay"
        lead={lead(Wallet)}
        title="What you pay"
        line={
          isFree
            ? 'Nothing to pay · nothing renews by itself'
            : isCustom
              ? 'Your Custom quote'
              : price === undefined
              ? 'Not sold on this cycle right now'
              : tooShort ?? `${formatPhp(price)} / ${CYCLE_WORD[cycle]} · Setnayan confirms your payment`
        }
        end={
          isFree || isCustom || price === undefined || tooShort ? undefined : verified ? (
            <form action={action} data-plan-pay-form="">
              <input type="hidden" name="sku_code" value={`${plan.key}_vendor_${cycle}`} />
              <SupplierSubmit
                tone="brand"
                main
                icon={<Wallet aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                label="Pay"
                pendingLabel="Starting your order…"
              />
            </form>
          ) : (
            <ActionButton tone="brand" main icon={BadgeCheck} label="Get verified first" href="/vendor-dashboard/shop#get-verified" />
          )
        }
      />
      {!verified && !isFree && !isCustom ? (
        <p className="pb-1 text-[13px] text-ink/60" data-plan-unverified="">
          Plans open once Setnayan approves your shop. <Link href="/vendor-dashboard/shop#get-verified" className="font-medium text-sn-accent underline underline-offset-4">Get verified in Your shop</Link>
        </p>
      ) : null}
    </div>
  );
}
