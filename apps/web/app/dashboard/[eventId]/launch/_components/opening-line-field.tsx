'use client';

import { useState } from 'react';
import { OPENING_LINE_TEMPLATES } from '@/lib/print-pieces';

/**
 * The opening line — a few starting points, or their own words.
 *
 * The same pattern the E-Gifts page uses for its message
 * (`pabuya-message-editor.tsx`, owner 2026-09-15: *"pick among 5 or create your
 * own"*): 🔑 A TEMPLATE FILLS THE BOX; IT DOES NOT BECOME THE ANSWER. Picking
 * one writes its words into the field, where they can be edited, and what the
 * form posts is always the text.
 */
export function OpeningLineField({ initial }: { initial: string | null }) {
  const [text, setText] = useState(initial ?? '');
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink/80">Opening line</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Opening line templates">
        {OPENING_LINE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setText(t.body)}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta hover:text-terracotta-700"
          >
            {t.name}
          </button>
        ))}
      </div>
      <input
        name="opening_line"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 240))}
        maxLength={240}
        aria-label="Opening line"
        placeholder="Pick one above, or write your own…"
        className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
      />
      <p className="text-xs text-ink/50">Pick one to fill the box, then change anything — what you save is your text.</p>
    </div>
  );
}
