import { AlertTriangle } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Disputes · Setnayan' };

export default function CoupleDisputesPage() {
  return (
    <DashboardPlaceholder
      Icon={AlertTriangle}
      title="Open a dispute or declare force majeure."
      blurb="Use this surface to flag a problem with a contracted vendor service — cancellation, no-show, quality issue, or a force-majeure event (typhoon, family emergency). The Setnayan Disputes Handler reviews within 7 days and works toward one of 4 resolution paths."
      features={[
        '4 resolution paths: refund, reschedule, partial credit, mediation',
        'Upload supporting evidence (photos, screenshots, weather alerts)',
        '7-day SLA with escalation cadence',
        'Permanent record on your event page; vendor cannot delete the flag',
        'Currently accessible from order detail pages; this dedicated surface lands with Phase 2',
      ]}
    />
  );
}
