import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, X, LayoutGrid, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  computeGuestStats,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEvent,
  type GuestGroupWithCount,
  type GuestRow,
  type GuestStats,
  type RsvpStatus,
} from '@/lib/guests';
import { filterByRoleGroup, ROLE_GROUP_LABELS } from '@/lib/role-groups';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { GuestListMultiselect } from './_components/guest-list-multiselect';
import { GroupsSidebar } from './_components/groups-sidebar';

export const metadata = { title: 'Guests' };

const SORT_OPTIONS = [
  { value: 'last_name', label: 'Last name (A–Z)' },
  { value: 'first_name', label: 'First name (A–Z)' },
  { value: 'rsvp', label: 'RSVP status' },
  { value: 'role', label: 'Role' },
  { value: 'newest', label: 'Newest first' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const VIEW_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All guests' },
  { key: 'wedding_party', label: ROLE_GROUP_LABELS.wedding_party },
  { key: 'principal_sponsors', label: ROLE_GROUP_LABELS.principal_sponsors },
  { key: 'secondary_sponsors', label: ROLE_GROUP_LABELS.secondary_sponsors },
  { key: 'bearers_flower_girl', label: ROLE_GROUP_LABELS.bearers_flower_girl },
  { key: 'officiants', label: ROLE_GROUP_LABELS.officiants },
  { key: 'family', label: 'Family' },
  { key: 'friends', label: 'Friends' },
  { key: 'work', label: 'Work' },
  { key: 'school', label: 'School' },
];

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    q?: string;
    rsvp?: string;
    view?: string;
    tag?: string;
    sort?: string;
    added?: string;
    saved?: string;
    removed?: string;
    imported?: string;
    skipped?: string;
    error?: string;
    bulk_assigned?: string;
    bulk_grouped?: string;
    group_created?: string;
    group_saved?: string;
    group_deleted?: string;
    group_member_removed?: string;
  }>;
};

