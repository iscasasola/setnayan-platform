'use client';

import { useRef, type ComponentProps } from 'react';
import { StayForm } from '@/app/_components/stay-form';

/**
 * 📍 AN "ADD" FORM THAT SAVES IN PLACE AND EMPTIES ITSELF (owner 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE
 * SCREEN — APP-WIDE"). A plain `<form action>` is emptied by React after its action lands; a `StayForm` keeps what was
 * typed (it is the same screen, still standing). An Add form that stays on the screen must still come back empty, or
 * the next press adds the same thing twice — so after a save that LANDED (never after a refusal, which keeps the words
 * to fix) the form is reset. Everything else is `StayForm`, unchanged.
 */
export function StayResetForm({ onSaved, children, ...rest }: ComponentProps<typeof StayForm>) {
  const mark = useRef<HTMLSpanElement>(null);
  return (
    <StayForm
      {...rest}
      onSaved={() => {
        mark.current?.closest('form')?.reset();
        onSaved?.();
      }}
    >
      <span ref={mark} hidden />
      {children}
    </StayForm>
  );
}
