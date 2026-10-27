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
 *   Groups ▾ · N groups · N with stories · ＋ New · ⚙
 *
 * then one chat row per group (`GroupChatRows`), then what the page hands in (the second degree, unchanged), then the
 * shipped thumb row. ＋ New in the row is the view's ONE way to make a group — the "New group" button that headed this
 * view is gone (it would be the second). The doors filter: "with stories" shows the ringed rows; "groups" shows all.
 *
 * ⛔ The approved drawing's second door is "unread". There is no per-person read marker for a group
 * (`lib/people-group-rows-shape.ts`), so that door would count something else; "with stories" — the ring the rows
 * already draw — takes its seat until a read marker exists. 🔒 people/the-people-pinned-row.test.ts
 */
export function PeopleGroupsView({
  rows,
  unreadable,
  activityUnreadable,
  picker,
  pin,
  children,
}: {
  rows: readonly GroupChatRow[];
  /** The group list was refused — said, never drawn as "No group yet". */
  unreadable: boolean;
  activityUnreadable: boolean;
  picker: PeoplePickerProps;
  pin: PeoplePinProps;
  /** The second degree (server-read), drawn under the rows as shipped. */
  children?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useShellBarOffset(rootRef);
  const [filter, setFilter] = useState<'all' | 'stories'>('all');
  const live = rows.filter((r) => r.stories > 0).length;
  const shown = filter === 'stories' ? rows.filter((r) => r.stories > 0) : rows;

  return (
    <div ref={rootRef} className={`${gs.screen} ${ps.people}`} data-people-view="samahan" data-people-screen="groups">
      <div className={gs.stick} data-people-head="">
        <PeoplePinnedRow
          face="groups"
          view="samahan"
          options={pin.options}
          gates={picker.gates}
          note={unreadable ? 'Not loaded just now' : rows.length === 0 ? 'No group yet' : null}
          doors={[
            { key: 'groups', n: rows.length, word: rows.length === 1 ? 'group' : 'groups', on: false, onTap: () => setFilter('all') },
            ...(live > 0
              ? [{ key: 'stories', n: live, word: 'with stories', hot: true, on: filter === 'stories', onTap: () => setFilter(filter === 'stories' ? 'all' : 'stories') }]
              : []),
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
