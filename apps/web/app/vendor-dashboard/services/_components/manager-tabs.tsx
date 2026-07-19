'use client';

import { useState, type ReactNode } from 'react';

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
      <div
        role="tablist"
        aria-label="Your services sections"
        className="mb-4 flex gap-1.5 rounded-xl p-1"
        style={{ background: 'var(--m-paper-2)' }}
      >
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`mgr-panel-${i}`}
              id={`mgr-tab-${i}`}
              onClick={() => setActive(i)}
              className="flex-1 rounded-lg border px-2 py-2 text-center text-sm"
              style={{
                borderColor: on ? 'var(--m-orange-3)' : 'transparent',
                background: on ? 'var(--m-paper)' : 'transparent',
                color: on ? 'var(--m-ink)' : 'var(--m-slate)',
                fontWeight: on ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
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
