/**
 * /admin/money — mobile overflow landing for the Money & Catalog group.
 *
 * WHY: nav tune 2026-06-15 (owner-approved this session — "6 tabs, keep
 * 'Work'"). The 2026-06-08 ops redesign had dissolved the Money tab and
 * folded its config into /admin/more; this route was a redirect to
 * /admin/more. The owner re-promoted Money to a dedicated bottom-nav tab
 * (Home · Work · Directory · Money · Insights · More), so this route is now
 * a real card-grid landing again — config surfaces only (the act-now money
 * QUEUES — Payments · Payouts · Token sales — stay in Work, not here).
 *
 * Mirrors the desktop sidebar's Money & Catalog group (key 'money') 1:1 per
 * [[feedback_setnayan_orphan_prevention]]; items lifted verbatim from the old
 * /admin/more accordion's Money & Catalog section.
 *
 * Payment methods lives under /admin/settings/payment-methods, so on that
 * page the More tab lights up (via its '/admin/settings' umbrella), not this
 * Money tab — it's intentionally NOT in the Money tab's activeMatch to avoid
 * a double-highlight. The card still links there from this landing.
 *
 * SCOPE: server component (same pattern as /admin/directory). Hidden at lg+
 * via lg:hidden — desktop reaches these through the sidebar Money group.
 */

import {
  DollarSign,
  Sparkles,
  Tag,
  Coins,
  PiggyBank,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'Money & Catalog · Admin' };

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
    key: 'addons',
    label: 'Add-ons',
    href: '/admin/addons',
    icon: Sparkles,
    description:
      'Customer SKU catalog audit. Pricing, eligibility, and lifetime traction in one grid.',
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
    key: 'token-bands',
    label: 'Token bands',
    href: '/admin/token-bands',
    icon: Coins,
    description:
      'Region → token burn bands (₱100 / ₱200 / ₱300) charged when a vendor answers an inquiry. Admin-editable.',
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
    key: 'receipts',
    label: 'Receipts',
    href: '/admin/receipts',
    icon: Receipt,
    description:
      'Setnayan software receipts archive. Download per-order PDFs for couples and vendors.',
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
      title="Money & Catalog"
      subtitle="Pricing, catalog, vouchers, and the receiving accounts couples pay into."
      items={MONEY_ITEMS}
    />
  );
}
