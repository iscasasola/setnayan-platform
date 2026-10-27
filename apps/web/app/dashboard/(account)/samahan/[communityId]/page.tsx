import Link from 'next/link';
import { siteOrigin } from '@/lib/site-origin';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
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
  fetchSamahanMessages,
  fetchViewerEventMemberships,
  type CommunityEventRow,
  type CommunityRosterEntry,
  type SamahanMessage,
} from '@/lib/communities';
import { after } from 'next/server';
import {
  fetchSamahanStories,
  maybeRunSamahanStorySweep,
  type SamahanStory,
} from '@/lib/samahan-stories';
import { leaveCommunity, rotateInviteToken } from '../actions';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SamahanIdentityHeader } from './_components/samahan-identity-header';
import { MemberActionsMenu } from './_components/member-actions-menu';
import {
  GroupEventRow,
  GroupHome,
  GroupSectionHead,
  QUIET_ACTION,
  type EventMemberType,
} from './_components/group-home';
import { formatCount } from '@/lib/format-number';

export const metadata = {
  title: 'Group',
};

// The group page IS A CHATROOM (owner 2026-10-28: "groups should look like a chatroom with stories and events. all
// stories will run in a collage every hour" → "Groups chatroom approved"; prototypes/groups_chatroom_2026-10-28):
// ‹ People · the group + ⋯ · the Stories strip · the next event pinned · the chat (`GroupHome` → `GroupChatroom`).
// The lists that do not fit are ONE TAP IN from ⋯, at the `?tab=` addresses the old tabs used — every redirect in
// ../actions.ts, the Usapan notice (lib/samahan-notice-rules.ts) and the create-event back link already write them,
// so none of them lands on a dead page:
//   ?tab=usapan  → the group page (the chat IS the page now)
//   ?tab=members → the full list + Bring people in (#bring-in) + the group's photo and name
//   ?tab=events  → every event         ?tab=overview (or anything else) → the group page
// Membership gate: fetchCommunity returns null (RLS hides the row) → notFound().
//
// RA 10173 (plan §9): the members list renders display_name + role + join date ONLY — never email, never photo,
// never an auth UUID in the DOM; organizer action forms target the bigserial member_row_id.

const VIEWS = ['members', 'events'] as const;
type View = (typeof VIEWS)[number] | 'home';

const VIEW_TITLE: Record<Exclude<View, 'home'>, string> = {
  members: 'Members',
  events: 'Events',
};

const BACK =
  'mb-3 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md px-1 text-sm font-medium text-ink/70 hover:text-ink';

const ERROR_COPY: Record<string, string> = {
  last_organizer:
    'You are the last organizer. Promote someone first, or archive the group.',
  member_gone: 'That member is no longer on the roster.',
};

