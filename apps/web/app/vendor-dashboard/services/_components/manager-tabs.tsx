'use client';

import { useState, type ReactNode } from 'react';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * My Shop → Your services: ONE card, three sections — Coverage · Service cards · Tools (prototype v20, owner: "we had a
 * prototype. follow that"). Panels arrive as server-rendered ReactNodes and stay mounted (hidden) so form state, deep
 * links (#svc-… anchors) and server-action results survive a switch.
 *
 * 🎛 ONE DROPDOWN, NOT A SLIDING PILL (owner 2026-10-30 "all yes", DECISION_LOG "ONE SELECTOR FOR EVERY PAGE", Q1 — the
 * supplier Services manager is named there): the three sections are the shared compact `PickMenu`, `Your services ·
 * Coverage ▾`. Was a `PillTrack role="tablist"`.
 * 🔒 app/vendor-dashboard/every-supplier-top-row-is-one-selector.test.ts
 */
export function ManagerTabs({
  tabs,
  defaultTab = 0,
}: {
  tabs: { label: string; panel: ReactNode }[];
  defaultTab?: number;
}) {
  const [active, setActive] = useState(defaultTab >= 0 && defaultTab < tabs.length ? defaultTab : 0);
  return (
    <div>
      <div className="mb-4 flex min-h-11 items-center" data-services-sections="">
        <PickMenu
          label="Your services — show"
          value={String(active)}
          buttonText={`Your services · ${tabs[active]?.label ?? ''}`}
          options={tabs.map((t, i) => ({ key: String(i), label: t.label }))}
          compact
          dataAttr="data-services-sections-pick"
          onPick={(k) => setActive(Number(k))}
        />
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} id={`mgr-panel-${i}`} aria-label={t.label} role="region" hidden={i !== active} className="space-y-4">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
