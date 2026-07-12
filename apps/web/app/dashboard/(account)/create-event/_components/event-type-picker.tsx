'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { createWeddingEvent } from '../actions';
import { type EventTypeKey, type EventTypeRow } from './event-types';
import { EventTypePhotoPicker } from './event-type-photo-picker';
import { CreateDatePicker } from './create-date-picker';
import { type BudgetBand } from '@/lib/budget-bands-shared';

/* Retired 2026-05-28 V2 cutover — the DIY / Concierge ₱2,499 / 3-day-trial
   choice card is gone. Every new event lands in DIY by default; the hidden
   `concierge_choice` field is always 'diy' here for continuity with the
   createWeddingEvent server-action signature. */
type ConciergeChoice = 'diy';

/**
 * Create-event surface — a GRID of "feel photo" tiles (owner 2026-07-10: "just
 * show a grid of the different events — maximize screen space for both mobile
 * and desktop"; supersedes the 2026-06-04 swipe-carousel picker). Selecting a
 * type jumps STRAIGHT into that event's own onboarding when one exists
 * (`onboardingHref`); otherwise it falls back to the inline name form so the
 * event still creates today.
 *
 * Wedding → /onboarding/wedding (the 15-screen guided flow). The other eight
 * types route into their tailored onboarding as it lands (Debut next); until
 * then they use the inline form, which createWeddingEvent commits with NULL
 * wedding-specific columns.
 *
 * The old per-surface WeddingTypePicker / wedding_type_launch_status path was
 * already dead (Wedding showed a "Continue →" card, never this form). The orphaned
 * wedding-type-picker.tsx component was deleted 2026-06-15 — the tailored
 * /onboarding/wedding flow is the one and only wedding onboarding now.
 */
export function EventTypePicker({
  types,
  budgetBands,
  next,
  preselect,
}: {
  types: EventTypeRow[];
  /** Budget feel-bands for the optional budget picker on the inline (non-wedding)
   *  create form. Server-fetched (getBudgetBands) so it matches onboarding. */
  budgetBands: BudgetBand[];
  next?: string;
  /** A QR-provided event type (Locked/Shortlist fast-lane): auto-advance past
   *  the type carousel so the couple never re-picks what the QR already knows. */
  preselect?: string;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  const conciergeChoice: ConciergeChoice = 'diy';
  const formRef = useRef<HTMLFormElement | null>(null);
  const autoAdvanced = useRef(false);

  const selected = selectedKey
    ? (types.find((t) => t.key === selectedKey) ?? null)
    : null;

  // Inline name-form fallback (types without their own onboarding, exp-quiz
  // flag off) mounts BELOW the photo grid — on a phone that's past the fold, so
  // the tap looked dead ("the picker isn't clickable"). Bring the form into view
  // and focus its field the moment a type is chosen, so every tap is visibly
  // acknowledged. (owner bug 2026-06-28)
  useEffect(() => {
    if (!selectedKey) return;
    const form = formRef.current;
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.querySelector<HTMLInputElement>('#display_name')?.focus({ preventScroll: true });
  }, [selectedKey]);

  // Carry an internal return path (vendor-invite claim loop) THROUGH the tailored
  // onboarding routes, so a 0-event couple who picks Wedding here lands back on
  // /vendor-invite/[slug] after committing. The inline name form below already
  // threads `next` via a hidden field; this covers the onboardingHref branch.
  function withNext(href: string): string {
    if (!next) return href;
    return `${href}${href.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
  }

  function handleSelect(type: EventTypeRow) {
    if (!type.enabled) return;
    if (type.onboardingHref) {
      // REPLACE (not push) so this legacy event-type picker never lingers in history
      // as a Back target behind the tailored onboarding — backing out of onboarding at
      // its first screen returns to the dashboard, never "the old onboarding page".
      // (owner bug 2026-06-15)
      router.replace(withNext(type.onboardingHref));
      return;
    }
    // Iteration 0053 Phase 3: non-wedding types route into the generic experience
    // onboarding (/onboarding/[type]) when the experience-quiz flag is on; with it
    // off the route 404s, so we fall back to the inline name form. Wedding never
    // reaches here (its onboardingHref branch above is byte-identical / unchanged).
    if (experienceQuizEnabled() && type.key !== 'wedding') {
      router.replace(withNext(`/onboarding/${type.key}`));
      return;
    }
    setSelectedKey(type.key);
  }

  // QR fast-lane: once, on mount, jump straight to the pre-selected type's flow
  // (wedding → its onboarding, non-wedding → inline / experience) so the grid
  // is skipped. handleSelect is hoisted; safe to call from the effect.
  useEffect(() => {
    if (autoAdvanced.current || !preselect) return;
    const type = types.find((t) => t.key === preselect);
    if (!type || !type.enabled) return;
    autoAdvanced.current = true;
    handleSelect(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  return (
    <>
      <section aria-label="Event type">
        <EventTypePhotoPicker types={types} onSelect={handleSelect} />
      </section>

      {selected ? (
        <form ref={formRef} action={createWeddingEvent} className="mt-10 max-w-lg space-y-6">
          <input type="hidden" name="event_type" value={selected.key} />
          <input type="hidden" name="concierge_choice" value={conciergeChoice} />
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="display_name">
              Event name <span className="text-terracotta">*</span>
            </label>
            <input
              autoComplete="off"
              className="input-field"
              id="display_name"
              name="display_name"
              placeholder="Our celebration"
              required
              type="text"
            />
            <p className="text-xs text-ink/50">
              Just the name to start — add the details below now, or anytime later.
            </p>
          </div>

          {/* Optional committing-core capture (owner 2026-07-12 relaxed the
              name-only lock). All optional — seed them to light up your planning
              checklist's deadlines + budget guidance, or skip and add later. */}
          <fieldset className="space-y-4 rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
              A few details — optional
            </legend>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">When</span>
              <CreateDatePicker />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="estimated_pax">
                Guest count
              </label>
              <input
                autoComplete="off"
                className="input-field sm:max-w-[12rem]"
                id="estimated_pax"
                inputMode="numeric"
                max={9999}
                min={1}
                name="estimated_pax"
                placeholder="e.g. 120"
                type="number"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="budget_band">
                Budget feel
              </label>
              <select className="input-field" defaultValue="" id="budget_band" name="budget_band">
                <option value="">Not sure yet</option>
                {budgetBands.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label} — {b.tag}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink/50">
                A rough feel — with your guest count we’ll estimate a starting budget.
              </p>
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton
              className="button-primary w-full sm:w-auto"
              pendingLabel="Creating event…"
            >
              Create {selected.label.toLowerCase()} event
            </SubmitButton>
            <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
              Cancel
            </Link>
          </div>
        </form>
      ) : null}
    </>
  );
}
