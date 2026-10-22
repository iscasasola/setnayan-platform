'use client';

import { useEffect, useRef } from 'react';
import { followColumn } from '@/app/dashboard/[eventId]/guests/_components/dock-follows-column';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { FindField, FindResults, useFindOrInvite } from './find-or-invite';
import { PeopleViewPicker } from './people-view-picker';
import type { PeoplePickerProps } from './people-roster-view';
import ps from './people-screen.module.css';

/**
 * people-thumb.tsx — the glass thumb row for the views that are not the roster (Following · Followers ·
 * Groups): the same "Find or invite" field and the same ≡ list the roster's row carries (owner 2026-10-22:
 * Groups, Following and Followers live under the ≡ button, the seat Guests keeps its groups in). What the
 * field finds is drawn HERE, where this sits in the view; the row itself floats over the list.
 */
export function PeopleThumb({ picker }: { picker: PeoplePickerProps }) {
  const find = useFindOrInvite();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? followColumn(el) : undefined;
  }, []);
  return (
    <div ref={ref} className={`${gs.screen} ${ps.people}`} style={{ paddingBottom: 0 }} data-people-thumb-host="">
      {find.line.trim() ? <FindResults f={find} /> : null}
      <div className={`${gs.lower} ${ps.lower} sn-glass-row`} data-on="true" data-people-thumb="">
        <div className={gs.thumb} data-thumb="view">
          <FindField f={find} />
          <span className={gs.acts} data-side="right">
            <span data-pick="" className={ps.iconPick} data-people-filter="">
              <PeopleViewPicker view={picker.view} options={picker.options} gates={picker.gates} />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
