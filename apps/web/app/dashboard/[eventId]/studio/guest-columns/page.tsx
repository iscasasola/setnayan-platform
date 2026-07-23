import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Newspaper } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestColumnsActive } from '@/lib/guest-columns-gate';
import { ColumnQueueControls, type ColumnRow } from './_components/column-queue-controls';

export const metadata = { title: 'Guest columns · Studio · Setnayan' };
export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/studio/guest-columns — the Guest Columns review queue
 * (OnTheDay BUILD ① · studies doc § 1). Kwento-queue clone for the couple's
 * paper: every guest column shows here immediately (pending + flagged first);
 * Approve publishes it (guest site + the post-event editorial), Decline
 * RETURNS it to the guest with an optional note (owner rule).
 *
 * Access: couple OR coordinator — deliberately matching the
 * guest_columns_moderate RLS policy (member_type IN ('couple','coordinator'))
 * rather than the kwento surface's stricter couple-only `requireCouple` app
 * gate; the study (§ 1.2) flagged that divergence as a live inconsistency and
 * for columns the RLS is the authority. The reads below use the admin client
 * AFTER this membership gate (the kwento-queue precedent); the approve/decline
 * actions ride the RLS via the reviewer's own session.
 *
 * Behind GUEST_COLUMNS_ENABLED (default OFF) AND the 'guest_columns' DPO
 * control (/admin/data-privacy, fail-closed) — 404s until both are on.
 */
export default async function GuestColumnsQueuePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  if (!(await guestColumnsActive())) notFound();

  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  const admin = createAdminClient();
  const { data: columns } = await admin
    .from('guest_columns')
    .select(
      'column_id, guest_id, title, body_text, status, moderation_state, moderation_labels, decline_note, submitted_at, edited_at',
    )
    .eq('event_id', eventId)
    .order('submitted_at', { ascending: false })
    .limit(100);

  const rawRows = columns ?? [];

  // Author names in one read (kwento-queue pattern).
  const guestIds = [...new Set(rawRows.map((r) => r.guest_id as string))];
  const nameOf = new Map<string, string>();
  if (guestIds.length > 0) {
    const { data: guests } = await admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .in('guest_id', guestIds);
    for (const g of (guests ?? []) as Array<{
      guest_id: string;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
    }>) {
      nameOf.set(
        g.guest_id,
        g.display_name || `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || 'A guest',
      );
    }
  }

  const rows: ColumnRow[] = rawRows.map((r) => ({
    columnId: r.column_id as string,
    title: r.title as string,
    body: r.body_text as string,
    author: nameOf.get(r.guest_id as string) ?? 'A guest',
    status: r.status as ColumnRow['status'],
    moderation: r.moderation_state as ColumnRow['moderation'],
    labels: ((r.moderation_labels as { labels?: string[] } | null)?.labels ?? []) as string[],
    declineNote: (r.decline_note as string | null) ?? null,
    edited: Boolean(r.edited_at),
    submittedAt: r.submitted_at as string,
  }));

  // Pending + flagged first — the review-queue ordering (kwento precedent).
  rows.sort((a, b) => {
    const weight = (x: ColumnRow) =>
      x.status === 'pending' ? (x.moderation === 'flagged' ? 0 : 1) : 2;
    return weight(a) - weight(b);
  });

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href={`/dashboard/${eventId}/website`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} /> Back to your page
      </Link>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <h1 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Newspaper aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
          Guest columns — the paper
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Short columns your guests wrote for your paper. Approve to publish on your
          page (and in your editorial after the day); return one to its writer with a
          note if it needs another pass. Held columns stay hidden until you decide.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-cream/40 p-4 text-sm text-ink/50">
            No columns yet — when a guest writes one from their invitation page, it
            lands here for your review.
          </p>
        ) : (
          <>
            {pendingCount > 0 ? (
              <p className="mt-2 text-xs font-medium text-terracotta">
                {pendingCount} awaiting your review
              </p>
            ) : null}
            <ColumnQueueControls eventId={eventId} rows={rows} />
          </>
        )}
      </section>
    </div>
  );
}
