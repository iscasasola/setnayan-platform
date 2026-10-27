'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  Bell,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { Sheet } from '@/app/_components/sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import { followColumn } from '@/app/dashboard/[eventId]/guests/_components/dock-follows-column';
import { eventTypeBadge } from '@/lib/event-vocabulary';
import { formatCount } from '@/lib/format-number';
import { PEOPLE_GROUPS_HREF } from '@/lib/people-views';
import {
  chatTimeline,
  hourlyCollages,
  type ChatEvent,
  type ChatItem,
} from '@/lib/samahan-chatroom';
import type { SamahanMessage } from '@/lib/communities';
import type { SamahanStory } from '@/lib/samahan-stories';
import { deleteSamahanMessage, leaveCommunity, postSamahanMessage } from '../../actions';
import { SamahanStories, type StoriesControl } from './samahan-stories';
import { CollagePlayer, GroupCollage } from './group-collage';

/**
 * group-chatroom.tsx — 💬 THE GROUP IS A CHATROOM (owner 2026-10-28, verbatim: *"groups should look like a chatroom
 * with stories and events. all stories will run in a collage every hour"* → *"Groups chatroom approved. Send it to the
 * build screen"*). Drawn from prototypes/groups_chatroom_2026-10-28 (baseline prototypes/group_samahan_2026-10-25):
 *
 *   ‹ People · the group's name + member count · ⋯      (⋯ = Members · All events · Bring people in · Notifications · Leave)
 *   the shipped Stories strip                          (one clip an hour, gone after 24 hours — unchanged)
 *   the next event, pinned, with Going?
 *   the chat (Usapan)                                   (messages · a card per new event · the hourly collage)
 *   ＋ · Message the group · 📷                          (the thumb row)
 *
 * Usapan stopped being a row you tap into: it IS the page. The three lists that did not fit (members, every event,
 * the invite link) are the shipped `?tab=` views, one tap in from ⋯.
 *
 * Presentational over rows handed in — `page.tsx` reads, `/dev/group-lab` hands in fixtures, so the two cannot drift.
 * 🔒 group-is-a-chatroom.test.ts holds the order and the doors; lib/samahan-chatroom.test.ts holds the derivation.
 */

/** Where an event's card / the pinned row may send this person (`eventBoardHref`), or why it may not. */
export type EventDoor = { href: string | null; reason: string | null; invited: boolean };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date-only value's parts, tz-safe (no Date parsing of a bare day). */
function dayParts(iso: string | null | undefined): { d: number; mon: string; dow: string } | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dow = new Date(Date.UTC(y, mo, d)).getUTCDay();
  return { d, mon: MON[mo]!, dow: DOW[dow]! };
}

function DateChip({ iso }: { iso: string | null }) {
  const p = dayParts(iso);
  return (
    <span className="w-10 shrink-0 rounded-md bg-ink/[0.05] py-1 text-center leading-none" aria-hidden>
      {p ? (
        <>
          <b className="block text-[15px] font-semibold text-ink">{p.d}</b>
          <small className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-ink/50">{p.mon}</small>
        </>
      ) : (
        <b className="block py-1 font-mono text-[11px] font-medium text-ink/60">TBD</b>
      )}
    </span>
  );
}

/**
 * The chat column fills the screen down to the thumb row, so the page itself never scrolls behind it: its height is
 * the window minus where it starts minus the room `<main>` keeps for the dock and the row (`--sn-thumb-room`).
 */
