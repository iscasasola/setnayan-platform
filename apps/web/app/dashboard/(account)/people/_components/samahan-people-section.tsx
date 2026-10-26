import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ChevronRight, Plus, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { fetchUserCommunities, fetchSamahanSecondDegree } from '@/lib/communities';
import { SubmitButton } from '@/app/_components/submit-button';
import { proposeSamahanConnection } from '../actions';
import { formatCount } from '@/lib/format-number';

/**
 * Samahan on the People page (owner degree model 2026-07-17): the GROUPS you
 * belong to are FIRST degree — listed here beside your connections and alaga —
 * and the people INSIDE those samahans are your SECOND degree, shown beneath
 * with which samahan you share. Managing a samahan (roster, invites, roles)
 * stays on its own page under Spaces; this is the relational view, not a
 * second door.
 */
export async function SamahanPeopleSection({
  heading = true,
}: {
  /** False in the Samahan VIEW, where the page's picker already names it
   *  (owner 2026-09-28, People redesign). The coming-soon preview keeps it. */
  heading?: boolean;
} = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  // 2°→1° upgrade (flag-gated): mark co-members I already have a pending or
  // confirmed edge with, so their chips carry no Add affordance.
  const connectionsOn = peopleConnectionsEnabled();
  const knownUserIds = connectionsOn ? await fetchKnownConnectionUserIds(supabase, admin, user.id) : new Set<string>();
  const [communities, secondDegree] = await Promise.all([
    fetchUserCommunities(supabase, user.id),
    fetchSamahanSecondDegree(supabase, admin, user.id, knownUserIds),
  ]);
  const active = communities.filter((c) => !c.archived);

  return (
    <section aria-label="Groups" className={heading ? 'mt-10' : undefined}>
      {heading ? (
        <header className="mb-3">
          {/* The People page's one heading style (the roster's rule). */}
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">
            Groups
          </h2>
        </header>
      ) : null}

      {active.length > 0 ? (
        <ul className="mb-4 space-y-2.5">
          {active.map((c) => (
            <li key={c.community_id}>
              <Link
                href={`/dashboard/samahan/${c.community_id}`}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.015] px-4 py-3 transition-colors hover:bg-ink/[0.04]"
              >
                <UsersRound aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="truncate text-xs text-ink/55">
                    {c.role === 'organizer' ? 'Organizer · ' : ''}
                    {`${formatCount(c.member_count)} ${c.member_count === 1 ? 'member' : 'members'}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
          No group yet.{' '}
          <Link href="/dashboard/samahan/new" className="font-medium underline underline-offset-2 hover:text-ink">
            Create one
          </Link>{' '}
          and name it whatever your group calls itself.
        </p>
      )}

      {secondDegree.length > 0 ? (
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55">
            Through your groups — second degree
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {secondDegree.map((p) => (
              <li
                key={p.member_row_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 dark:bg-raised py-1 pl-3 pr-1.5 text-xs text-ink/70"
              >
                <span>{p.display_name}</span>
                <span className="text-ink/40">· {p.via.join(', ')}</span>
                {connectionsOn && !p.known ? (
                  <form action={proposeSamahanConnection}>
                    <input type="hidden" name="member_row_id" value={p.member_row_id} />
                    <SubmitButton
                      className="rounded-full border border-ink/15 bg-cream px-2 py-0.5 text-[0.7rem] font-medium text-ink/70 transition-colors hover:bg-ink/5"
                      pendingLabel="…"
                    >
                      {/* "Add", never "Connect" — the same request the rest of
                          the page calls Add (owner 2026-09-28: one word per
                          concept). */}
                      Add
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * User ids the viewer already shares a live (pending or confirmed) edge with.
 * Edges are read with the USER client (person_connections RLS scopes to my
 * edges); the person→user resolution runs on the admin client because another
 * person's row is invisible under my RLS pre-connection — only the id mapping
 * is used, nothing is rendered from it.
 */
async function fetchKnownConnectionUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<Set<string>> {
  const known = new Set<string>();
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  // ⚠ the viewer's own person row. Absence DENIES rather than renders.
  if (meError) {
    logQueryError('SamahanPeopleSection.me', meError, {}, 'graceful_degrade');
  }
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return known;

  const { data: edges, error: edgesError } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null)
    .neq('status', 'declined');
  // ⚠ the connections themselves. Refused, everyone appears unrelated to everyone.
  if (edgesError) {
    logQueryError('SamahanPeopleSection.edges', edgesError, {}, 'graceful_degrade');
  }
  const otherPersonIds = [
    ...new Set(
      ((edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>).map((e) =>
        e.from_person_id === myPerson ? e.to_person_id : e.from_person_id,
      ),
    ),
  ];
  if (otherPersonIds.length === 0) return known;

  const { data: peopleRows, error: peopleRowsError } = await admin
    .from('people')
    .select('claimed_by_user_id')
    .in('person_id', otherPersonIds)
    .not('claimed_by_user_id', 'is', null);
  // ⚠ the people this person is connected to. Refused, their circle reads as empty.
  if (peopleRowsError) {
    logQueryError('SamahanPeopleSection.peopleRows', peopleRowsError, {}, 'graceful_degrade');
  }
  for (const r of (peopleRows ?? []) as Array<{ claimed_by_user_id: string | null }>) {
    if (r.claimed_by_user_id) known.add(r.claimed_by_user_id);
  }
  return known;
}

/** One group in the People list's Groups section — what the row needs, nothing more. */
export type GroupsFoldRow = {
  communityId: string;
  name: string;
  role: 'organizer' | 'member';
  /** null = not counted — never printed as "0 members". */
  memberCount: number | null;
};

/**
 * GROUPS ON THE PEOPLE LIST (owner 2026-10-25, "finding groups is so hard";
 * prototypes/groups_on_people_2026-10-25): a folded section of the main list, after Loved ones and drawn the same
 * way — "New group" at its head, then one row per group, each opening the group page. Presentational — the
 * server section below reads, `/dev/people-lab` hands in fixtures. The ≡ "Groups" view stays as it was.
 */
export function GroupsFoldList({ groups, unreadable = false }: { groups: GroupsFoldRow[]; unreadable?: boolean }) {
  return (
    <div className="pb-3" data-people-groups="">
      <div className="mb-2 mt-1" data-groups-door="">
        <Link href="/dashboard/samahan/new" className="button-secondary inline-flex min-h-11 items-center gap-2 text-sm">
          <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          New group
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="py-2 text-sm text-ink/60">
          {unreadable
            ? 'We couldn’t load your groups just now. Nothing is lost — refresh in a moment.'
            : 'No group yet — name it whatever your group calls itself.'}
        </p>
      ) : (
        <ul className="list-none">
          {groups.map((g) => (
            <li key={g.communityId}>
              <Link
                href={`/dashboard/samahan/${g.communityId}`}
                className="flex min-h-[60px] items-center gap-3 border-t border-ink/10 py-2.5 transition-colors hover:bg-ink/[0.03]"
                data-people-group-row=""
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/[0.14] text-[13px] font-semibold text-gold-deep"
                >
                  {groupInitials(g.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-ink">{g.name}</span>
                  <span className="block truncate text-[13px] text-ink/55">
                    {g.role === 'organizer' ? 'Organizer' : null}
                    {g.role === 'organizer' && g.memberCount !== null ? ' · ' : null}
                    {g.memberCount !== null
                      ? `${formatCount(g.memberCount)} ${g.memberCount === 1 ? 'member' : 'members'}`
                      : null}
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Team Payaman" → "TP"; one word → its first letter. */
function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const two = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0]?.[0] ?? 'G');
  return two.toUpperCase();
}

/**
 * The Groups section's reader. `fetchUserCommunities` returns `[]` when refused, which is the same `[]` as "no
 * groups" — so the roster's own count (`counts.samahan`, null when ITS read was refused) decides the sentence: a
 * list that came back empty while the count says otherwise is said as a failure, never as "No group yet".
 */
export async function GroupsFoldSection({ expected }: { expected: number | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const communities = await fetchUserCommunities(supabase, user.id);
  const groups: GroupsFoldRow[] = communities
    .filter((c) => !c.archived)
    .map((c) => ({
      communityId: c.community_id,
      name: c.name,
      role: c.role,
      // The list loader counts with a second read; a refused count leaves 0, which is never true for a group you
      // are in — so a 0 is "not counted", not a number.
      memberCount: c.member_count > 0 ? c.member_count : null,
    }));
  return <GroupsFoldList groups={groups} unreadable={groups.length === 0 && expected !== 0} />;
}
