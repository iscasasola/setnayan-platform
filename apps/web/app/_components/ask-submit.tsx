'use client';

/**
 * AskSubmit — the booking answer's submit (Agree · Turn it down) drawn by the
 * button rule: the shipped `SubmitButton` (pending word, double-tap lock, the
 * no-touch veil) wearing `ActionButton`'s own class list, so it is ONE look and
 * ONE pending mechanism, never a third button. A server component hands it an
 * ELEMENT for `icon`, never a component (functions do not cross to the client).
 *
 * 2026-10-12 look calls: every MAIN button is terracotta (`brand`), 44 px.
 * When S-PR0's `SupplierSubmit` (#6443, the same two pieces) lands, this file
 * becomes that import.
 */
import type { ReactElement } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { actionButtonClass, type ActionTone } from '@/components/action-button';

export function AskSubmit({
  tone,
  main = false,
  icon,
  label,
  pendingLabel,
}: {
  tone: ActionTone;
  main?: boolean;
  icon: ReactElement;
  label: string;
  pendingLabel: string;
}) {
  return (
    <SubmitButton className={actionButtonClass(tone, { main })} pendingLabel={pendingLabel} aria-label={label} title={label}>
      {icon}
      <span className="lbl">{label}</span>
    </SubmitButton>
  );
}
