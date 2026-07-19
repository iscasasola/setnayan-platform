import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Archive,
  CalendarDays,
  MessageCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  fetchCommunity,
  fetchCommunityEvents,
  fetchCommunityRoster,
  fetchInviteToken,
  fetchViewerEventIds,
  type CommunityEventRow,
  type CommunityRosterEntry,
} from '@/lib/communities';
import {
  archiveCommunity,
  demoteMember,
  leaveCommunity,
  promoteMember,
  removeMember,
  rotateInviteToken,
} from '../actions';

export const metadata = {
  title: 'Samahan',
};

// Samahan space page (plan §4b) — Overview · Members · Events as
// `?tab=` searchParams on ONE server page (real <Link> hrefs, back-button
// friendly, zero client state). Membership gate: fetchCommunity returns null
// (RLS hides the row) → notFound().
//
// RA 10173 (plan §9): the Members tab renders display_name + role + join date
// ONLY — never email, never photo, never an auth UUID in the DOM; organizer
// action forms target the bigserial member_row_id.

const TABS = ['overview', 'members', 'events'] as const;
type Tab = (typeof TABS)[number];

const ERROR_COPY: Record<string, string> = {
  last_organizer:
    'You are the last organizer. Promote someone first, or archive the samahan.',
  member_gone: 'That member is no longer on the roster.',
};

type SearchParams = Promise<{
  tab?: string;
  created?: string;
  rotated?: string;
  removed?: string;
  joined?: string;
  already?: string;
  confirm?: string;
  error?: string;
}>;

export default async function SamahanSpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: SearchParams;
}) {
  const { communityId } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '')
    ? (sp.tab as Tab)
    : 'overview';

  const user = await getCurrentUser();
  if (!user) return null; // parent layout redirects; type narrowing only

  const supabase = await createClient();
  const community = await fetchCommunity(supabase, communityId, user.id);
  // Null = non-member (RLS), bad id, or archived-and-hidden — all 404.
  if (!community || community.archived) notFound();

  const isOrganizer = community.role === 'organizer';
  const base = `/dashboard/samahan/${community.community_id}`;

  // Per-tab data — fetched only for the active tab (plus the header's event
  // count, which reuses the events fetch when the Events tab is active).
  const [roster, events, viewerEventIds, inviteToken] = await Promise.all([
    tab === 'members'
      ? fetchCommunityRoster(supabase, createAdminClient(), communityId, user.id)
      : Promise.resolve([] as CommunityRosterEntry[]),
    fetchCommunityEvents(supabase, communityId),
    tab === 'events'
      ? fetchViewerEventIds(supabase, user.id)
      : Promise.resolve(new Set<string>()),
    isOrganizer && tab === 'overview'
      ? fetchInviteToken(supabase, communityId)
      : Promise.resolve(null),
  ]);

  const initial = community.name.trim().charAt(0).toUpperCase() || 'S';
  const rawError = sp.error ? decodeURIComponent(sp.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const successMessage =
    sp.created === '1'
      ? 'Set na ’yan. Share the invite link to bring people in.'
      : sp.joined === '1'
        ? `Welcome to ${community.name}!`
        : sp.already === '1'
          ? 'You’re already a member of this samahan.'
          : sp.rotated === '1'
            ? 'New invite link ready — the old link no longer works.'
            : sp.removed === '1'
              ? 'Member removed from the roster.'
              : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/samahan"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Samahan
      </Link>

      {/* Header band — glass panel: initial chip w/ gold RING (jewelry, not
          paint), serif name + public_id in mono, member/event
          metaline. */}
      <div className="mb-6 rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mulberry/10 text-xl font-semibold text-mulberry ring-1 ring-terracotta-500">
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-sans text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {community.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="text-ink/45">{community.public_id}</span>
            </p>
          </div>
        </div>
        <p className="mt-3 font-mono text-xs text-ink/55">
          {community.member_count}{' '}
          {community.member_count === 1 ? 'member' : 'members'} · {events.length}{' '}
          {events.length === 1 ? 'event' : 'events'}
        </p>
      </div>

      {successMessage ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/75"
        >
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Tab bar — three text tabs; active = ink underline + gold accent dot. */}
      <nav aria-label="Samahan sections" className="mb-6 flex gap-6 border-b border-ink/10">
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Link
              key={t}
              aria-current={active ? 'page' : undefined}
              href={t === 'overview' ? base : `${base}?tab=${t}`}
              className={`relative -mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm capitalize transition-colors ${
                active
                  ? 'border-ink font-semibold text-ink'
                  : 'border-transparent text-ink/50 hover:text-ink/80'
              }`}
            >
              {active ? (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-terracotta-500"
                />
              ) : null}
              {t}
            </Link>
          );
        })}
      </nav>

      {tab === 'overview' ? (
        <OverviewTab
          base={base}
          confirmArchive={sp.confirm === 'archive'}
          communityId={community.community_id}
          description={community.description}
          eventCount={events.length}
          inviteToken={inviteToken}
          isOrganizer={isOrganizer}
          memberCount={community.member_count}
        />
      ) : tab === 'members' ? (
        <MembersTab
          communityId={community.community_id}
          isOrganizer={isOrganizer}
          roster={roster}
        />
      ) : (
        <EventsTab
          communityId={community.community_id}
          events={events}
          isOrganizer={isOrganizer}
          viewerEventIds={viewerEventIds}
        />
      )}
    </div>
  );
}