export default async function GuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [guests, eventRow, groups, membershipsMap] = await Promise.all([
    fetchGuestsByEvent(supabase, eventId),
    supabase
      .from('events')
      .select('role_palette')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestGroupsByEvent(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
  ]);
  const palette: RolePalette = sanitizeRolePalette(eventRow.data?.role_palette ?? {});

  const q = (search.q ?? '').trim().toLowerCase();
  const rsvpFilter = (search.rsvp ?? '') as RsvpStatus | '';
  const view = search.view ?? 'all';
  const tagFilter = (search.tag ?? '').trim();
  const sort = (search.sort ?? 'last_name') as SortKey;

  // Custom-group view detection — view param is "group:<group_id>"
  // when the host has clicked a custom group in the sidebar.
  const currentGroupId =
    view.startsWith('group:') ? view.slice('group:'.length) : null;
  const groupMemberSet = currentGroupId
    ? new Set(
        Array.from(membershipsMap.entries())
          .filter(([, gids]) => gids.includes(currentGroupId))
          .map(([gid]) => gid),
      )
    : null;

  let visible = guests.filter((g) => {
    if (rsvpFilter && g.rsvp_status !== rsvpFilter) return false;
    if (tagFilter && !g.custom_tags.includes(tagFilter)) return false;
    if (groupMemberSet && !groupMemberSet.has(g.guest_id)) return false;
    if (q) {
      const haystack = `${g.first_name} ${g.last_name} ${g.display_name ?? ''} ${g.email ?? ''} ${g.custom_tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  // The role-group sidebar only filters when view is one of the
  // canonical role groups — custom-group views ("group:<uuid>") skip
  // this step because the groupMemberSet filter above already narrowed
  // the list to the group's members.
  if (!currentGroupId) {
    visible = filterByRoleGroup(visible, view);
  }
  visible.sort((a, b) => sortCompare(a, b, sort));

  // Convert the Map<guest_id, group_id[]> to a plain object so it
  // serializes cleanly across the server/client component boundary.
  const groupMemberships: Record<string, string[]> = Object.fromEntries(
    membershipsMap.entries(),
  );

  const stats = computeGuestStats(guests);
  const allTags = uniqueTags(guests);
  const joinUrl = await fetchJoinUrl(supabase, eventId);
  const flash = pickFlash(search);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Guest list
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {stats.total} {stats.total === 1 ? 'guest' : 'guests'}
          </h1>
        </div>
        <div className="hidden flex-col gap-2 self-start sm:flex sm:flex-row sm:self-auto">
          <Link
            href={`/dashboard/${eventId}/guests/import`}
            className="button-secondary"
          >
            Import CSV
          </Link>
          <Link
            href={`/dashboard/${eventId}/guests/quick`}
            className="button-secondary"
          >
            Quick add list
          </Link>
          <Link
            href={`/dashboard/${eventId}/guests/new`}
            className="button-primary"
          >
            + Add guest
          </Link>
        </div>
      </header>

      {flash ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flash}
        </p>
      ) : null}

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}

      <StatsStrip stats={stats} eventId={eventId} active={rsvpFilter} />

      <Link
        href={`/dashboard/${eventId}/seating`}
        className="group inline-flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink">Seating chart</span>
            <span className="text-xs text-ink/55">
              Tables, floor plan, who sits where
            </span>
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
          strokeWidth={1.75}
        />
      </Link>

      {joinUrl ? <ShareInvite joinUrl={joinUrl} /> : null}

      <Toolbar eventId={eventId} q={q} sort={sort} search={search} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <FacetsSidebar
          eventId={eventId}
          view={view}
          tagFilter={tagFilter}
          tags={allTags}
          search={search}
          groups={groups}
          currentGroupId={currentGroupId}
        />

        <div className="min-w-0 space-y-4">
          {visible.length === 0 ? (
            <EmptyState hasGuests={stats.total > 0} eventId={eventId} />
          ) : (
            <GuestListMultiselect
              eventId={eventId}
              guests={visible}
              palette={palette}
              groups={groups}
              groupMemberships={groupMemberships}
              currentGroupId={currentGroupId}
            />
          )}
        </div>
      </div>

      <MobileFab eventId={eventId} />
    </section>
  );
}

function sortCompare(a: GuestRow, b: GuestRow, sort: SortKey): number {
  const rsvpRank: Record<RsvpStatus, number> = {
    attending: 0,
    pending: 1,
    maybe: 2,
    declined: 3,
  };
  switch (sort) {
    case 'first_name':
      return a.first_name.localeCompare(b.first_name);
    case 'rsvp':
      return rsvpRank[a.rsvp_status] - rsvpRank[b.rsvp_status];
    case 'role':
      return a.role.localeCompare(b.role);
    case 'newest':
      return b.created_at.localeCompare(a.created_at);
    case 'last_name':
    default:
      return (
        a.last_name.localeCompare(b.last_name) ||
        a.first_name.localeCompare(b.first_name)
      );
  }
}

function uniqueTags(guests: GuestRow[]): string[] {
  const set = new Set<string>();
  for (const g of guests) for (const t of g.custom_tags) set.add(t);
  return Array.from(set).sort();
}

async function fetchJoinUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('event_join_tokens')
    .select('token')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!data?.token) return null;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  return `${appUrl}/join/${eventId}?token=${data.token}`;
}

function pickFlash(search: {
  added?: string;
  saved?: string;
  removed?: string;
  imported?: string;
  skipped?: string;
  bulk_assigned?: string;
  bulk_grouped?: string;
  group_created?: string;
  group_saved?: string;
  group_deleted?: string;
  group_member_removed?: string;
}): string | null {
  if (search.added) {
    const n = Number(search.added);
    if (Number.isFinite(n) && n > 1) return `Added ${n} guests.`;
    return 'Guest added.';
  }
  if (search.saved) return 'Saved.';
  if (search.removed) return 'Guest removed.';
  if (search.imported) {
    const n = Number(search.imported);
    const s = Number(search.skipped ?? 0);
    if (s > 0)
      return `Imported ${n} guest${n === 1 ? '' : 's'} · skipped ${s} invalid row${s === 1 ? '' : 's'}.`;
    return `Imported ${n} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_assigned) {
    const n = Number(search.bulk_assigned);
    return `Role assigned to ${n} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_grouped) {
    const n = Number(search.bulk_grouped);
    return `Added ${n} guest${n === 1 ? '' : 's'} to the group.`;
  }
  if (search.group_created) return 'Group created.';
  if (search.group_saved) return 'Group saved.';
  if (search.group_deleted) return 'Group deleted.';
  if (search.group_member_removed) return 'Removed from group.';
  return null;
}

function StatsStrip({
  stats,
  eventId,
  active,
}: {
  stats: GuestStats;
  eventId: string;
  active: RsvpStatus | '';
}) {
  const cards: {
    key: RsvpStatus | 'plus_ones' | 'total';
    label: string;
    count: number;
    tint: string;
  }[] = [
    { key: 'total', label: 'Invited', count: stats.total, tint: 'bg-ink/5 text-ink' },
    { key: 'attending', label: 'Attending', count: stats.attending, tint: 'bg-emerald-100 text-emerald-800' },
    { key: 'pending', label: 'Pending', count: stats.pending, tint: 'bg-amber-100 text-amber-800' },
    { key: 'declined', label: 'Declined', count: stats.declined, tint: 'bg-rose-100 text-rose-800' },
    { key: 'plus_ones', label: 'Plus-ones', count: stats.plus_ones, tint: 'bg-terracotta/10 text-terracotta-700' },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const href =
          card.key === 'total' || card.key === 'plus_ones'
            ? `/dashboard/${eventId}/guests`
            : `/dashboard/${eventId}/guests?rsvp=${card.key}`;
        const isActive = (card.key === 'total' && !active) || card.key === active;
        return (
          <li key={card.key}>
            <Link
              href={href}
              className={`flex flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-terracotta bg-terracotta/5'
                  : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                {card.label}
              </span>
              <span
                className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-base font-semibold ${card.tint}`}
              >
                {card.count}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ShareInvite({ joinUrl }: { joinUrl: string }) {
  return (
    <details className="rounded-lg border border-ink/10 bg-cream">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        <span className="inline-flex select-none items-center gap-2 text-ink">
          <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Share invite link
        </span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
          anyone with the link can sign up and join
        </span>
      </summary>
      <div className="border-t border-ink/10 p-4">
        <p className="mb-2 text-xs text-ink/60">
          Send this to guests via text or email. They&rsquo;ll sign in, pick a role, and
          land on the guest list.
        </p>
        <code className="block break-all rounded bg-ink/5 p-3 font-mono text-[11px] leading-relaxed text-ink/80">
          {joinUrl}
        </code>
      </div>
    </details>
  );
}

function Toolbar({
  eventId,
  q,
  sort,
  search,
}: {
  eventId: string;
  q: string;
  sort: SortKey;
  search: { rsvp?: string; view?: string; tag?: string };
}) {
  return (
    <form
      action={`/dashboard/${eventId}/guests`}
      method="get"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input
        defaultValue={q}
        name="q"
        type="search"
        placeholder="Search by name, email, or tag…"
        className="input-field flex-1"
      />
      {search.rsvp ? <input type="hidden" name="rsvp" value={search.rsvp} /> : null}
      {search.view ? <input type="hidden" name="view" value={search.view} /> : null}
      {search.tag ? <input type="hidden" name="tag" value={search.tag} /> : null}
      <select
        name="sort"
        defaultValue={sort}
        className="input-field appearance-none bg-cream pr-8 sm:w-56"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            Sort: {o.label}
          </option>
        ))}
      </select>
      <button className="button-secondary" type="submit">
        Apply
      </button>
    </form>
  );
}

function FacetsSidebar({
  eventId,
  view,
  tagFilter,
  tags,
  search,
  groups,
  currentGroupId,
}: {
  eventId: string;
  view: string;
  tagFilter: string;
  tags: string[];
  search: { q?: string; rsvp?: string; sort?: string };
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
}) {
  const baseQuery = new URLSearchParams();
  if (search.q) baseQuery.set('q', search.q);
  if (search.rsvp) baseQuery.set('rsvp', search.rsvp);
  if (search.sort) baseQuery.set('sort', search.sort);

  const buildHref = (overrides: Record<string, string | null>) => {
    const q = new URLSearchParams(baseQuery);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) q.delete(key);
      else q.set(key, value);
    }
    const qs = q.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  // The locked role-group view is "active" only when the host is on
  // one of those keys — custom-group views (view === "group:<uuid>")
  // should leave the role-group strip in neutral state.
  const activeRoleView = currentGroupId ? '' : view;

  return (
    <aside className="hidden space-y-6 self-start lg:sticky lg:top-24 lg:block">
      <FacetGroup label="View">
        <ul className="space-y-1">
          {VIEW_FILTERS.map((v) => (
            <li key={v.key}>
              <Link
                href={buildHref({ view: v.key === 'all' ? null : v.key })}
                className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeRoleView === v.key
                    ? 'bg-terracotta/10 font-medium text-terracotta-700'
                    : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </FacetGroup>

      <GroupsSidebar
        eventId={eventId}
        groups={groups}
        currentGroupId={currentGroupId}
        buildHref={buildHref}
      />

      {tags.length > 0 ? (
        <FacetGroup label="Custom tags">
          <ul className="flex flex-wrap gap-2">
            {tagFilter ? (
              <li>
                <Link
                  href={buildHref({ tag: null })}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-xs text-ink/70 hover:bg-ink/10"
                >
                  <X aria-hidden className="h-3 w-3" strokeWidth={2} />
                  Clear
                </Link>
              </li>
            ) : null}
            {tags.map((t) => (
              <li key={t}>
                <Link
                  href={buildHref({ tag: t })}
                  className={`rounded-full px-2 py-1 text-xs ${
                    tagFilter === t
                      ? 'bg-terracotta text-cream'
                      : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                  }`}
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </h3>
      {children}
    </section>
  );
}

function EmptyState({ hasGuests, eventId }: { hasGuests: boolean; eventId: string }) {
  if (hasGuests) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-cream p-6 text-center text-ink/60">
        No guests match your filters.
        <div className="mt-3">
          <Link href={`/dashboard/${eventId}/guests`} className="button-secondary">
            Clear filters
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center">
      <p className="text-base text-ink/70">
        No guests yet. Start by adding the couple&rsquo;s first invite.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/guests/new`} className="button-primary">
          + Add your first guest
        </Link>
      </div>
    </div>
  );
}

function MobileFab({ eventId }: { eventId: string }) {
  return (
    <div className="fixed bottom-20 right-4 z-30 sm:hidden">
      <Link
        href={`/dashboard/${eventId}/guests/new`}
        aria-label="Add guest"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-2xl font-light text-cream shadow-lg shadow-terracotta/30 hover:bg-terracotta-600"
      >
        +
      </Link>
    </div>
  );
}

