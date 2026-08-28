import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deletionReasonLabel } from '@/lib/event-deletion-reasons';
import { approveEventDeletion, rejectEventDeletion } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/event-deletions — celebrations a couple has asked us to remove.
 *
 * ─── WHAT LANDS HERE, AND WHAT DOES NOT ────────────────────────────────────
 * Only the ones money is holding. A couple removes an ordinary celebration
 * themselves and nothing reaches this queue — what reaches it is a bill we
 * confirmed, an official receipt, or a payment nobody has checked yet.
 *
 * The REASONS from ordinary removals land in the same table as `self_removed`
 * and are shown below the queue, because they are the only signal we will ever
 * get about why people leave and there is nowhere else to read them. They carry
 * no controls: there is nothing to answer.
 *
 * ⛔ NO ONE-CLICK APPROVE. `lib/admin/queue-peek.ts` states the rule this
 * follows: a fast button invites a wrong call at speed on exactly the queues
 * where being wrong costs most. Approving destroys a celebration's photographs
 * and ends paid services, so both answers take a typed note — and that note is
 * the body of the notice the couple receives, which is why it cannot be blank.
 */
export default async function EventDeletionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();

  /*
    🪤 READ ERRORS ARE NOT EMPTY QUEUES. A refused read and "nothing waiting"
    are the same shape from Supabase, and this console has already shipped a
    green tick over a failed one. `open === null` means we could not look.
  */
  const { data: openRows, error: openErr } = await admin
    .from('event_deletion_requests')
    .select('id, event_id, event_name, user_id, reason_code, reason, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const { data: recentRows } = await admin
    .from('event_deletion_requests')
    .select('id, event_name, reason_code, reason, status, created_at')
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(30);

  const open = openErr ? null : (openRows ?? []);
  const recent = recentRows ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Celebration removals</h1>
      <p className="mt-1 max-w-prose text-sm text-ink/70">
        A couple can remove their own celebration. They can’t when money has
        moved — a bill we confirmed, a receipt, or a payment nobody has checked
        yet. Those come here.
      </p>

      {open === null ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-[color:var(--sn-danger)] bg-[color:var(--sn-danger-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--sn-danger)]"
        >
          We couldn’t read this queue. That is not the same as it being empty —
          reload before assuming there is nothing here.
        </p>
      ) : open.length === 0 ? (
        <p className="mt-5 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2 text-sm text-ink/60">
          Nobody is waiting on an answer.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {open.map((r) => (
            <li
              key={r.id as string}
              className="rounded-xl border border-ink/15 bg-white p-4"
            >
              <p className="text-base font-bold text-ink">
                {r.event_name as string}
              </p>
              <p className="mt-0.5 text-[13px] text-ink/60">
                Asked {new Date(r.created_at as string).toLocaleString('en-PH')}
              </p>
              <p className="mt-2 text-sm text-ink">
                <span className="font-semibold">
                  {deletionReasonLabel(r.reason_code as string)}
                </span>
                {r.reason ? (
                  <span className="text-ink/70"> — “{r.reason as string}”</span>
                ) : null}
              </p>

              {/*
                🔑 THE TWO ANSWERS SHARE ONE NOTE FIELD ON PURPOSE. Whichever
                button is pressed, the couple receives that sentence — so the
                note is not admin bookkeeping, it is the reply. Two boxes would
                mean one of them is always the wrong one to have typed in.
              */}
              <form className="mt-3 grid gap-2">
                <input type="hidden" name="request_id" value={r.id as string} />
                <label className="block text-[13px] font-semibold text-ink/70">
                  What you did about the money — they read this
                  <textarea
                    name="admin_note"
                    required
                    rows={2}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg border border-ink/20 bg-cream px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-mulberry"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    formAction={approveEventDeletion}
                    className="rounded-full bg-[color:var(--sn-danger)] px-3 py-1.5 text-[13px] font-bold text-cream"
                  >
                    Remove it for good
                  </button>
                  <button
                    type="submit"
                    formAction={rejectEventDeletion}
                    className="rounded-full border border-ink/25 px-3 py-1.5 text-[13px] font-bold text-ink/80"
                  >
                    Keep it, and tell them why
                  </button>
                  <span className="text-[12px] text-ink/50">
                    Removing destroys its photos and ends what was paid for.
                  </span>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-base font-bold text-ink">Why people left</h2>
      <p className="mt-1 max-w-prose text-[13px] text-ink/60">
        Every removal, including the ones nobody had to answer. This is the only
        place these reasons exist.
      </p>
      {recent.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink/50">Nothing yet.</p>
      ) : (
        <ul className="mt-3 grid gap-1.5">
          {recent.map((r) => (
            <li
              key={r.id as string}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-[13px]"
            >
              <span className="font-semibold text-ink">
                {r.event_name as string}
              </span>
              <span className="text-ink/70">
                {deletionReasonLabel(r.reason_code as string)}
                {r.reason ? ` — “${r.reason as string}”` : ''}
              </span>
              <span className="text-ink/45">
                {r.status === 'self_removed'
                  ? 'removed by them'
                  : (r.status as string)}
                {' · '}
                {new Date(r.created_at as string).toLocaleDateString('en-PH')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
