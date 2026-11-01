'use client';

import { InfoTip } from '@/app/_components/info-tip';
import type { HubFact } from '@/lib/event-hub-control';

/**
 * 🧊 THE 3D PLAN'S FACTS, BEHIND ⓘ — Guests › Seats' ⋯ menu (owner 2026-10-29, on the Guests audit's 3D Plan facts panel:
 * *"put it behind (i)"*). R4 folded the 3D Plan page into Seats and its four facts went with it; they are back here as
 * the house shape for details — the title visible, everything else inside the ⓘ.
 *
 * PURE presentation: every fact arrives decided (`resolvePlan3dFacts`, `lib/plan3d-control.ts`). An unread fact says "—",
 * never a zero (`known: false`), the precedent the retired page kept.
 */
export function SeatPlanFacts({ facts }: { facts: readonly HubFact[] }) {
  return (
    <div data-seat-plan-facts="" className="flex min-h-11 items-center border-b border-ink/10 px-3">
      <InfoTip label="3D Plan" align="start" labelClassName="text-[13.5px] font-semibold text-ink" ariaLabel="About the 3D Plan">
        {facts.map((f) => (
          <span key={f.label} className="block py-0.5" data-seat-plan-fact={f.label}>
            <span className="font-semibold">{f.label}</span> · {f.known && f.value != null ? f.value : '—'}
          </span>
        ))}
        <span className="mt-1 block opacity-80">
          The room your guests walk, built from this seat plan, your guest list and your mood board. Change any of them —
          even on the day — and the room follows.
        </span>
      </InfoTip>
    </div>
  );
}
