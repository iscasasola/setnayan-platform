import { Briefcase } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = {
  title: 'Vendors — Setnayan',
  description:
    'Browse Filipino wedding vendors on Setnayan. Photographers, caterers, coordinators, florists, and more.',
};

export default function VendorsMarketplacePage() {
  return (
    <main className="min-h-dvh bg-cream">
      <DashboardPlaceholder
        Icon={Briefcase}
        eyebrow="Marketplace · coming soon"
        title="Browse Filipino wedding vendors."
        blurb="The public marketplace is opening soon. Couples will be able to discover vetted vendors by category, city, price band, and availability. Vendors who've already signed up will be the first listed."
        features={[
          '28 service categories — from photography and catering to coordination, florals, and pyrotechnics',
          'Filter by city, available-on-date, price band, tier, and "has Setnayan-exclusive offer"',
          'Sort by Recommended / Most reviews / Highest rated / Closest / Newest / Price',
          'Direct chat with the vendor through the platform — identity-masked until you decide to share details',
          'Reviews from real Setnayan couples post-event, with the 3% Setnayan Pay convenience-fee protection',
        ]}
      />
    </main>
  );
}
