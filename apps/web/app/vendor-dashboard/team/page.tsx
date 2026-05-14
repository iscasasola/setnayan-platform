import { Users } from 'lucide-react';
import { DashboardPlaceholder } from '@/app/_components/dashboard-placeholder';

export const metadata = { title: 'Team · Vendor' };

export default function VendorTeamPage() {
  return (
    <DashboardPlaceholder
      Icon={Users}
      title="Add team members with scoped roles."
      blurb="Invite collaborators with one of four role tiers — Owner, Admin, Agent, Viewer. Per-agent service scoping means a videographer on your team only sees their own assignments, while an Admin can manage bookings across all services."
      features={[
        'Owner: full access; only role that can change other roles',
        'Admin: manage bookings, services, and team (except Owner role)',
        'Agent: assigned to specific services, sees only their own work',
        'Viewer: read-only access to schedule and bookings',
        'Optional team_label feeds the 0019 chat identity-masking layer',
      ]}
    />
  );
}
