'use client';

/**
 * 🃏 THE ONE ROW UNDER A SERVICE CARD — Edit · Share icons, then the Online/Offline switch (owner 10 Nov on PR #7464,
 * verbatim: *"Use the service card. Add a row under. Create 2 buttons for edit and share and a toggle for offline and
 * online and swipe left to delete"* · *"Edit icon, share icon, toggle to online and offline."*).
 *
 * The card is the card — no frame around it and this row. Under it, ONE row:
 *
 *   ✏ Edit          an icon button: the Card Maker for this card — the same door the card face opens.
 *   ↗ Share         an icon button, "Share to a client". The owner's Share posts THIS card into one client event's chat
 *                   (*"It is share to an client event. To enter to a chat. That is notified so the client can see."*):
 *                   it opens "Share to a client event" (`ServiceCardShareSheet`, prototype frame G) — this shop's
 *                   client events; a pick posts the card through the shipped `offerServiceCore` and the client is told
 *                   IN THE APP ONLY (`service_card_shared`, not on the email allowlist). Never a link, never a system
 *                   share sheet.
 *   Online/Offline  the shipped worded switch (T20, the #7427 look — `SwitchTrack`), the shipped
 *                   `toggleVendorServiceActive` behind the SAME gates: going online asks the publish gate
 *                   (`publishRefusalFor` — every missing thing at once); going offline waits for every open booking
 *                   (`openBookingsRefusal` — each named on its own line). A card the PLAN holds shows `PlanHoldTag`.
 *
 * 🔁 THE REFUSAL GETS ITS OWN LINE UNDER THE ROW, never a cell (the #7427 lesson: StayForm prints a refusal as a
 * SIBLING of its form, and a sibling inside a row crushes the row). So the form holds only its hidden fields and sits
 * AFTER the row; the switch reaches it with the `form` attribute.
 *
 * 🧺 A BUNDLE CARD WEARS THIS SAME ROW (owner 10–11 Nov, DECISION_LOG: Online/Offline applies to service AND bundle
 * cards only). A bundle has no door of its own here: it hands `onToggle` (its card's one call, `bundleCardRow`, which
 * refuses going online with EVERY missing item and going offline while a booking is open) instead of `action`, and no
 * `share` — its Share is drawn WAITING until a bundle can be posted into a client's chat. Same row, same switch.
 *
 * 🔒 app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts
 * 🔒 app/vendor-dashboard/shop/bundle-cards-wear-the-card-row.test.ts
 */
import { useId, useState } from 'react';
import { Pencil, Share } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { StayForm, type StaySave } from '@/app/_components/stay-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { PlanHoldTag } from './plan-hold-tag';
import { ServiceCardShareSheet, type ServiceCardShareProps } from './service-card-share-sheet';

export type ServiceCardMenuRowProps = {
  vendorServiceId: string;
  /** The card's name, for the controls' accessible names. */
  cardName: string;
  isActive: boolean;
  /** The PLAN holds this card (`readPlanHolds`) — no switch; "On hold" opens "Which services stay on". */
  held: boolean;
  /** The Card Maker for this card (the Bundle Maker for a bundle). */
  editHref: string;
  /** A service card's switch: the shipped `toggleVendorServiceActive`, saved in place through its door. */
  action?: (fd: FormData) => unknown;
  /** The saver — `saveInPlace` itself, unless a lab hands in a stand-in. */
  save?: StaySave;
  /** A bundle card's switch, in place of `action`: the bundle card's own call (it prints its refusal under the row). */
  onToggle?: () => void;
  /** The bundle's call is on its way — the switch waits. */
  toggling?: boolean;
  /** Share to a client event: this shop's client events and the server's post (the shipped `offerServiceInterest`).
   *  Absent (a bundle) = Share is drawn waiting. */
  share?: ServiceCardShareProps;
};

export function ServiceCardMenuRow({ vendorServiceId, cardName, isActive, held, editHref, action, save, onToggle, toggling = false, share }: ServiceCardMenuRowProps) {
  const uid = useId().replace(/:/g, '');
  const formId = `card-online-${uid}`;
  const shareTitleId = `card-share-${uid}`;
  const [sharing, setSharing] = useState(false);

  return (
    <div data-card-menu={vendorServiceId}>
      <div className="flex items-center gap-2 [&>.ab]:h-10 [&>.ab]:min-h-10 [&>.ab]:w-10" data-card-menu-line="">
        <ActionButton tone="neutral" icon={Pencil} iconOnly label="Edit" name="Edit" title={`Edit ${cardName}`} href={editHref} data-card-edit={vendorServiceId} />
        <ActionButton
          tone="info"
          icon={Share}
          iconOnly
          label="Share to a client"
          name="Share to a client"
          title={share ? `Share ${cardName} to a client event` : `Share ${cardName} to a client event — coming next`}
          onClick={share ? () => setSharing(true) : undefined}
          waiting={!share}
          data-card-share={vendorServiceId}
        />
        <span className="ml-auto" />
        {held ? (
          <PlanHoldTag />
        ) : (
          <button
            type="submit"
            form={formId}
            role="switch"
            aria-checked={isActive}
            aria-label={isActive ? `${cardName} is online — turn it offline` : `${cardName} is offline — turn it online`}
            className={SWITCH_BUTTON}
            disabled={toggling}
            data-card-online={isActive ? '1' : '0'}
          >
            <SwitchTrack on={isActive} words={{ on: 'Online', off: 'Offline' }} />
          </button>
        )}
      </div>
      {held ? null : action ? (
        <StayForm id={formId} door="svServices.toggleVendorServiceActive" action={action} save={save} className="hidden">
          <input type="hidden" name="vendor_service_id" value={vendorServiceId} />
          <input type="hidden" name="is_active" value={isActive ? 'false' : 'true'} />
        </StayForm>
      ) : onToggle ? (
        <form
          id={formId}
          className="hidden"
          onSubmit={(e) => {
            e.preventDefault();
            onToggle();
          }}
        />
      ) : null}
      {share ? (
        <ServiceCardShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          labelledById={shareTitleId}
          vendorServiceId={vendorServiceId}
          cardName={cardName}
          isActive={isActive}
          targets={share.targets}
          share={share.share}
        />
      ) : null}
    </div>
  );
}
