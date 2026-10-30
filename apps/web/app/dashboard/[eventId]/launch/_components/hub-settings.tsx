'use client';

import type { ReactNode } from 'react';
import { ChevronRight, Eye, Gift } from 'lucide-react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { InfoTip } from '@/app/_components/info-tip';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { LOOK_SECTIONS, LOOK_SECTION_LABEL, type LookSection } from '@/lib/maker-look-sections';
import { GUESTS_SEE_WORDS } from '@/lib/guests-see-table';
import { STUDIO_LIVE_LINE } from './studio-tools';
import { guestsSeeWorkArea } from './guests-see-sheet';

/**
 * ⚙ THE HUB'S ONE ⚙ — EVENT HUB SETTINGS, at the right end of its pinned row (owner 2026-10-30, DECISION_LOG "EVENT HUB
 * PRO (look redesign) — THE APP'S NAV STAYS": [Stage ▾ | Studio ▾] · ↺ · ✓ · ⚙; the 26 Oct "EACH MENU HAS ITS OWN
 * SETTINGS" door, `lib/menu-settings.ts`). The house door every menu has (`MenuSettingsButton`) — never a sheet of the
 * Maker's own.
 *
 * 🗂 ITS SHEET, GROUPED BY TOPIC (the approved prototype's `openSettings`; owner: *"Stages and the Studio will be on
 * dropdown. move all other details on the settings."*) — every control is a shipped one, moved, never redrawn:
 *   · LOOK — Background · Elements · Music: each opens the shipped Look editor on that section, in the Maker (DECISION_LOG
 *     2026-10-27 "LOOK MOVES TO EVENT HUB SETTINGS");
 *   · YOUR EVENT HUB — the address · Go live · who can view · which version · Event Bar · the event QR: the shipped
 *     "More for guests" rows, open (`StudioHubSettings bare`, built by the server — `hubSettingsEditor`); its "these
 *     change right away" line is the group's ⓘ (2026-10-27 "INFO SPLITS BY WHAT IT IS ABOUT": the Hub's address
 *     stays in Event Hub ⚙);
 *   · WHAT GUESTS SEE — the shipped sheet (`GuestsSeeSheet`), which was the last row of Studio ▾ (the prototype's Q4,
 *     drawn as A: "everything guests see on the Hub only in Event Hub Settings", 26 Oct);
 *   · E-GIFTS — Ways to give: the shipped E-Gifts page (2026-10-27 "APPROVED — SETTINGS PER MENU", call 5);
 *   · and one closing line: the names, the date, the venues and the parents are Home › Event Settings.
 *
 * ⚡ Its own module, reached through the lazy stand-in (`details-lazy.tsx` `HubSettingsGear`): the house sheet, its ⓘ and
 * its rows are not in the Maker's first load (`scripts/check-maker-js-budget.mjs` — the first load sits at its
 * ceiling). The shell holds `open`, so Settings › Who can view in the lower third opens the same sheet.
 */
export type HubSettingsDoors = {
  /** Open the shipped Look editor on one section (the sheet closes; the Maker shows the page). */
  look: (section: LookSection) => void;
  /** "Your Event Hub" — the server's node; null: it could not be built (said), `pending`: still on its way (said). */
  hub: ReactNode;
  pending: boolean;
  /** Open "What guests see" (the sheet closes). Offered only where the work area can answer it (a stage's editor). */
  guestsSee: () => void;
  /** E-Gifts — its page, and the line its Studio card says ("2 ways to give"); null where the event draws no E-Gifts. */
  gifts: { line: string; open: () => void } | null;
};

/** What each Look section holds, in the words of the Look restudy (DECISION_LOG 2026-10-08, `lib/maker-look-sections.ts`). */
const LOOK_SECTION_LINE: Readonly<Record<LookSection, string>> = {
  background: 'Behind every scene · the page colour',
  elements: 'Colours · font · buttons',
  music: 'The song, and whether it plays',
};

const GROUP = 'px-1 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55';