type SearchParams = Promise<{
  tab?: string;
  created?: string;
  rotated?: string;
  removed?: string;
  updated?: string;
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
  const view: View = (VIEWS as readonly string[]).includes(sp.tab ?? '')
    ? (sp.tab as View)
    : 'home';

  const user = await getCurrentUser();
  if (!user) return null; // parent layout redirects; type narrowing only

  const supabase = await createClient();
  const community = await fetchCommunity(supabase, communityId, user.id);
  // Null = non-member (RLS), bad id, or archived-and-hidden — all 404.
  if (!community || community.archived) notFound();

  const isOrganizer = community.role === 'organizer';
  const base = `/dashboard/samahan/${community.community_id}`;

  // Per-view data — the chatroom reads the events (pinned + cards), the stories (the strip + the hourly collage) and
  // Usapan; each one-tap view reads only its own list. `?tab=usapan` is not a view any more, so it opens the chatroom.
  const home = view === 'home';
  const [roster, events, viewerMemberships, inviteToken, stories, messages] = await Promise.all([
    view === 'members'
      ? fetchCommunityRoster(supabase, createAdminClient(), communityId, user.id)
      : Promise.resolve([] as CommunityRosterEntry[]),
    home || view === 'events'
      ? fetchCommunityEvents(supabase, communityId)
      : Promise.resolve([] as CommunityEventRow[]),
    home || view === 'events'
      ? fetchViewerEventMemberships(supabase, user.id)
      : Promise.resolve(new Map<string, EventMemberType>()),
    isOrganizer && view === 'members'
      ? fetchInviteToken(supabase, communityId)
      : Promise.resolve(null),
    home
      ? fetchSamahanStories(supabase, createAdminClient(), communityId, user.id)
      : Promise.resolve([] as SamahanStory[] | null),
    home
      ? fetchSamahanMessages(supabase, createAdminClient(), communityId, user.id)
      : Promise.resolve([] as SamahanMessage[] | null),
  ]);

  // Cron-free expiry sweep, fired from the surface whose audience visits —
  // stories expire by RLS the moment the clock passes; this reclaims bytes.
  after(() => maybeRunSamahanStorySweep());

  const rawError = sp.error ? decodeURIComponent(sp.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const successMessage =
    sp.created === '1'
      ? 'Set na ’yan. Share the invite link to bring people in.'
      : sp.joined === '1'
        ? `Welcome to ${community.name}!`
        : sp.already === '1'
          ? 'You’re already a member of this group.'
          : sp.rotated === '1'
            ? 'New invite link ready — the old link no longer works.'
            : sp.removed === '1'
              ? 'Member removed from the roster.'
              : sp.updated === '1'
                ? 'Set na ’yan — your group’s new look is saved.'
                : null;

  // The reader is BY DEFINITION a member of this group, so "0 members" is a number they can personally disprove.
  // When the count was refused, say nothing rather than a figure.
  const memberCount = community.member_count_measured === false ? null : community.member_count;

  const initial = community.name.trim().charAt(0).toUpperCase() || 'S';
  // Group photo (owner 2026-08-24): r2:// ref presigned server-side; a
  // legacy/absent value falls back to the initial chip unchanged.
  const photoDisplayUrl =
    home || view === 'members' ? await displayUrlForStoredAsset(community.photo_url) : null;

  const notice = (
    <>
      {successMessage ? (
        <p role="status" className="mt-2 text-sm text-ink/75">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-terracotta-700">
          {errorMessage}
        </p>
      ) : null}
    </>
  );

  if (home) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 lg:px-8">
        <GroupHome
          base={base}
          communityId={community.community_id}
          name={community.name}
          photoDisplayUrl={photoDisplayUrl}
          initial={initial}
          isOrganizer={isOrganizer}
          memberCount={memberCount}
          events={events}
          viewerMemberships={viewerMemberships}
          stories={stories ?? []}
          storiesUnreadable={stories === null}
          messages={messages ?? []}
          messagesUnreadable={messages === null}
          nowMs={Date.now()}
          notice={notice}
        />
      </div>
    );
  }

  let body: React.ReactNode;
  if (view === 'members') {
    body = (
      <>
        {/* The samahan's face, edited WHERE IT IS (owner 2026-08-24: "click on this image to upload photo? … taps the
            text to rename as well?") — at the top of Members since the chatroom (2026-10-28): anyone can rename the
            group or change its photo, and the line under the list says so. */}
        <div className="mb-3">
          <SamahanIdentityHeader
            communityId={community.community_id}
            name={community.name}
            photoUrl={community.photo_url}
            photoDisplayUrl={photoDisplayUrl}
            initial={initial}
            metaLine={
              community.description ? (
                <p className="mt-0.5 text-sm leading-snug text-ink/65">{community.description}</p>
              ) : null
            }
          />
        </div>
      <MembersTab
        communityId={community.community_id}
        publicId={community.public_id}
        isOrganizer={isOrganizer}
        memberCount={memberCount}
        roster={roster}
        inviteToken={inviteToken}
      />
      </>
    );
  } else {
    body = (
      <EventsTab
        communityId={community.community_id}
        events={events}
        isOrganizer={isOrganizer}
        viewerMemberships={viewerMemberships}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      {/* Back — a one-tap view returns to its group (the chatroom's own ‹ People returns to People › Groups). */}
      <Link href={base} className={BACK}>
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="truncate">{community.name}</span>
      </Link>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-ink">{VIEW_TITLE[view]}</h1>

      <div className="mb-3">{notice}</div>

      {body}
    </div>
  );
}