function useFillToFoot(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const main = el.closest('main');
      const foot = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(260, Math.floor(window.innerHeight - top - foot))}px`;
    };
    fit();
    const t = [setTimeout(fit, 250), setTimeout(fit, 1000)];
    window.addEventListener('resize', fit);
    // The thumb row publishes its room on <html> after it mounts; re-fit when it does.
    const mo = new MutationObserver(fit);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-keyboard'] });
    return () => {
      t.forEach(clearTimeout);
      window.removeEventListener('resize', fit);
      mo.disconnect();
    };
  }, [ref]);
}

function MessageBubble({
  m,
  first,
  communityId,
  armed,
  onArm,
}: {
  m: SamahanMessage;
  first: boolean;
  communityId: string;
  armed: boolean;
  onArm: (id: string | null) => void;
}) {
  if (!m.is_self) {
    return (
      <li className="flex max-w-[78%] flex-col items-start self-start" data-chat-message="">
        <div className="rounded-[18px] bg-ink/[0.06] px-3 py-2 text-[14.5px] text-ink">
          {first ? <p className="mb-px text-[11px] font-bold text-gold-deep">{m.author_name}</p> : null}
          {/* Plain text — React escapes it, so a message can never become markup. */}
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        </div>
      </li>
    );
  }
  return (
    <li className="flex max-w-[78%] flex-col items-end self-end" data-chat-message="self">
      {/* Your own message: a tap shows "Take it down" under it (a soft delete — the shipped action). */}
      <button
        type="button"
        onClick={() => onArm(armed ? null : m.message_id)}
        aria-expanded={armed}
        className="rounded-[18px] bg-terracotta px-3 py-2 text-left text-[14.5px] text-white"
      >
        <span className="block whitespace-pre-wrap break-words">{m.body}</span>
      </button>
      {armed ? (
        <form action={deleteSamahanMessage} className="mt-0.5">
          <input type="hidden" name="community_id" value={communityId} />
          <input type="hidden" name="message_id" value={m.message_id} />
          <SubmitButton
            overlay={false}
            className="inline-flex min-h-9 items-center gap-1 px-1 text-[11px] font-medium text-ink/55 hover:text-terracotta-700"
            pendingLabel="Removing…"
          >
            <Trash2 aria-hidden className="h-3 w-3" /> Take it down
          </SubmitButton>
        </form>
      ) : null}
    </li>
  );
}

function EventCard({ event, door }: { event: ChatEvent; door: EventDoor | undefined }) {
  const p = dayParts(event.event_date);
  const sub = door?.href
    ? `${p ? `${p.dow} · ` : ''}tap to open`
    : (door?.reason ?? 'Ask an organizer to add you to this event.');
  const inner = (
    <>
      <DateChip iso={event.event_date} />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink/50">
          New event · {eventTypeBadge(event.event_type)}
        </span>
        <span className="block truncate text-[14px] font-semibold text-ink">{event.display_name}</span>
        <span className="block truncate text-xs text-ink/55">{sub}</span>
      </span>
      {door?.href ? <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> : null}
    </>
  );
  return (
    <li className="max-w-[86%] self-start" data-chat-event={event.event_id}>
      {door?.href ? (
        <Link
          href={door.href}
          className="flex items-center gap-2.5 rounded-2xl border border-ink/15 bg-white/70 p-2.5 hover:bg-ink/[0.03] dark:bg-raised" // no-card-ok: the whole card is the press into the event
        >
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-ink/15 p-2.5" /* no-card-ok: dashed — an event you may not open, said in words */>
          {inner}
        </div>
      )}
    </li>
  );
}

export function GroupChatroom({
  base,
  communityId,
  name,
  photoDisplayUrl,
  initial,
  isOrganizer,
  memberCount,
  eventCount,
  events,
  doors,
  pinned,
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
  eventCount: number;
  events: ChatEvent[];
  doors: Record<string, EventDoor>;
  pinned: ChatEvent | null;
  stories: SamahanStory[];
  storiesUnreadable: boolean;
  messages: SamahanMessage[];
  /** The Usapan read was REFUSED — the chat must not say "No one has said anything yet". */
  messagesUnreadable: boolean;
  /** The render's clock — the collage derivation is pure over it, so server and phone draw the same chat. */
  nowMs: number;
  /** A success / error line from the last action. */
  notice?: ReactNode;
}) {
  const storiesRef = useRef<StoriesControl | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [armedMsg, setArmedMsg] = useState<string | null>(null);
  const [playerKey, setPlayerKey] = useState<string | null>(null);
  const [text, setText] = useState('');

  const collages = useMemo(() => hourlyCollages(stories, nowMs), [stories, nowMs]);
  const items = useMemo<ChatItem[]>(
    () => chatTimeline({ messages, events, collages, nowMs }),
    [messages, events, collages, nowMs],
  );

  useFillToFoot(chatRef);
  // A chat reads from the bottom: land on the newest line.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);
  // From 1024 (no dock) the row sits under the reading column, not across the rail.
  useEffect(() => {
    const el = hostRef.current;
    return el ? followColumn(el) : undefined;
  }, []);

  const openStory = useCallback((storyId: string) => {
    setPlayerKey(null);
    storiesRef.current?.play(storyId);
  }, []);
  const record = useCallback(() => {
    setPlusOpen(false);
    storiesRef.current?.record();
  }, []);

  const planHref = `/dashboard/create-event?samahan=${communityId}`;
  const count =
    memberCount === null ? null : `${formatCount(memberCount)} ${memberCount === 1 ? 'member' : 'members'}`;
  const pinnedDoor = pinned ? doors[pinned.event_id] : undefined;
  const pinnedParts = pinned ? dayParts(pinned.event_date) : null;

  let prevAuthor: string | null = null;

  return (
    <div data-group-chatroom="" className="-mt-2">
      {/* 1 · THE TOP — ‹ People (always People › Groups) · the group · ⋯ */}
      <header className="flex items-center gap-2 border-b border-ink/10 pb-2" data-group-part="top">
        <Link
          href={PEOPLE_GROUPS_HREF}
          className="-ml-1.5 inline-flex min-h-11 min-w-11 shrink-0 items-center gap-0.5 rounded-md px-1 text-sm text-ink/60 hover:text-ink"
          aria-label="Back to People"
          data-group-back=""
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          People
        </Link>
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7a5a3c] text-[13px] font-bold text-[#f6ead6]">
          {photoDisplayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL
            <img src={photoDisplayUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight text-ink">{name}</h1>
          {count ? <p className="truncate text-xs text-ink/55">{count}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          aria-haspopup="dialog"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5"
          data-group-more=""
        >
          <MoreHorizontal aria-hidden className="h-5 w-5" />
        </button>
      </header>

      {notice}

      {/* 2 · STORIES — the shipped strip (one clip an hour, gone after 24 hours), rings only. */}
      <div className="border-b border-ink/10 pt-2" data-group-part="stories">
        <SamahanStories
          communityId={communityId}
          stories={stories}
          unreadable={storiesUnreadable}
          strip
          controlRef={storiesRef}
        />
      </div>

      {/* 3 · THE NEXT EVENT, pinned, with Going? (the event's own page, where the reply lives). */}
      {pinned ? (
        <div className="flex items-center gap-2.5 border-b border-ink/10 py-2" data-group-part="next-event">
          <DateChip iso={pinned.event_date} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14px] font-semibold text-ink">{pinned.display_name}</b>
            <span className="block truncate text-xs text-ink/55">
              {pinnedParts ? `${pinnedParts.dow} · ` : ''}
              {pinnedDoor?.href ? eventTypeBadge(pinned.event_type) : (pinnedDoor?.reason ?? eventTypeBadge(pinned.event_type))}
            </span>
          </span>
          {pinnedDoor?.href ? (
            <Link
              href={pinnedDoor.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/20 px-3.5 text-[13px] font-semibold text-ink hover:bg-ink/5"
              data-group-going=""
            >
              {pinnedDoor.invited ? 'Going?' : 'Open'}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* 4 · THE CHAT — Usapan, with the group's new events and each hour's collage. */}
      <div
        ref={chatRef}
        className="h-[60dvh] overflow-y-auto overscroll-contain pb-3 pt-2"
        data-group-part="chat"
        aria-label="Usapan — the group chat"
        role="region"
      >
        {messagesUnreadable && items.length === 0 ? (
          <p className="py-6 text-center text-xs text-terracotta-700">
            We couldn&rsquo;t load the chat just now. Refresh to try again.
          </p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink/55">No one has said anything yet. Start it off.</p>
        ) : (
          <ol className="flex flex-col gap-1.5" role="list">
            {messagesUnreadable ? (
              <li className="self-center text-[11px] text-terracotta-700">Messages couldn&rsquo;t load — refresh.</li>
            ) : null}
            {items.map((it) => {
              if (it.kind === 'day') {
                prevAuthor = null;
                return (
                  <li key={it.key} className="my-1.5 self-center text-[11px] text-ink/50" data-chat-day="">
                    {it.label}
                  </li>
                );
              }
              if (it.kind === 'event') {
                prevAuthor = null;
                return <EventCard key={it.key} event={it.event} door={doors[it.event.event_id]} />;
              }
              if (it.kind === 'collage') {
                prevAuthor = null;
                return (
                  <li key={it.key} className="flex flex-col gap-1.5 self-stretch">
                    <span className="mt-1 self-center text-[11px] text-ink/50">{it.collage.label}</span>
                    <GroupCollage
                      collage={it.collage}
                      nowMs={nowMs}
                      onPlay={() => setPlayerKey(it.collage.key)}
                      onOpenStory={openStory}
                    />
                  </li>
                );
              }
              const who = it.message.is_self ? '\u0000self' : it.message.author_name;
              const first = who !== prevAuthor;
              prevAuthor = who;
              return (
                <MessageBubble
                  key={it.key}
                  m={it.message}
                  first={first}
                  communityId={communityId}
                  armed={armedMsg === it.message.message_id}
                  onArm={setArmedMsg}
                />
              );
            })}
          </ol>
        )}
      </div>

      {/* 5 · THE MESSAGE BAR, in the thumb zone: ＋ · Message the group · 📷 (the one thumb row; it rides the keyboard). */}
      <div ref={hostRef} className="mx-auto w-full max-w-3xl" data-thumb-host="">
        <div
          data-group-composer=""
          className="pointer-events-none fixed inset-x-0 bottom-[var(--sn-ride-h,var(--sn-bottomdock-h,64px))] z-[25] py-2.5 pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] lg:bottom-4 lg:left-[var(--gs-left,0px)] lg:right-[var(--gs-right,0px)] lg:px-0"
        >
          <ThumbRow
            name="group-chat"
            left={[{ icon: Plus, label: 'Add to the group', onClick: () => setPlusOpen(true), testId: 'group-plus' }]}
            field={{
              node: (
                <form
                  action={postSamahanMessage}
                  onSubmit={(e) => {
                    if (!text.trim()) {
                      e.preventDefault();
                      return;
                    }
                    // The form's data is already taken; empty the box for the next line.
                    setTimeout(() => setText(''), 0);
                  }}
                  className="flex h-full min-w-0 flex-1 items-center gap-1 pl-3.5 pr-1"
                  data-group-send-form=""
                >
                  <input type="hidden" name="community_id" value={communityId} />
                  <input
                    name="body"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={2000}
                    autoComplete="off"
                    enterKeyHint="send"
                    placeholder="Message the group"
                    aria-label="Message the group"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/45"
                  />
                  {text.trim() ? (
                    <SubmitButton
                      overlay={false}
                      pendingLabel=""
                      aria-label="Send"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-white"
                    >
                      <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2.4} />
                    </SubmitButton>
                  ) : null}
                </form>
              ),
            }}
            right={[{ icon: Camera, label: 'Add a story', onClick: record, testId: 'group-story' }]}
          />
        </div>
      </div>

      {/* ⋯ — the shipped lists, one tap in. */}
      <Sheet open={moreOpen} onClose={() => { setMoreOpen(false); setLeaveArmed(false); }} labelledById="group-more-title" rise>
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4" data-group-more-sheet="">
          <h2 id="group-more-title" className="mb-1 pr-12 text-[17px] font-semibold text-ink">
            {name}
          </h2>
          <nav className="flex flex-col divide-y divide-ink/10" aria-label="Group">
            <SheetRow href={`${base}?tab=members`} icon={<Users className="h-[18px] w-[18px]" />} label="Members" end={count ? formatCount(memberCount ?? 0) : null} />
            <SheetRow href={`${base}?tab=events`} icon={<CalendarDays className="h-[18px] w-[18px]" />} label="All events" end={formatCount(eventCount)} />
            {isOrganizer ? (
              <SheetRow href={`${base}?tab=members#bring-in`} icon={<UserPlus className="h-[18px] w-[18px]" />} label="Bring people in" />
            ) : null}
            <SheetRow href="/dashboard/notifications" icon={<Bell className="h-[18px] w-[18px]" />} label="Notifications" end="Inbox" />
            <form action={leaveCommunity} onSubmit={(e) => { if (!leaveArmed) { e.preventDefault(); setLeaveArmed(true); } }}>
              <input type="hidden" name="community_id" value={communityId} />
              <button
                type="submit"
                className="flex min-h-[50px] w-full items-center gap-2.5 text-left text-[15px] font-medium text-danger-700"
                data-group-leave={leaveArmed ? 'armed' : ''}
              >
                <LogOut aria-hidden className="h-[18px] w-[18px]" />
                {leaveArmed ? 'Tap again to leave the group' : 'Leave group'}
              </button>
            </form>
          </nav>
        </div>
      </Sheet>

      {/* ＋ — what you can add to the group. */}
      <Sheet open={plusOpen} onClose={() => setPlusOpen(false)} labelledById="group-plus-title" rise>
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4" data-group-plus-sheet="">
          <h2 id="group-plus-title" className="mb-1 pr-12 text-[17px] font-semibold text-ink">
            Add to the group
          </h2>
          <div className="flex flex-col divide-y divide-ink/10">
            <button type="button" onClick={record} className="flex min-h-[50px] w-full items-center gap-2.5 text-left text-[15px] text-ink" data-group-plus-story="">
              <Camera aria-hidden className="h-[18px] w-[18px] text-ink/70" />
              <span className="flex-1">A story</span>
              <span className="text-[13px] text-ink/50">3 seconds</span>
            </button>
            {isOrganizer ? (
              <SheetRow href={planHref} icon={<CalendarDays className="h-[18px] w-[18px]" />} label="Plan an event" />
            ) : null}
            {isOrganizer ? (
              <SheetRow href={`${base}?tab=members#bring-in`} icon={<UserPlus className="h-[18px] w-[18px]" />} label="Bring people in" />
            ) : (
              <SheetRow href={`${base}?tab=events`} icon={<CalendarDays className="h-[18px] w-[18px]" />} label="All events" />
            )}
          </div>
        </div>
      </Sheet>

      <CollagePlayer
        collages={collages}
        openKey={playerKey}
        nowMs={nowMs}
        onClose={() => setPlayerKey(null)}
        onStep={setPlayerKey}
        onOpenStory={openStory}
      />
    </div>
  );
}

function SheetRow({ href, icon, label, end }: { href: string; icon: ReactNode; label: string; end?: string | null }) {
  return (
    <Link href={href} className="flex min-h-[50px] items-center gap-2.5 text-[15px] text-ink" data-group-sheet-row={label}>
      <span aria-hidden className="text-ink/70">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {end ? <span className="text-[13px] text-ink/50">{end}</span> : null}
      <ChevronRight aria-hidden className="h-4 w-4 text-ink/35" />
    </Link>
  );
}
