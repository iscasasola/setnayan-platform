import type { ReactNode } from 'react';
import { Fold } from '@/app/_components/fold';
import { DatesRow } from '../../customers/_components/dates-row';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { planWord } from '@/lib/vendor-plan-change-words';
import type { PlanLine, PlanRowBadge } from '@/lib/vendor-plan-rows';

/**
 * THE PLAN SCREEN'S ROWS (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14; prototype SCREENS.plan):
 *
 *   You are on <plan> · <what you pay> · until <date>          (the answer line)
 *   Your plan ▾ · Cycle ▾ · What you pay [Pay]                 (`PlanPicker`, handed in)
 *   Booking fee — the live schedule · "N of 5 used" / Waived   (`bookingFeeRow`)
 *   What <plan> gives you ▾ — read from the plan table         (`planGivesLines`)
 *   Receipts ▾ — paid plan orders, each to /receipts/<id>
 *   Add-ons › (#add-ons — the shipped cards below) · Papic credits › (Event Hub) · Featured by Setnayan ·
 *   Custom plan › · Cancel the plan (nothing renews by itself)
 *
 * Presentational: every value arrives read; nothing here fetches or writes. The page and `/dev/supplier-plan-lab`
 * both mount it, so the lab shows what ships.
 */
export function PlanRows({
  tier,
  pays,
  expiresOn,
  expiresSoon,
  isPaid,
  notices,
  picker,
  feeRow,
  gives,
  receipts,
  papicPackPrice,
  featured,
}: {
  tier: string;
  pays: string;
  expiresOn: string | null;
  expiresSoon: boolean;
  isPaid: boolean;
  notices?: ReactNode;
  picker: ReactNode;
  feeRow: { line: string; badge: PlanRowBadge | null } | null;
  gives: readonly PlanLine[];
  /** Paid plan orders, newest first; `null` = the read failed (said, never "none"). */
  receipts: readonly { key: string; title: string; line: string; receiptId: string | null }[] | null;
  papicPackPrice: number | null;
  featured: boolean;
}) {
  return (
    <>
      <h1 className="sn-h1">Your plan</h1>
      <p className="mt-2 text-[15px] text-ink" data-plan-answer="">
        <b className="font-semibold">You are on {planWord(tier)}</b> · {pays}
        {expiresOn ? <span className={expiresSoon ? 'font-medium text-orange' : 'text-ink/60'}> · until {expiresOn}</span> : null}
      </p>

      {notices ? <div className="mt-3 space-y-3">{notices}</div> : null}

      <div className="mt-3" data-plan-rows="">
        {picker}

        {feeRow ? (
          <DatesRow data="plan-booking-fee" title="Booking fee" line={feeRow.line} badge={feeRow.badge} href={VENDOR_BOOKING_FEES_PATH} />
        ) : null}

        <div className="border-t border-ink/10" data-plan-fold="gives">
          <Fold title={`What ${planWord(tier)} gives you`} line="Read from your plan" data="plan-gives">
            <div className="pb-3">
              {gives.map((g) => (
                <DatesRow key={g.key} data="plan-gives-row" title={g.title} line={g.line} />
              ))}
            </div>
          </Fold>
        </div>

        <div className="border-t border-ink/10" data-plan-fold="receipts">
          <Fold
            title="Receipts"
            line={
              receipts === null
                ? 'Couldn’t load — nothing is lost'
                : receipts.length > 0
                  ? `${formatCount(receipts.length)} · last ${receipts[0]?.line.split(' · ')[0] ?? ''}`
                  : 'None yet'
            }
            data="plan-receipts"
          >
            <div className="pb-3">
              {receipts === null ? (
                <p className="py-2 text-[13.5px] text-ink/70" role="status">
                  Your plan receipts couldn&rsquo;t load. Reload to try again — nothing you paid has changed.
                </p>
              ) : receipts.length === 0 ? (
                <p className="py-2 text-[13.5px] text-ink/60">Nothing paid for a plan yet.</p>
              ) : (
                receipts.map((r) => (
                  <DatesRow
                    key={r.key}
                    data="plan-receipt"
                    title={r.title}
                    line={r.line}
                    href={r.receiptId ? `/receipts/${r.receiptId}` : null}
                    badge={r.receiptId ? null : { tone: 'quiet', word: 'Paid' }}
                  />
                ))
              )}
            </div>
          </Fold>
        </div>

        <DatesRow data="plan-add-ons" title="Add-ons" line="AI replies · 3D booth · Papic Challenges · Deep Search" href="#add-ons" />
        <DatesRow
          data="plan-papic-credits"
          title="Papic credits"
          line={
            papicPackPrice !== null
              ? `Buy 100 for ${formatPhp(papicPackPrice)} · for each booked event, in its Event Hub`
              : 'Bought for each booked event, in its Event Hub'
          }
          href="/vendor-dashboard/on-the-day"
        />
        <DatesRow
          data="plan-boost"
          title="Featured by Setnayan"
          line={featured ? 'Setnayan features your work in its stories' : 'Setnayan features Pro shops in its stories'}
          badge={featured ? { tone: 'ok', word: 'On' } : { tone: 'quiet', word: 'Pro' }}
        />
        <DatesRow
          data="plan-custom"
          title="Custom plan"
          line={tier === 'custom' ? 'Yours · branches, reach, seats' : 'Branches · reach · seats — beyond Enterprise'}
          href="/vendor-dashboard/subscription/custom"
        />
        <DatesRow
          data="plan-cancel"
          title="Cancel the plan"
          line={
            isPaid
              ? expiresOn
                ? `Nothing renews by itself — skip the next payment and you are on Free after ${expiresOn}`
                : 'Nothing renews by itself — skip the next payment and you are on Free'
              : 'You are on Free — there is nothing to cancel'
          }
        />
      </div>
    </>
  );
}
