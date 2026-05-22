'use client';

/**
 * Task #37 (2026-05-22) — Wedding-type setter modal.
 * Task #43 (2026-05-22 evening) — accepts currentValue for edit mode,
 * pre-populates the radio selection, swaps Save button copy to "Update".
 * Task #44 (2026-05-22) — uses the shared CeremonyTypeRadioGroup so the
 * 7 options + descriptions stay aligned with the create-event picker.
 *
 * Opened from CeremonyTypeChip:
 *   - first-time set (no current value): empty radio group, Save labeled
 *     "Save wedding type".
 *   - edit (current value passed in): radio pre-selected, Save labeled
 *     "Update wedding type". Server rejects when ≥1 vendor confirmed.
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
  currentValue?: string | null;
  onClose: () => void;
};

const ALLOWED_KEYS: CeremonyTypeKey[] = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
];

function normaliseInitial(value: string | null | undefined): CeremonyTypeKey | null {
  if (!value) return null;
  return ALLOWED_KEYS.includes(value as CeremonyTypeKey) ? (value as CeremonyTypeKey) : null;
}

export function CeremonyTypeModal({ eventId, currentValue, onClose }: Props) {
  const initial = normaliseInitial(currentValue);
  const isEditing = initial !== null;
  const [selected, setSelected] = useState<CeremonyTypeKey | null>(initial);
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
              {isEditing ? 'Update wedding type' : 'Set wedding type'}
            </h2>
            <p className="text-sm text-ink/65">
              {isEditing
                ? 'You can change this until your first vendor confirms. Once any vendor commits, the wedding type locks and only support can adjust it.'
                : 'This affects vendor matching, custom traditions, and your ceremony schedule. You can update it until your first vendor confirms.'}
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
            disabled={pending || !selected || (isEditing && selected === initial)}
            className="inline-flex items-center justify-center rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-700 disabled:opacity-50"
          >
            {pending
              ? isEditing
                ? 'Updating…'
                : 'Saving…'
              : isEditing
                ? 'Update wedding type'
                : 'Save wedding type'}
          </button>
        </footer>
      </div>
    </div>
  );
}
