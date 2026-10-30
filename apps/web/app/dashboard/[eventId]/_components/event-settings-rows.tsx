import type { ReactNode } from 'react';
import { parentsOffered, yourEventLabel } from '@/lib/details-your-event';
import { yourEventFactEditors, type YourEventInput } from '../launch/_components/details-your-event-parts';
import { ParentCards } from '../launch/_components/details-lazy';
import { PeopleWithAccess } from '../details/_components/people-with-access';
import type { PersonRow } from '@/lib/people-with-access';
import type { ClaimAccessAsk } from '@/lib/claim-access-asks';
import { EventSettingsEditor } from '../details/_components/event-settings-editor';
import { PutAwayCard } from '../details/_components/put-away-card';
import { PlanMyselfSwitch } from '../launch/_components/plan-myself';
import { OneCodeUnderGetIn } from '../studio/papic/_components/one-code';
import type { EventSettingsInput } from '../launch/_components/details-settings-load';

/**
 * 🗂 THE REST OF EVENT DETAILS' OWN SETTINGS (owner 2026-10-30, *"move them all in the event settings"* · *"they were
 * suppose to combine the event details and event settings together on the event settings"* — completing DECISION_LOG
 * 2026-10-26 "FINAL STRUCTURE" (2) and "EACH MENU HAS ITS OWN SETTINGS" (2)). Each is the component Event Details
 * mounts, moved — never redrawn:
 *   · `settings` — kind · area · guest estimate · budget · feel: `EventSettingsEditor`, the record's `settings` field
 *     (its three shipped editors, saving live); 'failed' = its read failed (said, never an empty form);
 *   · `planMyself` — Plan it myself, `PlanMyselfSwitch` (null = unread, the switch says so);
 *   · `oneCode` — How guests get in: the one code + every guest's own QR (`OneCodeUnderGetIn`), where the camera is on;
 *   · `putAway` — Put this away, `PutAwayCard`, last and quiet.
 * What Event Details only SHOWED stays with its own menu (the 2026-10-26 "each menu has its own settings"): the look,
 * the answers, the Love Story → the Maker / Event Hub ⚙; budget, suppliers, purchases → Suppliers; times → Schedule.
 */
export type EventSettingsMore = {
  settings: EventSettingsInput | 'failed' | null;
  planMyself: boolean | null;
  oneCode: boolean;
  putAway: { archived: boolean; eventName: string } | null;
};

/**
 * 👥 PEOPLE WITH ACCESS, as the sheet's last section (owner 2026-10-30, verbatim: *"no. that shoud be inside home
 * settings"* → *"move them all in the event settings"*). The SAME `PeopleWithAccess` Event Details' "Event access"
 * fold mounts — the same rows, the same actions (`setGuestAccess` · `setDelegateArea` · `removeHost`), each saving at
 * once, never on Apply. `measured: false` = the read FAILED (the section says so, never "nobody has access").
 */
export type EventSettingsAccess =
  | {
      measured: true;
      rows: PersonRow[];
      addable: { guestId: string; name: string }[];
      claims: { measured: boolean; asks: ClaimAccessAsk[] } | null;
      flash: string | null;
    }
  | { measured: false; claims: { measured: boolean; asks: ClaimAccessAsk[] } | null; flash: string | null };

/**
 * ⚙ EVENT SETTINGS' ROWS — names · date · venues · parents, each its ONE shipped editor (owner 2026-10-29, *"keep it
 * there"*; DECISION_LOG 2026-10-27 "INFO SPLITS BY WHAT IT IS ABOUT"). Composed here ONCE: the action that reads them at
 * the ⚙'s press (`open-event-settings.tsx`) and the Home lab's fixture (`/dev/home-lab?settings=1`) draw the same rows.
 *
 *   · Names · Date · Venues — `yourEventFactEditors`, the builder the Maker's Details and Event Details' rows mount
 *     (`every-fact-has-one-editor.test.ts`);
 *   · Parents — `ParentCards`, the Maker's own list + add (a tapped parent opens THE guest card);
 *   · `dock` — the Maker's own Undo · Apply (`HubDraftDock`) on top, as Event Details carries it: these facts save into
 *     the Event Hub draft and go live at Apply;
 *   · People with access — LAST, `PeopleWithAccess` itself (above): access is a door, so it changes at once.
 *
 * `input` null = an event whose type has no Event Hub (its names · date · venues have no Maker editor) — the sheet then
 * holds People with access alone.
 *
 * No frames around the rows — a divider between topics; frames only on what is pressed.
 */
