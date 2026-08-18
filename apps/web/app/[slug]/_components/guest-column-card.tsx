import { eventWordsForEvent } from '../_lib/event-words';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import {
  type OwnGuestColumn,
  type GuestColumnStatus,
  type PublishedGuestColumn,
  bylineFor,
} from '@/lib/guest-columns';
import { guestColumnsActive } from '@/lib/guest-columns-gate';
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
 * Behind GUEST_COLUMNS_ENABLED (default OFF) AND the 'guest_columns' DPO
 * control (/admin/data-privacy) — renders nothing until both are on.
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
  if (!(await guestColumnsActive())) return null;

  const w = await eventWordsForEvent(eventId);

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
        .select('title, body_text, guest_id, author_named_publicly')
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
          author: bylineFor(r, nameOf),
        });
      }
    }
  } catch {
    // Pre-migration DB (42P01) or transient read failure → fail closed:
    // render nothing at all.
    return null;
  }

  return (
    /* Pahina (design 2026-07-25 §7): "The paper" is the most literally editorial
       surface on the site, so it drops the card shell entirely — an unnumbered
       eyebrow, a display-face masthead, and columns separated by hairlines with
       mono bylines. Moderation gating and the form below are untouched. */
    <section className="space-y-4">
      <p className="pahina-eyebrow">
        <span>Guest columns</span>
      </p>
      <h2 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
        The paper
      </h2>
      <p className="max-w-prose text-sm leading-relaxed text-ink/60">
        Short columns written by guests for {w.theOrganizerPossessive} paper.
        Write one — {w.theOrganizer} reads and approves every column before it
        appears.
      </p>

      {published.length > 0 ? (
        <div className="border-t border-ink/12 text-left">
          {published.map((col, i) => (
            <article key={i} className="border-b border-ink/12 py-4">
              <h3 className="font-pahina text-lg font-light italic leading-snug text-ink">
                {col.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{col.body}</p>
              {col.author ? (
                <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gild">
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
