'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type TabKey = 'guests' | 'vendors' | 'schedule' | 'services';

const TABS: { key: TabKey; label: string; icon: string; href: (eventId: string) => string }[] = [
  { key: 'guests', label: 'Guest List', icon: '👥', href: (id) => `/dashboard/${id}/guests` },
  { key: 'vendors', label: 'Vendors', icon: '💼', href: (id) => `/dashboard/${id}/vendors` },
  { key: 'schedule', label: 'Schedule', icon: '📅', href: (id) => `/dashboard/${id}/schedule` },
  { key: 'services', label: 'Services', icon: '✨', href: (id) => `/dashboard/${id}/services` },
];

function activeTab(pathname: string): TabKey | null {
  if (
    pathname.includes('/guests') ||
    pathname.includes('/invitation') ||
    pathname.includes('/seating')
  ) return 'guests';
  if (pathname.includes('/vendors') || pathname.includes('/budget')) return 'vendors';
  if (pathname.includes('/schedule')) return 'schedule';
  if (pathname.includes('/services')) return 'services';
  return null;
}

export function BottomNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Event sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-cream/95 backdrop-blur lg:static lg:border-t-0"
    >
      <ul className="mx-auto flex w-full max-w-6xl items-stretch justify-around px-2 py-1 sm:px-4 lg:max-w-6xl lg:justify-start lg:gap-2 lg:py-2">
        {TABS.map((tab) => {
          const isActive = current === tab.key;
          return (
            <li key={tab.key} className="flex-1 lg:flex-initial">
              <Link
                href={tab.href(eventId)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-12 min-h-[44pt] flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium lg:h-auto lg:flex-row lg:gap-2 lg:px-3 lg:py-2 lg:text-sm ${
                  isActive
                    ? 'text-terracotta'
                    : 'text-ink/60 hover:text-ink'
                }`}
              >
                <span aria-hidden className="text-lg leading-none lg:text-base">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
