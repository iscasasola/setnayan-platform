'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { nextAutoPage, type AutoSuggestion } from '@/lib/mood-board-studio';
import { StudioSheet } from './colour-picker-sheet';

/**
 * ✨ AUTO PALETTE (owner 2026-10-06: *"we can add a button beside save where we
 * auto generate the palettes? but we can always change them manually"*).
 *
 * Suggestions made from the couple's own photos (the best match, first) and the
 * shipped themes' own five colours — never a colour nobody chose. One tap fills
 * the five main colours (`withAutoPalette`), and every part that follows them
 * follows; a colour set by hand stays theirs. ✨ Make more shows the next
 * themes. Prototype `openAuto`. Opening it writes nothing.
 */
export function AutoPaletteSheet({
  suggestions,
  onUse,
  onClose,
}: {
  suggestions: readonly AutoSuggestion[];
  onUse: (s: AutoSuggestion) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const shown = nextAutoPage(suggestions, page);
  return (
    <StudioSheet label="✨ Auto palette" onClose={onClose}>
      <div className="flex flex-col gap-1 px-2 pb-2" data-auto-palette="">
        {shown.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onUse(s)}
            className="sn-press flex min-h-11 w-full flex-col gap-2 rounded-2xl px-2 py-2 text-left hover:bg-ink/5"
            data-auto-suggestion={s.name}
          >
            <span className="flex items-baseline justify-between gap-2">
              <b className="text-[14.5px] font-semibold text-ink">{s.name}</b>
              {s.best ? <small className="text-[11px] font-bold text-success-700">best match</small> : null}
            </span>
            <span className="flex gap-1.5" aria-hidden>
              {s.five.map((c, i) => (
                <i key={i} className="h-8 flex-1 rounded-md ring-1 ring-inset ring-ink/10" style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}
        {/* "Show more" (the Progress kind): the next themes, only when asked. */}
        <span data-auto-more="" className="mt-1 [&_.ab]:w-full">
          <ActionButton tone="neutral" icon={Sparkles} label="Make more" onClick={() => setPage((p) => p + 1)} />
        </span>
      </div>
    </StudioSheet>
  );
}
