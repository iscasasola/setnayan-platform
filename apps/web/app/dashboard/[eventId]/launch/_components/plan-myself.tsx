import { setPlanningMode } from '@/app/dashboard/[eventId]/actions';
import { PLAN_MYSELF_LABEL } from '@/lib/plan-myself';

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
    <div className="sn-tile w-full max-w-sm p-5" data-plan-myself-body="">
      <p className="text-sm font-semibold text-ink">The automatic help</p>
      <ul className="mt-3 divide-y divide-ink/5">
        {HELP.map((h) => (
          <li key={h} className="flex items-center justify-between py-2 text-sm">
            <span className="text-ink/75">{h}</span>
            <span className="font-medium text-ink/60">{on === null ? '—' : on ? 'Off' : 'On'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The right: the one switch. */
export function PlanMyselfSwitch({ eventId, on }: { eventId: string; on: boolean | null }) {
  if (on === null) {
    return <p className="text-sm text-ink/60">Could not load this. Refresh the page to try again.</p>;
  }
  return (
    <form action={setPlanningMode} className="flex flex-col gap-3" data-plan-myself="">
      <input type="hidden" name="event_id" value={eventId} />
      {/* The mode this tap SETS — the opposite of what is on now. */}
      <input type="hidden" name="mode" value={on ? 'guided' : 'manual'} />
      {/* The profile page's switch, as it is (`profile/page.tsx` — a server form, no JS). */}
      <div className="flex items-center justify-between gap-4">
        <span id="plan-myself-label" className="text-sm font-medium text-ink">
          {PLAN_MYSELF_LABEL}
        </span>
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-labelledby="plan-myself-label"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            on ? 'bg-terracotta' : 'bg-ink/20'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-5 w-5 transform rounded-full bg-cream shadow transition-transform ${
              on ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <p className="text-[13px] text-ink/60">
        On: Setnayan stops matching suppliers for you and stops deadline reminders. Free — turn it off any time.
      </p>
    </form>
  );
}
