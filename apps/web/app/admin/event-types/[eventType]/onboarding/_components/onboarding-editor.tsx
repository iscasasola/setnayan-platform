'use client';

/**
 * Onboarding CONTENT editor (client) — 0053 · 2026-06-28.
 *
 * Edits one non-wedding type's onboarding spec (intro · signature questions ·
 * persona starter-plan pack · reveal copy) as in-memory state, then submits the
 * WHOLE spec as one JSON field to `upsertOnboardingSpec` (the established pattern
 * for deeply-nested admin forms). The hidden `spec_json` is recomputed from state
 * on every render, so it always matches what's on screen. "Reset to default"
 * deletes the override row → the flow falls back to the code defaults.
 */
import { useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { upsertOnboardingSpec, resetOnboardingSpec } from '../../../actions';
import type { OnboardingSpec } from '@/lib/onboarding/onboarding-spec';
import type { TypeQuestion } from '@/lib/onboarding/type-questions';

type Option = { value: string; label: string };

/** Mutable editor copy of the persona pack (TypePersonaPack is readonly). */
type EditorPack = {
  essentials: string[];
  byPersona: Record<string, string[]>;
  servicesByPersona: Record<string, string[]>;
};

const PERSONA_KEYS = [
  'keepsake',
  'big_celebration',
  'best_of_both',
  'intimate_romance',
  'modern_statement',
  'rooted_tradition',
] as const;
type PersonaKey = (typeof PERSONA_KEYS)[number];

type RevealCopy = { name: string; tagline: string; feel: string };

const FIELD =
  'w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-mulberry';
const KEYFIELD =
  'w-full rounded border border-ink/15 bg-ink/[0.03] px-2 py-1 font-mono text-xs text-ink/70 outline-none focus:border-mulberry';
const LABEL = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50';
const SECTION = 'rounded-xl border border-ink/10 bg-white p-5';
const H2 = 'text-sm font-semibold text-ink';

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Toggle-chip multi-select. Renders any selected id not in `options` too, so a
 *  pack id that isn't an applicable tile is shown (and editable), never silently lost. */
function ChipMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: Option[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const known = new Set(options.map((o) => o.value));
  const extras = selected.filter((s) => !known.has(s)).map((s) => ({ value: s, label: s }));
  const all = [...options, ...extras];
  const sel = new Set(selected);
  function toggle(v: string) {
    onChange(sel.has(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  }
  return (
    <div className="mt-1 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-ink/10 bg-ink/[0.02] p-2">
      {all.length === 0 ? (
        <span className="px-1 py-0.5 text-xs text-ink/40">No categories available for this type.</span>
      ) : null}
      {all.map((o) => {
        const on = sel.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={[
              'rounded-full border px-2.5 py-1 text-xs transition',
              on
                ? 'border-mulberry bg-mulberry/10 text-mulberry'
                : 'border-ink/15 bg-white text-ink/60 hover:border-ink/30',
              known.has(o.value) ? '' : 'italic',
            ].join(' ')}
            title={known.has(o.value) ? o.value : `${o.value} (not an applicable tile)`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingEditor({
  eventType,
  spec,
  hasOverride,
  categoryOptions,
  serviceOptions,
}: {
  eventType: string;
  spec: OnboardingSpec;
  hasOverride: boolean;
  categoryOptions: Option[];
  serviceOptions: Option[];
}) {
  const [intro, setIntro] = useState({
    eyebrow: spec.intro?.eyebrow ?? '',
    headline: spec.intro?.headline ?? '',
    subcopy: spec.intro?.subcopy ?? '',
  });
  const [questions, setQuestions] = useState<TypeQuestion[]>(
    spec.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, adds: [...o.adds] })) })),
  );
  const [pack, setPack] = useState<EditorPack>(() => {
    const p = spec.personaPack;
    return {
      essentials: p ? [...p.essentials] : [],
      byPersona: Object.fromEntries(PERSONA_KEYS.map((k) => [k, [...(p?.byPersona[k] ?? [])]])),
      servicesByPersona: Object.fromEntries(
        PERSONA_KEYS.map((k) => [k, [...(p?.servicesByPersona[k] ?? [])]]),
      ),
    };
  });
  const [reveal, setReveal] = useState<Record<string, RevealCopy>>(() =>
    Object.fromEntries(
      PERSONA_KEYS.map((p) => [
        p,
        {
          name: spec.revealByPersona[p]?.name ?? '',
          tagline: spec.revealByPersona[p]?.tagline ?? '',
          feel: spec.revealByPersona[p]?.feel ?? '',
        },
      ]),
    ),
  );

  const specJson = JSON.stringify({ intro, questions, personaPack: pack, reveal });

  // ---- question mutators ----
  const setQ = (i: number, patch: Partial<TypeQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, d: number) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const addQ = () =>
    setQuestions((qs) => [
      ...qs,
      { id: `q${qs.length + 1}`, eyebrow: '', question: '', options: [] },
    ]);
  const removeQ = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));
  const setOpt = (qi: number, oi: number, patch: Partial<TypeQuestion['options'][number]>) =>
    setQuestions((qs) =>
      qs.map((q, j) =>
        j === qi ? { ...q, options: q.options.map((o, k) => (k === oi ? { ...o, ...patch } : o)) } : q,
      ),
    );
  const addOpt = (qi: number) =>
    setQuestions((qs) =>
      qs.map((q, j) =>
        j === qi
          ? { ...q, options: [...q.options, { key: `opt${q.options.length + 1}`, title: '', desc: '', adds: [] }] }
          : q,
      ),
    );
  const removeOpt = (qi: number, oi: number) =>
    setQuestions((qs) =>
      qs.map((q, j) => (j === qi ? { ...q, options: q.options.filter((_, k) => k !== oi) } : q)),
    );

  return (
    <div className="mt-6 space-y-5">
      {/* ---- main save form ---- */}
      <form action={upsertOnboardingSpec} className="space-y-5">
        <input type="hidden" name="event_type" value={eventType} />
        <input type="hidden" name="spec_json" value={specJson} />

        {/* Intro */}
        <section className={SECTION}>
          <h2 className={H2}>Welcome screen</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            Optional. Fill all three for a custom welcome, or leave blank for the standard one.
          </p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className={LABEL}>Eyebrow</span>
              <input
                className={`mt-1 ${FIELD}`}
                value={intro.eyebrow}
                onChange={(e) => setIntro({ ...intro, eyebrow: e.target.value })}
                placeholder="Let's plan your birthday"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Headline</span>
              <input
                className={`mt-1 ${FIELD}`}
                value={intro.headline}
                onChange={(e) => setIntro({ ...intro, headline: e.target.value })}
                placeholder="A few quick questions and we'll shape your plan."
              />
            </label>
            <label className="block">
              <span className={LABEL}>Subcopy</span>
              <input
                className={`mt-1 ${FIELD}`}
                value={intro.subcopy}
                onChange={(e) => setIntro({ ...intro, subcopy: e.target.value })}
                placeholder="Free to start — no account needed yet."
              />
            </label>
          </div>
        </section>

        {/* Signature questions */}
        <section className={SECTION}>
          <div className="flex items-center justify-between">
            <h2 className={H2}>Signature questions</h2>
            <span className="text-xs text-ink/45">{questions.length} / 8</span>
          </div>
          <p className="mt-0.5 text-xs text-ink/50">
            The type-specific moments. Each answer can add vendor categories to the starter plan.
          </p>

          <div className="mt-4 space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg border border-ink/12 bg-ink/[0.015] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
                    Question {qi + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveQ(qi, -1)} disabled={qi === 0} className="rounded px-2 py-0.5 text-xs text-ink/50 hover:bg-ink/5 disabled:opacity-30" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveQ(qi, 1)} disabled={qi === questions.length - 1} className="rounded px-2 py-0.5 text-xs text-ink/50 hover:bg-ink/5 disabled:opacity-30" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => removeQ(qi)} className="rounded px-2 py-0.5 text-xs text-danger-600 hover:bg-danger-50">Remove</button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
                  <label className="block">
                    <span className={LABEL}>Eyebrow</span>
                    <input className={`mt-1 ${FIELD}`} value={q.eyebrow} onChange={(e) => setQ(qi, { eyebrow: e.target.value })} placeholder="The fun" />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Question</span>
                    <input className={`mt-1 ${FIELD}`} value={q.question} onChange={(e) => setQ(qi, { question: e.target.value })} placeholder="Any special touch?" />
                  </label>
                </div>
                <label className="mt-2 block">
                  <span className={LABEL}>ID <span className="normal-case text-ink/35">(answer key — keep stable)</span></span>
                  <input className={`mt-1 ${KEYFIELD}`} value={q.id} onChange={(e) => setQ(qi, { id: slug(e.target.value) })} placeholder="highlight" />
                </label>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>Options ({q.options.length})</span>
                    <button type="button" onClick={() => addOpt(qi)} className="text-xs font-medium text-mulberry hover:underline">+ Add option</button>
                  </div>
                  <div className="mt-2 space-y-3">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="rounded-md border border-ink/10 bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                          <input className={FIELD} value={o.title} onChange={(e) => setOpt(qi, oi, { title: e.target.value })} placeholder="Photo booth" />
                          <input className={KEYFIELD} value={o.key} onChange={(e) => setOpt(qi, oi, { key: slug(e.target.value) })} placeholder="booth" />
                        </div>
                        <input className={`mt-2 ${FIELD}`} value={o.desc} onChange={(e) => setOpt(qi, oi, { desc: e.target.value })} placeholder="Props, prints, instant memories." />
                        <span className={`mt-2 ${LABEL}`}>Adds categories to the plan</span>
                        <ChipMultiSelect options={categoryOptions} selected={o.adds} onChange={(adds) => setOpt(qi, oi, { adds })} />
                        <div className="mt-2 text-right">
                          <button type="button" onClick={() => removeOpt(qi, oi)} className="text-xs text-danger-600 hover:underline">Remove option</button>
                        </div>
                      </div>
                    ))}
                    {q.options.length === 0 ? (
                      <p className="text-xs text-ink/40">Add at least one option for this question to appear.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {questions.length < 8 ? (
              <button type="button" onClick={addQ} className="w-full rounded-lg border border-dashed border-ink/25 py-3 text-sm text-ink/60 hover:border-mulberry hover:text-mulberry">
                + Add question
              </button>
            ) : null}
          </div>
        </section>

        {/* Persona starter-plan pack */}
        <section className={SECTION}>
          <h2 className={H2}>Starter plan</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            Lead categories everyone gets, plus per-experience extras + in-app services the reveal pre-surfaces.
          </p>
          <div className="mt-3">
            <span className={LABEL}>Essentials (lead categories)</span>
            <ChipMultiSelect options={categoryOptions} selected={pack.essentials} onChange={(essentials) => setPack({ ...pack, essentials })} />
          </div>
          <div className="mt-4 space-y-4">
            {PERSONA_KEYS.map((p) => (
              <details key={p} className="rounded-lg border border-ink/10 bg-ink/[0.015] p-3">
                <summary className="cursor-pointer text-sm font-medium text-ink/80">
                  {reveal[p]?.name?.trim() || p.replace(/_/g, ' ')}
                  <span className="ml-2 text-xs font-normal text-ink/40">
                    {pack.byPersona[p]!.length} cats · {pack.servicesByPersona[p]!.length} services
                  </span>
                </summary>
                <div className="mt-3">
                  <span className={LABEL}>Extra categories</span>
                  <ChipMultiSelect
                    options={categoryOptions}
                    selected={pack.byPersona[p]!}
                    onChange={(v) => setPack({ ...pack, byPersona: { ...pack.byPersona, [p]: v } })}
                  />
                </div>
                <div className="mt-3">
                  <span className={LABEL}>In-app services</span>
                  <ChipMultiSelect
                    options={serviceOptions}
                    selected={pack.servicesByPersona[p]!}
                    onChange={(v) => setPack({ ...pack, servicesByPersona: { ...pack.servicesByPersona, [p]: v } })}
                  />
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Reveal copy */}
        <section className={SECTION}>
          <h2 className={H2}>Reveal copy</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            The persona title + tagline shown on the plan reveal. Blank = the standard wording.
          </p>
          <div className="mt-3 space-y-3">
            {PERSONA_KEYS.map((p) => (
              <div key={p} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <input
                  className={FIELD}
                  value={reveal[p]?.name ?? ''}
                  onChange={(e) => setReveal({ ...reveal, [p]: { ...reveal[p]!, name: e.target.value } })}
                  placeholder={p.replace(/_/g, ' ')}
                />
                <input
                  className={FIELD}
                  value={reveal[p]?.tagline ?? ''}
                  onChange={(e) => setReveal({ ...reveal, [p]: { ...reveal[p]!, tagline: e.target.value } })}
                  placeholder="One-line reveal tagline…"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <SubmitButton className="rounded-full bg-mulberry px-6 py-2.5 text-sm font-semibold text-paper hover:opacity-90">
            Save onboarding content
          </SubmitButton>
        </div>
      </form>

      {/* ---- reset (separate form so it doesn't submit the editor) ---- */}
      {hasOverride ? (
        <form
          action={resetOnboardingSpec}
          onSubmit={(e) => {
            if (!confirm('Reset this type to the built-in default onboarding? Your custom content will be removed.')) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="event_type" value={eventType} />
          <button type="submit" className="text-sm text-danger-600 hover:underline">
            Reset to default content
          </button>
        </form>
      ) : null}
    </div>
  );
}
