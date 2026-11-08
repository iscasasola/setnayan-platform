'use client';

import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { DatesBlock } from '@/lib/vendor-dates';
import { DayOpenSwitch } from './day-open-switch';

type Action = (formData: FormData) => void | Promise<void>;

/** The booked QR with this date filled — the SHIPPED Locked QR form, unchanged (`invite/_components/locked-qr-generator.tsx`). */
export function bookAClientHref(day: string): string {
  return `/vendor-dashboard/invite?mode=locked&date=${day}`;
}

/**
 * 📅 THE DAY BAR (v113 `.dayact`, B1 step 3) — the picked day's two verbs on one row:
 *   · ACCEPT BOOKINGS — the shipped `DayOpenSwitch` (`addManualBlock` / `removeBlock`, in place);
 *   · BOOK A CLIENT — opens the SHIPPED Locked QR generator with this date filled (owner §10 #34: "Book a client" IS the
 *     Locked QR; the prototype's own sheet was invented). The form itself is not changed here.
 *
 * A closed day greys Book a client (v113 `.cta:disabled`) — nobody can be booked on a day that takes no bookings. A past
 * day draws no bar: neither verb means anything there.
 *
 * 🔒 customers/the-clients-list-is-v113.test.ts
 */
export function DayBar({
  day,
  today,
  blocks,
  actions,
  onFlip,
}: {
  /** #29: the switch's flips, for the calendar to strike the day at once and move it. */
  onFlip?: (day: string, open: boolean, how: 'flip' | 'refused') => void;
  day: string;
  today: string;
  blocks: readonly DatesBlock[];
  actions: { addManualBlock: Action; removeBlock: Action };
}) {
  const [open, setOpen] = useState(true);
  if (day < today) return null;
  return (
    <div className="flex items-center gap-3" data-dates-day-bar={day}>
      <div className="min-w-0 flex-1">
        <DayOpenSwitch day={day} today={today} blocks={blocks} actions={actions} onOpen={setOpen} onFlip={onFlip} />
      </div>
      <ActionButton
        tone="brand"
        main
        icon={QrCode}
        label="Book a client"
        href={bookAClientHref(day)}
        disabled={!open}
        data-testid="dates-book-client"
      />
    </div>
  );
}
