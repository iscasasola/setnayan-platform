import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UserCheck, UserPlus, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, SIDE_LABELS, type GuestRole } from '@/lib/guests';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { unlinkedCandidates } from '@/lib/unlisted-guests';
import { LinkPicker } from './link-picker';
import { SubmitButton } from '@/app/_components/submit-button';
import { logQueryError } from '@/lib/supabase/error-detect';
import { keepGuestAction, removeGuestAction, linkGuestAction } from './actions';

export const metadata = { title: 'Unlisted guests' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

type UnlistedRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  role: GuestRole;
  created_at: string;
};

export default async function UnlistedGuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { error: actionError } = await searchParams;

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
  //
  // ⚠ THE SENTENCE BELOW THIS READ IS "Nobody to review right now." Supabase
  // ⚠ RESOLVES with { error } rather than throwing, so a refused read arrives as
  // ⚠ `data: null`, `?? []` turns it into an empty list, and that sentence is
  // ⚠ printed to a couple who has people waiting — who then never get kept or
  // ⚠ removed, because the couple was told there was nobody. Bind the error and
  // ⚠ gate the claim on whether the read actually happened.
  const { data: rowsRaw, error: rowsError } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, display_name, email, role, created_at')
    .eq('event_id', eventId)
    .eq('entry_source', 'self_added_unlisted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (rowsError) {
    logQueryError(
      'UnlistedGuestsPage.unlisted',
      rowsError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const unlistedMeasured = !rowsError && rowsRaw !== null;
  const rows = (rowsRaw ?? []) as UnlistedRow[];

  // Existing list members the couple can merge an unlisted joiner INTO (the
  // "this is actually <name> under a different spelling" case). Host-seeded,
  // non-deleted, name-ordered. Only fetched when there's something to reconcile.
  type Candidate = { guest_id: string; first_name: string; last_name: string; display_name: string | null };
  let candidates: Candidate[] = [];
  // A refused read here hides the "Same as <someone already on your list>"
  // merge form entirely, which reads as "there is nobody to merge them into" —
  // so the couple keeps a duplicate instead of linking it. Measured separately
  // from the list above: one can be refused while the other is not.
  let candidatesMeasured = true;
  if (rows.length > 0) {
    const { data: candRaw, error: candError } = await supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .eq('event_id', eventId)
      .eq('entry_source', 'host_seeded')
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .limit(500);
    if (candError) {
      logQueryError(
        'UnlistedGuestsPage.mergeCandidates',
        candError,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    candidatesMeasured = !candError && candRaw !== null;
    candidates = (candRaw ?? []) as Candidate[];

    /*
      ⚖ Owner 2026-09-21: "this should only show accounts that are not yet
      linked". A guest an account already signed in as IS that person; the Link
      action refuses to bind a second account to them, so offering them only
      produced an error. Read with the admin client — the couple's own session
      may not see other people's memberships — AFTER the couple check above.
      A refused read hides the Link form rather than offering linked guests.
    */
    const { data: boundRaw, error: boundError } = await createAdminClient()
      .from('event_members')
      .select('guest_id')
      .eq('event_id', eventId)
      .not('guest_id', 'is', null);
    if (boundError) {
      logQueryError('UnlistedGuestsPage.linked', boundError, { event_id: eventId }, 'graceful_degrade');
      candidatesMeasured = false;
      candidates = [];
    } else {
      candidates = unlinkedCandidates(
        candidates,
        new Set((boundRaw ?? []).map((m) => m.guest_id as string)),
      );
    }
  }

  // The Keep form's choices — what THIS event offers (the action re-checks).
  const [{ offeredRoles }, { data: groupsRaw }] = rows.length > 0
    ? await Promise.all([
        resolveRoleSetForEvent(eventId),
        supabase.from('guest_groups').select('group_id, label, team_side').eq('event_id', eventId).order('label'),
      ])
    : [{ offeredRoles: [] as GuestRole[] }, { data: [] }];
  const roleChoices = offeredRoles.filter((r) => r !== 'bride' && r !== 'groom');
  const groupChoices = (groupsRaw ?? []) as { group_id: string; label: string; team_side: string }[];

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

      {actionError ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger-200 bg-danger-50/70 px-3 py-2 text-sm text-danger-900">
          {actionError}
        </p>
      ) : null}

      {!unlistedMeasured ? (
        <p
          role="alert"
          className="mt-10 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">
            We couldn&rsquo;t load who joined through your link.
          </strong>{' '}
          This does not mean nobody did. Nobody has been added or removed &mdash;
          reload in a moment and they will be here.
        </p>
      ) : rows.length === 0 ? (
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
                  {/* ⚖ Owner 2026-09-21: "allow manual add to list where you
                      can choose their role, group, side, and name". Keep opens
                      the form, prefilled with what they typed on joining. */}
                  <details className="group/keep w-full">
                    <summary className="button-primary inline-flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                      <UserCheck className="h-4 w-4" /> Keep on my list
                    </summary>
                    <form action={keepGuestAction.bind(null, eventId)} className="mt-3 grid gap-3 rounded-lg border border-ink/10 bg-cream/60 p-3 sm:grid-cols-2">
                      <input type="hidden" name="guest_id" value={g.guest_id} />
                      <label className="space-y-1 text-sm">
                        <span className="text-ink/70">First name</span>
                        <input name="first_name" required defaultValue={splitName(name).first} className="input-field h-9 w-full py-1" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-ink/70">Last name</span>
                        <input name="last_name" defaultValue={splitName(name).last} className="input-field h-9 w-full py-1" />
                      </label>
                      <fieldset className="space-y-1 text-sm sm:col-span-2">
                        <legend className="text-ink/70">Side</legend>
                        <span className="flex flex-wrap gap-2">
                          {(['bride', 'groom', 'both'] as const).map((s) => (
                            <label key={s} className="cursor-pointer rounded-lg border border-ink/15 px-3 py-1.5 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5 has-[:checked]:font-medium">
                              <input type="radio" name="side" value={s} required defaultChecked={s === 'both'} className="sr-only" />
                              {SIDE_LABELS[s]}
                            </label>
                          ))}
                        </span>
                      </fieldset>
                      <label className="space-y-1 text-sm">
                        <span className="text-ink/70">Role</span>
                        <select name="role" defaultValue="guest" className="input-field h-9 w-full py-1">
                          {roleChoices.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-ink/70">Group</span>
                        <select name="group_id" defaultValue="" className="input-field h-9 w-full py-1">
                          <option value="">No group</option>
                          {groupChoices.map((gr) => (
                            <option key={gr.group_id} value={gr.group_id}>
                              {gr.label}
                              {gr.team_side === 'bride' ? ' · Bride’s' : gr.team_side === 'groom' ? ' · Groom’s' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="sm:col-span-2">
                        <SubmitButton className="button-primary inline-flex items-center gap-1.5" pendingLabel="Adding…">
                          <UserCheck className="h-4 w-4" /> Add to my list
                        </SubmitButton>
                      </div>
                    </form>
                  </details>

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
                    <LinkPicker candidates={candidates} />
                    <SubmitButton className="button-secondary text-sm" pendingLabel="Linking…">
                      Link
                    </SubmitButton>
                  </form>
                ) : !candidatesMeasured ? (
                  <p className="mt-3 border-t border-ink/5 pt-3 text-sm text-ink/55">
                    We couldn&rsquo;t load your guest list just now, so we
                    can&rsquo;t offer to link this person to someone already on
                    it. Reload in a moment.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Shey" → first "Shey"; "Julian Gerolaga" → "Julian" + "Gerolaga". */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}
