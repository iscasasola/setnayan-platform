'use client';

import { FindField, FindResults, InviteAction, useFindOrInvite } from './find-or-invite';
import { PeopleViewPicker } from './people-view-picker';
import type { PeoplePickerProps } from './people-roster-view';
import { AccountThumbRow, ThumbTool } from '../../_components/account-thumb-row';

/**
 * people-thumb.tsx — the ONE thumb row for the views that are not the roster (Following · Followers · Groups):
 * ≡ (the views — owner 2026-10-22: Groups, Following and Followers live under it) · "Search or invite" · ＋ Invite,
 * exactly the roster's row (prototypes/one_thumb_row_2026-10-22.html). What the field finds is drawn HERE, where
 * this sits in the view; the row itself floats over the list.
 */
export function PeopleThumb({ picker }: { picker: PeoplePickerProps }) {
  const find = useFindOrInvite();
  return (
    <div data-people-thumb-host="">
      {find.line.trim() ? <FindResults f={find} /> : null}
      <AccountThumbRow
        data={{ 'data-people-thumb': 'view' }}
        tools={
          <ThumbTool>
            <span data-pick="" data-people-filter="" className="contents">
              <PeopleViewPicker view={picker.view} options={picker.options} gates={picker.gates} />
            </span>
          </ThumbTool>
        }
        field={<FindField f={find} />}
        action={<InviteAction f={find} />}
      />
    </div>
  );
}
