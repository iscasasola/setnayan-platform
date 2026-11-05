import { Award } from 'lucide-react';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { SubmitButton } from '@/app/_components/submit-button';
import { TakeBackReasonField } from './take-back-reason-field';
import { revokeBadgeFeeWaiver } from '@/app/admin/gifts/badge-reward-actions';
import { formatPhp } from '@/lib/php';
import { FREE_FEE_TITLE, rewardSourceWords, rewardWords, type RewardNames } from '@/lib/badge-rewards';
import type { BadgeRewardLedgerRow } from '@/lib/badge-rewards.server';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

/** Where a reward stands: in the shop's gifts · a free fee waiting / used on a booking / taken back. */
function stateWords(r: BadgeRewardLedgerRow): string {
  if (r.kind !== 'fee_waiver') return 'In their gifts';
  if (r.revokedAt) return `Taken back ${fmtDay(r.revokedAt)}`;
  if (r.usedAt) {
    const who = r.usedOn?.coupleName ? ` on ${r.usedOn.coupleName}` : '';
    const was = r.usedOn?.wouldHaveBeenPhp != null ? ` · fee ${formatPhp(r.usedOn.wouldHaveBeenPhp)} → ₱0` : '';
    const gift = r.setnayanGiftCredits ? ` · Setnayan gift ${r.setnayanGiftCredits} photos, on us` : '';
    return `Used ${fmtDay(r.usedAt)}${who}${was}${gift}`;
  }
  if (r.returnedAt) return `Given back ${fmtDay(r.returnedAt)} (booking cancelled) · waiting again`;
  return 'Waiting for their next booking with a fee';
}

/**
 * 🏅 ADMIN › GIFTS & COMPS › BADGE REWARDS (owner 2026-11-05) — every reward a badge gave a shop, newest first: what
 * it was, which badge step, and where it stands. Papic / Event Plus / Event Pro sit in the shop's gift stock (also
 * listed as "Badge reward" rows in the supplier gift ledger above). A FREE BOOKING FEE can be taken back here while it
 * is unused (`revokeBadgeFeeWaiver`); a used one already made its booking's fee ₱0. Presentational — the page reads.
 */
export function BadgeRewardsLedger({
  rows,
  readError,
  names,
}: {
  rows: BadgeRewardLedgerRow[] | null;
  readError: { message: string } | null;
  names: RewardNames;
}) {
  return (
    <section className="mb-10" data-admin-badge-rewards="">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">Badge rewards</h2>
      <p className="mb-4 text-xs text-ink/60">
        What each badge gave a shop — once per badge step, never expiring. They sit outside a booking&rsquo;s gift limit.
        A free booking fee is used by itself on the shop&rsquo;s next booking that would carry a fee (never one already
        free) and can be taken back while unused.
      </p>
      <ConsoleTable<BadgeRewardLedgerRow>
        rows={rows}
        readError={readError}
        readPermitted
        reads="the badge rewards"
        label="Badge rewards"
        cap={200}
        minWidth="40rem"
        rowKey={(r) => r.rewardId}
        empty={{
          Icon: Award,
          title: 'No badge has paid a reward yet',
          blurb: 'A reward lands here the first time a shop’s badge step is read as earned.',
        }}
        columns={[
          { header: 'When', mono: true, cell: (r) => fmtDay(r.grantedAt) },
          { header: 'Shop', cell: (r) => r.shopName ?? r.vendorProfileId },
          { header: 'Badge', cell: (r) => rewardSourceWords(r.key) },
          {
            header: 'Reward',
            cell: (r) => (r.kind === 'fee_waiver' ? FREE_FEE_TITLE : rewardWords({ kind: r.kind, units: r.units }, names)),
          },
          { header: 'Where it stands', cell: (r) => stateWords(r) },
          {
            header: 'Take back',
            align: 'right',
            cell: (r) =>
              r.kind === 'fee_waiver' && !r.usedAt && !r.revokedAt ? (
                <form action={revokeBadgeFeeWaiver} className="inline-flex items-center gap-1" data-admin-badge-revoke="">
                  <input type="hidden" name="reward_id" value={r.rewardId} />
                  <TakeBackReasonField />
                  <SubmitButton className="text-xs font-medium text-mulberry hover:underline" overlay={false} pendingLabel="…">
                    Take back
                  </SubmitButton>
                </form>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </section>
  );
}
