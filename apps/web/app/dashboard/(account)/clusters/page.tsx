import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CalendarRange, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { PageMasthead } from '@/app/_components/page-masthead';
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

export const metadata = { title: 'Linked celebrations' };

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
      <PageMasthead title="Linked celebrations" />

      <section className="sn-tile">
        <p className="sn-eye flex items-center gap-2">
          <Link2 size={14} strokeWidth={1.75} aria-hidden />
          Linked celebrations
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          An engagement party, a shower and the wedding are separate celebrations with their own
          dates and their own guests. Group them and they are shown beside each other on one
          timeline.{' '}
          <strong className="font-medium text-ink">
            Grouping changes nothing about the celebrations themselves
          </strong>{' '}
          — each one keeps its own guest list, its own shots and its own money.
        </p>
      </section>

      {/* An unreadable list is not an empty one. */}
      {!clusters.measured ? (
        <p className="sn-tile text-sm text-ink-soft" role="status">
          We could not load your groups just now, so this list may be incomplete. Refresh to try
          again.
        </p>
      ) : clusters.rows.length === 0 ? (
        <QuietStart
          Icon={CalendarRange}
          title="No groups yet"
          blurb="Make one and add the celebrations that belong to the same run of events."
        />
      ) : (
        <ul className="space-y-3">
          {clusters.rows.map((c) => (
            <li key={c.event_cluster_id}>
              <Link
                href={`/dashboard/clusters/${c.event_cluster_id}`}
                className="sn-row flex items-center justify-between gap-3"
              >
                <span className="font-medium text-ink">{c.display_name}</span>
                <span className="sn-eye shrink-0">Open</span>
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
