'use client';

/**
 * self-celebrant-lock.tsx — "For · You" fills the celebrant with YOUR name, and locks it.
 *
 * Owner, 2026-11-08, verbatim: *"I log in as Ice Casasola's account, and then I go to create event
 * for me. So the celebrant will also autofill for me the name that I assign to myself. And if it's for
 * me, it cannot be edited out because it's a celebration for me, unless they pick someone else, which
 * will give them the power to create a name or connect it to a person."*
 *
 * So the celebrant field is DRAWN (the person sees their own name where the name goes), READ-ONLY, and
 * carries one quiet line: "This event is for you · Change who it's for". The way out is the shipped
 * "For ▾" control — the only place that can name someone else or link a person on file — never an
 * unlocked box here. ONE part for every create path (the grid's inline form and every
 * `/onboarding/[type]` wizard), so the words and the lock cannot drift apart.
 *
 * ⚠ THE FIELD POSTS NOTHING. It has no `name`: a blank honoree is the account holder's own slot
 * (lib/onboarding/honoree-handoff — "stamping their name would open a second one"), so the server
 * still receives exactly what it did before. The lock is a display of a fact, not a new value.
 */
import Link from 'next/link';

export const SELF_CELEBRANT_LINE = 'This event is for you';
export const SELF_CELEBRANT_CHANGE = 'Change who it’s for';

export function SelfCelebrantLock({
  name,
  label,
  inputClassName,
  changeHref,
  onChange,
  note,
}: {
  /** The account's own display name; '' / null draws "You", never an email local-part. */
  name: string | null | undefined;
  /** The field's visible label, when the surface labels its fields. */
  label?: string;
  inputClassName: string;
  /** Leave for the For ▾ row on another page (the onboarding wizards). */
  changeHref?: string;
  /** Or open the For ▾ row on THIS page (the grid's inline form). */
  onChange?: () => void;
  /** One more quiet line under the field (e.g. "Turning 40"). */
  note?: string | null;
}) {
  const shown = name?.trim() || 'You';
  return (
    <div data-self-celebrant-lock>
      {label ? (
        <label className="block text-sm font-medium text-ink" htmlFor="self_celebrant">
          {label}
        </label>
      ) : null}
      <input
        // field-ok: a read-only echo of the HOST surface's own celebrant box (the wizard's large field, the grid
        // form's input-field) — it must look like the field it stands in for, and it is never typed in.
        id="self_celebrant"
        aria-label={label ? undefined : 'Celebrant'}
        aria-readonly="true"
        readOnly
        autoComplete="off"
        className={`${inputClassName} cursor-default bg-ink/[0.03] text-ink/75`}
        data-self-celebrant
        type="text"
        value={shown}
      />
      {note ? <p className="mt-1.5 text-xs text-ink/50">{note}</p> : null}
      <p className="mt-2 text-xs text-ink/55" data-self-celebrant-line>
        {SELF_CELEBRANT_LINE} ·{' '}
        {changeHref ? (
          <Link className="font-medium text-ink/70 underline underline-offset-2 hover:text-ink" href={changeHref}>
            {SELF_CELEBRANT_CHANGE}
          </Link>
        ) : (
          <button
            className="font-medium text-ink/70 underline underline-offset-2 hover:text-ink"
            onClick={onChange}
            type="button"
          >
            {SELF_CELEBRANT_CHANGE}
          </button>
        )}
      </p>
    </div>
  );
}
