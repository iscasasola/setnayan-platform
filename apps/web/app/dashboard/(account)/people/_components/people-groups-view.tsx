'use client';

import { useRef, useState, type ReactNode } from 'react';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { useShellBarOffset } from '@/app/dashboard/[eventId]/guests/_components/use-shell-bar-offset';
import type { GroupChatRow } from '@/lib/people-group-rows-shape';
import { GroupChatRows } from './group-chat-rows';
import { PeoplePinnedRow } from './people-pinned-row';
import { PeopleThumb } from './people-thumb';
import type { PeoplePickerProps, PeoplePinProps } from './people-roster-view';
import ps from './people-screen.module.css';

/**
 * people-groups-view.tsx — PEOPLE › GROUPS (owner 2026-10-28, "People and Groups approved"; prototype
 * `prototypes/user_dash_2026-10-28/` frames C–D): the same pinned row as People, its own counts and action —
 *
 *   Groups ▾ · N unread · ＋ New · ⚙
 *
 * (owner 2026-10-28, "APPROVED — … GROUP UNREAD": the "N unread" door replaces the build's interim "with stories" door
 * AND the "N groups" count, so the row fits at 360.) Then one chat row per group (`GroupChatRows`), then what the page
 * hands in (the second degree, unchanged), then the shipped thumb row. ＋ New in the row is the view's ONE way to make a
 * group — the "New group" button that headed this view is gone (it would be the second). "N unread" filters to the
 * unread groups; tap again for all. A refused count says "Couldn't load" — never 0. 🔒 people/the-people-pinned-row.test.ts
 */
export function PeopleGroupsView({
  rows,
  unreadable,
  unreadUnreadable,
  activityUnreadable,
  picker,
  pin,
  children,
}: {
  rows: readonly GroupChatRow[];
  /** The group list was refused — said, never drawn as "No group yet". */
  unreadable: boolean;
  /** The unread counts were refused — the door says "Couldn't load", never 0. */
  unreadUnreadable: boolean;
  activityUnreadable: boolean;
  picker: PeoplePickerProps;
  pin: PeoplePinProps;
  /** The second degree (server-read), drawn under the rows as shipped. */
  children?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useShellBarOffset(rootRef);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const isUnread = (r: GroupChatRow) => r.unread !== null && r.unread > 0;
  const unreadGroups = rows.filter(isUnread).length;
  const shown = filter === 'unread' ? rows.filter(isUnread) : rows;

  return (
    <div ref={rootRef} className={`${gs.screen} ${ps.people}`} data-people-view="samahan" data-people-screen="groups">
      <div className={gs.stick} data-people-head="">
        <PeoplePinnedRow
          face="groups"
          view="samahan"
          options={pin.options}
          gates={picker.gates}
          note={unreadable ? 'Not loaded just now' : rows.length === 0 ? 'No group yet' : unreadUnreadable ? 'Couldn’t load' : null}
          doors={[
            { key: 'unread', n: unreadGroups, word: 'unread', hot: unreadGroups > 0, on: filter === 'unread', onTap: () => setFilter(filter === 'unread' ? 'all' : 'unread') },
          ]}
          action={{ kind: 'new-group' }}
          settings={pin.settings}
        />
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-ink/60" data-people-groups-empty="">
          {unreadable
            ? 'We couldn’t load your groups just now. Nothing is lost — refresh in a moment.'
            : 'No group yet — tap ＋ New and name it whatever your group calls itself.'}
        </p>
      ) : (
        <div className="pb-4" data-people-groups="">
          <GroupChatRows rows={shown} activityUnreadable={activityUnreadable} />
        </div>
      )}
      {children}
      <PeopleThumb picker={picker} />
    </div>
  );
}
