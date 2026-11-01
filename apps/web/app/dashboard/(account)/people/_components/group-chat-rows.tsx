import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { unreadBadge, type GroupChatRow } from '@/lib/people-group-rows-shape';
import { formatCount } from '@/lib/format-number';
import ps from './people-screen.module.css';

/**
 * group-chat-rows.tsx — A GROUP ROW READS LIKE A CHAT (owner 2026-10-28, "People and Groups approved"; prototype
 * `prototypes/user_dash_2026-10-28/` frames B–D). One row per group, the same on the People list's Groups section and
 * on the Groups view:
 *
 *   [ring · initials]  Name                                  time
 *                      Mika: the last message line
 *                      📅 15 Nov · the next event
 *
 *   · the RING is drawn while the group has live stories (24 h) — otherwise the plain disc;
 *   · the line is the newest message, "You: …" when it is yours; a group with none says so — unless the read was
 *     refused, when the row keeps its shipped "Organizer · N members" line (never "No messages yet" over a refusal);
 *   · 🔴 UNREAD (owner 2026-10-28, "GROUP UNREAD"): while others wrote since you last opened the group, the last line is
 *     BOLD and a count badge sits under the time (99+ past ninety-nine). A refused count draws neither — never a 0.
 *
 * Tap → the group's chatroom, `/dashboard/samahan/<id>`; its every way back lands on People › Groups
 * (`PEOPLE_GROUPS_HREF`). Presentational and server-safe: the People page, the Groups view (a client island) and
 * `/dev/people-lab` all draw it. 🔒 people/group-rows-read-like-chats.test.ts
 */
export function GroupChatRows({ rows, activityUnreadable = false }: { rows: readonly GroupChatRow[]; activityUnreadable?: boolean }) {
  return (
    <>
      {activityUnreadable ? (
        <p role="status" className="py-2 text-[13px] text-ink/60" data-group-activity="refused">
          We couldn’t load the latest messages just now. Your groups are all here.
        </p>
      ) : null}
      <ul className="list-none" data-group-chat-rows="">
        {rows.map((g) => {
          const unread = g.unread !== null && g.unread > 0;
          return (
          <li key={g.communityId}>
            <Link
              href={g.labHref ?? `/dashboard/samahan/${g.communityId}`}
              className="flex min-h-[72px] items-center gap-3 border-t border-ink/10 py-2.5 transition-colors hover:bg-ink/[0.03]"
              data-people-group-row=""
              data-group-stories={g.stories > 0 ? String(g.stories) : undefined}
              data-group-unread={unread ? String(g.unread) : undefined}
            >
              <span aria-hidden className={`${ps.groupRing} ${g.stories > 0 ? ps.groupRingLive : ''}`} data-group-ring={g.stories > 0 ? 'live' : 'none'}>
                <span className={`${ps.groupDisc} text-gold-deep`}>
                  {groupInitials(g.name)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{g.name}</span>
                <span className={`block truncate text-[13px] ${unread ? 'font-semibold text-ink' : 'text-ink/60'}`} data-group-line="">
                  {lineFor(g, activityUnreadable)}
                </span>
                {g.nextEvent ? (
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[12px] font-semibold text-gold-deep" data-group-next-event="">
                    <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {g.nextEvent.label}
                  </span>
                ) : null}
              </span>
              {g.last || unread ? (
                <span className="flex flex-none flex-col items-end gap-1 self-start pt-1">
                  {g.last ? (
                    <span className="text-[11.5px] text-ink/55" data-group-when="">
                      {g.last.when}
                    </span>
                  ) : null}
                  {unread ? (
                    <span
                      className="inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-sn-accent px-1.5 text-[11px] font-bold leading-none text-sn-on-accent"
                      data-group-unread-badge=""
                      aria-label={`${formatCount(g.unread!)} unread`}
                    >
                      {unreadBadge(g.unread!)}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </Link>
          </li>
          );
        })}
      </ul>
    </>
  );
}

function lineFor(g: GroupChatRow, refused: boolean): string {
  if (g.last) return `${g.last.who}: ${g.last.body}`;
  const stories = g.stories > 0 ? `${formatCount(g.stories)} ${g.stories === 1 ? 'story' : 'stories'} today` : null;
  if (refused || !stories) {
    const who = [g.role === 'organizer' ? 'Organizer' : null, g.memberCount !== null ? `${formatCount(g.memberCount)} ${g.memberCount === 1 ? 'member' : 'members'}` : null]
      .filter(Boolean)
      .join(' · ');
    if (refused) return who;
    return who ? `No messages yet · ${who}` : 'No messages yet';
  }
  return stories;
}

/** "Team Payaman" → "TP"; one word → its first letter. */
export function groupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const two = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0]?.[0] ?? 'G');
  return two.toUpperCase();
}
