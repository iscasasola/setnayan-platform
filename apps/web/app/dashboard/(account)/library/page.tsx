import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Images, Heart, Newspaper, UserCircle, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { PhotosTab } from './_components/photos-tab';
import { VendorsTab } from './_components/vendors-tab';
import { EditorialsTab } from './_components/editorials-tab';

export const metadata = { title: 'Memories Hub' };

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
      <Link href="/dashboard" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to events
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="sn-eye">
            <Images aria-hidden strokeWidth={1.75} />
            Kept for life
          </p>
          <h1 className="sn-h1">Memories Hub</h1>
          <p className="max-w-prose text-base text-ink/65">
            Every photo, video, and memory — kept for life, across every event you host or
            attend. Your saved vendors and the editorials you&rsquo;re part of live here too.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/dashboard/profile" className="sn-chip sn-press">
            <UserCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Profile
          </Link>
          <Link href="/dashboard/profile#settings" className="sn-chip sn-press">
            <Settings aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Settings
          </Link>
        </div>
      </header>

      {/* Life-Flash entry — the everyone-reachable path (single-event couples
          bypass the account hub via its redirect); flag-gated (Build Plan §5) */}
      {lifeStoryEnabled() ? (
        <Link
          href="/dashboard/life-flash"
          className="sn-card sn-press group mb-8 flex items-center justify-between gap-4 p-4"
        >
          <div>
            <p className="text-sm font-semibold text-ink">Life-Flash</p>
            <p className="text-xs text-ink/55">
              The moments that mattered most, through every camera that was there — gathered
              while you&rsquo;re living them
            </p>
          </div>
          <span
            aria-hidden
            className="text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
          >
            ▶
          </span>
        </Link>
      ) : null}

      {/* Tab strip — kit chips; plain links so the page stays a server component */}
      <nav className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={`/dashboard/library?tab=${key}`}
              aria-current={isActive ? 'page' : undefined}
              className={`sn-chip sn-press shrink-0 ${isActive ? 'selected' : ''}`}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* key remount on tab change → the lens body cross-fades in (§ 2d) */}
      <div key={active} className="sn-lens-swap">
        {active === 'photos' ? <PhotosTab userId={user.id} /> : null}
        {active === 'vendors' ? <VendorsTab userId={user.id} /> : null}
        {active === 'editorials' ? <EditorialsTab userId={user.id} /> : null}
      </div>
    </div>
  );
}
