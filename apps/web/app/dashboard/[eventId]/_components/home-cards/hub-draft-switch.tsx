'use client';

/**
 * hub-draft-switch.tsx — ONE Event Hub setting as a switch on a Home card, written into the Maker's DRAFT exactly as
 * the Maker writes it (`hubDraftAction`, intent `save`, an `events` patch). Guests hear or see nothing until Apply —
 * the one Apply on the Event Hub card counts it (one draft, one Apply; owner 2026-10-23, the service widgets).
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { HomeCardRow } from '../home-service-card';

export function HubDraftSwitch({
  eventId,
  column,
  on,
  label,
  hint,
}: {
  eventId: string;
  /** An `events` column the draft carries (`HUB_DRAFT_EVENT_COLUMNS`). */
  column: 'site_bg_music_enabled';
  on: boolean;
  label: string;
  hint: string | null;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(on);
  const [line, setLine] = useState<string | null>(null);
  const [saving, start] = useTransition();
  useEffect(() => setShown(on), [on]);

  const flip = () => {
    const want = !shown;
    setShown(want);
    setLine(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ events: { [column]: want } }));
      const r = await hubDraftAction(eventId, fd).catch(() => null);
      if (!r || !r.ok) {
        setShown(!want);
        setLine(r && !r.ok && r.error ? r.error : 'That did not save, so it is back as it was. Please try again.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <HomeCardRow
        label={label}
        hint={hint}
        marker={column}
        control={
          <button type="button" role="switch" aria-checked={shown} aria-label={label} className={SWITCH_BUTTON} disabled={saving} onClick={flip}>
            <SwitchTrack on={shown} />
          </button>
        }
      />
      {line ? (
        <p role="status" className="pb-2 text-[12.5px] text-ink/65">
          {line}
        </p>
      ) : null}
    </>
  );
}
