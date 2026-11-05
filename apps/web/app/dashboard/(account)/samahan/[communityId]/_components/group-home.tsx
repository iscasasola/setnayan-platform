import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, MessageCircle, Plus, UserPlus } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import type { CommunityEventRow, CommunityRosterEntry, SamahanMessage } from '@/lib/communities';
import type { SamahanStory } from '@/lib/samahan-stories';
import type { EventWithRole } from '@/lib/events';
import { eventBoardHref, stanceClosedReason } from '@/lib/event-board';
import { eventTypeBadge } from '@/lib/event-vocabulary';
import { formatCount } from '@/lib/format-number';
import { relativeTimeShort } from '@/lib/notifications';
import { SamahanStories } from './samahan-stories';

export type EventMemberType = EventWithRole['member_type'];

/**
 * group-home.tsx — THE GROUP IS FOUR THINGS, ON ONE PAGE (owner 2026-10-26, verbatim: "Groups: We can bring in
 * people in the group and they share the same group where there is a place for chat, events and stories. that's
 * it"). Drawn from prototypes/group_samahan_2026-10-25 (corpus 0e658e05), frame "group-home-390":
 *
 *   the group's face (photo · name · one line) → MEMBERS (the row + "Bring people in") → EVENTS → STORIES → CHAT
 *
 * The tab bar it replaces (overview · usapan · members · events) is gone; the chat, the full members list and the
 * full events list are each ONE TAP IN, at the same `?tab=` addresses every redirect and notice already writes, so
 * no old link lands on a dead page. Nothing here is a new read except the Usapan preview (the newest message), which
 * the prototype marks Δ — `fetchSamahanMessages` already existed.
 *
 * Presentational ONLY — no database: `page.tsx` reads and hands the rows in, and `/dev/group-lab` hands in
 * fixtures, so the lab and the live page cannot drift apart. 🔒 group-is-four-things.test.ts holds the order.
 */

/** The home shows the first few events; the rest are one tap in (`?tab=events`). */
export const HOME_EVENT_ROWS = 3;

/** A section's quiet action, at the right of its title (the prototype's `.q`): 44 px tall, never a frame. */
export const QUIET_ACTION =
  '-mr-1.5 inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-[13px] font-semibold text-[color:var(--m-nav-active)] hover:opacity-80';

/** Title + one short line; the details live in the ⓘ (owner rule, 2026-10-23). */
export function GroupSectionHead({
  title,
  tip,
  line,
  action,
}: {
  title: string;
  tip: ReactNode;
  line: ReactNode;
  action?: ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-11 items-center gap-2">
        <InfoTip label={title} labelAs="h2" labelClassName="text-[17px] font-semibold text-ink" align="start">
          {tip}
        </InfoTip>
        <span className="flex-1" />
        {action}
      </div>
      <p className="mb-1.5 text-[13px] text-ink/60">{line}</p>
    </>
  );
}

