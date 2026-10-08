import { PillLink, PillTrack } from '@/app/_components/pill-track';

/**
 * SubscriptionCycleToggle — monthly / annual switch for the subscription cards.
 *
 * Pure-link toggle: each option is a link to the same page with a different
 * ?cycle= so the server re-renders the cards at the chosen cadence (it works
 * before any JavaScript has loaded). Annual carries a "save" hint since it's
 * ~2 months free vs monthly.
 *
 * Drawn by the app's ONE pill selector (owner 2026-10-08,
 * `app/_components/pill-track.tsx`): the picked side is the terracotta and the
 * thumb slides to it. The picked link now says `aria-current="page"` (it said
 * "true") — that is the word the thumb reads, and the right one for a link to
 * the page you are on.
 */
export function SubscriptionCycleToggle({
  cycle,
}: {
  cycle: 'monthly' | 'annual';
}) {
  return (
    <PillTrack data-cycle-toggle="">
      <CycleLink active={cycle === 'monthly'} target="monthly" label="Monthly" />
      <CycleLink
        active={cycle === 'annual'}
        target="annual"
        label="Annual"
        hint="save 20%"
      />
    </PillTrack>
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
    <PillLink
      on={active}
      href={`/vendor-dashboard/subscription?cycle=${target}`}
      scroll={false}
      aria-current={active ? 'page' : undefined}
      className="px-4"
    >
      {label}
      {hint && (
        <span className={'ml-0.5 text-[11px] font-medium ' + (active ? 'text-white/80' : 'text-orange')}>
          {hint}
        </span>
      )}
    </PillLink>
  );
}
