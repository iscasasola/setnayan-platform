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
import { CreateLocationPicker } from './create-location-picker';
import { type BudgetBand } from '@/lib/budget-bands-shared';
import { ANCHOR_ORIGINS, ANCHOR_ORIGIN_LABELS, canToggleRecur } from '@/lib/event-anchor';
import { beyondHorizon, horizonDaysFor, isGatedLifeType } from '@/lib/life-event-gate';

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
  inPlanningWedding = null,
  samahanCommunityId,
  hiddenTypeKeys,
}: {
  types: EventTypeRow[];
  /** Budget feel-bands for the optional budget picker on the inline (non-wedding)
   *  create form. Server-fetched (getBudgetBands) so it matches onboarding. */
  budgetBands: BudgetBand[];
  next?: string;
  /** A QR-provided event type (Locked/Shortlist fast-lane): auto-advance past
   *  the type carousel so the couple never re-picks what the QR already knows. */
  preselect?: string;
  /** Wedding cardinality (owner-locked 2026-07-12 · flow-check reconciled):
   *  non-null = the user has a wedding still IN PLANNING, so selecting Wedding
   *  shows the guided router (edit same-marriage / vow renewal / new marriage)
   *  instead of the form. A settled wedding (archived/completed) is null → no
   *  block, so remarriage works. */
  inPlanningWedding?: { eventId: string; displayName: string; eventDate: string | null } | null;
  /** Samahan context (plan §7 · PR-3): set = the event is being planned FOR a
   *  community (the page already verified the viewer is an organizer and
   *  filtered `types` to community_eligible). The pick always lands on the
   *  inline form (never the tailored-onboarding routes — they don't carry the
   *  community context; context flows one way, from the community's Events
   *  tab), and the form posts a hidden `community_id`. */
  samahanCommunityId?: string;
  /** Measured life types the page decided to HIDE from the grid (owner
   *  2026-07-17: hide what doesn't concern the account — debut/christening when
   *  no one in the People layer approaches that moment). Hidden ≠ locked: the
   *  "show all" expander below the grid always reveals them (wayfinding lock —
   *  a self-planning debutante or a niece's aunt has no dependent record). */
  hiddenTypeKeys?: string[];
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  const [showAllTypes, setShowAllTypes] = useState(false);
  // Soft planning-horizon advisory (council § 5 card 2 — never a block): set
  // when the typed party date sits beyond the selected life type's horizon.
  const [farHorizon, setFarHorizon] = useState(false);
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
    setFarHorizon(false); // advisory is per-selection; recomputed on form change
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
    // Samahan context: community events ALWAYS use the inline form below —
    // it carries the hidden community_id; the tailored onboarding routes
    // don't know about communities (plan §7).
    if (samahanCommunityId) {
      setSelectedKey(type.key);
      return;
    }
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

  // Measured-type hiding (owner 2026-07-17). The grid shows what concerns the
  // account; the expander is the always-present doorway to everything else. A
  // QR-preselected hidden type still auto-advances (handleSelect works off the
  // full roster), so fast-lanes never dead-end.
  const hidden = hiddenTypeKeys ?? [];
  const gridTypes =
    showAllTypes || hidden.length === 0
      ? types
      : types.filter((t) => !hidden.includes(t.key));
  const hiddenCount = types.length - gridTypes.length;

  // Soft horizon advisory — recompute from the form's date inputs on any form
  // change. Reads the CreateDatePicker's own field names (date_candidate /
  // date_window_start); purely advisory, never blocks submission.
  function refreshHorizonAdvisory() {
    const form = formRef.current;
    const key = selectedKey;
    if (!form || !key || !isGatedLifeType(key)) {
      setFarHorizon(false);
      return;
    }
    const dates: string[] = [];
    form
      .querySelectorAll<HTMLInputElement>(
        'input[name="date_candidate"], input[name="date_window_start"]',
      )
      .forEach((el) => {
        if (el.value) dates.push(el.value);
      });
    const earliest = dates.sort()[0];
    if (!earliest) {
      setFarHorizon(false);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setFarHorizon(beyondHorizon(key, earliest, today) === true);
  }

  const horizonMonths = selectedKey
    ? Math.round((horizonDaysFor(selectedKey) ?? 0) / 30.44)
    : 0;

  return (
    <>
      <section aria-label="Event type">
        <EventTypePhotoPicker types={gridTypes} onSelect={handleSelect} />
        {hiddenCount > 0 && !showAllTypes ? (
          <button
            className="mt-4 w-full rounded-xl border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-3 text-sm text-ink/70 transition-colors hover:border-gold/40 hover:text-ink"
            onClick={() => setShowAllTypes(true)}
            type="button"
          >
            May iba ka pang pinaplano? Planning for yourself or someone else —{' '}
            <span className="font-medium text-ink">show all event types</span>
          </button>
        ) : null}
      </section>

      {selected && selected.key === 'wedding' && inPlanningWedding ? (
        <div className="mt-10 max-w-lg space-y-4">
          <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-5 sm:p-6">
            <p className="font-sans text-xl text-ink">You’re already planning a wedding</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              You have <span className="font-medium text-ink">{inPlanningWedding.displayName}</span> in
              planning. What is this one?
            </p>
          </div>

          {/* Same marriage → add the church ceremony to the existing wedding. */}
          <Link
            className="block rounded-xl border border-ink/12 bg-cream/40 p-4 transition-colors hover:border-gold/40 hover:bg-gold/[0.05]"
            href={`/dashboard/${inPlanningWedding.eventId}`}
          >
            <p className="text-sm font-medium text-ink">The church (or civil) ceremony of the same marriage</p>
            <p className="mt-1 text-xs text-ink/55">
              One wedding can have two ceremonies — add it to {inPlanningWedding.displayName} instead of
              starting over.
            </p>
          </Link>

          {/* Vow renewal / anniversary → route to the Anniversary type in this picker. */}
          {types.some((t) => t.key === 'anniversary') ? (
            <button
              className="block w-full rounded-xl border border-ink/12 bg-cream/40 p-4 text-left transition-colors hover:border-gold/40 hover:bg-gold/[0.05]"
              onClick={() => setSelectedKey('anniversary' as EventTypeKey)}
              type="button"
            >
              <p className="text-sm font-medium text-ink">A vow renewal or anniversary celebration</p>
              <p className="mt-1 text-xs text-ink/55">
                Silver, golden, or any year — this is an Anniversary, on full wedding rails.
              </p>
            </button>
          ) : null}

          {/* New marriage → blocked while one is in planning (finish/archive first). */}
          <div className="rounded-xl border border-terracotta/25 bg-terracotta/[0.05] p-4">
            <p className="text-sm font-medium text-ink">A different, new marriage</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/60">
              You can only plan one wedding at a time. Finish or archive {inPlanningWedding.displayName}{' '}
              first — once its day has passed or it’s archived, you can start a new one.
            </p>
            <Link
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-mulberry px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-mulberry/90"
              href={`/dashboard/${inPlanningWedding.eventId}`}
            >
              Go to {inPlanningWedding.displayName}
            </Link>
          </div>

          <button
            className="text-sm font-medium text-ink/55 transition-colors hover:text-ink"
            onClick={() => setSelectedKey(null)}
            type="button"
          >
            ‹ Pick a different type
          </button>
        </div>
      ) : selected ? (
        <form
          ref={formRef}
          action={createWeddingEvent}
          className="mt-10 max-w-lg space-y-6"
          onChange={refreshHorizonAdvisory}
        >
          <input type="hidden" name="event_type" value={selected.key} />
          <input type="hidden" name="concierge_choice" value={conciergeChoice} />
          {samahanCommunityId ? (
            <input type="hidden" name="community_id" value={samahanCommunityId} />
          ) : null}
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

          {/* Life-event honoree ("Para kanino?") — the cardinality key (council
              verdict 2026-07-17 § 2). OPTIONAL, first name only, ordinary PI:
              one in-planning celebration per celebrant per type, and typing a
              different name opens a new slot. Never asks a birthdate. */}
          {isGatedLifeType(selected.key) && !samahanCommunityId ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="honoree_label">
                Para kanino? <span className="font-normal text-ink/45">— optional</span>
              </label>
              <input
                autoComplete="off"
                className="input-field"
                id="honoree_label"
                name="honoree_label"
                maxLength={80}
                placeholder="First name — e.g. Maria"
                type="text"
              />
              <p className="text-xs text-ink/50">
                The celebrant’s first name keeps their celebrations tidy — one{' '}
                {selected.label.toLowerCase()} in planning per person at a time.
              </p>
            </div>
          ) : null}

          {/* Date-anchor model — the anniversary anchor question (PR-A). An
              anniversary is any yearly memorable date: a typed origin + the
              date it commemorates. Positive origins only (no memorial). Both
              optional — add now or later. It recurs every year automatically. */}
          {selected.key === 'anniversary' ? (
            <fieldset className="space-y-4 rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
              <legend className="px-1 text-xs font-medium uppercase tracking-[0.12em] text-ink/50">
                What are you celebrating?
              </legend>
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="anniversary_origin"
                >
                  What does this celebrate?
                </label>
                <select
                  className="input-field"
                  defaultValue="wedding"
                  id="anniversary_origin"
                  name="anniversary_origin"
                >
                  {ANCHOR_ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {ANCHOR_ORIGIN_LABELS[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="anniversary_date"
                >
                  What date is it?
                </label>
                <input
                  className="input-field sm:max-w-[14rem]"
                  id="anniversary_date"
                  name="anniversary_date"
                  type="date"
                />
                <p className="text-xs text-ink/50">
                  We’ll bring it back every year — quietly, unless you throw a party for it.
                </p>
              </div>
            </fieldset>
          ) : null}

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
              <span className="block text-sm font-medium text-ink">Where</span>
              <CreateLocationPicker />
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

          {/* Soft planning-horizon advisory (council § 5 card 2, owner-locked
              per-type prep-months table 2026-07-17). NEVER a block — the form
              submits regardless; this is the "malayo pa 'yan" whisper with the
              proceed-anyway built in. */}
          {farHorizon ? (
            <p className="rounded-lg border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm leading-relaxed text-ink/75">
              <span className="font-medium text-ink">Malayo pa ’yan!</span> Planning for a{' '}
              {selected.label.toLowerCase()} usually opens about {horizonMonths} months out. Game ka
              na ba? Tuloy lang — or adjust the date if it was a typo.
            </p>
          ) : null}

          {/* Date-anchor model (PR-E): the "yearly?" toggle for recurring-
              eligible types (travel/corporate/gala/celebration/reunion/tournament).
              recurs=true → the moment returns on the couple's Year view each year;
              never auto-creates an event. Anniversary/birthday recur by nature. */}
          {canToggleRecur(selected.key) ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm">
              <input
                type="checkbox"
                name="recurs"
                value="on"
                className="mt-0.5 h-4 w-4 cursor-pointer accent-gold"
              />
              <span>
                <span className="block font-medium text-ink">Make it a yearly thing</span>
                <span className="block text-xs text-ink/55">
                  We’ll bring it back on your year every year — quietly, so you never miss it.
                </span>
              </span>
            </label>
          ) : null}

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
