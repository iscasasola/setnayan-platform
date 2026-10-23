'use client';

/**
 * live-air-button.tsx — Go live / End on Home's Live stream card (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 6). The shipped calls, unchanged: `goLivePanood` /
 * `endPanoodBroadcast` (the setup page's own — they answer instead of redirecting), and `endManualOnAir` for a stream
 * the couple started by hand (`endOnAirTarget`, the controller's pairing). A refusal is said in its own words.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Square } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { endOnAirTarget, type LiveAirSource } from '@/lib/live-studio-manual-air';
import { endPanoodBroadcast, goLivePanood } from '../../studio/panood/setup/actions';
import { endManualOnAir } from '@/app/panood/control/[eventId]/actions';

export function LiveAirButton({ eventId, onAir, source }: { eventId: string; onAir: boolean; source: LiveAirSource | null }) {
  const router = useRouter();
  const [line, setLine] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const target = endOnAirTarget(source);

  const run = () =>
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
        return;
      }
      router.refresh();
    });

  return (
    <>
      <ActionButton
        tone={onAir ? 'neutral' : 'brand'}
        icon={onAir ? <Square aria-hidden="true" strokeWidth={1.9} /> : <Radio aria-hidden="true" strokeWidth={1.9} />}
        label={onAir ? 'End' : 'Go live'}
        onClick={run}
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
