'use client';

/**
 * RequiredRowsHold — the browser's `required`, for Field-template rows.
 *
 * A raw `<input required>` stopped its form's post in the browser. A Field row (`TypedRow`, `form-row.tsx`) posts
 * through a HIDDEN carrier, which the browser never checks — so converting a required box to the template would
 * silently drop that check. Drop this anywhere inside the `<form>` (a server component's form included): a press of
 * the form's submit while one of its required rows is still empty shakes that row into view (`nudgeFormRows`) and
 * holds the post. Nothing else changes; the server still checks on its own.
 */
import { useEffect, useRef } from 'react';
import { nudgeFormRows } from './form-row';

export function RequiredRowsHold() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const hold = (e: Event) => {
      if (nudgeFormRows(form) > 0) e.preventDefault();
    };
    form.addEventListener('submit', hold);
    return () => form.removeEventListener('submit', hold);
  }, []);
  return <span ref={ref} hidden data-required-rows-hold="" />;
}
