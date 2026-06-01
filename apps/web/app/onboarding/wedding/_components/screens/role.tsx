/**
 * Screen 1 — Role.
 *
 * "Who are you in this wedding?" — singular account model
 * (per CLAUDE.md 2026-06-01 "🧑 Onboarding Step 2 — singular account ·
 * 'Both of us' removed"). The partner joins as a separate co-host via the
 * V1.2 multi-host invite (iteration 0048), not a toggle here.
 *
 * Maps to: event_moderators.role_subtype written at Phase 4 commit.
 *   bride / groom / helper (parent · planner · entourage)
 */

import type { OnboardingRole } from '../../types';

const OPTIONS: { value: OnboardingRole; title: string; desc: string }[] = [
  { value: 'bride',  title: 'Bride',           desc: 'Walking down the aisle' },
  { value: 'groom',  title: 'Groom',           desc: 'Waiting at the altar' },
  { value: 'helper', title: 'Someone helping', desc: 'A parent, planner, or part of the entourage' },
];

interface Props {
  value: OnboardingRole | null;
  onChange: (v: OnboardingRole) => void;
}

export function ScreenRole({ value, onChange }: Props) {
  return (
    <div className="flex flex-1 flex-col px-6 pt-6">
      {/* Viewzone — question */}
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
          Who are you?
        </p>
        <h2 className="font-serif text-2xl italic leading-tight text-ink sm:text-3xl">
          Who are you in this wedding?
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          This account is just you — your partner can join as a co-host anytime.
        </p>
      </div>

      {/* Tapzone — option cards, grow to fill, dock toward the bottom */}
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
