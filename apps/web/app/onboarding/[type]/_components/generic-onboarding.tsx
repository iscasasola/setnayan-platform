'use client';

/**
 * The GENERIC (non-wedding) onboarding flow — a lean, brand-consistent shell
 * (NOT a fork of the 4,700-line wedding wizard). Screens: welcome → name → date
 * → pax → region → the 5 experience-quiz axes → persona reveal → congrats. State
 * is client-only with a localStorage draft (resume after sign-in); the single
 * lazy commit (commitOnboardingEvent) fires once at the final button.
 *
 * Iteration 0053 Phase 3 · PR2.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isGatedLifeType } from '@/lib/life-event-gate';
import {
  ANCHOR_ORIGIN_LABELS,
  ANCHOR_ORIGINS,
  canToggleRecur,
  nextAnniversary,
} from '@/lib/event-anchor';
import {
  activeCelebrationPick,
  celebrationOptionsFor,
  formatCelebrationDay,
  ordinal,
} from '@/lib/anchor-celebration-dates';
import { takeHonoree } from '@/lib/onboarding/honoree-handoff';
import { resolvePersona, type ExpAxis } from '@/app/onboarding/wedding/_data/experience-personas';
import { PH_REGIONS } from '@/lib/regions';
import { commitOnboardingEvent } from '@/app/onboarding/_shared/commit-event';
import { mintTurnstileToken } from '@/lib/turnstile-client';
import type { GenericOnboardingPayload } from '@/lib/onboarding/types';
import {
  derivePackPlanFrom,
  derivePackServicesFrom,
  type TypePersonaPack,
} from '@/lib/onboarding/persona-packs';
import { extraPicksFrom, type TypeQuestion } from '@/lib/onboarding/type-questions';
import type { GenericPersonaReveal } from '@/lib/onboarding/generic-content';
import type { OnboardingIntro } from '@/lib/onboarding/onboarding-db';
import type { OnboardingPickChip } from '@/lib/onboarding-refinements';
import { getSpecialtyFields } from '@/lib/onboarding/specialty-catalog';
import { normalizeSpecialtyValues } from '@/lib/onboarding/specialty-values';
import { EMPTY_PREFILL, partitionOnboardingPrefill, type OnboardingPrefill } from '@/lib/onboarding/prefill';
import type { ServicesStepView } from '@/lib/onboarding/services-step-data';
import { ServicesStep } from '@/app/onboarding/_shared/services-step';
import { SpecialtyFields } from './specialty-fields';

type Props = {
  eventType: string;
  label: string;
  emoji: string;
  organizerNoun: string;
  eventWord: string;
  flowKey: string;
  /** The profile's persona-pack key (= onboarding_flow_key); selects the per-type plan. */
  personaPackKey: string;
  /** The type's applicable taxonomy categories — drive the derived starter plan. */
  tiles: OnboardingPickChip[];
  /** Admin-editable onboarding content (DB override OR TS default; see onboarding-db.ts). */
  intro: OnboardingIntro | null;
  questions: TypeQuestion[];
  personaPack: TypePersonaPack | null;
  revealByPersona: Record<string, GenericPersonaReveal>;
  quizAxes: ExpAxis[];
  authed: boolean;
  anonEnabled: boolean;
  resume: boolean;
  /**
   * Optional internal return path (vendor-invite claim loop). When a 0-event
   * couple is sent here from /vendor-invite/[slug] to create their first event,
   * the post-commit nav returns them to it instead of the dashboard so they can
   * finish shortlisting the vendor. Null = land on the dashboard as usual.
   */
  nextPath?: string | null;
  /**
   * Profile-derived prefill (onboarding_v2_brief). Answers the type's questions
   * that the user's self-profile already settles (e.g. religion → christening
   * rite) so the flow seeds them + skips/labels them. EMPTY_PREFILL (the default
   * / flag-off) makes the flow byte-identical.
   */
  prefill?: OnboardingPrefill;
  /**
   * The services step's server-resolved view-model (Papic + Setnayan AI).
   * NULL = the NEXT_PUBLIC_ONBOARDING_SERVICES_STEP flag is off ⇒ the screen is
   * dropped from `screens` and this flow renders byte-identical to today.
   */
  servicesStepView?: ServicesStepView | null;
  /**
   * The already-rendered <SetnayanAiValue mode="preview" …/> (a Server
   * Component node), forwarded straight through to the step. Passed as a node
   * rather than re-rendered here so its server-only transitive imports stay out
   * of this client bundle — and so its copy is never re-authored (spec § 1.4).
   */
  servicesStepAiValue?: React.ReactNode;
  /**
   * Manila today (server clock). Drives the anchor's NEXT return, so a 2015
   * union date offers the 2027 anniversary rather than 2015. Absent → the UTC
   * client date, which can differ by one day near midnight and would only ever
   * shift the suggestion by a year at the exact anniversary boundary.
   */
  todayISO?: string;
};

