'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { createWeddingEvent } from '../actions';
import { type EventTypeKey, type EventTypeRow } from './event-types';
import { EventTypePhotoPicker } from './event-type-photo-picker';

/* Retired 2026-05-28 V2 cutover — the DIY / Concierge ₱2,499 / 3-day-trial
   choice card is gone. Every new event lands in DIY by default; the hidden
   `concierge_choice` field is always 'diy' here for continuity with the
   createWeddingEvent server-action signature. */
type ConciergeChoice = 'diy';

/**
 * Create-event surface — owner directive 2026-06-04: a "feel photo" picker
 * (full-bleed event photos, no carousel indicators; tap the centered photo to
 * begin). Selecting a type jumps STRAIGHT into that event's own onboarding when
 * one exists (`onboardingHref`); otherwise it falls back to the inline name
 * form so the event still creates today.
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
export function EventTypePicker({ types }: { types: EventTypeRow[] }) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  const conciergeChoice: ConciergeChoice = 'diy';
  const formRef = useRef<HTMLFormElement | null>(null);

  const selected = selectedKey
    ? (types.find((t) => t.key === selectedKey) ?? null)
    : null;

  // Inline name-form fallback (types without their own onboarding, exp-quiz
  // flag off) mounts BELOW the full-bleed photo deck — on a phone that's past
  // the fold, so the tap looked dead ("the picker isn't clickable"). Bring the
  // form into view and focus its field the moment a type is chosen, so every
  // tap is visibly acknowledged. (owner bug 2026-06-28)
  useEffect(() => {
    if (!selectedKey) return;
    const form = formRef.current;
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.querySelector<HTMLInputElement>('#display_name')?.focus({ preventScroll: true });
  }, [selectedKey]);

  function handleSelect(type: EventTypeRow) {
    if (!type.enabled) return;
    if (type.onboardingHref) {
      // REPLACE (not push) so this legacy event-type picker never lingers in history
      // as a Back target behind the tailored onboarding — backing out of onboarding at
      // its first screen returns to the dashboard, never "the old onboarding page".
      // (owner bug 2026-06-15)
      router.replace(type.onboardingHref);
      return;
    }
    // Iteration 0053 Phase 3: non-wedding types route into the generic experience
    // onboarding (/onboarding/[type]) when the experience-quiz flag is on; with it
    // off the route 404s, so we fall back to the inline name form. Wedding never
    // reaches here (its onboardingHref branch above is byte-identical / unchanged).
    if (experienceQuizEnabled() && type.key !== 'wedding') {
      router.replace(`/onboarding/${type.key}`);
      return;
    }
    setSelectedKey(type.key);
  }

  return (
    <>
      <section aria-label="Event type">
        <EventTypePhotoPicker types={types} onSelect={handleSelect} />
      </section>

      {selected ? (
        <form ref={formRef} action={createWeddingEvent} className="mt-10 space-y-6">
          <input type="hidden" name="event_type" value={selected.key} />
          <input type="hidden" name="concierge_choice" value={conciergeChoice} />

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
              Date and venue are added later from event settings.
            </p>
          </div>

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
