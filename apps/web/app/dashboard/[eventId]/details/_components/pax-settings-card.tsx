'use client';

import { useState, useTransition } from 'react';
import { CalendarClock } from 'lucide-react';
import { updatePaxSettings } from '../../actions';

/**
 * Adaptive Pax Pricing couple settings (decisions #5 + #6). Two controls:
 *  - Guest-list edit deadline: after it, the count auto-finalizes and vendor
 *    costs become binding. Blank = the default (14 days before the event).
 *  - Pricing view: realtime (see costs adapt as the count grows) vs final-only
 *    (hold at the floor; settle once at finalization).
 * Couple-settable (the finalize LOCK itself stays service-role-only).
 */
export function PaxSettingsCard({
  eventId,
  deadline,
  mode,
}: {
  eventId: string;
  deadline: string | null;
  mode: 'realtime' | 'final_only';
}) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('event_id', eventId);
        setSaved(false);
        setErr(null);
        start(async () => {
          const res = await updatePaxSettings(fd);
          if (res.ok) setSaved(true);
          else setErr(res.message);
        });
      }}
      className="space-y-4 rounded-xl border border-ink/10 bg-cream p-4"
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-terracotta" strokeWidth={1.75} aria-hidden />
        <h3 className="text-base font-semibold text-ink">Guest list &amp; pricing</h3>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">Guest-list edit deadline</span>
        <span className="mt-0.5 block text-xs text-ink/55">
          After this date your count finalizes and vendor costs become binding. Leave
          blank to use the default (14 days before your event).
        </span>
        <input
          type="date"
          name="guest_list_edit_deadline"
          defaultValue={deadline ?? ''}
          className="input-field mt-2 sm:w-56"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">How you see costs</legend>
        {[
          {
            value: 'realtime',
            label: 'Realtime',
            help: 'See vendor costs adapt as your confirmed count grows.',
          },
          {
            value: 'final_only',
            label: 'Final only',
            help: 'Hold at the base; see the adjustment once at finalization.',
          },
        ].map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink/10 p-3 hover:border-ink/25"
          >
            <input
              type="radio"
              name="adaptive_pricing_mode"
              value={opt.value}
              defaultChecked={mode === opt.value}
              className="mt-0.5 h-4 w-4 accent-terracotta"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{opt.label}</span>
              <span className="block text-xs text-ink/55">{opt.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        {err ? <span className="text-sm text-rose-700">{err}</span> : null}
      </div>
    </form>
  );
}