export function GroupHome({
  header,
  base,
  communityId,
  isOrganizer,
  memberCount,
  roster,
  events,
  viewerMemberships,
  stories,
  storiesUnreadable,
  latestMessage,
}: {
  /** The group's face — `SamahanIdentityHeader` (photo + rename, edited where it is). */
  header: ReactNode;
  base: string;
  communityId: string;
  isOrganizer: boolean;
  /** null = the count was refused — never printed as a number the reader can disprove. */
  memberCount: number | null;
  roster: CommunityRosterEntry[];
  events: CommunityEventRow[];
  viewerMemberships: Map<string, EventMemberType>;
  stories: SamahanStory[];
  /** The stories read was REFUSED — the strip must not say "Nothing yet" (S41b). */
  storiesUnreadable: boolean;
  /** The newest Usapan message, or null (none, or not readable — the row then says neither). */
  latestMessage: SamahanMessage | null;
}) {
  const planHref = `/dashboard/create-event?samahan=${communityId}`;
  const shownEvents = events.slice(0, HOME_EVENT_ROWS);
  const chips = roster.slice(0, 3);
  const more = memberCount !== null && memberCount > chips.length && chips.length > 0 ? memberCount - chips.length : 0;

  return (
    <div data-group-home="">
      {header}

      {/* 1 · MEMBERS — who is in it, and the door to bring people in (the invite link + "Ask into a group"). The roster
          carries no photos (RA 10173), so the chips are initials. */}
      <div className="flex items-center gap-2" data-group-part="members">
        <Link
          href={`${base}?tab=members`}
          className="-mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1 hover:bg-ink/[0.04]"
        >
          {chips.length > 0 ? (
            <span className="flex shrink-0" aria-hidden>
              {chips.map((m, i) => (
                <span
                  key={m.member_row_id}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-cream bg-ink/10 text-[11px] font-semibold text-ink ${i > 0 ? '-ml-2' : ''}`}
                >
                  {m.display_name.trim().charAt(0).toUpperCase() || 'M'}
                </span>
              ))}
              {more > 0 ? (
                <span className="-ml-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-cream bg-ink/5 px-1 text-[10px] font-semibold text-ink/60">
                  +{formatCount(more)}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {memberCount === null
              ? 'Members not loaded'
              : `${formatCount(memberCount)} ${memberCount === 1 ? 'member' : 'members'}`}
            <small className="block truncate text-xs text-ink/50">
              {isOrganizer ? 'You’re an organizer' : 'You’re a member'}
            </small>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />
        </Link>
        {isOrganizer ? (
          <Link href={`${base}?tab=members#bring-in`} className={`${QUIET_ACTION} shrink-0`} data-bring-in="">
            <UserPlus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Bring people in
          </Link>
        ) : null}
      </div>

      {/* 2 · EVENTS — the same rows the Events list reads (events.community_id). */}
      <section className="mt-3 border-t border-ink/10 pt-2" data-group-part="events">
        <GroupSectionHead
          title="Events"
          tip="Events an organizer plans for this group. Open the ones you’re on; for the rest, ask an organizer to add you."
          line="What this group is going to."
          action={
            isOrganizer ? (
              <Link href={planHref} className={QUIET_ACTION}>
                <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Plan an event
              </Link>
            ) : null
          }
        />
        {events.length === 0 ? (
          <div className="py-2">
            <p className="text-sm font-semibold text-ink">Walang event pa.</p>
            <p className="text-[13px] text-ink/60">When an organizer plans a reunion or outing, it shows up here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5" role="list">
            {shownEvents.map((e) => (
              <GroupEventRow key={e.event_id} event={e} memberType={viewerMemberships.get(e.event_id) ?? null} />
            ))}
          </ul>
        )}
        {events.length > HOME_EVENT_ROWS ? (
          <Link href={`${base}?tab=events`} className={QUIET_ACTION}>
            See all {formatCount(events.length)} events
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </section>

      {/* 3 · STORIES — the ring row; the shipped camera and the day's player, unchanged underneath. */}
      <div className="mt-3 border-t border-ink/10 pt-2" data-group-part="stories">
        <SamahanStories communityId={communityId} stories={stories} unreadable={storiesUnreadable} />
      </div>

      {/* 4 · CHAT — Usapan one tap away, its newest message as the preview. */}
      <section className="mt-3 border-t border-ink/10 pt-2" data-group-part="chat">
        <GroupSectionHead
          title="Chatroom"
          tip="Usapan is the group’s own chat — everyone in the group reads it, and you can take your own messages down."
          line="Usapan — the group chat."
        />
        <Link
          href={`${base}?tab=usapan`}
          className="flex min-h-[60px] items-center gap-3 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 transition-colors hover:bg-ink/[0.03] dark:bg-raised" // no-card-ok: the whole row is the press into the chat
          data-group-chat-row=""
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
            <MessageCircle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Usapan</span>
            <span className="block truncate text-[13px] text-ink/60">
              {latestMessage ? (
                <>
                  <b className="font-semibold text-ink">{latestMessage.is_self ? 'You' : latestMessage.author_name}:</b>{' '}
                  {latestMessage.body}
                </>
              ) : (
                'Open the group chat'
              )}
            </span>
          </span>
          {latestMessage ? (
            <span className="shrink-0 self-start pt-1 text-xs text-ink/50">{relativeTimeShort(latestMessage.created_at)}</span>
          ) : null}
        </Link>
      </section>
    </div>
  );
}

/** "Dec 27, 2026" from a date-only value (tz-safe). */
function longDate(iso: string | null): string | null {
  const d = dateParts(iso);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
}

function dateParts(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * One event of the group — the home's first rows and the full Events list draw this same row.
 *
 * "Am I on this event?" was never the question — "where may I go?" is. This row used to link EVERY membership into
 * `/dashboard/[eventId]`, a shell that admits member_type='couple' only, so an invited person got a hover arrow
 * promising a door and a 404 behind it. eventBoardHref is the one place that answers this. A row you may not open
 * is dashed and says why (🔒 lib/guest-doors-are-not-dashboards.test.ts, SITE 3).
 */
export function GroupEventRow({ event: e, memberType }: { event: CommunityEventRow; memberType: EventMemberType | null }) {
  const href = memberType
    ? eventBoardHref({
        event_id: e.event_id,
        slug: e.slug,
        member_type: memberType,
      })
    : null;
  // An invited person with no page yet must NOT read "ask an organizer to add you" — they were added. Different
  // state, different sentence.
  const closedReason = memberType ? stanceClosedReason(memberType) : 'Ask an organizer to add you to this event.';
  const day = dateParts(e.event_date);
  const inner = (
    <>
      <span className="w-[46px] shrink-0 rounded-md bg-ink/[0.05] py-1.5 text-center" aria-hidden>
        {day ? (
          <>
            <b className="block text-[17px] font-semibold leading-none text-ink">{day.getDate()}</b>
            <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/50">
              {day.toLocaleDateString('en-US', { month: 'short' })}
            </small>
          </>
        ) : (
          <b className="block font-mono text-xs font-medium tracking-[0.06em] text-ink/60">TBD</b>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] ${href ? 'font-semibold text-ink' : 'font-medium text-ink/70'}`}>
          {e.display_name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink/55">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{eventTypeBadge(e.event_type)}</span>
          {' · '}
          {longDate(e.event_date) ?? 'Date to be set'}
          {!href ? ` · ${closedReason}` : ''}
        </span>
      </span>
      {href ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex min-h-[54px] items-center gap-3 rounded-xl border border-ink/10 bg-white/60 px-3 py-1.5 transition-colors hover:bg-ink/[0.03] dark:bg-raised" // no-card-ok: the whole row is the press into the event
        >
          {inner}
        </Link>
      ) : (
        <div className="flex min-h-[54px] items-center gap-3 rounded-xl border border-dashed border-ink/15 px-3 py-1.5" /* no-card-ok: dashed — a row you may not open, said in words */>
          {inner}
        </div>
      )}
    </li>
  );
}
