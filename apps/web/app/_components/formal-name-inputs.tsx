import type { ChangeEvent, FormEvent } from 'react';
import {
  FORMAL_NAME_FIELDS,
  FORMAL_NAME_LABELS,
  FORMAL_NAME_PART_MAX,
  prefixChoicesFor,
  type FormalNameField,
} from '@/lib/formal-name';

/**
 * THE FIVE NAME BOXES, GUEST SIDE — Prefix · First · Middle · Last · Suffix.
 *
 * Owner, verbatim, 2026-09-30: *"The name will be same: Prefix · First · Middle
 * · Last · Suffix, to stay consistent"* — the same five parts the profile
 * (`dashboard/(account)/profile`) and the Guest list (`guest-name-fields.tsx`)
 * store, in the same printed order (`FORMAL_NAME_FIELDS`), with the same labels
 * (`FORMAL_NAME_LABELS`) and cap (`FORMAL_NAME_PART_MAX`). Every place a GUEST
 * types a person's name draws THIS — the RSVP's plus-one seats (and Me's "Add
 * name" in place, which reuses them), the plus-one's own door, and the
 * ask-to-join request. `guest-side-names-use-five-parts.test.ts` holds that.
 *
 *   · PREFIX IS ONE DROPDOWN (a set of choices is a dropdown) — the list in
 *     `NAME_PREFIX_CHOICES`; a stored prefix outside it stays selectable.
 *   · FIRST + LAST are the required pair when `required`; Middle, Suffix and
 *     Prefix never are. A plus-one's boxes pass `required={false}` — a blank
 *     seat is "+1 TBA", allowed.
 *   · PHONE FIRST (390): two columns — Prefix | First, Middle | Last, Suffix —
 *     so all five fit with no sideways scroll; one row of five from `sm`.
 *
 * No hooks and no `'use client'`: it renders inside the server-drawn request
 * form and plus-one door as plain HTML that posts without script, and inside the
 * client plus-one panels as-is. Field NAMES are `${nameStart}${part}${nameEnd}`
 * (`plus_one_` + `first_name` + `_2`) — the server readers key on those; ids
 * carry `idPrefix` only, so two sets on one page never share a label target.
 */
export function FormalNameInputs({
  defaults = {},
  required = false,
  forSelf = false,
  nameStart = '',
  nameEnd = '',
  idPrefix = '',
  onInput,
}: {
  /** What the boxes open on — the stored parts. */
  defaults?: Partial<Record<FormalNameField, string | null | undefined>>;
  /** First + Last must be filled before the form sends. */
  required?: boolean;
  /** The person typing is the person named — lets the phone autofill offer theirs. */
  forSelf?: boolean;
  nameStart?: string;
  nameEnd?: string;
  idPrefix?: string;
  /** Fires on First / Last — the plus-one switcher's live "Ben Reyes ✓". */
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
}) {
  const nameOf = (f: FormalNameField) => `${nameStart}${f}${nameEnd}`;
  const idOf = (f: FormalNameField) => `${idPrefix}${nameOf(f)}`;
  const auto = (f: FormalNameField): string => {
    if (!forSelf) return 'off';
    return {
      name_prefix: 'honorific-prefix',
      first_name: 'given-name',
      middle_name: 'additional-name',
      last_name: 'family-name',
      name_suffix: 'honorific-suffix',
    }[f];
  };
  const mustFill = (f: FormalNameField) => required && (f === 'first_name' || f === 'last_name');

  return (
    <div
      data-formal-name-inputs=""
      className="grid grid-cols-2 gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem]"
    >
      {FORMAL_NAME_FIELDS.map((f) => (
        <div key={f} className="min-w-0 space-y-1.5">
          <label htmlFor={idOf(f)} className="block text-sm font-medium text-ink">
            {FORMAL_NAME_LABELS[f]}
            {mustFill(f) ? <span aria-hidden> *</span> : null}
          </label>
          {f === 'name_prefix' ? (
            <PrefixSelect id={idOf(f)} name={nameOf(f)} defaultValue={defaults[f]} autoComplete={auto(f)} />
          ) : (
            <input
              id={idOf(f)}
              name={nameOf(f)}
              type="text"
              required={mustFill(f) || undefined}
              maxLength={FORMAL_NAME_PART_MAX}
              defaultValue={defaults[f] ?? ''}
              autoComplete={auto(f)}
              autoCapitalize="words"
              placeholder={f === 'name_suffix' ? 'Jr., II…' : undefined}
              onInput={f === 'first_name' || f === 'last_name' ? onInput : undefined}
              className="input-field w-full"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 🪪 THE PREFIX DROPDOWN — one, everywhere a name's Prefix is typed (owner
 * 2026-09-30: the Guest list and the profile use "the same dropdown as the
 * guest side"). The short list is `NAME_PREFIX_CHOICES`; a stored prefix
 * outside it (the host typed "Justice") stays as its own option, never dropped
 * (`prefixChoicesFor`). "—" is no prefix.
 *
 * No hooks: uncontrolled with `defaultValue` (server-drawn forms, the guest
 * card's autosave), or controlled with `value` + `onChange` (the Add-guest
 * form, whose whole-name splitter fills it).
 */
export function PrefixSelect({
  id,
  name = 'name_prefix',
  defaultValue,
  value,
  onChange,
  autoComplete = 'off',
  className = 'input-field w-full appearance-none bg-cream pr-8',
}: {
  id: string;
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  autoComplete?: string;
  className?: string;
}) {
  const current = value ?? defaultValue;
  return (
    <select
      id={id}
      name={name}
      {...(value !== undefined ? { value: value.trim(), onChange } : { defaultValue: (defaultValue ?? '').trim(), onChange })}
      autoComplete={autoComplete}
      data-prefix-select=""
      className={className}
    >
      <option value="">—</option>
      {prefixChoicesFor(current).map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
