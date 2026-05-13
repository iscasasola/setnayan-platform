import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, MessageSquare, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { countUnread } from '@/lib/notifications';
import { VendorSubnavTab } from './_components/subnav-tab';

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, unreadCount] = await Promise.all([
    supabase
      .from('users')
      .select('account_type, theme_preference, email, display_name, deleted_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
  ]);
  const profile = profileRes.data;

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Non-vendors get bounced to the couple-side dashboard.
  if (profile?.account_type !== 'vendor') {
    redirect('/dashboard');
  }

  const theme = profile?.theme_preference ?? 'setnayan_default';
  const displayName = profile?.display_name ?? profile?.email ?? 'Vendor';

  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-cream">
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/vendor-dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
            >
              S
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
              Setnayan · Vendor
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-ink/70 sm:inline">{displayName}</span>
            <form action="/auth/sign-out" method="post">
              <button className="button-secondary h-9 px-3 text-xs" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Vendor sections"
          className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8"
        >
          <VendorSubnavTab href="/vendor-dashboard" label="Profile" Icon={User} match="exact" />
          <VendorSubnavTab
            href="/vendor-dashboard/messages"
            label="Messages"
            Icon={MessageSquare}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/notifications"
            label="Notifications"
            Icon={Bell}
            badge={unreadCount}
            match="prefix"
          />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
