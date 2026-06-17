'use client';

import { useState } from 'react';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

/**
 * Binary Yes/No input for the on_time review axis.
 *
 * "Did they arrive and deliver on schedule?" maps to:
 *   Yes → 5  (full marks — they were on time)
 *   No  → 1  (lowest — they were not on time)
 *
 * Only two states exist for this question; a 5-star gradient makes no
 * sense for a binary on-time question. The hidden input posts the integer
 * value so the server action's parseRating() accepts it without changes.
 */
export function OnTimeBinaryInput({ name, label, required = false }: Props) {
  const [value, setValue] = useState<5 | 1 | null>(null);

  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setValue(5)}
          aria-pressed={value === 5}
          className={`min-w-[64px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
            value === 5
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
              : 'border-ink/20 bg-transparent text-ink/70 hover:border-ink/40 hover:bg-ink/5'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setValue(1)}
          aria-pressed={value === 1}
          className={`min-w-[64px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
            value === 1
              ? 'border-rose-500 bg-rose-50 text-rose-700'
              : 'border-ink/20 bg-transparent text-ink/70 hover:border-ink/40 hover:bg-ink/5'
          }`}
        >
          No
        </button>
      </div>
      <input
        type="hidden"
        name={name}
        value={value ?? ''}
        required={required}
      />
    </div>
  );
}
