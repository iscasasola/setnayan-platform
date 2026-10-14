'use client';

/**
 * SupplierSubmit — A FORM'S SUBMIT, DRAWN BY THE BUTTON RULE (S-PR0, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 "buttons are
 * `ActionButton` tones"; BUTTON_RULE_2026-10-07 rules 1, 2 and 4).
 *
 * The supplier side answers on the page — Agree, Move, Unlock, Confirm — and
 * every one of those is a `<form action={serverAction}>`. `ActionButton` can
 * submit, but it cannot say "Saving…" or lock the screen while the action
 * runs; the shipped `SubmitButton` does both (the pending word, the disabled
 * state against a double tap, and the app's no-touch veil). So this is NOT a
 * third button: it is `SubmitButton` wearing `ActionButton`'s own class list
 * (`actionButtonClass`) and its icon + `<span class="lbl">` word — one pending
 * mechanism, one look.
 *
 * A server component hands it an ELEMENT for `icon` (`icon={<Check … />}`),
 * never a component — functions do not cross to a client component.
 *
 * Loaded only by supplier routes.
 */
import type { ReactElement } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { actionButtonClass, type ActionTone } from '@/components/action-button';

export function SupplierSubmit({
  tone,
  icon,
  label,
  main = false,
  pendingLabel,
  name,
  value,
  overlay = true,
  className,
}: {
  /** REQUIRED — the meaning: ok commits, danger takes back, neutral manages. */
  tone: ActionTone;
  icon: ReactElement;
  /** The word. Also the `aria-label`. */
  label: string;
  /** The row's main verb: filled. */
  main?: boolean;
  /** What it says while the action runs ("Moving…"). */
  pendingLabel: string;
  name?: string;
  value?: string;
  /** The no-touch veil while saving (on by default, as on every form save). */
  overlay?: boolean;
  className?: string;
}) {
  return (
    <SubmitButton
      className={actionButtonClass(tone, { main, extra: className })}
      pendingLabel={pendingLabel}
      overlay={overlay}
      name={name}
      value={value}
      aria-label={label}
      title={label}
      data-tone={tone}
      data-main={main ? '' : undefined}
    >
      {icon}
      <span className="lbl">{label}</span>
    </SubmitButton>
  );
}
