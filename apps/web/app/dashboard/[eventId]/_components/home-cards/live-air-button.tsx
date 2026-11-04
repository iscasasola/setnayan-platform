'use client';

/**
 * live-air-button.tsx — Go live / End on Home's Live stream card (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 6). The shipped calls, unchanged: `goLivePanood` /
 * `endPanoodBroadcast` (the setup page's own — they answer instead of redirecting), and `endManualOnAir` for a stream
 * the couple started by hand (`endOnAirTarget`, the controller's pairing). A refusal is said in its own words.
 */

import { useState, useTransition } from 'react';
import { Radio, Square } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { GO_LIVE_CONFIRM } from '@/lib/live-studio-go-live-confirm';
import { endOnAirTarget, type LiveAirSource } from '@/lib/live-studio-manual-air';
import { endPanoodBroadcast, goLivePanood } from '../../studio/panood/setup/actions';
import { endManualOnAir } from '@/app/panood/control/[eventId]/actions';

export function LiveAirButton({ eventId, onAir, source }: { eventId: string; onAir: boolean; source: LiveAirSource | null }) {
  const [line, setLine] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const target = endOnAirTarget(source);
  const { confirm, dialog } = useConfirm();

  // Owner 2026-11-05 (item 11): going on air asks once first (lib/live-studio-go-live-confirm.ts); ending never asks.
  const run = async () => {
    if (!onAir && !(await confirm(GO_LIVE_CONFIRM))) return;
    start(async () => {
      setLine(null);
      const r = await (onAir
        ? target === 'manual'
          ? endManualOnAir(eventId)
          : endPanoodBroadcast(eventId)
        : goLivePanood(eventId)
      ).catch(() => ({ error: 'That did not go through. Please try again.' }));
      if ('error' in r) {
        setLine(r.error);
      }
      // (No refresh: these actions revalidate, so their answer already carries Home's new render — one render per press.)
    });
  };

  return (
    <>
      {dialog}
      <ActionButton
        tone={onAir ? 'neutral' : 'brand'}
        icon={onAir ? <Square aria-hidden="true" strokeWidth={1.9} /> : <Radio aria-hidden="true" strokeWidth={1.9} />}
        label={onAir ? 'End' : 'Go live'}
        onClick={() => void run()}
        disabled={busy || (onAir && !target)}
        data-testid={onAir ? 'home-live-end' : 'home-live-go'}
      />
      {line ? (
        <p role="status" className="basis-full text-[12.5px] text-danger-700" data-home-live-line="">
          {line}
        </p>
      ) : null}
    </>
  );
}
