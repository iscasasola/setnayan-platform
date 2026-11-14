'use client';

/**
 * THE PLAN SHEET — DOOR 2, Plan › Change plan (Build 5 · Lane B; owner 10 Nov 2026: *"this can also show a better way to
 * expand and show their current plan and what happens if the pick this plan. and what to pay."* · *"show their current
 * plan and active until"*; approved prototype `settings_full_screen_2026-11-10/settings-full-screen.html`, Plans).
 *
 * The bare "Your plan ▾" dropdown is replaced by ONE list of plans that open in place (`Fold`):
 *   · Pay every ▾  — 28 days · A year (one dropdown; every price below follows it);
 *   · Your plan    — first and open: "Solo · your plan · Active until 8 Dec 2026", what it gives you (each limit), the
 *                    next payment;
 *   · each other   — a row that opens to WHAT CHANGES (each limit now → after, then what else changes) and WHAT YOU PAY
 *                    (today, then each term) with its own button: Upgrade to <plan> · Switch to <plan> · Renew;
 *   · a lower plan — says it starts when the paid days end; you keep what you have, you just can't add past its limits.
 *
 * Every rule the dropdown carried stays (it is the same data, `PlanPick`): Pay posts ONLY `sku_code` to the shipped
 * `startSubscriptionPurchase` (the RPC re-reads the price and refuses an unverified shop); a term shorter than the time
 * held says why instead of a button; 🎁 a plan Setnayan gave reads "Free until …" and ₱0 until its last week, when the
 * current plan's Pay comes back (no forced Free gap). An UNVERIFIED shop sees every paid plan — shown, never hidden —
 * with the shared 🔒 (`LockButton`, Problem → Solution → Get verified). Nothing here holds a number of its own: every
 * limit is `TIER_CAPS` via `planChanges`, every price is the catalogue's, the amount today is `payToday`.
 *
 * 🔒 app/vendor-dashboard/subscription/the-plan-is-rows.test.ts · lib/plan-sheet.test.ts
 */
import { useState } from 'react';
import { BadgeCheck, CalendarDays, Gem, Sparkles, Wallet } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { Fold } from '@/app/_components/fold';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { LockButton } from '@/app/_components/lock/locked-feature';
import { DatesRow } from '../../customers/_components/dates-row';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { formatPhp } from '@/lib/php';
import type { LimitChange, PayToday, PlanChanges } from '@/lib/plan-sheet';
import type { DowngradeFit } from '@/lib/downgrade-limits';
import { LimitsList, LowerPlanSwitch } from './limits-sheet';
import type { PlanLine } from '@/lib/vendor-plan-rows';

type Action = (formData: FormData) => void | Promise<void>;
export type Cycle = 'monthly' | 'annual';

/** One plan with its catalogue price per cycle — the server's read, before it becomes a sheet row. */
export type PlanPick = {
  /** `free` or a paid plan. */
  key: string;
  name: string;
  /** Catalogue price per cycle; absent = that cycle is not sold. */
  price: Partial<Record<Cycle, number>>;
  /** Per cycle: the too-short sentence (the purchase would be refused), or null. */
  tooShort: Partial<Record<Cycle, string | null>>;
  /** What picking this plan does, in one line (`planPickLine`). */
  pickLine: string;
};

export type SheetPlan = {
  /** `free` · `verified` · `solo` · `pro` · `enterprise`. */
  key: string;
  /** `planWord` — Free · Free · Verified · Solo · Pro · Ultra. */
  name: string;
  /** The row's one line when shut. */
  line: string;
  /** Sold on the web (Solo · Pro · Ultra) — the only plans with a Pay. */
  paid: boolean;
  /** Catalogue price per cycle; absent = that cycle is not sold. */
  price: Partial<Record<Cycle, number>>;
  /** Per cycle: the too-short sentence (the purchase would be refused), or null. */
  tooShort: Partial<Record<Cycle, string | null>>;
  /** Per cycle: what is due today (`payToday`). */
  today: Partial<Record<Cycle, PayToday>>;
  /** What picking this plan does, in one line (`planPickLine`). */
  pickLine: string;
  /** Now → after for every limit, and what else changes (`planChanges`). The current plan carries its own (all same). */
  changes: PlanChanges;
  /** A LOWER plan only: what does not fit it, limit by limit (`downgradeFit`, ruling 5683). Absent = not read. */
  fit?: DowngradeFit | null;
};

const lead = (Icon: typeof Gem) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />;
const CYCLE_WORD: Record<Cycle, string> = { monthly: '28 days', annual: 'a year' };
const EVERY_WORD: Record<Cycle, string> = { monthly: 'every 28 days', annual: 'every year' };

