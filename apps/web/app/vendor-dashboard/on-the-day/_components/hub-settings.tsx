'use client';

import { useState } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { DatesRow } from '../../customers/_components/dates-row';
import { CREW_ROLE_LABEL, crewToolsWords } from '@/lib/crew-pass';

/**
 * ⚙ THE SUPPLIER'S HUB ⚙ (supplier dashboard v13, owner "Approved." 2026-10-29 — prototype `renderViewrow` "Hub ▾ · ⓘ ·
 * ⚙" and `settingsSheet()` for the Hub; DECISION_LOG 2026-10-31 "SUPPLIER HUB: ONE ROW, ITS ⚙, CREW SEARCH"). The house ⚙
 * (`MenuSettingsButton`, menu `supplier-hub`), mounted ONCE here, at the right end of the Hub's one row, after the ⓘ.
 *
 * WHAT IS IN IT IS WHAT EXISTS (the Today ⚙'s rule, `today-settings.tsx`). The v13 sheet draws four rows; measured
 * 2026-10-31 against the code and the schema:
 *   · "Crew view — what a crew phone sees after the QR" — DRAWN: the roles' own words (`crewToolsWords`, the same
 *     sentence the Crew list and the crew phone say), for this shop's trade (the scanner opens only for a coordinator
 *     shop's crew — `crewRoleOpens`). It is set once, by the rules; which role each phone holds is picked in Crew.
 *   · "Helpers see the scanner · not the money" — DRAWN as part of Crew view: a Helper's tools are the scanner alone by
 *     rule; there is no per-shop switch to turn it off, so it is said, never drawn as a switch that saves nothing.
 *   · "Scans post to the couple's Event Hub" — NOT drawn: no per-shop switch exists.
 *   · "Countdown sound" — NOT drawn: nothing stores it.
 * The two undrawn rows wait on the owner's word and a column.
 */
export function HubSettings({ coordinator }: { coordinator: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <MenuSettingsButton menu="supplier-hub" open={open} onOpenChange={setOpen}>
      <div className="px-4 pb-6 pt-2" data-hub-settings="">
        <p className="home-k2 pt-2">Crew view</p>
        <p className="pb-1 text-[12.5px] text-ink/60">What a crew phone opens after your QR. Pick each phone’s role in Crew.</p>
        <div data-hub-settings-crew="">
          {(['member', 'helper'] as const).map((r) => (
            <DatesRow key={r} data={`hub-settings-role-${r}`} title={CREW_ROLE_LABEL[r]} line={`${crewToolsWords(r, coordinator)} · never the money`} />
          ))}
        </div>
      </div>
    </MenuSettingsButton>
  );
}
