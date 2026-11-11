'use client';

import { useState } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { PushToggle } from '../notifications/push-toggle';

/**
 * ⚙ TODAY SETTINGS — since 11 Nov top-right on Today's photo header, riding onto the pinned "Needs you today" row's
 * right end once the header has scrolled away (owner *"Today settings yes"*; `TodayGearRide`, Portfolio's `pin`).
 * Owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "Today ⚙
 * notifications + run-the-day". The house ⚙ (`MenuSettingsButton`, menu `today`), mounted ONCE at a time — on the
 * header or the pinned row, or on a new shop at the end of the "Get your shop live" row; never two.
 *
 * WHAT IS IN IT IS WHAT EXISTS. Notifications: the shipped push switch for this device (`PushToggle` — the same
 * `vendor_push_tokens` the shop's alerts are sent through), saved the moment it is pressed. The prototype also draws
 * "New messages · Booking asks · Quiet hours" and Run the day's "Opens on · Crew sees first": NONE of those is stored
 * anywhere today (no per-kind switch, no quiet-hours column, no default Event Hub tool — `vendor_dayof_configs` is per
 * booking), so they are not drawn as switches that would save nothing. They wait on the owner's word and a column.
 */
export function TodaySettings({ cover = false }: { cover?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  return (
    // 👋 On Today's cover (THE ONE BUILD A2/A11) the ⚙ wears the cover's ink (`cover`, the shipped Home way); its
    // contents are unchanged — only its seat moved, and it is still ONE mount.
    <MenuSettingsButton menu="today" open={open} onOpenChange={setOpen} cover={cover} tour="today-settings">
      <div className="px-4 pb-6 pt-2" data-today-settings="">
        <p className="home-k2 pt-2">Notifications</p>
        <div className="py-2" data-today-settings-push="">
          <PushToggle />
        </div>
      </div>
    </MenuSettingsButton>
  );
}
