'use client';

import type { ReactNode } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';

/**
 * ⚙ THE HUB'S ONE ⚙ — EVENT HUB SETTINGS, at the right end of its pinned row (owner 2026-10-30, DECISION_LOG "EVENT HUB
 * PRO (look redesign) — THE APP'S NAV STAYS": [Stage ▾ | Studio ▾] · ↺ · ✓ · ⚙; the 26 Oct "EACH MENU HAS ITS OWN
 * SETTINGS" door, `lib/menu-settings.ts`). The house door every menu has (`MenuSettingsButton`) — never a sheet of the
 * Maker's own.
 *
 * ⚡ Its own module, reached through the lazy stand-in (`details-lazy.tsx` `HubSettingsGear`): the house sheet, its ⓘ
 * and its button are not in the Maker's first load (`scripts/check-maker-js-budget.mjs` — the first load sits at its
 * ceiling). The shell holds `open`, so Settings › Who can view in the lower third opens the same sheet.
 */
export function HubSettingsGear({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <MenuSettingsButton menu="hub" open={open} onOpenChange={onOpenChange}>
      {children}
    </MenuSettingsButton>
  );
}
