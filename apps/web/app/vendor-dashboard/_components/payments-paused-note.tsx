import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';

/**
 * What a supplier buy button shows in place of its "Pay with" choice when the
 * owner has switched every rail off (each personal account at its monthly
 * receiving cap). The server action refuses the same case with the same
 * sentence — this just says it before the tap instead of after.
 *
 * Mirrors the couple checkout drawer's "Payments are paused right now" panel.
 */
export function PaymentsPausedNote({ className = '' }: { className?: string }) {
  return (
    <p
      role="status"
      className={`rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/75 ${className}`}
    >
      {PAYMENTS_PAUSED_MESSAGE}
    </p>
  );
}
