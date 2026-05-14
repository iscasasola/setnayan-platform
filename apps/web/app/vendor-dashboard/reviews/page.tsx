import { Star } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Reviews · Vendor' };

export default function VendorReviewsPage() {
  return (
    <DashboardPlaceholder
      Icon={Star}
      title="Reviews from your couples."
      blurb="Reviews land here 24 hours after an event ends. They appear on your public landing page and weight your sort position in the marketplace. Reviews are permanent per the Vendor Agreement § 3.10 — they can’t be hidden, but you can publicly reply once."
      features={[
        'Rating breakdown by category (communication, quality, value, on-time)',
        'Per-review free-text feedback from the couple',
        'One-time vendor reply (public, anchored under the review)',
        'Average rating + total review count surfaced on the marketplace listing',
        'Trigger: auto-fires via Resend 24 hrs after event end',
      ]}
    />
  );
}
