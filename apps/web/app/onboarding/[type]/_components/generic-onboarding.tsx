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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GENERIC_EXP_AXES,
  GENERIC_PERSONA_REVEAL,
  GENERIC_AXIS_IDS,
} from '@/lib/onboarding/generic-content';
import { resolvePersona } from '@/app/onboarding/wedding/_data/experience-personas';
import { PH_REGIONS } from '@/lib/regions';
import { commitOnboardingEvent } from '@/app/onboarding/_shared/commit-event';
import type { GenericOnboardingPayload } from '@/lib/onboarding/types';
import { derivePackPlan, derivePackServices } from '@/lib/onboarding/persona-packs';
import { getTypeQuestions, extraPicksFromAnswers } from '@/lib/onboarding/type-questions';
import type { OnboardingPickChip } from '@/lib/onboarding-refinements';

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
  authed: boolean;
  anonEnabled: boolean;
  resume: boolean;
};

type Draft = {
  v: 1;
  startedAt: number;
  displayName: string;
  dateValue: string;
  pax: string;
  region: string;
  axes: Record<string, string>;
  /** Per-type signature-moment answers (questionId → optionKey). */
  details: Record<string, string>;
};

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function GenericOnboarding(props: Props) {
  const { eventType, label, emoji, eventWord, personaPackKey, tiles, authed, resume } = props;
  const router = useRouter();
  const draftKey = `setnayan_onboarding_generic_${eventType}_draft_v1`;

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [pax, setPax] = useState('');
  const [region, setRegion] = useState('');
  const [axes, setAxes] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-type signature-moment screens, injected into the sequence after 'region'.
  // typeQuestions is stable (keyed on the personaPackKey prop), so `screens` is too.
  const typeQuestions = useMemo(() => getTypeQuestions(personaPackKey), [personaPackKey]);
  const screens = useMemo<string[]>(
    () => [
      'welcome',
      'name',
      'date',
      'pax',
      'region',
      ...typeQuestions.map((q) => `tq_${q.id}`),
      ...GENERIC_AXIS_IDS, // for_whom · feel · energy · roots · effort
      'reveal',
      'congrats',
    ],
    [typeQuestions],
  );

  // -- Hydrate the localStorage draft (30-day TTL). On ?resume=1 (post sign-in)
  //    jump to the final screen so the visitor can finish in one tap. --
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && d.v === 1 && Date.now() - d.startedAt < DRAFT_TTL_MS) {
          setDisplayName(d.displayName ?? '');
          setDateValue(d.dateValue ?? '');
          setPax(d.pax ?? '');
          setRegion(d.region ?? '');
          setAxes(d.axes ?? {});
          setDetails(d.details ?? {});
          if (resume) setStep(screens.indexOf('congrats'));
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
    setHydrated(true);
  }, [draftKey, resume, screens]);

  // -- Persist the draft on every change (after hydration). --
  useEffect(() => {
    if (!hydrated) return;
    try {
      const d: Draft = { v: 1, startedAt: Date.now(), displayName, dateValue, pax, region, axes, details };
      localStorage.setItem(draftKey, JSON.stringify(d));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [hydrated, draftKey, displayName, dateValue, pax, region, axes, details]);

  const screen = screens[step]!;
  const axisIndex = GENERIC_AXIS_IDS.indexOf(screen as (typeof GENERIC_AXIS_IDS)[number]);
  const isAxis = axisIndex >= 0;
  const tqId = screen.startsWith('tq_') ? screen.slice(3) : null;
  const typeQuestion = tqId ? typeQuestions.find((q) => q.id === tqId) ?? null : null;

  const allAxesAnswered = GENERIC_AXIS_IDS.every((id) => Boolean(axes[id]));
  const personaKey = useMemo(
    () => (allAxesAnswered ? resolvePersona(axes) : null),
    [allAxesAnswered, axes],
  );
  const reveal = personaKey ? GENERIC_PERSONA_REVEAL[personaKey] : null;
  // Starter plan: per-type persona pack (essentials + this persona's extras),
  // intersected with the type's taxonomy and sized by the effort axis. Falls back
  // to taxonomy-top-N for any type without a pack.
  const plan = useMemo(
    () => derivePackPlan(personaPackKey, personaKey, tiles, axes.effort),
    [personaPackKey, personaKey, tiles, axes.effort],
  );
  // In-app Setnayan services to pre-surface on the dashboard for this persona +
  // effort (→ style_preferences.interested_services). No pack / unknown persona → [].
  // PRE-SURFACED only (not purchased) — no paywall in onboarding.
  const planServices = useMemo(
    () => derivePackServices(personaPackKey, personaKey, axes.effort),
    [personaPackKey, personaKey, axes.effort],
  );
  // Categories the type-question answers add (e.g. a gender reveal's "smoke" →
  // fireworks). Merged onto the persona-pack plan, intersected against the type's
  // taxonomy tiles (so an inapplicable add is dropped), deduped, plan order first.
  const extraPicks = useMemo(
    () => extraPicksFromAnswers(personaPackKey, details),
    [personaPackKey, details],
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
    if (isAxis) return Boolean(axes[GENERIC_AXIS_IDS[axisIndex]!]);
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
    const feel = personaKey ? GENERIC_PERSONA_REVEAL[personaKey]?.feel ?? null : null;
    const forWhom = axes.for_whom;
    const payload: GenericOnboardingPayload = {
      eventType,
      displayName: displayName.trim() || `Our ${eventWord || 'Event'}`,
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
    };
    const res = await commitOnboardingEvent(payload);
    if (res.ok) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      router.replace(`/dashboard/${res.eventId}`);
      return;
    }
    setCommitting(false);
    setError(
      res.error === 'not_authenticated'
        ? 'sign_in'
        : 'Something went wrong saving your plan. Please try again.',
    );
  }

  // ---- render helpers --------------------------------------------------------
  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-ink/45">{children}</p>
  );
  const Title = ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">{children}</h1>
  );

  function renderScreen() {
    if (screen === 'welcome') {
      return (
        <div className="text-center">
          <div className="mb-4 text-5xl" aria-hidden>
            {emoji}
          </div>
          <Eyebrow>Let’s plan your {label.toLowerCase()}</Eyebrow>
          <Title>A few quick questions and we’ll shape a plan made for your celebration.</Title>
          <p className="mt-4 text-ink/60">Free to start — no account needed yet.</p>
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
    if (screen === 'date') {
      return (
        <div>
          <Eyebrow>The basics</Eyebrow>
          <Title>When is it?</Title>
          <p className="mt-2 text-ink/55">You can change this later — leave it blank if you’re not sure yet.</p>
          <input
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
    if (isAxis) {
      const axis = GENERIC_EXP_AXES[axisIndex]!;
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
