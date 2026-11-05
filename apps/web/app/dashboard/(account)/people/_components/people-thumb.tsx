'use client';

import { useState } from 'react';
import { FindField, FindNotes, FindResults, InviteSheet, useFindOrInvite } from './find-or-invite';
import { PeopleViewPicker } from './people-view-picker';
import type { PeoplePickerProps } from './people-roster-view';
import { AccountThumbRow, ThumbTool } from '../../_components/account-thumb-row';

/**
 * people-thumb.tsx — the ONE thumb row for the views that are not the roster (Following · Followers · Groups):
 * ≡ (the views — owner 2026-10-22: Groups, Following and Followers live under it — and "Invite someone") ·
 * "Find or invite", exactly the roster's row. No ＋ Invite (owner 2026-10-25, "do the same on People"): a typed name's
 * first result is the invite, and ≡ opens the invite sheet for an empty field. What the field finds is drawn HERE,
 * where this sits in the view; the row itself floats over the list.
 */
export function PeopleThumb({ picker }: { picker: PeoplePickerProps }) {
  const find = useFindOrInvite();
  const [inviting, setInviting] = useState(false);
  return (
    <div data-people-thumb-host="">
      <FindNotes f={find} />
      {find.line.trim() ? <FindResults f={find} /> : null}
      <AccountThumbRow
        data={{ 'data-people-thumb': 'view' }}
        tools={
          <ThumbTool>
            <span data-pick="" data-people-filter="" className="contents">
              <PeopleViewPicker view={picker.view} options={picker.options} gates={picker.gates} onInvite={() => setInviting(true)} />
            </span>
          </ThumbTool>
        }
        field={<FindField f={find} />}
      />
      <InviteSheet f={find} open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
