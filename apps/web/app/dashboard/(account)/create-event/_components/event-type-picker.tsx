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
import {
  gridHiddenTypes,
  subjectHonoreeDependentId,
  subjectHonoreeLabel,
  type CreateSubject,
} from '@/lib/create-subjects';
import { stashHonoree } from '@/lib/onboarding/honoree-handoff';

/**
 * The avatar glyph per subject kind. Only a PERSON (and "You") falls through to
 * a monogram — an initial is a human convention, and printing "A" for "Aling
 * Nena's Store" would quietly file a business under people. Keyed by kind so a
 * widened vocabulary lands here as a missing key, not as a wrong glyph.
 */
const SUBJECT_GLYPH: Partial<Record<CreateSubject['kind'], string>> = {
  pet: '🐾',
  business: '🏪',
  item: '🔑',
  other: '✦',
  // `self`, `person` and `unspecified` are deliberately ABSENT: they keep the
  // monogram they ship with today ("Someone else" has always shown an S).
};

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
  subjects,
  todayISO,
  notice,
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
  /** Who this account could be celebrating — "You", each alaga, "Someone else".
   *  Server-built from real records (lib/create-subjects). Empty / absent = the
   *  who step is skipped and this component behaves exactly as it did before. */
  subjects?: CreateSubject[];
  /** Manila today, so the per-subject measurement matches the server's clock. */
  todayISO?: string;
  /** The page's samahan banner / error alert. Rendered by this component (not
   *  the page) purely so it keeps sitting UNDER the heading now that the
   *  heading is step-dependent — the question changes between "who" and "what". */
  notice?: React.ReactNode;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  const [showAllTypes, setShowAllTypes] = useState(false);
  // WHO comes before WHAT (prototype User_Home_REDESIGN_2026-07-30 · createSheet).
  // Null = the question is still open; a chosen subject sorts the grid and
  // pre-answers "who are we celebrating?" downstream.
  const [subject, setSubject] = useState<CreateSubject | null>(null);
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
    // Carry the already-answered celebrant across the route hop into
    // /onboarding/[type], which asks the same question one screen later. It
    // rides in sessionStorage, NOT the URL: it is a person's first name, and a
    // query param would put it in history, the Referer header and access logs.
    // The alaga's record id travels with it so the onboarding path can key the
    // cap on WHO, not on a spelling — the server re-verifies it before writing.
    stashHonoree(subjectHonoreeLabel(subject), subjectHonoreeDependentId(subject));
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
  //
  // With the who step answered, the chosen subject's OWN measurement replaces
  // the household one (a named alaga is strictly more precise); "You" and
  // "Someone else" carry no data, so they keep today's household set and the
  // grid stays byte-identical to before this change.
  const hidden = gridHiddenTypes(subject, hiddenTypeKeys ?? [], todayISO ?? '');
  const gridTypes =
    showAllTypes || hidden.length === 0
      ? types
      : types.filter((t) => !hidden.includes(t.key));
  const hiddenCount = types.length - gridTypes.length;

  // The who step runs only when there is a real roster to choose from and no
  // other context has already settled the celebrant: a samahan event belongs to
  // a community, not a person, and a QR fast-lane already knows the type.
  const whoStep = (subjects ?? []).length > 0 && !samahanCommunityId && !preselect;
  const askWho = whoStep && !subject;

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

  // The heading is the STEP's own question — "who" first, "what" second — so a
  // sorted grid never arrives under a title that asks something else.
  const heading = (
    <header className="mb-8 space-y-2">
      <h1 className="sn-h1">
        {askWho ? 'Para kanino ito?' : 'What kind of event are you planning?'}
      </h1>
      <p className="text-base text-ink/65">
        {askWho
          ? 'Sabihin mo lang kung kanino — we’ll put what fits them first.'
          : 'Tap a type to begin.'}
      </p>
    </header>
  );

  if (askWho) {
    // STEP 1 — "Para kanino ito?" A grid of sixteen type tiles is a wall; the
    // same sixteen sorted around one named person is a short, obvious list.
    return (
      <section aria-label="Who this event is for">
        {heading}
        {notice}
        <p className="mb-4 max-w-lg text-sm leading-relaxed text-ink/65">
          Nothing is locked in — “someone else” shows every type, and you can change
          this on the next screen.
        </p>
        <ul className="grid max-w-lg gap-2">
          {(subjects ?? []).map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-ink/12 bg-cream/40 px-4 py-3 text-left transition-colors hover:border-gold/40 hover:bg-gold/[0.05]"
                onClick={() => setSubject(s)}
                type="button"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 font-sans text-sm text-ink/70"
                >
                  {SUBJECT_GLYPH[s.kind] ?? s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                  <span className="block truncate text-xs text-ink/55">{s.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <section aria-label="Event type">
        {heading}
        {notice}
        {whoStep && subject ? (
          /* The answer, kept visible and reversible — the type grid below is
             sorted by it, so it must never be a decision the user can't see. */
          <div className="mb-5 flex max-w-lg items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
            <span className="min-w-0 text-sm text-ink/70">
              For <span className="font-medium text-ink">{subject.name}</span>
              <span className="block truncate text-xs text-ink/50">{subject.subtitle}</span>
            </span>
            <button
              className="ml-auto shrink-0 text-xs font-medium text-ink/60 underline transition-colors hover:text-ink"
              onClick={() => {
                setSubject(null);
                setSelectedKey(null);
                setShowAllTypes(false);
              }}
              type="button"
            >
              Change
            </button>
          </div>
        ) : null}
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
              {/* Pre-answered by the who step when a NAMED alaga was picked.
                  "You" deliberately leaves this blank: the unlabeled slot has
                  always meant the account holder, and stamping your own name
                  here would open a second slot beside every unlabeled event you
                  already have. `key` remounts it when the subject changes. */}
              <input
                autoComplete="off"
                className="input-field"
                defaultValue={subjectHonoreeLabel(subject)}
                id="honoree_label"
                key={subject?.id ?? 'no-subject'}
                name="honoree_label"
                maxLength={80}
                placeholder="First name — e.g. Maria"
                type="text"
              />
              {/* WHICH alaga this is, when the who step named one. A link to a
                  RECORD outlives a spelling: renaming the alaga no longer moves
                  the event to a different slot, and two alaga called "Maria"
                  stop sharing one. Empty for "You" / "Someone else", i.e. for
                  every account without a People roster — unchanged behaviour.
                  A CLAIM only: the server re-reads the row under
                  `owner_user_id = you` and drops anything else. */}
              <input
                name="honoree_dependent_id"
                type="hidden"
                value={subjectHonoreeDependentId(subject) ?? ''}
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
            {/* `?hub=1` for the same reason as the page's back chip: a bare
                /dashboard auto-jumps a one-event couple INTO their wedding, so
                Cancel would land them somewhere they did not ask for. */}
            <Link className="button-secondary w-full sm:w-auto" href="/dashboard?hub=1">
              Cancel
            </Link>
          </div>
        </form>
      ) : null}
    </>
  );
}
