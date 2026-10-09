'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Explain } from '@/app/_components/explain';
import { SubmitButton } from '@/app/_components/submit-button';
import { Chips } from '@/app/_components/chips';
import { Fold } from '@/app/_components/fold';
import { FactRow, FORM_PICK_CLASS, FormRow, FormRows, SwitchRow, TypedRow, usePillWidth } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { INVITED_TO_BLOCKS, INVITED_TO_LABELS, defaultInvitedToForRole, type GuestRole, type InvitedToBlock } from '@/lib/guests';
import type {
  CardBoxProps,
  CardFieldProps,
  CardFoldProps,
  CardInvitedToProps,
  CardLockedProps,
  CardPickProps,
  CardSubmitProps,
  CardTipProps,
  CardToggleProps,
} from './guest-card-kit';
import { useAutosaveOutcome } from './guest-card-autosave';
import { isPlainSentence } from './plain-refusal';

/**
 * guest-card-rows.tsx — THE GUEST CARD'S LEAF CONTROLS, DRAWN BY THE APP'S TEMPLATES (step 4B, 2026-10-09).
 *
 * The card (`guest-card-body.tsx`) is ONE list of fields; this is the kit the Guests pages hand it so each leaf is a Form row —
 * `TypedRow` (a typed fact), `SwitchRow` (on / off), a `FormRow` around the house dropdown (a pick), `Chips` (several of a few), a
 * `Fold`, a `FactRow` (a fact it cannot change) — one hairline list per fold, the pills of a list one width. NOT imported by
 * `GuestCardBody` or anything it reaches (the Maker draws the card in its first load, where none of these templates are): the
 * pages import `guest-card-template-kit.ts`. Held by `the-guest-card-adds-no-first-load-weight.test.ts`.
 *
 * 🔑 THE CARD IS LIVE. Its autosave posts the WHOLE FORM to `updateGuest` (quiet=1), so every control here keeps the NAME it had and
 * posts the VALUE it posted — `the-card-posts-the-same-form.test.ts` renders both kits over twelve states and holds the FormData
 * equal. A template row keeps its answer in React state and posts nothing by itself, so each one is given a `fieldName`
 * (`form-row.tsx`, `chips.tsx`) or, for the dropdowns, the hidden input `FormPick` always used (`data-form-pick`, controlled by
 * state, `sn-restore` for the Undo). The form hears a change ONCE, from the tap or the keep — typing in an open field is not the
 * answer yet — so the autosave fires no more often than before.
 */

const KEEP = () => ({ ok: true as const });
const NUMBERS_ONLY = (text: string) => (/^-?\d*$/.test(text) ? null : 'Numbers only.');

/** A typed fact. Saved by the card's autosave, so `onKeep` has nothing to do — keeping tells the form (`fieldName`). */
export function CardField({ id, label, required = false, type = 'text', defaultValue, placeholder, long = false, about }: CardFieldProps) {
  return (
    <TypedRow
      name={label}
      fieldName={id}
      value={defaultValue}
      onKeep={KEEP}
      required={required}
      long={long}
      placeholder={placeholder}
      empty={placeholder ?? 'Add'}
      /* A stored answer longer than the box allows is never cut by opening the row. */
      maxLength={long ? Math.max(2000, defaultValue.length) : Math.max(240, defaultValue.length)}
      inputMode={type === 'tel' ? 'tel' : type === 'number' ? 'numeric' : undefined}
      check={type === 'number' ? NUMBERS_ONLY : null}
      about={about ? { words: about } : null}
      data={`card-${id}`}
      attrs={{ 'data-card-field': id }}
    />
  );
}

/** On / off. The switch keeps its state here; the checkbox under it (`fieldName`) is what the form reads. */
export function CardToggle({ name, defaultChecked, label, note }: CardToggleProps) {
  const [on, setOn] = useState(defaultChecked);
  // A fresh value from the server (a save landed, the row was edited elsewhere) moves the switch — and tells the form nothing.
  useEffect(() => setOn(defaultChecked), [defaultChecked]);
  return <SwitchRow name={label} about={{ words: note }} on={on} onChange={setOn} fieldName={name} data={`card-${name}`} attrs={{ 'data-card-field': name }} />;
}

