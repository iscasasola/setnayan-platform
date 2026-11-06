'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

import {
  PH_PHONE_PLACEHOLDER,
  PH_PREFIX,
  formatPhoneDigits,
  phoneBoxState,
  phoneDigitsFromTyped,
  phonePostValue,
} from '@/lib/open-shop-phone';
import { OPEN_SHOP_PHONE_BOX_ERROR } from '@/lib/open-shop-validation';

/**
 * The contact-number box on "Open your shop" (owner, 2026-11-06 gate walk): **+63** fixed on the left, the number
 * on the right — a mobile starting with 9 (exactly 10 digits) or a landline with its area code. Digits only, capped,
 * spaced as typed. Every rule is `lib/open-shop-phone.ts` (pure, tested); whether the number is real is
 * `parsePhPhone`, the one numbering-plan rule.
 *
 * 🆕 THE REDESIGN'S WORDS (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN APPROVED", call 2): under the box, always,
 * "Mobile, or a landline with its area code."; when the number cannot be one (once the person leaves the box, or
 * Continue / Open my shop refused it), ONE sentence in the box's own line — "Use 9XX XXX XXXX, or your landline with
 * its area code." The shared `09XX` sentence stays everywhere else.
 *
 * Posts `contact_phone` as E.164 (`+639178888889`) from a hidden input, so the wizard's step gate and
 * `becomeVendor` read the same value they always read.
 */
export function PhoneField({
  digits,
  onDigits,
  error = null,
}: {
  /** The national digits on the right (no +63, no trunk 0). */
  digits: string;
  onDigits: (digits: string) => void;
  /** A refusal for this box from the step gate or the server (already in the door's words), drawn in its line. */
  error?: string | null;
}) {
  const [left, setLeft] = useState(false);
  const state = phoneBoxState(digits, left);
  const own = state.state === 'error' ? OPEN_SHOP_PHONE_BOX_ERROR : null;
  const message = own ?? error;
  const bad = Boolean(message);
  return (
    <span className="block space-y-1" data-open-shop-phone="">
      <span
        className="flex items-stretch overflow-hidden rounded-md border"
        style={{ borderColor: bad ? 'var(--m-mulberry-deep)' : 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <span
          className="flex shrink-0 select-none items-center border-r px-3 text-sm font-medium"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)', color: 'var(--m-ink)' }}
          aria-hidden
        >
          {PH_PREFIX}
        </span>
        <input // field-ok: a fixed +63 beside a digits-only, self-formatting box — not the one-line Field pill.
          id="open-shop-contact_phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-label={`Contact number, after ${PH_PREFIX}`}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? 'open-shop-err-contact_phone open-shop-phone-note' : 'open-shop-phone-note'}
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
          id="open-shop-err-contact_phone"
          className="flex items-start gap-1.5 text-xs"
          style={{ color: 'var(--m-mulberry-deep)' }}
          role="alert"
          data-open-shop-field-error="contact_phone"
        >
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>{message}</span>
        </span>
      ) : null}
      <span id="open-shop-phone-note" className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Mobile, or a landline with its area code.
      </span>
    </span>
  );
}
