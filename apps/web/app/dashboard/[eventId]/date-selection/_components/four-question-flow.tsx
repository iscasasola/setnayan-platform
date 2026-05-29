'use client';

/**
 * Phase 0 Date Selection — 4-question guided flow (client component).
 *
 * Per CLAUDE.md 2026-05-22 owner directive: when the host picks "Help me
 * pick a meaningful one", we walk them through four skippable questions:
 *
 *   1. Religious tradition — already on event (events.ceremony_type from
 *      iteration 0043). We re-confirm here in case the host wants to
 *      change it. This is a soft prompt; the canonical wedding-type chip
 *      on event home owns the lock/edit semantics.
 *   2. Indoor or outdoor preference — drives sensitive-reframe weight
 *      (the typhoon-season reframe applies more strongly outdoor).
 *   3. Meaningful dates — honor / anniversary / birthday / avoid. Bulk-
 *      replaces event_meaningful_dates rows for this event.
 *   4. Sibling sukob awareness — surfaces the Filipino tradition without
 *      blocking; the library reframes positively either way.
 *
 * After the 4 questions, the flow suggests 5 dates (suggestMeaningfulDates).
 * The host picks one or skips to the direct calendar. All questions are
 * skippable.
 *
 * Brand voice rules per [[feedback_setnayan_no_dev_text_post_launch]]:
 * editorial restraint, soft language, no exclamation marks. Tagalog texture
 * where it lands naturally.
 */

import { useState, useTransition } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { lockEventDate, setMeaningfulDates, setCeremonyTypeFromFlow } from '../actions';
import {
  computeAuspiciousReasons,
  suggestMeaningfulDates,
  formatAuspiciousDate,
  dayOfWeekLabel,
  type CeremonyType,
  type MeaningfulDate,
  type MeaningfulDateKind,
  type DateSuggestion,
} from '@/lib/auspicious-date';

type Props = {
  eventId: string;
  initialCeremonyType: CeremonyType | null;
  initialMeaningfulDates: MeaningfulDate[];
  backHref: string;
};

type MeaningfulDateDraft = {
  date: string;
  kind: MeaningfulDateKind;
  note: string;
};

type IndoorOutdoor = 'indoor' | 'outdoor' | 'mixed' | 'undecided';

const CEREMONY_OPTIONS: Array<{
  value: CeremonyType | 'undecided';
  label: string;
  hint: string;
}> = [
  { value: 'catholic', label: 'Catholic', hint: 'Sacrament with parish paperwork' },
  { value: 'civil', label: 'Civil', hint: 'Judge officiating, paperwork-first' },
  { value: 'inc', label: 'INC', hint: 'Iglesia ni Cristo' },
  { value: 'christian', label: 'Christian', hint: 'Born-again, evangelical, others' },
  { value: 'muslim', label: 'Muslim', hint: 'Akad nikah with walimah' },
  { value: 'cultural', label: 'Cultural', hint: 'Filipino tribal or other traditions' },
  { value: 'mixed', label: 'Mixed', hint: 'Two traditions woven together' },
  { value: 'undecided', label: 'Skip for now', hint: 'We&apos;ll show you broad suggestions' },
];

const INDOOR_OUTDOOR_OPTIONS: Array<{ value: IndoorOutdoor; label: string; hint: string }> = [
  { value: 'indoor', label: 'Indoor', hint: 'Hotel ballroom, hacienda, church-only' },
  { value: 'outdoor', label: 'Outdoor', hint: 'Garden, beach, tent — weather plays a role' },
  { value: 'mixed', label: 'Mix of both', hint: 'Indoor ceremony + outdoor reception, or vice versa' },
  { value: 'undecided', label: 'Not decided yet', hint: 'That&apos;s okay — we&apos;ll suggest broadly' },
];

const KIND_LABEL: Record<MeaningfulDateKind, string> = {
  honor: 'We&apos;d love to be near this date',
  anniversary: 'Family anniversary',
  birthday: 'Birthday of someone meaningful',
  avoid: 'We&apos;d prefer not this date',
  other: 'Other',
};

