'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, X, Pencil, ArrowUp, Loader2 } from 'lucide-react';
import { bulkAddGuests } from '../actions';

type Guest = { firstName: string; lastName: string };

type Props = {
  eventId: string;
  /** Server-action helper bound to the eventId by the parent. */
};

// Quick-list guest entry.
//
// Flow: focus First Name → type → Enter → focus Last Name → type → Enter →
// row finalized + appended to list, focus jumps back to a fresh First Name.
// Pressing Enter on an empty First Name (when there's at least one finalized
// row) submits the bulk upload.
//
// Last name is optional: pressing Enter on an empty Last Name still finalizes
// the row using just the first name (some guests go by one name).
export function QuickAddList({ eventId }: Props) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const firstRef = useRef<HTMLInputElement | null>(null);
  const lastRef = useRef<HTMLInputElement | null>(null);
  const editRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Pressing Enter inside the editing input commits the change.
  function commitEdit(i: number, value: string) {
    setGuests((prev) => {
      const next = [...prev];
      const parts = value.trim().split(/\s+/);
      const f = parts[0] ?? '';
      const l = parts.slice(1).join(' ');
      next[i] = { firstName: f, lastName: l };
      return next;
    });
    setEditingIndex(null);
  }

  function removeAt(i: number) {
    setGuests((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Push the active first/last into the finalized list and clear inputs.
  // Optionally focus the next field after.
  function finalizeRow(opts: { focusBackToFirst?: boolean } = {}) {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f && !l) return false;
    setGuests((prev) => [...prev, { firstName: f, lastName: l }]);
    setFirstName('');
    setLastName('');
    if (opts.focusBackToFirst !== false) {
      // Use a microtask so React has flushed before we re-focus.
      queueMicrotask(() => firstRef.current?.focus());
    }
    return true;
  }

  function onFirstKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const f = firstName.trim();
    if (f.length === 0) {
      // Double-Enter on empty first name when we already have guests:
      // submit the bulk upload by clicking the form's submit button.
      if (guests.length > 0) {
        document.getElementById('quick-add-submit')?.click();
      }
      return;
    }
    lastRef.current?.focus();
  }

  function onLastKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    finalizeRow();
  }

  function onLastBlur() {
    // If the user clicks elsewhere with a name half-entered, treat it as
    // a finalize (less destructive than losing the row). But only if both
    // fields actually have content the user typed; otherwise stay quiet.
    // We deliberately don't auto-finalize on first-name blur because that
    // would make Tab-out lose the in-progress entry.
  }

  // Hidden field serialized as JSON for the server action to parse.
  const guestsJson = JSON.stringify(guests);
  const action = bulkAddGuests.bind(null, eventId);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Auto-finalize whatever's in the live row before submitting so
        // a name half-entered doesn't get silently dropped.
        if (firstName.trim() || lastName.trim()) {
          const f = firstName.trim();
          const l = lastName.trim();
          // We can't mutate state inside submit fast enough for the FormData
          // serialization, so we patch the hidden input directly.
          const hidden = (e.currentTarget.elements.namedItem(
            'guests',
          ) as HTMLInputElement) ?? null;
          if (hidden) {
            const patched = [...guests, { firstName: f, lastName: l }];
            hidden.value = JSON.stringify(patched);
          }
        }
      }}
      className="space-y-5"
    >
      <input type="hidden" name="guests" value={guestsJson} readOnly />

      {/* Finalized rows */}
      <ul className="space-y-2">
        {guests.map((g, i) => {
          const fullName = [g.firstName, g.lastName].filter(Boolean).join(' ').trim();
          const isEditing = editingIndex === i;
          return (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-success-300/60 bg-success-50/40 px-3 py-2 transition-colors"
            >
              <CheckCircle2
                aria-hidden
                className="h-4 w-4 shrink-0 text-success-700"
                strokeWidth={2}
              />
              {isEditing ? (
                <input
                  ref={(el) => {
                    editRefs.current[i] = el;
                  }}
                  defaultValue={fullName}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit(i, (e.target as HTMLInputElement).value);
                    } else if (e.key === 'Escape') {
                      setEditingIndex(null);
                    }
                  }}
                  onBlur={(e) => commitEdit(i, e.currentTarget.value)}
                  className="flex-1 rounded-md border border-success-300 bg-white px-2 py-1 text-sm font-medium text-ink focus:border-success-600 focus:outline-none focus:ring-2 focus:ring-success-200"
                  aria-label={`Edit guest ${i + 1}`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingIndex(i)}
                  className="flex-1 cursor-text text-left text-sm font-medium text-success-950 hover:text-success-700"
                  aria-label={`Edit ${fullName || 'guest ' + (i + 1)}`}
                >
                  {fullName || (
                    <span className="italic text-success-700/70">(no name)</span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingIndex((curr) => (curr === i ? null : i))}
                aria-label={`Toggle edit for guest ${i + 1}`}
                className="rounded p-1 text-success-800/60 hover:bg-success-100 hover:text-success-900"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove guest ${i + 1}`}
                className="rounded p-1 text-success-800/60 hover:bg-danger-100 hover:text-danger-700"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Live entry row */}
      <div className="rounded-xl border border-terracotta/40 bg-cream p-3 ring-1 ring-terracotta/10">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          New guest · row {guests.length + 1}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={firstRef}
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={onFirstKeyDown}
            placeholder="First name"
            aria-label="First name"
            autoComplete="off"
            className="input-field flex-1"
          />
          <input
            ref={lastRef}
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={onLastKeyDown}
            onBlur={onLastBlur}
            placeholder="Last name (optional)"
            aria-label="Last name"
            autoComplete="off"
            className="input-field flex-1"
          />
        </div>
        <p className="mt-2 text-xs text-ink/55">
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{' '}
          jumps first &rarr; last, then finalizes the row.{' '}
          {guests.length > 0 ? (
            <>
              Press{' '}
              <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{' '}
              twice on an empty first-name field to upload all{' '}
              <span className="font-medium text-ink">{guests.length}</span> guests.
            </>
          ) : (
            <>Add as many guests as you need, then click Upload below.</>
          )}
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
        <p className="text-sm text-ink/60">
          {guests.length === 0 ? (
            <>Nothing to upload yet.</>
          ) : (
            <>
              <span className="font-semibold text-ink">{guests.length}</span>{' '}
              guest{guests.length === 1 ? '' : 's'} ready &middot; they&rsquo;ll go into{' '}
              <span className="font-mono text-xs">Other (uncategorized)</span> with
              default side &amp; role &mdash; refine later from the guest list.
            </>
          )}
        </p>
        <UploadButton hasContent={guests.length > 0 || firstName.trim().length > 0} />
      </div>
    </form>
  );
}

function UploadButton({ hasContent }: { hasContent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      id="quick-add-submit"
      type="submit"
      disabled={pending || !hasContent}
      aria-busy={pending}
      className="button-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          Uploading…
        </>
      ) : (
        <>
          <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
          Upload to guest list
        </>
      )}
    </button>
  );
}