export function HubSettingsGear({
  open,
  onOpenChange,
  doors,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doors: HubSettingsDoors;
  /** The work area's own extras (the Event Hub Pro line), drawn after the groups. */
  children?: ReactNode;
}) {
  /* Asked only while the sheet is open: the work area's table says whether "What guests see" can be offered. */
  const guestsSeeShown = open && guestsSeeWorkArea() !== null;
  const go = (act: () => void) => () => {
    onOpenChange(false);
    act();
  };
  return (
    <MenuSettingsButton menu="hub" open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col px-3 pb-4 lg:px-4" data-hub-settings="">
        {/* ── LOOK ── */}
        <section data-hub-settings-group="look">
          <p className={GROUP}>
            <InfoTip label="Look" align="start">
              How the whole Event Hub looks — its background, its elements (colours, font, buttons) and its music. Each opens the
              Look editor in the Maker; what you change waits for ✓ Apply.
            </InfoTip>
          </p>
          <FormRows data="hub-look">
            {LOOK_SECTIONS.map((k) => (
              <FormRow key={k} data={`look-${k}`} name={LOOK_SECTION_LABEL[k]} line={LOOK_SECTION_LINE[k]} attrs={{ 'data-hub-settings-look': k }}>
                <ActionButton tone="neutral" iconOnly icon={ChevronRight} label={`Open ${LOOK_SECTION_LABEL[k]}`} onClick={go(() => doors.look(k))} />
              </FormRow>
            ))}
          </FormRows>
        </section>

        {/* ── YOUR EVENT HUB ── */}
        <section data-hub-settings-group="your-event-hub">
          <p className={GROUP}>
            <InfoTip label="Your Event Hub" align="start">
              {STUDIO_LIVE_LINE} Everything else waits for ✓ Apply.
            </InfoTip>
          </p>
          {doors.hub ?? (
            <p
              role={doors.pending ? 'status' : 'alert'}
              className={`py-3 text-[13px] ${doors.pending ? 'text-ink/60' : 'text-danger-700'}`}
              data-hub-settings-hub={doors.pending ? 'pending' : 'unread'}
            >
              {doors.pending
                ? 'Loading your Event Hub’s address, who can view it and its QR…'
                : 'Your Event Hub settings could not be loaded just now. Nothing was changed — please reopen this in a moment.'}
            </p>
          )}
        </section>

        {/* ── WHAT GUESTS SEE ── */}
        {guestsSeeShown ? (
          <section data-hub-settings-group="guests-see">
            <p className={GROUP}>
              <InfoTip label={GUESTS_SEE_WORDS.title} align="start">
                Which parts show at each stage. Our picks are the defaults; what you changed is marked.
              </InfoTip>
            </p>
            <FormRows data="hub-guests-see">
              <FormRow data="guests-see" name={GUESTS_SEE_WORDS.menuLine} attrs={{ 'data-hub-settings-row': 'guests-see' }}>
                <ActionButton tone="neutral" iconOnly icon={Eye} label={`Open ${GUESTS_SEE_WORDS.title}`} onClick={go(doors.guestsSee)} />
              </FormRow>
            </FormRows>
          </section>
        ) : null}

        {/* ── E-GIFTS ── */}
        {doors.gifts ? (
          <section data-hub-settings-group="gifts">
            <p className={GROUP}>
              <InfoTip label="E-Gifts" align="start">
                How guests can give — GCash · Maya · bank · PayPal. It waits for ✓ Apply like the page.
              </InfoTip>
            </p>
            <FormRows data="hub-gifts">
              <FormRow data="gifts" name="Ways to give" line={doors.gifts.line} attrs={{ 'data-hub-settings-row': 'gifts' }}>
                <ActionButton tone="neutral" iconOnly icon={Gift} label="Open E-Gifts" onClick={go(doors.gifts.open)} />
              </FormRow>
            </FormRows>
          </section>
        ) : null}

        {children}

        <p className="pt-4 text-[12.5px] leading-snug text-ink/55" data-hub-settings-elsewhere="">
          Names, date, venues and parents are in Home › Event settings.
        </p>
      </div>
    </MenuSettingsButton>
  );
}
