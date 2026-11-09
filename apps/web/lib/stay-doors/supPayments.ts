/** Payment options — "How clients pay you" on Your details, and "Getting paid" in the Customers ⚙
 *  (`payment-options/actions.ts`). */
export const SUP_PAYMENTS_STAY_DOORS = [
  'supPayments.addPaymentMethod',
  'supPayments.deletePaymentMethod',
  'supPayments.setPrimaryPaymentMethod',
  'supPayments.togglePaymentMethodShown',
] as const;
export type SupPaymentsStayDoor = (typeof SUP_PAYMENTS_STAY_DOORS)[number];
