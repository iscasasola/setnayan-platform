'use client';

import { useEffect, useState } from 'react';

/**
 * 💳 The acceptance marks under "Pay with", in the ruled order (owner 2026-11-21, DECISION_LOG "MAYA PAY OPTIONS +
 * SHOPEEPAY"): QR Ph → Apple Pay OR Google Pay → Visa · Mastercard → ShopeePay. No Grab, no installments.
 *
 * The wallet mark is the ONE thing that needs the browser: Apple Pay only where `ApplePaySession` says it can pay,
 * Google Pay only where the Payment Request API says it can — never both, and with neither the mark is left out
 * (v3 drawing: "with neither, that badge is left out"). Nothing is loaded from Google or Apple to ask.
 *
 * ⚠ PLAIN-NAME MARKS, ON PURPOSE. The drawing asks for each brand's official mark file at its own size and clear
 * space, and says "no redrawn or imitation logos". Those files are not in the repo yet, so the names are drawn as
 * text (the drawing's own placeholders) until the owner supplies them — listed in PR #8096's Owner steps.
 * They are not buttons: the payer picks on Maya's page.
 */
type Wallet = 'apple' | 'google' | null;

async function detectWallet(): Promise<Wallet> {
  try {
    const w = window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } };
    if (w.ApplePaySession?.canMakePayments?.()) return 'apple';
  } catch {
    /* not Safari */
  }
  try {
    if (typeof PaymentRequest === 'undefined') return null;
    const req = new PaymentRequest(
      [
        {
          supportedMethods: 'https://google.com/pay',
          data: { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [{ type: 'CARD', parameters: { allowedAuthMethods: ['PAN_ONLY'], allowedCardNetworks: ['VISA', 'MASTERCARD'] } }] },
        },
      ],
      { total: { label: 'Setnayan', amount: { currency: 'PHP', value: '1.00' } } },
    );
    return (await req.canMakePayment()) ? 'google' : null;
  } catch {
    return null;
  }
}

export function MayaMarks() {
  const [wallet, setWallet] = useState<Wallet>(null);
  useEffect(() => {
    let live = true;
    void detectWallet().then((w) => {
      if (live) setWallet(w);
    });
    return () => {
      live = false;
    };
  }, []);

  const marks = ['QR Ph', wallet === 'apple' ? 'Apple Pay' : wallet === 'google' ? 'Google Pay' : null, 'Visa', 'Mastercard', 'ShopeePay'].filter(
    (m): m is string => m !== null,
  );
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Ways to pay on Maya" data-maya-marks="">
      {marks.map((m) => (
        <li
          key={m}
          // No box on light (v3: "no boxes around the marks"); the white ground keeps them on white in dark, as the
          // brands' marks require.
          className="rounded bg-white px-2 py-1 text-[12px] font-semibold text-ink-on-light/60 transition-colors hover:text-ink-on-light"
          // MOTION_STANDARD: the marks warm from grey on hover at Quick.
          style={{ transitionDuration: 'var(--sn-m-quick)' }}
        >
          {m}
        </li>
      ))}
    </ul>
  );
}
