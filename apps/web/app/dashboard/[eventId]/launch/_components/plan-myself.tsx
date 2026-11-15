import { setPlanningMode } from '@/app/dashboard/[eventId]/actions';
import { PLAN_MYSELF_LABEL } from '@/lib/plan-myself';
import { InfoTip } from '@/app/_components/info-tip';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { SafeForm } from '@/app/dashboard/[eventId]/_components/safe-form';

/**
 * 🙋 PLAN IT MYSELF — Details › Your event (owner 2026-10-02, tracker d4:
 * *"one free 'Plan it myself' switch in Your info for every host (turns the
 * automatic help off; not only for Setnayan AI buyers)"*).
 *
 * 🔑 ONE STORE. This writes `events.planning_mode` through `setPlanningMode` —
 * the very action the Setnayan AI page's "Switch to manual planning" and "Turn
 * on Assisted planning" post — and `isSetnayanAiActive` reads it everywhere
 * the automatic help is drawn (supplier matching and ranking, deadlines, the
 * reminder emails). On = 'manual'. Free: it is not a purchase and not a
 * cancellation; whatever was bought stays bought.
 *
 * `on` null = the read failed: say so, offer no switch (a switch drawn from a
 * guess would flip the wrong way).
 */
const HELP = ['Supplier matching', 'Deadlines', 'Reminders'] as const;

/** The middle: what the switch turns on and off, in plain words. */
export function PlanMyselfBody({ on }: { on: boolean | null }) {
  return (
    <div className="w-full max-w-sm" data-plan-myself-body="">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/70">The automatic help</p>
      <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
        {HELP.map((h) => (
          <li key={h} className="flex min-h-14 items-center justify-between text-[15px]">
            <span className="font-semibold text-ink">{h}</span>
            <span className="font-medium text-ink/70">{on === null ? '—' : on ? 'Off' : 'On'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The right: the one switch. */
export function PlanMyselfSwitch({ eventId, on }: { eventId: string; on: boolean | null }) {
  if (on === null) {
    return <p role="status" className="text-sm text-warn-800">Couldn&rsquo;t check this &mdash; not the same as off. Refresh the page to try again.</p>;
  }
  return (
    <SafeForm action={setPlanningMode} className="flex flex-col gap-3" data-plan-myself="">
      <input type="hidden" name="event_id" value={eventId} />
      {/* The mode this tap SETS — the opposite of what is on now. */}
      <input type="hidden" name="mode" value={on ? 'guided' : 'manual'} />
      {/* The profile page's switch, as it is (`profile/page.tsx` — a server form, no JS). */}
      <div className="flex items-center justify-between gap-4">
        <InfoTip
          label={PLAN_MYSELF_LABEL}
          labelId="plan-myself-label"
          labelClassName="text-[15px] font-semibold text-ink"
          align="start"
        >
          On: Setnayan stops matching suppliers for you and stops deadline reminders. Free — turn it off any time.
        </InfoTip>
        <button type="submit" role="switch" aria-checked={on} aria-labelledby="plan-myself-label" className={SWITCH_BUTTON}>
          <SwitchTrack on={on} />
        </button>
      </div>
    </SafeForm>
  );
}
