'use client';

// "How" for the chat's meeting composers (the ＋ menu and the suggest chip):
// ONE dropdown — In-person or Virtual — posting `kind`, and for Virtual the
// Via + link fields. No call is ever offered (owner 2026-10-28 / 2026-11-04).

import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { MEETING_MODES, MEETING_MODE_LABEL, type MeetingMode } from '@/lib/appointments';
import { VirtualMeetingFields } from './virtual-meeting-fields';

const MODE_OPTIONS = MEETING_MODES.map((m) => ({ key: m, label: MEETING_MODE_LABEL[m] }));

export function MeetingHowFields({
  initialMode = 'virtual',
}: {
  initialMode?: MeetingMode;
}) {
  const [mode, setMode] = useState<MeetingMode>(initialMode);
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={mode} />
      <div className="flex flex-col gap-1 text-[11px] font-medium text-ink/60">
        <span>How</span>
        <PickMenu
          label="In-person or virtual"
          value={mode}
          options={MODE_OPTIONS}
          dataAttr="data-meeting-mode"
          onPick={(k) => {
            const next = k as MeetingMode;
            setMode(next);
          }}
        />
      </div>
      {mode === 'virtual' ? <VirtualMeetingFields /> : null}
    </div>
  );
}