function OverviewTab({
  base,
  communityId,
  confirmArchive,
  description,
  eventCount,
  inviteToken,
  isOrganizer,
  memberCount,
}: {
  base: string;
  communityId: string;
  confirmArchive: boolean;
  description: string | null;
  eventCount: number;
  inviteToken: string | null;
  isOrganizer: boolean;
  memberCount: number;
}) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://www.setnayan.com';
  const inviteUrl = inviteToken ? `${siteUrl}/samahan/join/${inviteToken}` : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
        {description ? (
          <p className="text-sm leading-relaxed text-ink/75">{description}</p>
        ) : (
          <p className="text-sm text-ink/45">
            No description yet — organizers can add one.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink/10 bg-cream p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Members
            </p>
            <p className="mt-1 font-mono text-2xl text-ink">{memberCount}</p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-cream p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
              Events
            </p>
            <p className="mt-1 font-mono text-2xl text-ink">{eventCount}</p>
          </div>
        </div>
        {/* Honest note — chat is deferred to the 0019 reuse (plan §1). A note,
            never a button. */}
        <p className="mt-4 flex items-center gap-2 text-xs text-ink/45">
          <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Usapan — group chat is coming soon.
        </p>
      </div>

      {isOrganizer ? (
        <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
            Organizer panel
          </p>

          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-ink">Invite link</p>
            {inviteUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-ink/10 bg-cream px-3 py-2 font-mono text-xs text-ink/70">
                  {inviteUrl}
                </code>
                <CopyButton value={inviteUrl} label="Copy" />
              </div>
            ) : (
              <p className="text-sm text-ink/55">
                No active link — rotate to mint a fresh one.
              </p>
            )}
            <p className="text-xs text-ink/50">
              Anyone with this link can join. Rotate it to kill a leaked link —
              the old one stops working immediately.
            </p>
            <form action={rotateInviteToken}>
              <input name="community_id" type="hidden" value={communityId} />
              <SubmitButton
                overlay={false}
                pendingLabel="Rotating…"
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-ink/5"
              >
                <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Rotate link
              </SubmitButton>
            </form>
          </div>

          <div aria-hidden className="my-4 h-px bg-ink/10" />

          {confirmArchive ? (
            <div className="space-y-3 rounded-xl border border-terracotta/25 bg-terracotta/[0.05] p-4">
              <p className="text-sm font-medium text-ink">
                Archive this samahan?
              </p>
              <p className="text-xs leading-relaxed text-ink/60">
                Members keep their accounts and events — the samahan just goes
                quiet.
              </p>
              <div className="flex items-center gap-2">
                <form action={archiveCommunity}>
                  <input name="community_id" type="hidden" value={communityId} />
                  <SubmitButton
                    pendingLabel="Archiving…"
                    className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-xs font-medium text-cream transition hover:bg-mulberry-600"
                  >
                    <Archive aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Yes, archive it
                  </SubmitButton>
                </form>
                <Link
                  href={base}
                  className="rounded-md px-3 py-2 text-xs font-medium text-ink/60 hover:text-ink"
                >
                  Cancel
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href={`${base}?confirm=archive`}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              <Archive aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Archive samahan
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MembersTab({
  communityId,
  isOrganizer,
  roster,
}: {
  communityId: string;
  isOrganizer: boolean;
  roster: CommunityRosterEntry[];
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
      <div className="divide-y divide-ink/5">
        {roster.map((m) => (
          <div key={m.member_row_id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-sm font-semibold text-mulberry">
              {m.display_name.trim().charAt(0).toUpperCase() || 'M'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">
                  {m.display_name}
                  {m.is_self ? (
                    <span className="ml-1 text-xs text-ink/45">(you)</span>
                  ) : null}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                    m.role === 'organizer'
                      ? 'border-terracotta-500/40 text-terracotta-600'
                      : 'border-ink/10 text-ink/50'
                  }`}
                >
                  {m.role}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-ink/45">
                Joined{' '}
                {new Date(m.joined_at).toLocaleDateString('en-PH', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {m.is_self ? (
                <form action={leaveCommunity}>
                  <input name="community_id" type="hidden" value={communityId} />
                  <SubmitButton
                    overlay={false}
                    pendingLabel="Leaving…"
                    className="rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:text-terracotta-700"
                  >
                    Leave samahan
                  </SubmitButton>
                </form>
              ) : isOrganizer ? (
                <>
                  {m.role === 'member' ? (
                    <form action={promoteMember}>
                      <input name="community_id" type="hidden" value={communityId} />
                      <input name="member_row_id" type="hidden" value={m.member_row_id} />
                      <SubmitButton
                        overlay={false}
                        pendingLabel="…"
                        className="rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:text-ink"
                      >
                        Promote
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={demoteMember}>
                      <input name="community_id" type="hidden" value={communityId} />
                      <input name="member_row_id" type="hidden" value={m.member_row_id} />
                      <SubmitButton
                        overlay={false}
                        pendingLabel="…"
                        className="rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:text-ink"
                      >
                        Demote
                      </SubmitButton>
                    </form>
                  )}
                  <form action={removeMember}>
                    <input name="community_id" type="hidden" value={communityId} />
                    <input name="member_row_id" type="hidden" value={m.member_row_id} />
                    <SubmitButton
                      overlay={false}
                      pendingLabel="…"
                      className="rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:text-terracotta-700"
                    >
                      Remove
                    </SubmitButton>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** event_type → short badge (launcher idiom, kept in lockstep with
 *  eventTypeBadge in (launcher)/page.tsx — module-private there). */
const EVENT_TYPE_BADGE: Record<string, string> = {
  anniversary: 'ANIBERSARYO',
};

function eventTypeBadge(type: string): string {
  return (
    EVENT_TYPE_BADGE[type] ??
    type.split(/[_\s]+/).filter(Boolean).join(' ').toUpperCase()
  );
}

/** Short "Mon D" date (launcher idiom; tz-safe, date-only). */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

function EventsTab({
  communityId,
  events,
  isOrganizer,
  viewerEventIds,
}: {
  communityId: string;
  events: CommunityEventRow[];
  isOrganizer: boolean;
  viewerEventIds: Set<string>;
}) {
  // Community event creation (plan §7 · PR-3): organizers only — the
  // create-event page and the server action both re-verify.
  const planHref = `/dashboard/create-event?samahan=${communityId}`;

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/60 p-8 text-center shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
        <CalendarDays
          aria-hidden
          className="mx-auto h-8 w-8 text-ink/35"
          strokeWidth={1.75}
        />
        <p className="mt-4 text-sm font-semibold text-ink">Walang event pa.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
          When an organizer plans a reunion or outing, it shows up here.
        </p>
        {isOrganizer ? (
          <Link
            href={planHref}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Plan an event
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
      {isOrganizer ? (
        <div className="mb-2 flex justify-end">
          <Link
            href={planHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-ink/5"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Plan an event
          </Link>
        </div>
      ) : null}
      <div className="divide-y divide-ink/5">
        {events.map((e) => {
          const isMember = viewerEventIds.has(e.event_id);
          const inner = (
            <>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="shrink-0 rounded-full border border-ink/10 bg-cream px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                    {eventTypeBadge(e.event_type)}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">
                    {e.display_name}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink/45">
                  {shortDate(e.event_date) ?? 'Date to be set'}
                  {!isMember ? ' · Ask an organizer to add you to this event.' : ''}
                </span>
              </span>
              {isMember ? (
                <ArrowUpRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              ) : null}
            </>
          );
          return isMember ? (
            <Link
              key={e.event_id}
              href={`/dashboard/${e.event_id}`}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/70"
            >
              {inner}
            </Link>
          ) : (
            <div key={e.event_id} className="-mx-2 flex items-center gap-3 px-2 py-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
