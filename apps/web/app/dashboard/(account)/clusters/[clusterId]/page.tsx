import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Anchor, CalendarRange } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  clusterSpan,
  fetchCluster,
  fetchClusterTimeline,
  fetchLinkableCelebrations,
  isApproximate,
  timelineDateLabel,
} from '@/lib/clusters';
import { ClusterTools } from './_components/cluster-tools';

/**
 * ITEM 7c — the timeline: the celebrations of one group, in order, with the
 * dates each one actually claims.
 *
 * ─── ⚠ THE ORDER IS THE DATABASE'S, AND IT IS NOT `ORDER BY event_date` ────
 * `public.cluster_timeline()` returns rows already sorted, because getting that
 * sort right needs `event_date_precision` — a 'year' or 'month' event_date is a
 * FIRST-OF-RANGE PLACEHOLDER, so sorting on it naively opens the year with
 * "Sometime in 2027" ahead of a wedding genuinely booked for January. This page
 * renders the rows in the order it receives them and must not re-sort them.
 *
 * ─── ⚠ AND THE DATES ARE RENDERED BY PRECISION, NEVER RAW ─────────────────
 * `timelineDateLabel()` wraps the app's existing formatEventDateWithPrecision(),
 * so a year-precision celebration reads "Sometime in 2027" rather than
 * "January 1, 2027" — a date its host never chose. `sort_key` is never drawn.
 *
 * ⛔ NO MONEY ON THIS SCREEN. Deliberate, and it is the owner's 2026-09-02
 *    ruling, not an omission: "a cluster is presentation and planning, NEVER
 *    accounting." Every celebration keeps its own pot. Budgets are 7d.
 */

type Props = { params: Promise<{ clusterId: string }> };

export async function generateMetadata({ params }: Props) {
  const { clusterId } = await params;
  const supabase = await createClient();
  const cluster = await fetchCluster(supabase, clusterId);
  return { title: cluster?.display_name ?? 'Linked celebrations' };
}

export default async function ClusterTimelinePage({ params }: Props) {
  const { clusterId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const cluster = await fetchCluster(supabase, clusterId);
  // RLS filters a group that is not yours to zero rows, so "not found" and
  // "not yours" arrive here as the same value — and should, since telling the
  // two apart would confirm the group exists.
  if (!cluster) notFound();

  const [timeline, linkable] = await Promise.all([
    fetchClusterTimeline(supabase, clusterId),
    fetchLinkableCelebrations(supabase, user.id),
  ]);

  const span = clusterSpan(timeline.rows);

  return (
    <div className="sn-col space-y-6">
      <PageMasthead
        title={cluster.display_name}
        actions={
          <Link href="/dashboard/clusters" className="button-secondary text-xs">
            All groups
          </Link>
        }
      />

      <section className="sn-tile">
        <p className="sn-eye flex items-center gap-2">
          <CalendarRange size={14} strokeWidth={1.75} aria-hidden />
          {cluster.display_name}
        </p>
        <p className="mt-2 text-2xl font-medium text-ink">
          {span ?? 'No dates set yet'}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {timeline.measured
            ? `${timeline.rows.length} ${timeline.rows.length === 1 ? 'celebration' : 'celebrations'}`
            : 'We could not load this group just now'}
          {' · '}
          Each one keeps its own guests, its own shots and its own money.
        </p>
      </section>

      {/*
        🛑 A REFUSED READ MUST NOT RENDER AS AN EMPTY YEAR. The failure and the
        genuinely-new group would otherwise be byte-identical, which is the
        exact defect this repo has already shipped once and fixed seven times.
      */}
      {!timeline.measured ? (
        <p className="sn-tile text-sm text-ink-soft" role="status">
          We could not load the celebrations in this group. Nothing has changed — refresh to try
          again.
        </p>
      ) : timeline.rows.length === 0 ? (
        <p className="sn-tile text-sm text-ink-soft">
          Nothing in this group yet. Add one of your celebrations below.
        </p>
      ) : (
        <ol className="space-y-3">
          {timeline.rows.map((row) => (
            <li
              key={row.event_id}
              className={row.is_anchor ? 'sn-tile border-terracotta/40' : 'sn-row'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {row.is_anchor ? (
                    <p className="sn-eye flex items-center gap-1.5">
                      <Anchor size={14} strokeWidth={1.75} aria-hidden />
                      The main celebration
                    </p>
                  ) : null}
                  <p className="truncate font-medium text-ink">
                    <Link href={`/dashboard/${row.event_id}`} className="hover:underline">
                      {row.display_name}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {timelineDateLabel(row)}
                    {/*
                      Say the date is a window, not a day. Without this the
                      screen reads as if "August 2027" were a booking.
                    */}
                    {isApproximate(row) ? (
                      <span className="ml-1.5 text-xs text-ink-soft/80">· not yet set</span>
                    ) : null}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ClusterTools
        clusterId={clusterId}
        clusterName={cluster.display_name}
        members={timeline.rows.map((r) => ({
          event_id: r.event_id,
          display_name: r.display_name,
          is_anchor: r.is_anchor,
        }))}
        membersMeasured={timeline.measured}
        linkable={linkable.rows}
        linkableMeasured={linkable.measured}
      />
    </div>
  );
}
