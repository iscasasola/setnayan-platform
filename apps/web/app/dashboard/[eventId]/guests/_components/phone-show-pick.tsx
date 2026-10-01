'use client';

/**
 * phone-show-pick.tsx — "Show: Reply ▾" on the phone's counts line.
 *
 * ⚖ Owner 2026-10-01 (verbatim, via the controller): *"on the mobile mode. we can
 * pick a column and we will show the answer for each guest. on desktop we can view
 * multiple columns"*. So on a phone the one-column pick is VISIBLE — one dropdown
 * on the counts line — and each row shows that column's answer on its right. It is
 * E's pick (`useRosterColumns`, remembered per device, owned by the list), reached
 * through `phone-column-channel.ts`; the options are the columns the computer has.
 * A computer shows several columns side by side and draws no Show ▾.
 */

import { ROSTER_COLUMN_LABEL, type RosterColumn } from '@/lib/roster-columns';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePhoneColumn } from './phone-column-channel';

export function PhoneShowPick() {
  const show = usePhoneColumn();
  if (!show) return null;
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink/60 lg:hidden" data-roster-phone-show="">
      Show
      <PickMenu
        compact
        label="What each row shows"
        value={show.column}
        buttonText={ROSTER_COLUMN_LABEL[show.column]}
        options={show.available.map((c) => ({ key: c, label: ROSTER_COLUMN_LABEL[c] }))}
        onPick={(key) => show.pick(key as RosterColumn)}
        dataAttr="data-roster-column-pick"
      />
    </span>
  );
}
