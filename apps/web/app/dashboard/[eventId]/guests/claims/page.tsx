import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UserCheck, UserPlus, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { SubmitButton } from '@/app/_components/submit-button';
import { keepGuestAction, removeGuestAction, linkGuestAction } from './actions';

export const metadata = { title: 'Unlisted guests' };

type Props = { params: Promise<{ eventId: string }> };

type UnlistedRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  role: GuestRole;
  created_at: string;
};

export default async function UnlistedGuestsPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Couple-only surface.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  // Invite/Join v2 (0000 ADDENDUM 2026-06-25): people who joined via the invite
  // link but whose name didn't match the list. They're already added — this is
  // where the couple keeps or removes them.
  const { data: rowsRaw } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, email, role, created_at')
    .eq('event_id', eventId)
    .eq('entry_source', 'self_added_unlisted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const rows = (rowsRaw ?? []) as UnlistedRow[];

  // Existing list members the couple can merge an unlisted joiner INTO (the
  // "this is actually <name> under a different spelling" case). Host-seeded,
  // non-deleted, name-ordered. Only fetched when there's something to reconcile.
  type Candidate = { guest_id: string; first_name: string; last_name: string; display_name: string | null };
  let candidates: Candidate[] = [];
  if (rows.length > 0) {
    const { data: candRaw } = await supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .eq('event_id', eventId)
      .eq('entry_source', 'host_seeded')
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .limit(500);
    candidates = (candRaw ?? []) as Candidate[];
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to guest list
      </Link>

      <header className="mt-3 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <UserPlus className="h-6 w-6 text-terracotta" /> Unlisted guests
        </h1>
        <p className="text-sm text-ink/60">
          These people joined through your invite link but weren&rsquo;t on your list — a
          forgotten guest, a plus-one, or a typo. They&rsquo;re already added; keep the ones
          who belong, remove the ones who don&rsquo;t.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-ink/10 bg-ink/[0.02] p-8 text-center">
          <p className="text-sm text-ink/60">Nobody to review right now.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((g) => {
            const name = (g.display_name?.trim() || `${g.first_name} ${g.last_name}`).trim();
            return (
              <li key={g.guest_id} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{name}</p>
                    <p className="text-sm text-ink/60">
                      {g.email ?? 'no email on file'} · joined as {ROLE_LABELS[g.role ?? 'guest']}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-warn-100 px-2.5 py-1 text-xs font-medium text-warn-900">
                    not on your list
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={keepGuestAction.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={g.guest_id} />
                    <SubmitButton className="button-primary inline-flex items-center gap-1.5" pendingLabel="Keeping…">
                      <UserCheck className="h-4 w-4" /> Keep on my list
                    </SubmitButton>
                  </form>

                  <form action={removeGuestAction.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={g.guest_id} />
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-sm text-ink/50 hover:bg-ink/5 hover:text-ink"
                    >
                      Remove
                    </button>
                  </form>
                </div>

                {/* LINK: this joiner is actually someone already on the list. */}
                {candidates.length > 0 ? (
                  <form
                    action={linkGuestAction.bind(null, eventId)}
                    className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-3"
                  >
                    <input type="hidden" name="guest_id" value={g.guest_id} />
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink/55">
                      <Link2 className="h-4 w-4" /> Same as
                    </span>
                    <select
                      name="target_guest_id"
                      required
                      defaultValue=""
                      aria-label="Link to an existing guest"
                      className="input-field h-9 flex-1 py-1 text-sm sm:flex-none"
                    >
                      <option value="" disabled>
                        Choose a guest on your list…
                      </option>
                      {candidates.map((c) => (
                        <option key={c.guest_id} value={c.guest_id}>
                          {(c.display_name?.trim() || `${c.first_name} ${c.last_name}`).trim()}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="button-secondary text-sm" pendingLabel="Linking…">
                      Link
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
