import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { answerIncomingRequest, muteInviter } from '../incoming-request-actions';

/**
 * incoming-requests.tsx — "You are invited to {user name}'s {event name}
 * {event type} event." · YES · NO · "Don't show me invites from …".
 *
 * Owner 2026-09-28: "if they have an account. it must show on their event
 * page. as incoming requests" — at the TOP, only while one is waiting
 * (approved prototype: incoming-requests-delta.html, Part 1).
 *
 * 🔑 NOTHING HERE IS STORED. The list is `incoming_requests_for_me()`: a guest
 * row on somebody's list whose email is this account's confirmed email, still
 * unanswered, not yet linked, from a creator not muted or blocked. So an
 * account created LATER with that email sees it on first sign-in, and an
 * answered one is simply gone.
 *
 * 🔑 NO REQUESTS → NO SECTION. And a REFUSED read → no section either, never a
 * "you have no invitations" line: a denial and an empty list are the same
 * zero rows here, and the board states what it is for, never that you have
 * none (the launcher's own rule).
 */
export async function IncomingRequests({
  flash,
}: {
  flash: 'declined' | 'muted' | 'error' | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('incoming_requests_for_me');
  if (error) {
    logQueryError('IncomingRequests', error, {}, 'graceful_degrade');
    return flash ? <Flash kind={flash} /> : null;
  }
  const rows = (data ?? []) as Array<{
    guest_id: string;
    event_id: string;
    event_name: string | null;
    event_type: string | null;
    owner_user_id: string;
    owner_name: string | null;
  }>;
  if (rows.length === 0) return flash ? <Flash kind={flash} /> : null;

  // Who they will follow by saying yes — the event's co-hosts. Names only, and
  // only for events this person has already been invited to.
  const cohostNames = await cohostsFor(rows.map((r) => r.event_id));

  return (
    <section aria-labelledby="incoming-requests-title" className="mb-7" data-incoming-requests>
      {flash ? <Flash kind={flash} /> : null}
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2
          id="incoming-requests-title"
          className="text-sm font-extrabold tracking-tight text-ink sm:text-base sm:tracking-[-0.015em]"
        >
          Incoming requests
        </h2>
        <span className="text-xs text-[color:var(--sn-ink-400)]">{rows.length}</span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const owner = r.owner_name?.trim() || 'Someone';
          const ownerFirst = owner.split(/\s+/)[0] ?? owner;
          const kind = (r.event_type ?? '').replace(/_/g, ' ');
          const follows = cohostNames.get(r.event_id) ?? [];
          return (
            <li key={r.guest_id} className="rounded-2xl bg-white/80 px-4 py-4 shadow-[0_2px_10px_rgba(30,26,18,0.06)]">
              <p className="text-[15px] leading-snug text-ink">
                You are invited to {owner}&apos;s{' '}
                <b className="font-semibold">{r.event_name ?? 'event'}</b>
                {kind ? ` ${kind}` : ''} event.
              </p>
              <form action={answerIncomingRequest} className="mt-3 flex gap-2.5">
                <input type="hidden" name="guest_id" value={r.guest_id} />
                <button
                  type="submit"
                  name="answer"
                  value="yes"
                  className="h-11 flex-1 rounded-full bg-ink px-5 text-sm font-semibold text-cream"
                >
                  Yes
                </button>
                <button
                  type="submit"
                  name="answer"
                  value="no"
                  className="h-11 flex-1 rounded-full bg-ink/[0.06] px-5 text-sm font-medium text-ink/70"
                >
                  No
                </button>
              </form>
              {follows.length > 0 ? (
                // The follow line (owner 2026-09-28: accepted guests follow the
                // co-hosts) — said up front, so a follow is never a surprise.
                <p className="mt-2 text-xs text-ink/55">
                  Saying yes follows {joinNames(follows)} — you can unfollow any time.
                </p>
              ) : null}
              <form action={muteInviter} className="mt-1.5">
                <input type="hidden" name="inviter_user_id" value={r.owner_user_id} />
                <button type="submit" className="text-xs text-ink/45 underline-offset-2 hover:underline">
                  Don&apos;t show me invites from {ownerFirst}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Flash({ kind }: { kind: 'declined' | 'muted' | 'error' }) {
  const text =
    kind === 'declined'
      ? 'Got it — you said no.'
      : kind === 'muted'
        ? 'You won’t see invitations from them any more.'
        : 'That didn’t go through. Try again.';
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className="mb-3 text-sm text-ink/70">
      {text}
    </p>
  );
}

async function cohostsFor(eventIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (eventIds.length === 0) return out;
  const admin = createAdminClient();
  // Two plain reads: event_members.user_id points at auth.users, so there is no
  // foreign key to public.users for PostgREST to embed through.
  const { data: members, error } = await admin
    .from('event_members')
    .select('event_id, user_id')
    .in('event_id', eventIds)
    .eq('member_type', 'couple');
  if (error) {
    logQueryError('IncomingRequests.cohosts', error, {}, 'graceful_degrade');
    return out; // no follow line rather than a wrong one
  }
  const ids = [...new Set((members ?? []).map((m) => (m as { user_id: string }).user_id))];
  if (ids.length === 0) return out;
  const { data: people, error: namesError } = await admin
    .from('users')
    .select('user_id, display_name')
    .in('user_id', ids);
  if (namesError) {
    logQueryError('IncomingRequests.cohostNames', namesError, {}, 'graceful_degrade');
    return out;
  }
  const firstName = new Map<string, string>();
  for (const p of people ?? []) {
    const row = p as { user_id: string; display_name: string | null };
    const first = row.display_name?.trim().split(/\s+/)[0];
    if (first) firstName.set(row.user_id, first);
  }
  for (const m of members ?? []) {
    const row = m as { event_id: string; user_id: string };
    const first = firstName.get(row.user_id);
    if (!first) continue;
    out.set(row.event_id, [...(out.get(row.event_id) ?? []), first]);
  }
  return out;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
