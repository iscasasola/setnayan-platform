'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import type { CeremonyTypeKey } from '@/app/_components/ceremony-type-radio-group';
import { createWeddingEvent } from '../actions';
import { WeddingTypePicker, type LaunchStatusRow } from './wedding-type-picker';
import { EVENT_TYPES, type EventTypeKey, type EventTypeRow } from './event-types';
import { EventTypeCarousel } from './event-type-carousel';

/* Retired 2026-05-28 V2 cutover */
// V1 surfaced a DIY / Concierge ₱2,499 / 3-day-trial choice card at the
// end of create-event. V2 retires the trial mechanic entirely and prices
// Today's Focus separately in platform_retail_catalog_v2 (purchased
// post-event-creation from /pricing). Every new event lands in DIY by
// default; hosts upgrade later from the dashboard if they want the
// daily planner. The ConciergeChoice type + hidden form field are kept
// for cutover-period continuity with the server action signature; the
// value is always 'diy' from this surface.
type ConciergeChoice = 'diy';

// EVENT_TYPES / EventTypeKey / EventTypeRow now live in ./event-types so the
// full-page picker (here) and the in-chrome add-event bottom sheet inside
// EventSwitcher share one roster. See that file for the V1 tile-list history
// (locked 2026-05-16, debut enabled 2026-05-20, gender_reveal reverted).

type EventTypePickerProps = {
  launchStatus: LaunchStatusRow[];
  /* Retired 2026-05-28 V2 cutover */
  // V1 gated the Concierge choice card with `conciergeEnabled`. V2 has
  // no choice card on create-event so the prop is unused; kept on the
  // type signature for cutover-period import-source continuity with
  // create-event/page.tsx.
  conciergeEnabled?: boolean;
};

export function EventTypePicker({ launchStatus }: EventTypePickerProps) {
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  // ConciergeChoice locked to 'diy' on every new event in V2 — hosts
  // upgrade to Today's Focus from the dashboard post-creation.
  const conciergeChoice: ConciergeChoice = 'diy';
  // Task #44 (2026-05-22) — track the ceremony pick so the Save button stays
  // disabled until the host explicitly chooses one. Non-wedding event_types
  // don't render the picker and are allowed to submit without it.
  const [ceremonyType, setCeremonyType] = useState<CeremonyTypeKey | null>(null);

  const selected = selectedKey
    ? (EVENT_TYPES.find((t) => t.key === selectedKey) ?? null)
    : null;
  // Branch on a WIDENED string (not a literal-typed boolean) so TS does NOT
  // alias-narrow selected.key inside the inline create form's else-branch — the
  // form keeps its own wedding-vs-non-wedding checks against the full union.
  const selectedKeyStr: string = selected?.key ?? '';

  function handleSelect(type: EventTypeRow) {
    if (!type.enabled) return;
    setSelectedKey(type.key);
  }

  return (
    <>
      <section aria-label="Event type" className="space-y-4">
        <EventTypeCarousel
          selectedKey={selectedKey}
          onSelect={handleSelect}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 256px"
        />
      </section>

      {selected ? (
        selectedKeyStr === 'wedding' ? (
          /* Cutover 2026-06-02 (CLAUDE.md Phase 5): Wedding routes to the
             /onboarding/wedding flow — it captures names/date/region/pax/budget/
             style and commits the event (commitOnboardingWedding). Non-wedding
             types (debut) keep the inline create form below. */
          <div className="mt-10 space-y-6">
            <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
              <p className="text-sm text-ink/70">
                Beautiful — let&apos;s set up your wedding. A few quick questions and
                we&apos;ll build a plan made for your day, with every vendor sorted to fit.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary w-full sm:w-auto" href="/onboarding/wedding">
                Continue &rarr;
              </Link>
              <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
                Cancel
              </Link>
            </div>
          </div>
        ) : (
        <form action={createWeddingEvent} className="mt-10 space-y-6">
          <input type="hidden" name="event_type" value={selected.key} />
          <input type="hidden" name="concierge_choice" value={conciergeChoice} />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="display_name">
              Event name <span className="text-terracotta">*</span>
            </label>
            <input
              autoComplete="off"
              autoFocus
              className="input-field"
              id="display_name"
              name="display_name"
              placeholder="Maria &amp; Juan"
              required
              type="text"
            />
            <p className="text-xs text-ink/50">
              Usually both names. Date and venue are added later from event settings.
            </p>
          </div>

          {/* Iteration 0043 + Task #44 — two-axis wedding-type picker. Hidden
              inputs feed createWeddingEvent which reads ceremony_type /
              venue_setting / sub-type / mixed columns. For wedding events
              ceremony_type is a REQUIRED field per Task #44 — the parent
              gates Save behind an affirmative pick. Non-wedding event_types
              (debut, etc. per iteration 0041) skip the picker entirely and
              store NULL on the wedding-specific columns. */}
          {selected.key === 'wedding' ? (
            <WeddingTypePicker
              launchStatus={launchStatus}
              onCeremonyChange={setCeremonyType}
            />
          ) : null}

          {/* Retired 2026-05-28 V2 cutover — Concierge choice card removed.
              V1 surfaced DIY / Concierge ₱2,499 / 3-day-trial here; V2 has no
              trial mechanic and prices Today's Focus separately on /pricing.
              Every new event lands in DIY by default. */}

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <SubmitButton
                className="button-primary w-full sm:w-auto"
                pendingLabel="Creating event…"
                disabled={selected.key === 'wedding' && !ceremonyType}
              >
                Create {selected.label.toLowerCase()} event
              </SubmitButton>
              <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
                Cancel
              </Link>
            </div>
            {/* Task #44 — surface why Save is disabled. Editorial copy per
                [[feedback_setnayan_no_dev_text_post_launch]] — no marketing
                jargon, no exclamation, matter-of-fact about what's missing. */}
            {selected.key === 'wedding' && !ceremonyType ? (
              <p className="text-xs text-ink/55">
                Pick a wedding type so we can match vendors compatible with your ceremony.
              </p>
            ) : null}
          </div>
        </form>
        )
      ) : (
        <p className="mt-10 rounded-md border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/55">
          Pick an event type above to name it.
        </p>
      )}
    </>
  );
}

/* Retired 2026-05-28 V2 cutover · ConciergeChoiceCard component deleted.
   V1 surfaced a DIY / Concierge ₱2,499 / 3-day-trial picker at the
   bottom of create-event. V2 has no trial mechanic and prices Today's
   Focus separately on /pricing. Every new event lands in DIY by default;
   hosts upgrade later from the dashboard if they want the daily planner. */

