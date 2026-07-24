'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, X } from 'lucide-react';

/**
 * Pinned, non-dismissible system notice at the top of every chat thread
 * (couple-side AND vendor-side mirror). Iteration 0019 § Gate, locked
 * 2026-05-14. The notice is not stored in chat_messages, doesn't count
 * toward unread, and has no sender attribution.
 *
 * Copy is locale-resolved per iteration 0015. EN-PH is the canonical
 * string; TL and CEB land in the next locale pass.
 */
const COPY = {
  'en-PH': {
    lead: 'All your event info is already in Setnayan',
    body: '— your vendor sees what they need from your profile. Please don’t share private info in chat.',
    examples: 'government IDs · card numbers · full addresses · OTPs · passwords',
    report: 'If a vendor asks for these, report it via Help.',
  },
  // TL / CEB placeholders — wire the locale key now, copy lands in the next
  // locale pass (per spec § Gate "EN required; TL + CEB strings TBD").
} as const;

type Locale = keyof typeof COPY;

export function ChatPrivacyNotice({
  locale = 'en-PH',
}: {
  locale?: Locale | string;
}) {
  const strings = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'en-PH'];
  return (
    <div
      role="note"
      aria-label="Chat privacy notice"
      className="flex items-start gap-3 rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs text-ink/75"
    >
      <ShieldAlert
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
        strokeWidth={1.75}
      />
      <p className="leading-relaxed">
        <span className="font-medium text-ink">{strings.lead}</span>{' '}
        {strings.body}{' '}
        <span className="underline decoration-terracotta/40 underline-offset-2">
          {strings.examples}
        </span>{' '}
        {strings.report}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Couple-facing safety banner (build 2026-07-23)                            */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Warm, couple-facing safety guidance pinned at the top of a couple↔vendor
 * thread. Supersedes the plain <ChatPrivacyNotice> on COUPLE surfaces only —
 * it folds in the same "don't share private info" line plus payment-safety
 * guidance, framed for the couple. Vendor surfaces keep <ChatPrivacyNotice>
 * (the safety copy — "a vendor pushing you off-app is a red flag" — is
 * couple-directed and would read oddly on the vendor's own screen).
 *
 * Default visible; dismissible-but-remembered in localStorage so a couple who
 * has internalised it isn't nagged on every thread. Dismiss is per-device and
 * reversible only by clearing storage — the guidance is advisory, not a gate,
 * so a lost dismissal costs nothing. Not stored in chat_messages; no unread
 * impact; no sender attribution.
 */
const SAFETY_DISMISS_KEY = 'setnayan_chat_safety_banner_dismissed';

const SAFETY_POINTS = [
  'Keep your chats and payments inside Setnayan.',
  'Approve only what you asked for — and pay only the amount you agreed on.',
  'Never share IDs, card numbers, or OTPs in chat.',
  'A vendor rushing you to pay off Setnayan is a red flag — tell us via Help.',
] as const;

export function ChatSafetyBanner() {
  // Default to visible so SSR + first paint never flash the banner in-then-out;
  // the remembered dismissal is applied after hydration if it was set.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SAFETY_DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // Private mode / storage disabled — treat as not dismissed.
    }
  }, []);

  function onDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(SAFETY_DISMISS_KEY, '1');
    } catch {
      // No-op; banner stays hidden in-memory regardless.
    }
  }

  if (dismissed) return null;

  return (
    <div
      role="note"
      aria-label="Staying safe while you plan"
      className="rounded-xl border border-terracotta/25 bg-terracotta/[0.05] px-4 py-3 text-xs text-ink/75"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-medium text-ink">Plan with peace of mind</p>
          <ul className="space-y-1 leading-relaxed">
            {SAFETY_POINTS.map((point) => (
              <li key={point} className="flex gap-1.5">
                <span aria-hidden className="text-terracotta/60">
                  ·
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss safety tips"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
