import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';

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

  // Top-level dashboard chrome (outside an event scope) — just the brand,
  // avatar, and sign-out. The inside-event layout layers more on top.
  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-cream">
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
            >
              S
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
              Setnayan
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="hidden text-sm text-ink/70 underline-offset-4 hover:underline sm:inline"
            >
              {user.email}
            </Link>
            <form action="/auth/sign-out" method="post">
              <button className="button-secondary h-9 px-3 text-xs" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {!profile?.tour_completed_at ? (
        <GuidedTour role="couple" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
