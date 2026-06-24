import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Images, Heart, Newspaper, UserCircle, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PhotosTab } from './_components/photos-tab';
import { VendorsTab } from './_components/vendors-tab';
import { EditorialsTab } from './_components/editorials-tab';

export const metadata = { title: 'Collection' };

/**
 * Collection — the account-level, CROSS-EVENT hub. One sidebar entry, three tabs:
 * Photos & Videos · Saved Vendors · Editorials. Each tab aggregates across every
 * event the user hosts or attends (replacing the old per-tab switcher sections
 * that were removed in the events-first switcher redesign). Tab state lives in
 * the query string (?tab=) so the whole page stays a server component.
 */

const TAB_KEYS = ['photos', 'vendors', 'editorials'] as const;
type Tab = (typeof TAB_KEYS)[number];

const TABS: { key: Tab; label: string; Icon: typeof Images }[] = [
  { key: 'photos', label: 'Photos & Videos', Icon: Images },
  { key: 'vendors', label: 'Saved Vendors', Icon: Heart },
  { key: 'editorials', label: 'Editorials', Icon: Newspaper },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const active: Tab = TAB_KEYS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'photos';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to events
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Collection</h1>
          <p className="max-w-prose text-base text-ink/65">
            Everything that&rsquo;s yours — your photos &amp; videos, saved vendors, and the
            editorials you&rsquo;re part of, kept across all your events.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <UserCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Profile
          </Link>
          <Link
            href="/dashboard/profile#settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Settings aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Settings
          </Link>
        </div>
      </header>

      {/* Tab bar — plain links so the page stays a server component */}
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-ink/10">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={`/dashboard/library?tab=${key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-terracotta text-ink'
                  : 'border-transparent text-ink/55 hover:text-ink/80'
              }`}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {active === 'photos' ? <PhotosTab userId={user.id} /> : null}
      {active === 'vendors' ? <VendorsTab userId={user.id} /> : null}
      {active === 'editorials' ? <EditorialsTab userId={user.id} /> : null}
    </div>
  );
}