function LimitRow({ l, compare }: { l: LimitChange; compare: boolean }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-t border-ink/10 py-1.5 first:border-t-0" data-plan-limit={l.key}>
      <span className="min-w-0 flex-1 text-[14.5px] font-medium text-ink">{l.title}</span>
      <span className="shrink-0 text-[14.5px] tabular-nums text-ink">
        {compare && l.changed ? (
          <>
            <span className="text-[color:var(--m-slate-2)]">{l.now}</span> → <b className="font-semibold">{l.after}</b>
          </>
        ) : (
          <b className="font-semibold">{l.after}</b>
        )}
      </span>
    </div>
  );
}

/** `pesos` is a catalogue amount (formatted here, with its commas); `cycle` the term it buys ("/ 28 days"). */
function PayRow({ title, line, pesos, cycle }: { title: string; line: string; pesos: number | null; cycle?: Cycle }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-t border-ink/10 py-1.5" data-plan-pay-row="">
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-ink">{title}</span>
        <span className="block text-[13px] text-[color:var(--m-slate-2)]">{line}</span>
      </span>
      {pesos !== null ? (
        <b className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
          {formatPhp(pesos)}
          {cycle ? ` / ${CYCLE_WORD[cycle]}` : ''}
        </b>
      ) : null}
    </div>
  );
}

function AlsoRows({ also }: { also: readonly PlanLine[] }) {
  if (also.length === 0) return null;
  return (
    <div data-plan-also="">
      {also.map((g) => (
        <div key={g.key} className="border-t border-ink/10 py-2">
          <span className="block text-[14.5px] font-medium text-ink">{g.title}</span>
          <span className="block text-[13px] text-[color:var(--m-slate-2)]">{g.line}</span>
        </div>
      ))}
    </div>
  );
}

