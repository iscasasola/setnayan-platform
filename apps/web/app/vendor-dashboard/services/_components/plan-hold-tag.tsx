import { InfoTip } from '@/app/_components/info-tip';
import { HOLD_WORDS } from '@/lib/service-plan-hold';

/**
 * The tag a card wears on the supplier's own Services list while the PLAN holds it (owner 2026-11-06, SERVICES LIFE
 * CYCLE): "On hold" in place of the on/off switch — the database refuses a held card live, so a switch would be a
 * button that cannot work. The tag opens "Which services stay on" (where it comes back); the why is in the ⓘ.
 */
export function PlanHoldTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" data-plan-hold-tag="">
      <a
        href="#stay-on"
        className="inline-flex min-h-11 items-center rounded-full px-3 text-[12px] font-medium"
        style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
      >
        {HOLD_WORDS.tag}
      </a>
      <InfoTip label="" ariaLabel="Why this service is on hold" align="end">
        {HOLD_WORDS.tip}
      </InfoTip>
    </span>
  );
}
