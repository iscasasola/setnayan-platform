/**
 * Screen 2 — Kind of wedding.
 *
 * Religious / Civil / Mixed (interfaith). Picked here, then Screen 3 (Faith)
 * adapts: Religious = single-select faith; Mixed = multi-select up to 2;
 * Civil SKIPS the faith screen entirely (shell goNext rule).
 *
 * Maps to: events.ceremony_type at Phase 4 commit (civil → 'civil',
 * mixed → 'mixed' + secondary_ceremony_type written from faith[1], religious
 * → faith[0] as the ceremony_type). Per iteration 0043 wedding-type picker.
 */

import type { OnboardingKind } from '../../types';

const OPTIONS: { value: OnboardingKind; title: string; desc: string }[] = [
  { value: 'religious', title: 'Religious',     desc: 'A faith ceremony — church, mosque, INC chapel, or other tradition' },
  { value: 'civil',     title: 'Civil',         desc: 'A judge, registrar, or licensed officiant — no religious rite' },
  { value: 'mixed',     title: 'Mixed',         desc: 'Interfaith — honoring two traditions in one day' },
];

interface Props {
  value: OnboardingKind | null;
  onChange: (v: OnboardingKind) => void;
}

export function ScreenKind({ value, onChange }: Props) {
  return (
    <div className="flex flex-1 flex-col px-6 pt-6">
      {/* Viewzone */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
          What kind of wedding?
        </p>
        <h2 className="font-serif text-2xl italic leading-tight text-ink sm:text-3xl">
          The shape of your day.
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          We&apos;ll tailor the rest of the questions to match — different
          paperwork, different vendors, different rhythms.
        </p>
      </div>

      {/* Tapzone — option cards dock toward the bottom */}
      <div className="mt-auto flex flex-col justify-end gap-3 pb-8 pt-10">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                'group flex w-full flex-col gap-1 rounded-2xl border-2 px-5 py-4 text-left transition',
                selected
                  ? 'border-[var(--m-mulberry,#5C2542)] bg-[var(--m-mulberry,#5C2542)]/5 shadow-sm'
                  : 'border-ink/15 bg-cream hover:border-ink/30',
              ].join(' ')}
              aria-pressed={selected}
            >
              <span className={['font-serif text-lg', selected ? 'text-[var(--m-mulberry,#5C2542)]' : 'text-ink'].join(' ')}>
                {opt.title}
              </span>
              <span className="text-sm text-ink/60">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
