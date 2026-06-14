import Link from 'next/link';

/**
 * SubscriptionCycleToggle — monthly / annual switch for the subscription cards.
 *
 * Pure-link toggle (no client JS): each option is a <Link> to the same page
 * with a different ?cycle= so the server re-renders the cards at the chosen
 * cadence. Annual carries a "save" hint since it's ~2 months free vs monthly.
 */
export function SubscriptionCycleToggle({
  cycle,
}: {
  cycle: 'monthly' | 'annual';
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <CycleLink active={cycle === 'monthly'} target="monthly" label="Monthly" />
      <CycleLink
        active={cycle === 'annual'}
        target="annual"
        label="Annual"
        hint="save ~2 months"
      />
    </div>
  );
}

function CycleLink({
  active,
  target,
  label,
  hint,
}: {
  active: boolean;
  target: 'monthly' | 'annual';
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={`/vendor-dashboard/subscription?cycle=${target}`}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={
        'rounded-full px-4 py-1.5 text-sm transition ' +
        (active
          ? 'bg-ink text-paper sn-bounce'
          : 'text-ink/65 hover:text-ink')
      }
    >
      {label}
      {hint && (
        <span className={'ml-1.5 text-[11px] ' + (active ? 'text-paper/70' : 'text-orange')}>
          {hint}
        </span>
      )}
    </Link>
  );
}
