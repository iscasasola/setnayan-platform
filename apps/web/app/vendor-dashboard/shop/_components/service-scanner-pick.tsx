'use client';

import { useState, useTransition } from 'react';
import { ScanLine } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SCAN_MODES, scannerChoiceOptions, type ScannerChoice } from '@/lib/supplier-scan';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';
import { seedFor } from '@/lib/hub-tools';
import { ActionButton } from '@/components/action-button';

/**
 * 🎟 A SERVICE'S SCANNER — one dropdown under its row in Shop › Services: Off · Once (each further mode joins the list
 * the day it is built). Set once, it applies to every event booked for this service (DECISION_LOG 2026-10-29); the
 * Event Hub's Scanner view opens the camera for it.
 *
 * A save never resets the screen: the choice shows at once, the save runs behind it, and a refused save puts the
 * old choice back with one plain line. Not a frame — it is a control, so it carries the dropdown's own button.
 *
 * 🧩 READY-MADE MODE (Toolkit templates drawing frame 5; Scanner stays ONE Toolkit item): where the service's category
 * has a ready-made mode (`HUB_TOOLS_SEED` scan) that differs from the choice, one line says it — "Ready-made for
 * Catering: Ordered → Received" — with Use it, which is the same save as the dropdown. A category with no row of its own
 * says nothing (the catch-all row is never offered as if it were the service's).
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
  const seed = seedFor(serviceLabel);
  const ready = seed.matched ? SCAN_MODES.find((m) => m.key === seed.row.scan) ?? null : null;
  const pick = (k: string) => {
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
  };
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
        onPick={pick}
      />
      {ready && ready.key !== choice ? (
        <span className="flex basis-full flex-wrap items-center gap-2" data-service-scanner-ready={ready.key}>
          <span className="text-sn-md text-ink/70">
            Ready-made for {seed.row.category}: <b className="font-semibold text-ink">{ready.label}</b>
          </span>
          <ActionButton tone="info" quiet icon={ScanLine} label="Use it" onClick={() => pick(ready.key)} data-service-scanner-use="" />
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-[12.5px] text-[rgb(var(--color-warn))]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
