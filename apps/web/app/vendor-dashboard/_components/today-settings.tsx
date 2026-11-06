'use client';

import { useState } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { PushToggle } from '../notifications/push-toggle';

/**
 * ⚙ TODAY SETTINGS (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE":
 * "Today ⚙ notifications + run-the-day"). The house ⚙ (`MenuSettingsButton`, menu `today`), mounted ONCE
 * here — Today draws this component at the end of its pinned counts row, or on a new shop at the end of the
 * "Get your shop live" row; never both.
 *
 * WHAT IS IN IT IS WHAT EXISTS. Notifications: the shipped push switch for this device (`PushToggle` — the same
 * `vendor_push_tokens` the shop's alerts are sent through), saved the moment it is pressed. The prototype also draws
 * "New messages · Booking asks · Quiet hours" and Run the day's "Opens on · Crew sees first": NONE of those is stored
 * anywhere today (no per-kind switch, no quiet-hours column, no default Event Hub tool — `vendor_dayof_configs` is per
 * booking), so they are not drawn as switches that would save nothing. They wait on the owner's word and a column.
 */
export function TodaySettings() {
  const [open, setOpen] = useState(false);
  return (
    <MenuSettingsButton menu="today" open={open} onOpenChange={setOpen}>
      <div className="px-4 pb-6 pt-2" data-today-settings="">
        <p className="home-k2 pt-2">Notifications</p>
        <div className="py-2" data-today-settings-push="">
          <PushToggle />
        </div>
      </div>
    </MenuSettingsButton>
  );
}
