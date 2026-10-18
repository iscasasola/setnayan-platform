'use client';

import { ApplyProSheet } from '@/app/dashboard/[eventId]/website/_components/apply-pro-sheet';
import { appleProParts } from '@/lib/iap/pro-at-apply';
import type { IapScreen } from '@/lib/iap/iap-outcome';
import type { HubProEffectView } from '@/lib/hub-pro-effect-view';

/**
 * DEV-ONLY (`/dev/home-lab?view=apply&screen=…`): the REAL Apply sheet with the
 * REAL Apple pieces (`appleProParts`), in each outcome the prototype draws
 * (frames 1 · 6 · 7 · 8 · 9). The price is a SAMPLE string standing in for
 * StoreKit's — the real sheet never types one.
 */
const EFFECTS = [
  { id: 'look:velvet', what: 'Velvet', where: 'Theme', jump: null, removable: true },
  { id: 'anim:rise', what: 'Rise', where: 'Animation · Schedule', jump: null, removable: true },
] as unknown as HubProEffectView[];

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
  const silent = screen === 'silent';
  return (
    <div className="min-h-dvh bg-cream">
      <ApplyProSheet
        effects={screen === 'on' ? [] : EFFECTS}
        changeCount={screen === 'on' ? 0 : 5}
        priceLabel={null}
        proHref={null}
        pending={false}
        onGo={() => {}}
        onRemove={() => {}}
        onApplyFree={() => {}}
        onClose={() => {}}
        apple={appleProParts({
          price: silent ? null : '₱5,990.00',
          priceState: silent ? 'silent' : 'ready',
          buying: false,
          applying: false,
          screen: s,
          proCount: 2,
          applied: { count: 5, names: ['Velvet', 'Rise'] },
          onBuy: () => {},
          onDone: () => {},
        })}
      />
    </div>
  );
}
