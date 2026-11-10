import { MapPin, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormCounter } from '@/app/_components/form-counter';
import { StayForm } from '@/app/_components/stay-form';
import { DAILY_STEP_N, type SetupDailyView } from '@/lib/supplier-setup';
import { SET_HOW_MANY_A_DAY_HREF } from '@/lib/vendor-dates';
import { StepChip } from './supplier-setup-folds';

/** Your halls live in the Clients ⚙ too — a venue whose schedules are all halls opens it there. */
export const YOUR_HALLS_HREF = '/vendor-dashboard/customers?seg=dates&gear=1';

/**
 * 7️⃣ STEP 7 — "How many events can you take on one day?" (venues: "How many halls?"), a stepper from 1, on Today under
 * the six steps (owner 10 Nov 2026, Build 6 Lane E; prototype v119 `todayNew` row `data-step="7"`). The view is decided
 * once in `setupDailyView` (`lib/supplier-setup.ts`).
 *
 * 🔁 NOT A SECOND FIELD: each stepper is the Clients ⚙ › How many a day one — the shipped `FormCounter` in a `StayForm`
 * posting `updatePoolCapacity` (`vendor_schedule_pools.daily_booking_capacity`), saved a pause after the last tap, in
 * place (the door reads the action's own answer; the action revalidates Today). The lab writes nothing: its stepper
 * moves and says so.
 *
 * 🔒 app/vendor-dashboard/_components/setup-step-7-is-how-many-a-day.test.ts
 */
export function SetupDailyStep({
  view,
  ceiling,
  action,
  lab = false,
}: {
  view: SetupDailyView;
  /** The database's ceiling (`DAILY_CAPACITY_MAX`) — no plan limit (owner 2026-10-23). */
  ceiling: number;
  /** The shipped `updatePoolCapacity` (null in the lab). */
  action: ((fd: FormData) => Promise<void>) | null;
  lab?: boolean;
}) {
  const one = view.state === 'set' && view.rows.length === 1 ? view.rows[0]! : null;
  const counter = (r: SetupDailyView['rows'][number], label: string) =>
    lab || !action ? (
      <span className="flex flex-none" data-setup-daily-lab="">
        <FormCounter name="capacity" value={r.capacity} min={1} max={Math.max(ceiling, r.capacity)} label={label} data="setup-daily" />
      </span>
    ) : (
      <StayForm door="supCalendar.updatePoolCapacity" action={action} className="flex-none">
        <input type="hidden" name="pool_id" value={r.poolId} />
        <FormCounter
          name="capacity"
          value={r.capacity}
          min={1}
          max={Math.max(ceiling, r.capacity)}
          label={label}
          saveAfterMs={900}
          data="setup-daily"
        />
      </StayForm>
    );

  return (
    <div className="py-2" data-setup-daily={view.state} data-setup-step="7">
      <div className="flex min-h-[52px] items-center gap-2">
        <StepChip n={DAILY_STEP_N} done={false} open={false} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-ink">{view.title}</span>
          <span
            className="block text-[13px] leading-snug"
            style={{ color: view.state === 'unread' ? 'rgb(var(--color-danger))' : undefined }}
            data-setup-daily-line=""
          >
            <span className={view.state === 'unread' ? '' : 'text-ink/60'}>{view.line}</span>
          </span>
        </span>
        {one ? counter(one, view.title) : null}
      </div>

      {view.state === 'set' && !one ? (
        <div className="ml-11 divide-y divide-ink/10" data-setup-daily-rows="">
          {view.rows.map((r) => (
            <div key={r.poolId} className="flex min-h-[52px] items-center gap-3" data-setup-daily-row={r.poolId}>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{r.name}</span>
              {counter(r, `${r.name} — how many a day`)}
            </div>
          ))}
        </div>
      ) : null}

      {view.state === 'not_set' || view.state === 'halls' ? (
        <div className="ml-11 pb-1 pt-1">
          <ActionButton
            tone="brand"
            main
            // A ready element, never the icon function — this is drawn on the server and handed to a client button.
            icon={view.state === 'halls' ? <MapPin strokeWidth={1.75} /> : <Users strokeWidth={1.75} />}
            label={view.state === 'halls' ? 'Your halls' : 'Set it'}
            href={view.state === 'halls' ? YOUR_HALLS_HREF : SET_HOW_MANY_A_DAY_HREF}
            data-setup-daily-door=""
          />
        </div>
      ) : null}

      {lab ? (
        <p className="ml-11 pt-1 text-[12.5px] text-ink/55" data-setup-daily-lab-note="">
          Lab: the number moves; nothing is saved.
        </p>
      ) : null}
    </div>
  );
}
