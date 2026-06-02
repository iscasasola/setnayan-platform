'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { updateEventMatchCriteria } from '../../actions';
import { REGION_OPTIONS, FEEL_OPTIONS } from '@/lib/match-criteria';

/**
 * DetailsForm — edits the governance-free basics on the Personalization page:
 * couple names + the curated match criteria (region, mood/feel, budget) the
 * Home "Personalized" block shows. CLAUDE.md 2026-06-02 "do both" step 1 +
 * Phase B (names added).
 *
 * Date / ceremony / venue / guest-count are NOT here — they carry the
 * booked-vendor change-flow governance and keep their own governed editors
 * (the parent page surfaces the CeremonyTypeChip + deep-links the date to
 * /date-selection). Everything in THIS form binds no vendor, so it's a plain
 * save; names also recompute the display label (chrome) server-side.
 *
 * Calls the result-returning `updateEventMatchCriteria` server action via
 * useTransition; shows inline saved/error states. Clean Editorial palette.
 */
export function DetailsForm({
  eventId,
  initialBride,
  initialGroom,
  initialRegion,
  initialFeel,
  initialBudgetPesos,
}: {
  eventId: string;
  initialBride: string;
  initialGroom: string;
  initialRegion: string;
  initialFeel: string;
  initialBudgetPesos: string;
}) {
  const [bride, setBride] = useState(initialBride);
  const [groom, setGroom] = useState(initialGroom);
  const [region, setRegion] = useState(initialRegion);
  const [feel, setFeel] = useState(initialFeel);
  const [budget, setBudget] = useState(initialBudgetPesos);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectClass =
    'w-full rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('bride_name', bride.trim());
    fd.set('groom_name', groom.trim());
    fd.set('region', region);
    fd.set('mood_feel_key', feel);
    fd.set('budget_pesos', budget.replace(/[, ]/g, ''));
    startTransition(async () => {
      const res = await updateEventMatchCriteria(fd);
      if (res.ok) {
        setSaved(true);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="bride_name" className="block text-xs font-medium text-ink/70">
            Bride
          </label>
          <input
            id="bride_name"
            type="text"
            maxLength={80}
            value={bride}
            onChange={(ev) => {
              setBride(ev.target.value);
              setSaved(false);
            }}
            placeholder="First name"
            className={selectClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="groom_name" className="block text-xs font-medium text-ink/70">
            Groom
          </label>
          <input
            id="groom_name"
            type="text"
            maxLength={80}
            value={groom}
            onChange={(ev) => {
              setGroom(ev.target.value);
              setSaved(false);
            }}
            placeholder="First name"
            className={selectClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="region" className="block text-xs font-medium text-ink/70">
          Region
        </label>
        <select
          id="region"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setSaved(false);
          }}
          className={selectClass}
        >
          <option value="">Not set</option>
          {REGION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink/50">Where your wedding is — helps us match vendors near you.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="feel" className="block text-xs font-medium text-ink/70">
          Style &amp; feel
        </label>
        <select
          id="feel"
          value={feel}
          onChange={(e) => {
            setFeel(e.target.value);
            setSaved(false);
          }}
          className={selectClass}
        >
          <option value="">Not set</option>
          {FEEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink/50">The overall look you&apos;re going for.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="budget" className="block text-xs font-medium text-ink/70">
          Budget (₱)
        </label>
        <input
          id="budget"
          type="text"
          inputMode="numeric"
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value.replace(/[^0-9, ]/g, ''));
            setSaved(false);
          }}
          placeholder="e.g. 800,000"
          className={selectClass}
        />
        <p className="text-[11px] text-ink/50">A working figure — refine it anytime. Leave blank if undecided.</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl bg-mulberry px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save basics'}
        </button>
        {saved && !pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