type Draft = {
  v: 1;
  startedAt: number;
  displayName: string;
  honoree: string;
  anchorDate: string;
  anchorOrigin: string;
  recurs: boolean;
  dateValue: string;
  pax: string;
  region: string;
  axes: Record<string, string>;
  /** Per-type signature-moment answers (questionId → optionKey). */
  details: Record<string, string>;
  /** Rich per-type specialty field answers (catalog signature_fields → values). */
  specialtyValues: Record<string, unknown>;
};

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function GenericOnboarding(props: Props) {
  const {
    eventType,
    label,
    emoji,
    eventWord,
    tiles,
    intro,
    questions,
    personaPack,
    revealByPersona,
    quizAxes,
    authed,
    resume,
    nextPath = null,
    prefill = EMPTY_PREFILL,
    servicesStepView = null,
    servicesStepAiValue = null,
    todayISO,
  } = props;
  const router = useRouter();
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const draftKey = `setnayan_onboarding_generic_${eventType}_draft_v1`;

  const [step, setStep] = useState(0);
  const [blockedBy, setBlockedBy] = useState<
    { eventId: string; displayName: string } | null
  >(null);
  const [displayName, setDisplayName] = useState('');
  // The celebrant. Asked only for the five gated life types — it is the key the
  // one-in-planning cap counts on, and the generic flow never collected it, so
  // a second birthday/debut/christening/graduation/gender-reveal was refused
  // forever with a generic error (fixed 2026-07-31).
  const [honoree, setHonoree] = useState('');
  // WHICH alaga that name is, when the create step's who question named one.
  // Deliberately NOT persisted in the draft: it is only ever meaningful paired
  // with the name it arrived with, and a 30-day draft outliving that pairing is
  // how a link ends up on the wrong person. A resumed draft keeps the name and
  // falls back to label-keyed capping, which is the shipped behaviour.
  const [honoreeDependentId, setHonoreeDependentId] = useState<string | null>(null);
  const gatedLifeType = isGatedLifeType(eventType);
  // The date this event COMMEMORATES, and why — asked only for anniversary,
  // whose whole nature is "the day we're marking". Never asked for
  // birthday/debut/christening: their anchor IS a person's birthdate, which
  // events do not store (counsel gate, also enforced in event-insert.ts).
  const [anchorDate, setAnchorDate] = useState('');
  const [anchorOrigin, setAnchorOrigin] = useState<string>('wedding');
  const isAnniversary = eventType === 'anniversary';
  // "Make it a yearly thing?" — the owner-locked toggle types. Anniversary and
  // birthday recur by nature and get no toggle.
  const showRecurToggle = canToggleRecur(eventType);
  const [recurs, setRecurs] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [pax, setPax] = useState('');
  const [region, setRegion] = useState('');
  const [axes, setAxes] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [specialtyValues, setSpecialtyValues] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The experience-quiz axis ids, in order (keys are locked; copy is editable).
  const axisIds = useMemo<string[]>(() => quizAxes.map((a) => a.id), [quizAxes]);
  // Rich per-type "signature fields" from the specialty catalog (the 18s, godparents,
  // milestone-as-data, …). Empty for a type with no catalog entry → the screen is
  // dropped and the flow is byte-identical to before.
  const specialtyFields = useMemo(() => getSpecialtyFields(eventType), [eventType]);
  // Profile prefill (onboarding_v2_brief): split the derived answers into the
  // rich specialty fields vs the light tq_ questions they target, so each bag is
  // seeded, a fully-answered tq_ screen is skipped, and a prefilled specialty
  // field is labelled "from your profile". Empty (flag off / nothing on file) →
  // the sequence + state are byte-identical to before.
  const { prefillDetails, prefillSpecialty } = useMemo(() => {
    const parts = partitionOnboardingPrefill(
      prefill,
      questions.map((q) => q.id),
      specialtyFields.map((f) => f.key),
    );
    return { prefillDetails: parts.details, prefillSpecialty: parts.specialty };
  }, [prefill, questions, specialtyFields]);
  const prefilledSpecialtyKeys = useMemo(() => Object.keys(prefillSpecialty), [prefillSpecialty]);
  // Per-type signature-moment screens, injected into the sequence after 'region'.
  // A tq_ question the profile already answers is dropped (its answer is seeded
  // into `details`, so the derived plan still counts its adds).
  const screens = useMemo<string[]>(
    () => [
      'welcome',
      'name',
      ...(gatedLifeType ? ['honoree'] : []),
      ...(isAnniversary ? ['anchor'] : []),
      'date',
      ...(showRecurToggle ? ['recurs'] : []),
      'pax',
      'region',
      ...questions.filter((q) => !(q.id in prefillDetails)).map((q) => `tq_${q.id}`),
      ...(specialtyFields.length > 0 ? ['specialty'] : []),
      ...axisIds, // for_whom · feel · energy · roots · effort
      'reveal',
      // The services step sits AFTER the persona reveal (so `planServices` is
      // already derived and can order the two Papic products) and BEFORE
      // congrats. Absent entirely when the flag is off — not hidden, not
      // skipped: the array is shorter, so the progress bar, the step indices
      // and every draft key are identical to today.
      ...(servicesStepView ? ['services'] : []),
      'congrats',
    ],
    [
      questions, axisIds, specialtyFields, prefillDetails, servicesStepView,
      gatedLifeType, isAnniversary, showRecurToggle,
    ],
  );

  // -- Hydrate the localStorage draft (30-day TTL). On ?resume=1 (post sign-in)
  //    jump to the final screen so the visitor can finish in one tap. --
  useEffect(() => {
    // Seed from the self-profile prefill first; a saved draft then overrides
    // per-key so a resumed session and any user edit always win over the prefill.
    let seededDetails: Record<string, string> = { ...prefillDetails };
    let seededSpecialty: Record<string, unknown> = { ...prefillSpecialty };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && d.v === 1 && Date.now() - d.startedAt < DRAFT_TTL_MS) {
          setDisplayName(d.displayName ?? '');
          setHonoree(d.honoree ?? '');
          setAnchorDate(d.anchorDate ?? '');
          setAnchorOrigin(d.anchorOrigin ?? 'wedding');
          setRecurs(d.recurs === true);
          setDateValue(d.dateValue ?? '');
          setPax(d.pax ?? '');
          setRegion(d.region ?? '');
          setAxes(d.axes ?? {});
          seededDetails = { ...prefillDetails, ...(d.details ?? {}) };
          seededSpecialty = { ...prefillSpecialty, ...(d.specialtyValues ?? {}) };
          if (resume) setStep(screens.indexOf('congrats'));
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
    // "Para kanino ito?" was already answered one screen ago, on the create-event
    // WHO step. Consume the carry (sessionStorage, single-read, 10-min TTL — the
    // name never touches the URL) so this flow CONFIRMS the celebrant instead of
    // asking the same question twice. Only for the types that actually ask.
    if (gatedLifeType) {
      const carried = takeHonoree();
      if (carried) {
        setHonoree(carried.name);
        // …and WHICH record that name is, so the cap keys on the person rather
        // than the spelling. A CLAIM only — commitOnboardingEvent re-reads it
        // under `owner_user_id = you` and drops anything else.
        setHonoreeDependentId(carried.dependentId);
      }
    }
    setDetails(seededDetails);
    setSpecialtyValues(seededSpecialty);
    setHydrated(true);
  }, [draftKey, resume, screens, prefillDetails, prefillSpecialty, gatedLifeType]);

  // -- Persist the draft on every change (after hydration). --
  useEffect(() => {
    if (!hydrated) return;
    try {
      const d: Draft = { v: 1, startedAt: Date.now(), displayName, honoree, anchorDate, anchorOrigin, recurs, dateValue, pax, region, axes, details, specialtyValues };
      localStorage.setItem(draftKey, JSON.stringify(d));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [hydrated, draftKey, displayName, honoree, anchorDate, anchorOrigin, recurs, dateValue, pax, region, axes, details, specialtyValues]);

  // ── ANCHOR ≠ CELEBRATION ────────────────────────────────────────────────────
  // `anchor_date` is what the event commemorates; `event_date` is when it is
  // actually held. Two columns on purpose — in PH a 7th birthday on a Tuesday is
  // very often a Saturday party. So once an anchor exists we show it as CONTEXT
  // and still ASK for the party day, with the two days people actually choose
  // between as quick picks. No anchor (every type but anniversary today, or an
  // anniversary whose anchor was skipped) → the date step is exactly as it was.
  const anchorOptions = useMemo(
    () => celebrationOptionsFor(anchorDate, today),
    [anchorDate, today],
  );
  const anchorReturn = useMemo(
    () => (isAnniversary && anchorDate ? nextAnniversary(anchorDate, today) : null),
    [isAnniversary, anchorDate, today],
  );
  const activePick = activeCelebrationPick(anchorOptions, dateValue);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  // Seed the date field with the anchor's own day the first time an anchor
  // appears. A blank <input type="date"> opens the calendar on TODAY — the one
  // month this event has nothing to do with. Seeding is also what makes "Another
  // day" open the picker AT the anchor instead of blanking it. The ref keys on
  // the anchor, so deliberately clearing the field is never undone.
  const seededForAnchor = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const iso = anchorOptions?.onTheDayISO ?? null;
    if (!iso || seededForAnchor.current === iso) return;
    const previous = seededForAnchor.current;
    seededForAnchor.current = iso;
    // Re-seed only over emptiness or over our OWN previous suggestion — going
    // back and correcting the anchor should move the suggested day with it,
    // while a day the user actually chose is never overwritten.
    setDateValue((v) => (!v || v === previous ? iso : v));
  }, [hydrated, anchorOptions?.onTheDayISO]);

  function pickCelebrationDay(iso: string, openPicker = false) {
    setDateValue(iso);
    if (!openPicker) return;
    const el = dateInputRef.current;
    if (!el) return;
    el.focus();
    // showPicker is Chromium/Safari-only and throws if the input isn't visible.
    try {
      el.showPicker?.();
    } catch {
      /* the field is focused and seeded either way */
    }
  }

  const screen = screens[step]!;
  const axisIndex = axisIds.indexOf(screen);
  const isAxis = axisIndex >= 0;
  const tqId = screen.startsWith('tq_') ? screen.slice(3) : null;
  const typeQuestion = tqId ? questions.find((q) => q.id === tqId) ?? null : null;

  const allAxesAnswered = axisIds.every((id) => Boolean(axes[id]));
  const personaKey = useMemo(
    () => (allAxesAnswered ? resolvePersona(axes) : null),
    [allAxesAnswered, axes],
  );
  const reveal = personaKey ? revealByPersona[personaKey] ?? null : null;
  // Starter plan: per-type persona pack (essentials + this persona's extras),
  // intersected with the type's taxonomy and sized by the effort axis. Falls back
  // to taxonomy-top-N for any type without a pack.
  const plan = useMemo(
    () => derivePackPlanFrom(personaPack, personaKey, tiles, axes.effort),
    [personaPack, personaKey, tiles, axes.effort],
  );
  // In-app Setnayan services to pre-surface on the dashboard for this persona +
  // effort (→ style_preferences.interested_services). No pack / unknown persona → [].
  // PRE-SURFACED only (not purchased) — no paywall in onboarding.
  const planServices = useMemo(
    () => derivePackServicesFrom(personaPack, personaKey, axes.effort),
    [personaPack, personaKey, axes.effort],
  );
  // Categories the type-question answers add (e.g. a gender reveal's "smoke" →
  // fireworks). Merged onto the persona-pack plan, intersected against the type's
  // taxonomy tiles (so an inapplicable add is dropped), deduped, plan order first.
  const extraPicks = useMemo(
    () => extraPicksFrom(questions, details),
    [questions, details],
  );
  const finalPlan = useMemo(() => {
    const labelById = new Map(tiles.map((tile) => [tile.cat, tile.label]));
    const picks: string[] = [];
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const id of [...plan.picks, ...extraPicks]) {
      if (seen.has(id) || !labelById.has(id)) continue;
      seen.add(id);
      picks.push(id);
      labels.push(labelById.get(id)!);
    }
    return { picks, labels };
  }, [plan, extraPicks, tiles]);

  const canContinue = (() => {
    if (screen === 'name') return displayName.trim().length > 0;
    if (isAxis) return Boolean(axes[axisIds[axisIndex]!]);
    return true; // welcome / date / pax / region / reveal are skippable
  })();

  const go = useCallback(
    (delta: number) => {
      setError(null);
      setStep((s) => Math.max(0, Math.min(screens.length - 1, s + delta)));
    },
    [screens.length],
  );

  const pickAxis = (axisId: string, key: string) => {
    setAxes((a) => ({ ...a, [axisId]: key }));
  };

  const pickDetail = (questionId: string, key: string) => {
    setDetails((d) => ({ ...d, [questionId]: key }));
  };

  async function handleCreate() {
    setCommitting(true);
    setError(null);
    const feel = personaKey ? revealByPersona[personaKey]?.feel ?? null : null;
    const forWhom = axes.for_whom;
    const payload: GenericOnboardingPayload = {
      eventType,
      displayName: displayName.trim() || `Our ${eventWord || 'Event'}`,
      honoreeLabel: gatedLifeType ? honoree.trim() || null : null,
      honoreeDependentId: gatedLifeType ? honoreeDependentId : null,
      anchorDate: isAnniversary ? anchorDate || null : null,
      anchorOrigin: isAnniversary ? anchorOrigin : null,
      // Anniversary and birthday return every year by nature; the toggle types
      // are the user's choice; everything else is one-time.
      recurs: isAnniversary || eventType === 'birthday' || (showRecurToggle && recurs),
      region: region || null,
      venueLatitude: null,
      venueLongitude: null,
      pax: pax ? Number(pax) : null,
      budgetBand: null,
      budgetAmountCentavos: null,
      dateMode: 'specific',
      dateCandidates: dateValue ? [dateValue] : [],
      windowStart: null,
      windowEnd: null,
      moodFeelKey: feel,
      experiencePersona: personaKey,
      experienceForWhom:
        forWhom === 'couple' || forWhom === 'guests' || forWhom === 'both' ? forWhom : null,
      experienceAxes: axes,
      // Persona-pack plan + the categories the type-questions added → interested_categories.
      picks: finalPlan.picks,
      // Per-type/per-persona in-app services (effort-scaled) → interested_services.
      interestedServices: planServices,
      refinements: {},
      basicMoodboard: null,
      places: [],
      guidanceOptIn: true,
      sendTopInquiries: false,
      inquiriesPerCategory: 3,
      role: 'host',
      // Per-type signature answers: the light tq_ picks + the rich catalog fields
      // (the 18s, godparents, milestone-as-data…). Both land in
      // events.signature_details — the Brief's specialty layer reads the bag.
      // Rich fields are normalised on the way out: numbers → numbers, roster
      // cells coerced, empties + show_when-hidden fields dropped (specialty-values).
      signatureDetails: { ...details, ...normalizeSpecialtyValues(specialtyFields, specialtyValues) },
    };
    // Anon-draft commit mints a Supabase anonymous session that global captcha
    // gates — mint a Turnstile token (no-op/undefined when unconfigured).
    payload.captchaToken = await mintTurnstileToken('onboarding');
    const res = await commitOnboardingEvent(payload);
    if (res.ok) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      // Plain "continue free" finish: if the couple was sent here from a
      // vendor-invite claim to create their first event, return them to it
      // (/vendor-invite/[slug]) to finish shortlisting; else land on the
      // event dashboard. Mirrors the wedding flow's post-commit goToDashboard.
      router.replace(nextPath ?? `/dashboard/${res.eventId}`);
      return;
    }
    setCommitting(false);
    if (res.error === 'life_event_exists') {
      // NOT an error state — a real product rule (one in-planning event per
      // person, per kind). Walk the user back to the honoree question instead
      // of stranding them on the last screen with "try again": retrying is
      // exactly what CANNOT work, and there is no archive control anywhere in
      // the app to clear the other event.
      setBlockedBy(res.blocking ?? null);
      const idx = screens.indexOf('honoree');
      if (idx >= 0) {
        setStep(idx);
        setError(null);
      } else {
        setError(
          'You already have one of these in planning. Finish or archive it first.',
        );
      }
      return;
    }
    setError(
      res.error === 'not_authenticated'
        ? 'sign_in'
        : 'Something went wrong saving your plan. Please try again.',
    );
  }

  // ---- render helpers --------------------------------------------------------
  // Brand-consistent editorial type (mirrors the wedding flow's `.eyebrow` + `.q`):
  // mono champagne-gold eyebrow over a Cormorant serif-italic headline, so the
  // non-wedding flow reads as the same premium Setnayan product, not a plain form.
  const Eyebrow = (_props: { children: React.ReactNode }) => null;
  const Title = ({ children }: { children: React.ReactNode }) => (
    <h1 className="font-serif text-[28px] font-medium italic leading-[1.12] text-ink sm:text-4xl">{children}</h1>
  );

  function renderScreen() {
    if (screen === 'welcome') {
      return (
        <div className="text-center">
          <div className="mb-4 text-5xl" aria-hidden>
            {emoji}
          </div>
          <Eyebrow>{intro?.eyebrow ?? `Let’s plan your ${label.toLowerCase()}`}</Eyebrow>
          <Title>
            {intro?.headline ??
              'A few quick questions and we’ll shape a plan made for your celebration.'}
          </Title>
          <p className="mt-4 text-ink/60">{intro?.subcopy ?? 'Free to start — no account needed yet.'}</p>
        </div>
      );
    }
    if (screen === 'name') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>What should we call your {label.toLowerCase()}?</Title>
          <input
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={`e.g. ${label} of the Year`}
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          />
        </div>
      );
    }
    if (screen === 'honoree') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>Who are we celebrating?</Title>
          <p className="mt-2 text-ink/55">
            Their first name is enough. It keeps each {label.toLowerCase()} on its
            own plan, so you can have one for each person.
          </p>
          <input
            autoFocus
            value={honoree}
            onChange={(e) => {
              setHonoree(e.target.value);
              // Typing here means "this one is for someone else" — so the alaga
              // carried in from the who step no longer describes it. Drop the
              // link rather than file the event under the previous person; the
              // typed name still keys the cap, exactly as it did before.
              setHonoreeDependentId(null);
              if (blockedBy) setBlockedBy(null);
            }}
            placeholder="e.g. Nina"
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          />
          {/* The refusal lands HERE, next to the field that resolves it — the
              whole reason the old generic error was a dead end is that the user
              was told "try again" on a screen with nothing to change. */}
          {blockedBy ? (
            <p className="mt-4 rounded-[var(--m-r-md)] border border-[color:var(--sn-gold-300)] bg-[color:var(--sn-gold-100)]/70 px-4 py-3 text-sm text-ink/75">
              You already have a {label.toLowerCase()} in planning
              {blockedBy.displayName ? ` — “${blockedBy.displayName}”` : ''}. If
              this one is for someone else, put their name above and we’ll keep
              the two apart.
            </p>
          ) : null}
        </div>
      );
    }
    if (screen === 'anchor') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>What date are you marking?</Title>
          <p className="mt-2 text-ink/55">
            The day it commemorates — not the day you’ll celebrate. We ask that
            next, because you can hold it whenever suits everyone.
          </p>
          <input
            autoFocus
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          />
          <p className="mt-6 text-sm font-medium text-ink/70">What is it?</p>
          {/* Positive origins only — the DB CHECK admits no memorial option, so
              the picker cannot offer one either. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {ANCHOR_ORIGINS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setAnchorOrigin(o)}
                className={`min-h-[44px] rounded-[var(--m-r-md)] border px-3 text-sm font-semibold ${
                  anchorOrigin === o
                    ? 'border-mulberry bg-mulberry/10 text-ink'
                    : 'border-ink/15 bg-paper text-ink/60'
                }`}
              >
                {ANCHOR_ORIGIN_LABELS[o]}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink/45">
            This is what makes it come back every year, and what your reminder
            counts from.
          </p>
        </div>
      );
    }
    if (screen === 'recurs') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>Is this a yearly thing?</Title>
          <p className="mt-2 text-ink/55">
            If it comes back, we’ll line up next year’s when this one wraps.
            You can change this later.
          </p>
          <div className="mt-6 flex gap-2">
            {[
              { v: true, label: 'Yes — every year' },
              { v: false, label: 'Just this once' },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setRecurs(o.v)}
                className={`min-h-[48px] flex-1 rounded-[var(--m-r-md)] border px-4 text-sm font-semibold ${
                  recurs === o.v
                    ? 'border-mulberry bg-mulberry/10 text-ink'
                    : 'border-ink/15 bg-paper text-ink/60'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (screen === 'date') {
      const onTheDayLabel = formatCelebrationDay(anchorOptions?.onTheDayISO);
      const saturdayLabel = formatCelebrationDay(anchorOptions?.saturdayAfterISO);
      // What the anchor IS, in the user's own words: their typed origin, plus
      // the ordinal when we can count it ("your 12th"). n < 1 means the anchor
      // year hasn't come round yet — no ordinal rather than a wrong one.
      const anchorWhat =
        anchorReturn && anchorReturn.n >= 1
          ? `Your ${ordinal(anchorReturn.n)} ${
              anchorOrigin === 'wedding' || anchorOrigin === 'relationship'
                ? 'anniversary'
                : 'year'
            }`
          : ANCHOR_ORIGIN_LABELS[anchorOrigin as keyof typeof ANCHOR_ORIGIN_LABELS] ??
            'The day you’re marking';
      const chip = (on: boolean) =>
        [
          'min-h-[44px] rounded-[var(--m-r-md)] border px-3 text-sm font-semibold',
          on
            ? 'border-mulberry bg-mulberry/10 text-ink'
            : 'border-ink/15 bg-paper text-ink/60',
        ].join(' ');
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          {/* With an anchor on file the question is no longer "when is it?" —
              the day it marks is already known. The real question is which day
              you'll actually hold it. */}
          <Title>{anchorOptions ? 'When are you celebrating?' : 'When is it?'}</Title>
          {anchorOptions && onTheDayLabel ? (
            <p className="mt-2 text-ink/55">
              <span className="font-medium text-ink">{anchorWhat}</span> falls on{' '}
              <span className="font-medium text-ink">{onTheDayLabel}</span> — you can
              celebrate any day.
            </p>
          ) : (
            <p className="mt-2 text-ink/55">
              You can change this later — leave it blank if you’re not sure yet.
            </p>
          )}
          {anchorOptions && onTheDayLabel ? (
            /* The chips are a VIEW of the field below, never a parallel state:
               whatever the calendar lands on re-lights the matching chip, so
               "Another day" can't keep claiming a day that IS the anchor day. */
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className={chip(activePick === 'on_the_day')}
                onClick={() => pickCelebrationDay(anchorOptions.onTheDayISO)}
              >
                On the day · {onTheDayLabel}
              </button>
              {anchorOptions.saturdayAfterISO && saturdayLabel ? (
                <button
                  type="button"
                  className={chip(activePick === 'saturday_after')}
                  onClick={() => pickCelebrationDay(anchorOptions.saturdayAfterISO!)}
                >
                  The Saturday after · {saturdayLabel}
                </button>
              ) : null}
              <button
                type="button"
                className={chip(activePick === 'other')}
                onClick={() => pickCelebrationDay(anchorOptions.onTheDayISO, true)}
              >
                Another day
              </button>
            </div>
          ) : null}
          <input
            ref={dateInputRef}
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          />
        </div>
      );
    }
    if (screen === 'pax') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>About how many guests?</Title>
          <p className="mt-2 text-ink/55">A rough number is fine — it helps us size the plan.</p>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={pax}
            onChange={(e) => setPax(e.target.value)}
            placeholder="e.g. 120"
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          />
        </div>
      );
    }
    if (screen === 'region') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>Where is it happening?</Title>
          <p className="mt-2 text-ink/55">So we can line up vendors near you.</p>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-6 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-lg text-ink outline-none focus:border-mulberry"
          >
            <option value="">Select a region…</option>
            {PH_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (typeQuestion) {
      const selected = details[typeQuestion.id];
      return (
        <div>
          <Eyebrow>{typeQuestion.eyebrow}</Eyebrow>
          <Title>{typeQuestion.question}</Title>
          <div className="mt-6 flex flex-col gap-3">
            {typeQuestion.options.map((o) => {
              const on = selected === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pickDetail(typeQuestion.id, o.key)}
                  className={[
                    'rounded-[var(--m-r-md)] border p-4 text-left transition',
                    on
                      ? 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry'
                      : 'border-ink/12 bg-paper hover:border-ink/30',
                  ].join(' ')}
                >
                  <span className="block font-semibold text-ink">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-ink/60">{o.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (screen === 'specialty') {
      return (
        <div>
          <Title>A few details that make it yours</Title>
          <p className="mt-2 text-ink/55">
            Optional — the more you share, the more personal your plan. Skip anything you’re unsure of.
          </p>
          <SpecialtyFields fields={specialtyFields} value={specialtyValues} onChange={setSpecialtyValues} prefilledKeys={prefilledSpecialtyKeys} />
        </div>
      );
    }
    if (isAxis) {
      const axis = quizAxes[axisIndex]!;
      const selected = axes[axis.id];
      return (
        <div>
          <Eyebrow>{axis.eyebrow}</Eyebrow>
          <Title>{axis.question}</Title>
          <div className="mt-6 flex flex-col gap-3">
            {axis.options.map((o) => {
              const on = selected === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pickAxis(axis.id, o.key)}
                  className={[
                    'rounded-[var(--m-r-md)] border p-4 text-left transition',
                    on
                      ? 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry'
                      : 'border-ink/12 bg-paper hover:border-ink/30',
                  ].join(' ')}
                >
                  <span className="block font-semibold text-ink">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-ink/60">{o.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (screen === 'reveal') {
      return (
        <div className="text-center">
          <Eyebrow>Your plan</Eyebrow>
          {reveal ? (
            <>
              <Title>{reveal.name}</Title>
              <p className="mx-auto mt-3 max-w-md text-ink/65">{reveal.tagline}</p>
              {finalPlan.labels.length > 0 ? (
                <div className="mx-auto mt-7 max-w-md">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-ink/45">
                    We’ll line up
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {finalPlan.labels.map((l) => (
                      <span
                        key={l}
                        className="rounded-full border border-ink/12 bg-paper px-3 py-1.5 text-sm text-ink/80"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  <p className="mt-5 text-sm text-ink/50">
                    You can add, swap, or remove any of these on your dashboard.
                  </p>
                </div>
              ) : (
                <p className="mt-6 text-sm text-ink/50">
                  We’ll line up the right team and a starting look for your {label.toLowerCase()}.
                </p>
              )}
            </>
          ) : (
            <Title>Answer a few more to see your plan.</Title>
          )}
        </div>
      );
    }
    if (screen === 'services' && servicesStepView) {
      return (
        <div>
          <Eyebrow>Your services</Eyebrow>
          <Title>Your memories are already being kept.</Title>
          <ServicesStep
            className="mt-6"
            view={servicesStepView}
            // interested_services' FIRST reader (spec § 1.3): the persona pack's
            // derived service list orders the two Papic products. Nothing else —
            // both always render, at their real prices.
            interestedServices={planServices}
            aiValue={servicesStepAiValue}
          />
        </div>
      );
    }
    // congrats
    return (
      <div className="text-center">
        <div className="mb-4 text-5xl" aria-hidden>
          ✨
        </div>
        <Eyebrow>You’re all set</Eyebrow>
        <Title>
          {displayName.trim() ? `“${displayName.trim()}”` : `Your ${label.toLowerCase()}`} is ready.
        </Title>
        <p className="mt-4 text-ink/60">
          We’ll set up your dashboard{authed ? '' : ' — no account needed to start'}.
        </p>
        {error === 'sign_in' ? (
          <p className="mt-4 text-sm text-mulberry">
            Please{' '}
            <a
              className="underline"
              href={`/login?next=${encodeURIComponent(`/onboarding/${eventType}?resume=1`)}`}
            >
              sign in
            </a>{' '}
            to save your plan — we’ll bring you right back.
          </p>
        ) : error ? (
          <p className="mt-4 text-sm text-mulberry">{error}</p>
        ) : null}
      </div>
    );
  }

  const isLast = screen === 'congrats';

  return (
    <main className="flex min-h-screen flex-col bg-paper">
      {/* Brand lockup — the Setnayan mark + wordmark, so the non-wedding onboarding
          carries the brand from the first screen (the "brand visible" onboarding rule),
          matching the wedding flow's header. Gold mark + mono champagne wordmark. */}
      <header className="mx-auto flex w-full max-w-xl items-center gap-2 px-5 pb-3 pt-5">
        <svg viewBox="0 0 5333.3335 5333.3335" className="h-[26px] w-[26px] shrink-0" role="img" aria-label="Setnayan">
          <path
            d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
            fill="#cb9e4b"
            fillRule="nonzero"
            transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
          />
        </svg>
        <span className="font-mono text-xs font-medium uppercase tracking-[0.34em] text-terracotta-700">Setnayan</span>
      </header>

      {/* progress */}
      <div className="h-1 w-full bg-ink/5">
        <div
          className="h-full bg-mulberry transition-all"
          style={{ width: `${Math.round(((step + 1) / screens.length) * 100)}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-10">
        {renderScreen()}
      </div>

      {/* nav */}
      <div className="sticky bottom-0 border-t border-ink/8 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={step === 0 || committing}
            className="rounded-full px-4 py-2 text-sm font-medium text-ink/60 disabled:opacity-0"
          >
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={committing}
              className="rounded-full bg-mulberry px-7 py-3 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-60"
            >
              {committing ? 'Creating…' : `Create my ${label.toLowerCase()}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!canContinue}
              className="rounded-full bg-mulberry px-7 py-3 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
