'use client';

import type { ReactNode } from 'react';
import { signInWithProviderNative } from '@/lib/native-oauth';
import { isNativeSaveHandOff, type NativeSaveHandOff } from '@/lib/native-account-save';

/**
 * One press: the action, then — only when it hands back — the native sign-in.
 * Exported so the test runs the same steps the form does.
 */
export async function submitNativeSave(
  action: (formData: FormData) => Promise<NativeSaveHandOff | void>,
  formData: FormData,
  signIn: (provider: 'apple' | 'google', next: string) => Promise<boolean> = signInWithProviderNative,
): Promise<void> {
  const handOff = await action(formData);
  if (isNativeSaveHandOff(handOff)) await signIn(handOff.native, handOff.next);
}

/**
 * THE SAVE FORM INSIDE THE PHONE APP — the same Server Action as the web's
 * `<form action>`, called from here so its answer can be acted on in the app
 * (lib/native-account-save.ts says why).
 *
 * The action runs first, exactly as on the web (the guest pass, the Terms tick,
 * the plus-one's answers). When it hands back `{ native, next }`, the phone
 * app's NATIVE sign-in runs (`signInWithProviderNative`) — the Apple sheet on
 * iOS, Google in the system browser — and lands on `next`
 * (`/join/{eventId}/connect`, the one linking path). 🔒 The provider page is
 * NEVER opened in this web view. Any other answer is a redirect the action
 * already made (the Terms not ticked, "Not now"), which Next follows.
 *
 * While the sheet / browser is open the press stays pending ("Opening Apple…");
 * a guest who closes it gets the button back.
 */
export function NativeSaveForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<NativeSaveHandOff | void>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      className={className}
      data-native-save=""
      action={(formData) => submitNativeSave(action, formData)}
    >
      {children}
    </form>
  );
}
