import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, HeartHandshake, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchUserCommunities,
  type CommunityWithRole,
} from '@/lib/communities';

export const metadata = {
  title: 'Samahan',
};

// Samahan index — "Your samahans" (plan §4a). Chrome-less (account) spoke:
// slim top bar from the group layout, own Back-to-home pill + container.
// DARK until PR-4 links it from the launcher's Spaces tile.

const BANNER_COPY: Record<string, string> = {
  left: 'You left the samahan.',
  archived: 'The samahan was archived. Members keep their accounts and events.',
};

export default async function SamahanIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string; archived?: string }>;
}) {
  const user = await getCurrentUser();
  // The parent dashboard layout already redirects signed-out users; this is
  // for type narrowing (launcher precedent).
  if (!user) return null;
  const supabase = await createClient();
  const communities = await fetchUserCommunities(supabase, user.id);

  const sp = await searchParams;
  const banner = sp.left === '1' ? BANNER_COPY.left : sp.archived === '1' ? BANNER_COPY.archived : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="sn-chip sn-press mb-4 w-fit">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to home
      </Link>
      <header className="mb-6 space-y-2">
        <p className="sn-eye">
          <HeartHandshake aria-hidden strokeWidth={1.75} />
          Your shared spaces
        </p>
        <h1 className="sn-h1">Samahan</h1>
        <p className="text-base text-ink/65">
          Shared spaces for the groups you belong to — barkada, parish, clan, org.
        </p>
      </header>

      {banner ? (
        <p role="status" className="sn-row mb-6 px-4 py-3 text-sm text-ink/70">
          {banner}
        </p>
      ) : null}

      {communities.length === 0 ? (
        <div className="sn-tile p-8 text-center">
          <HeartHandshake
            aria-hidden
            className="mx-auto h-8 w-8 text-ink/35"
            strokeWidth={1.75}
          />
          <p className="mt-4 text-sm font-semibold text-ink">
            Wala ka pang samahan.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
            One shared space for your barkada, parish, or clan — their reunions,
            tournaments, and outings all in one place.
          </p>
          <Link
            href="/dashboard/samahan/new"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Create a Samahan
          </Link>
        </div>
      ) : (
        <div className="sn-tile p-5">
          <div className="divide-y divide-ink/5">
            {communities.map((c) => (
              <CommunityRow key={c.community_id} community={c} />
            ))}
          </div>
          <div aria-hidden className="my-2 h-px bg-ink/10" />
          <Link
            href="/dashboard/samahan/new"
            className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-ink/20 text-ink/45">
              <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium text-ink/70 group-hover:text-ink">
              Create a Samahan
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

/** One samahan row — the launcher SpaceRow idiom (initial chip · name
 *  badge · role + member count metaline · jump arrow). */
function CommunityRow({ community }: { community: CommunityWithRole }) {
  const initial = community.name.trim().charAt(0).toUpperCase() || 'S';
  const roleLabel = community.role === 'organizer' ? 'Organizer' : 'Member';
  return (
    <Link
      href={`/dashboard/samahan/${community.community_id}`}
      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/70"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-base font-semibold text-mulberry">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-ink">
            {community.name}
          </span>
        </span>
        <span className="mt-0.5 block font-mono text-xs text-ink/55">
          {roleLabel} · {community.member_count}{' '}
          {community.member_count === 1 ? 'member' : 'members'}
        </span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  );
}