const SUKOB_OPTIONS = [
  {
    value: 'no_siblings_marrying',
    label: 'No siblings getting married soon',
    hint: 'Sukob isn&apos;t a concern',
  },
  {
    value: 'compound_joy',
    label: 'Yes — and we&apos;re compounding the joy',
    hint: 'Some families celebrate both weddings in the same year',
  },
  {
    value: 'spacing_out',
    label: 'Yes — we&apos;re spacing them out',
    hint: 'Other families prefer different years for separate celebrations',
  },
  {
    value: 'undecided',
    label: 'Skip for now',
    hint: 'We&apos;ll let your meaningful dates guide the suggestions',
  },
];

export function FourQuestionFlow({
  eventId,
  initialCeremonyType,
  initialMeaningfulDates,
  backHref,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 'suggestions'>(1);
  const [ceremonyChoice, setCeremonyChoice] = useState<CeremonyType | 'undecided' | null>(
    initialCeremonyType,
  );
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoor | null>(null);
  const [drafts, setDrafts] = useState<MeaningfulDateDraft[]>(
    initialMeaningfulDates.length > 0
      ? initialMeaningfulDates.map((m) => ({
          date: m.date,
          kind: m.kind,
          note: m.note ?? '',
        }))
      : [{ date: '', kind: 'honor', note: '' }],
  );
  const [sukob, setSukob] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  function next() {
    if (step === 1) {
      // Persist ceremony_type to events.ceremony_type before moving to
      // step 2. Per CLAUDE.md 2026-05-22 owner directive ("select wedding
      // type is still not showing the initial wedding type") — the prior
      // build captured the pick in local state only, so the EventMetaLine
      // on event home rendered "Set wedding type" CTA even when the host
      // had picked Catholic here. Stamp ceremony_type_locked_at via the
      // action so the chip reads as confirmed.
      //
      // Skip the write when the host hasn't picked anything OR picked
      // "Skip for now" (undecided) — the action treats both as no-op so
      // events.ceremony_type stays NULL and the dashboard CTA still
      // surfaces correctly.
      if (ceremonyChoice && ceremonyChoice !== 'undecided') {
        submitCeremonyType(() => setStep(2));
      } else {
        setStep(2);
      }
    } else if (step === 2) setStep(3);
    else if (step === 3) {
      // Save meaningful dates before moving to step 4
      submitMeaningfulDates(() => setStep(4));
    } else if (step === 4) {
      setStep('suggestions');
    }
  }

  function submitCeremonyType(onSuccess?: () => void) {
    if (!ceremonyChoice || ceremonyChoice === 'undecided') {
      if (onSuccess) onSuccess();
      return;
    }
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('ceremony_type', ceremonyChoice);
    setError(null);
    startTransition(async () => {
      try {
        const result = await setCeremonyTypeFromFlow(form);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (onSuccess) onSuccess();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not save your wedding type — please try again';
        setError(message);
      }
    });
  }

  function back() {
    if (step === 'suggestions') setStep(4);
    else if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  function submitMeaningfulDates(onSuccess?: () => void) {
    const form = new FormData();
    form.set('event_id', eventId);
    for (const d of drafts) {
      if (!d.date.trim()) continue;
      form.append('meaningful_date', d.date);
      form.append('kind', d.kind);
      form.append('note', d.note);
    }
    // If there are zero meaningful dates, we still need to clear any prior
    // rows — the action handles the empty-array case by deleting all and
    // skipping the insert.
    if (drafts.every((d) => !d.date.trim())) {
      // Even when empty, append placeholders so the action sees the arrays.
      form.append('meaningful_date', '');
      form.append('kind', 'honor');
      form.append('note', '');
    }
    setError(null);
    startTransition(async () => {
      try {
        await setMeaningfulDates(form);
        if (onSuccess) onSuccess();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not save your dates — please try again';
        setError(message);
      }
    });
  }

  function handleLockPicked(date: string) {
    setPickedDate(date);
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('event_date', date);
    form.set('precision', 'day');
    setError(null);
    startTransition(async () => {
      try {
        await lockEventDate(form);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not lock the date — please try again';
        if (
          typeof message === 'string' &&
          (message.includes('NEXT_REDIRECT') || message.includes('NEXT_NOT_FOUND'))
        ) {
          return;
        }
        setError(message);
        setPickedDate(null);
      }
    });
  }

  function addDraftRow() {
    setDrafts((prev) => [...prev, { date: '', kind: 'honor', note: '' }]);
  }

  function updateDraft(idx: number, patch: Partial<MeaningfulDateDraft>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    );
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <a
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Back to date selection
      </a>

      <ProgressStrip step={step} />

      {step === 1 ? (
        <StepContainer
          eyebrow="Step 1 of 4"
          title="What tradition will you celebrate?"
          subtitle="This shapes the small cultural touchpoints we'll surface — feel free to skip if you're still deciding."
        >
          <RadioGroup
            options={CEREMONY_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
            selected={ceremonyChoice}
            onChange={(v) => setCeremonyChoice(v as CeremonyType | 'undecided')}
            name="ceremony_type"
          />
        </StepContainer>
      ) : null}

      {step === 2 ? (
        <StepContainer
          eyebrow="Step 2 of 4"
          title="Indoor, outdoor, or both?"
          subtitle="Outdoor weddings carry weather considerations we'll gently account for — but rain in Filipino tradition is prosperity."
        >
          <RadioGroup
            options={INDOOR_OUTDOOR_OPTIONS}
            selected={indoorOutdoor}
            onChange={(v) => setIndoorOutdoor(v as IndoorOutdoor)}
            name="indoor_outdoor"
          />
        </StepContainer>
      ) : null}

      {step === 3 ? (
        <StepContainer
          eyebrow="Step 3 of 4"
          title="Are there dates close to your heart?"
          subtitle="Birthdays, anniversaries, dates you'd love to honor — or quietly avoid. All optional."
        >
          <div className="space-y-3">
            {drafts.map((draft, idx) => (
              <div
                key={idx}
                className="space-y-3 rounded-lg border border-ink/10 bg-cream p-4 sm:flex sm:items-end sm:gap-3 sm:space-y-0"
              >
                <div className="flex-1">
                  <label
                    htmlFor={`meaningful-date-${idx}`}
                    className="block text-xs font-medium uppercase tracking-wide text-ink/60"
                  >
                    Date
                  </label>
                  <input
                    id={`meaningful-date-${idx}`}
                    type="date"
                    value={draft.date}
                    onChange={(e) => updateDraft(idx, { date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`meaningful-kind-${idx}`}
                    className="block text-xs font-medium uppercase tracking-wide text-ink/60"
                  >
                    Kind
                  </label>
                  <select
                    id={`meaningful-kind-${idx}`}
                    value={draft.kind}
                    onChange={(e) =>
                      updateDraft(idx, { kind: e.target.value as MeaningfulDateKind })
                    }
                    className="mt-1 w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                  >
                    {(Object.keys(KIND_LABEL) as MeaningfulDateKind[]).map((k) => (
                      <option key={k} value={k}>
                        {/* Strip HTML entities for option labels — they don't decode inside <option> */}
                        {KIND_LABEL[k].replace(/&apos;/g, "'")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`meaningful-note-${idx}`}
                    className="block text-xs font-medium uppercase tracking-wide text-ink/60"
                  >
                    Note (optional)
                  </label>
                  <input
                    id={`meaningful-note-${idx}`}
                    type="text"
                    value={draft.note}
                    placeholder="e.g., Tatay&apos;s birthday"
                    maxLength={80}
                    onChange={(e) => updateDraft(idx, { note: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta/30"
                  />
                </div>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeDraft(idx)}
                    aria-label="Remove this date"
                    className="self-end rounded-md p-2 text-ink/50 hover:bg-ink/5 hover:text-ink sm:self-end"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={addDraftRow}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink/25 px-3 py-2 text-sm text-ink/70 hover:border-terracotta hover:text-terracotta"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Add another date
            </button>
          </div>
        </StepContainer>
      ) : null}

      {step === 4 ? (
        <StepContainer
          eyebrow="Step 4 of 4"
          title="Are siblings getting married around the same time?"
          subtitle="Sukob is a beloved Filipino tradition — many families celebrate compounding joy, others prefer to space the celebrations out. Both are honored."
        >
          <RadioGroup
            options={SUKOB_OPTIONS}
            selected={sukob}
            onChange={(v) => setSukob(v)}
            name="sukob"
          />
        </StepContainer>
      ) : null}

      {step === 'suggestions' ? (
        <SuggestionsList
          ceremonyType={
            ceremonyChoice && ceremonyChoice !== 'undecided'
              ? (ceremonyChoice as CeremonyType)
              : initialCeremonyType
          }
          meaningfulDates={drafts
            .filter((d) => d.date.trim().length > 0)
            .map((d) => ({ date: d.date, kind: d.kind, note: d.note || null }))}
          onPick={(d) => handleLockPicked(d)}
          pickedDate={pickedDate}
          pending={pending}
        />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step !== 1 ? (
          <button
            type="button"
            onClick={back}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm text-ink/75 hover:bg-ink/[0.03] disabled:opacity-50"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Back
          </button>
        ) : (
          <span />
        )}

        {step !== 'suggestions' ? (
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-2.5 text-base font-medium text-cream shadow-sm hover:bg-mulberry-600 focus:outline-none focus:ring-2 focus:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Saving...
              </>
            ) : step === 4 ? (
              <>
                See suggestions
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </>
            ) : (
              <>
                Continue
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StepContainer({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <p className="text-base text-ink/70">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ProgressStrip({ step }: { step: 1 | 2 | 3 | 4 | 'suggestions' }) {
  const stepNum = step === 'suggestions' ? 5 : step;
  return (
    <ol className="flex w-full items-center gap-1.5" aria-label="Guided flow progress">
      {[1, 2, 3, 4, 5].map((s) => {
        const isActive = s === stepNum;
        const isDone = s < stepNum;
        return (
          <li key={s} className="flex flex-1 items-center">
            <span
              aria-current={isActive ? 'step' : undefined}
              className={`block h-1.5 flex-1 rounded-full transition-colors ${
                isActive ? 'bg-terracotta' : isDone ? 'bg-terracotta/45' : 'bg-ink/10'
              }`}
            />
          </li>
        );
      })}
    </ol>
  );
}

function RadioGroup<T extends string>({
  options,
  selected,
  onChange,
  name,
}: {
  options: Array<{ value: T; label: string; hint: string }>;
  selected: T | null;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{name}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                isSelected
                  ? 'border-terracotta bg-terracotta/[0.06] ring-1 ring-terracotta/40'
                  : 'border-ink/15 bg-cream hover:border-terracotta/40'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => onChange(opt.value)}
                className="mt-1 h-4 w-4 accent-terracotta"
              />
              <div className="space-y-0.5">
                <span className="block text-sm font-medium text-ink">{opt.label}</span>
                {/* Escape sequences in source render literally in option hints */}
                <span
                  className="block text-xs text-ink/55"
                  dangerouslySetInnerHTML={{ __html: opt.hint }}
                />
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SuggestionsList({
  ceremonyType,
  meaningfulDates,
  onPick,
  pickedDate,
  pending,
}: {
  ceremonyType: CeremonyType | null;
  meaningfulDates: MeaningfulDate[];
  onPick: (date: string) => void;
  pickedDate: string | null;
  pending: boolean;
}) {
  const suggestions: DateSuggestion[] = suggestMeaningfulDates(
    meaningfulDates,
    ceremonyType,
  );

  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Step 5 of 5
        </p>
        <h2 className="mt-1 font-display text-2xl italic leading-tight text-ink sm:text-3xl">
          Almost ready
        </h2>
        <p className="mt-3 text-base text-ink/70">
          We couldn&apos;t find specific resonance from what you shared — but every date holds
          beauty. Pick from the calendar and we&apos;ll show you what makes your chosen date
          special.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Step 5 of 5
        </p>
        <h2 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
          A few dates that resonate with what you shared
        </h2>
        <p className="text-base text-ink/70">
          Pick one that feels right — or open the calendar to choose your own.
        </p>
      </div>

      <ul className="space-y-3">
        {suggestions.map((s) => {
          const [y, m, d] = s.date.split('-').map(Number);
          const dateObj = y && m && d ? new Date(y, m - 1, d) : null;
          const dow = dateObj ? dayOfWeekLabel(dateObj) : '';
          const isPicked = pickedDate === s.date;
          return (
            <li
              key={s.date}
              className="rounded-xl border border-ink/10 bg-cream p-5 transition-colors hover:border-terracotta/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-display text-xl italic text-ink">
                    {formatAuspiciousDate(s.date)}
                  </p>
                  <p className="text-xs text-ink/55">{dow}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onPick(s.date)}
                  disabled={pending || isPicked}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-mulberry px-3 py-1.5 text-sm font-medium text-cream shadow-sm hover:bg-mulberry-600 focus:outline-none focus:ring-2 focus:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPicked && pending ? (
                    <>
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                      Locking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      Lock this date
                    </>
                  )}
                </button>
              </div>
              <ul className="mt-3 space-y-1.5">
                {s.reasons.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-relaxed text-ink/75"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-terracotta/60"
                    />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
