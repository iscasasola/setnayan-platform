'use client';

import { useFormStatus } from 'react-dom';

/**
 * TextPanel — the inline edit panel for the editor's text settings
 * (Unified Website Editor · PR-3).
 *
 * A plain `<form action={serverAction}>` posting to the SAME server action the
 * feature's own sub-page uses — never a second write path. The only addition is
 * the hidden `return_to`, which sends the couple back to the editor (with the
 * row re-opened) instead of the sub-page: see `lib/editor-return.ts`, where the
 * field is opt-in and default-identical for the existing sub-page forms.
 *
 * Form-only, no client state: it works on the slowest 4G in PH, matching the
 * no-JS posture of the widgets editor.
 */
export function TextPanel({
  action,
  eventId,
  rowKey,
  name,
  label,
  hint,
  defaultValue,
  maxLength,
  rows = 4,
  placeholder,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  rowKey: string;
  /** The form field the target action reads (e.g. `note`, `message`). */
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <form action={action} className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=${rowKey}`}
      />
      <label
        htmlFor={`panel-${rowKey}`}
        className="mb-1 block text-[0.7rem] font-semibold text-ink/60"
      >
        {label}
      </label>
      <textarea
        id={`panel-${rowKey}`}
        name={name}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
      />
      {hint ? <p className="mt-1 text-[0.7rem] text-ink/45">{hint}</p> : null}
      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}