export function EventSettingsRows({
  eventId,
  input,
  parents,
  dock,
  access = null,
  more = null,
}: {
  eventId: string;
  input: YourEventInput | null;
  /** The parents on the invitation; null = they could not be read (said, never drawn as none). */
  parents: ReadonlyArray<{ guestId: string | null; name: string }> | null;
  dock: ReactNode;
  /** People with access — the couple's (null: not drawn). */
  access?: EventSettingsAccess | null;
  /** The rest of the event's own settings, moved from Event Details (null: not drawn — the Home lab). */
  more?: EventSettingsMore | null;
}) {
  const editors = input ? yourEventFactEditors({ eventId, input }) : null;
  const withParents = input ? parentsOffered(input.kind) : false;
  return (
    <div data-event-settings-body="" className="flex flex-col gap-5 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
      {dock ? (
        <div data-event-settings-dock="" className="flex items-center justify-end gap-1.5">
          {dock}
        </div>
      ) : null}
      {input && editors?.names ? (
        <FactRow row="names" title={yourEventLabel('names', input.kind)}>
          {editors.names}
        </FactRow>
      ) : null}
      {input && editors ? (
        <FactRow row="date" title={yourEventLabel('date', input.kind)}>
          {editors.date}
        </FactRow>
      ) : null}
      {input && editors ? (
        <FactRow row="venues" title={yourEventLabel('venues', input.kind)}>
          {editors.venues}
        </FactRow>
      ) : null}
      {input && withParents ? (
        <FactRow row="parents" title={yourEventLabel('parents', input.kind)}>
          {parents ? (
            <ParentCards eventId={eventId} parents={parents.map((p) => ({ guestId: p.guestId ?? null, name: p.name }))} />
          ) : (
            <p role="alert" className="text-sm text-terracotta-700">
              The parents couldn’t be read just now. Nothing was changed — close this and try again.
            </p>
          )}
        </FactRow>
      ) : null}
      {more?.settings ? (
        <FactRow row="event" title="Kind, area and guests">
          {more.settings === 'failed' ? (
            <p role="alert" className="text-sm text-terracotta-700">
              These couldn’t be read just now. Nothing was changed — close this and try again.
            </p>
          ) : (
            <EventSettingsEditor eventId={eventId} form={more.settings.form} governed={more.settings.governed} pax={more.settings.pax} />
          )}
        </FactRow>
      ) : null}
      {more ? (
        <FactRow row="plan" title="Planning">
          <PlanMyselfSwitch eventId={eventId} on={more.planMyself} />
        </FactRow>
      ) : null}
      {more?.oneCode ? (
        <FactRow row="get-in" title="How guests get in">
          <OneCodeUnderGetIn eventId={eventId} />
        </FactRow>
      ) : null}
      {access ? (
        <FactRow row="access" title="People with access">
          <PeopleWithAccess
            eventId={eventId}
            rows={access.measured ? access.rows : []}
            addable={access.measured ? access.addable : []}
            readOnly={false}
            failed={!access.measured}
            flash={access.flash}
            claims={access.claims}
            returnTo="home"
          />
        </FactRow>
      ) : null}
      {more?.putAway ? (
        <div data-event-settings-row="put-away" data-section="put-away" className="border-t border-ink/10 pt-4">
          <PutAwayCard eventId={eventId} archived={more.putAway.archived} eventName={more.putAway.eventName} />
        </div>
      ) : null}
    </div>
  );
}

/** One fact: its name, then its editor — a divider between topics. */
function FactRow({ row, title, children }: { row: string; title: string; children: ReactNode }) {
  return (
    <section
      data-event-settings-row={row}
      className="flex flex-col gap-2 border-t border-ink/10 pt-4 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}
