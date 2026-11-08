import 'server-only';
import type { SupPaymentsStayDoor } from '@/lib/stay-doors/supPayments';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import {
  addPaymentMethod,
  deletePaymentMethod,
  setPrimaryPaymentMethod,
  togglePaymentMethodShown,
} from '@/app/vendor-dashboard/payment-options/actions';
import { kind, type Door } from './_door';

/**
 * The payment-options editor is mounted on Your details (`/vendor-dashboard/profile#pay`) and in the Customers ⚙
 * (`return_to=customers` → `/vendor-dashboard/customers?gear=1&g…`). A refusal carries its sentence in `?error=` (Your
 * details) or `?gerror=` (the ⚙ — a key the default reader does not know), which `surface.tsx` prints as given. No shop →
 * bare `/vendor-dashboard`, signed out → `/login`: both navigate.
 */
const SUP_PAYMENTS_WORDS: StayWords = {
  within: [supplierScreen('profile'), supplierScreen('customers')],
  refuse: (q) => q.get('error') ?? q.get('gerror'),
};
const supPayments = kind(SUP_PAYMENTS_WORDS, null);

export const SUP_PAYMENTS: Readonly<Record<SupPaymentsStayDoor, Door>> = {
  'supPayments.addPaymentMethod': supPayments(addPaymentMethod),
  'supPayments.deletePaymentMethod': supPayments(deletePaymentMethod),
  'supPayments.setPrimaryPaymentMethod': supPayments(setPrimaryPaymentMethod),
  'supPayments.togglePaymentMethodShown': supPayments(togglePaymentMethodShown),
};
