import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CalendarRange, ChevronRight, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { PageMasthead } from '@/app/_components/page-masthead';
import { InfoTip } from '@/app/_components/info-tip';
import { QuietStart } from '@/app/_components/states/quiet-start';
import { fetchMyClusters, fetchLinkableCelebrations } from '@/lib/clusters';
import { CreateClusterForm } from './_components/create-cluster-form';

/**
 * ITEM 7c — the shelf of linked celebrations.
 *
 * ⚠ WHY THIS IS NOT AT /dashboard/year, which is the obvious name.
 * `/dashboard/year` is TAKEN and deliberately retired: the owner removed "Your
 * year" as a page on 2026-08-21 ("we already have the your year inside my
 * events") and it now redirects to /dashboard#worth-planning. That page was
 * about the CALENDAR — holidays and dates that book out early — and has nothing
 * to do with 7a's clusters. Mounting this there would resurrect a page the
 * owner killed and collide two unrelated meanings of one word.
 * 🔑 FLAGGED FOR THE OWNER: the route word here is "clusters", matching the
 * database primitive; the visible copy says "linked celebrations", which is the
 * 2026-07-15 lock's own phrasing.
 */

export const metadata = { title: 'Linked events' };

export default async function ClustersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [clusters, linkable] = await Promise.all([
    fetchMyClusters(supabase, user.id),
    fetchLinkableCelebrations(supabase, user.id),
  ]);

  return (
    <div className="sn-col space-y-6">
      <PageMasthead title="Linked events" />

      <section className="flex items-center gap-2">
        <Link2 size={16} strokeWidth={1.75} aria-hidden className="text-[color:var(--sn-ink-500)]" />
        <InfoTip
          label="Linked events"
          labelAs="h2"
          labelClassName="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--sn-ink-500)]"
          align="start"
        >
          An engagement party, a shower and the wedding are separate events with their own dates and their own
          guests. Group them and they are shown beside each other on one timeline.{' '}
          <strong className="font-medium text-ink">Grouping changes nothing about the events themselves</strong> —
          each one keeps its own guest list, its own shots and its own money.
        </InfoTip>
      </section>

      {/* An unreadable list is not an empty one. */}
      {!clusters.measured ? (
        <p className="text-sm text-warn" role="status">
          We could not load your groups just now — not the same as none. Refresh to try again.
        </p>
      ) : clusters.rows.length === 0 ? (
        <QuietStart
          Icon={CalendarRange}
          title="No groups yet"
          blurb="Make one and add the events that belong together."
        />
      ) : (
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {clusters.rows.map((c) => (
            <li key={c.event_cluster_id}>
              <Link
                href={`/dashboard/clusters/${c.event_cluster_id}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2"
              >
                <span className="font-semibold text-ink">{c.display_name}</span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-sn-accent">
                  Open
                  <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateClusterForm
        hasLinkable={linkable.rows.length > 0}
        linkableMeasured={linkable.measured}
      />
    </div>
  );
}
