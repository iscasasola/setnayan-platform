import { Briefcase } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Services · Vendor' };

export default function VendorServicesPage() {
  return (
    <DashboardPlaceholder
      Icon={Briefcase}
      title="Manage your services."
      blurb="Pick which of the 28 service categories you offer, set pricing tiers per service, and configure crew-meal counts for catering and on-site teams. Once published, your services power your public landing page and the marketplace listing."
      features={[
        '28 service categories — photographer, caterer, coordinator, florist, host, etc.',
        'Pricing tiers per service (starting at, custom quote, package deals)',
        'Crew meal counts feed couples’ 0007 Budget automatically',
        'Mark a service as a Setnayan-Exclusive offer for premium placement',
        'Toggle services on/off without losing pricing history',
      ]}
    />
  );
}
