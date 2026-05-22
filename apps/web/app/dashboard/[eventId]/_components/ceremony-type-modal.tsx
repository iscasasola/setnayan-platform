'use client';

/**
 * Task #37 (2026-05-22) — Wedding-type setter modal.
 *
 * Opened from CeremonyTypeChip when no value is locked and no vendor
 * has confirmed. One-time set; on success the parent revalidates and
 * the chip flips to the read-only locked state.
 *
 * Brand-voice rules per [[feedback_setnayan_no_dev_text_post_launch]]:
 * editorial, no exclamation marks, no marketing jargon. Mobile-first
 * bottom-sheet treatment, desktop center-modal.
 */

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import {
  CeremonyTypeRadioGroup,
  type CeremonyTypeKey,
} from '@/app/_components/ceremony-type-radio-group';
import { setEventCeremonyType } from '../actions';

type Props = {
  eventId: string;
  onClose: () => void;
};

export function CeremonyTypeModal({ eventId, onClose }: Props) {
  const [selected, setSelected] = useState<CeremonyTypeKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!selected) return;
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('ceremony_type', selected);
    setError(null);
    startTransition(async () => {
      const result = await setEventCeremonyType(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ceremony-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-cream shadow-xl ring-1 ring-ink/10 sm:rounded-xl">
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 p-6">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              Setnayan · Wedding basics
            </p>
            <h2 id="ceremony-modal-title" className="text-lg font-semibold text-ink">
              Set wedding type
            </h2>
            <p className="text-sm text-ink/65">
              Choose carefully — this affects vendor matching, custom traditions, and
              your ceremony schedule. It can&rsquo;t be changed once you save.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            aria-label="Close"
            disabled={pending}
            className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-40"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <CeremonyTypeRadioGroup
            value={selected}
            onChange={setSelected}
            legend="Wedding type"
          />
        </div>

        {error ? (
          <div className="mx-6 mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-200">
            {error}
          </div>
        ) : null}

        <footer className="flex flex-col-reverse gap-2 border-t border-ink/10 p-4 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !selected}
            className="inline-flex items-center justify-center rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save wedding type'}
          </button>
        </footer>
      </div>
    </div>
  );
}
