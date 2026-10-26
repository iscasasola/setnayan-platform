'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from '@/app/_components/submit-button';
import { SAVE_METHOD_FIELD, pressedSaveMethod } from '@/lib/guest-one-path';

/**
 * ONE PROVIDER'S "SAVE TO MY ACCOUNT" BUTTON (owner 2026-10-25, verbatim: "Show both").
 *
 * The press itself names the provider: the button posts `SAVE_METHOD_FIELD` = its own provider, so the action opens
 * the provider the guest PRESSED (`saveMethodFromForm`). Both buttons live in ONE form (the Terms tick and the
 * plus-one's answers are fields of that form), so they share one pending state — this reads which button was pressed
 * (`pressedSaveMethod`) so only THAT one says "Opening Apple…" / "Opening Google…", and the other is held disabled
 * until the press resolves. A submission that names no provider (none should) treats every button as pressed, which
 * is what one `SubmitButton` did.
 */
export function ProviderButton({
  method,
  ...rest
}: Omit<ComponentProps<typeof SubmitButton>, 'name' | 'value' | 'pending' | 'disabled'> & {
  method: 'apple' | 'google';
}) {
  const { pending, data } = useFormStatus();
  const pressed = pressedSaveMethod(data);
  const mine = pending && (pressed === null || pressed === method);
  return <SubmitButton {...rest} name={SAVE_METHOD_FIELD} value={method} pending={mine} disabled={pending && !mine} />;
}
