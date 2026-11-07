'use client';

import { useState } from 'react';

import {
  PH_PHONE_PLACEHOLDER,
  PH_PREFIX,
  formatPhoneDigits,
  phoneBoxState,
  phoneDigitsFromTyped,
  phonePostValue,
} from '@/lib/open-shop-phone';

/**
 * The contact-number box on "Open your shop" (owner, 2026-11-06 gate walk): **+63** fixed on the left, the number
 * on the right — a mobile starting with 9 (exactly 10 digits) or a landline with its area code. Digits only, capped,
 * spaced as typed, and what is wrong is said UNDER the box while typing. Every rule is `lib/open-shop-phone.ts`
 * (pure, tested); whether the number is real is `parsePhPhone`, the one numbering-plan rule.
 *
 * Posts `contact_phone` as E.164 (`+639178888889`) from a hidden input, so the wizard's step gate and
 * `becomeVendor` read the same value they always read.
 */
export function PhoneField({
  digits,
  onDigits,
}: {
  /** The national digits on the right (no +63, no trunk 0). */
  digits: string;
  onDigits: (digits: string) => void;
}) {
  const [left, setLeft] = useState(false);
  const state = phoneBoxState(digits, left);
  const bad = state.state === 'error';
  const message = state.state === 'error' || state.state === 'typing' ? state.message : null;
  return (
    <span className="block space-y-1" data-open-shop-phone="">
      <span
        className="flex items-stretch overflow-hidden rounded-md border"
        style={{ borderColor: bad ? 'var(--m-orange-deep)' : 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <span
          className="flex shrink-0 select-none items-center border-r px-3 text-sm font-medium"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)', color: 'var(--m-ink)' }}
          aria-hidden
        >
          {PH_PREFIX}
        </span>
        <input // field-ok: a fixed +63 beside a digits-only, self-formatting box — not the one-line Field pill.
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-label={`Contact number, after ${PH_PREFIX}`}
          aria-invalid={bad || undefined}
          aria-describedby={message ? 'open-shop-phone-note' : undefined}
          value={formatPhoneDigits(digits)}
          onChange={(e) => {
            setLeft(false);
            onDigits(phoneDigitsFromTyped(e.target.value));
          }}
          onBlur={() => setLeft(true)}
          placeholder={PH_PHONE_PLACEHOLDER}
          className="min-h-11 w-full bg-transparent px-3 text-sm outline-none"
          style={{ color: 'var(--m-ink)' }}
        />
      </span>
      <input type="hidden" name="contact_phone" value={phonePostValue(digits)} />
      {message ? (
        <span
          id="open-shop-phone-note"
          className="block text-xs"
          style={{ color: bad ? 'var(--m-orange-deep)' : 'var(--m-slate-3)' }}
          role={bad ? 'alert' : undefined}
          aria-live="polite"
        >
          {message}
        </span>
      ) : state.state === 'ok' ? (
        <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {state.kind === 'mobile' ? 'Mobile' : 'Landline'} · {PH_PREFIX} {formatPhoneDigits(digits)}
        </span>
      ) : null}
    </span>
  );
}
