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
  Tag,
  Sparkles,
  Wallet,
  Receipt,
  FileSpreadsheet,
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
  {
    key: 'bir-2307',
    label: 'BIR 2307',
    href: '/admin/bir/2307',
    icon: FileSpreadsheet,
    description:
      'Quarterly Form 2307 export. Generate vendor withholding documents in eFPS-ready format.',
  },
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