/** One row of the card: closed with a one-line summary, open its fields as ONE list of rows. */
export function CardFold({ summary, value, emptyValue, open = false, children }: CardFoldProps) {
  return (
    <Fold title={summary} summary={value ?? emptyValue ?? '—'} defaultOpen={open} data={`card-${summary.toLowerCase().replace(/\W+/g, '-')}`}>
      <FormRows data={`card-${summary.toLowerCase().replace(/\W+/g, '-')}`}>{children}</FormRows>
    </Fold>
  );
}

/**
 * A choice (one, or several with ticks): the house dropdown in a Form row, with the ONE hidden input `FormPick` always carried —
 * CONTROLLED by state (never `defaultValue`: on a hidden input React re-applies the default on every render and would post the
 * server's old answer — owner's live iPhone test 2026-10-02), `data-form-pick` so the Undo finds it, `sn-restore` so the Undo
 * reaches the screen, and `input` + `change` raised on a pick because a hidden input raises neither by itself.
 */
export function CardPick({ name, label, value, options, multi = false, emptyText = 'None', about }: CardPickProps) {
  const [current, setCurrent] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const width = usePillWidth();
  useEffect(() => {
    setCurrent(value);
    if (ref.current) ref.current.value = value;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reread = () => setCurrent(el.value);
    el.addEventListener('sn-restore', reread);
    return () => el.removeEventListener('sn-restore', reread);
  }, []);
  const picked = multi ? current.split(',').filter(Boolean) : undefined;
  const pick = (key: string) => {
    let next = key;
    if (multi) {
      const set = new Set(picked);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      // In the list's own order, so the posted value does not depend on tap order.
      next = options.map((o) => o.key).filter((k) => set.has(k)).join(',');
    }
    if (next === current) return;
    setCurrent(next);
    const el = ref.current;
    if (!el) return;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const multiText = picked
    ? options
        .filter((o) => picked.includes(o.key))
        .map((o) => o.label)
        .join(', ') || emptyText
    : undefined;
  return (
    <FormRow name={label} about={about ? { words: about } : null} data={`card-${name}`} attrs={{ 'data-card-field': name }}>
      <PickMenu label={label} value={multi ? null : current} options={options} onPick={pick} picked={picked} buttonText={multiText} className={`${FORM_PICK_CLASS} ${width}`} />
      <input ref={ref} type="hidden" id={name} name={name} value={current} data-form-pick="" />
    </FormRow>
  );
}

/** "Invited to": the parts of the day as chips, snapping to the role's usual set when the Role changes (as it always did). */
export function CardInvitedTo({ roleSelectId, initialRole, initialBlocks }: CardInvitedToProps) {
  const [blocks, setBlocks] = useState<InvitedToBlock[]>(() => (initialBlocks as InvitedToBlock[] | undefined) ?? defaultInvitedToForRole(initialRole as GuestRole));
  // A fresh set from the server (a save landed, the row was edited elsewhere) moves the chips — and tells the form nothing.
  const fromServer = (initialBlocks ?? []).join(',');
  useEffect(() => {
    if (initialBlocks) setBlocks(initialBlocks as InvitedToBlock[]);
    // `initialBlocks` is read through `fromServer`, its stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromServer]);
  useEffect(() => {
    const role = document.getElementById(roleSelectId) as HTMLInputElement | null;
    if (!role) return;
    const snap = () => setBlocks(defaultInvitedToForRole(role.value as GuestRole));
    role.addEventListener('change', snap);
    return () => role.removeEventListener('change', snap);
  }, [roleSelectId]);
  return (
    <FormRow
      name="Invited to"
      data="card-invited-to"
      attrs={{ 'data-card-field': 'invited_to' }}
      below={
        <div className="pb-3 pt-0.5">
          <Chips<InvitedToBlock>
            label="Invited to"
            data="invited-to"
            options={INVITED_TO_BLOCKS.map((b) => ({ key: b, label: INVITED_TO_LABELS[b] }))}
            value={blocks}
            onToggle={(block, next) => setBlocks((prev) => (next ? (prev.includes(block) ? prev : [...prev, block]) : prev.filter((b) => b !== block)))}
            fieldName={(block) => `invited_${block}`}
          />
        </div>
      }
    />
  );
}

/** A fact the host cannot change here — said once, with where it is decided; nothing to tap. */
export function CardLocked({ label, value, note }: CardLockedProps) {
  return <FactRow name={label} value={value} where={note} data="card-locked" attrs={{ 'data-card-field': 'role' }} />;
}

/** The top list of the card (the name and the mobile): ONE list of the app's Form rows. */
export function CardList({ children }: CardBoxProps) {
  return <FormRows data="card-name">{children}</FormRows>;
}

/** Fields that sat side by side are rows of the same list. */
export function CardCols({ children }: CardBoxProps): ReactNode {
  return <>{children}</>;
}

/** A submit button of one of the card's own small forms: the ONE button (`ActionButton`'s class on the form-status `SubmitButton`). */
export function CardSubmit({ main = false, pendingLabel, ariaLabel, children }: CardSubmitProps) {
  return (
    <SubmitButton className={actionButtonClass(main ? 'brand' : 'neutral', { main, extra: 'w-full min-h-11' })} aria-label={ariaLabel} pendingLabel={pendingLabel}>
      {children}
    </SubmitButton>
  );
}

/** A heading with its explanation behind the approved ⓘ (a centred "Got it" pop-up on a phone). */
export function CardTip({ label, children }: CardTipProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Explain title={label}>{children}</Explain>
    </span>
  );
}

/**
 * The save line, drawn for the templated card: "Saving…" while a save is in flight, "Saved" for a moment once it LANDED, and
 * "Couldn’t save." with a real button — Try again — when it did not (kept until the next save lands). The facts are the
 * autosave's own (`useAutosaveOutcome`); a failed save is never drawn as a saved one.
 */
export function CardSaveState({ copy }: { copy?: Record<string, string> }) {
  const { pending } = useFormStatus();
  const { outcome, retry } = useAutosaveOutcome();
  const [shown, setShown] = useState(false);
  const seen = useRef(0);
  /* The action's own sentence for a refusal, when it has one: a code the card knows, or words plainly written for a person. The
     database's words (a returned `error.message`) are never printed — there is just "Couldn’t save." and Try again. */
  const why = outcome.kind === 'failed' ? outcome.why : undefined;
  const said = why ? (copy?.[why] ?? (isPlainSentence(why) ? why : null)) : null;
  useEffect(() => {
    if (outcome.kind !== 'saved' || outcome.n === seen.current) return;
    seen.current = outcome.n;
    setShown(true);
    const t = setTimeout(() => setShown(false), 2200);
    return () => clearTimeout(t);
  }, [outcome]);
  return (
    <span role={outcome.kind === 'failed' && !pending ? 'alert' : 'status'} aria-live="polite" data-autosave-line="" className="inline-flex min-h-[1.25rem] flex-wrap items-center justify-end gap-x-2 text-xs text-ink/55">
      {pending ? (
        'Saving…'
      ) : outcome.kind === 'failed' ? (
        <>
          <span className="font-semibold text-danger-700">Couldn’t save.</span>
          {said ? <span data-autosave-why="" className="text-danger-700">{said}</span> : null}
          <ActionButton tone="danger" label="Try again" icon={Check} onClick={retry} data-testid="autosave-retry" />
        </>
      ) : outcome.kind === 'saved' && shown ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} />
          <span className="text-success-800">Saved</span>
        </>
      ) : null}
    </span>
  );
}
