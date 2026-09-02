import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Anchor, CalendarRange, Wallet } from 'lucide-react';
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
import { budgetStateNote, fetchClusterBudgets } from '@/lib/cluster-budgets';
import { formatPhp } from '@/lib/budget';
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
 * ─── 7d · THE BUDGETS, AND THE ONE MONEY THAT MAY BE ADDED UP ─────────────
 * The owner's 2026-09-02 ruling is that a cluster is "presentation and
 * planning; it is NOT accounting", and the year is explicitly "dates AND
 * BUDGETS months ahead". So this screen shows each celebration's budget TARGET
 * — the number its host typed, which is planning — and a total derived from
 * them on every read.
 *
 * ⛔ IT SHOWS NO PAPIC POT, AND IT NEVER WILL. Credits are bought per
 *    celebration and rolling them up would reprice what customers already
 *    own. Budget pesos and capture credits are two different monies; only the
 *    first is summed here. `tests/db/a-pot-belongs-to-one-celebration.db.test.ts`
 *    and `lib/a-year-adds-up-its-budgets.test.ts` both fail if that blurs.
 * ⛔ AND IT STORES NOTHING. No cluster-level money column exists or may exist —
 *    7a's guard already treats `budget` as a value-bearing name.
 */

/**
 * What the celebrations OUTSIDE the total are — in words, and each kind named
 * separately.
 *
 * 🔑 "Could not read it" and "not yours to see" are a failure and a rule
 * working correctly. Collapsing them into one "not counted" reads as a glitch
 * over a deliberate refusal, and as a refusal over a glitch the couple could
 * fix by refreshing.
 */
function makeUpOfLine(b: {
  noTarget: number;
  unknownCount: number;
  withheldCount: number;
}): string {
  const parts: string[] = [];
  if (b.noTarget > 0) parts.push(`${b.noTarget} with no budget set`);
  if (b.withheldCount > 0) {
    parts.push(
      `${b.withheldCount} you do not host`,
    );
  }
  if (b.unknownCount > 0) {
    parts.push(
      `${b.unknownCount} we could not read — refresh to try again`,
    );
  }
  return parts.join(' · ');
}

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

  /*
   * 7d. Sequential on purpose: the budgets are read for the members the
   * timeline actually returned, so there is ONE answer to "what is in this
   * group" rather than two reads that can disagree.
   *
   * 🛑 A REFUSED TIMELINE READS NO BUDGETS AT ALL. With `measured: false` the
   * member list is unknown, so any total built from it would be a total of an
   * unknown set — a number that looks complete and is not. The section says so
   * instead.
   */
  const budgets = timeline.measured
    ? await fetchClusterBudgets(supabase, user.id, timeline.rows.map((r) => r.event_id))
    : null;
  const budgetByEvent = new Map(budgets?.rows.map((r) => [r.event_id, r]) ?? []);

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
        7d · THE BUDGETS. Derived on every read from the members' own targets
        and stored nowhere.

        🛑 EVERY BRANCH BELOW EXISTS BECAUSE ₱0 IS A CLAIM. "We could not read
        them", "nobody has set one yet" and "the total is ₱1.2M" are three
        different facts, and the first two must never be printed as money.
      */}
      <section className="sn-tile">
        <p className="sn-eye flex items-center gap-2">
          <Wallet size={14} strokeWidth={1.75} aria-hidden />
          Planned across the group
        </p>

        {!budgets ? (
          <p className="mt-2 text-sm text-ink-soft" role="status">
            We could not read the celebrations in this group, so there is no total to show.
          </p>
        ) : budgets.totalPhp === null ? (
          <>
            <p className="mt-2 text-2xl font-medium text-ink">
              {/*
                🛑 "No budgets set yet" IS A CLAIM ABOUT ALL OF THEM, so it may
                be said only when all of them were actually read. One refusal or
                one withheld celebration and the honest headline is that we do
                not have the number.
              */}
              {budgets.notCounted === 0 ? 'No budgets set yet' : 'Not available'}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {budgets.notCounted === 0
                ? 'Set a budget on a celebration and it is added here.'
                : makeUpOfLine(budgets)}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-2xl font-medium text-ink">{formatPhp(budgets.totalPhp)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {/*
                ⚠ SAY WHAT THE TOTAL IS MADE OF WHENEVER IT IS NOT ALL OF THEM.
                A partial sum drawn as if it were the whole is the same
                confident-wrong-number defect, one level up.
              */}
              {budgets.countedIn === budgets.rows.length
                ? `Across all ${budgets.countedIn} ${
                    budgets.countedIn === 1 ? 'celebration' : 'celebrations'
                  }`
                : `Across ${budgets.countedIn} of ${budgets.rows.length} celebrations · ${makeUpOfLine(
                    budgets,
                  )}`}
            </p>
          </>
        )}

        <p className="mt-2 text-xs text-ink-soft/80">
          Budgets only. Papic shots stay with the celebration that bought them and are never
          pooled.
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

                {/*
                  This celebration's own budget. A figure ONLY when we read one;
                  otherwise the words for which of the three absences it is.
                */}
                {(() => {
                  const b = budgetByEvent.get(row.event_id);
                  if (!b) return null;
                  const note = budgetStateNote(b.state);
                  return note === null ? (
                    <p className="shrink-0 text-right text-sm font-medium text-ink">
                      {formatPhp(b.targetPhp)}
                    </p>
                  ) : (
                    <p className="max-w-[9rem] shrink-0 text-right text-xs text-ink-soft">
                      {note}
                    </p>
                  );
                })()}
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
