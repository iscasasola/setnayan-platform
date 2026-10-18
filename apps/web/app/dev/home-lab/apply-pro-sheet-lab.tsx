'use client';

import { AppleProScreen } from '@/app/_components/iap/apple-pro-screen';
import type { IapScreen } from '@/lib/iap/iap-outcome';

/**
 * DEV-ONLY (`/dev/home-lab?view=apply&screen=…`): the REAL Apple Pro page
 * (`/dashboard/[eventId]/apple-pro`) in each outcome the prototype draws
 * (frames 1 · 6 · 7 · 8 · 9). The price is a SAMPLE string standing in for
 * StoreKit's — the real page never types one.
 */
export function ApplyProSheetLab({ screen }: { screen: string }) {
  const s: IapScreen | null =
    screen === 'cancelled'
      ? { kind: 'cancelled' }
      : screen === 'failed'
        ? { kind: 'failed' }
        : screen === 'refused'
          ? { kind: 'refused', message: 'Your event already has this.' }
          : screen === 'pending'
            ? { kind: 'pending', askToBuy: false }
            : screen === 'on'
              ? { kind: 'on' }
              : null;
  return (
    <div className="min-h-dvh bg-cream">
      <AppleProScreen
        eventId="00000000-0000-4000-8000-000000000000"
        back="/dev/home-lab"
        // a SAMPLE StoreKit string — never a catalogue price
        sample={{ screen: s, price: screen === 'silent' ? null : 'PHP 5,990.00' }}
      />
    </div>
  );
}
