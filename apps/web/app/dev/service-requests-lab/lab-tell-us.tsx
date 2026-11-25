'use client';

/**
 * 🧪 "Tell us what you do" IN PLACE, on fixtures (final check B9): the real `TellUsHost` inside the real risen
 * `RiseRoute` ("New service"), over a stand-in for the card maker — a long body to scroll, a typed box to prove the
 * maker keeps what was typed, and the "Ask us" door (`useTellUs`). Dev only. Never press Send request here.
 */
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { RiseRoute } from '@/app/_components/rise/rise-route';
import { TellUsHost, useTellUs } from '@/app/vendor-dashboard/services/requests/_components/tell-us-host';
import type { TellUsAt } from '@/app/vendor-dashboard/services/requests/_components/tell-us-view';
import type { RequestGroup } from '@/lib/service-requests.server';
import { ActionButton } from '@/components/action-button';

function MakerStandIn() {
  const tellUs = useTellUs();
  const [typed, setTyped] = useState('');
  return (
    <div className="space-y-4 px-4 py-4" data-lab-maker="">
      <label className="block text-sn-base text-ink">
        Card name (stand-in)
        <input className="input-field mt-1 w-full" value={typed} onChange={(e) => setTyped(e.target.value)} data-lab-typed="" />
      </label>
      {Array.from({ length: 40 }, (_, i) => (
        <p key={i} className="text-sn-base text-ink/60">
          Maker field {i + 1} · unchanged
        </p>
      ))}
      <ActionButton tone="neutral" icon={MessageSquare} label="Ask us" onClick={() => tellUs?.open()} data-lab-ask-us="" />
    </div>
  );
}

export function LabTellUs({ groups, open, at }: { groups: readonly RequestGroup[]; open: boolean; at?: TellUsAt }) {
  return (
    <RiseRoute page kind="stack" title="New service" data="lab-tell-us">
      <TellUsHost groups={groups} initial={{ open, at }} retry="/dev/service-requests-lab?f=group">
        <MakerStandIn />
      </TellUsHost>
    </RiseRoute>
  );
}
