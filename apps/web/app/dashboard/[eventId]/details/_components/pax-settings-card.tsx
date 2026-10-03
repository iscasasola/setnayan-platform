'use client';

import { useState, useTransition } from 'react';
import { CalendarClock } from 'lucide-react';
import { updatePaxSettings } from '../../actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * Adaptive Pax Pricing couple settings (decisions #5 + #6) — in Event settings,
 * ONE control: the pricing view, realtime (see costs adapt as the count grows)
 * vs final-only (hold at the floor; settle once at finalization).
 *
 * 📅 The guest-list edit deadline is NOT edited here (audit HOLD on train d,
 * 2026-10-02: it was asked twice). Its one place is the Maker's RSVP item,
 * "Reply by" (`maker-rsvp-ask.tsx`). `updatePaxSettings` writes BOTH columns on
 * every save, so this form carries the stored deadline as a hidden value. Without
 * it, saving the cost view would blank the date (empty = "clear it") —
 * `lib/pax-settings-form.ts`, held by `the-settings-card-keeps-the-deadline.test.ts`.
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
  const save = useSaveLoader();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('event_id', eventId);
        setSaved(false);
        setErr(null);
        start(async () => {
          const res = await save.run(() => updatePaxSettings(fd), {
            steps: ['Saving your settings'],
            hint: 'Saving',
          });
          if (res.ok) setSaved(true);
          else setErr(res.message);
        });
      }}
      className="space-y-4 rounded-xl border border-ink/10 bg-cream p-4"
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-terracotta" strokeWidth={1.75} aria-hidden />
        <h3 className="text-base font-semibold text-ink">Pricing</h3>
      </div>

      {/* The stored date rides along unchanged — the action writes both columns. */}
      <input type="hidden" name="guest_list_edit_deadline" value={deadline ?? ''} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">How you see costs</legend>
        {[
          {
            value: 'realtime',
            label: 'Realtime',
            help: 'See supplier costs adapt as your confirmed count grows.',
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
        {saved ? <span className="text-sm text-success-700">Saved.</span> : null}
        {err ? <span className="text-sm text-danger-700">{err}</span> : null}
      </div>
    </form>
  );
}
