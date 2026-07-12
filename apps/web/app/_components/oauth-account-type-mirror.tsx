'use client';

import { useEffect } from 'react';

/**
 * Bridges the /signup Couple/Vendor radio (`name="account_type"`, which lives in
 * the email/password `<form>`) into the SEPARATE OAuth button forms — HTML forms
 * can't share fields across form elements, so a vendor signing up via Google/
 * Apple otherwise submits no account_type and lands misclassified as a customer.
 *
 * On mount and whenever the radio changes, copy the checked value into every
 * hidden `[data-oauth-account-type]` input rendered inside the OAuth forms. The
 * OAuth forms are server-rendered (not React-hydrated), so mutating the DOM
 * `.value` directly is safe. No-JS degrades to the server default ('customer') —
 * identical to the behaviour before this fix, so it never regresses.
 */
export function OAuthAccountTypeMirror() {
  useEffect(() => {
    const sync = () => {
      const checked = document.querySelector<HTMLInputElement>(
        'input[name="account_type"][type="radio"]:checked',
      );
      const value = checked?.value === 'vendor' ? 'vendor' : 'customer';
      document
        .querySelectorAll<HTMLInputElement>('input[data-oauth-account-type]')
        .forEach((input) => {
          input.value = value;
        });
    };
    sync();
    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="account_type"][type="radio"]'),
    );
    radios.forEach((r) => r.addEventListener('change', sync));
    return () => radios.forEach((r) => r.removeEventListener('change', sync));
  }, []);

  return null;
}
