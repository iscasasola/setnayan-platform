import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import {
  fetchUserCommunities,
  fetchSamahanSecondDegree,
  COMMUNITY_KIND_LABEL,
} from '@/lib/communities';
import { SubmitButton } from '@/app/_components/submit-button';
import { proposeSamahanConnection } from '../actions';

/**
 * Samahan on the People page (owner degree model 2026-07-17): the GROUPS you
 * belong to are FIRST degree — listed here beside your connections and alaga —
 * and the people INSIDE those samahans are your SECOND degree, shown beneath
 * with which samahan you share. Managing a samahan (roster, invites, roles)
 * stays on its own page under Spaces; this is the relational view, not a
 * second door.
 */
export async function SamahanPeopleSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  // 2°→1° upgrade (flag-gated): mark co-members I already have a pending or
  // confirmed edge with, so their chips carry no Connect affordance.
  const connectionsOn = peopleConnectionsEnabled();
  const knownUserIds = connectionsOn ? await fetchKnownConnectionUserIds(supabase, admin, user.id) : new Set<string>();
  const [communities, secondDegree] = await Promise.all([
    fetchUserCommunities(supabase, user.id),
    fetchSamahanSecondDegree(supabase, admin, user.id, knownUserIds),
  ]);
  const active = communities.filter((c) => !c.archived);

  return (
    <section className="mt-10">
      <header className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
          Samahan
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          The groups you belong to — barkada, parish, clan, org. The group itself is part of
          your first degree; the people inside it are your second.
        </p>
      </header>

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
                    {COMMUNITY_KIND_LABEL[c.kind]}
                    {c.role === 'organizer' ? ' · organizer' : ''}
                    {` · ${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
          No samahan yet.{' '}
          <Link href="/dashboard/samahan/new" className="font-medium underline underline-offset-2 hover:text-ink">
            Create one
          </Link>{' '}
          for your barkada, parish, or clan.
        </p>
      )}

      {secondDegree.length > 0 ? (
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink/40">
            Through your samahan — second degree
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {secondDegree.map((p) => (
              <li
                key={p.member_row_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 py-1 pl-3 pr-1.5 text-xs text-ink/70"
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
                      Connect
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
  const { data: me } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return known;

  const { data: edges } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null)
    .neq('status', 'declined');
  const otherPersonIds = [
    ...new Set(
      ((edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>).map((e) =>
        e.from_person_id === myPerson ? e.to_person_id : e.from_person_id,
      ),
    ),
  ];
  if (otherPersonIds.length === 0) return known;

  const { data: peopleRows } = await admin
    .from('people')
    .select('claimed_by_user_id')
    .in('person_id', otherPersonIds)
    .not('claimed_by_user_id', 'is', null);
  for (const r of (peopleRows ?? []) as Array<{ claimed_by_user_id: string | null }>) {
    if (r.claimed_by_user_id) known.add(r.claimed_by_user_id);
  }
  return known;
}
