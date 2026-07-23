import { createAdminClient } from '@/lib/supabase/admin';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import {
  guestColumnsEnabled,
  type OwnGuestColumn,
  type GuestColumnStatus,
  type PublishedGuestColumn,
} from '@/lib/guest-columns';
import { GuestColumnForm } from './guest-column-form';

/**
 * Guest Columns — the Story-section card on the guest (cookie-holding) site
 * (OnTheDay BUILD ① · studies doc § 1.4). Two halves:
 *
 *   1. "The Paper" — the approved columns, read fail-closed exactly like the
 *      editorial Kwento canon (status='approved' AND moderation_state='clean'
 *      AND author not hidden), bylines resolved from `guests`. Rendered to
 *      guests only — this card mounts on the guest-session tree, so approved
 *      columns never reach the anonymous public tier pre-editorial (the
 *      RA 10173-conservative default; the post-event editorial section is the
 *      couple-published surface).
 *   2. The submit/edit form (client) — compose · pending+edit · declined+
 *      resubmit · approved+withdraw states, with the editorial-phase
 *      close-state mirrored from getLifecyclePhase (the server-side cutoff
 *      lives in the guest_submit_column RPC; this is the courtesy mirror).
 *
 * Behind GUEST_COLUMNS_ENABLED (default OFF) — renders nothing until the
 * owner flips the flag.
 */
export async function GuestColumnCard({
  eventId,
  guestId,
  eventDate,
}: {
  eventId: string;
  guestId: string;
  eventDate: string | null;
}) {
  if (!guestColumnsEnabled()) return null;

  const closed = getLifecyclePhase(eventDate) === 'editorial';
  const admin = createAdminClient();

  // The guest's own column (any status — drives the form state). A withdrawn
  // row renders as "no column" (the revive path reuses the same slot).
  let own: OwnGuestColumn | null = null;
  // Approved columns for "The Paper" — fail-closed (editorial-read canon).
  const published: PublishedGuestColumn[] = [];
  try {
    const [{ data: mine }, { data: approved }] = await Promise.all([
      admin
        .from('guest_columns')
        .select('title, body_text, status, decline_note, edit_count')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .maybeSingle(),
      admin
        .from('guest_columns')
        .select('title, body_text, guest_id')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .eq('moderation_state', 'clean')
        .eq('author_publicly_hidden', false)
        .order('submitted_at', { ascending: true })
        .limit(12),
    ]);

    if (mine && mine.status !== 'user_deleted') {
      own = {
        title: (mine.title as string) ?? '',
        body: (mine.body_text as string) ?? '',
        status: mine.status as GuestColumnStatus,
        declineNote: (mine.decline_note as string | null) ?? null,
        editCount: (mine.edit_count as number) ?? 0,
      };
    }

    const rows = (approved ?? []) as Array<{
      title: string;
      body_text: string;
      guest_id: string;
    }>;
    if (rows.length > 0) {
      // Bylines in one read (the editorial data.ts guest-name pattern).
      const guestIds = [...new Set(rows.map((r) => r.guest_id))];
      const nameOf = new Map<string, string>();
      try {
        const { data: guests } = await admin
          .from('guests')
          .select('guest_id, display_name, first_name, last_name')
          .in('guest_id', guestIds);
        for (const g of (guests ?? []) as Array<{
          guest_id: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>) {
          const name =
            g.display_name?.trim() ||
            `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim();
          if (name) nameOf.set(g.guest_id, name);
        }
      } catch {
        // no bylines → columns render unattributed
      }
      for (const r of rows) {
        published.push({
          title: r.title,
          body: r.body_text,
          author: nameOf.get(r.guest_id) ?? null,
        });
      }
    }
  } catch {
    // Pre-migration DB (42P01) or transient read failure → fail closed:
    // render nothing at all.
    return null;
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-6 shadow-sm sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Guest columns
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">The paper</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-ink/60">
        Short columns written by guests for the couple&rsquo;s paper. Write one —
        the couple reads and approves every column before it appears.
      </p>

      {published.length > 0 ? (
        <div className="mt-6 space-y-4 text-left">
          {published.map((col, i) => (
            <article key={i} className="rounded-xl border border-ink/10 bg-white/60 p-4">
              <h3 className="font-display text-lg font-medium italic text-ink">{col.title}</h3>
              <p className="mt-1.5 text-sm text-ink/80">{col.body}</p>
              {col.author ? (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">
                  — {col.author}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <GuestColumnForm own={own} closed={closed} />
      </div>
    </section>
  );
}
