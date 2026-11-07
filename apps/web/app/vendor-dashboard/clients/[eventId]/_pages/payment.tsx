/**
 * 🗂 PAYMENT — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). Shown only for a BOOKED client.
 *
 * OWNER OF THIS FILE: **C1** (B2 §2.3 — BudgetFigures split, `readVendorPaydayInstallments`). L2's hour-0 stub
 * draws the shipped Payments node unchanged, and carries the shipped reservation-policy line MOVED here from
 * `QuoteTab` in the client page (spec §9 #2; B2 §2.3: "move the shipped line onto this page").
 */
import type { PickedPageProps } from './context';

function fmtShortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** The shipped line, word for word — one definition, mounted wherever the money fold is drawn. */
export function ReservationLine({ acknowledgedAt }: { acknowledgedAt: string | null }) {
  if (!acknowledgedAt) return null;
  return (
    <p className="mt-2 text-xs text-ink/45">
      Protected by your reservation policy · acknowledged {fmtShortDate(acknowledgedAt)}.
    </p>
  );
}

export type PaymentPageProps = PickedPageProps & {
  /** `fetchPlanProgressForVendor(...).reservationAcknowledgedAt` for this booking, already read by the page. */
  reservationAcknowledgedAt: string | null;
};

export function PaymentPage({ shipped, reservationAcknowledgedAt }: PaymentPageProps) {
  return (
    <>
      {shipped ?? null}
      <ReservationLine acknowledgedAt={reservationAcknowledgedAt} />
    </>
  );
}
