import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import type { CommunityEventRow, SamahanMessage } from '@/lib/communities';
import type { SamahanStory } from '@/lib/samahan-stories';
import type { EventWithRole } from '@/lib/events';
import { eventBoardHref, eventStance, manilaTodayISO, stanceClosedReason } from '@/lib/event-board';
import { eventTypeBadge } from '@/lib/event-vocabulary';
import { nextGroupEvent, type ChatEvent } from '@/lib/samahan-chatroom';
import { GroupChatroom, type EventDoor } from './group-chatroom';

export type EventMemberType = EventWithRole['member_type'];

/**
 * group-home.tsx — the group page's parts.
 *
 * 💬 FROM 2026-10-28 THE GROUP IS A CHATROOM (owner, verbatim: *"groups should look like a chatroom with stories and
 * events. all stories will run in a collage every hour"* → *"Groups chatroom approved. Send it to the build screen"*;
 * DECISION_LOG "GROUPS AS A CHATROOM"; prototypes/groups_chatroom_2026-10-28, baseline group_samahan_2026-10-25).
 * `GroupHome` is no longer four stacked sections (members · events · stories · a "Chatroom · Usapan" row you tapped
 * into) — Usapan IS the page (`GroupChatroom`): ‹ People · the group + ⋯ · the Stories strip · the next event pinned ·
 * the chat with the message bar at the thumb. Where each of the four went:
 *
 *   members row + "Bring people in" → ⋯ › Members · ⋯ › Bring people in (the same `?tab=members` / `#bring-in`)
 *   events (first three + "See all") → the next one pinned · a card in the chat per new event · ⋯ › All events
 *   "Plan an event"                  → ＋ › Plan an event (organizers)
 *   stories                          → the same strip, rings only; 📷 in the message bar opens its camera
 *   the chat row                     → the chat itself
 *   the group's photo + rename       → ⋯ › Members, at the top (anyone can rename — the line there says so)
 *
 * This file stays SERVER-SAFE (no 'use client'): `page.tsx` imports `QUIET_ACTION` (a string) and the shared rows for
 * the one-tap views, and a string exported from a client module reaches a server component as a reference, not a
 * string. `GroupHome` decides each event's door here (`eventBoardHref`) and hands plain rows to the client chatroom.
 *
 * Presentational ONLY — no database: `page.tsx` reads and hands the rows in, and `/dev/group-lab` hands in
 * fixtures, so the lab and the live page cannot drift apart. 🔒 group-is-a-chatroom.test.ts.
 */

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

/** Where an event may send this viewer — the same answer the shared row gives (`eventBoardHref`). */
export function eventDoor(e: CommunityEventRow, memberType: EventMemberType | null): EventDoor {
  const href = memberType ? eventBoardHref({ event_id: e.event_id, slug: e.slug, member_type: memberType }) : null;
  return {
    href,
    reason: href ? null : memberType ? stanceClosedReason(memberType) : 'Ask an organizer to add you to this event.',
    invited: memberType ? eventStance(memberType) === 'invited' : false,
  };
}

export function GroupHome({
  base,
  communityId,
  name,
  photoDisplayUrl,
  initial,
  isOrganizer,
  memberCount,
  events,
  viewerMemberships,
  stories,
  storiesUnreadable,
  messages,
  messagesUnreadable,
  nowMs,
  notice,
}: {
  base: string;
  communityId: string;
  name: string;
  photoDisplayUrl: string | null;
  initial: string;
  isOrganizer: boolean;
  /** null = the count was refused — never printed as a number the reader can disprove. */
  memberCount: number | null;
  events: ChatEvent[];
  viewerMemberships: Map<string, EventMemberType>;
  stories: SamahanStory[];
  /** The stories read was REFUSED — the strip must not say "Nothing yet" (S41b). */
  storiesUnreadable: boolean;
  /** Usapan, oldest first. */
  messages: SamahanMessage[];
  /** The Usapan read was REFUSED — the chat must not read as a quiet group. */
  messagesUnreadable: boolean;
  /** The render's clock (ms) — the hourly collage is derived from it. */
  nowMs: number;
  notice?: ReactNode;
}) {
  const doors: Record<string, EventDoor> = {};
  for (const e of events) doors[e.event_id] = eventDoor(e, viewerMemberships.get(e.event_id) ?? null);
  const pinned = nextGroupEvent(events, manilaTodayISO(new Date(nowMs)));
  return (
    <div data-group-home="">
      <GroupChatroom
        base={base}
        communityId={communityId}
        name={name}
        photoDisplayUrl={photoDisplayUrl}
        initial={initial}
        isOrganizer={isOrganizer}
        memberCount={memberCount}
        eventCount={events.length}
        events={events}
        doors={doors}
        pinned={pinned}
        stories={stories}
        storiesUnreadable={storiesUnreadable}
        messages={messages}
        messagesUnreadable={messagesUnreadable}
        nowMs={nowMs}
        notice={notice}
      />
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
