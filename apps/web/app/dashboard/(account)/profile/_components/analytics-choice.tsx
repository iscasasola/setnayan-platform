'use client';

/**
 * "Analytics cookies" — the analytics opt-out, where a signed-in person can
 * actually find it.
 *
 * 🔑 THIS IS NOT A SECOND CONTROL AND IT STORES NOTHING OF ITS OWN. The choice,
 * its durable per-device store and the panel that edits it all already shipped
 * (`lib/cookie-consent.ts` + the site-wide banner, which the root layout mounts
 * on every route). What did not exist was a way to REACH any of it from inside
 * the product: the "Cookie settings" link lives in the marketing and legal
 * footers, and the dashboard, admin and vendor trees mount no footer at all —
 * measured 2026-08-25, zero occurrences in all three. So somebody who signed up,
 * accepted, and then lived in their dashboard had to leave the app and go find a
 * marketing page to change their mind.
 *
 * A second store here would have been the worse bug: two answers to one
 * question, drifting apart. This row REPORTS the one answer and OPENS the one
 * panel.
 *
 * ⚖ PER-DEVICE AND ANONYMOUS, deliberately — a cookie on the browser that
 * answered, no database row and no account key. Keying consent to a USER would
 * create an RA 10173 proof-of-consent record, and that is a DPO decision the
 * owner has not made.
 */

import { useEffect, useState } from 'react';

import {
  CONSENT_CHANGE_EVENT,
  openConsentManager,
  readConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';

export function AnalyticsChoice() {
  /* `undefined` = not read yet (server render + first paint), `null` = this
     browser has never answered. They are different sentences to a reader, so
     they are different states here rather than one falsy blur. */
  const [consent, setConsent] = useState<CookieConsent | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener(CONSENT_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync);
  }, []);

  const state =
    consent === undefined ? 'loading' : consent === null ? 'unanswered' : consent.analytics ? 'on' : 'off';

  return (
    <div className="sn-tile flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Analytics cookies</p>
        <p className="text-xs text-ink/55">
          {state === 'off' ? (
            <>
              Off on this device. We are not measuring how you use Setnayan here.
              Essential cookies — the ones that keep you signed in — always stay on.
            </>
          ) : state === 'on' ? (
            <>
              On for this device. Helps us see which parts of Setnayan people
              actually use. Turning it off stops it straight away, on this device.
            </>
          ) : (
            <>
              Choose whether Setnayan may measure how you use it. Your answer is
              remembered on this device only — never against your account.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {state !== 'loading' ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
              state === 'on'
                ? 'border-ink/15 bg-white/60 text-ink/70'
                : state === 'off'
                  ? 'border-ink/15 bg-white/60 text-ink/70'
                  : 'border-ink/15 bg-white/60 text-ink/50'
            }`}
          >
            {state === 'on' ? 'On' : state === 'off' ? 'Off' : 'Not chosen'}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => openConsentManager()}
          className="button-secondary inline-flex items-center gap-2"
        >
          Change
        </button>
      </div>
    </div>
  );
}
