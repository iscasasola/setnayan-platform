'use client';

/**
 * "Overall Theme" — the card at the top of the redesigned Mood Board canvas
 * (2026-09-02): an editable name + description for the couple's wedding look,
 * with a "Suggest for me" button that fills in a starter derived from the
 * couple's own saved palette + reception design (lib/theme-suggest.ts — pure,
 * no AI call). Accepting/overwriting the suggestion is the couple's choice;
 * nothing is saved until they edit (debounced) or the values change.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import type { RolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';
import { suggestMoodboardTheme } from '@/lib/theme-suggest';

type Props = {
  eventId: string;
  initialName: string | null;
  initialDescription: string | null;
  palette: RolePalette;
  receptionDesign: ReceptionDesign;
  saveAction: (eventId: string, theme: { name: string; description: string }) => Promise<void>;
};

const SAVE_DEBOUNCE_MS = 900;

export function ThemeCard({
  eventId,
  initialName,
  initialDescription,
  palette,
  receptionDesign,
  saveAction,
}: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(nextName: string, nextDescription: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus('saving');
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveAction(eventId, { name: nextName, description: nextDescription });
          setStatus('saved');
          setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
        } catch {
          setStatus('error');
        }
      });
    }, SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function onNameChange(v: string) {
    setName(v);
    scheduleSave(v, description);
  }
  function onDescriptionChange(v: string) {
    setDescription(v);
    scheduleSave(name, v);
  }

  function onSuggest() {
    const suggestion = suggestMoodboardTheme(palette, receptionDesign);
    if (!suggestion) return;
    setName(suggestion.name);
    setDescription(suggestion.description);
    scheduleSave(suggestion.name, suggestion.description);
  }

  return (
    <section id="theme" className="sn-tile scroll-mt-24 space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Overall theme
        </p>
        <button
          type="button"
          onClick={onSuggest}
          className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 px-3 py-1 text-xs font-medium text-terracotta-700 transition hover:bg-terracotta/10"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Suggest for me
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name your theme — e.g. “Blush &amp; Gold Garden Reception”"
        maxLength={80}
        className="w-full border-0 bg-transparent p-0 text-2xl font-semibold text-ink placeholder:text-ink/30 focus:outline-none sm:text-3xl"
      />
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Describe the feel in a sentence or two — the colors, the mood, what makes it yours."
        maxLength={280}
        rows={2}
        className="w-full resize-none border-0 bg-transparent p-0 text-sm text-ink/70 placeholder:text-ink/30 focus:outline-none"
      />

      <p aria-live="polite" className="h-4 text-xs text-ink/45">
        {status === 'saving'
          ? 'Saving…'
          : status === 'saved'
            ? 'Saved'
            : status === 'error'
              ? 'Could not save — try again.'
              : ''}
      </p>
    </section>
  );
}
