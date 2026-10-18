'use client';

import { ApplyProSheet, type ApplePro } from '@/app/dashboard/[eventId]/website/_components/apply-pro-sheet';
import { IAP_COPY, pendingLine } from '@/lib/iap/iap-outcome';
import type { HubProEffectView } from '@/lib/hub-pro-effect-view';

/**
 * DEV-ONLY (`/dev/home-lab?view=apply&screen=…`): the REAL Apply sheet selling
 * Event Hub Pro through Apple, in each outcome the prototype draws (frames 1 ·
 * 6 · 7 · 8 · 9). The price is a SAMPLE string standing in for StoreKit's —
 * the real sheet never types one.
 */
const EFFECTS = [
  { id: 'look:velvet', what: 'Velvet', where: 'Theme', jump: null, removable: true },
  { id: 'anim:rise', what: 'Rise', where: 'Animation · Schedule', jump: null, removable: true },
] as unknown as HubProEffectView[];

const COPY: ApplePro['copy'] = {
  cancelled: IAP_COPY.cancelled,
  failedLead: IAP_COPY.failedLead,
  failedNext: IAP_COPY.failedNext,
  pendingTitle: IAP_COPY.pendingTitle,
  pendingBody: pendingLine('Event Hub Pro', false),
  pendingRestore: IAP_COPY.pendingRestore,
  askToBuy: IAP_COPY.askToBuy,
  billedByApple: IAP_COPY.billedByApple,
  receipt: IAP_COPY.receipt,
  storeSilent: IAP_COPY.storeSilent,
};

export function ApplyProSheetLab({ screen }: { screen: string }) {
  const s: ApplePro['screen'] =
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
        apple={{
          price: silent ? null : '₱5,990.00',
          priceState: silent ? 'silent' : 'ready',
          buying: false,
          screen: s,
          applied: { count: 5, names: ['Velvet', 'Rise'] },
          copy: COPY,
          onBuy: () => {},
          onDone: () => {},
        }}
      />
    </div>
  );
}
