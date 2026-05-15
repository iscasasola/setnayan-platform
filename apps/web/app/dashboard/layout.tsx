import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { OuterDashboardHeader } from './_components/outer-dashboard-header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('theme_preference, account_type, deleted_at, tour_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // Reject deleted accounts — sign them out cleanly.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Vendors belong on the vendor-side tree.
  if (profile?.account_type === 'vendor') {
    redirect('/vendor-dashboard');
  }

  const theme = profile?.theme_preference ?? 'setnayan_default';

  // Top-level dashboard chrome. The brand-logo header renders only on
  // non-event-scoped routes (/dashboard root, /dashboard/profile, etc.).
  // On /dashboard/[eventId]/* the EventSwitcher in that nested layout is
  // the single source of chrome per the 2026-05-14 single-strip lock.
  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-cream">
      <OuterDashboardHeader email={user.email ?? ''} />
      <main className="flex-1">{children}</main>
      {!profile?.tour_completed_at ? (
        <GuidedTour role="couple" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
