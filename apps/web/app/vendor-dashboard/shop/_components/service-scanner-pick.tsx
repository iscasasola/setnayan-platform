'use client';

import { useState, useTransition } from 'react';
import { ScanLine } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SCAN_MODES, scannerChoiceOptions, type ScannerChoice } from '@/lib/supplier-scan';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * 🎟 A SERVICE'S SCANNER — one dropdown under its row in Shop › Services: Off · Once (each further mode joins the list
 * the day it is built). Set once, it applies to every event booked for this service (DECISION_LOG 2026-10-29); the
 * Event Hub's Scanner view opens the camera for it.
 *
 * A save never resets the screen: the choice shows at once, the save runs behind it, and a refused save puts the
 * old choice back with one plain line. Not a frame — it is a control, so it carries the dropdown's own button.
 */
export function ServiceScannerPick({
  coverageId,
  serviceLabel,
  initial,
}: {
  coverageId: number;
  serviceLabel: string;
  initial: ScannerChoice;
}) {
  const [choice, setChoice] = useState<ScannerChoice>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const options = scannerChoiceOptions().map((o) => ({
    ...o,
    hint: o.key === 'off' ? 'No scanner on this service’s events.' : SCAN_MODES.find((m) => m.key === o.key)?.line,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3 pl-[52px]" data-shop-service-scanner={coverageId}>
      <ScanLine aria-hidden className="h-4 w-4 flex-none text-ink/70" strokeWidth={1.8} />
      <span className="text-[12.5px] text-ink/70">Scanner</span>
      <PickMenu
        label={`${serviceLabel} · scanner`}
        value={choice}
        options={options}
        compact
        dataAttr="data-service-scanner-pick"
        onPick={(k) => {
          if (k === choice) return;
          const before = choice;
          setChoice(k as ScannerChoice);
          setError(null);
          start(async () => {
            const reply = await supplierScan({ op: 'set_scanner', coverageId, choice: k });
            const res = reply.op === 'set_scanner' ? reply.result : { ok: false as const, error: 'Couldn’t save just now.' };
            if (!res.ok) {
              setChoice(before);
              setError(res.error);
            }
          });
        }}
      />
      {error ? (
        <p role="alert" className="basis-full text-[12.5px] text-[rgb(var(--color-warn))]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
