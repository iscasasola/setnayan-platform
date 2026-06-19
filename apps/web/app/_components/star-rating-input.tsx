'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

type Props = {
  name: string;
  label: string;
  defaultValue?: number;
  required?: boolean;
};

/**
 * Accessible 5-star input used by the couple-side review form. Renders as a
 * row of 5 buttons; each click sets a hidden input the parent `<form>` posts
 * to the server action. Keyboard users get standard tab-stop behavior — the
 * stars are real buttons, not just icons.
 */
export function StarRatingInput({ name, label, defaultValue = 0, required = false }: Props) {
  const [value, setValue] = useState<number>(defaultValue);
  const [hover, setHover] = useState<number>(0);
  const active = hover > 0 ? hover : value;

  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-ink/80" htmlFor={`${name}_input`}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= active;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setValue(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              aria-pressed={value === n}
              className="inline-flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
            >
              <Star
                aria-hidden
                className={`h-6 w-6 ${
                  filled ? 'fill-warn-400 text-warn-400' : 'text-ink/25'
                }`}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <input
        id={`${name}_input`}
        type="hidden"
        name={name}
        value={value || ''}
        required={required}
      />
    </div>
  );
}
