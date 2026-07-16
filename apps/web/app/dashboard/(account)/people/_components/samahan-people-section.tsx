import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchUserCommunities,
  fetchSamahanSecondDegree,
  COMMUNITY_KIND_LABEL,
} from '@/lib/communities';

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
  const [communities, secondDegree] = await Promise.all([
    fetchUserCommunities(supabase, user.id),
    fetchSamahanSecondDegree(supabase, admin, user.id),
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
                key={`${p.display_name}·${p.via.join('·')}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-xs text-ink/70"
              >
                <span>{p.display_name}</span>
                <span className="text-ink/40">· {p.via.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