export function PlanSheet({
  plans,
  current,
  cycle: startCycle,
  verified,
  action,
  expiresOn,
  storeShell = false,
  papersProgress,
  gift = null,
}: {
  /** `sheetPlans(...)` order — the shop's own first. */
  plans: readonly SheetPlan[];
  current: string;
  cycle: Cycle;
  verified: boolean;
  /** The shipped `startSubscriptionPurchase`. */
  action: Action;
  /** "8 Dec 2026" — when the current paid plan ends; null on Free. */
  expiresOn: string | null;
  storeShell?: boolean;
  /** `papersProgress(...)` for the 🔒 on paid plans while unverified. */
  papersProgress: string;
  /** 🎁 A plan Setnayan gave: "Free until …" and ₱0 until its last week, then the current plan's Pay comes back (no forced Free gap). */
  gift?: { untilShort: string; untilFull: string; endsSoon?: boolean; startsShort?: string } | null;
}) {
  const [cycle, setCycle] = useState<Cycle>(startCycle);
  const anyPaid = plans.some((p) => p.paid);

  const button = (p: SheetPlan, kind: 'renew' | 'up' | 'down') => {
    const price = p.price[cycle];
    const tooShort = p.tooShort[cycle] ?? null;
    if (!p.paid || price === undefined || tooShort) return null;
    if (!verified) {
      return (
        <LockButton
          lock="plans"
          need={{ kind: 'verify', progress: papersProgress }}
          label={kind === 'up' ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
          storeShell={storeShell}
        />
      );
    }
    if (storeShell) return null;
    const label = kind === 'renew' ? `Keep ${p.name}` : kind === 'up' ? `Upgrade to ${p.name}` : `Switch to ${p.name}`;
    return (
      <form action={action} data-plan-pay-form="">
        <input type="hidden" name="sku_code" value={`${p.key}_vendor_${cycle}`} />
        <SupplierSubmit
          tone="brand"
          main
          icon={kind === 'up' ? <Sparkles aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Wallet aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          label={label}
          pendingLabel="Starting your order…"
        />
      </form>
    );
  };

  return (
    <div data-plan-sheet="">
      {anyPaid ? (
        <DatesRow
          data="plan-cycle"
          lead={lead(CalendarDays)}
          title="Pay every"
          line="Prices below follow this choice"
          end={
            <PickMenu
              label="Pay every"
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
      ) : null}
      {plans.map((p) => {
        const isCurrent = p.key === current;
        const dir = isCurrent ? 'same' : p.changes.direction;
        const price = p.price[cycle];
        const tooShort = p.tooShort[cycle] ?? null;
        const today = p.today[cycle];
        const onGift = isCurrent && Boolean(gift);
        const keepGift = onGift && gift?.endsSoon === true && price !== undefined && !tooShort;
        const badge: { tone: BadgeTone; word: string } | null = isCurrent
          ? { tone: 'ok', word: onGift ? 'Gift' : 'Active' }
          : dir === 'up'
            ? { tone: 'ok', word: '+ more' }
            : { tone: 'quiet', word: 'Lower' };
        const title = isCurrent ? `${p.name} · your plan` : p.name;
        const line = isCurrent && onGift && gift ? `Free until ${gift.untilShort} · then you choose` : p.line;
        return (
          <div key={p.key} className="border-t border-ink/10" data-plan-sheet-row={p.key} data-plan-current={isCurrent ? '' : undefined}>
            <Fold
              title={title}
              line={line}
              lead={<span className="mr-1 flex">{lead(isCurrent ? BadgeCheck : Gem)}</span>}
              aside={badge ? <Badge tone={badge.tone} data="plan-sheet">{badge.word}</Badge> : undefined}
              defaultOpen={isCurrent}
              data={`plan-sheet-${p.key}`}
              anchor={`plan-sheet-${p.key}`}
            >
              <div className="pb-3" data-plan-sheet-body={p.key}>
                {isCurrent ? (
                  <>
                    {p.changes.limits.map((l) => (
                      <LimitRow key={l.key} l={l} compare={false} />
                    ))}
                    {p.paid ? (
                      <PayRow
                        title="Next payment"
                        line={
                          onGift && gift
                            ? keepGift
                              ? `Starts ${gift.startsShort ?? `after ${gift.untilShort}`}, no gap`
                              : `${formatPhp(0)} until ${gift.untilFull} · nothing renews by itself`
                            : expiresOn
                              ? `On ${expiresOn} to stay on ${p.name} · nothing renews by itself`
                              : `To stay on ${p.name} · nothing renews by itself`
                        }
                        pesos={onGift && !keepGift ? 0 : price !== undefined ? price : null}
                      />
                    ) : (
                      <PayRow title="What you pay" line={p.pickLine} pesos={null} />
                    )}
                    {tooShort ? <p className="pt-2 text-[13px] text-[color:var(--m-slate-2)]">{tooShort}</p> : null}
                    {(!onGift || keepGift) && p.paid ? <div className="pt-3">{button(p, 'renew')}</div> : null}
                  </>
                ) : (
                  <>
                    <p className="hc-k2">What changes</p>
                    <div className="pt-2">
                      {p.changes.limits.map((l) => (
                        <LimitRow key={l.key} l={l} compare />
                      ))}
                      <AlsoRows also={p.changes.also} />
                    </div>
                    {dir === 'down' && p.fit ? (
                      <>
                        <p className="pt-2 text-[13px] text-[color:var(--m-slate-2)]" data-plan-lower="">
                          A lower plan waits until your paid days end.
                        </p>
                        <LimitsList fit={p.fit} />
                      </>
                    ) : dir === 'down' ? (
                      <p className="pt-2 text-[13px] text-[color:var(--m-slate-2)]" data-plan-lower="">
                        A lower plan waits until your paid days end. You keep what you already have; you just can&rsquo;t add
                        past its limits.
                      </p>
                    ) : null}
                    <div className="pt-4">
                      <p className="hc-k2">What you pay</p>
                      <div className="pt-2">
                        {!p.paid ? (
                          <PayRow title="Nothing to pay" line={p.pickLine} pesos={null} />
                        ) : price === undefined ? (
                          <PayRow title="Not sold on this cycle right now" line="Pick the other one above" pesos={null} />
                        ) : tooShort ? (
                          <PayRow title="Pick a longer term" line={tooShort} pesos={null} />
                        ) : (
                          <>
                            <PayRow
                              title="Today"
                              line={today?.line ?? p.pickLine}
                              pesos={today && today.amount !== null ? today.amount : null}
                            />
                            <PayRow
                              title="Then"
                              line={`${EVERY_WORD[cycle]}${dir === 'down' && expiresOn ? ` from ${expiresOn}` : ''}`}
                              pesos={price}
                              cycle={cycle}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    {p.key === 'verified' && !verified ? (
                      <div className="pt-3">
                        <ActionButton tone="brand" main icon={BadgeCheck} label="Get verified" href="/vendor-dashboard/profile#docs" />
                      </div>
                    ) : null}
                    {p.paid ? (
                      <div className="pt-3">
                        {dir === 'down' && p.fit && verified && !storeShell && price !== undefined && !tooShort ? (
                          <LowerPlanSwitch fit={p.fit} switchForm={button(p, 'down')} endsOn={expiresOn} />
                        ) : (
                          button(p, dir === 'up' ? 'up' : 'down')
                        )}
                      </div>
                    ) : null}
                    {p.paid && verified && !storeShell && price !== undefined && !tooShort ? (
                      <p className="pt-2 text-[13px] text-[color:var(--m-slate-2)]">
                        You pay by GCash or bank and log it; {p.name} turns on when Setnayan confirms it.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </Fold>
          </div>
        );
      })}
    </div>
  );
}
