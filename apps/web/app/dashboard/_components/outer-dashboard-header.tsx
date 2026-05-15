'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/app/_components/logo';

const NON_EVENT_DASHBOARD_PREFIXES = new Set([
  'api-keys',
  'create-event',
  'notifications',
  'profile',
]);

function isEventScopedRoute(pathname: string): boolean {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (!match) return false;
  return !NON_EVENT_DASHBOARD_PREFIXES.has(match[1]);
}

export function OuterDashboardHeader({ email }: { email: string }) {
  const pathname = usePathname() ?? '';

  // On event-scoped routes the EventSwitcher in [eventId]/layout.tsx is the
  // single source of chrome (per the 2026-05-14 top-nav single-strip lock).
  // Rendering this brand header alongside it produced the two-stacked-row
  // drift confirmed in production 2026-05-15.
  if (isEventScopedRoute(pathname)) return null;

  return (
    <header className="border-b border-ink/10 bg-cream">
      <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center text-ink">
          <Logo height={32} withWordmark />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/profile"
            className="hidden text-sm text-ink/70 underline-offset-4 hover:underline sm:inline"
          >
            {email}
          </Link>
          <form action="/auth/sign-out" method="post">
            <button className="button-secondary h-9 px-3 text-xs" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
