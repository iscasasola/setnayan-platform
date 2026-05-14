import { AlertTriangle } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Force Majeure · Admin' };

export default function AdminForceMajeurePage() {
  return (
    <DashboardPlaceholder
      Icon={AlertTriangle}
      title="Force-majeure escalation queue."
      blurb="Customer-flagged force-majeure cases land here for review by the Disputes Handler (per Vendor Agreement § 9.1 two-admin scope). 7-day auto-resolution window with 4 resolution paths: refund / reschedule / partial credit / mediation."
      features={[
        'Inbound flags from /dashboard/<event>/disputes (couple side) or /vendor-dashboard/disputes',
        'Evidence pack: type picker (typhoon, cancellation, etc.) + uploaded artifacts',
        '4 resolution paths per Disputes & Refunds 0023 § 3.6',
        '7-day auto-resolution timer; admin can extend with reason',
        'Two-admin approval required for any refund > ₱5,000',
      ]}
    />
  );
}
