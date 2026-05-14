import { Wallet } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Earnings · Vendor' };

export default function VendorEarningsPage() {
  return (
    <DashboardPlaceholder
      Icon={Wallet}
      title="Track earnings per event."
      blurb="When a couple’s order for one of your services is marked paid by the Setnayan team, the matching earning row posts here. Filter by month, service, and couple. Export for tax filings (BIR-compliant)."
      features={[
        'Earning rows post the moment an order flips to `paid` (matches 0034 reconciliation)',
        'Per-month subtotals + year-to-date running total',
        'BIR-compliant export with VAT split (12%) per row, ready for Form 2307',
        '3% Setnayan Pay convenience-fee line shown transparently per booking',
        'Future: direct payout via GCash Merchant API (V1.5)',
      ]}
    />
  );
}
