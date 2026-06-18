'use client';

/**
 * Step-1 opening picker (controlled).
 *
 * Renders the reveal-library tiles + the active opening's blurb + the "Make this
 * mine" commit. The auto-playing PREVIEW itself lives in the single shared device
 * frame in StdBuilderClient (opening → film); this card only drives WHICH opening
 * is shown (`previewing`, lifted to the parent) and persists the choice
 * (events.std_reveal_template via chooseRevealTemplate — its own eager write,
 * separate from the film "Render").
 */

import { useState, useTransition } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { chooseRevealTemplate } from '@/app/dashboard/[eventId]/add-ons/save-the-date/actions';
import {
  REVEAL_LIBRARY,
  NO_REVEAL,
  type RevealTemplate,
  type RevealChoice,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import type { RevealEffects } from '@/lib/std-reveal-effects';

const ENVELOPES: RevealTemplate[] = ['four-flap', 'two-flap-vertical', 'two-flap-horizontal'];

/** Compact checkbox toggle (veil control block). */
function EffectToggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex w-full items-center gap-3 text-left"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          on ? 'border-mulberry bg-mulberry text-cream' : 'border-ink/30 bg-white text-transparent'
        }`}
      >
        <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink/55">{hint}</span>
      </span>
    </button>
  );
}

/** Colour swatch + native picker with an inherit-from-Mood-Board reset. */
function ColorRow({
  label,
  value,
  inherited,
  onChange,
  onReset,
}: {
  label: string;
  value: string | null;
  inherited: string;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const current = value ?? inherited;
  return (
    <div className="flex items-center gap-3">
      <label
        className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-ink/20 shadow-inner"
        style={{ backgroundColor: current }}
      >
        <input
          type="color"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink/55">
          {value ? current.toUpperCase() : 'From your Mood Board'}
        </span>
      </span>
      {value ? (
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-terracotta hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

type Props = {
  /** The event whose chosen opening this persists. */
  eventId: string;
  /** The opening currently shown in the shared preview (owned by the parent).
   *  'none' = No Reveal (free — the film plays straight away). */
  previewing: RevealChoice;
  /** Show a different opening in the shared preview. */
  onPreview: (t: RevealChoice) => void;
  /** The couple's currently-saved opening (events.std_reveal_template). */
  chosenTemplate?: RevealChoice | null;
  /** Effect toggles + colour overrides (owned by the parent; saved on Render). */
  effects: RevealEffects;
  /** Flip one boolean effect toggle (butterflies / petals / music). */
  onToggleEffect: (key: 'butterflies' | 'petals' | 'music') => void;
  /** Set (or clear, with null) a veil colour override. */
  onSetColor: (key: 'veilColor' | 'petalColor', value: string | null) => void;
  /** Mood-Board-derived defaults shown when an override is null (inherit). */
  inheritedVeilColor: string;
  inheritedPetalColor: string;
  /** Admin "which openings couples may use" map (reveal_studio_config.templates).
   *  A template is offered unless it's explicitly turned off (=== false). */
  allowed: Record<string, boolean>;
};

export function RevealPreviewCard({
  eventId,
  previewing,
  onPreview,
  chosenTemplate = null,
  effects,
  onToggleEffect,
  onSetColor,
  inheritedVeilColor,
  inheritedPetalColor,
  allowed,
}: Props) {
  // Only offer openings the admin left enabled (Reveal Studio · config.templates).
  const library = REVEAL_LIBRARY.filter((t) => allowed[t.id] !== false);
  const isNoReveal = previewing === NO_REVEAL;
  const isEnvelope = !isNoReveal && ENVELOPES.includes(previewing as RevealTemplate);
  const isVeil = previewing === 'veil-sheer';
  const effectKey: 'butterflies' | 'petals' = isEnvelope ? 'butterflies' : 'petals';
  const effectLabel = isEnvelope ? 'Add butterflies' : 'Add falling petals';
  const effectHint = isEnvelope
    ? 'Butterflies flutter out as the flaps open.'
    : 'Rose petals drift down through the reveal.';
  const effectOn = effects[effectKey];
  const [chosen, setChosen] = useState<RevealChoice | null>(chosenTemplate);
  const [pending, startTransition] = useTransition();

  const saveChoice = (t: RevealChoice) =>
    startTransition(async () => {
      const r = await chooseRevealTemplate(eventId, t);
      if (r.ok) setChosen(t);
    });

  const isChosen = previewing === chosen;
  const previewedItem = REVEAL_LIBRARY.find((t) => t.id === previewing);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Step 1 · Opening
        </p>
        <h2 className="font-serif text-xl italic">How your page opens</h2>
        <p className="text-sm text-ink/65">
          A guest opens your invitation and it begins with this reveal, then lifts away to reveal
          your Save the Date. Pick an opening — watch it play in your preview.
        </p>
      </div>

      {/* Opening picker */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {/* No Reveal — the FREE choice; the film plays straight away, no opening. */}
        <button
          type="button"
          onClick={() => onPreview(NO_REVEAL)}
          aria-pressed={isNoReveal}
          className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
            isNoReveal
              ? 'border-terracotta bg-terracotta/5 text-ink ring-2 ring-terracotta/15'
              : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
          }`}
        >
          {chosen === NO_REVEAL ? (
            <Check
              aria-hidden
              className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-terracotta"
              strokeWidth={2.5}
            />
          ) : null}
          <span className="text-sm font-medium leading-tight">No reveal</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-55">
            Free · just your film
          </span>
        </button>
        {library.map((t) => {
          const active = previewing === t.id;
          const saved = chosen === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPreview(t.id)}
              aria-pressed={active}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
                active
                  ? 'border-terracotta bg-terracotta/5 text-ink ring-2 ring-terracotta/15'
                  : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
              }`}
            >
              {saved ? (
                <Check
                  aria-hidden
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-terracotta"
                  strokeWidth={2.5}
                />
              ) : null}
              <span className="text-sm font-medium leading-tight">{t.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-55">
                {t.motion}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active opening blurb — the previews are tiny + un-recordable, so this
          line is how the couple tells the openings apart. */}
      {isNoReveal ? (
        <p className="text-sm text-ink/70">
          <span className="font-medium text-ink">No reveal</span>
          {' — your film plays right away, with no opening to lift. This is the free option; '}
          the openings above are a premium touch.
        </p>
      ) : previewedItem ? (
        <p className="text-sm text-ink/70">
          <span className="font-medium text-ink">{previewedItem.label}</span>
          {' — '}
          {previewedItem.blurb}
        </p>
      ) : null}

      {/* Per-opening controls. Hidden for No Reveal (nothing to decorate). The
          wax seal is NOT here — it's the structural open-gate, always on for
          envelopes (owner-locked). The veil gets its own four controls (owner
          2026-06-18): music · petals · veil + petal colour. Envelopes / doors
          keep their single decorative toggle. */}
      {isNoReveal ? null : isVeil ? (
        <div className="space-y-3.5 rounded-xl border border-ink/10 bg-cream/60 p-3.5">
          <EffectToggle
            label="Add music"
            hint="Your song plays as the page opens and through the film."
            on={effects.music}
            onToggle={() => onToggleEffect('music')}
          />
          <EffectToggle
            label="Add falling petals"
            hint="Rose petals drift down from the top through the reveal."
            on={effects.petals}
            onToggle={() => onToggleEffect('petals')}
          />
          <div className="h-px bg-ink/10" />
          <ColorRow
            label="Veil colour"
            value={effects.veilColor}
            inherited={inheritedVeilColor}
            onChange={(hex) => onSetColor('veilColor', hex)}
            onReset={() => onSetColor('veilColor', null)}
          />
          <ColorRow
            label="Petal colour"
            value={effects.petalColor}
            inherited={inheritedPetalColor}
            onChange={(hex) => onSetColor('petalColor', hex)}
            onReset={() => onSetColor('petalColor', null)}
          />
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-ink/10 bg-cream/60 p-3.5">
          <button
            type="button"
            onClick={() => onToggleEffect(effectKey)}
            aria-pressed={effectOn}
            className="flex w-full items-center gap-3 text-left"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                effectOn
                  ? 'border-mulberry bg-mulberry text-cream'
                  : 'border-ink/30 bg-white text-transparent'
              }`}
            >
              <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">{effectLabel}</span>
              <span className="block text-xs text-ink/55">{effectHint}</span>
            </span>
          </button>
          {isEnvelope ? (
            <p className="pl-8 text-[11px] text-ink/45">
              Your wax seal is always part of the envelope — guests swipe it to open.
            </p>
          ) : null}
        </div>
      )}

      {/* Commit */}
      <div>
        {isChosen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-700">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            This is your opening
          </span>
        ) : (
          <button
            type="button"
            onClick={() => saveChoice(previewing)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Make this mine'}
          </button>
        )}
      </div>
    </section>
  );
}
