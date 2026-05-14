import { ShieldAlert } from 'lucide-react';

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
