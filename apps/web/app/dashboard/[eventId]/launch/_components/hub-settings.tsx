'use client';

import type { ReactNode } from 'react';
import { ChevronRight, History, Lock, Printer, Undo2 } from 'lucide-react';
import type { MakerDraftDoor } from './maker-context';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { InfoTip } from '@/app/_components/info-tip';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import type { LookSection } from '@/lib/maker-look-sections';
import { HUB_SETTINGS_GROUP } from './studio-tools';
import { guestsSettingsHref } from '@/lib/event-settings-record';
import { PRINTS_PAGE_LABEL } from '@/lib/prints-page-href';

/**
 * ⚙ THE HUB'S ONE ⚙ — EVENT HUB SETTINGS, at the right end of its pinned row (owner 2026-10-30, DECISION_LOG "EVENT HUB
 * PRO (look redesign) — THE APP'S NAV STAYS": ● Stage ▾ · ↺ · ✓ · ⚙ — its Studio half retired 2026-11-10; the 26 Oct "EACH MENU HAS ITS OWN
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
 *     stays in Event Hub ⚙); and PRINTS, its last row (Build 6 Lane F, owner 2026-11-10 pick B — *"Prints in ⚙"*; prototype
 *     `prototypes/event_hub_stages_scenes_2026-11-10/` frame H4): it opens the shipped Prints page (`printsPageHref`), the
 *     same page Home's Prints line forwards to — prints are made FROM the Hub, not a scene of it;
 *   · WHAT GUESTS SEE — the shipped sheet (`GuestsSeeSheet`), which was the last row of Studio ▾ (the prototype's Q4,
 *     drawn as A: "everything guests see on the Hub only in Event Hub Settings", 26 Oct);
 *   · E-GIFTS — Ways to give: the shipped E-Gifts page (2026-10-27 "APPROVED — SETTINGS PER MENU", call 5);
 *   · and one closing line: the names, the date, the venues and the parents are Home › Event Settings.
 *
 * ↺ HISTORY · WAITING FOR ✓ APPLY (owner 20 Nov 2026, DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED"
 * (5) and "MAKER: EVENT HUB SETTINGS REGROUPED" (1); prototype v17 `gearSheet`): ↺ left the top bar, so the newest edits
 * waiting for ✓ Apply are listed here, with "Undo last change" and the whole list (the shipped `hub-history-sheet.tsx`) —
 * after the rows that change right away, before Event info. ⏭ The rest of that regroup (Sharing · On every page · Share and
 * print as their own groups, Event info 🔒, and the Look row leaving ⚙ for the toolbar's 🎨 Look button) is part 4's.
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
  /** 🖨 Prints — the shipped Prints page's address (`printsPageHref`); null where the event has no Hub to print from. */
  prints: { href: string } | null;
  /** ↺ History — the draft bar's list and its one step back (`MakerDraftDoor.history`); absent until the bar is up. */
  history?: MakerDraftDoor['history'] | null;
};

/** The Prints row's line — the prototype's words (frame H4). */
export const HUB_SETTINGS_PRINTS_LINE = 'The six · one settings sheet · a download per piece';

/**
 * 🔒 EVENT INFO — what the app runs on (the approved drawing v17 `gearSheet`): names, date, venues and parents are set in
 * Today › Event settings; the guest list, RSVP questions and seats in Guests; the Mood Board and dress colours in Event ›
 * Mood Board. Shown here, edited in their one home.
 */
export const HUB_EVENT_INFO = [
  {
    key: 'facts',
    name: 'Names, date, venues, parents',
    line: 'Today › Event settings',
    why: 'Reminders, the countdown, maps and the guest pass all read these. Set once, so every page agrees.',
    href: (id: string) => `/dashboard/${id}?settings=1`,
  },
  { key: 'guests', name: 'Guest list, RSVP questions, seats', line: 'In Guests', why: '', href: (id: string) => guestsSettingsHref(id) },
  { key: 'mood', name: 'Mood Board and dress colours', line: 'In Event › Mood Board', why: '', href: (id: string) => `/dashboard/${id}/studio/mood-board` },
] as const;

