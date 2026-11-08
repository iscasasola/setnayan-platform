/**
 * The Billing & receipts page's five sections and its one filter (Build 2 #39, v118). Tiny on purpose: the client
 * dropdown (`billing-filter.tsx`) imports it without pulling the readers' words and doors into the bundle.
 */
/** The five sections, in v118's order. `purchases` is the shipped list. */
export const BILLING_SECTIONS = ['purchases', 'gifts', 'payments', 'refunds', 'rewards'] as const;
export type BillingSection = (typeof BILLING_SECTIONS)[number];
export type BillingShow = 'all' | BillingSection;

export const BILLING_SECTION_LABEL: Readonly<Record<BillingSection, string>> = {
  purchases: 'Purchases',
  gifts: 'Gifts given',
  payments: 'Payments received',
  refunds: 'Refunds',
  rewards: 'Rewards earned',
};

/** `?show=` → a section, else All. */
export function billingShowOf(raw: string | string[] | undefined): BillingShow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && (BILLING_SECTIONS as readonly string[]).includes(v) ? (v as BillingSection) : 'all';
}