function MembersTab({
  communityId,
  publicId,
  isOrganizer,
  memberCount,
  roster,
  inviteToken,
}: {
  communityId: string;
  publicId: string;
  isOrganizer: boolean;
  memberCount: number | null;
  roster: CommunityRosterEntry[];
  inviteToken: string | null;
}) {
  // One resolver (lib/site-origin.ts). This chain omitted NEXT_PUBLIC_APP_URL,
  // so a preview deploy handed testers a PRODUCTION invite link.
  const inviteUrl = inviteToken ? `${siteOrigin()}/samahan/join/${inviteToken}` : null;

  return (
    <div>
      <p className="mb-2 text-[13px] text-ink/60">
        {memberCount === null
          ? 'Anyone in the group can rename it or change its photo.'
          : `${formatCount(memberCount)} ${memberCount === 1 ? 'member' : 'members'} · anyone can rename the group or change its photo.`}
      </p>
      <div className="divide-y divide-ink/10">
        {roster.map((m) => (
          <div key={m.member_row_id} className="flex min-h-[60px] items-center gap-3 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-sm font-semibold text-ink">
              {m.display_name.trim().charAt(0).toUpperCase() || 'M'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">
                {m.display_name}
                {m.is_self ? <span className="ml-1 text-xs font-normal text-ink/45">(you)</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">
                {m.role === 'organizer' ? (
                  <span className="font-semibold text-gold-deep">Organizer · </span>
                ) : null}
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
                    className="min-h-11 rounded-md px-2 text-[13px] font-medium text-ink/55 hover:text-terracotta-700"
                  >
                    Leave group
                  </SubmitButton>
                </form>
              ) : isOrganizer ? (
                <MemberActionsMenu
                  communityId={communityId}
                  memberRowId={m.member_row_id}
                  name={m.display_name}
                  role={m.role}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {isOrganizer ? (
        // BRING PEOPLE IN — both doors (the group page's "Bring people in" lands here). The invite link moved from
        // the old Organizer panel: it is about people. The second door is "Ask into a group" on a person's card on
        // People, which emails them this same link.
        <section id="bring-in" className="mt-5 scroll-mt-24 border-t border-ink/10 pt-2">
          <GroupSectionHead
            title="Bring people in"
            tip="Rotate it to kill a leaked link — the old one stops working immediately. Or open someone on People and pick “Ask into a group”: Setnayan emails them this link, and nothing happens until they open it."
            line="Anyone with this link can join."
            action={
              <form action={rotateInviteToken}>
                <input name="community_id" type="hidden" value={communityId} />
                <SubmitButton overlay={false} pendingLabel="Rotating…" className={QUIET_ACTION}>
                  <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Rotate link
                </SubmitButton>
              </form>
            }
          />
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate py-2.5 font-mono text-xs text-ink/70">{inviteUrl}</code>
              <CopyButton value={inviteUrl} label="Copy" />
            </div>
          ) : (
            <p className="text-sm text-ink/55">No active link — rotate to mint a fresh one.</p>
          )}
          <Link href="/dashboard/people" className={QUIET_ACTION}>
            Ask someone from People
          </Link>
        </section>
      ) : null}

      {/* Owner 2026-08-24: closing is not a button. The samahan ends when the last person leaves, so a sentence sits
          where the control was — silence here would read as an unfinished feature. */}
      <p className="mt-5 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/55">
        A group lives for as long as one person is still in it. It closes on its own when the last member leaves.
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">{publicId}</span>
      </p>
    </div>
  );
}

function EventsTab({
  communityId,
  events,
  isOrganizer,
  viewerMemberships,
}: {
  communityId: string;
  events: CommunityEventRow[];
  isOrganizer: boolean;
  viewerMemberships: Map<string, EventMemberType>;
}) {
  // Community event creation (plan §7 · PR-3): organizers only — the
  // create-event page and the server action both re-verify.
  const planHref = `/dashboard/create-event?samahan=${communityId}`;

  return (
    <div>
      <p className="mb-2 text-[13px] text-ink/60">What this group is going to.</p>
      {events.length === 0 ? (
        <div className="py-2">
          <p className="text-sm font-semibold text-ink">Walang event pa.</p>
          <p className="text-[13px] text-ink/60">When an organizer plans a reunion or outing, it shows up here.</p>
        </div>
      ) : (
        <ul className="space-y-1.5" role="list">
          {events.map((e) => (
            <GroupEventRow key={e.event_id} event={e} memberType={viewerMemberships.get(e.event_id) ?? null} />
          ))}
        </ul>
      )}
      {isOrganizer ? (
        <Link
          href={planHref}
          className="mt-1.5 flex min-h-[52px] items-center gap-3 rounded-xl border border-dashed border-ink/20 px-3 py-1.5 text-ink/70 hover:bg-ink/[0.03]" // no-card-ok: the whole row is the press into Plan an event
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/25">
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Plan an event</span>
            <span className="block truncate text-xs text-ink/55">
              A reunion, an outing, a tournament or a party — every member finds it here.
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
