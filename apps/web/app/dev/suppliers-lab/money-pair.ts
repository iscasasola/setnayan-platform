/**
 * THE MONEY PAIR, ON ONE FIXTURE (Suppliers Pair 3, map P3). One booking —
 * Bituin Catering's reservation and balance — at four stages of the loop
 * "the couple records a payment → the supplier confirms or refuses → Paid":
 *
 *   due        nothing recorded yet
 *   waiting    the couple recorded the reservation; Bituin has not answered
 *   received   Bituin confirmed it (the couple's sheet says Paid ✓)
 *   refused    Bituin said it never arrived (it folds back to Due, H4)
 *
 * The couple's lab (`/dev/suppliers-lab?mode=booked&money=…`, press Bituin's
 * Pay) and the supplier's lab (`/dev/customer-money-lab?s=…`) read THIS file,
 * through the same fold both real pages use (`computeStepper`), so a picture
 * of one end and a picture of the other show the same booking at the same step.
 */
import { computeStepper, type PaymentSeqState, type StepperInstallment } from '@/lib/vendor-service-payment-schedules';
import type { PendingVendorPayment } from '@/lib/vendor-service-payment-schedules.server';
import { LAB_PLANS } from './pay-fixtures';

export const MONEY_STAGES = ['due', 'waiting', 'received', 'refused'] as const;
export type MoneyStage = (typeof MONEY_STAGES)[number];

export function moneyStageOf(raw: string | null | undefined): MoneyStage {
  return (MONEY_STAGES as readonly string[]).includes(raw ?? '') ? (raw as MoneyStage) : 'due';
}

/** The reservation the couple recorded (seq 1), as each stage leaves it. */
function seqStates(stage: MoneyStage): PaymentSeqState[] {
  if (stage === 'due') return [];
  return [{ schedule_instance_seq: 1, vendor_confirmed: stage === 'received', refused: stage === 'refused' }];
}

/** Bituin's plan with the stage's payment folded in — what both ends draw. */
export function bituinSteps(stage: MoneyStage): StepperInstallment[] {
  return computeStepper(LAB_PLANS['v-bituin']!, seqStates(stage));
}

export const BITUIN_PAYMENT_ID = 'pay-bituin-1';
const LOGGED_AT = '2026-10-03T02:00:00Z';

/** What waits on the supplier at this stage (`awaitsTheSupplier`: not confirmed). */
export function bituinPending(stage: MoneyStage): PendingVendorPayment[] {
  if (stage !== 'waiting' && stage !== 'refused') return [];
  return [
    {
      paymentId: BITUIN_PAYMENT_ID,
      eventVendorId: 'v-bituin',
      amountPhp: 38_000,
      paidAt: LOGGED_AT,
      method: 'BDO · bank transfer',
      reference: 'FT-20261003-4471',
      notes: null,
      installmentLabel: 'Reservation',
      proofUrl: null,
      isDepositRecord: false,
      dispute:
        stage === 'refused'
          ? { refusedAtMs: Date.parse('2026-10-03T09:00:00Z'), reason: 'Nothing has reached our BDO account yet.', settlement: null }
          : null,
    },
  ];
}
