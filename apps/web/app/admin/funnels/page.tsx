import { LineChart } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Funnels · Admin' };

export default function AdminFunnelsPage() {
  return (
    <DashboardPlaceholder
      Icon={LineChart}
      title="Funnel analytics."
      blurb="7 V1 funnels surfaced here once PostHog has been collecting events long enough to show real conversions. Each funnel breaks down by week, persona, and source. Powered by the 3 PostHog events already firing (signup_completed, event_created, order_paid) plus 4 more added with this surface."
      features={[
        'Customer signup → first booking',
        'Vendor signup → first listing live',
        'Guided Planner adoption → completion',
        'DIY browse → first vendor message',
        'Save-the-Date browse → paid render',
        'Papic browse → paid seat',
        'Pro Widget upgrade → paid bundle',
      ]}
    />
  );
}
