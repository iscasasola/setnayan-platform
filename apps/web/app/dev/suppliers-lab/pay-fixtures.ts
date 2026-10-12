/**
 * /dev/suppliers-lab — what the Pay sheet's one request answers, per fixture
 * supplier. Built with the SAME rules the real read uses (`moneyStep`,
 * `paymentHistory`, `computeStepper`), so the sheet draws a state those rules
 * produce — not one typed by hand.
 *
 *   v-seda     added by the couple · their own plan (two instalments) · no
 *              published payment details (they are not on Setnayan)
 *   v-bituin   on Setnayan · their own plan · three published ways to pay
 *              (a bank account, a QR, a payment link)
 *   v-lumina   on Setnayan · paid, confirmed by them
 *
 *   &payfail=1   the request fails        &payslow=1   …or takes 2.5 s
 */
import { moneyStep } from '@/lib/accepted-quote-terms';
import { paymentHistory, type PaymentLedgerRow } from '@/lib/payment-history';
import { computeStepper, type PlanInstance } from '@/lib/vendor-service-payment-schedules';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import type { LoadPaySheetResult } from '@/lib/pay-sheet';

const inst = (seq: number, label: string, amount_php: number, due_date: string): PlanInstance => ({
  seq,
  label,
  amount_php,
  due_date,
  amount_kind: 'fixed',
  percent_bps: null,
});

export const LAB_PLANS: Record<string, PlanInstance[]> = {
  'v-seda': [inst(1, 'First payment', 528_000, '2026-10-05'), inst(2, 'Balance', 528_000, '2026-12-11')],
  'v-bituin': [inst(1, 'Reservation', 38_000, '2026-10-08'), inst(2, 'Balance', 152_000, '2026-12-04')],
};

const method = (m: Partial<CoupleFacingMethod> & Pick<CoupleFacingMethod, 'payment_method_id' | 'method_type' | 'label'>): CoupleFacingMethod => ({
  provider: null,
  account_name: null,
  account_number: null,
  decoded_destination: null,
  link_url: null,
  link_domain: null,
  note: null,
  is_primary: false,
  qr_display_url: null,
  ...m,
});

const BITUIN_METHODS: CoupleFacingMethod[] = [
  method({ payment_method_id: 'pm-1', method_type: 'bank', label: 'BDO · bank transfer', provider: 'BDO', account_name: 'Bituin Catering Inc.', account_number: '0054 8820 1193', is_primary: true }),
  method({ payment_method_id: 'pm-2', method_type: 'qr', label: 'GCash · QR', provider: 'GCash', account_name: 'Bituin Catering', decoded_destination: '0917 555 4471' }),
  method({ payment_method_id: 'pm-3', method_type: 'link', label: 'Payment link', link_url: 'https://pay.example.com/bituin', link_domain: 'pay.example.com' }),
];

const TODAY = '2026-10-01';
const NO_DEPOSIT = { recordedAt: null, acknowledgedAt: null, declinedAt: null };

export function labPaySheet(vendorId: string): LoadPaySheetResult {
  const name = vendorId === 'v-seda' ? 'Seda Vertis North' : vendorId === 'v-bituin' ? 'Bituin Catering' : 'Lumina Studio';
  if (vendorId === 'v-seda' || vendorId === 'v-bituin') {
    const own = vendorId === 'v-seda';
    return {
      status: 'ok',
      data: {
        own,
        plan: { steps: computeStepper(LAB_PLANS[vendorId]!, []), clearedAt: null, isDefaultSeeded: false },
        scheduleSource: 'plan',
        quoteSchedule: null,
        depositRecordedAt: null,
        depositAcknowledgedAt: null,
        depositProofUrl: null,
        depositDeclinedAt: null,
        depositDeclineReason: null,
        payMethods: own ? [] : BITUIN_METHODS,
        payMethodsState: own ? 'off_platform' : 'listed',
        requestedFirstPaymentCentavos: null,
        requestedFirstPaymentSentence: null,
        requestedTermsUnreadable: false,
        step: moneyStep({ terms: null, booked: true, today: TODAY, deposit: NO_DEPOSIT, ledger: { count: 0, paidCentavos: 0, recordedFirstCentavos: null } }),
        history: paymentHistory({ rowsOrNull: [], totalCentavos: null, viewer: 'couple', otherName: name }),
      },
    };
  }
  if (vendorId === 'v-lumina') {
    const rows: PaymentLedgerRow[] = [
      { payment_id: 'pay-lumina', amount_php: 85_000, paid_at: '2026-09-12T03:00:00Z', method: 'GCash', vendor_confirmed_at: '2026-09-12T08:00:00Z', is_deposit_record: true },
    ];
    const deposit = { recordedAt: '2026-09-12T03:00:00Z', acknowledgedAt: '2026-09-12T08:00:00Z', declinedAt: null };
    return {
      status: 'ok',
      data: {
        own: false,
        plan: { steps: [], clearedAt: null, isDefaultSeeded: false },
        scheduleSource: 'none',
        quoteSchedule: null,
        depositRecordedAt: deposit.recordedAt,
        depositAcknowledgedAt: deposit.acknowledgedAt,
        depositProofUrl: null,
        depositDeclinedAt: null,
        depositDeclineReason: null,
        payMethods: [],
        payMethodsState: 'listed',
        requestedFirstPaymentCentavos: null,
        requestedFirstPaymentSentence: null,
        requestedTermsUnreadable: false,
        step: moneyStep({ terms: null, booked: true, today: TODAY, deposit, ledger: { count: 1, paidCentavos: 8_500_000, recordedFirstCentavos: 8_500_000 } }),
        history: paymentHistory({ rowsOrNull: rows, totalCentavos: 8_500_000, viewer: 'couple', otherName: name }),
      },
    };
  }
  return { status: 'not_booked' };
}
