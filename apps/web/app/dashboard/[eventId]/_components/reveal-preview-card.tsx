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
  type RevealTemplate,
} from '@/app/[slug]/_components/reveal/reveal-templates';

type Props = {
  /** The event whose chosen opening this persists. */
  eventId: string;
  /** The opening currently shown in the shared preview (owned by the parent). */
  previewing: RevealTemplate;
  /** Show a different opening in the shared preview. */
  onPreview: (t: RevealTemplate) => void;
  /** The couple's currently-saved opening (events.std_reveal_template). */
  chosenTemplate?: RevealTemplate | null;
};

export function RevealPreviewCard({
  eventId,
  previewing,
  onPreview,
  chosenTemplate = null,
}: Props) {
  const [chosen, setChosen] = useState<RevealTemplate | null>(chosenTemplate);
  const [pending, startTransition] = useTransition();

  const saveChoice = (t: RevealTemplate) =>
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
        {REVEAL_LIBRARY.map((t) => {
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
          line is how the couple tells the five openings apart. */}
      {previewedItem ? (
        <p className="text-sm text-ink/70">
          <span className="font-medium text-ink">{previewedItem.label}</span>
          {' — '}
          {previewedItem.blurb}
        </p>
      ) : null}

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