export function HubSettingsGear({
  open,
  onOpenChange,
  doors,
  eventId,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doors: HubSettingsDoors;
  /** The event — Event info's rows open its own homes (Today › Event settings, Guests, Mood Board). */
  eventId: string;
  /** The work area's own extras (the full Event Hub line), drawn after the groups. */
  children?: ReactNode;
}) {
  const go = (act: () => void) => () => {
    onOpenChange(false);
    act();
  };
  return (
    <MenuSettingsButton menu="hub" open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col px-3 pb-4 lg:px-4" data-hub-settings="">
        {/* ── SHARING · ON EVERY PAGE · SHARE AND PRINT — the shipped rows, grouped (`StudioHubSettings bare`) ── */}
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
        {/* 🖨 PRINTS — the last row of Share and print (Build 6 Lane F pick B; v17 `gearSheet`): the shipped Prints page. */}
        {doors.prints ? (
          <FormRows data="hub-prints">
            <FormRow data="prints" name={PRINTS_PAGE_LABEL} line={HUB_SETTINGS_PRINTS_LINE} attrs={{ 'data-hub-settings-row': 'prints' }}>
              <ActionButton tone="neutral" iconOnly icon={Printer} label={`Open ${PRINTS_PAGE_LABEL}`} href={doors.prints.href} />
            </FormRow>
          </FormRows>
        ) : null}

        {/* ── HISTORY · waiting for ✓ Apply ── after the rows that change right away (20 Nov, "EVENT HUB SETTINGS REGROUPED"). */}
        {doors.history ? (
          <section data-hub-settings-group="history">
            <p className={HUB_SETTINGS_GROUP}>
              <InfoTip label="History · waiting for ✓ Apply" align="start">
                Every edit saves to your draft by itself. Guests see nothing until ✓ Apply.
              </InfoTip>
            </p>
            {doors.history.recent === null ? (
              <p role="alert" className="py-3 text-[13px] text-danger-700" data-hub-settings-history="unread">
                Your history could not be read just now. Nothing was changed.
              </p>
            ) : doors.history.recent.length === 0 ? (
              <p className="py-3 text-[13px] text-ink/60" data-hub-settings-history="none">
                <span className="block font-semibold text-ink/80">Nothing waiting</span>
                Your changes collect here until ✓ Apply
              </p>
            ) : (
              <FormRows data="hub-history">
                {doors.history.recent.map((what, i) => (
                  <FormRow key={`${i}:${what}`} data={`history-${i}`} name={what} line="Waiting for ✓ Apply" attrs={{ 'data-hub-settings-history-row': String(i) }} />
                ))}
              </FormRows>
            )}
            {doors.history.recent !== null && doors.history.recent.length > 0 ? (
              <div className="flex gap-2 pt-2" data-hub-settings-history-actions="">
                <ActionButton
                  tone="neutral"
                  icon={Undo2}
                  label="Undo last change"
                  disabled={!doors.history.canUndo}
                  waiting={doors.history.busy}
                  onClick={go(doors.history.undo)}
                />
                <ActionButton tone="neutral" icon={History} label="All changes" onClick={go(doors.history.open)} />
              </div>
            ) : null}
          </section>
        ) : null}

        {children}

        {/* ── 🔒 EVENT INFO · the app runs on these (20 Nov "ONE LOOK HOME" (3)): shown, never edited in the Maker. Each
            has one home outside it. ── */}
        <section data-hub-settings-group="event-info">
          <p className={HUB_SETTINGS_GROUP}>Event info · the app runs on these</p>
          <FormRows data="hub-event-info">
            {HUB_EVENT_INFO.map((row) => (
              <FormRow key={row.key} data={`event-info-${row.key}`} name={row.name} line={row.line} attrs={{ 'data-hub-settings-info': row.key }}>
                {row.key === 'facts' ? (
                  <span className="inline-flex items-center gap-1 text-ink/55">
                    <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
                    <InfoTip label="" ariaLabel={`Why ${row.name.toLowerCase()} are set in Today`} align="end">
                      {row.why}
                    </InfoTip>
                  </span>
                ) : (
                  <ActionButton tone="neutral" iconOnly icon={ChevronRight} label={`Open ${row.line.replace(/^In /, '')}`} href={row.href(eventId)} />
                )}
              </FormRow>
            ))}
          </FormRows>
        </section>
      </div>
    </MenuSettingsButton>
  );
}
