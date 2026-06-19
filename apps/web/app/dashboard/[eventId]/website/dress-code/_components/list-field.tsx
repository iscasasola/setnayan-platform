'use client';

/**
 * Dynamic list-field editor for the dress-code editor (dos / donts).
 *
 * Hosts add up to 8 rows of "do this" / "skip this" hints; this client
 * component handles add + remove client-side so each row can be added /
 * removed without a server round-trip. The form picks them up via
 * repeated input fields (all named the same — `dos` or `donts`).
 *
 * Reusable across dos + donts because the only differences are the field
 * name + the placeholder + the accent color.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

type Tone = 'do' | 'dont';

const TONE_STYLES: Record<Tone, { accent: string; ring: string; placeholder: string }> = {
  do: {
    accent: 'text-success-700',
    ring: 'focus-visible:outline-success-500',
    placeholder: 'e.g. Lean into the palette · Long gowns + ternos · A little sparkle',
  },
  dont: {
    accent: 'text-danger-700',
    ring: 'focus-visible:outline-danger-500',
    placeholder: 'e.g. No white or ivory (reserved for the bride) · Skip jeans',
  },
};

const ITEM_MAX = 80;
const LIST_MAX = 8;

export function ListField({
  name,
  tone,
  initial,
}: {
  name: 'dos' | 'donts';
  tone: Tone;
  initial: string[];
}) {
  // Seed with at least one editable row so a brand-new event has somewhere
  // to type into. Existing config rows render as-is.
  const [rows, setRows] = useState<string[]>(initial.length > 0 ? initial : ['']);
  const style = TONE_STYLES[tone];

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="text"
              name={name}
              defaultValue={row}
              maxLength={ITEM_MAX}
              placeholder={style.placeholder}
              className={`flex-1 min-h-[44pt] rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${style.ring}`}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove row ${i + 1}`}
                className="inline-flex h-11 w-11 min-h-[44pt] items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length < LIST_MAX ? (
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, ''])}
          className={`inline-flex h-11 min-h-[44pt] items-center gap-2 rounded-md border border-dashed border-ink/25 bg-cream px-4 text-sm font-medium ${style.accent} transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span>Add another</span>
        </button>
      ) : (
        <p className="text-xs italic text-ink/55">
          That&rsquo;s the cap — {LIST_MAX} keeps the list scannable for guests.
        </p>
      )}
    </div>
  );
}
