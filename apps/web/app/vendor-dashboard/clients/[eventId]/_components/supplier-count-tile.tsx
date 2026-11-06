/**
 * Lives in its own file so `/dev/customer-money-lab?count=…` draws the SAME tile on fixture data.
 */
import { InfoTip } from '@/app/_components/info-tip';
import { breakdownWords, countNoun, ruleRoleLabels, ruleWords } from '@/lib/supplier-count';
import type { RoleNames } from '@/lib/role-names';
import type { SupplierHeadcount } from '@/lib/supplier-count';

/**
 * 🧮 "N to serve" / "N to give" — a per-head supplier's count (owner 2026-11-04: *"a supplier can count what they need
 * to give … we only count the attending principal sponsors"*). The breakdown is the ⓘ; the rows say the rule, how many
 * the couple left out (never who), and that it moves with every reply. Its number IS the brief's `pax.attending`: one
 * SQL helper (`guests_not_counted_for_services`) feeds both.
 */
export function SupplierCountTile({ count, names = null }: { count: SupplierHeadcount; names?: RoleNames | null }) {
  // The rule in the couple's words ("Only Bride's Crew"), as the couple's own sheet says it.
  const labels = [...ruleRoleLabels(count.roles, names), ...count.groups];
  return (
    <div data-supplier-count={count.counted}>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{count.counted}</p>
          <div className="text-sm text-ink/60">
            <InfoTip label={countNoun(count.category)} align="start">
              {breakdownWords(count)}
            </InfoTip>
          </div>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums text-ink/45">{count.attending}</p>
          <p className="text-sm text-ink/60">attending the event</p>
        </div>
      </div>
      <dl className="mt-3 text-sm">
        <div className="flex items-start justify-between gap-3 border-t border-ink/10 py-2">
          <dt className="text-ink/55">Their rule</dt>
          <dd className="text-right font-medium" data-supplier-count-rule="">{ruleWords(count.mode, labels)}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-ink/10 py-2">
          <dt className="text-ink/55">Not counted</dt>
          <dd className="text-right font-medium">
            {count.notCounted} {count.notCounted === 1 ? 'guest' : 'guests'}
            <small className="block text-xs font-normal text-ink/50">The couple picked them · names stay private</small>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-ink/10 py-2">
          <dt className="text-ink/55">Moves with</dt>
          <dd className="text-right font-medium">
            Every reply
            <small className="block text-xs font-normal text-ink/50">The number updates as guests answer</small>
          </dd>
        </div>
      </dl>
    </div>
  );
}

