'use client';

import { useState, type ReactNode } from 'react';

import { PillButton, PillTrack } from '@/app/_components/pill-track';

/**
 * The prototype-v20 tab chrome for My Shop → Your services (owner: "we had a
 * prototype. follow that"): ONE card, three tabs — Coverage · Service cards ·
 * Tools — replacing the four stacked disclosure sections. Panels arrive as
 * server-rendered ReactNodes and stay mounted (hidden) so form state, deep
 * links (#svc-… anchors) and server-action results survive tab switches.
 */
export function ManagerTabs({
  tabs,
  defaultTab = 0,
}: {
  tabs: { label: string; panel: ReactNode }[];
  defaultTab?: number;
}) {
  const [active, setActive] = useState(
    defaultTab >= 0 && defaultTab < tabs.length ? defaultTab : 0,
  );
  return (
    <div>
      <PillTrack role="tablist" aria-label="Your services sections" grow className="mb-4">
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <PillButton
              key={t.label}
              on={on}
              role="tab"
              aria-selected={on}
              aria-controls={`mgr-panel-${i}`}
              id={`mgr-tab-${i}`}
              onClick={() => setActive(i)}
            >
              {t.label}
            </PillButton>
          );
        })}
      </PillTrack>
      {tabs.map((t, i) => (
        <div
          key={t.label}
          role="tabpanel"
          id={`mgr-panel-${i}`}
          aria-labelledby={`mgr-tab-${i}`}
          hidden={i !== active}
          className="space-y-4"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
