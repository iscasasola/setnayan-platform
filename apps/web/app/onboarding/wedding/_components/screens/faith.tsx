/**
 * Screen 3 — Faith / tradition.
 *
 * ADAPTIVE based on Kind (screen 2):
 *   - Religious → single-select 1 faith (chips · 1 active state)
 *   - Mixed     → multi-select up to 2 faiths (CLAUDE.md 2026-06-01 lock:
 *                 "Mixed faith cap-2 · rolling cap drops the first on a 3rd")
 *   - Civil     → never rendered (shell goNext rule skips this screen entirely)
 *
 * V1.x active faiths: catholic + civil (civil never reaches here anyway).
 * INC / Christian / Muslim / Cultural ship as Coming Soon chips with a
 * notify-me path — captured in couple_wedding_type_notify_signups per
 * iteration 0043. The "soon" badge is a visual indicator only here;
 * picking a coming-soon faith is allowed in Phase 1 (the wired write goes
 * via Phase 4 to wedding_type_launch_status to fire the notify-me email).
 *
 * Maps to:
 *   - events.ceremony_type = faith[0] (when Religious; when Mixed, the first
 *     pick is the primary)
 *   - events.secondary_ceremony_type = faith[1] (only when Mixed and 2 picks)
 *   - Auto-pre-locks dietary chips on later screens per faith (Muslim →
 *     HALAL + alcohol-free locked · INC → alcohol-free locked).
 */

import type { OnboardingFaith, OnboardingKind } from '../../types';

interface Option {
  value: OnboardingFaith;
  label: string;
  soon: boolean; // V1.x not-yet-active
}

const OPTIONS: Option[] = [
  { value: 'catholic',  label: 'Catholic',  soon: false },
  { value: 'christian', label: 'Christian', soon: true  },
  { value: 'inc',       label: 'INC',       soon: true  },
  { value: 'muslim',    label: 'Muslim',    soon: true  },
  { value: 'cultural',  label: 'Cultural',  soon: true  },
];

interface Props {
  kind: OnboardingKind | null;
  value: OnboardingFaith[];
  onChange: (v: OnboardingFaith[]) => void;
}

export function ScreenFaith({ kind, value, onChange }: Props) {
  const isMixed = kind === 'mixed';
  const headline = isMixed ? 'Which traditions?' : 'Which tradition?';
  const sub = isMixed
    ? "Pick up to two — we'll honor both in your plan."
    : 'Pick the faith / tradition for your ceremony.';

  const toggle = (v: OnboardingFaith) => {
    if (isMixed) {
      // Multi-select with rolling cap of 2 — picking a 3rd drops the oldest
      if (value.includes(v)) {
        onChange(value.filter((x) => x !== v));
      } else {
        const next = [...value, v];
        if (next.length > 2) next.shift(); // drop oldest
        onChange(next);
      }
    } else {
      onChange([v]);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6 pt-6">
      {/* Viewzone */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
          {isMixed ? 'Interfaith ceremony' : 'Religious ceremony'}
        </p>
        <h2 className="font-serif text-2xl italic leading-tight text-ink sm:text-3xl">
          {headline}
        </h2>
        <p className="mt-1 text-sm text-ink/60">{sub}</p>
      </div>

      {/* Tapzone — chips spread to fill, dock toward the bottom */}
      <div className="mt-auto flex flex-wrap content-center justify-center gap-3 pb-8 pt-10">
        {OPTIONS.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={[
                'flex items-center gap-2 rounded-full border-2 px-5 py-3 text-sm transition',
                selected
                  ? 'border-[var(--m-mulberry,#5C2542)] bg-[var(--m-mulberry,#5C2542)] text-cream shadow-sm'
                  : 'border-ink/15 bg-cream text-ink hover:border-ink/30',
              ].join(' ')}
              aria-pressed={selected}
            >
              <span className={selected ? 'font-medium' : ''}>{opt.label}</span>
              {opt.soon ? (
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em]',
                    selected
                      ? 'bg-cream/15 text-cream'
                      : 'bg-[var(--m-orange,#C5A059)]/15 text-[var(--m-orange-2,#A88340)]',
                  ].join(' ')}
                >
                  Soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
