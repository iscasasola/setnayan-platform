/**
 * /admin/money — mobile overflow landing for the Money group.
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock — 7 money
 * surfaces compress into a card grid behind the Money bottom-nav tab.
 * Payment methods is canonically located here per the v2.1 Phase 3
 * de-dup decision (dropped from Settings group).
 */

import {
  DollarSign,
  PiggyBank,
  Tag,
  Sparkles,
  Wallet,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Money · Admin' };

const MONEY_ITEMS: LandingItem[] = [
  {
    key: 'pricing',
    label: 'Pricing',
    href: '/admin/pricing',
    icon: DollarSign,
    description:
      'SKU catalog with sticker prices and active status. Read-only V1; edit lands with the next refresh.',
  },
  {
    key: 'budget-planner',
    label: 'Budget Planner',
    href: '/admin/budget-planner',
    icon: PiggyBank,
    description:
      'Seed benchmark prices, tune the allocation engine, and review de-identified couple budget insights.',
  },
  {
    key: 'discount-codes',
    label: 'Discount codes',
    href: '/admin/discount-codes',
    icon: Tag,
    description:
      'Voucher codes for pilot. Mint percentage discounts, capped percentages, or 100% free codes.',
  },
  {
    key: 'addons',
    label: 'Add-ons',
    href: '/admin/addons',
    icon: Sparkles,
    description:
      'Customer SKU catalog audit. Pricing, eligibility, and lifetime traction in one grid.',
  },
  {
    key: 'payouts',
    label: 'Payouts',
    href: '/admin/payouts',
    icon: Wallet,
    description:
      'Vendor payout queue and historical disbursement records. Approve, hold, or mark settled.',
  },
  {
    key: 'receipts',
    label: 'Receipts',
    href: '/admin/receipts',
    icon: Receipt,
    description:
      'Setnayan software receipts archive. Download per-order PDFs for couples and vendors.',
  },
  // RETIRED 2026-05-29 · BIR Form 2307 Money-landing card removed under
  // V2 publisher posture per CLAUDE.md tenth 2026-05-28 row. Setnayan no
  // longer withholds vendor income tax (no booking commission · no payout
  // intermediation · vendor handles their own 2307 as income recipient per
  // V2 Phase F manpower exemption). Page redirects to /admin/money for
  // bookmark continuity. Lib + table preserved as audit history.
  {
    key: 'payment-methods',
    label: 'Payment methods',
    href: '/admin/settings/payment-methods',
    icon: CreditCard,
    description:
      'BDO and GCash receiving accounts shown on customer orders. Edit account numbers and QR codes.',
  },
];

export default function AdminMoneyLanding() {
  return (
    <MobileLandingGrid
      title="Money"
      subtitle="Everything that touches PHP. Pricing, vouchers, payouts, receipts, BIR, and payment methods."
      items={MONEY_ITEMS}
    />
  );
}
